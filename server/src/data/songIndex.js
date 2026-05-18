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
