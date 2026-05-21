import db from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS game_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id     TEXT    NOT NULL,
    song_id      INTEGER NOT NULL DEFAULT 0,
    song_title   TEXT    NOT NULL,
    guess_count  INTEGER NOT NULL,
    won          INTEGER NOT NULL,
    wrong_guesses TEXT   NOT NULL DEFAULT '[]',
    hints_used   INTEGER NOT NULL DEFAULT 0,
    difficulty   TEXT    NOT NULL DEFAULT 'normal',
    played_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_game_results_group ON game_results(group_id, played_at);
`)

export function recordGame({ groupId, songId, songTitle, guessCount, won, wrongGuesses, hintsUsed, difficulty }) {
  db.prepare(`
    INSERT INTO game_results (group_id, song_id, song_title, guess_count, won, wrong_guesses, hints_used, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    groupId,
    songId ?? 0,
    songTitle,
    guessCount,
    won ? 1 : 0,
    JSON.stringify(wrongGuesses ?? []),
    hintsUsed ?? 0,
    difficulty ?? 'normal'
  )
}

// Song difficulty: sorted hardest first (lowest win rate, highest avg guesses)
export function getSongDifficulty(groupId) {
  return db.prepare(`
    SELECT
      song_id,
      song_title,
      COUNT(*)                                          AS plays,
      ROUND(AVG(guess_count), 2)                        AS avg_guesses,
      ROUND(SUM(won) * 100.0 / COUNT(*), 1)             AS win_rate,
      SUM(CASE WHEN won = 0 THEN 1 ELSE 0 END)          AS losses
    FROM game_results
    WHERE group_id = ?
    GROUP BY song_id, song_title
    ORDER BY win_rate ASC, avg_guesses DESC
  `).all(groupId)
}

// What wrong guesses do players make for each song?
export function getConfusion(groupId) {
  const rows = db.prepare(`
    SELECT song_title, wrong_guesses
    FROM game_results
    WHERE group_id = ? AND wrong_guesses != '[]'
  `).all(groupId)

  const counts = {}
  for (const row of rows) {
    const wrongs = JSON.parse(row.wrong_guesses)
    for (const wrong of wrongs) {
      const key = `${wrong} → ${row.song_title}`
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([pair, count]) => {
      const [guessed, answer] = pair.split(' → ')
      return { guessed, answer, count }
    })
}

// Community stats for a specific group's daily game on a given KST date.
// played_at is stored in UTC — convert with '+9 hours' to get the KST day.
// Returns null when fewer than 2 players have finished (avoids showing "1 player").
export function getCommunityStats(groupId, kstDate) {
  const row = db.prepare(`
    SELECT
      COUNT(*)                                               AS total_plays,
      ROUND(SUM(won) * 100.0 / COUNT(*), 0)                 AS win_rate,
      ROUND(AVG(CASE WHEN won = 1 THEN guess_count END), 1) AS avg_winning_guesses
    FROM game_results
    WHERE group_id = ?
      AND DATE(played_at, '+9 hours') = ?
  `).get(groupId, kstDate)

  if (!row || row.total_plays < 2) return null

  // Find the single most common wrong guess for this day
  const rows = db.prepare(`
    SELECT wrong_guesses FROM game_results
    WHERE group_id = ?
      AND DATE(played_at, '+9 hours') = ?
      AND wrong_guesses != '[]'
  `).all(groupId, kstDate)

  const counts = {}
  for (const { wrong_guesses } of rows) {
    for (const g of JSON.parse(wrong_guesses)) {
      counts[g] = (counts[g] ?? 0) + 1
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const topWrong = sorted.length > 0 ? sorted[0][0] : null

  return {
    totalPlays: row.total_plays,
    winRate: row.win_rate,
    avgWinningGuesses: row.avg_winning_guesses,
    topWrong,
  }
}

// Per-group summary: total plays, win rate, avg guesses, hint usage
export function getSummary() {
  return db.prepare(`
    SELECT
      group_id,
      COUNT(*)                                        AS total_games,
      ROUND(SUM(won) * 100.0 / COUNT(*), 1)           AS win_rate,
      ROUND(AVG(guess_count), 2)                      AS avg_guesses,
      ROUND(AVG(hints_used), 2)                       AS avg_hints_used,
      SUM(CASE WHEN difficulty = 'easy'   THEN 1 ELSE 0 END) AS easy_games,
      SUM(CASE WHEN difficulty = 'normal' THEN 1 ELSE 0 END) AS normal_games,
      SUM(CASE WHEN difficulty = 'hard'   THEN 1 ELSE 0 END) AS hard_games
    FROM game_results
    GROUP BY group_id
    ORDER BY total_games DESC
  `).all()
}
