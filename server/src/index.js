import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import cors from './middleware/cors.js'
import rateLimit from './middleware/rateLimit.js'
import groupRoutes from './routes/groups.js'
import gameRoutes from './routes/game.js'
import songRoutes from './routes/songs.js'
import statsRoutes from './routes/stats.js'
import { getTodaysSong } from './services/dailySong.js'
import { getPreviewUrl } from './services/audioProvider.js'
import groups from './data/groups.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

app.use(express.json())
app.use(cors)
app.use('/api', rateLimit)

app.use('/api/groups', groupRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/:group/game', gameRoutes)
app.use('/api/:group/songs', songRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

if (process.env.NODE_ENV === 'production') {
  const clientBuild = join(__dirname, '../../client/dist')
  app.use(express.static(clientBuild))
  app.get('*', (req, res) => {
    res.sendFile(join(clientBuild, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`K-popdle server running on port ${PORT}`)
  warmCache()
})

async function warmCache() {
  const activeGroups = groups.filter(g => g.active)
  console.log(`Warming preview cache for ${activeGroups.length} groups...`)
  for (const group of activeGroups) {
    try {
      const { song } = getTodaysSong(group.id)
      await getPreviewUrl(song, group.deezerArtistName)
      console.log(`  ✓ ${group.id}`)
    } catch (err) {
      console.warn(`  ✗ ${group.id}: ${err.message}`)
    }
  }
  console.log('Cache warm.')
}
