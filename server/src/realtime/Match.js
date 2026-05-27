import { scoreGuess } from './scoring.js'
import { isCorrectGuess } from '../utils/guessMatch.js'

// A single Battle match. Deliberately transport-agnostic: it takes an injected
// `clock`, `emit`, and `scheduler` so the state machine, round timing, and
// scoring are unit-testable with a fake clock + manual scheduler — no sockets,
// no real time. The socket layer is a thin adapter that calls these methods and
// forwards what `emit` broadcasts.

export const PHASES = {
  WAITING: 'WAITING', // fewer than 2 players present
  READY_CHECK: 'READY_CHECK', // both ready but no rounds to play (lobby-only)
  ROUND_ACTIVE: 'ROUND_ACTIVE', // a clip is (about to be) playing
  ROUND_REVEAL: 'ROUND_REVEAL', // round over; answer + scores shown
  FINISHED: 'FINISHED', // match complete
}

export const MAX_PLAYERS = 2
export const MATCH_ROUNDS = 5 // scored rounds in a normal match
export const COUNTDOWN_MS = 3000 // 3-2-1 before the clip starts
export const ROUND_WINDOW_MS = 30000 // guessing window once the clip starts
export const REVEAL_DWELL_MS = 4000 // how long the reveal shows before advancing

export class MatchError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export class Match {
  constructor({
    id,
    scope = 'all',
    rounds = [],
    clock = Date.now,
    emit = () => {},
    scheduler = { setTimeout, clearTimeout },
    timings = {},
  }) {
    this.id = id
    this.scope = scope
    this.clock = clock
    this.emit = emit
    this.scheduler = scheduler
    this.countdownMs = timings.countdownMs ?? COUNTDOWN_MS
    this.windowMs = timings.windowMs ?? ROUND_WINDOW_MS
    this.revealDwellMs = timings.revealDwellMs ?? REVEAL_DWELL_MS
    // Scored rounds; rounds beyond this are sudden-death spares for ties.
    this.matchRounds = timings.matchRounds ?? Math.min(MATCH_ROUNDS, rounds.length)

    this.players = []
    // Songs + opaque clip tokens. SERVER-ONLY — never in getState() (FR-16/17).
    this.rounds = rounds
    this.history = [] // per-round results, for the end-of-match breakdown
    this.phase = PHASES.WAITING

    this.roundIndex = -1
    this.roundStartAt = null
    this._roundTimer = null
    this._revealTimer = null

    this.createdAt = this.clock()
    this.lastActivityAt = this.createdAt
  }

  roundForClipToken(token) {
    return this.rounds.find((r) => r.clipToken === token)
  }

  isFull() {
    return this.players.length >= MAX_PLAYERS
  }

  addPlayer({ id, displayName }) {
    let player = this.players.find((p) => p.id === id)
    if (!player) {
      if (this.isFull()) throw new MatchError('match_full', 'This match already has two players.')
      player = { id, displayName, connected: true, ready: false, score: 0, wantsRematch: false }
      this.players.push(player)
    } else {
      player.connected = true
      if (displayName) player.displayName = displayName
    }
    this._broadcast()
    return player
  }

  setConnected(id, connected) {
    const player = this.players.find((p) => p.id === id)
    if (!player) return
    player.connected = connected
    if (!connected) player.ready = false
    this._recomputeLobby()
    this._broadcast()
  }

  setReady(id) {
    const player = this.players.find((p) => p.id === id)
    if (!player) return
    player.ready = true
    this.lastActivityAt = this.clock()
    if (this.phase === PHASES.WAITING && this.bothReady()) {
      if (this.rounds.length > 0) this._startRound(0)
      else { this.phase = PHASES.READY_CHECK; this._broadcast() }
    } else {
      this._broadcast()
    }
  }

  removePlayer(id) {
    this.players = this.players.filter((p) => p.id !== id)
    this._recomputeLobby()
    this._broadcast()
  }

  bothReady() {
    return this.players.length === MAX_PLAYERS && this.players.every((p) => p.connected && p.ready)
  }

  // --- Rounds ---------------------------------------------------------------

  _startRound(index) {
    const round = this.rounds[index]
    if (!round) return
    this.roundIndex = index
    this.phase = PHASES.ROUND_ACTIVE
    this.roundStartAt = this.clock() + this.countdownMs
    for (const p of this.players) {
      p.roundAnswered = false
      p.roundPoints = 0
      p.roundElapsedMs = null
    }
    this.emit('battle:round_start', {
      roundIndex: index,
      totalRounds: this.matchRounds,
      suddenDeath: index >= this.matchRounds,
      clipToken: round.clipToken,
      startAt: this.roundStartAt,
      windowMs: this.windowMs,
    })
    this._roundTimer = this.scheduler.setTimeout(() => this._endRound(), this.countdownMs + this.windowMs)
    this._broadcast()
  }

