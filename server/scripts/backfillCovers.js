#!/usr/bin/env node
// Backfill album-cover URLs into each group's songs.json for the Coverdle mode.
//
// For every song with a non-zero deezerId, this calls GET /track/{id} on
// Deezer's public API (the same client the preview service uses) and writes the
// album's cover_big (500²) URL as `coverUrl` (+ md5 as `coverMd5`). Songs
// without a deezerId or whose lookup fails are left uncovered — the cover game
// excludes them, so no round renders a broken image.
//
// Usage:
//   node server/scripts/backfillCovers.js                 # all active groups
//   node server/scripts/backfillCovers.js twice           # one group
//   node server/scripts/backfillCovers.js twice newjeans  # several groups
//   node server/scripts/backfillCovers.js --all --force   # re-fetch every cover
//   node server/scripts/backfillCovers.js --delay 250     # tune the per-call pause (ms)
//
// No credentials needed — Deezer's track endpoint is public.

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const groups = JSON.parse(readFileSync(join(__dirname, '../src/data/groups.json'), 'utf-8'))
const allGroupIds = groups.map((g) => g.id)

const args = process.argv.slice(2)
const force = args.includes('--force') || args.includes('--all')
const delayIdx = args.indexOf('--delay')
const delayMs = delayIdx !== -1 && Number(args[delayIdx + 1]) >= 0 ? Number(args[delayIdx + 1]) : 150

// Positional args (not flags / flag values) are group ids; default = all groups.
const flagValues = delayIdx !== -1 ? new Set([args[delayIdx + 1]]) : new Set()
const requested = args.filter((a) => !a.startsWith('--') && !flagValues.has(a))
const targets = requested.length > 0 ? requested : allGroupIds

const unknown = targets.filter((g) => !allGroupIds.includes(g))
if (unknown.length > 0) {
  console.error(`Unknown group(s): ${unknown.join(', ')}`)
  console.error(`Known groups: ${allGroupIds.join(', ')}`)
  process.exit(1)
}

const { backfillGroupCovers } = await import('../src/services/coverBackfill.js')

console.log(`Backfilling covers for: ${targets.join(', ')} (delay ${delayMs}ms${force ? ', force' : ''})\n`)

let grandCovered = 0
let grandTotal = 0
for (const groupId of targets) {
  process.stdout.write(`  ${groupId} ... `)
  try {
    const r = await backfillGroupCovers(groupId, { delayMs, force })
    grandCovered += r.covered
    grandTotal += r.total
    console.log(
      `${r.covered}/${r.total} covered ` +
      `(+${r.updated} new, ${r.alreadyHad} kept, ${r.noDeezer} no-deezer, ${r.failed} failed)`
    )
    if (r.failures.length > 0) {
      for (const f of r.failures) console.log(`      ✗ #${f.id} "${f.title}" — ${f.reason}`)
    }
  } catch (err) {
    console.log(`ERROR — ${err.message}`)
  }
}

console.log(`\nDone. ${grandCovered}/${grandTotal} songs have covers across ${targets.length} group(s).`)
