import { describe, it, expect } from 'vitest'
import { computeNextStats } from './stats'

const base = () => ({
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  lastPlayedDate: null,
})

describe('computeNextStats — streak rules', () => {
  it('first win starts the streak at 1', () => {
    const next = computeNextStats(base(), 'won', 3, '2026-05-26', '2026-05-25')
    expect(next.currentStreak).toBe(1)
    expect(next.gamesPlayed).toBe(1)
    expect(next.gamesWon).toBe(1)
    expect(next.guessDistribution['3']).toBe(1)
  })

  it('a win the day after yesterday extends the streak', () => {
    const prev = { ...base(), gamesPlayed: 1, gamesWon: 1, currentStreak: 1, maxStreak: 1, lastPlayedDate: '2026-05-25' }
    const next = computeNextStats(prev, 'won', 2, '2026-05-26', '2026-05-25')
    expect(next.currentStreak).toBe(2)
    expect(next.maxStreak).toBe(2)
  })

  it('skipping a day restarts the streak at 1, not 2 (the core fix)', () => {
    // Won on day N (streak 1, last played 24th), skipped the 25th, win on the 26th.
    const prev = { ...base(), gamesPlayed: 1, gamesWon: 1, currentStreak: 1, maxStreak: 1, lastPlayedDate: '2026-05-24' }
    const next = computeNextStats(prev, 'won', 4, '2026-05-26', '2026-05-25')
    expect(next.currentStreak).toBe(1)
  })

  it('preserves maxStreak when the current streak resets', () => {
    const prev = { ...base(), gamesPlayed: 5, gamesWon: 5, currentStreak: 5, maxStreak: 5, lastPlayedDate: '2026-05-20' }
    const next = computeNextStats(prev, 'won', 1, '2026-05-26', '2026-05-25')
    expect(next.currentStreak).toBe(1)
    expect(next.maxStreak).toBe(5)
  })

  it('a loss resets the current streak to 0 and does not change guess distribution', () => {
    const prev = { ...base(), gamesPlayed: 2, gamesWon: 2, currentStreak: 2, maxStreak: 2, lastPlayedDate: '2026-05-25' }
    const next = computeNextStats(prev, 'lost', 6, '2026-05-26', '2026-05-25')
    expect(next.currentStreak).toBe(0)
    expect(next.gamesWon).toBe(2)
    expect(next.guessDistribution['6']).toBe(0)
  })

  it('is idempotent — recording twice for the same day is a no-op', () => {
    const prev = { ...base(), gamesPlayed: 1, gamesWon: 1, currentStreak: 1, lastPlayedDate: '2026-05-26' }
    const next = computeNextStats(prev, 'won', 1, '2026-05-26', '2026-05-25')
    expect(next).toBe(prev)
  })

  it('does not mutate the previous stats object', () => {
    const prev = base()
    const snapshot = JSON.stringify(prev)
    computeNextStats(prev, 'won', 3, '2026-05-26', '2026-05-25')
    expect(JSON.stringify(prev)).toBe(snapshot)
  })
})
