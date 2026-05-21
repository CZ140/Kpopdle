import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStats,
  saveStats,
  loadGameState,
  saveGameState,
  loadArchiveGameState,
  saveArchiveGameState,
  loadDifficulty,
  saveDifficulty,
  migrateStorageIfNeeded,
} from './storage'

beforeEach(() => {
  localStorage.clear()
})

describe('loadStats', () => {
  it('returns default stats when nothing is stored', () => {
    const stats = loadStats('twice')
    expect(stats.gamesPlayed).toBe(0)
    expect(stats.gamesWon).toBe(0)
    expect(stats.currentStreak).toBe(0)
    expect(stats.maxStreak).toBe(0)
    expect(stats.lastPlayedDate).toBeNull()
    expect(stats.guessDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 })
  })

  it('returns defaults for a group that has never been played', () => {
    saveStats('twice', { gamesPlayed: 5, gamesWon: 3, currentStreak: 2, maxStreak: 4, guessDistribution: { 1: 1, 2: 2, 3: 0, 4: 0, 5: 0, 6: 0 }, lastPlayedDate: '2026-05-20' })
    const other = loadStats('aespa')
    expect(other.gamesPlayed).toBe(0)
  })
})

describe('saveStats / loadStats round-trip', () => {
  it('persists and retrieves stats correctly', () => {
    const stats = {
      gamesPlayed: 10,
      gamesWon: 7,
      currentStreak: 3,
      maxStreak: 5,
      guessDistribution: { 1: 1, 2: 2, 3: 3, 4: 1, 5: 0, 6: 0 },
      lastPlayedDate: '2026-05-20',
    }
    saveStats('twice', stats)
    expect(loadStats('twice')).toEqual(stats)
  })

  it('namespaces by group — saving for one group does not affect another', () => {
    saveStats('twice', { gamesPlayed: 5, gamesWon: 5, currentStreak: 5, maxStreak: 5, guessDistribution: {}, lastPlayedDate: '2026-05-20' })
    expect(loadStats('aespa').gamesPlayed).toBe(0)
  })
})

describe('saveGameState / loadGameState round-trip', () => {
  it('returns null when no state is stored', () => {
    expect(loadGameState('twice', '2026-05-20')).toBeNull()
  })

  it('persists and retrieves game state', () => {
    const state = {
      guesses: [{ song: 'Wrong Song', type: 'wrong' }],
      gameState: 'playing',
      revealedSong: null,
      hintsUsed: 1,
    }
    saveGameState('twice', '2026-05-20', state)
    expect(loadGameState('twice', '2026-05-20')).toEqual(state)
  })

  it('namespaces by date — different dates are independent', () => {
    saveGameState('twice', '2026-05-20', { gameState: 'won' })
    expect(loadGameState('twice', '2026-05-21')).toBeNull()
  })
})

describe('archive game state', () => {
  it('is stored separately from daily game state', () => {
    saveGameState('twice', '2026-04-01', { gameState: 'won' })
    saveArchiveGameState('twice', '2026-04-01', { gameState: 'lost' })
    expect(loadGameState('twice', '2026-04-01').gameState).toBe('won')
    expect(loadArchiveGameState('twice', '2026-04-01').gameState).toBe('lost')
  })
})

describe('loadDifficulty / saveDifficulty', () => {
  it('returns normal when nothing is stored', () => {
    expect(loadDifficulty()).toBe('normal')
  })

  it('persists a valid difficulty', () => {
    saveDifficulty('hard')
    expect(loadDifficulty()).toBe('hard')
  })

  it('falls back to normal for an invalid stored value', () => {
    localStorage.setItem('kpopdle-difficulty', 'extreme')
    expect(loadDifficulty()).toBe('normal')
  })
})

describe('migrateStorageIfNeeded', () => {
  it('migrates twicedle-stats to twice-stats', () => {
    const stats = JSON.stringify({ gamesPlayed: 3, gamesWon: 2, currentStreak: 1, maxStreak: 2, guessDistribution: {}, lastPlayedDate: '2026-02-25' })
    localStorage.setItem('twicedle-stats', stats)
    migrateStorageIfNeeded()
    expect(localStorage.getItem('twice-stats')).toBe(stats)
  })

  it('migrates twicedle-game-* keys to twice-game-*', () => {
    localStorage.setItem('twicedle-stats', '{}')
    const gameState = JSON.stringify({ guesses: [], gameState: 'won' })
    localStorage.setItem('twicedle-game-2026-02-25', gameState)
    migrateStorageIfNeeded()
    expect(localStorage.getItem('twice-game-2026-02-25')).toBe(gameState)
  })

  it('does not overwrite existing twice-stats', () => {
    localStorage.setItem('twicedle-stats', JSON.stringify({ gamesPlayed: 1 }))
    localStorage.setItem('twice-stats', JSON.stringify({ gamesPlayed: 99 }))
    migrateStorageIfNeeded()
    expect(JSON.parse(localStorage.getItem('twice-stats')).gamesPlayed).toBe(99)
  })
})
