import { describe, it, expect } from 'vitest'
import { getMergedPool } from './songIndex.js'

// Uses the real committed song catalogs (integration-level).
const GROUPS = [
  { id: 'twice', displayName: 'TWICE', deezerArtistName: 'TWICE' },
  { id: 'aespa', displayName: 'aespa', deezerArtistName: 'aespa' },
]

describe('getMergedPool', () => {
  it('memoizes — same group set returns the identical array reference', () => {
    const first = getMergedPool(GROUPS)
    const second = getMergedPool(GROUPS)
    expect(second).toBe(first)
  })

  it('cache key is order-independent (sorted internally)', () => {
    const a = getMergedPool(GROUPS)
    const b = getMergedPool([...GROUPS].reverse())
    expect(b).toBe(a)
  })

  it('builds a non-empty pool with each song tagged by group', () => {
    const pool = getMergedPool(GROUPS)
    expect(pool.length).toBeGreaterThan(0)
    expect(pool[0]).toHaveProperty('groupId')
    expect(pool[0]).toHaveProperty('groupDisplayName')
  })

  it('only includes songs with a valid Deezer id', () => {
    const pool = getMergedPool(GROUPS)
    expect(pool.every(s => s.deezerId && s.deezerId !== 0)).toBe(true)
  })
})
