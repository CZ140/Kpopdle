import { scoreGuess } from './scoring.js'
import { isCorrectGuess } from '../utils/guessMatch.js'

// A single Battle match. Deliberately transport-agnostic: it takes an injected
// `clock`, `emit`, and `scheduler` so the state machine, round timing, and
// scoring are unit-testable with a fake clock + manual scheduler — no sockets,
// no real time. The socket layer is a thin adapter that calls these methods and
// forwards what `emit` broadcasts.

export const PHASES = {
  WAITING: 'WAITING', // fewer than 2 players present
  READY_CHECK: 'READY_CHECK', // both joined + ready, but no rounds to play (lobby-only)
  ROUND_ACTIVE: 'ROUND_ACTIVE', // a clip is (about to be) playing; guesses accepted after startAt
  ROUND_REVEAL: 'ROUND_REVEAL', // round over; answer + scores shown
  FINISHED: 'FINISHED', // match complete (M3 owns the transition into this)
}

export const MAX_PLAYERS = 2
export const COUNTDOWN_MS = 3000 // 3-2-1 before the clip starts
export const ROUND_WINDOW_MS = 30000 // guessing window once the clip starts

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
    this.emit = emit // (event, payload) => broadcast to everyone in the room
    this.scheduler = scheduler
    this.countdownMs = timings.countdownMs ?? COUNTDOWN_MS
    this.windowMs = timings.windowMs ?? ROUND_WINDOW_MS

    this.players = [] // { id, displayName, connected, ready, score, round* }
    // Songs + opaque clip tokens. SERVER-ONLY — never in getState(), so neither
    // answers nor Deezer ids reach a client (FR-16/17).
    this.rounds = rounds // [{ song, clipToken, clipBuffer? }]
    this.phase = PHASES.WAITING

    this.roundIndex = -1
    this.roundStartAt = null // server timestamp when the clip begins
    this._roundTimer = null

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
      player = { id, displayName, connected: true, ready: false, score: 0 }
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
    // Both readied in the lobby → begin play (or sit at READY_CHECK if this match
    // has no rounds, e.g. a lobby-only unit test).
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
    // Opaque clip handle + synchronized start time. No answer.
    this.emit('battle:round_start', {
      roundIndex: index,
      totalRounds: this.rounds.length,
      clipToken: round.clipToken,
      startAt: this.roundStartAt,
      windowMs: this.windowMs,
    })
    this._roundTimer = this.scheduler.setTimeout(
      () => this._endRound(),
      this.countdownMs + this.windowMs,
    )
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
    // Broadcast result (no answer). Opponent sees status; a live scoreboard is
    // part of the head-to-head UX, so revealing points early is intentional.
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
    this.emit('battle:round_reveal', {
      roundIndex: this.roundIndex,
      answer: {
        title: round.song.title,
        album: round.song.album,
        releaseYear: round.song.releaseYear,
        groupDisplayName: round.song.groupDisplayName,
        spotifyId: round.song.spotifyId,
      },
      results: this.players.map((p) => ({
        playerId: p.id,
        displayName: p.displayName,
        points: p.roundPoints || 0,
        elapsedMs: p.roundElapsedMs,
      })),
      scores: this.players.map((p) => ({ playerId: p.id, displayName: p.displayName, score: p.score })),
    })
    this._broadcast()
  }

  // --- Lobby phase bookkeeping ---------------------------------------------

  _recomputeLobby() {
    if (this.phase === PHASES.WAITING || this.phase === PHASES.READY_CHECK) {
      this.phase = this.bothReady() && this.rounds.length === 0 ? PHASES.READY_CHECK : PHASES.WAITING
    }
  }

  getState() {
    return {
      id: this.id,
      scope: this.scope,
      phase: this.phase,
      roundIndex: this.roundIndex,
      totalRounds: this.rounds.length,
      players: this.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        connected: p.connected,
        ready: p.ready,
        score: p.score,
      })),
    }
  }

  _broadcast() {
    this.lastActivityAt = this.clock()
    this.emit('battle:state', this.getState())
  }
}
