import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Per-group cache: groupId → { songs, byTitle }
const cache = new Map()

function loadGroup(groupId) {
  if (cache.has(groupId)) return cache.get(groupId)

  const path = join(__dirname, 'groups', groupId, 'songs.json')
  const songs = JSON.parse(readFileSync(path, 'utf-8'))

  const byTitle = new Map()
  for (const song of songs) {
    byTitle.set(song.title.toLowerCase(), song)
  }

  const entry = { songs, byTitle }
  cache.set(groupId, entry)
  return entry
}

export function getSongsForGroup(groupId) {
  return loadGroup(groupId).songs
}

export function getSongTitlesForGroup(groupId) {
  return loadGroup(groupId).songs.map((s) => s.title)
}

export function findSongByTitleForGroup(groupId, title) {
  return loadGroup(groupId).byTitle.get(title.toLowerCase()) || null
}

export function getSongCountForGroup(groupId) {
  return loadGroup(groupId).songs.length
}

// Songs playable in the cover (Coverdle) mode: a verified Deezer ID *and* a
// backfilled coverUrl. Used for both the daily pool size and practice picks.
export function getCoverPoolForGroup(groupId) {
  return loadGroup(groupId).songs.filter((s) => s.deezerId && s.deezerId !== 0 && s.coverUrl)
}

// Merged pool for the K-POPDLE cross-group game.
// Sorted by groupId then song.id for deterministic HMAC indexing.
//
// Memoized: the active-group set is effectively static at runtime, yet this is
// rebuilt on every K-POPDLE request (today, archive, songs, each guess). The
// cache key is the sorted group-id set, so a config change still rebuilds.
const mergedPoolCache = new Map()

export function getMergedPool(activeGroups) {
  const sortedGroups = [...activeGroups].sort((a, b) => a.id.localeCompare(b.id))
  const cacheKey = sortedGroups.map(g => g.id).join(',')

  const cached = mergedPoolCache.get(cacheKey)
  if (cached) return cached

  const pool = []
  for (const group of sortedGroups) {
    const songs = getSongsForGroup(group.id).filter(s => s.deezerId && s.deezerId !== 0)
    for (const song of songs) {
      pool.push({ ...song, groupId: group.id, groupDisplayName: group.displayName, deezerArtistName: group.deezerArtistName })
    }
  }

  mergedPoolCache.set(cacheKey, pool)
  return pool
}
