const STATS_KEY = 'twicedle-stats'
const GAME_KEY_PREFIX = 'twicedle-game-'

const DEFAULT_STATS = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  lastPlayedDate: null,
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { ...DEFAULT_STATS }
    return JSON.parse(raw)
  } catch {
    return { ...DEFAULT_STATS }
  }
}

export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

export function loadGameState(gameDate) {
  try {
    const raw = localStorage.getItem(GAME_KEY_PREFIX + gameDate)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveGameState(gameDate, state) {
  localStorage.setItem(GAME_KEY_PREFIX + gameDate, JSON.stringify(state))
}
