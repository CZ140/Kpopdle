import { Router } from 'express'
import { getTodaysCoverSong, getCoverSongForDate } from '../services/dailySong.js'
import { getCoverPoolForGroup } from '../data/songIndex.js'
import { getKSTDateString } from '../utils/dateUtils.js'
import validateGroup from '../middleware/validateGroup.js'
import { getCommunityStats } from '../services/statsDb.js'
import { captureError } from '../services/observability.js'

// Coverdle mode — mirrors routes/game.js but serves an album coverUrl instead of
// an audio previewUrl. The answer is withheld until gameOver, identical to the
// audio daily (FR-4). Only songs with a backfilled coverUrl are selectable (FR-8).
const router = Router({ mergeParams: true })

// dailySong throws this exact message when a group has no playable covers yet.
// That's an expected "not provisioned" state, not a server fault — we map it to
// a clean 404 so it doesn't spam error monitoring.
const NO_COVERS_RE = /^No songs with album covers available for group:/
const NO_COVERS_BODY = { error: 'No album covers available for this group yet' }

router.use(validateGroup)

router.get('/today', (req, res) => {
  const { group } = req.params
  try {
    const { song, dateString, gameNumber } = getTodaysCoverSong(group)

    // Identical for every player for the day, and coverUrl is a stable CDN URL
    // (no short expiry like audio previews) — safe to cache briefly at the CDN.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30')
    res.json({
      gameDate: dateString,
      gameNumber,
      coverUrl: song.coverUrl,
      totalSongs: getCoverPoolForGroup(group).length,
      hints: {
        era: song.album,
        year: song.releaseYear,
        firstLetter: song.title[0].toUpperCase(),
      },
    })
  } catch (err) {
    if (NO_COVERS_RE.test(err.message)) {
      return res.status(404).json(NO_COVERS_BODY)
    }
    captureError(err, { msg: 'Error fetching daily cover game', group })
    res.status(500).json({ error: 'Failed to load daily cover game' })
  }
})

router.get('/archive/:date', (req, res) => {
  const { group, date } = req.params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
  }

  const today = getKSTDateString()
  if (date >= today) {
    return res.status(400).json({ error: 'Archive only available for past games' })
  }

  const launchDate = req.groupConfig.launchDate
  if (launchDate && date < launchDate) {
    return res.status(400).json({ error: 'Date is before group launch' })
  }

  try {
    const { song, dateString, gameNumber } = getCoverSongForDate(group, date)

    res.json({
      gameDate: dateString,
      gameNumber,
      coverUrl: song.coverUrl,
      totalSongs: getCoverPoolForGroup(group).length,
      hints: {
        era: song.album,
        year: song.releaseYear,
        firstLetter: song.title[0].toUpperCase(),
      },
    })
  } catch (err) {
    if (NO_COVERS_RE.test(err.message)) {
      return res.status(404).json(NO_COVERS_BODY)
    }
    captureError(err, { msg: 'Error fetching archive cover game', group, date })
    res.status(500).json({ error: 'Failed to load archive cover game' })
  }
})

router.get('/practice', (req, res) => {
  const { group } = req.params
  try {
    // Only pick from songs that have a cover — otherwise practice could serve a
    // round with no image to reveal (daily mode filters the same way).
    const songs = getCoverPoolForGroup(group)
    if (songs.length === 0) {
      return res.status(404).json(NO_COVERS_BODY)
    }
    const song = songs[Math.floor(Math.random() * songs.length)]
    res.json({
      coverUrl: song.coverUrl,
      totalSongs: songs.length,
      practiceSongId: song.id,
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching practice cover game', group })
    res.status(500).json({ error: 'Failed to load practice cover game' })
  }
})

router.post('/guess', (req, res) => {
  const { group } = req.params
  try {
    const { gameDate, guess, practiceSongId } = req.body

    // Practice mode: validate against the specific song sent with the request
    if (gameDate === 'practice') {
      if (!practiceSongId || typeof practiceSongId !== 'number') {
        return res.status(400).json({ error: 'practiceSongId required for practice mode' })
      }
      const song = getCoverPoolForGroup(group).find(s => s.id === practiceSongId)
      if (!song) {
        return res.status(400).json({ error: 'Invalid practice song' })
      }
      const songPayload = {
        title: song.title,
        album: song.album,
        releaseYear: song.releaseYear,
        spotifyId: song.spotifyId,
      }
      if (!guess || guess.trim() === '') {
        return res.json({ correct: false, gameOver: true, song: songPayload })
      }
      const isCorrect = guess.trim().toLowerCase() === song.title.toLowerCase()
      // Only reveal the song when the game is over — not on intermediate wrong guesses
      return res.json({ correct: isCorrect, gameOver: isCorrect, ...(isCorrect && { song: songPayload }) })
    }

    if (!gameDate || typeof gameDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      return res.status(400).json({ error: 'gameDate is required (YYYY-MM-DD)' })
    }

    if (guess !== undefined && (typeof guess !== 'string' || guess.length > 200)) {
      return res.status(400).json({ error: 'Invalid guess' })
    }

    // Guard against future dates
    const today = getKSTDateString()
    if (gameDate > today) {
      return res.status(400).json({ error: 'Cannot guess future games' })
    }

    // Works for today and any past archive date
    const { song } = getCoverSongForDate(group, gameDate)

    if (!guess || guess.trim() === '') {
      return res.json({
        correct: false,
        gameOver: true,
        song: {
          title: song.title,
          album: song.album,
          releaseYear: song.releaseYear,
          spotifyId: song.spotifyId,
        },
      })
    }

    const isCorrect = guess.trim().toLowerCase() === song.title.toLowerCase()

    // Only reveal the song when the game is over — not on intermediate wrong guesses
    res.json({
      correct: isCorrect,
      gameOver: isCorrect,
      ...(isCorrect && {
        song: {
          id: song.id,
          title: song.title,
          album: song.album,
          releaseYear: song.releaseYear,
          spotifyId: song.spotifyId,
        },
      }),
    })
  } catch (err) {
    captureError(err, { msg: 'Error processing cover guess', group })
    res.status(500).json({ error: 'Failed to process guess' })
  }
})

router.get('/community/:date', (req, res) => {
  const { group, date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }
  try {
    // Cover-mode community stats live under a `${group}-cover` key so they never
    // pollute the audio daily's stats (FR-7).
    res.json(getCommunityStats(`${group}-cover`, date) ?? { totalPlays: 0 })
  } catch (err) {
    captureError(err, { msg: 'Cover community stats error', group, date })
    res.status(500).json({ error: 'Failed to fetch community stats' })
  }
})

export default router
