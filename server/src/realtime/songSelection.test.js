import { describe, it, expect } from 'vitest'
import { poolForScope, selectRounds } from './songSelection.js'

describe('songSelection', () => {
  it('every song in a scope pool is playable (has a real deezerId)', () => {
    for (const scope of ['all', 'twice']) {
      const pool = poolForScope(scope)
      expect(pool.length).toBeGreaterThan(0)
      expect(pool.every((s) => s.deezerId && s.deezerId !== 0)).toBe(true)
    }
  })

  it('enriches group-scoped songs with the fields the proxy/reveal need', () => {
    const [song] = poolForScope('twice')
    expect(song.groupId).toBe('twice')
    expect(song.deezerArtistName).toBeTruthy()
    expect(song.groupDisplayName).toBeTruthy()
  })

  it('does not mutate the memoized merged pool', () => {
    const a = poolForScope('all')
    const before = a.length
    selectRounds('all', 5) // shuffles internally
    expect(poolForScope('all').length).toBe(before)
  })

  it('selects N distinct songs each with a unique opaque clip token', () => {
    const rounds = selectRounds('all', 5)
    expect(rounds).toHaveLength(5)
    const songIds = new Set(rounds.map((r) => r.song.id + ':' + r.song.groupId))
    expect(songIds.size).toBe(5) // no in-match repeats
    const tokens = new Set(rounds.map((r) => r.clipToken))
    expect(tokens.size).toBe(5)
    expect(rounds.every((r) => /^[A-Za-z0-9_-]+$/.test(r.clipToken))).toBe(true)
  })

  it('caps the count at the pool size for small scopes', () => {
    const pool = poolForScope('twice')
    const rounds = selectRounds('twice', pool.length + 50)
    expect(rounds).toHaveLength(pool.length)
  })

  it('throws on an unknown scope', () => {
    expect(() => poolForScope('not-a-group')).toThrow()
  })
})
