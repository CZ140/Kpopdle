import { Server } from 'socket.io'
import { matchManager } from './manager.js'
import { selectRounds } from './songSelection.js'
import { logger, captureError } from '../services/observability.js'
import { recordBattleMatch } from '../services/battleStatsDb.js'

const MAX_NAME = 24
const MATCH_PICKS = 7 // 5 scored rounds + up to 2 sudden-death spares for ties

// Anonymous play is allowed (BATTLE_SPEC GD-9): a logged-in user is keyed by
// their account id; everyone else by a client-persisted token (localStorage),
// so a reconnect maps back to the same player rather than the volatile socket id.
function resolvePlayerId(socket, playerToken) {
  const userId = socket.request?.session?.passport?.user
  if (userId) return `u:${userId}`
  if (typeof playerToken === 'string' && playerToken.length >= 8 && playerToken.length <= 64) {
    return `p:${playerToken}`
  }
  return `s:${socket.id}` // last resort (no token sent)
}

function sanitizeName(name) {
  if (typeof name !== 'string') return 'Player'
  const clean = [...name]
    .filter((ch) => { const c = ch.charCodeAt(0); return c >= 32 && c !== 127 }) // drop control chars (incl. DEL)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
  return clean || 'Player'
}

// Per-socket sliding-window rate limits — generous enough that normal play never
// trips them; they only blunt abuse/spam (NFR-5). Returns true when over budget.
const RATE_LIMITS = {
  'battle:create': { limit: 5, windowMs: 60_000 },
  'battle:join': { limit: 20, windowMs: 60_000 },
  'battle:guess': { limit: 30, windowMs: 10_000 },
  'battle:ready': { limit: 10, windowMs: 10_000 },
  'battle:rematch': { limit: 10, windowMs: 60_000 },
  'battle:time': { limit: 10, windowMs: 60_000 },
}

function rateLimited(socket, key) {
  const cfg = RATE_LIMITS[key]
  if (!cfg) return false
  const now = Date.now()
  const buckets = (socket.data.rl ??= {})
  const hits = (buckets[key] ??= [])
  while (hits.length && hits[0] <= now - cfg.windowMs) hits.shift()
  if (hits.length >= cfg.limit) return true
  hits.push(now)
  return false
}

