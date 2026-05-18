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
