import { Router } from 'express'
import { getKpopdleSongForDate } from '../services/dailySong.js'
import { getPreviewUrl } from '../services/audioProvider.js'
import { getMergedPool } from '../data/songIndex.js'
import { getKSTDateString } from '../utils/dateUtils.js'
import { getCommunityStats } from '../services/statsDb.js'
import { captureError } from '../services/observability.js'
import groups from '../data/groups.json' with { type: 'json' }

const KPOPDLE_LAUNCH = '2026-05-21'

const router = Router()

const ACTIVE_GROUPS = groups.filter(g => g.active)

router.get('/game/today', async (req, res) => {
  try {
    const { song, dateString, gameNumber, poolSize } = getKpopdleSongForDate(ACTIVE_GROUPS, getKSTDateString())
    const previewUrl = await getPreviewUrl(song, song.deezerArtistName)

    // See game.js /today — short CDN-only cache; previewUrl expires quickly.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30')
    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalSongs: poolSize,
      hints: {
        era: song.album,
        year: song.releaseYear,
        firstLetter: song.title[0].toUpperCase(),
      },
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching kpopdle game' })
    res.status(500).json({ error: 'Failed to load kpopdle game' })
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
  if (date < KPOPDLE_LAUNCH) {
    return res.status(400).json({ error: 'Date is before K-POPDLE launch' })
  }

  try {
    const { song, dateString, gameNumber, poolSize } = getKpopdleSongForDate(ACTIVE_GROUPS, date)
    const previewUrl = await getPreviewUrl(song, song.deezerArtistName)

    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalSongs: poolSize,
      hints: {
        era: song.album,
        year: song.releaseYear,
        firstLetter: song.title[0].toUpperCase(),
      },
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching kpopdle archive game', date })
    res.status(500).json({ error: 'Failed to load kpopdle archive game' })
  }
})

router.get('/songs', (req, res) => {
  try {
    const pool = getMergedPool(ACTIVE_GROUPS)
    // Label each song with its group so players can disambiguate in the autocomplete
    const songs = pool.map(s => `${s.title} (${s.groupDisplayName})`)
    res.json({ songs })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load song list' })
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

    const { song } = getKpopdleSongForDate(ACTIVE_GROUPS, gameDate)

    const songPayload = {
      id: song.id,
      title: song.title,
      album: song.album,
      releaseYear: song.releaseYear,
      spotifyId: song.spotifyId,
      groupId: song.groupId,
      groupDisplayName: song.groupDisplayName,
    }

    if (!guess || guess.trim() === '') {
      return res.json({ correct: false, gameOver: true, song: songPayload })
    }

    // Strip " (Group Name)" label suffix that the autocomplete appends
    const raw = guess.trim()
    const labelMatch = raw.match(/^(.+?)\s+\([^)]+\)$/)
    const guessTitle = labelMatch ? labelMatch[1].trim() : raw

    const isCorrect = guessTitle.toLowerCase() === song.title.toLowerCase()
    // Only reveal the song when the game is over — not on intermediate wrong guesses
    res.json({ correct: isCorrect, gameOver: isCorrect, ...(isCorrect && { song: songPayload }) })
  } catch (err) {
    captureError(err, { msg: 'Error processing kpopdle guess' })
    res.status(500).json({ error: 'Failed to process guess' })
  }
})

router.get('/game/community/:date', (req, res) => {
  const { date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }
  try {
    res.json(getCommunityStats('kpopdle', date) ?? { totalPlays: 0 })
  } catch (err) {
    captureError(err, { msg: 'Kpopdle community stats error', date })
    res.status(500).json({ error: 'Failed to fetch community stats' })
  }
})

export default router
