import { describe, it, expect } from 'vitest'
import { scoreGuess } from './scoring.js'

describe('scoreGuess (GD-5 tiers)', () => {
  it('awards by speed bucket', () => {
    expect(scoreGuess(0)).toBe(5)
    expect(scoreGuess(3000)).toBe(5)
    expect(scoreGuess(3001)).toBe(4)
    expect(scoreGuess(8000)).toBe(4)
    expect(scoreGuess(8001)).toBe(3)
    expect(scoreGuess(15000)).toBe(3)
    expect(scoreGuess(15001)).toBe(2)
    expect(scoreGuess(25000)).toBe(2)
    expect(scoreGuess(25001)).toBe(1)
    expect(scoreGuess(30000)).toBe(1)
  })

  it('scores 0 past the window or for negatives', () => {
    expect(scoreGuess(30001)).toBe(0)
    expect(scoreGuess(-50)).toBe(0)
  })

  it('never lets a later correct guess outscore an earlier one', () => {
    let prev = 6
    for (let ms = 0; ms <= 30000; ms += 500) {
      const s = scoreGuess(ms)
      expect(s).toBeLessThanOrEqual(prev)
      prev = s
    }
  })
})
