import { Router } from 'express'
import { recordGame, getSongDifficulty, getConfusion, getSummary } from '../services/statsDb.js'

const router = Router()

// POST /api/stats/record — called by client at game end
router.post('/record', (req, res) => {
  try {
    const { groupId, songId, songTitle, guessCount, won, wrongGuesses, hintsUsed, difficulty } = req.body
    if (!groupId || !songTitle || typeof guessCount !== 'number' || typeof won !== 'boolean') {
      return res.status(400).json({ error: 'Invalid payload' })
    }
    recordGame({ groupId, songId, songTitle, guessCount, won, wrongGuesses, hintsUsed, difficulty })
    res.json({ ok: true })
  } catch (err) {
    console.error('Stats record error:', err)
    res.status(500).json({ error: 'Failed to record stats' })
  }
})

// GET /api/stats/summary — all groups overview
router.get('/summary', (req, res) => {
  try {
    res.json(getSummary())
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

// GET /api/stats/songs/:group — song difficulty ranking for one group
router.get('/songs/:group', (req, res) => {
  try {
    res.json(getSongDifficulty(req.params.group))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch song stats' })
  }
})

// GET /api/stats/confusion/:group — most common wrong guesses
router.get('/confusion/:group', (req, res) => {
  try {
    res.json(getConfusion(req.params.group))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch confusion data' })
  }
})

export default router
