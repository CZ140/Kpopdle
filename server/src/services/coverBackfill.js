import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDeezerAlbumCover } from './deezerPreview.js'
import { logger } from './observability.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const GROUPS_DIR = join(__dirname, '../data/groups')

function songsPath(groupId) {
  return join(GROUPS_DIR, groupId, 'songs.json')
}

// Small pause between Deezer calls so a long backfill doesn't trip rate limits.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Backfill `coverUrl` (+ `coverMd5`) into one group's songs.json.
//
// For every song with a non-zero deezerId we hit GET /track/{id} and read the
// nested album cover (cover_big, 500²). Songs with deezerId 0/missing or a
// failed lookup are left without a coverUrl — the cover mode excludes them, so
// no round ever renders a broken image (FR-8). The file is rewritten in place
// preserving song order; existing non-cover fields are untouched.
export async function backfillGroupCovers(groupId, { delayMs = 150, force = false, onProgress } = {}) {
  const path = songsPath(groupId)
  const songs = JSON.parse(readFileSync(path, 'utf-8'))

  let updated = 0
  let alreadyHad = 0
  let noDeezer = 0
  let failed = 0
  const failures = []

  for (const song of songs) {
    if (!force && song.coverUrl) {
      alreadyHad++
      continue
    }
    if (!song.deezerId || song.deezerId === 0) {
      noDeezer++
      continue
    }

    try {
      const cover = await getDeezerAlbumCover(song.deezerId)
      if (cover?.coverUrl) {
        song.coverUrl = cover.coverUrl
        if (cover.coverMd5) song.coverMd5 = cover.coverMd5
        updated++
      } else {
        failed++
        failures.push({ id: song.id, title: song.title, reason: 'no cover in Deezer response' })
      }
    } catch (err) {
      failed++
      failures.push({ id: song.id, title: song.title, reason: err.message })
    }

    onProgress?.({ id: song.id, title: song.title })
    if (delayMs > 0) await sleep(delayMs)
  }

  // Write back only if something changed (or forced) to keep diffs clean.
  if (updated > 0 || force) {
    writeFileSync(path, JSON.stringify(songs, null, 2) + '\n', 'utf-8')
  }

  const covered = songs.filter((s) => s.coverUrl).length
  const summary = { groupId, total: songs.length, updated, alreadyHad, noDeezer, failed, covered, failures }
  logger.info(summary, `Cover backfill for ${groupId}`)
  return summary
}
