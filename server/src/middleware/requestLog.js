import crypto from 'crypto'
import { recordRequest } from '../services/adminDb.js'

// Salt for hashing client IPs. Reuses SESSION_SECRET so we don't introduce a
// new secret to manage; the raw IP is never stored.
const IP_SALT = process.env.SESSION_SECRET || 'dev-secret-change-in-production'

// Static assets and our own dashboard polling — excluded to keep the telemetry
// focused on page loads, API calls, and scanner traffic.
const SKIP_PATH = /\.(js|css|map|png|jpe?g|svg|gif|ico|webp|woff2?|ttf|mp3|txt|xml)$/i
const SKIP_PREFIX = '/api/admin'

// Vulnerability scanners and crawlers. These are internet background noise —
// flagging them lets the dashboard separate "real failures" from "bot probes".
const SCANNER_PATH = /(wp-config|wp-admin|wp-login|xmlrpc|phpmyadmin|\.env|\.git|\.aws|\/vendor\/|\.php|credentials|\.ssh|\.docker|config\.js$|common\.js$)/i
const BOT_UA = /(bot|crawler|spider|scan|curl|wget|python-requests|go-http|httpclient|semrush|ahrefs|mj12|dotbot|bytespider|petalbot|headless|probe|uptime|healthcheck)/i

function hashIp(ip) {
  if (!ip) return null
  return crypto.createHmac('sha256', IP_SALT).update(ip).digest('hex').slice(0, 16)
}

function classifyBot(path, ua) {
  return SCANNER_PATH.test(path) || (ua ? BOT_UA.test(ua) : true)
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
