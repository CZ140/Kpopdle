import { MAX_GUESSES } from './constants'

export function generateShareText(gameNumber, guesses, won, difficulty = 'normal', hintsUsed = 0, gameName = 'K-POPDLE') {
  const guessCount = won ? guesses.length : 'X'
  const badge = difficulty !== 'normal' ? `[${difficulty.toUpperCase()}] ` : ''
  const header = `${badge}${gameName} #${gameNumber} ${guessCount}/${MAX_GUESSES}`

  const grid = guesses
    .map((g) => {
      if (g.type === 'correct') return '\u{1F7E9}'
      if (g.type === 'skipped') return '\u{2B1C}'
      return '\u{1F7E5}'
    })
    .join('')

  const hintRow = hintsUsed > 0 ? '\n' + '\u{1F4A1}'.repeat(hintsUsed) : ''

  return `${header}\n\n${grid}${hintRow}`
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// --- Async "Challenge a friend" (stateless URL payload) -------------------
// The challenger's result is encoded into the link itself — no server state.
// Payload is deliberately minimal and carries NO answer-derivable field:
//   { v:1, n:name?, a:attempts (0 = lost), w:won (0/1), h:hintsUsed }
// Encoded as base64url JSON (btoa + url-safe char swap, '=' stripped).

const NAME_MAX_LEN = 20
const MATCH_DATE = /^\d{4}-\d{2}-\d{2}$/

function base64UrlEncode(str) {
  // btoa needs latin1 — encode UTF-8 first so non-ASCII names survive.
  const b64 = btoa(unescape(encodeURIComponent(str)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Restore padding so atob accepts it.
  while (b64.length % 4) b64 += '='
  return decodeURIComponent(escape(atob(b64)))
}

function sanitizeName(name) {
  if (typeof name !== 'string') return ''
  return name.trim().slice(0, NAME_MAX_LEN)
}

/**
 * Build a stateless challenge link encoding the challenger's result.
 * Returns a root-relative URL: `/{group}?d={gameDate}&c={base64url}`.
 */
export function buildChallengeUrl({ group, gameDate, name, attempts, won, hintsUsed = 0 }) {
  const payload = {
    v: 1,
    a: won ? attempts : 0,
    w: won ? 1 : 0,
    h: hintsUsed || 0,
  }
  const cleanName = sanitizeName(name)
  if (cleanName) payload.n = cleanName

  const c = base64UrlEncode(JSON.stringify(payload))
  return `/${group}?d=${gameDate}&c=${c}`
}

/**
 * Decode a challenge payload from URLSearchParams (or a `c` string).
 * Returns { name, attempts, won, hintsUsed } or `null` for anything
 * missing/malformed/garbage — callers fall back to a normal game (FR-7).
 */
export function parseChallenge(searchParams) {
  const c = typeof searchParams === 'string'
    ? searchParams
    : searchParams?.get?.('c')
  if (!c || typeof c !== 'string') return null

  try {
    const payload = JSON.parse(base64UrlDecode(c))
    if (!payload || typeof payload !== 'object') return null

    const won = payload.w === 1
    const attempts = Number(payload.a)
    // attempts must be an int: 0 (lost) or 1..6 (won). A win needs 1..6.
    if (!Number.isInteger(attempts) || attempts < 0 || attempts > 6) return null
    if (won && (attempts < 1 || attempts > 6)) return null
    if (!won && attempts !== 0) return null

    const hintsUsed = Number.isInteger(payload.h) && payload.h >= 0 ? payload.h : 0
    const name = sanitizeName(payload.n)

    return { name, attempts, won, hintsUsed }
  } catch {
    return null
  }
}

/**
 * Decide the head-to-head verdict between the recipient (you) and the
 * challenger. Fewer attempts wins; a loss is worse than any win;
 * both-lost = tie; equal = tie. Returns 'you' | 'them' | 'tie'.
 */
export function challengeVerdict(you, them) {
  if (you.won && !them.won) return 'you'
  if (!you.won && them.won) return 'them'
  if (!you.won && !them.won) return 'tie'
  // Both won — fewer attempts wins.
  if (you.attempts < them.attempts) return 'you'
  if (you.attempts > them.attempts) return 'them'
  return 'tie'
}

/** Spoiler-free preface prepended to a copied challenge link. */
export function challengePreface(gameName, name) {
  const who = name ? name : 'I'
  return `${who} challenged you on ${gameName}! Can you beat my score? No spoilers \u{1F440}`
}

export { MATCH_DATE as CHALLENGE_DATE_RE }