export function attachBattleSocket(server, sessionMiddleware) {
  // Same-origin; default path /socket.io (covered by CSP connect-src 'self' in
  // prod and the vite /socket.io ws proxy in dev).
  const io = new Server(server)

  // Share the Express session with socket handshakes so a battle socket sees the
  // same logged-in session as the HTTP API.
  io.engine.use(sessionMiddleware)

  matchManager.setEmitFactory((id) => (event, payload) => {
    if (event === 'battle:match_over') {
      logger.info(
        { matchId: id, winnerId: payload.winnerId, forfeit: !!payload.forfeit, draw: !!payload.draw },
        'battle match over',
      )
      // Persist per-player stats. Guard with `_recorded` because a rematch
      // reuses the same Match instance and we don't want to double-insert a
      // segment if match_over were ever re-emitted before startRematch resets.
      // (startRematch clears `_recorded` so the next segment records cleanly.)
      const match = matchManager.get(id)
      if (match && !match._recorded) {
        match._recorded = true
        try {
          recordBattleMatch(match, payload)
        } catch (err) {
          captureError(err, { msg: 'battle stats record failed', matchId: id })
        }
      }
    }
    io.to(id).emit(event, payload)
  })
  matchManager.startGc()

  io.on('connection', (socket) => {
    const enterRoom = (match, displayName, playerToken) => {
      const playerId = resolvePlayerId(socket, playerToken)
      socket.join(match.id)
      socket.data.matchId = match.id
      socket.data.playerId = playerId
      match.addPlayer({ id: playerId, displayName: sanitizeName(displayName), socketId: socket.id })
      // Replay the current phase so a reconnecting / late socket resumes (FR-13).
      for (const [event, payload] of match.getResumeEvents()) socket.emit(event, payload)
      return { playerId, state: match.getState() }
    }

    const currentMatch = () => matchManager.get(socket.data.matchId)

    socket.on('battle:create', ({ scope, displayName, playerToken } = {}, ack) => {
      if (rateLimited(socket, 'battle:create')) {
        const error = { code: 'rate_limited', message: 'Slow down a moment.' }
        socket.emit('battle:error', error)
        return typeof ack === 'function' && ack({ error })
      }
      const resolvedScope = scope || 'all'
      let rounds
      try {
        rounds = selectRounds(resolvedScope, MATCH_PICKS)
      } catch (err) {
        captureError(err, { msg: 'battle round selection failed', scope: resolvedScope })
        const error = { code: 'no_songs', message: 'No songs available for that selection.' }
        socket.emit('battle:error', error)
        return typeof ack === 'function' && ack({ error })
      }
      let match
      try {
        match = matchManager.createMatch({ scope: resolvedScope, rounds })
      } catch (err) {
        // Capacity guard (NFR-2) is expected under load; other errors aren't.
        if (err.code !== 'capacity') captureError(err, { msg: 'battle create failed' })
        const error = { code: err.code === 'capacity' ? 'busy' : 'create_failed', message: err.message }
        socket.emit('battle:error', error)
        return typeof ack === 'function' && ack({ error })
      }
      const { playerId, state } = enterRoom(match, displayName, playerToken)
      logger.info({ matchId: match.id, scope: match.scope, rounds: rounds.length }, 'battle match created')
      if (typeof ack === 'function') ack({ matchId: match.id, playerId, state })
    })

    socket.on('battle:join', ({ matchId, displayName, playerToken } = {}, ack) => {
      if (rateLimited(socket, 'battle:join')) return
      const match = matchManager.get(matchId)
      if (!match) {
        const error = { code: 'not_found', message: 'Match not found or expired.' }
        socket.emit('battle:error', error)
        return typeof ack === 'function' && ack({ error })
      }
      try {
        const { playerId, state } = enterRoom(match, displayName, playerToken)
        if (typeof ack === 'function') ack({ matchId: match.id, playerId, state })
      } catch (err) {
        const error = { code: err.code || 'join_failed', message: err.message }
        socket.emit('battle:error', error)
        if (typeof ack === 'function') ack({ error })
      }
    })

    socket.on('battle:ready', () => {
      if (rateLimited(socket, 'battle:ready')) return
      const match = currentMatch()
      if (match && socket.data.playerId) match.setReady(socket.data.playerId)
    })

    // Clock sync: lets the client map the server's round startAt to local time
    // for the synchronized countdown (FR-5).
    socket.on('battle:time', (_payload, ack) => {
      if (rateLimited(socket, 'battle:time')) return
      if (typeof ack === 'function') ack(Date.now())
    })

    socket.on('battle:guess', ({ roundIndex, guess } = {}) => {
      if (rateLimited(socket, 'battle:guess')) return
      const match = currentMatch()
      if (!match || !socket.data.playerId) return
      if (typeof guess !== 'string' || guess.length > 300) return
      if (!Number.isInteger(roundIndex)) return
      match.submitGuess(socket.data.playerId, roundIndex, guess)
    })

    socket.on('battle:rematch', () => {
      if (rateLimited(socket, 'battle:rematch')) return
      const match = currentMatch()
      if (!match || !socket.data.playerId) return
      const bothIn = match.requestRematch(socket.data.playerId)
      if (!bothIn) return
      try {
        match.startRematch(selectRounds(match.scope, MATCH_PICKS))
      } catch (err) {
        captureError(err, { msg: 'battle rematch round selection failed', scope: match.scope })
        socket.emit('battle:error', { code: 'no_songs', message: 'Could not start a rematch.' })
      }
    })

    socket.on('battle:leave', () => {
      const match = currentMatch()
      if (match && socket.data.playerId) {
        match.leave(socket.data.playerId) // forfeits a live match, else just leaves the lobby
        socket.leave(match.id)
        socket.data.matchId = null
      }
    })

    socket.on('disconnect', () => {
      const match = currentMatch()
      // handleDisconnect ignores the drop if a newer socket already replaced this
      // one (reconnect race); otherwise it starts the forfeit grace.
      if (match && socket.data.playerId) match.handleDisconnect(socket.data.playerId, socket.id)
    })
  })

  return io
}
