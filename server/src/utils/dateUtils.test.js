import { describe, it, expect } from 'vitest'
import { getGameNumber } from './dateUtils.js'

describe('getGameNumber', () => {
  it('returns 1 for the launch date', () => {
    expect(getGameNumber('2026-02-20')).toBe(1)
  })

  it('returns 2 for the day after launch', () => {
    expect(getGameNumber('2026-02-21')).toBe(2)
  })

  it('returns 10 for 9 days after launch', () => {
    expect(getGameNumber('2026-03-01')).toBe(10)
  })

  it('increments by exactly 1 per day', () => {
    const n1 = getGameNumber('2026-04-01')
    const n2 = getGameNumber('2026-04-02')
    expect(n2 - n1).toBe(1)
  })
})
