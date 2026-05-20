import { Router } from 'express'
import { getTodaysSong, getSongForDate } from '../services/dailySong.js'
import { getPreviewUrl } from '../services/audioProvider.js'
import { getSongsForGroup, getSongCountForGroup } from '../data/songIndex.js'
import { getKSTDateString } from '../utils/dateUtils.js'
import validateGroup from '../middleware/validateGroup.js'

const router = Router({ mergeParams: true })

router.use(validateGroup)

router.get('/today', async (req, res) => {
  const { group } = req.params
  try {
    const { song, dateString, gameNumber } = getTodaysSong(group)
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
    console.error('Error fetching daily game:', err)
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
    console.error('Error fetching archive game:', err)
    res.status(500).json({ error: 'Failed to load archive game' })
  }
})

router.get('/practice', async (req, res) => {
  const { group } = req.params
  try {
    const songs = getSongsForGroup(group)
    const song = songs[Math.floor(Math.random() * songs.length)]
    const previewUrl = await getPreviewUrl(song, req.groupConfig.deezerArtistName)
    res.json({
      previewUrl,
      totalSongs: songs.length,
      practiceSongId: song.id,
    })
  } catch (err) {
    console.error('Error fetching practice game:', err)
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
      return res.json({ correct: isCorrect, gameOver: isCorrect, song: songPayload })
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

    res.json({
      correct: isCorrect,
      gameOver: isCorrect,
      song: {
        id: song.id,
        title: song.title,
        album: song.album,
        releaseYear: song.releaseYear,
        spotifyId: song.spotifyId,
      },
    })
  } catch (err) {
    console.error('Error processing guess:', err)
    res.status(500).json({ error: 'Failed to process guess' })
  }
})

export default router
