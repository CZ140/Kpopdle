import { describe, it, expect, vi } from 'vitest'
import { Match, PHASES, MatchError } from './Match.js'
import { MatchManager } from './MatchManager.js'

// A controllable clock so GC / timing assertions are deterministic.
function fakeClock(start = 1_000_000) {
  let t = start
  const clock = () => t
  clock.advance = (ms) => { t += ms }
  return clock
}

// A manual scheduler so round timeouts fire exactly when the test says to.
function manualScheduler() {
  let tasks = []
  return {
    setTimeout: (fn, ms) => { const task = { fn, ms }; tasks.push(task); return task },
    clearTimeout: (task) => { tasks = tasks.filter((t) => t !== task) },
    runAll: () => { const due = tasks; tasks = []; due.forEach((t) => t.fn()) },
    pending: () => tasks.length,
  }
}

describe('MatchManager', () => {
  it('FR-1: mints unguessable, URL-safe, unique match ids', () => {
    const mgr = new MatchManager()
    const ids = new Set()
    for (let i = 0; i < 500; i++) {
      const { id } = mgr.createMatch()
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/) // base64url, non-enumerable
      expect(id.length).toBeGreaterThanOrEqual(20) // ~128 bits
      expect(ids.has(id)).toBe(false)
      ids.add(id)
    }
  })

  it('wires emitFactory so each match broadcasts to its own room', () => {
    const calls = []
    const mgr = new MatchManager({
      emitFactory: (id) => (event, payload) => calls.push({ id, event, phase: payload.phase }),
    })
    const match = mgr.createMatch({ scope: 'twice' })
    match.addPlayer({ id: 'a', displayName: 'A' })
    expect(calls).toEqual([{ id: match.id, event: 'battle:state', phase: PHASES.WAITING }])
  })

  it('FR-4: sweeps idle rooms but keeps active ones', () => {
    const clock = fakeClock()
    const mgr = new MatchManager({ clock })
    const idle = mgr.createMatch()
    const active = mgr.createMatch()
    active.addPlayer({ id: 'a', displayName: 'A' }) // touches lastActivityAt

    clock.advance(11 * 60 * 1000) // past the 10-min TTL
    active.addPlayer({ id: 'b', displayName: 'B' }) // keep active fresh
    mgr.sweep()

    expect(mgr.get(idle.id)).toBeUndefined()
    expect(mgr.get(active.id)).toBeDefined()
  })

  it('FR-4: sweeps rooms everyone has disconnected from', () => {
    const clock = fakeClock()
    const mgr = new MatchManager({ clock })
    const match = mgr.createMatch()
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.setConnected('a', false)

    clock.advance(31 * 1000) // past the empty-room grace
    mgr.sweep()
    expect(mgr.get(match.id)).toBeUndefined()
  })
})

describe('Match lobby', () => {
  const make = () => {
    const emit = vi.fn()
    const match = new Match({ id: 'm1', clock: fakeClock(), emit })
    return { match, emit }
  }

  it('FR-2: rejects a third joiner', () => {
    const { match } = make()
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.addPlayer({ id: 'b', displayName: 'B' })
    expect(() => match.addPlayer({ id: 'c', displayName: 'C' })).toThrow(MatchError)
    try {
      match.addPlayer({ id: 'c', displayName: 'C' })
    } catch (e) {
      expect(e.code).toBe('match_full')
    }
    expect(match.players).toHaveLength(2)
  })

  it('treats a same-id rejoin as reconnection, not a new player', () => {
    const { match } = make()
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.setConnected('a', false)
    match.addPlayer({ id: 'a', displayName: 'A' }) // rejoin
    expect(match.players).toHaveLength(1)
    expect(match.players[0].connected).toBe(true)
  })

  it('FR-3: only reaches READY_CHECK when two players are both ready', () => {
    const { match } = make()
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.setReady('a')
    expect(match.bothReady()).toBe(false) // one player can't start
    expect(match.phase).toBe(PHASES.WAITING)

    match.addPlayer({ id: 'b', displayName: 'B' })
    match.setReady('b')
    expect(match.bothReady()).toBe(true)
    expect(match.phase).toBe(PHASES.READY_CHECK)
  })

  it('a disconnect drops ready state and reverts the phase', () => {
    const { match } = make()
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.addPlayer({ id: 'b', displayName: 'B' })
    match.setReady('a')
    match.setReady('b')
    expect(match.phase).toBe(PHASES.READY_CHECK)

    match.setConnected('a', false)
    expect(match.phase).toBe(PHASES.WAITING)
    expect(match.players.find((p) => p.id === 'a').ready).toBe(false)
  })

  it('broadcasts state on every mutation', () => {
    const { match, emit } = make()
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.addPlayer({ id: 'b', displayName: 'B' })
    match.setReady('a')
    expect(emit).toHaveBeenCalledTimes(3)
    expect(emit).toHaveBeenLastCalledWith('battle:state', expect.objectContaining({ id: 'm1' }))
  })
})

