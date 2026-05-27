import { describe, it, expect, vi, afterEach } from 'vitest'
import { getGameNumber, getKSTDateString } from './dateUtils.js'

describe('getKSTDateString', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rolls to the next calendar day once it is past 15:00 UTC (= midnight KST)', () => {
    vi.useFakeTimers()
    // 23:30 UTC on the 26th is 08:30 KST on the 27th
    vi.setSystemTime(new Date('2026-05-26T23:30:00Z'))
    expect(getKSTDateString()).toBe('2026-05-27')
  })

  it('still reports the UTC day before 15:00 UTC', () => {
    vi.useFakeTimers()
    // 02:00 UTC on the 26th is 11:00 KST on the 26th
    vi.setSystemTime(new Date('2026-05-26T02:00:00Z'))
    expect(getKSTDateString()).toBe('2026-05-26')
  })

  it('crosses the KST midnight boundary at exactly 15:00 UTC', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T14:59:59Z'))
    expect(getKSTDateString()).toBe('2026-05-26')
    vi.setSystemTime(new Date('2026-05-26T15:00:00Z'))
    expect(getKSTDateString()).toBe('2026-05-27')
  })
})

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
