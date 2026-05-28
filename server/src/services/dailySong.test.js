import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mocked before any import of dailySong.js so the module loads with fakes
vi.mock('../data/songIndex.js', () => ({
  getSongsForGroup: vi.fn(),
  getMergedPool: vi.fn(),
  getCoverAlbumPoolForGroup: vi.fn(),
}))

import { getSongForDate, getKpopdleSongForDate, getGuessGroupSongForDate, getCoverSongForDate, getCoverAlbumForDate } from './dailySong.js'
import { getSongsForGroup, getMergedPool, getCoverAlbumPoolForGroup } from '../data/songIndex.js'

// Each test song lands on its own album by default — flip `album` to share covers.
const makeSong = (id, hasPreview = true, hasCover = true, album = `Album ${id}`) => ({
  id,
  title: `Song ${id}`,
  album,
  releaseYear: 2020,
  deezerId: hasPreview ? id : 0,
  coverUrl: hasCover ? `https://cdn.example/cover/${id}.jpg` : null,
  spotifyId: null,
})

const CATALOG = Array.from({ length: 20 }, (_, i) => makeSong(i + 1))

// Mirror getCoverAlbumPoolForGroup's first-appearance dedupe so cover-album
// tests can drive it off the same catalog the song-level tests use.
function albumPoolFrom(songs) {
  const byKey = new Map()
  for (const s of songs.filter(x => x.deezerId && x.deezerId !== 0 && x.coverUrl)) {
    const key = s.album.toLowerCase()
    if (byKey.has(key)) {
      byKey.get(key).songs.push({ id: s.id, title: s.title })
      continue
    }
    byKey.set(key, {
      album: s.album,
      releaseYear: s.releaseYear,
      coverUrl: s.coverUrl,
      songs: [{ id: s.id, title: s.title }],
    })
  }
  return [...byKey.values()]
}

beforeEach(() => {
  getSongsForGroup.mockReturnValue(CATALOG)
  getMergedPool.mockReturnValue(CATALOG)
  getCoverAlbumPoolForGroup.mockReturnValue(albumPoolFrom(CATALOG))
})

