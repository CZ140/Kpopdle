import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'http'
import { io as ioc } from 'socket.io-client'
import { attachBattleSocket } from './socket.js'
import { matchManager } from './manager.js'

// Drives the real Socket.IO adapter end-to-end with two clients — the M0 "done"
// criterion: two players reach one room, see each other, and both readying up
// reaches READY_CHECK. A no-op session stands in for express-session (the anon
// playerToken path is what we exercise).
const noopSession = (req, res, next) => next()

describe('battle socket (integration)', () => {
  let httpServer
  let io
  let port

  beforeAll(async () => {
    httpServer = createServer()
    io = attachBattleSocket(httpServer, noopSession)
    await new Promise((resolve) => httpServer.listen(0, resolve))
    port = httpServer.address().port
  })

  afterAll(() => {
    io.close()
    httpServer.close()
  })

  const connect = () =>
    ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true })

  const emitAck = (socket, event, payload) =>
    new Promise((resolve) => socket.emit(event, payload, resolve))

  it('two players join one room and see each other', async () => {
    const a = connect()
    const b = connect()
    try {
      const created = await emitAck(a, 'battle:create', { displayName: 'Alice', playerToken: 'tok-alice-0001' })
      expect(created.matchId).toBeTruthy()
      expect(created.playerId).toBe('p:tok-alice-0001')

      const joined = await emitAck(b, 'battle:join', { matchId: created.matchId, displayName: 'Bob', playerToken: 'tok-bob-0002' })
      expect(joined.state.players).toHaveLength(2)
    } finally {
      a.close()
      b.close()
    }
  })

  it('both-ready starts a round: round_start carries an opaque clip token + startAt and NO answer (FR-16 over the wire)', async () => {
    const a = connect()
    const b = connect()
    try {
      const created = await emitAck(a, 'battle:create', { displayName: 'Alice', playerToken: 'tok-a' })
      await emitAck(b, 'battle:join', { matchId: created.matchId, displayName: 'Bob', playerToken: 'tok-b' })

      const roundStart = new Promise((resolve) => a.on('battle:round_start', resolve))
      a.emit('battle:ready')
      b.emit('battle:ready')
      const rs = await roundStart

      expect(rs.clipToken).toBeTruthy()
      expect(typeof rs.startAt).toBe('number')
      expect(rs.roundIndex).toBe(0)
      expect(JSON.stringify(rs)).not.toMatch(/title|answer/i) // the answer never crosses the wire
    } finally {
      a.close()
      b.close()
    }
  })

  it('rejects a third joiner with match_full', async () => {
    const a = connect()
    const b = connect()
    const c = connect()
    try {
      const { matchId } = await emitAck(a, 'battle:create', { displayName: 'A', playerToken: 't-a' })
      await emitAck(b, 'battle:join', { matchId, displayName: 'B', playerToken: 't-b' })
      const third = await emitAck(c, 'battle:join', { matchId, displayName: 'C', playerToken: 't-c' })
      expect(third.error.code).toBe('match_full')
    } finally {
      a.close()
      b.close()
      c.close()
    }
  })

  it('a correct guess after the clip starts scores and (both correct) reveals the answer', async () => {
    const a = connect()
    const b = connect()
    try {
      const created = await emitAck(a, 'battle:create', { displayName: 'A', playerToken: 'tguess-a' })
      await emitAck(b, 'battle:join', { matchId: created.matchId, displayName: 'B', playerToken: 'tguess-b' })

      const roundStart = new Promise((resolve) => a.on('battle:round_start', resolve))
      a.emit('battle:ready')
      b.emit('battle:ready')
      const rs = await roundStart

      // The client never receives the answer — read it server-side to drive the test.
      const answer = matchManager.get(created.matchId).rounds[rs.roundIndex].song.title

      // Wait until the synchronized clip start, then both guess correctly.
      await new Promise((r) => setTimeout(r, Math.max(0, rs.startAt - Date.now()) + 60))
      const reveal = new Promise((resolve) => a.on('battle:round_reveal', resolve))
      a.emit('battle:guess', { roundIndex: rs.roundIndex, guess: answer })
      b.emit('battle:guess', { roundIndex: rs.roundIndex, guess: answer })
      const rv = await reveal

      expect(rv.answer.title).toBe(answer)
      expect(rv.scores.every((s) => s.score > 0)).toBe(true)
    } finally {
      a.close()
      b.close()
    }
  }, 10000)

  it('returns not_found for an unknown match id', async () => {
    const a = connect()
    try {
      const res = await emitAck(a, 'battle:join', { matchId: 'does-not-exist', displayName: 'A', playerToken: 't-x' })
      expect(res.error.code).toBe('not_found')
    } finally {
      a.close()
    }
  })
})
