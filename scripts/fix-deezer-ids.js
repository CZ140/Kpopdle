/**
 * Validates every Deezer ID in all group songs.json files against the real Deezer API.
 * For any song with a missing, zero, or wrong ID it searches Deezer by artist + title.
 * Writes corrected songs.json files in place and prints a summary.
 *
 * Usage:  node scripts/fix-deezer-ids.js
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'server', 'src', 'data')

const GROUPS_JSON = join(DATA_DIR, 'groups.json')
const groups = JSON.parse(readFileSync(GROUPS_JSON, 'utf-8'))

const DELAY_MS = 150  // ~6 req/s — well under Deezer's 50/5s public limit

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function checkTrackById(trackId, expectedTitle) {
  try {
    const res = await fetch(`https://api.deezer.com/track/${trackId}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.error || !data.preview) return null
    const titleMatch = data.title?.toLowerCase().trim() === expectedTitle.toLowerCase().trim()
    return titleMatch ? { id: data.id, preview: data.preview } : null
  } catch {
    return null
  }
}

async function searchTrack(artistName, songTitle) {
  try {
    // artist:"name" quoted filter is broken on Deezer — use unquoted search + validate both fields
    const query = encodeURIComponent(`${artistName} ${songTitle}`)
    const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=20`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.data?.length) return null
    const normalizedTitle = songTitle.toLowerCase().trim()
    const normalizedArtist = artistName.toLowerCase().trim()
    const match = data.data.find(t =>
      t.preview &&
      t.title?.toLowerCase().trim() === normalizedTitle &&
      t.artist?.name?.toLowerCase().trim() === normalizedArtist
    )
    return match ? { id: match.id, preview: match.preview } : null
  } catch {
    return null
  }
}

async function processGroup(group) {
  const songsPath = join(DATA_DIR, 'groups', group.id, 'songs.json')
  const songs = JSON.parse(readFileSync(songsPath, 'utf-8'))

  let valid = 0, fixed = 0, notFound = 0

  for (const song of songs) {
    // Step 1: validate existing ID
    if (song.deezerId && song.deezerId !== 0) {
      await sleep(DELAY_MS)
      const result = await checkTrackById(song.deezerId, song.title)
      if (result) {
        valid++
        continue
      }
    }

    // Step 2: search by artist + title
    await sleep(DELAY_MS)
    const found = await searchTrack(group.deezerArtistName, song.title)
    if (found) {
      const oldId = song.deezerId
      song.deezerId = found.id
      console.log(`  [FIXED] "${song.title}" — ${oldId} → ${found.id}`)
      fixed++
    } else {
      if (song.deezerId !== 0) {
        console.log(`  [MISSING] "${song.title}" — no Deezer match found, setting to 0`)
        song.deezerId = 0
      }
      notFound++
    }
  }

  writeFileSync(songsPath, JSON.stringify(songs, null, 2))
  console.log(`${group.id}: ${valid} valid, ${fixed} fixed, ${notFound} not found on Deezer\n`)
}

// Optionally pass a group ID as argument to rerun just one group
// e.g.  node scripts/fix-deezer-ids.js twice
const targetGroup = process.argv[2] ?? null
const toProcess = targetGroup ? groups.filter(g => g.id === targetGroup) : groups

if (toProcess.length === 0) {
  console.error(`Unknown group: ${targetGroup}`)
  process.exit(1)
}

console.log('Validating Deezer IDs across all groups...\n')
console.log('This will take a few minutes (rate-limited to ~6 req/s).\n')

for (const group of toProcess) {
  console.log(`--- ${group.displayName} (${group.deezerArtistName}) ---`)
  await processGroup(group)
}

console.log('Done. Re-start the server to pick up updated songs.json files.')
