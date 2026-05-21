import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import db from './db.js'
import groups from '../data/groups.json' with { type: 'json' }

const VALID_GROUP_IDS = new Set([...groups.map(g => g.id), 'kpopdle'])

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id    TEXT    NOT NULL UNIQUE,
    email        TEXT    NOT NULL,
    display_name TEXT    NOT NULL,
    avatar_url   TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id       TEXT    NOT NULL,
    games_played   INTEGER NOT NULL DEFAULT 0,
    games_won      INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    max_streak     INTEGER NOT NULL DEFAULT 0,
    last_played    TEXT,
    updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (user_id, group_id)
  );

  CREATE TABLE IF NOT EXISTS user_guess_distribution (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id TEXT    NOT NULL,
    guesses  INTEGER NOT NULL CHECK (guesses BETWEEN 1 AND 6),
    count    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, group_id, guesses)
  );
`)

export function configurePassport() {
  passport.serializeUser((user, done) => done(null, user.id))

  passport.deserializeUser((id, done) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
      done(null, user ?? false)
    } catch (err) { done(err) }
  })

  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = db.prepare(`
          INSERT INTO users (google_id, email, display_name, avatar_url)
          VALUES (@googleId, @email, @displayName, @avatarUrl)
          ON CONFLICT (google_id) DO UPDATE SET
            display_name = excluded.display_name,
            avatar_url   = excluded.avatar_url,
            last_seen    = unixepoch()
          RETURNING *
        `).get({
          googleId:    profile.id,
          email:       profile.emails?.[0]?.value ?? '',
          displayName: profile.displayName,
          avatarUrl:   profile.photos?.[0]?.value ?? null,
        })
        done(null, user)
      } catch (err) { done(err) }
    }
  ))
}

export function getUserStats(userId) {
  const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').all(userId)
  const dist  = db.prepare('SELECT * FROM user_guess_distribution WHERE user_id = ?').all(userId)

  const result = {}
  for (const s of stats) {
    const guessDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    for (const d of dist.filter(d => d.group_id === s.group_id)) {
      guessDistribution[d.guesses] = d.count
    }
    result[s.group_id] = {
      gamesPlayed:       s.games_played,
      gamesWon:          s.games_won,
      currentStreak:     s.current_streak,
      maxStreak:         s.max_streak,
      lastPlayedDate:    s.last_played,
      guessDistribution,
    }
  }
  return result
}

export function saveUserStats(userId, groupId, stats) {
  db.prepare(`
    INSERT INTO user_stats (user_id, group_id, games_played, games_won, current_streak, max_streak, last_played)
    VALUES (@userId, @groupId, @gamesPlayed, @gamesWon, @currentStreak, @maxStreak, @lastPlayed)
    ON CONFLICT (user_id, group_id) DO UPDATE SET
      games_played   = excluded.games_played,
      games_won      = excluded.games_won,
      current_streak = excluded.current_streak,
      max_streak     = excluded.max_streak,
      last_played    = excluded.last_played,
      updated_at     = unixepoch()
  `).run({
    userId,
    groupId,
    gamesPlayed:   stats.gamesPlayed,
    gamesWon:      stats.gamesWon,
    currentStreak: stats.currentStreak,
    maxStreak:     stats.maxStreak,
    lastPlayed:    stats.lastPlayedDate ?? null,
  })

  const upsertGuess = db.prepare(`
    INSERT INTO user_guess_distribution (user_id, group_id, guesses, count)
    VALUES (@userId, @groupId, @guesses, @count)
    ON CONFLICT (user_id, group_id, guesses) DO UPDATE SET count = excluded.count
  `)
  const dist = stats.guessDistribution ?? {}
  for (const [g, count] of Object.entries(dist)) {
    upsertGuess.run({ userId, groupId, guesses: parseInt(g), count })
  }
}

export function importLocalStorageStats(userId, statsMap) {
  const insertStats = db.prepare(`
    INSERT INTO user_stats (user_id, group_id, games_played, games_won, current_streak, max_streak, last_played)
    VALUES (@userId, @groupId, @gamesPlayed, @gamesWon, @currentStreak, @maxStreak, @lastPlayed)
    ON CONFLICT (user_id, group_id) DO NOTHING
  `)
  const insertGuess = db.prepare(`
    INSERT INTO user_guess_distribution (user_id, group_id, guesses, count)
    VALUES (@userId, @groupId, @guesses, @count)
    ON CONFLICT (user_id, group_id, guesses) DO NOTHING
  `)

  db.transaction((map) => {
    for (const [groupId, s] of Object.entries(map)) {
      if (!VALID_GROUP_IDS.has(groupId)) continue
      if (!s || typeof s.gamesPlayed !== 'number') continue
      insertStats.run({
        userId,
        groupId,
        gamesPlayed:   s.gamesPlayed,
        gamesWon:      s.gamesWon ?? 0,
        currentStreak: s.currentStreak ?? 0,
        maxStreak:     s.maxStreak ?? 0,
        lastPlayed:    s.lastPlayedDate ?? null,
      })
      for (const [g, count] of Object.entries(s.guessDistribution ?? {})) {
        if (count > 0) insertGuess.run({ userId, groupId, guesses: parseInt(g), count })
      }
    }
  })(statsMap)
}

export function deleteUserAndAllData(userId) {
  // ON DELETE CASCADE handles user_stats and user_guess_distribution automatically
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
}
