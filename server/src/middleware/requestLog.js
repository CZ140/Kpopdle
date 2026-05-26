import crypto from 'crypto'
import { recordRequest } from '../services/adminDb.js'
import { classifyBot } from '../utils/botPatterns.js'

// Salt for hashing client IPs. Reuses SESSION_SECRET so we don't introduce a
// new secret to manage; the raw IP is never stored.
const IP_SALT = process.env.SESSION_SECRET || 'dev-secret-change-in-production'

// Static assets and our own dashboard polling — excluded to keep the telemetry
// focused on page loads, API calls, and scanner traffic.
const SKIP_PATH = /\.(js|css|map|png|jpe?g|svg|gif|ico|webp|woff2?|ttf|mp3|txt|xml)$/i
const SKIP_PREFIX = '/api/admin'

function hashIp(ip) {
  if (!ip) return null
  return crypto.createHmac('sha256', IP_SALT).update(ip).digest('hex').slice(0, 16)
}

export default function requestLog(req, res, next) {
  const path = req.path || req.originalUrl.split('?')[0]

  if (SKIP_PATH.test(path) || path.startsWith(SKIP_PREFIX)) return next()

  const start = process.hrtime.bigint()

  res.on('finish', () => {
    try {
      const durationMs = Number((process.hrtime.bigint() - start) / 1000000n)
      // Cloudflare passes the true client IP and country at the edge.
      const ip = req.headers['cf-connecting-ip'] || req.ip
      const ua = req.headers['user-agent'] || ''
      recordRequest({
        method: req.method,
        path: path.slice(0, 200),
        status: res.statusCode,
        durationMs,
        ipHash: hashIp(ip),
        country: req.headers['cf-ipcountry'] || null,
        ua: ua.slice(0, 200),
        isBot: classifyBot(path, ua),
        userId: req.user?.id ?? null,
      })
    } catch {
      // Telemetry must never break a real request.
    }
  })

  next()
}
