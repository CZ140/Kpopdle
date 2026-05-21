import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import cors from './middleware/cors.js'
import rateLimit from './middleware/rateLimit.js'
import groupRoutes from './routes/groups.js'
import gameRoutes from './routes/game.js'
import songRoutes from './routes/songs.js'
import statsRoutes from './routes/stats.js'
import kpopdleRoutes from './routes/kpopdle.js'
import authRoutes from './routes/auth.js'
import { configurePassport } from './services/authDb.js'
import { SqliteSessionStore } from './services/sessionStore.js'
import { getTodaysSong, getKpopdleSongForDate } from './services/dailySong.js'
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
  console.warn('[kpopdle] SESSION_SECRET is not set — sessions are signed with a known default key. Set this in production.')
}

app.set('trust proxy', 1)

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
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
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '))
  next()
})

app.use(express.json())
app.use(cors)

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

app.use('/api', rateLimit)

app.use('/api/auth', authRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/kpopdle', kpopdleRoutes)
app.use('/api/:group/game', gameRoutes)
app.use('/api/:group/songs', songRoutes)

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

app.listen(PORT, () => {
  console.log(`K-popdle server running on port ${PORT}`)
  warmCache()
  setInterval(warmCache, 20 * 60 * 1000)
})

async function warmCache() {
  const activeGroups = groups.filter(g => g.active)
  console.log(`Warming preview cache for ${activeGroups.length} groups + kpopdle...`)
  for (const group of activeGroups) {
    try {
      const { song } = getTodaysSong(group.id)
      await getPreviewUrl(song, group.deezerArtistName)
      console.log(`  ✓ ${group.id}`)
    } catch (err) {
      console.warn(`  ✗ ${group.id}: ${err.message}`)
    }
  }
  try {
    const { song } = getKpopdleSongForDate(activeGroups, getTodayKST())
    await getPreviewUrl(song, song.deezerArtistName)
    console.log(`  ✓ kpopdle`)
  } catch (err) {
    console.warn(`  ✗ kpopdle: ${err.message}`)
  }
  console.log('Cache warm.')
}
