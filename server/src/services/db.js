import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// DB_PATH env var lets Railway point the database at a persistent Volume.
// Falls back to the local data/ directory for development.
const dbDir = process.env.DB_PATH ?? join(__dirname, '../data')
mkdirSync(dbDir, { recursive: true })

const db = new Database(join(dbDir, 'stats.db'))
db.pragma('journal_mode = WAL')  // concurrent reads while writing
db.pragma('foreign_keys = ON')   // enforces ON DELETE CASCADE

export default db
