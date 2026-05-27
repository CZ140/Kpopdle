import { describe, it, expect } from 'vitest'
import { buildChallengeUrl, parseChallenge, challengeVerdict } from './share'

// Pull the `c` value out of a built URL so we can round-trip it through parse.
function extractC(url) {
  return new URLSearchParams(url.split('?')[1]).get('c')
}

describe('buildChallengeUrl', () => {
  it('builds a root-relative /group?d=&c= link', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: 'Chris', attempts: 3, won: true })
    expect(url.startsWith('/twice?d=2026-05-27&c=')).toBe(true)
  })

  it('produces a url-safe payload (no +, /, or = chars)', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: 'Aàéîõü 한국어', attempts: 6, won: true, hintsUsed: 3 })
    const c = extractC(url)
    expect(c).not.toMatch(/[+/=]/)
  })

  it('encodes a loss as attempts 0', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: 'A', attempts: 6, won: false })
    const decoded = parseChallenge(extractC(url))
    expect(decoded.won).toBe(false)
    expect(decoded.attempts).toBe(0)
  })

  it('keeps the payload short', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: 'Chris', attempts: 3, won: true, hintsUsed: 0 })
    expect(extractC(url).length).toBeLessThan(60)
  })
})

describe('buildChallengeUrl + parseChallenge round-trip', () => {
  it('round-trips a winning result with a name', () => {
    const url = buildChallengeUrl({ group: 'newjeans', gameDate: '2026-05-26', name: 'Chris', attempts: 3, won: true, hintsUsed: 1 })
    const decoded = parseChallenge(extractC(url))
    expect(decoded).toEqual({ name: 'Chris', attempts: 3, won: true, hintsUsed: 1 })
  })

  it('round-trips a loss with no name', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', attempts: 6, won: false })
    const decoded = parseChallenge(extractC(url))
    expect(decoded).toEqual({ name: '', attempts: 0, won: false, hintsUsed: 0 })
  })

  it('round-trips a unicode name', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: '나연', attempts: 2, won: true })
    const decoded = parseChallenge(extractC(url))
    expect(decoded.name).toBe('나연')
  })

  it('truncates names to 20 chars before encoding', () => {
    const long = 'x'.repeat(50)
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: long, attempts: 1, won: true })
    const decoded = parseChallenge(extractC(url))
    expect(decoded.name.length).toBe(20)
  })

  it('round-trips via URLSearchParams (how GroupPage reads it)', () => {
    const url = buildChallengeUrl({ group: 'twice', gameDate: '2026-05-27', name: 'A', attempts: 4, won: true })
    const params = new URLSearchParams(url.split('?')[1])
    const decoded = parseChallenge(params)
    expect(decoded).toEqual({ name: 'A', attempts: 4, won: true, hintsUsed: 0 })
  })
})

describe('parseChallenge — malformed / garbage → null (FR-7)', () => {
  it('returns null for absent c', () => {
    expect(parseChallenge(new URLSearchParams(''))).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseChallenge('')).toBeNull()
  })

  it('returns null for non-base64 garbage', () => {
    expect(parseChallenge('@@@bad')).toBeNull()
  })

  it('returns null for valid base64 that is not JSON', () => {
    // btoa('not json at all') decodes fine but JSON.parse throws.
    expect(parseChallenge(btoa('not json at all'))).toBeNull()
  })

  it('returns null for JSON that is not an object', () => {
    expect(parseChallenge(btoa('42'))).toBeNull()
    expect(parseChallenge(btoa('"hi"'))).toBeNull()
  })

  it('returns null when attempts is out of range', () => {
    expect(parseChallenge(btoa(JSON.stringify({ v: 1, a: 9, w: 1 })))).toBeNull()
    expect(parseChallenge(btoa(JSON.stringify({ v: 1, a: -1, w: 0 })))).toBeNull()
  })

  it('returns null when a win has 0 attempts', () => {
    expect(parseChallenge(btoa(JSON.stringify({ v: 1, a: 0, w: 1 })))).toBeNull()
  })

  it('returns null when a loss has non-zero attempts', () => {
    expect(parseChallenge(btoa(JSON.stringify({ v: 1, a: 3, w: 0 })))).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(parseChallenge(null)).toBeNull()
    expect(parseChallenge(undefined)).toBeNull()
    expect(parseChallenge(123)).toBeNull()
  })
})

describe('challengeVerdict', () => {
  it('fewer attempts wins (A=3 vs B=4 → they win for B)', () => {
    expect(challengeVerdict({ won: true, attempts: 4 }, { won: true, attempts: 3 })).toBe('them')
    expect(challengeVerdict({ won: true, attempts: 3 }, { won: true, attempts: 4 })).toBe('you')
  })

  it('a win beats a loss', () => {
    expect(challengeVerdict({ won: true, attempts: 6 }, { won: false, attempts: 0 })).toBe('you')
    expect(challengeVerdict({ won: false, attempts: 0 }, { won: true, attempts: 6 })).toBe('them')
  })

  it('equal scores tie', () => {
    expect(challengeVerdict({ won: true, attempts: 3 }, { won: true, attempts: 3 })).toBe('tie')
  })

  it('both lost is a tie', () => {
    expect(challengeVerdict({ won: false, attempts: 0 }, { won: false, attempts: 0 })).toBe('tie')
  })
})
