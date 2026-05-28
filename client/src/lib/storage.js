const DEFAULT_STATS = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  lastPlayedDate: null,
}

// Key helpers — namespaced by group
const statsKey = (group) => `${group}-stats`
const gameKey = (group, date) => `${group}-game-${date}`

// One-time migration: twicedle-* → twice-* for existing players
export function migrateStorageIfNeeded() {
  try {
    if (localStorage.getItem('twicedle-stats') && !localStorage.getItem('twice-stats')) {
      localStorage.setItem('twice-stats', localStorage.getItem('twicedle-stats'))

      const keysToMigrate = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('twicedle-game-')) keysToMigrate.push(key)
      }
      for (const key of keysToMigrate) {
        const date = key.replace('twicedle-game-', '')
        localStorage.setItem(`twice-game-${date}`, localStorage.getItem(key))
      }
    }
  } catch {
    // localStorage may be unavailable (private browsing edge cases)
  }
}

export function loadStats(group = 'twice') {
  try {
    const raw = localStorage.getItem(statsKey(group))
    if (!raw) return { ...DEFAULT_STATS }
    return JSON.parse(raw)
  } catch {
    return { ...DEFAULT_STATS }
  }
}

export function saveStats(group, stats) {
  localStorage.setItem(statsKey(group), JSON.stringify(stats))
}

export function loadGameState(group, date) {
  try {
    const raw = localStorage.getItem(gameKey(group, date))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveGameState(group, date, state) {
  localStorage.setItem(gameKey(group, date), JSON.stringify(state))
}

// Archive game state — separate namespace, never affects daily stats
const archiveKey = (group, date) => `${group}-archive-${date}`

export function loadArchiveGameState(group, date) {
  try {
    const raw = localStorage.getItem(archiveKey(group, date))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveArchiveGameState(group, date, state) {
  localStorage.setItem(archiveKey(group, date), JSON.stringify(state))
}

// Coverdle mode — keyed under a `${group}-cover` namespace so cover-game state
// and stats never collide with the audio daily (FR-7).
//
// The `-v2` suffix exists because the Coverdle answer space switched from songs
// to albums (bug: shared album covers made song-level answers unguessable). The
// pool size shrunk, so the deterministic daily pick changed too — any state
// saved against the old (song-mode) daily would mismatch today's (album-mode)
// daily. Bumping the key drops the stale state cleanly without a migration.
const coverGameKey = (group, date) => `${group}-cover-v2-game-${date}`
const coverArchiveKey = (group, date) => `${group}-cover-v2-archive-${date}`

export function loadCoverGameState(group, date) {
  try {
    const raw = localStorage.getItem(coverGameKey(group, date))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCoverGameState(group, date, state) {
  localStorage.setItem(coverGameKey(group, date), JSON.stringify(state))
}

export function loadCoverArchiveGameState(group, date) {
  try {
    const raw = localStorage.getItem(coverArchiveKey(group, date))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCoverArchiveGameState(group, date, state) {
  localStorage.setItem(coverArchiveKey(group, date), JSON.stringify(state))
}

const DIFFICULTY_KEY = 'kpopdle-difficulty'
const VALID_DIFFICULTIES = ['easy', 'normal', 'hard']

export function loadDifficulty() {
  try {
    const d = localStorage.getItem(DIFFICULTY_KEY)
    return VALID_DIFFICULTIES.includes(d) ? d : 'normal'
  } catch {
    return 'normal'
  }
}

export function saveDifficulty(difficulty) {
  try { localStorage.setItem(DIFFICULTY_KEY, difficulty) } catch {}
}
