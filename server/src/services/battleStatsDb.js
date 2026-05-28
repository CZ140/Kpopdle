import db from './db.js'

// Per-finish row for every Battle match. We write ONE row per player per
// finished match (so a normal 2-player match writes 2 rows). Personal stats are
// derived by selecting on `player_id`.
//
// Identity scheme matches realtime/socket.js → resolvePlayerId():
//   - `u:<userId>`   signed-in user
//   - `p:<token>`    anonymous device token (localStorage)
//   - `s:<socketId>` last-resort, never aggregated for stats (skipped on insert)
//
// Rematches reuse the same Match.id, so the pair (match_id, finished_at) is
// what disambiguates segments. We don't try to enforce uniqueness on the
// composite — `_recorded` in socket.js prevents double-inserts on a single
// match_over.
db.exec(`
  CREATE TABLE IF NOT EXISTS battle_results (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id           TEXT    NOT NULL,
    player_id          TEXT    NOT NULL,
    display_name       TEXT    NOT NULL,
    scope              TEXT    NOT NULL DEFAULT 'all',
    opponent_id        TEXT,
    opponent_name      TEXT,
    own_score          INTEGER NOT NULL,
    opp_score          INTEGER NOT NULL DEFAULT 0,
    outcome            TEXT    NOT NULL,
    forfeit            INTEGER NOT NULL DEFAULT 0,
    forfeit_by_self    INTEGER NOT NULL DEFAULT 0,
    rounds_played      INTEGER NOT NULL DEFAULT 0,
    correct_rounds     INTEGER NOT NULL DEFAULT 0,
    fastest_correct_ms INTEGER,
    finished_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_battle_results_player ON battle_results(player_id, finished_at);
`)

const insert = db.prepare(`
  INSERT INTO battle_results (
    match_id, player_id, display_name, scope, opponent_id, opponent_name,
    own_score, opp_score, outcome, forfeit, forfeit_by_self,
    rounds_played, correct_rounds, fastest_correct_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

/**
 * Persist a finished Match. Pulls history + final scores off the Match instance
 * and writes one row per player. Pure side effect — callers shouldn't await it
 * for control flow.
 *
 * Returns the number of rows inserted (mostly for tests/observability).
 */
export function recordBattleMatch(match, finalPayload) {
  if (!match || !Array.isArray(match.players) || match.players.length === 0) return 0
  // No rounds played at all — that's a "started and someone bailed before round 1";
  // not interesting to keep, and `correct_rounds` would always be 0.
  const history = Array.isArray(match.history) ? match.history : []
  if (history.length === 0) return 0

  const forfeit = !!finalPayload?.forfeit
  const forfeitedBy = finalPayload?.forfeitedBy ?? null
  const draw = !!finalPayload?.draw
  const winnerId = finalPayload?.winnerId ?? null

  // Pre-aggregate per-player correct rounds + fastest correct guess from history.
  const perPlayer = new Map() // playerId -> { correct, fastestMs }
  for (const round of history) {
    for (const r of round.results || []) {
      const agg = perPlayer.get(r.playerId) || { correct: 0, fastestMs: null }
      if (r.points > 0) {
        agg.correct += 1
        if (agg.fastestMs == null || r.elapsedMs < agg.fastestMs) agg.fastestMs = r.elapsedMs
      }
      perPlayer.set(r.playerId, agg)
    }
  }

  let inserted = 0
  const tx = db.transaction(() => {
    for (const player of match.players) {
      // Don't aggregate stats for socket-only identities (no stable handle).
      if (player.id.startsWith('s:')) continue
      const opponent = match.players.find((p) => p.id !== player.id) || null
      const ownScore = player.score | 0
      const oppScore = opponent ? (opponent.score | 0) : 0
      let outcome
      if (draw) outcome = 'draw'
      else if (winnerId && winnerId === player.id) outcome = 'win'
      else outcome = 'loss'
      const agg = perPlayer.get(player.id) || { correct: 0, fastestMs: null }
      insert.run(
        match.id,
        player.id,
        player.displayName || 'Player',
        match.scope || 'all',
        opponent?.id ?? null,
        opponent?.displayName ?? null,
        ownScore,
        oppScore,
        outcome,
        forfeit ? 1 : 0,
        forfeit && forfeitedBy === player.id ? 1 : 0,
        history.length,
        agg.correct,
        agg.fastestMs,
      )
      inserted += 1
    }
  })
  tx()
  return inserted
}

/**
 * Aggregated personal stats for a single player id. Returns zeros (not null)
 * when the player has no recorded matches so callers can render a stable empty
 * state without branching on `null`.
 */
export function getPersonalStats(playerId) {
  if (!playerId || typeof playerId !== 'string') return emptyStats()

  const rows = db.prepare(`
    SELECT
      match_id, opponent_name, scope,
      own_score, opp_score, outcome,
      forfeit, forfeit_by_self,
      rounds_played, correct_rounds, fastest_correct_ms,
      finished_at
    FROM battle_results
    WHERE player_id = ?
    ORDER BY finished_at DESC
  `).all(playerId)

  if (rows.length === 0) return emptyStats()

  let wins = 0, losses = 0, draws = 0, scoreSum = 0
  let fastest = null
  for (const r of rows) {
    if (r.outcome === 'win') wins += 1
    else if (r.outcome === 'loss') losses += 1
    else draws += 1
    scoreSum += r.own_score
    if (r.fastest_correct_ms != null && (fastest == null || r.fastest_correct_ms < fastest)) {
      fastest = r.fastest_correct_ms
    }
  }

  // Streaks: walk most-recent-first. `currentStreak` is the leading run of
  // wins; `bestStreak` scans every win-run in history. Forfeits-by-self still
  // count as a loss (and break the streak), as they should.
  let currentStreak = 0
  for (const r of rows) {
    if (r.outcome === 'win') currentStreak += 1
    else break
  }
  let bestStreak = 0, run = 0
  for (const r of rows) {
    if (r.outcome === 'win') { run += 1; if (run > bestStreak) bestStreak = run }
    else run = 0
  }

  const recent = rows.slice(0, 10).map((r) => ({
    matchId: r.match_id,
    opponentName: r.opponent_name,
    scope: r.scope,
    outcome: r.outcome,
    ownScore: r.own_score,
    oppScore: r.opp_score,
    forfeit: !!r.forfeit,
    forfeitBySelf: !!r.forfeit_by_self,
    finishedAt: r.finished_at,
  }))

  return {
    totalMatches: rows.length,
    wins,
    losses,
    draws,
    winRate: Math.round((wins / rows.length) * 100),
    currentStreak,
    bestStreak,
    avgScore: Math.round((scoreSum / rows.length) * 10) / 10,
    fastestCorrectMs: fastest,
    recent,
  }
}

function emptyStats() {
  return {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    avgScore: 0,
    fastestCorrectMs: null,
    recent: [],
  }
}
