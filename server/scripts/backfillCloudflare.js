#!/usr/bin/env node
// Backfill historical traffic from Cloudflare's GraphQL Analytics API into the
// dashboard's history tables, filling the gap before our own per-request
// telemetry began.
//
// Usage:  node server/scripts/backfillCloudflare.js [--days N]   (default 30)
//
//   --days N   how many days back to import. Cloudflare retention limits how far
//              data actually exists (hourly rollups ~30 days; per-path detail a
//              few days), so older days may return nothing — that's expected.
//
// NOTE: this writes to whatever DB the process can see (DB_PATH). On Railway the
// production DB lives on a mounted volume that only the deployed container can
// reach — so for production, prefer the in-app "Backfill" button on /admin,
// which runs this same logic inside Railway. This script is for local/dev use.
//
// Requires CLOUDFLARE_API_TOKEN (Zone → Analytics → Read) and CLOUDFLARE_ZONE_ID.

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID) {
  console.error(
    'Missing credentials. Set these (in server/.env or the Railway environment):\n' +
    '  CLOUDFLARE_API_TOKEN  — a token with Zone → Analytics → Read for k-popdle.com\n' +
    '  CLOUDFLARE_ZONE_ID    — from the zone overview page in the Cloudflare dashboard'
  )
  process.exit(1)
}

const { runBackfill } = await import('../src/services/backfill.js')

const i = process.argv.indexOf('--days')
const days = i !== -1 && Number(process.argv[i + 1]) > 0 ? Number(process.argv[i + 1]) : 30

console.log(`Backfilling the last ${days} days from Cloudflare...`)
try {
  const r = await runBackfill({ days })
  console.log(`\nDone. ~${r.estRequests.toLocaleString()} requests imported`)
  console.log(`  ${r.statusRows} status rows · ${r.geoRows} geo rows · ${r.pathRows} path rows`)
  console.log(`  window: ${r.since.slice(0, 10)} → ${r.until.slice(0, 10)}`)
  if (r.statusRows === 0) console.log('  (no hourly data returned — likely beyond Cloudflare retention)')
} catch (err) {
  console.error('\nBackfill failed:', err.message)
  process.exit(1)
}
