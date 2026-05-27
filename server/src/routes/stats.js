import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import groups from '../data/groups.json' with { type: 'json' }
import { recordGame, getSongDifficulty, getConfusion, getSummary } from '../services/statsDb.js'
import { captureError } from '../services/observability.js'

const router = Router()

// Tighter per-route limit for the record endpoint — prevents spam pollution of analytics
const recordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Try again later.' },
})

const VALID_GROUP_IDS = new Set(groups.map(g => g.id))
const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard'])

// POST /api/stats/record — called by client at game end
router.post('/record', recordLimiter, (req, res) => {
  try {
    const { groupId, songId, songTitle, guessCount, won, wrongGuesses, hintsUsed, difficulty } = req.body

    if (!groupId || !songTitle || typeof guessCount !== 'number' || typeof won !== 'boolean') {
      return res.status(400).json({ error: 'Invalid payload' })
    }
    if (!VALID_GROUP_IDS.has(groupId)) {
      return res.status(400).json({ error: 'Unknown groupId' })
    }
    if (!Number.isInteger(guessCount) || guessCount < 1 || guessCount > 6) {
      return res.status(400).json({ error: 'guessCount must be an integer 1–6' })
    }
    if (hintsUsed !== undefined && (!Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 3)) {
      return res.status(400).json({ error: 'hintsUsed must be an integer 0–3' })
    }
    if (difficulty !== undefined && !VALID_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be easy, normal, or hard' })
    }
    if (typeof songTitle !== 'string' || songTitle.length > 200) {
      return res.status(400).json({ error: 'songTitle too long' })
    }
    if (wrongGuesses !== undefined) {
      if (!Array.isArray(wrongGuesses) || wrongGuesses.length > 6) {
        return res.status(400).json({ error: 'wrongGuesses must be an array of ≤6 entries' })
      }
      for (const g of wrongGuesses) {
        if (typeof g !== 'string' || g.length > 200) {
          return res.status(400).json({ error: 'Each wrong guess must be a string ≤200 chars' })
        }
      }
    }

    recordGame({ groupId, songId, songTitle, guessCount, won, wrongGuesses, hintsUsed, difficulty })
    res.json({ ok: true })
  } catch (err) {
    captureError(err, { msg: 'Stats record error' })
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