describe('getSongForDate — determinism', () => {
  it('returns the same song every time for the same group and date', () => {
    const a = getSongForDate('twice', '2026-05-21')
    const b = getSongForDate('twice', '2026-05-21')
    expect(a.song.id).toBe(b.song.id)
    expect(a.gameNumber).toBe(b.gameNumber)
  })

  it('returns the same date string that was passed in', () => {
    const { dateString } = getSongForDate('twice', '2026-03-15')
    expect(dateString).toBe('2026-03-15')
  })

  it('uses different HMAC secrets per group — same date yields different songs across groups', () => {
    const date = '2026-05-21'
    const groups = ['twice', 'newjeans', 'aespa', 'redvelvet', 'ive', 'blackpink']
    const chosen = groups.map(g => getSongForDate(g, date).song.id)
    // With independent secrets, at least some groups will land on different songs
    const unique = new Set(chosen)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('distributes across different songs over many consecutive dates', () => {
    const songs = new Set()
    for (let day = 1; day <= 60; day++) {
      const date = `2026-${String(Math.ceil(day / 30)).padStart(2, '0')}-${String((day % 30) || 30).padStart(2, '0')}`
      try {
        songs.add(getSongForDate('twice', date).song.id)
      } catch { /* skip invalid date combinations */ }
    }
    // Over many dates, more than one unique song should be selected
    expect(songs.size).toBeGreaterThan(1)
  })
})

describe('getSongForDate — deezerId filtering', () => {
  it('never selects a song with deezerId = 0', () => {
    const mixed = [
      makeSong(1, false), // deezerId = 0, should never be picked
      ...Array.from({ length: 10 }, (_, i) => makeSong(i + 2, true)),
    ]
    getSongsForGroup.mockReturnValue(mixed)

    for (let d = 1; d <= 30; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      const { song } = getSongForDate('twice', date)
      expect(song.id).not.toBe(1)
    }
  })

  it('never selects a song with deezerId = null', () => {
    const mixed = [
      { ...makeSong(1), deezerId: null },
      ...Array.from({ length: 10 }, (_, i) => makeSong(i + 2, true)),
    ]
    getSongsForGroup.mockReturnValue(mixed)

    for (let d = 1; d <= 30; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      const { song } = getSongForDate('twice', date)
      expect(song.id).not.toBe(1)
    }
  })

  it('throws when all songs lack a valid deezerId', () => {
    getSongsForGroup.mockReturnValue([makeSong(1, false), makeSong(2, false)])
    expect(() => getSongForDate('twice', '2026-05-21')).toThrow()
  })
})

describe('getSongForDate — game number', () => {
  it('returns gameNumber = 1 for the launch date (2026-02-20)', () => {
    const { gameNumber } = getSongForDate('twice', '2026-02-20')
    expect(gameNumber).toBe(1)
  })

  it('returns gameNumber = 2 for the day after launch', () => {
    const { gameNumber } = getSongForDate('twice', '2026-02-21')
    expect(gameNumber).toBe(2)
  })

  it('increments by 1 for each successive day', () => {
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03']
    const numbers = dates.map(d => getSongForDate('twice', d).gameNumber)
    expect(numbers[1] - numbers[0]).toBe(1)
    expect(numbers[2] - numbers[1]).toBe(1)
  })
})

describe('getCoverSongForDate — determinism & independence', () => {
  it('returns the same cover song every time for the same group and date', () => {
    const a = getCoverSongForDate('twice', '2026-05-21')
    const b = getCoverSongForDate('twice', '2026-05-21')
    expect(a.song.id).toBe(b.song.id)
    expect(a.gameNumber).toBe(b.gameNumber)
  })

  it('returns the date string that was passed in', () => {
    const { dateString } = getCoverSongForDate('twice', '2026-03-15')
    expect(dateString).toBe('2026-03-15')
  })

  it('selects independently from the audio daily — uses the -cover HMAC suffix', () => {
    // Over many dates the cover pick should diverge from the audio pick on at
    // least some days (different secrets → different distributions). Identical
    // sequences would mean the -cover suffix was not applied.
    let divergences = 0
    for (let d = 1; d <= 28; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      const audio = getSongForDate('twice', date).song.id
      const cover = getCoverSongForDate('twice', date).song.id
      if (audio !== cover) divergences++
    }
    expect(divergences).toBeGreaterThan(0)
  })

  it('uses different secrets per group — same date can yield different cover songs', () => {
    const date = '2026-05-21'
    const groups = ['twice', 'newjeans', 'aespa', 'redvelvet', 'ive', 'blackpink']
    const chosen = groups.map(g => getCoverSongForDate(g, date).song.id)
    expect(new Set(chosen).size).toBeGreaterThan(1)
  })

  it('only selects songs that have a coverUrl (FR-8)', () => {
    const mixed = [
      makeSong(1, true, false), // no coverUrl — never selectable
      ...Array.from({ length: 10 }, (_, i) => makeSong(i + 2, true, true)),
    ]
    getSongsForGroup.mockReturnValue(mixed)

    for (let d = 1; d <= 30; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      const { song } = getCoverSongForDate('twice', date)
      expect(song.id).not.toBe(1)
      expect(song.coverUrl).toBeTruthy()
    }
  })

  it('never selects a song with deezerId = 0 even if it has a cover', () => {
    const mixed = [
      makeSong(1, false, true), // playable cover requires a deezerId too
      ...Array.from({ length: 10 }, (_, i) => makeSong(i + 2, true, true)),
    ]
    getSongsForGroup.mockReturnValue(mixed)

    for (let d = 1; d <= 30; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      const { song } = getCoverSongForDate('twice', date)
      expect(song.id).not.toBe(1)
    }
  })

  it('throws when no songs have a cover', () => {
    getSongsForGroup.mockReturnValue([makeSong(1, true, false), makeSong(2, true, false)])
    expect(() => getCoverSongForDate('twice', '2026-05-21')).toThrow()
  })

  it('cover gameNumber matches the audio daily numbering (same launch math)', () => {
    expect(getCoverSongForDate('twice', '2026-02-20').gameNumber).toBe(1)
    expect(getCoverSongForDate('twice', '2026-02-21').gameNumber).toBe(2)
  })
})

describe('getCoverAlbumForDate — album-as-answer dailies', () => {
  it('returns the same album every time for the same group and date', () => {
    const a = getCoverAlbumForDate('twice', '2026-05-21')
    const b = getCoverAlbumForDate('twice', '2026-05-21')
    expect(a.album.album).toBe(b.album.album)
    expect(a.gameNumber).toBe(b.gameNumber)
  })

  it('passes through the date string', () => {
    const { dateString } = getCoverAlbumForDate('twice', '2026-03-15')
    expect(dateString).toBe('2026-03-15')
  })

  it('throws when the album pool is empty', () => {
    getCoverAlbumPoolForGroup.mockReturnValue([])
    expect(() => getCoverAlbumForDate('twice', '2026-05-21')).toThrow(/No songs with album covers/)
  })

  it('dedupes songs that share an album — pool size shrinks accordingly', () => {
    // Five tracks on one EP + one standalone single → 2 unique albums.
    const ep = Array.from({ length: 5 }, (_, i) => makeSong(i + 1, true, true, 'Get Up'))
    const single = makeSong(99, true, true, 'Ditto')
    const pool = albumPoolFrom([...ep, single])
    expect(pool.length).toBe(2)
    expect(pool.find(a => a.album === 'Get Up').songs.length).toBe(5)
    expect(pool.find(a => a.album === 'Ditto').songs.length).toBe(1)

    // And the daily picker indexes that 2-album space — never landing on a
    // duplicate EP entry, which was the core bug.
    getCoverAlbumPoolForGroup.mockReturnValue(pool)
    const albums = new Set()
    for (let d = 1; d <= 14; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      albums.add(getCoverAlbumForDate('twice', date).album.album)
    }
    expect(albums.size).toBeLessThanOrEqual(2)
    // All picks must be a real album in the pool
    for (const a of albums) {
      expect(['Get Up', 'Ditto']).toContain(a)
    }
  })

  it('selects independently across groups (per-group HMAC secret)', () => {
    const date = '2026-05-21'
    const groups = ['twice', 'newjeans', 'aespa', 'redvelvet', 'ive', 'blackpink']
    const chosen = groups.map(g => getCoverAlbumForDate(g, date).album.album)
    expect(new Set(chosen).size).toBeGreaterThan(1)
  })

  it('cover gameNumber matches the audio daily numbering', () => {
    expect(getCoverAlbumForDate('twice', '2026-02-20').gameNumber).toBe(1)
    expect(getCoverAlbumForDate('twice', '2026-02-21').gameNumber).toBe(2)
  })
})

describe('getKpopdleSongForDate', () => {
  it('is deterministic for the same date', () => {
    const a = getKpopdleSongForDate([], '2026-05-21')
    const b = getKpopdleSongForDate([], '2026-05-21')
    expect(a.song.id).toBe(b.song.id)
  })

  it('returns a poolSize equal to the mock pool length', () => {
    const { poolSize } = getKpopdleSongForDate([], '2026-05-21')
    expect(poolSize).toBe(CATALOG.length)
  })

  it('throws when the pool is empty', () => {
    getMergedPool.mockReturnValue([])
    expect(() => getKpopdleSongForDate([], '2026-05-21')).toThrow()
  })

  it('K-POPDLE gameNumber starts at 1 on its launch date (2026-05-21)', () => {
    const { gameNumber } = getKpopdleSongForDate([], '2026-05-21')
    expect(gameNumber).toBe(1)
  })
})

describe('getGuessGroupSongForDate', () => {
  it('is deterministic for the same date', () => {
    const a = getGuessGroupSongForDate([], '2026-05-27')
    const b = getGuessGroupSongForDate([], '2026-05-27')
    expect(a.song.id).toBe(b.song.id)
  })

  it('returns a poolSize equal to the mock pool length', () => {
    const { poolSize } = getGuessGroupSongForDate([], '2026-05-27')
    expect(poolSize).toBe(CATALOG.length)
  })

  it('throws when the pool is empty', () => {
    getMergedPool.mockReturnValue([])
    expect(() => getGuessGroupSongForDate([], '2026-05-27')).toThrow()
  })

  it('gameNumber starts at 1 on its launch date (2026-05-27)', () => {
    const { gameNumber } = getGuessGroupSongForDate([], '2026-05-27')
    expect(gameNumber).toBe(1)
  })

  it('uses a distinct salt from K-POPDLE — picks diverge across many dates', () => {
    // Same pool, same dates: a shared salt would make every pick identical.
    // The distinct `-guessgroup` salt must produce a different sequence.
    let diverged = 0
    for (let d = 1; d <= 28; d++) {
      const date = `2026-05-${String(d).padStart(2, '0')}`
      const kpop = getKpopdleSongForDate([], date).song.id
      const gtg = getGuessGroupSongForDate([], date).song.id
      if (kpop !== gtg) diverged++
    }
    // With a 20-song pool and independent HMACs, the vast majority of days differ.
    expect(diverged).toBeGreaterThan(20)
  })
})
