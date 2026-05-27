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

  it('NFR-2: caps the number of concurrent matches', () => {
    const mgr = new MatchManager()
    for (let i = 0; i < 1000; i++) mgr.createMatch() // MAX_ACTIVE_MATCHES
    expect(() => mgr.createMatch()).toThrow(/capacity|Too many/i)
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

describe('Match resolution (multi-round)', () => {
  // Distinct titles so guessing rounds[i].song.title always matches.
  const makeRounds = (n) =>
    Array.from({ length: n }, (_, i) => ({
      song: { title: `S${i}`, groupDisplayName: 'TWICE', album: 'A', releaseYear: 2020, spotifyId: `sp${i}` },
      clipToken: `t${i}`,
    }))

  const make = (matchRounds, totalRounds) => {
    const emit = vi.fn()
    const clock = fakeClock()
    const scheduler = manualScheduler()
    const match = new Match({
      id: 'm', rounds: makeRounds(totalRounds), clock, emit, scheduler,
      timings: { countdownMs: 1000, windowMs: 5000, revealDwellMs: 1000, matchRounds },
    })
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.addPlayer({ id: 'b', displayName: 'B' })
    match.setReady('a'); match.setReady('b') // starts round 0
    return { match, emit, clock, scheduler }
  }

  // Both answer the active round; a at aMs, b at bMs (ms after clip start), then
  // run the reveal timer to advance to the next round / resolution.
  const playRound = ({ match, clock, scheduler }, aMs, bMs) => {
    const idx = match.roundIndex
    clock.advance(match.countdownMs + aMs)
    match.submitGuess('a', idx, `S${idx}`)
    if (bMs > aMs) clock.advance(bMs - aMs)
    match.submitGuess('b', idx, `S${idx}`)
    scheduler.runAll() // fire reveal-dwell timer → advance
  }

  const lastPayload = (emit, event) => emit.mock.calls.filter((c) => c[0] === event).at(-1)?.[1]

  it('plays through all scored rounds then finishes with the higher total winning', () => {
    const ctx = make(2, 3)
    playRound(ctx, 1000, 6000) // a:5 b:4
    expect(ctx.match.phase).toBe(PHASES.ROUND_ACTIVE) // round 1 started
    expect(ctx.match.roundIndex).toBe(1)
    playRound(ctx, 1000, 6000) // a:5 b:4 → a 10, b 8

    expect(ctx.match.phase).toBe(PHASES.FINISHED)
    const over = lastPayload(ctx.emit, 'battle:match_over')
    expect(over.winnerId).toBe('a')
    expect(over.draw).toBe(false)
    expect(over.rounds).toHaveLength(2) // per-round breakdown
  })

  it('breaks a tie with a decisive sudden-death round', () => {
    const ctx = make(2, 3) // 2 scored + 1 spare
    playRound(ctx, 1000, 1000) // 5-5
    playRound(ctx, 1000, 1000) // 10-10 → tied → sudden death
    expect(ctx.match.phase).toBe(PHASES.ROUND_ACTIVE)
    expect(ctx.match.roundIndex).toBe(2) // overtime round

    playRound(ctx, 1000, 6000) // a:5 b:4 → decisive
    expect(ctx.match.phase).toBe(PHASES.FINISHED)
    expect(lastPayload(ctx.emit, 'battle:match_over').winnerId).toBe('a')
  })

  it('declares a draw when tied and out of spare rounds', () => {
    const ctx = make(1, 1) // 1 scored round, no spares
    playRound(ctx, 1000, 1000) // 5-5, tied, no spare

    expect(ctx.match.phase).toBe(PHASES.FINISHED)
    const over = lastPayload(ctx.emit, 'battle:match_over')
    expect(over.winnerId).toBeNull()
    expect(over.draw).toBe(true)
  })

  it('rematch resets scores + swaps in fresh songs and restarts', () => {
    const ctx = make(1, 1)
    playRound(ctx, 1000, 6000) // a wins → FINISHED
    expect(ctx.match.phase).toBe(PHASES.FINISHED)

    expect(ctx.match.requestRematch('a')).toBe(false) // only one in
    expect(ctx.match.requestRematch('b')).toBe(true) // both in
    ctx.match.startRematch([
      { song: { title: 'NEW', groupDisplayName: 'IVE' }, clipToken: 'tnew' },
    ])

    expect(ctx.match.phase).toBe(PHASES.ROUND_ACTIVE)
    expect(ctx.match.roundIndex).toBe(0)
    expect(ctx.match.players.every((p) => p.score === 0 && !p.wantsRematch)).toBe(true)
    expect(ctx.match.rounds[0].clipToken).toBe('tnew')
  })
})

describe('Match connection robustness', () => {
  const makeRounds = (n) =>
    Array.from({ length: n }, (_, i) => ({ song: { title: `S${i}`, groupDisplayName: 'TWICE' }, clipToken: `t${i}` }))

  const make = () => {
    const emit = vi.fn()
    const clock = fakeClock()
    const scheduler = manualScheduler()
    const match = new Match({
      id: 'm', rounds: makeRounds(7), clock, emit, scheduler,
      timings: { countdownMs: 1000, windowMs: 5000, revealDwellMs: 1000, matchRounds: 5, forfeitGraceMs: 15000 },
    })
    match.addPlayer({ id: 'a', displayName: 'A' })
    match.addPlayer({ id: 'b', displayName: 'B' })
    return { match, emit, clock, scheduler }
  }
  const lastPayload = (emit, event) => emit.mock.calls.filter((c) => c[0] === event).at(-1)?.[1]

  it('forfeits to the opponent when a dropped player misses the reconnect grace (FR-14)', () => {
    const { match, emit, scheduler } = make()
    match.setReady('a'); match.setReady('b') // ROUND_ACTIVE
    match.setConnected('a', false)
    expect(match.phase).toBe(PHASES.ROUND_ACTIVE) // grace running
    scheduler.runAll() // grace + round timers fire
    expect(match.phase).toBe(PHASES.FINISHED)
    expect(lastPayload(emit, 'battle:match_over')).toMatchObject({ forfeit: true, winnerId: 'b' })
  })

  it('cancels the forfeit when the player reconnects in time (FR-13)', () => {
    const { match, scheduler } = make()
    match.setReady('a'); match.setReady('b')
    match.setConnected('a', false)
    match.setConnected('a', true) // back in time
    scheduler.runAll()
    expect(match.phase).not.toBe(PHASES.FINISHED)
  })

  it('forfeits immediately on an explicit leave mid-match', () => {
    const { match, emit } = make()
    match.setReady('a'); match.setReady('b')
    match.leave('a')
    expect(match.phase).toBe(PHASES.FINISHED)
    expect(lastPayload(emit, 'battle:match_over')).toMatchObject({ forfeit: true, winnerId: 'b' })
  })

  it('does NOT forfeit for a disconnect in the lobby', () => {
    const { match, scheduler } = make()
    match.setConnected('a', false) // still WAITING
    scheduler.runAll()
    expect(match.phase).toBe(PHASES.WAITING)
  })

  it('replays the active round to a (re)joining socket (FR-13)', () => {
    const { match } = make()
    match.setReady('a'); match.setReady('b') // ROUND_ACTIVE
    const events = match.getResumeEvents()
    expect(events).toHaveLength(1)
    expect(events[0][0]).toBe('battle:round_start')
    expect(events[0][1].clipToken).toBe('t0')
  })

  it('reconnecting via addPlayer cancels a pending forfeit', () => {
    const { match, scheduler } = make()
    match.setReady('a'); match.setReady('b') // ROUND_ACTIVE
    match.setConnected('a', false) // schedules forfeit
    match.addPlayer({ id: 'a', displayName: 'A', socketId: 's-new' }) // rejoin
    scheduler.runAll()
    expect(match.phase).not.toBe(PHASES.FINISHED) // no stale forfeit fired
  })

  it('ignores a stale disconnect from a socket that was already replaced (reconnect race)', () => {
    const { match, scheduler } = make()
    match.addPlayer({ id: 'a', displayName: 'A', socketId: 's2' }) // a is now on socket s2
    match.setReady('a'); match.setReady('b') // ROUND_ACTIVE
    match.handleDisconnect('a', 's1') // the OLD socket drops, after the new one joined
    scheduler.runAll()
    expect(match.phase).not.toBe(PHASES.FINISHED) // present player not forfeited
    expect(match.players.find((p) => p.id === 'a').connected).toBe(true)
  })
})