describe('Match rounds', () => {
  const ROUNDS = [
    { song: { title: 'Cheer Up', album: 'PAGE TWO', releaseYear: 2016, groupDisplayName: 'TWICE', spotifyId: 'sp1' }, clipToken: 'tok0' },
    { song: { title: 'Ditto', album: 'OMG', releaseYear: 2023, groupDisplayName: 'NewJeans', spotifyId: 'sp2' }, clipToken: 'tok1' },
  ]

  const make = () => {
    const emit = vi.fn()
    const clock = fakeClock()
    const scheduler = manualScheduler()
    const match = new Match({
      id: 'm', rounds: ROUNDS, clock, emit, scheduler,
      timings: { countdownMs: 1000, windowMs: 5000 },
    })
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.addPlayer({ id: 'b', displayName: 'B' })
    return { match, emit, clock, scheduler }
  }

  const lastPayload = (emit, event) =>
    emit.mock.calls.filter((c) => c[0] === event).at(-1)?.[1]

  it('both-ready starts round 0 with an opaque clip token + startAt — and no answer (FR-16)', () => {
    const { match, emit, clock } = make()
    match.setReady('a')
    match.setReady('b')

    expect(match.phase).toBe(PHASES.ROUND_ACTIVE)
    const rs = lastPayload(emit, 'battle:round_start')
    expect(rs.clipToken).toBe('tok0')
    expect(rs.startAt).toBe(clock() + 1000) // server clock + countdown
    expect(JSON.stringify(rs)).not.toMatch(/Cheer Up|answer|title/i) // no leak
  })

  it('ignores guesses before the clip starts', () => {
    const { match } = make()
    match.setReady('a'); match.setReady('b')
    // still in the 1s countdown — clock not advanced past startAt
    match.submitGuess('a', 0, 'Cheer Up (TWICE)')
    expect(match.players.find((p) => p.id === 'a').score).toBe(0)
  })

  it('scores a correct guess by server-clock elapsed (FR-8/FR-18)', () => {
    const { match, emit, clock } = make()
    match.setReady('a'); match.setReady('b')
    clock.advance(1000 + 2000) // 2s into the clip → 5 pts
    match.submitGuess('a', 0, 'Cheer Up (TWICE)')

    const a = match.players.find((p) => p.id === 'a')
    expect(a.score).toBe(5)
    expect(a.roundAnswered).toBe(true)
    const gr = lastPayload(emit, 'battle:guess_result')
    expect(gr).toMatchObject({ playerId: 'a', correct: true, points: 5 })
  })

  it('a wrong guess scores nothing and leaks no answer', () => {
    const { match, emit, clock } = make()
    match.setReady('a'); match.setReady('b')
    clock.advance(1500)
    match.submitGuess('a', 0, 'Fancy')
    expect(match.players.find((p) => p.id === 'a').score).toBe(0)
    const gr = lastPayload(emit, 'battle:guess_result')
    expect(gr).toMatchObject({ playerId: 'a', correct: false })
    expect(JSON.stringify(gr)).not.toMatch(/Cheer Up/)
  })

  it('ends the round early once both answer correctly, revealing the answer + scores', () => {
    const { match, emit, clock, scheduler } = make()
    match.setReady('a'); match.setReady('b')
    clock.advance(1000 + 1000) // 1s in → 5 pts each
    match.submitGuess('a', 0, 'Cheer Up')
    expect(match.phase).toBe(PHASES.ROUND_ACTIVE) // still waiting on B
    match.submitGuess('b', 0, 'cheer up (twice)')

    expect(match.phase).toBe(PHASES.ROUND_REVEAL)
    expect(scheduler.pending()).toBe(0) // timeout cleared
    const reveal = lastPayload(emit, 'battle:round_reveal')
    expect(reveal.answer.title).toBe('Cheer Up')
    expect(reveal.scores).toEqual([
      { playerId: 'a', displayName: 'A', score: 5 },
      { playerId: 'b', displayName: 'B', score: 5 },
    ])
  })

  it('ends the round on the window timeout, scoring non-answerers 0', () => {
    const { match, emit, clock, scheduler } = make()
    match.setReady('a'); match.setReady('b')
    clock.advance(1000 + 2000)
    match.submitGuess('a', 0, 'Cheer Up') // only A answers
    scheduler.runAll() // fire the round-end timer

    expect(match.phase).toBe(PHASES.ROUND_REVEAL)
    const reveal = lastPayload(emit, 'battle:round_reveal')
    expect(reveal.results.find((r) => r.playerId === 'a').points).toBe(5)
    expect(reveal.results.find((r) => r.playerId === 'b').points).toBe(0)
  })

  it('never emits the answer before the reveal', () => {
    const { match, emit, clock } = make()
    match.setReady('a'); match.setReady('b')
    clock.advance(1500)
    match.submitGuess('a', 0, 'Fancy')
    const beforeReveal = JSON.stringify(emit.mock.calls.filter((c) => c[0] !== 'battle:round_reveal'))
    expect(beforeReveal).not.toMatch(/Cheer Up/)
  })
})
