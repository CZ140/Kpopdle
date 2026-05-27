import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the data/service layer so the route logic is tested in isolation.
vi.mock('../services/dailySong.js', () => ({
  getGuessGroupSongForDate: vi.fn(),
}))
vi.mock('../services/audioProvider.js', () => ({
  getPreviewUrl: vi.fn().mockResolvedValue('https://cdn.example/preview.mp3'),
}))
vi.mock('../services/statsDb.js', () => ({
  getCommunityStats: vi.fn().mockReturnValue(null),
}))
vi.mock('../services/observability.js', () => ({
  captureError: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn() },
}))

import router from './guessTheGroup.js'
import { getGuessGroupSongForDate } from '../services/dailySong.js'
import { getKSTDateString } from '../utils/dateUtils.js'

const SONG = {
  id: 7,
  title: 'Fancy',
  album: 'Fancy You',
  releaseYear: 2019,
  spotifyId: 'abc',
  groupId: 'twice',
  groupDisplayName: 'TWICE',
  deezerArtistName: 'TWICE',
}

beforeEach(() => {
  getGuessGroupSongForDate.mockReturnValue({ song: SONG, poolSize: 100, dateString: '2026-05-27', gameNumber: 1 })
})

// Pull a route handler out of the Express router stack by method + path.
function findHandler(method, path) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      // Last handler in the stack is the actual route callback.
      const stack = layer.route.stack
      return stack[stack.length - 1].handle
    }
  }
  throw new Error(`Handler not found: ${method.toUpperCase()} ${path}`)
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
    set(k, v) { this.headers[k] = v; return this },
  }
  return res
}

const guessHandler = findHandler('post', '/game/guess')
const groupsListHandler = findHandler('get', '/groups-list')
const todayHandler = findHandler('get', '/game/today')

describe('GET /game/today — hints are spoiler-free', () => {
  it('exposes only the year hint (no era/album or firstLetter — those reveal the group)', async () => {
    const res = mockRes()
    await todayHandler({}, res)
    expect(res.body.hints).toEqual({ year: 2019 })
    // The album name uniquely identifies the group, so it must never be sent.
    expect(JSON.stringify(res.body)).not.toContain('Fancy You')
    expect(res.body.hints.era).toBeUndefined()
    expect(res.body.hints.firstLetter).toBeUndefined()
  })
})

describe('POST /game/guess — matching', () => {
  it('returns correct=true for an exact group-name match', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: 'TWICE' } }, res)
    expect(res.body.correct).toBe(true)
    expect(res.body.gameOver).toBe(true)
  })

  it('is case-insensitive', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: 'twice' } }, res)
    expect(res.body.correct).toBe(true)
  })

  it('trims surrounding whitespace before matching', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: '  TWICE  ' } }, res)
    expect(res.body.correct).toBe(true)
  })

  it('returns correct=false for a wrong group', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: 'aespa' } }, res)
    expect(res.body.correct).toBe(false)
    expect(res.body.gameOver).toBe(false)
  })
})

describe('POST /game/guess — answer is withheld until game over', () => {
  it('does NOT leak the song or group on a wrong guess', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: 'aespa' } }, res)
    expect(res.body.song).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('TWICE')
    expect(JSON.stringify(res.body)).not.toContain('Fancy')
  })

  it('reveals song title AND group on a correct guess', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: 'TWICE' } }, res)
    expect(res.body.song.songTitle).toBe('Fancy')
    expect(res.body.song.groupDisplayName).toBe('TWICE')
    expect(res.body.song.releaseYear).toBe(2019)
  })

  it('reveals the answer on an empty guess (final-attempt loss)', async () => {
    const res = mockRes()
    await guessHandler({ body: { gameDate: '2026-05-27', guess: '' } }, res)
    expect(res.body.correct).toBe(false)
    expect(res.body.gameOver).toBe(true)
    expect(res.body.song.groupDisplayName).toBe('TWICE')
  })
})

describe('POST /game/guess — validation', () => {
  it('rejects a missing gameDate', async () => {
    const res = mockRes()
    await guessHandler({ body: { guess: 'TWICE' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects a future game date', async () => {
    const res = mockRes()
    const future = '2999-01-01'
    await guessHandler({ body: { gameDate: future, guess: 'TWICE' } }, res)
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /groups-list', () => {
  it('returns the active group display names (not song titles)', () => {
    const res = mockRes()
    groupsListHandler({}, res)
    expect(Array.isArray(res.body.songs)).toBe(true)
    expect(res.body.songs).toContain('TWICE')
    expect(res.body.songs).toContain('LE SSERAFIM')
    // No song titles in the list.
    expect(res.body.songs).not.toContain('Fancy')
  })
})

// Sanity: today's KST date is a string the route accepts.
describe('getKSTDateString', () => {
  it('produces a YYYY-MM-DD string', () => {
    expect(getKSTDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
