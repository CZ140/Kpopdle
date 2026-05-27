import session from 'express-session'
import { SqliteSessionStore } from '../services/sessionStore.js'

// Shared session middleware — used by both Express (app.use) and Socket.IO
// (io.engine.use), so a battle socket sees the same logged-in session as the
// HTTP API. Extracted from index.js when Battle mode added the realtime layer.
export const sessionMiddleware = session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  },
})
