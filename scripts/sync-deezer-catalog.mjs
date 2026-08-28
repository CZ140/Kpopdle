/**
 * Finds songs each group has released that are missing from their songs.json,
 * using the Deezer artist catalog as the source of truth.
 *
 * Dry-run by default (prints what it would add). Pass --apply to write.
 *
 * Usage:
 *   node scripts/sync-deezer-catalog.mjs                  # all groups, releases since 2024
 *   node scripts/sync-deezer-catalog.mjs --since 2020
 *   node scripts/sync-deezer-catalog.mjs twice ive --apply
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'server', 'src', 'data')

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const sinceIdx = argv.indexOf('--since')
const SINCE = sinceIdx >= 0 ? Number(argv[sinceIdx + 1]) : 2024
const only = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--since')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function dz(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(120)
    try {
      const res = await fetch(`https://api.deezer.com${path}`)
      const data = await res.json()
      if (data.error?.code === 4) continue   // quota — back off and retry
      return data
    } catch { /* retry */ }
  }
  return null
}

const norm = (t) => t.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '')

// One song is listed several ways across releases ("HEYA" / "해야 (HEYA)" /
// "WOKE UP x XDM"), so match on any of: the whole title, the part before "(",
// each parenthetical, and the part before a trailing " x <remixer>".
const keys = (t) => {
  const clean = t.replace(/\s*[\(\[]\s*(feat|with|prod)\.?[^\)\]]*[\)\]]/gi, '')
  const out = [clean, clean.replace(/\s*[\(\[].*$/, ''), clean.replace(/\s+x\s+\S+\s*$/i, '')]
  for (const m of clean.matchAll(/[\(\[]([^\)\]]+)[\)\]]/g)) out.push(m[1])
  return [...new Set(out.map(norm).filter(Boolean))]
}

// Alternate cuts of a song we already have — not distinct guessable titles.
const JUNK = /(\b|\()(inst|instrumental|remix\w*|mix|live|karaoke|acappella|a cappella|acoustic|sped up|slowed|reverb|demo|skit|ver|version|edit|radio edit|extended|english|japanese|korean|chinese|mandarin|spanish|reprise|remaster)(\b|\.|\))/i

// Whole releases that only re-cut songs we already have, or cover other artists.
const JUNK_ALBUM = /(\((japanese|english|chinese|korean|mandarin|spanish|thai)\s*ver\.?\)|spotify singles|\[the seasons|remix|\bthe best\b|\bbest of\b|greatest hits)/i

// "THE SIN : VANISH (HEESEUNG Ver.)" next to "THE SIN : VANISH" — member/language
// editions that just re-title the base album's tracks.
const isEditionOf = (title, siblings) =>
  /[\(\[][^\)\]]*\bvers?(ion)?\.?\s*[\)\]]\s*$/i.test(title) &&
  siblings.has(norm(title.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/, '')))

// Deezer moved (G)I-DLE's catalog onto a second "i-dle" entity; name search finds the empty one.
const ARTIST_ID_OVERRIDES = { gidle: 15065941 }

async function resolveArtist(groupId, name) {
  if (ARTIST_ID_OVERRIDES[groupId]) return await dz(`/artist/${ARTIST_ID_OVERRIDES[groupId]}`)
  const res = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=10`)
  const exact = (res?.data ?? []).filter(a => norm(a.name) === norm(name))
  const pool = exact.length ? exact : (res?.data ?? [])
  return pool.sort((a, b) => b.nb_fan - a.nb_fan)[0] ?? null
}

const groups = JSON.parse(readFileSync(join(DATA_DIR, 'groups.json'), 'utf-8'))
const report = []

for (const g of groups) {
  if (only.length && !only.includes(g.id)) continue

  const songsPath = join(DATA_DIR, 'groups', g.id, 'songs.json')
  const songs = JSON.parse(readFileSync(songsPath, 'utf-8'))
  const have = new Set(songs.flatMap(s => keys(s.title)))

  const artist = await resolveArtist(g.id, g.deezerArtistName)
  if (!artist) { console.log(`✗ ${g.id}: no Deezer artist for "${g.deezerArtistName}"`); continue }

  // Every album page for the artist (paginated 100 at a time)
  const albums = []
  let url = `/artist/${artist.id}/albums?limit=100`
  while (url) {
    const page = await dz(url)
    if (!page?.data) break
    albums.push(...page.data)
    url = page.next ? page.next.replace('https://api.deezer.com', '') : null
  }
  const albumTitles = new Set(albums.map(a => norm(a.title)))

  const recent = albums.filter(a => Number((a.release_date ?? '').slice(0, 4)) >= SINCE &&
                                    ['album', 'ep', 'single'].includes(a.record_type) &&
                                    !JUNK_ALBUM.test(a.title) &&
                                    !isEditionOf(a.title, albumTitles))
  const found = new Map()   // title key -> candidate (earliest release wins)
  for (const a of recent.sort((x, y) => (x.release_date ?? '').localeCompare(y.release_date ?? ''))) {
    const full = await dz(`/album/${a.id}`)
    for (const t of full?.tracks?.data ?? []) {
      if (!t.preview || JUNK.test(t.title)) continue
      if (t.artist?.id !== artist.id) continue
      const ks = keys(t.title)
      if (!ks.length || ks.some(k => have.has(k) || found.has(k))) continue
      const entry = {
        title: t.title.replace(/\s*[\(\[]from [^\)\]]*[\)\]]/gi, '').trim(),
        album: a.title,
        releaseYear: Number(a.release_date.slice(0, 4)),
        spotifyId: null,
        deezerId: t.id,
        coverUrl: `https://cdn-images.dzcdn.net/images/cover/${a.md5_image}/500x500-000000-80-0-0.jpg`,
        coverMd5: a.md5_image,
      }
      for (const k of ks) found.set(k, entry)
    }
  }

  const additions = [...new Set(found.values())]
  report.push({ group: g.id, adding: additions.length })
  console.log(`\n${g.id} (deezer ${artist.id} "${artist.name}") — ${songs.length} songs, ${additions.length} missing since ${SINCE}`)
  for (const s of additions) console.log(`   + ${s.releaseYear}  ${s.title.padEnd(38)} ${s.album}`)

  if (APPLY && additions.length) {
    let nextId = Math.max(...songs.map(s => s.id)) + 1
    for (const s of additions) songs.push({ id: nextId++, ...s })
    writeFileSync(songsPath, JSON.stringify(songs, null, 2) + '\n')
  }
}

console.log(`\n${report.reduce((n, r) => n + r.adding, 0)} songs ${APPLY ? 'added' : 'missing'} across ${report.length} groups.`)
