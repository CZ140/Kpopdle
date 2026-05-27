import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the rate limiter to a pass-through so the record handler runs directly.
vi.mock('express-rate-limit', () => ({
  rateLimit: () => (req, res, next) => next(),
}))
vi.mock('../services/statsDb.js', () => ({
  recordGame: vi.fn(),
  getSongDifficulty: vi.fn(),
  getConfusion: vi.fn(),
  getSummary: vi.fn(),
}))
vi.mock('../services/observability.js', () => ({
  captureError: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn() },
}))

import router from './stats.js'
import { recordGame } from '../services/statsDb.js'

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
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

const recordHandler = findHandler('post', '/record')

const base = { songId: 1, songTitle: 'Some Song', guessCount: 1, won: true }

beforeEach(() => vi.clearAllMocks())

describe('POST /record — group validation', () => {
  it('accepts a real group id', () => {
    const res = mockRes()
    recordHandler({ body: { ...base, groupId: 'twice' } }, res)
    expect(res.statusCode).toBe(200)
    expect(recordGame).toHaveBeenCalled()
  })

  it('accepts a Coverdle `${group}-cover` key', () => {
    const res = mockRes()
    recordHandler({ body: { ...base, groupId: 'twice-cover' } }, res)
    expect(res.statusCode).toBe(200)
  })

  it('accepts the cross-group guess-the-group mode key', () => {
    const res = mockRes()
    recordHandler({ body: { ...base, groupId: 'guess-the-group' } }, res)
    expect(res.statusCode).toBe(200)
    expect(recordGame).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'guess-the-group' }))
  })

  it('accepts the kpopdle cross-group mode key', () => {
    const res = mockRes()
    recordHandler({ body: { ...base, groupId: 'kpopdle' } }, res)
    expect(res.statusCode).toBe(200)
  })

  it('rejects an unknown group id with 400', () => {
    const res = mockRes()
    recordHandler({ body: { ...base, groupId: 'not-a-group' } }, res)
    expect(res.statusCode).toBe(400)
    expect(recordGame).not.toHaveBeenCalled()
  })

  it('rejects a bogus `-cover` key for an unknown base group', () => {
    const res = mockRes()
    recordHandler({ body: { ...base, groupId: 'nope-cover' } }, res)
    expect(res.statusCode).toBe(400)
  })
})
