import './instrument.js' // must be first — initialises Sentry before app code loads
import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import cors from './middleware/cors.js'
import { apiLimiter, authLimiter } from './middleware/rateLimit.js'
import groupRoutes from './routes/groups.js'
import gameRoutes from './routes/game.js'
import songRoutes from './routes/songs.js'
import statsRoutes from './routes/stats.js'
import kpopdleRoutes from './routes/kpopdle.js'
import guessTheGroupRoutes from './routes/guessTheGroup.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import requestLog from './middleware/requestLog.js'
import { setupSentryErrorHandler } from './instrument.js'
import { logger, captureError } from './services/observability.js'
import { pruneOldRequests } from './services/adminDb.js'
import { getHealth, recordWarmResult } from './services/health.js'
import { configurePassport } from './services/authDb.js'
import { SqliteSessionStore } from './services/sessionStore.js'
import { getTodaysSong, getKpopdleSongForDate, getGuessGroupSongForDate } from './services/dailySong.js'
import { getKSTDateString as getTodayKST } from './utils/dateUtils.js'
import { getPreviewUrl } from './services/audioProvider.js'
import { getMergedPool } from './data/songIndex.js'
import groups from './data/groups.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Required for Railway (sits behind a reverse proxy — ensures secure cookies work)
if (!process.env.SESSION_SECRET) {
  logger.warn('SESSION_SECRET is not set — sessions are signed with a known default key. Set this in production.')
}

app.set('trust proxy', 1)

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    // 'unsafe-inline' required: React renders inline style attributes pervasively
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // https: covers Google profile picture CDN (multiple subdomains)
    "img-src 'self' https: data:",
    // Deezer preview audio — *.dzcdn.net covers all their CDN subdomains
    "media-src 'self' https://*.dzcdn.net",
    // Sentry sends error events to its ingest host (a different origin)
    "connect-src 'self' https://*.ingest.us.sentry.io",
    "frame-ancestors 'none'",
  ].join('; '))
  next()
})

app.use(express.json())
app.use(cors)

// Liveness probe — defined before requestLog so Railway's frequent polls don't
// flood the telemetry table. Returns 503 only when the DB (the one
// restart-fixable dependency) is unreachable; audio status is informational.
app.get('/healthz', (req, res) => {
  const health = getHealth()
  res.status(health.healthy ? 200 : 503).json(health)
})

app.use(session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  },
}))

app.use(passport.initialize())
app.use(passport.session())
configurePassport()

// Request telemetry — after passport so req.user is available, before routes
// so it wraps every endpoint. Powers the /admin analytics dashboard.
app.use(requestLog)

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/admin', apiLimiter, adminRoutes)
app.use('/api/groups', apiLimiter, groupRoutes)
app.use('/api/stats', apiLimiter, statsRoutes)
app.use('/api/kpopdle', apiLimiter, kpopdleRoutes)
app.use('/api/guess-the-group', apiLimiter, guessTheGroupRoutes)
app.use('/api/:group/game', apiLimiter, gameRoutes)
app.use('/api/:group/songs', apiLimiter, songRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

if (process.env.NODE_ENV === 'production') {
  const clientBuild = join(__dirname, '../../client/dist')
  app.use(express.static(clientBuild))
  app.get(/(.*)/, (req, res) => {
    res.sendFile(join(clientBuild, 'index.html'))
  })
}

// Sentry's Express error handler — registered after all routes. No-op unless
// SENTRY_DSN is set.
setupSentryErrorHandler(app)

app.listen(PORT, () => {
  logger.info({ port: PORT }, `K-popdle server running on port ${PORT}`)
  warmCache()
  setInterval(warmCache, 20 * 60 * 1000)
  // Trim request telemetry older than 90 days, daily.
  pruneOldRequests()
  setInterval(pruneOldRequests, 24 * 60 * 60 * 1000)
})

async function warmCache() {
  const activeGroups = groups.filter(g => g.active)
  logger.info(`Warming preview cache for ${activeGroups.length} groups + kpopdle...`)
  const failures = []
  for (const group of activeGroups) {
    try {
      const { song } = getTodaysSong(group.id)
      await getPreviewUrl(song, group.deezerArtistName)
      logger.info(`  ✓ ${group.id}`)
    } catch (err) {
      logger.warn({ group: group.id, err }, `Cache warm failed for ${group.id}`)
      failures.push(group.id)
    }
  }
  try {
    const { song } = getKpopdleSongForDate(activeGroups, getTodayKST())
    await getPreviewUrl(song, song.deezerArtistName)
    logger.info(`  ✓ kpopdle`)
  } catch (err) {
    logger.warn({ err }, 'Cache warm failed for kpopdle')
    failures.push('kpopdle')
  }
  try {
    const { song } = getGuessGroupSongForDate(activeGroups, getTodayKST())
    await getPreviewUrl(song, song.deezerArtistName)
    logger.info(`  ✓ guess-the-group`)
  } catch (err) {
    logger.warn({ err }, 'Cache warm failed for guess-the-group')
    failures.push('guess-the-group')
  }
  // Feed the result to /healthz (audio status is observed, not fatal).
  recordWarmResult({ ok: failures.length === 0, failures })
  if (failures.length > 0) captureError(new Error(`Cache warm incomplete: ${failures.join(', ')}`), { msg: 'warmCache failures', failures })
  logger.info('Cache warm.')
}
