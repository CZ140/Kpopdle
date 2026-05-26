import { Router } from 'express'
import requireAdmin from '../middleware/requireAdmin.js'
import { getDashboard } from '../services/adminDb.js'

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

export default router
