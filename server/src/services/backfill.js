import { fetchTrafficByHour, fetchPathStatus } from './cloudflareClient.js'
import { saveTrafficStatus, saveTrafficGeo, saveTrafficPaths } from './adminDb.js'

// Imports the last `days` of Cloudflare analytics into the history tables.
// Shared by the CLI script and the in-app admin endpoint so both behave
// identically. Returns a summary for display.
export async function runBackfill({ days = 30 } = {}) {
  const until = new Date()
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)
  const sinceISO = since.toISOString()
  const untilISO = until.toISOString()

  // Status + geo (hourly, non-sampled) and paths (sampled) run in parallel.
  const [{ status, geo }, paths] = await Promise.all([
    fetchTrafficByHour(sinceISO, untilISO),
    fetchPathStatus(sinceISO, untilISO).catch(() => []), // paths are best-effort
  ])

  if (status.length) saveTrafficStatus(status)
  if (geo.length) saveTrafficGeo(geo)
  if (paths.length) saveTrafficPaths(paths)

  const estRequests = status.reduce((s, r) => s + r.count, 0)

  return {
    days,
    since: sinceISO,
    until: untilISO,
    statusRows: status.length,
    geoRows: geo.length,
    pathRows: paths.length,
    estRequests,
  }
}
