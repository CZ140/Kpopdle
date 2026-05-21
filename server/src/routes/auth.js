import { Router } from 'express'
import passport from 'passport'
import requireAuth from '../middleware/requireAuth.js'
import { getUserStats, saveUserStats, importLocalStorageStats, deleteUserAndAllData } from '../services/authDb.js'
import groups from '../data/groups.json' with { type: 'json' }

const VALID_GROUP_IDS = new Set([...groups.map(g => g.id), 'kpopdle'])

const router = Router()

// Kick off Google OAuth — full page redirect
router.get('/google',
  passport.authenticate('google', { scope: ['openid', 'profile', 'email'] })
)

// Google redirects back here after the user consents
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/?auth=failed`,
  }),
  (req, res) => res.redirect(process.env.CLIENT_URL + '/')
)

// Who am I?
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ user: null })
  const { id, email, display_name, avatar_url } = req.user
  res.json({ user: { id, email, displayName: display_name, avatarUrl: avatar_url } })
})

// Get all cloud stats for the logged-in user
router.get('/stats', requireAuth, (req, res) => {
  res.json(getUserStats(req.user.id))
})

// Sync stats for one group after a daily game
router.post('/stats/:group', requireAuth, (req, res) => {
  if (!VALID_GROUP_IDS.has(req.params.group)) {
    return res.status(400).json({ error: 'Unknown group' })
  }
  const { stats } = req.body
  if (!stats || typeof stats !== 'object') {
    return res.status(400).json({ error: 'Invalid stats payload' })
  }
  saveUserStats(req.user.id, req.params.group, stats)
  res.json({ ok: true })
})

// Import localStorage stats on first login
router.post('/import', requireAuth, (req, res) => {
  const { stats } = req.body
  if (!stats || typeof stats !== 'object') {
    return res.status(400).json({ error: 'Invalid stats payload' })
  }
  importLocalStorageStats(req.user.id, stats)
  res.json({ ok: true })
})

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err)
    req.session.destroy(() => {
      res.clearCookie('connect.sid')
      res.json({ ok: true })
    })
  })
})

// Delete account + all data (GDPR erasure)
router.delete('/account', requireAuth, (req, res, next) => {
  const userId = req.user.id
  req.logout((err) => {
    if (err) return next(err)
    req.session.destroy(() => {
      deleteUserAndAllData(userId)
      res.clearCookie('connect.sid')
      res.json({ ok: true })
    })
  })
})

export default router
