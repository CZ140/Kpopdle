// Admin gate for the analytics dashboard. An admin is any signed-in Google
// account whose email is in the ADMIN_EMAILS allowlist (comma-separated env var).
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
)

export function isAdmin(user) {
  return !!user?.email && ADMIN_EMAILS.has(user.email.toLowerCase())
}

export default function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' })
  next()
}
