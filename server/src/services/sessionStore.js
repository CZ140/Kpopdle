import { Store } from 'express-session'
import db from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT    PRIMARY KEY,
    sess       TEXT    NOT NULL,
    expired_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);
`)

export class SqliteSessionStore extends Store {
  constructor() {
    super()
    // Prune expired sessions every 15 minutes
    setInterval(() => {
      db.prepare('DELETE FROM sessions WHERE expired_at < ?').run(Math.floor(Date.now() / 1000))
    }, 15 * 60 * 1000)
  }

  get(sid, callback) {
    try {
      const row = db
        .prepare('SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?')
        .get(sid, Math.floor(Date.now() / 1000))
      callback(null, row ? JSON.parse(row.sess) : null)
    } catch (err) { callback(err) }
  }

  set(sid, session, callback) {
    try {
      const maxAge = session.cookie?.maxAge ?? 365 * 24 * 3600 * 1000
      const expiredAt = Math.floor(Date.now() / 1000) + Math.floor(maxAge / 1000)
      db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)')
        .run(sid, JSON.stringify(session), expiredAt)
      callback(null)
    } catch (err) { callback(err) }
  }

  destroy(sid, callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid)
      callback(null)
    } catch (err) { callback(err) }
  }

  touch(sid, session, callback) {
    try {
      const maxAge = session.cookie?.maxAge ?? 365 * 24 * 3600 * 1000
      const expiredAt = Math.floor(Date.now() / 1000) + Math.floor(maxAge / 1000)
      db.prepare('UPDATE sessions SET expired_at = ? WHERE sid = ?').run(expiredAt, sid)
      callback(null)
    } catch (err) { callback(err) }
  }
}
