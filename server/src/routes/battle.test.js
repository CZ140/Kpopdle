import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import { createServer } from 'http'

// A mutable holder the hoisted vi.mock factory can read at call time.
const h = vi.hoisted(() => ({ upstreamUrl: '' }))

// Stand in for the real Deezer resolution: hand back a URL on our fake upstream.
vi.mock('../services/audioProvider.js', () => ({
  getPreviewUrl: vi.fn(async () => `${h.upstreamUrl}/preview`),
}))

const { default: battleRoutes } = await import('./battle.js')
const { matchManager } = await import('../realtime/manager.js')

const FAKE_MP3 = Buffer.from('ID3FAKEAUDIOBYTES_0123456789ABCDEF', 'utf8')

describe('battle audio proxy', () => {
  let upstream
  let server
  let baseUrl
  let match

  beforeAll(async () => {
    // Fake "Deezer" upstream that serves raw bytes.
    const up = express()
    up.get('/preview', (req, res) => {
      res.setHeader('Content-Type', 'audio/mpeg')
      res.end(FAKE_MP3)
    })
    upstream = createServer(up)
    await new Promise((r) => upstream.listen(0, r))
    h.upstreamUrl = `http://127.0.0.1:${upstream.address().port}`

    // The proxy route under test.
    const app = express()
    app.use('/api/battle', battleRoutes)
    server = createServer(app)
    await new Promise((r) => server.listen(0, r))
    baseUrl = `http://127.0.0.1:${server.address().port}`

    match = matchManager.createMatch({
      scope: 'twice',
      rounds: [
        {
          song: { id: 7, deezerId: 999111, title: 'SECRET ANSWER', deezerArtistName: 'TWICE', groupId: 'twice' },
          clipToken: 'opaque-token-abc',
        },
      ],
    })
  })

  afterAll(() => {
    server?.close()
    upstream?.close()
  })

  it('FR-17: serves audio via an opaque URL that leaks no song id, title, or Deezer host', async () => {
    const url = `${baseUrl}/api/battle/${match.id}/clip/opaque-token-abc`
    expect(url).not.toMatch(/999111|SECRET ANSWER|dzcdn|deezer/i)

    const res = await fetch(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('cache-control')).toContain('no-store')

    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(FAKE_MP3)).toBe(true)
    expect(body.toString()).not.toContain('SECRET ANSWER') // body is opaque audio, not metadata
  })

  it('honors range requests with 206 + Content-Range (iOS Safari needs this)', async () => {
    const res = await fetch(`${baseUrl}/api/battle/${match.id}/clip/opaque-token-abc`, {
      headers: { Range: 'bytes=0-4' },
    })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe(`bytes 0-4/${FAKE_MP3.length}`)
    expect(res.headers.get('content-length')).toBe('5')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(FAKE_MP3.subarray(0, 5))).toBe(true)
  })

  it('416s an unsatisfiable range', async () => {
    const res = await fetch(`${baseUrl}/api/battle/${match.id}/clip/opaque-token-abc`, {
      headers: { Range: `bytes=${FAKE_MP3.length + 10}-` },
    })
    expect(res.status).toBe(416)
  })

  it('404s an unknown clip token', async () => {
    const res = await fetch(`${baseUrl}/api/battle/${match.id}/clip/wrong-token`)
    expect(res.status).toBe(404)
  })

  it('404s an unknown match', async () => {
    const res = await fetch(`${baseUrl}/api/battle/nope/clip/opaque-token-abc`)
    expect(res.status).toBe(404)
  })
})
