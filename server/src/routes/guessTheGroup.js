import { Router } from 'express'
import { getGuessGroupSongForDate } from '../services/dailySong.js'
import { getPreviewUrl } from '../services/audioProvider.js'
import { getKSTDateString } from '../utils/dateUtils.js'
import { getCommunityStats } from '../services/statsDb.js'
import { captureError } from '../services/observability.js'
import { GUESS_GROUP_LAUNCH } from '../data/launch.js'
import groups from '../data/groups.json' with { type: 'json' }

const router = Router()

const ACTIVE_GROUPS = groups.filter(g => g.active)

// Built once — the answer space is just the active group display names.
const GROUP_NAMES = ACTIVE_GROUPS.map(g => g.displayName)

router.get('/game/today', async (req, res) => {
  try {
    const { song, dateString, gameNumber, poolSize } = getGuessGroupSongForDate(ACTIVE_GROUPS, getKSTDateString())
    const previewUrl = await getPreviewUrl(song, song.deezerArtistName)

    // Short CDN-only cache; previewUrl expires quickly. Mirrors kpopdle /today.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30')
    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalGroups: GROUP_NAMES.length,
      totalSongs: poolSize,
      // Year is the only spoiler-free hint here: the album/era name uniquely
      // identifies the GROUP (the answer), and the song title's first letter
      // would narrow the group too. So this mode exposes only `year`.
      hints: {
        year: song.releaseYear,
      },
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching guess-the-group game' })
    res.status(500).json({ error: 'Failed to load guess-the-group game' })
  }
})

router.get('/game/archive/:date', async (req, res) => {
  const { date } = req.params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
  }
  const today = getKSTDateString()
  if (date >= today) {
    return res.status(400).json({ error: 'Archive only available for past games' })
  }
  if (date < GUESS_GROUP_LAUNCH) {
    return res.status(400).json({ error: 'Date is before Guess the Group launch' })
  }

  try {
    const { song, dateString, gameNumber, poolSize } = getGuessGroupSongForDate(ACTIVE_GROUPS, date)
    const previewUrl = await getPreviewUrl(song, song.deezerArtistName)

    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalGroups: GROUP_NAMES.length,
      totalSongs: poolSize,
      // Year only — see /game/today for why era/firstLetter are withheld here.
      hints: {
        year: song.releaseYear,
      },
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching guess-the-group archive game', date })
    res.status(500).json({ error: 'Failed to load guess-the-group archive game' })
  }
})

// Autocomplete source — the ~8 active group display names. The client's generic
// string-list autocomplete consumes this unchanged.
router.get('/groups-list', (req, res) => {
  try {
    res.json({ songs: GROUP_NAMES })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load groups list' })
  }
})

router.post('/game/guess', (req, res) => {
  try {
    const { gameDate, guess } = req.body

    if (!gameDate || typeof gameDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      return res.status(400).json({ error: 'gameDate is required (YYYY-MM-DD)' })
    }
    if (guess !== undefined && (typeof guess !== 'string' || guess.length > 300)) {
      return res.status(400).json({ error: 'Invalid guess' })
    }

    const today = getKSTDateString()
    if (gameDate > today) {
      return res.status(400).json({ error: 'Cannot guess future games' })
    }

    const { song } = getGuessGroupSongForDate(ACTIVE_GROUPS, gameDate)

    // Reveal payload shows BOTH song title and group. `title`/`groupDisplayName`
    // align with the existing ResultModal/share fields.
    const songPayload = {
      id: song.id,
      title: song.title,
      songTitle: song.title,
      album: song.album,
      releaseYear: song.releaseYear,
      spotifyId: song.spotifyId,
      groupId: song.groupId,
      groupDisplayName: song.groupDisplayName,
    }

    if (!guess || guess.trim() === '') {
      return res.json({ correct: false, gameOver: true, song: songPayload })
    }

    // Case-insensitive exact match of group display name. No label suffix here —
    // the autocomplete already feeds bare group names.
    const isCorrect = guess.trim().toLowerCase() === song.groupDisplayName.toLowerCase()
    // Only reveal the answer when the game is over — never on intermediate misses.
    res.json({ correct: isCorrect, gameOver: isCorrect, ...(isCorrect && { song: songPayload }) })
  } catch (err) {
    captureError(err, { msg: 'Error processing guess-the-group guess' })
    res.status(500).json({ error: 'Failed to process guess' })
  }
})

router.get('/game/community/:date', (req, res) => {
  const { date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }
  try {
    res.json(getCommunityStats('guess-the-group', date) ?? { totalPlays: 0 })
  } catch (err) {
    captureError(err, { msg: 'Guess-the-group community stats error', date })
    res.status(500).json({ error: 'Failed to fetch community stats' })
  }
})

export default router
