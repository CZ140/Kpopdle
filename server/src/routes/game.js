import { Router } from 'express'
import { getTodaysSong } from '../services/dailySong.js'
import { getPreviewUrl } from '../services/audioProvider.js'
import { getSongCount } from '../data/songIndex.js'

const router = Router()

router.get('/today', async (req, res) => {
  try {
    const { song, dateString, gameNumber } = getTodaysSong()

    const previewUrl = await getPreviewUrl(song)

    res.json({
      gameDate: dateString,
      gameNumber,
      previewUrl,
      totalSongs: getSongCount(),
    })
  } catch (err) {
    console.error('Error fetching daily game:', err)
    res.status(500).json({ error: 'Failed to load daily game' })
  }
})

router.post('/guess', (req, res) => {
  try {
    const { gameDate, guess } = req.body

    if (!gameDate || typeof gameDate !== 'string') {
      return res.status(400).json({ error: 'gameDate is required' })
    }

    if (guess !== undefined && (typeof guess !== 'string' || guess.length > 200)) {
      return res.status(400).json({ error: 'Invalid guess' })
    }

    const { song, dateString } = getTodaysSong()

    if (gameDate !== dateString) {
      return res.status(400).json({ error: 'Game date mismatch' })
    }

    // Empty guess (skip on last attempt) — reveal the song
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
