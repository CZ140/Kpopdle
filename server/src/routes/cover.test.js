import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the data/service layer so the route logic is tested in isolation.
vi.mock('../services/dailySong.js', () => ({
  getTodaysCoverSong: vi.fn(),
  getCoverSongForDate: vi.fn(),
}))
vi.mock('../data/songIndex.js', () => ({
  getCoverPoolForGroup: vi.fn().mockReturnValue([]),
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
import { getTodaysCoverSong, getCoverSongForDate } from '../services/dailySong.js'
import { getCoverPoolForGroup } from '../data/songIndex.js'
import { captureError } from '../services/observability.js'

const SONG = { id: 3, title: 'Feel Special', album: 'Feel Special', releaseYear: 2019, spotifyId: 'x', coverUrl: 'https://cdn/x.jpg' }

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

beforeEach(() => {
  vi.clearAllMocks()
  getCoverPoolForGroup.mockReturnValue([SONG])
})

describe('GET /today — no covers backfilled', () => {
  it('returns a clean 404 (not 500) when the group has no playable covers', () => {
    getTodaysCoverSong.mockImplementation(() => {
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
    getTodaysCoverSong.mockReturnValue({ song: SONG, dateString: '2026-05-27', gameNumber: 1 })
    const res = mockRes()
    todayHandler({ params: { group: 'twice' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.coverUrl).toBe(SONG.coverUrl)
  })

  it('still reports genuine failures as 500', () => {
    getTodaysCoverSong.mockImplementation(() => {
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
    getCoverSongForDate.mockImplementation(() => {
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
  it('returns 404 when the cover pool is empty', () => {
    getCoverPoolForGroup.mockReturnValue([])
    const res = mockRes()
    practiceHandler({ params: { group: 'aespa' } }, res)
    expect(res.statusCode).toBe(404)
    expect(res.body.error).toMatch(/no album covers/i)
  })
})
