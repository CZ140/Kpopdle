/**
 * Seeds server/src/data/groups/{groupId}/songs.json from
 * scripts/song-research/{groupId}.json (the agent-curated discography list).
 *
 * Output entries get: id (1-indexed), title, album, releaseYear, deezerId: 0, spotifyId: null.
 * Cover fields are intentionally omitted — coverBackfill fills them after Deezer IDs resolve.
 *
 * Run fix-deezer-ids.js after seeding to populate the deezerId values.
 *
 * Usage:
 *   node scripts/seed-from-research.mjs <groupId> [<groupId>...]
 *   node scripts/seed-from-research.mjs --all
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESEARCH_DIR = join(__dirname, 'song-research')
const GROUPS_DIR = join(__dirname, '..', 'server', 'src', 'data', 'groups')

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/seed-from-research.mjs <groupId> [...] | --all')
  process.exit(1)
}

const groupIds = args.includes('--all')
  ? readdirSync(RESEARCH_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  : args

for (const groupId of groupIds) {
  const researchPath = join(RESEARCH_DIR, `${groupId}.json`)
  if (!existsSync(researchPath)) {
    console.error(`✗ ${groupId}: no research file at ${researchPath}`)
    continue
  }

  const research = JSON.parse(readFileSync(researchPath, 'utf-8'))
  const seen = new Set()
  const songs = []
  for (const s of research.songs) {
    const key = s.title.toLowerCase().trim()
    if (seen.has(key)) continue   // validator rejects duplicate titles within a group
    seen.add(key)
    songs.push({
      id: songs.length + 1,
      title: s.title,
      album: s.album,
      releaseYear: s.releaseYear,
      spotifyId: null,
      deezerId: 0,
    })
  }

  const outDir = join(GROUPS_DIR, groupId)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'songs.json')
  writeFileSync(outPath, JSON.stringify(songs, null, 2) + '\n')
  console.log(`✓ ${groupId}: wrote ${songs.length} songs to ${outPath}`)
}