  submitGuess(playerId, roundIndex, guess) {
    if (this.phase !== PHASES.ROUND_ACTIVE || roundIndex !== this.roundIndex) return
    const player = this.players.find((p) => p.id === playerId)
    if (!player || player.roundAnswered) return
    const now = this.clock()
    if (now < this.roundStartAt) return // clip hasn't started; ignore early input

    const round = this.rounds[roundIndex]
    const correct = isCorrectGuess(guess, round.song.title)
    if (correct) {
      const elapsedMs = now - this.roundStartAt
      player.roundAnswered = true
      player.roundElapsedMs = elapsedMs
      player.roundPoints = scoreGuess(elapsedMs)
      player.score += player.roundPoints
    }
    this.emit('battle:guess_result', {
      playerId,
      correct,
      roundIndex,
      ...(correct && { points: player.roundPoints, score: player.score }),
    })

    if (correct && this.players.length === MAX_PLAYERS && this.players.every((p) => p.roundAnswered)) {
      this._endRound() // both answered — end early
    }
  }

  _endRound() {
    if (this.phase !== PHASES.ROUND_ACTIVE) return
    this.scheduler.clearTimeout(this._roundTimer)
    this._roundTimer = null
    this.phase = PHASES.ROUND_REVEAL
    const round = this.rounds[this.roundIndex]
    const results = this.players.map((p) => ({
      playerId: p.id,
      displayName: p.displayName,
      points: p.roundPoints || 0,
      elapsedMs: p.roundElapsedMs,
    }))
    this.history.push({
      roundIndex: this.roundIndex,
      answer: { title: round.song.title, groupDisplayName: round.song.groupDisplayName },
      results,
    })
    this.emit('battle:round_reveal', {
      roundIndex: this.roundIndex,
      answer: {
        title: round.song.title,
        album: round.song.album,
        releaseYear: round.song.releaseYear,
        groupDisplayName: round.song.groupDisplayName,
        spotifyId: round.song.spotifyId,
      },
      results,
      scores: this._scores(),
    })
    this._broadcast()
    this._revealTimer = this.scheduler.setTimeout(() => this._advance(), this.revealDwellMs)
  }

  // Decide what happens after a reveal: next round, sudden-death, or finish.
  _advance() {
    this._revealTimer = null
    if (this.roundIndex + 1 < this.matchRounds) {
      this._startRound(this.roundIndex + 1)
      return
    }
    const [p1, p2] = this.players
    const inOvertime = this.roundIndex >= this.matchRounds
    if (inOvertime) {
      // A sudden-death round is decisive unless both scored the same.
      const decisive = this.players.length < MAX_PLAYERS || p1.roundPoints !== p2.roundPoints
      if (decisive) return this._finishMatch()
    } else if (!(this.players.length === MAX_PLAYERS && p1.score === p2.score)) {
      return this._finishMatch() // main rounds done and not tied
    }
    // Tied → play a spare round if one remains, else it's a draw.
    if (this.roundIndex + 1 < this.rounds.length) this._startRound(this.roundIndex + 1)
    else this._finishMatch()
  }

  _finishMatch() {
    this.phase = PHASES.FINISHED
    const [p1, p2] = this.players
    let winnerId = null
    if (this.players.length === MAX_PLAYERS) {
      if (p1.score > p2.score) winnerId = p1.id
      else if (p2.score > p1.score) winnerId = p2.id
    } else if (this.players.length === 1) {
      winnerId = this.players[0].id
    }
    this.emit('battle:match_over', {
      winnerId,
      draw: winnerId === null && this.players.length === MAX_PLAYERS,
      scores: this._scores(),
      rounds: this.history,
    })
    this._broadcast()
  }

  // --- Rematch --------------------------------------------------------------

  /** Returns true once both finished players have opted into a rematch. */
  requestRematch(id) {
    if (this.phase !== PHASES.FINISHED) return false
    const player = this.players.find((p) => p.id === id)
    if (!player) return false
    player.wantsRematch = true
    this._broadcast()
    return this.players.length === MAX_PLAYERS && this.players.every((p) => p.wantsRematch)
  }

  /** Reset with fresh songs and immediately start round 0 (both already opted in). */
  startRematch(newRounds) {
    this.rounds = newRounds
    this.matchRounds = Math.min(MATCH_ROUNDS, newRounds.length)
    this.history = []
    this.roundIndex = -1
    this.roundStartAt = null
    for (const p of this.players) {
      p.score = 0
      p.ready = true
      p.wantsRematch = false
      p.roundAnswered = false
      p.roundPoints = 0
      p.roundElapsedMs = null
    }
    this.phase = PHASES.WAITING
    this._startRound(0)
  }

  // --- Lobby bookkeeping ----------------------------------------------------

  _recomputeLobby() {
    if (this.phase === PHASES.WAITING || this.phase === PHASES.READY_CHECK) {
      this.phase = this.bothReady() && this.rounds.length === 0 ? PHASES.READY_CHECK : PHASES.WAITING
    }
  }

  _scores() {
    return this.players.map((p) => ({ playerId: p.id, displayName: p.displayName, score: p.score }))
  }

  getState() {
    return {
      id: this.id,
      scope: this.scope,
      phase: this.phase,
      roundIndex: this.roundIndex,
      totalRounds: this.matchRounds,
      players: this.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        connected: p.connected,
        ready: p.ready,
        score: p.score,
        wantsRematch: !!p.wantsRematch,
      })),
    }
  }

  _broadcast() {
    this.lastActivityAt = this.clock()
    this.emit('battle:state', this.getState())
  }
}
