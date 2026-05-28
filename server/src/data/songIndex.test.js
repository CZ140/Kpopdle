import { describe, it, expect } from 'vitest'
import { getMergedPool, getCoverAlbumPoolForGroup, getCoverPoolForGroup } from './songIndex.js'

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

describe('getCoverAlbumPoolForGroup', () => {
  it('returns at least one album for a populated group', () => {
    const albums = getCoverAlbumPoolForGroup('twice')
    expect(albums.length).toBeGreaterThan(0)
    expect(albums[0]).toHaveProperty('album')
    expect(albums[0]).toHaveProperty('coverUrl')
    expect(albums[0]).toHaveProperty('songs')
  })

  it('dedupes songs that share an album — pool is strictly smaller than the song pool whenever any album has 2+ tracks', () => {
    // newjeans is the canonical multi-track-per-album case (Get Up has 5 tracks
    // sharing the EP cover) — verifies the dedupe actually fires on real data.
    const songs = getCoverPoolForGroup('newjeans')
    const albums = getCoverAlbumPoolForGroup('newjeans')
    expect(albums.length).toBeLessThan(songs.length)

    // No duplicate album names in the deduped pool
    const names = albums.map(a => a.album.toLowerCase())
    expect(new Set(names).size).toBe(names.length)

    // And the songs the dedupe folded together are recorded on the album entry
    const totalTracks = albums.reduce((n, a) => n + a.songs.length, 0)
    expect(totalTracks).toBe(songs.length)
  })

  it('memoizes per group — same call returns the identical array reference', () => {
    const a = getCoverAlbumPoolForGroup('twice')
    const b = getCoverAlbumPoolForGroup('twice')
    expect(b).toBe(a)
  })
})
