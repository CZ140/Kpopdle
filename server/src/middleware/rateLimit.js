import { rateLimit } from 'express-rate-limit'

// General API limit — covers game data, songs, groups, stats
// ~5 requests per page load → allows ~200 page loads per 15 min per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

// Stricter limit for auth endpoints (sign in, account deletion, session checks)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

// Default export kept for any direct imports
export default apiLimiter
