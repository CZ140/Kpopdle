import { Server } from 'socket.io'
import { matchManager } from './manager.js'
import { selectRounds } from './songSelection.js'
import { logger, captureError } from '../services/observability.js'

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
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
  return clean || 'Player'
}

export function attachBattleSocket(server, sessionMiddleware) {
  // Same-origin; default path /socket.io (covered by CSP connect-src 'self' in
  // prod and the vite /socket.io ws proxy in dev).
  const io = new Server(server)

  // Share the Express session with socket handshakes so a battle socket sees the
  // same logged-in session as the HTTP API.
  io.engine.use(sessionMiddleware)

  matchManager.setEmitFactory((id) => (event, payload) => io.to(id).emit(event, payload))
  matchManager.startGc()

  io.on('connection', (socket) => {
    const enterRoom = (match, displayName, playerToken) => {
      const playerId = resolvePlayerId(socket, playerToken)
      socket.join(match.id)
      socket.data.matchId = match.id
      socket.data.playerId = playerId
      match.addPlayer({ id: playerId, displayName: sanitizeName(displayName) })
      return { playerId, state: match.getState() }
    }

    const currentMatch = () => matchManager.get(socket.data.matchId)

    socket.on('battle:create', ({ scope, displayName, playerToken } = {}, ack) => {
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
      const match = matchManager.createMatch({ scope: resolvedScope, rounds })
      const { playerId, state } = enterRoom(match, displayName, playerToken)
      logger.info({ matchId: match.id, scope: match.scope, rounds: rounds.length }, 'battle match created')
      if (typeof ack === 'function') ack({ matchId: match.id, playerId, state })
    })

    socket.on('battle:join', ({ matchId, displayName, playerToken } = {}, ack) => {
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
      const match = currentMatch()
      if (match && socket.data.playerId) match.setReady(socket.data.playerId)
    })

    // Clock sync: lets the client map the server's round startAt to local time
    // for the synchronized countdown (FR-5).
    socket.on('battle:time', (_payload, ack) => {
      if (typeof ack === 'function') ack(Date.now())
    })

    socket.on('battle:guess', ({ roundIndex, guess } = {}) => {
      const match = currentMatch()
      if (!match || !socket.data.playerId) return
      if (typeof guess !== 'string' || guess.length > 300) return
      if (!Number.isInteger(roundIndex)) return
      match.submitGuess(socket.data.playerId, roundIndex, guess)
    })

    socket.on('battle:rematch', () => {
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
        match.removePlayer(socket.data.playerId)
        socket.leave(match.id)
        socket.data.matchId = null
      }
    })

    socket.on('disconnect', () => {
      const match = currentMatch()
      // Mark disconnected (not removed) — keeps the slot for a quick reconnect;
      // the GC reclaims rooms everyone has left. Full reconnect/forfeit is M4.
      if (match && socket.data.playerId) match.setConnected(socket.data.playerId, false)
    })
  })

  return io
}
