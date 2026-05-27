/**
 * Validates the group registry (server/src/data/groups.json) and every per-group
 * song catalog (groups/{id}/songs.json) for structural integrity.
 *
 * Offline by default (deterministic — safe for CI). Pass --online to additionally
 * probe each Deezer ID against the live API (rate-limited, slow, network-dependent).
 *
 * Usage:
 *   node scripts/validate-songs.js
 *   node scripts/validate-songs.js --online
 *
 * Exits non-zero if any ERROR is found. Warnings never fail the run.
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'server', 'src', 'data')
const ONLINE = process.argv.includes('--online')
const CURRENT_YEAR = new Date().getFullYear()

const errors = []
const warnings = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

// --- Group registry --------------------------------------------------------
const groups = JSON.parse(readFileSync(join(DATA_DIR, 'groups.json'), 'utf-8'))
const seenGroupIds = new Set()
for (const g of groups) {
  const at = `groups.json["${g.id ?? '?'}"]`
  for (const f of ['id', 'displayName', 'deezerArtistName', 'launchDate']) {
    if (typeof g[f] !== 'string' || !g[f].trim()) err(`${at}: missing/invalid "${f}"`)
  }
  if (typeof g.active !== 'boolean') err(`${at}: "active" must be a boolean`)
  if (!g.colors?.primary || !g.colors?.secondary) err(`${at}: missing colors.primary/secondary`)
  if (g.launchDate && !/^\d{4}-\d{2}-\d{2}$/.test(g.launchDate)) err(`${at}: launchDate must be YYYY-MM-DD`)
  if (seenGroupIds.has(g.id)) err(`groups.json: duplicate group id "${g.id}"`)
  seenGroupIds.add(g.id)
}

// --- Deezer probe (only with --online) -------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function probeDeezer(id, title) {
  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`)
    if (!res.ok) return `HTTP ${res.status}`
    const data = await res.json()
    if (data.error) return `Deezer error: ${data.error.message ?? 'unknown'}`
    if (!data.preview) return 'no preview URL'
    return null
  } catch (e) {
    return e.message
  }
}

// --- Per-group song catalogs ----------------------------------------------
let totalSongs = 0
for (const g of groups) {
  const path = join(DATA_DIR, 'groups', g.id, 'songs.json')
  if (!existsSync(path)) { err(`${g.id}: songs.json not found at ${path}`); continue }

  let songs
  try {
    songs = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (e) {
    err(`${g.id}: songs.json is invalid JSON — ${e.message}`)
    continue
  }
  if (!Array.isArray(songs) || songs.length === 0) {
    err(`${g.id}: songs.json must be a non-empty array`)
    continue
  }

  const ids = new Set()
  const titles = new Set()
  let playable = 0
  for (const [i, s] of songs.entries()) {
    const at = `${g.id}[${i}] "${s?.title ?? '?'}"`

    if (!Number.isInteger(s.id)) err(`${at}: id must be an integer`)
    else if (ids.has(s.id)) err(`${at}: duplicate id ${s.id}`)
    else ids.add(s.id)

    if (typeof s.title !== 'string' || !s.title.trim()) {
      err(`${at}: title is required`)
    } else {
      const key = s.title.toLowerCase().trim()
      if (titles.has(key)) err(`${g.id}: duplicate title "${s.title}" — breaks autocomplete + guess matching`)
      titles.add(key)
    }

    if (typeof s.album !== 'string' || !s.album.trim()) warn(`${at}: missing album (used as the era hint)`)
    if (!Number.isInteger(s.releaseYear) || s.releaseYear < 1990 || s.releaseYear > CURRENT_YEAR + 1) {
      err(`${at}: releaseYear out of range (${s.releaseYear})`)
    }

    if (!Number.isInteger(s.deezerId)) err(`${at}: deezerId must be an integer (use 0 when none)`)
    else if (s.deezerId === 0) warn(`${at}: deezerId 0 — excluded from the daily rotation`)
    else playable++

    if (s.spotifyId != null && typeof s.spotifyId !== 'string') err(`${at}: spotifyId must be a string or null`)
  }

  if (playable === 0) err(`${g.id}: no songs with a valid Deezer ID — the daily game would throw`)
  totalSongs += songs.length
  console.log(`  ${g.id.padEnd(12)} ${String(songs.length).padStart(4)} songs · ${String(playable).padStart(4)} playable`)

  if (ONLINE) {
    for (const s of songs) {
      if (!Number.isInteger(s.deezerId) || s.deezerId === 0) continue
      await sleep(150) // ~6 req/s, under Deezer's public limit
      const problem = await probeDeezer(s.deezerId, s.title)
      if (problem) err(`${g.id} "${s.title}" (deezerId ${s.deezerId}): ${problem}`)
    }
  }
}

// --- Report ----------------------------------------------------------------
console.log(`\n${groups.length} groups, ${totalSongs} songs${ONLINE ? ' (Deezer-probed)' : ''}.`)
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`)
  for (const w of warnings) console.log(`  ⚠ ${w}`)
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`)
  for (const e of errors) console.log(`  ✗ ${e}`)
  console.log('\n✗ Catalog validation failed.')
  process.exit(1)
}
console.log('\n✓ All catalogs structurally valid.')
