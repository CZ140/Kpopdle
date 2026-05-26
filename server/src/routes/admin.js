import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import requireAdmin from '../middleware/requireAdmin.js'
import { getDashboard } from '../services/adminDb.js'
import { runBackfill } from '../services/backfill.js'

const router = Router()

// Everything under /api/admin requires an allowlisted admin account.
router.use(requireAdmin)

// GET /api/admin/dashboard?hours=24 — full analytics payload in one round-trip.
router.get('/dashboard', (req, res) => {
  try {
    const allowed = new Set([24, 24 * 7, 24 * 30])
    let hours = parseInt(req.query.hours, 10)
    if (!allowed.has(hours)) hours = 24
    res.json(getDashboard({ hours }))
  } catch (err) {
    console.error('Admin dashboard error:', err)
    res.status(500).json({ error: 'Failed to build dashboard' })
  }
})

// POST /api/admin/backfill?days=30 — import historical traffic from Cloudflare.
// Runs in-process so it reaches the production DB volume (a local `railway run`
// would not). Lightly rate-limited to avoid hammering the Cloudflare API.
const backfillLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })

router.post('/backfill', backfillLimiter, async (req, res) => {
  try {
    let days = parseInt(req.query.days, 10)
    if (!Number.isFinite(days) || days < 1 || days > 90) days = 30
    const summary = await runBackfill({ days })
    res.json({ ok: true, ...summary })
  } catch (err) {
    console.error('Backfill error:', err)
    res.status(500).json({ error: err.message || 'Backfill failed' })
  }
})

export default router
