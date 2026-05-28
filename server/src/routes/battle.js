import { Router } from 'express'
import { matchManager } from '../realtime/manager.js'
import { getPreviewUrl } from '../services/audioProvider.js'
import { captureError } from '../services/observability.js'
import { getPersonalStats } from '../services/battleStatsDb.js'

const router = Router()

// Mirror realtime/socket.js → resolvePlayerId() so the same player gets the
// same key over HTTP as over the socket. Signed-in users win; anonymous play
// is keyed by the client-persisted token (sent as `x-player-token`).
function resolveStatsPlayerId(req) {
  const userId = req.session?.passport?.user
  if (userId) return `u:${userId}`
  const token = req.get('x-player-token')
  if (typeof token === 'string' && token.length >= 8 && token.length <= 64) return `p:${token}`
  return null
}

// GET /api/battle/stats/me
// Personal Battle stats for the caller. Returns 200 with zeroed stats (rather
// than 404) for never-played players so the client renders a clean empty state.
router.get('/stats/me', (req, res) => {
  const playerId = resolveStatsPlayerId(req)
  if (!playerId) {
    // No identity at all — return an empty payload rather than 401 so the
    // lobby strip can still render zeros without an auth flow.
    return res.json({ playerId: null, ...getPersonalStats(null) })
  }
  return res.json({ playerId, ...getPersonalStats(playerId) })
})

// Resolve + buffer a round's clip once, shared across both players and across a
// browser's range requests. The opaque clipToken is the only handle the client
// ever sees — the Deezer URL (which would reveal the title via lookup) and the
// song id stay server-side. (BATTLE_SPEC FR-17.)
async function getClipBuffer(round) {
  if (round.clipBuffer) return round.clipBuffer
  if (!round.clipPromise) {
    round.clipPromise = (async () => {
      const url = await getPreviewUrl(round.song, round.song.deezerArtistName)
      if (!url) return null
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      round.clipBuffer = buf
      return buf
    })().finally(() => { round.clipPromise = null })
  }
  return round.clipPromise
}

// GET /api/battle/:matchId/clip/:roundToken
// (No file extension — Content-Type is authoritative, and it sidesteps Express 5
// path-to-regexp dot handling. Token possession = authorization: it's a 96-bit
// unguessable value delivered only over the authenticated round_start socket event.)
router.get('/:matchId/clip/:roundToken', async (req, res) => {
  const { matchId, roundToken } = req.params
  const match = matchManager.get(matchId)
  if (!match) return res.status(404).json({ error: 'Match not found' })
  const round = match.roundForClipToken(roundToken)
  if (!round) return res.status(404).json({ error: 'Clip not found' })

  let buf
  try {
    buf = await getClipBuffer(round)
  } catch (err) {
    captureError(err, { msg: 'battle clip fetch failed', matchId })
    return res.status(502).json({ error: 'Audio source unavailable' })
  }
  if (!buf) return res.status(502).json({ error: 'Audio source unavailable' })

  const total = buf.length
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Accept-Ranges', 'bytes')
  // Opaque, per-match content — keep it out of any shared cache.
  res.setHeader('Cache-Control', 'private, no-store')

  const range = req.headers.range
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!m) {
      return res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
    }
    let start = m[1] ? parseInt(m[1], 10) : 0
    let end = m[2] ? parseInt(m[2], 10) : total - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
    }
    end = Math.min(end, total - 1)
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
    res.setHeader('Content-Length', end - start + 1)
    return res.end(buf.subarray(start, end + 1))
  }

  res.setHeader('Content-Length', total)
  res.end(buf)
})

export default router
