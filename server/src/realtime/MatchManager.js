import crypto from 'crypto'
import { Match, MatchError } from './Match.js'

// In-memory registry of active matches. Single Railway instance today, so a Map
// is enough; the surface (create/get/remove/sweep) is small enough to swap for a
// Redis-backed store when horizontal scaling arrives (see BATTLE_SPEC NFR-3).

const ROOM_TTL_MS = 10 * 60 * 1000 // idle rooms are reclaimed after 10 min
const EMPTY_GRACE_MS = 30 * 1000 // rooms with everyone disconnected go sooner
const GC_INTERVAL_MS = 60 * 1000
const MAX_ACTIVE_MATCHES = 1000 // memory guard (NFR-2)

export class MatchManager {
  constructor({ clock = Date.now, emitFactory = () => () => {} } = {}) {
    this.clock = clock
    // emitFactory(matchId) -> (event, payload) => broadcast to that room.
    // Injected so the manager/Match stay decoupled from Socket.IO for testing.
    this.emitFactory = emitFactory
    this.matches = new Map()
    this._gcTimer = null
  }

  // Bound to `io` after the socket server is attached (the singleton in
  // manager.js is constructed before `io` exists).
  setEmitFactory(fn) {
    this.emitFactory = fn
  }

  createMatch({ scope = 'all', rounds = [] } = {}) {
    if (this.matches.size >= MAX_ACTIVE_MATCHES) {
      throw new MatchError('capacity', 'Too many battles in progress right now.')
    }
    // 16 random bytes = 128 bits, URL-safe and non-enumerable (FR-1).
    const id = crypto.randomBytes(16).toString('base64url')
    const match = new Match({ id, scope, rounds, clock: this.clock, emit: this.emitFactory(id) })
    this.matches.set(id, match)
    return match
  }

  get(id) {
    return this.matches.get(id)
  }

  remove(id) {
    this.matches.delete(id)
  }

  get size() {
    return this.matches.size
  }

  /** Reclaim idle rooms and rooms everyone has left (FR-4). */
  sweep() {
    const now = this.clock()
    for (const [id, match] of this.matches) {
      const idle = now - match.lastActivityAt
      const everyoneGone =
        match.players.length > 0 && match.players.every((p) => !p.connected)
      if (idle > ROOM_TTL_MS || (everyoneGone && idle > EMPTY_GRACE_MS)) {
        this.matches.delete(id)
      }
    }
  }

  startGc() {
    if (this._gcTimer) return
    this._gcTimer = setInterval(() => this.sweep(), GC_INTERVAL_MS)
    this._gcTimer.unref?.() // don't keep the process alive for the sweeper
  }

  stopGc() {
    clearInterval(this._gcTimer)
    this._gcTimer = null
  }
}
