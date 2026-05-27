import { Router } from 'express'
import { getTodaysSong, getSongForDate } from '../services/dailySong.js'
import { getPreviewUrl } from '../services/audioProvider.js'
import { getSongsForGroup, getSongCountForGroup } from '../data/songIndex.js'
import { getKSTDateString } from '../utils/dateUtils.js'
import validateGroup from '../middleware/validateGroup.js'
import { getCommunityStats } from '../services/statsDb.js'
import { captureError } from '../services/observability.js'

const router = Router({ mergeParams: true })

router.use(validateGroup)

router.get('/today', async (req, res) => {
  const { group } = req.params
  try {
    const { song, dateString, gameNumber } = getTodaysSong(group)
    const previewUrl = await getPreviewUrl(song, req.groupConfig.deezerArtistName)

    // Identical for every player for the day, but previewUrl carries a short
    // Deezer expiry — so cache only briefly at the CDN (Cloudflare) and never
    // in the browser. Realizing the offload needs a Cloudflare cache rule for
    // this path; the header is the prerequisite.
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30')
    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalSongs: getSongCountForGroup(group),
      hints: {
        era: song.album,
        year: song.releaseYear,
        firstLetter: song.title[0].toUpperCase(),
      },
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching daily game', group })
    res.status(500).json({ error: 'Failed to load daily game' })
  }
})

router.get('/archive/:date', async (req, res) => {
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
    const { song, dateString, gameNumber } = getSongForDate(group, date)
    const previewUrl = await getPreviewUrl(song, req.groupConfig.deezerArtistName)

    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalSongs: getSongCountForGroup(group),
      hints: {
        era: song.album,
        year: song.releaseYear,
        firstLetter: song.title[0].toUpperCase(),
      },
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching archive game', group, date })
    res.status(500).json({ error: 'Failed to load archive game' })
  }
})

router.get('/practice', async (req, res) => {
  const { group } = req.params
  try {
    // Only pick from songs with a verified Deezer ID — otherwise practice can
    // serve a silent, unplayable round (daily mode filters the same way).
    const songs = getSongsForGroup(group).filter(s => s.deezerId && s.deezerId !== 0)
    if (songs.length === 0) {
      return res.status(500).json({ error: 'No playable songs for this group' })
    }
    const song = songs[Math.floor(Math.random() * songs.length)]
    const previewUrl = await getPreviewUrl(song, req.groupConfig.deezerArtistName)
    res.json({
      previewUrl,
      totalSongs: songs.length,
      practiceSongId: song.id,
    })
  } catch (err) {
    captureError(err, { msg: 'Error fetching practice game', group })
    res.status(500).json({ error: 'Failed to load practice game' })
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
      const songs = getSongsForGroup(group)
      const song = songs.find(s => s.id === practiceSongId)
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
    const { song } = getSongForDate(group, gameDate)

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
    captureError(err, { msg: 'Error processing guess', group })
    res.status(500).json({ error: 'Failed to process guess' })
  }
})

router.get('/community/:date', (req, res) => {
  const { group, date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }
  try {
    res.json(getCommunityStats(group, date) ?? { totalPlays: 0 })
  } catch (err) {
    captureError(err, { msg: 'Community stats error', group, date })
    res.status(500).json({ error: 'Failed to fetch community stats' })
  }
})

export default router
