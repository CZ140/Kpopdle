import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the data/service layer so the route logic is tested in isolation.
vi.mock('../services/dailySong.js', () => ({
  getTodaysCoverAlbum: vi.fn(),
  getCoverAlbumForDate: vi.fn(),
}))
vi.mock('../data/songIndex.js', () => ({
  getCoverAlbumPoolForGroup: vi.fn().mockReturnValue([]),
}))
vi.mock('../middleware/validateGroup.js', () => ({
  default: (req, res, next) => next(),
}))
vi.mock('../services/statsDb.js', () => ({
  getCommunityStats: vi.fn().mockReturnValue(null),
}))
vi.mock('../services/observability.js', () => ({
  captureError: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn() },
}))

import router from './cover.js'
import { getTodaysCoverAlbum, getCoverAlbumForDate } from '../services/dailySong.js'
import { getCoverAlbumPoolForGroup } from '../data/songIndex.js'
import { captureError } from '../services/observability.js'

const ALBUM = {
  album: 'Feel Special',
  releaseYear: 2019,
  coverUrl: 'https://cdn/x.jpg',
  songs: [{ id: 3, title: 'Feel Special' }, { id: 4, title: 'Rainbow' }],
}

// Pull a route handler out of the Express router stack by method + path.
function findHandler(method, path) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      const stack = layer.route.stack
      return stack[stack.length - 1].handle
    }
  }
  throw new Error(`Handler not found: ${method.toUpperCase()} ${path}`)
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
    set(k, v) { this.headers[k] = v; return this },
  }
}

const todayHandler = findHandler('get', '/today')
const archiveHandler = findHandler('get', '/archive/:date')
const practiceHandler = findHandler('get', '/practice')
const albumsListHandler = findHandler('get', '/albums-list')
const guessHandler = findHandler('post', '/guess')

beforeEach(() => {
  vi.clearAllMocks()
  getCoverAlbumPoolForGroup.mockReturnValue([ALBUM])
})

describe('GET /today — no covers backfilled', () => {
  it('returns a clean 404 (not 500) when the group has no playable covers', () => {
    getTodaysCoverAlbum.mockImplementation(() => {
      throw new Error('No songs with album covers available for group: aespa')
    })
    const res = mockRes()
    todayHandler({ params: { group: 'aespa' } }, res)
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toMatch(/no album covers/i)
    // A "not provisioned" state should not be reported as an error.
    expect(captureError).not.toHaveBeenCalled()
  })

  it('serves the cover when one exists', () => {
    getTodaysCoverAlbum.mockReturnValue({ album: ALBUM, dateString: '2026-05-27', gameNumber: 1 })
    const res = mockRes()
    todayHandler({ params: { group: 'twice' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.coverUrl).toBe(ALBUM.coverUrl)
    // Hints reflect the new album-mode shape — no `era` (would leak the answer)
    expect(res.body.hints).toEqual({
      year: 2019,
      trackCount: 2,
      firstLetter: 'F',
    })
  })

  it('still reports genuine failures as 500', () => {
    getTodaysCoverAlbum.mockImplementation(() => {
      throw new Error('database is locked')
    })
    const res = mockRes()
    todayHandler({ params: { group: 'twice' } }, res)
    expect(res.statusCode).toBe(500)
    expect(captureError).toHaveBeenCalled()
  })
})

describe('GET /archive/:date — no covers backfilled', () => {
  it('returns 404 when the group has no playable covers', () => {
    getCoverAlbumForDate.mockImplementation(() => {
      throw new Error('No songs with album covers available for group: aespa')
    })
    const res = mockRes()
    archiveHandler(
      { params: { group: 'aespa', date: '2026-05-01' }, groupConfig: { launchDate: '2026-01-01' } },
      res,
    )
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toMatch(/no album covers/i)
    expect(captureError).not.toHaveBeenCalled()
  })
})

describe('GET /practice — no covers backfilled', () => {
  it('returns 404 when the album pool is empty', () => {
    getCoverAlbumPoolForGroup.mockReturnValue([])
    const res = mockRes()
    practiceHandler({ params: { group: 'aespa' } }, res)
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toMatch(/no album covers/i)
  })

  it('returns a practiceAlbumIndex the guess endpoint can echo back', () => {
    getCoverAlbumPoolForGroup.mockReturnValue([ALBUM])
    const res = mockRes()
    practiceHandler({ params: { group: 'twice' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.coverUrl).toBe(ALBUM.coverUrl)
    expect(typeof res.body.practiceAlbumIndex).toBe('number')
  })
})

describe('GET /albums-list', () => {
  it('returns deduped album names under the `songs` key (same shape as /:group/songs)', () => {
    getCoverAlbumPoolForGroup.mockReturnValue([
      ALBUM,
      { album: 'Eyes wide open', releaseYear: 2020, coverUrl: '', songs: [{ id: 1, title: 'I Can\'t Stop Me' }] },
    ])
    const res = mockRes()
    albumsListHandler({ params: { group: 'twice' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ songs: ['Feel Special', 'Eyes wide open'] })
  })
})

describe('POST /guess — album-matching', () => {
  it('marks the guess correct when it matches the album name (case-insensitive)', () => {
    getCoverAlbumForDate.mockReturnValue({ album: ALBUM, dateString: '2026-05-27', gameNumber: 1 })
    const res = mockRes()
    guessHandler({ params: { group: 'twice' }, body: { gameDate: '2026-05-27', guess: 'feel SPECIAL' } }, res)
    expect(res.body.correct).toBe(true)
    expect(res.body.gameOver).toBe(true)
    expect(res.body.album.album).toBe('Feel Special')
    expect(res.body.album.tracks).toContain('Feel Special')
  })

  it('marks a song-on-the-album guess as wrong (the answer space is albums)', () => {
    getCoverAlbumForDate.mockReturnValue({ album: ALBUM, dateString: '2026-05-27', gameNumber: 1 })
    const res = mockRes()
    // "Rainbow" is a track on the Feel Special album — but the answer is the album,
    // not the track. This is the exact bug we're fixing.
    guessHandler({ params: { group: 'twice' }, body: { gameDate: '2026-05-27', guess: 'Rainbow' } }, res)
    expect(res.body.correct).toBe(false)
    expect(res.body.gameOver).toBe(false)
    // No reveal on wrong guesses
    expect(res.body.album).toBeUndefined()
  })

  it('reveals the album when the player runs out of guesses (empty guess)', () => {
    getCoverAlbumForDate.mockReturnValue({ album: ALBUM, dateString: '2026-05-27', gameNumber: 1 })
    const res = mockRes()
    guessHandler({ params: { group: 'twice' }, body: { gameDate: '2026-05-27', guess: '' } }, res)
    expect(res.body.gameOver).toBe(true)
    expect(res.body.album.album).toBe('Feel Special')
  })

  it('validates practice mode against practiceAlbumIndex', () => {
    getCoverAlbumPoolForGroup.mockReturnValue([ALBUM])
    const res = mockRes()
    guessHandler(
      { params: { group: 'twice' }, body: { gameDate: 'practice', practiceAlbumIndex: 0, guess: 'Feel Special' } },
      res,
    )
    expect(res.body.correct).toBe(true)
    expect(res.body.album.album).toBe('Feel Special')
  })

  it('rejects practice mode without a numeric practiceAlbumIndex', () => {
    const res = mockRes()
    guessHandler(
      { params: { group: 'twice' }, body: { gameDate: 'practice', guess: 'whatever' } },
      res,
    )
    expect(res.statusCode).toBe(400)
  })
})
