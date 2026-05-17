import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const songs = JSON.parse(readFileSync(join(__dirname, 'songs.json'), 'utf-8'))

const songsByTitle = new Map()
for (const song of songs) {
  songsByTitle.set(song.title.toLowerCase(), song)
}

export function getAllSongs() {
  return songs
}

export function getSongTitles() {
  return songs.map((s) => s.title)
}

export function findSongByTitle(title) {
  return songsByTitle.get(title.toLowerCase()) || null
}

export function getSongById(id) {
  return songs.find((s) => s.id === id) || null
}

export function getSongCount() {
  return songs.length
}
