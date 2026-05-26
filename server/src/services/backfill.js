import { fetchTrafficByHour, fetchPathStatus } from './cloudflareClient.js'
import { saveTrafficStatus, saveTrafficGeo, saveTrafficPaths } from './adminDb.js'

// Cloudflare caps each httpRequests1hGroups query at a 3-day range (and the Free
// plan only retains a few days anyway), so we walk the requested span in windows
// safely under that cap. Windows older than retention simply error — expected,
// so they're caught and skipped.
const WINDOW_MS = 71 * 3600 * 1000      // just under the 3-day (72h) cap for httpRequests1hGroups
const PATH_WINDOW_MS = 23 * 3600 * 1000 // adaptive path dataset has a tighter ~1-day cap

// Imports up to `days` of Cloudflare analytics into the history tables, oldest
// window first. Returns a summary for display. Per-window errors (typically
// "beyond retention") are tolerated so a single recent window still imports.
export async function runBackfill({ days = 30 } = {}) {
  const now = Date.now()
  const startMs = now - days * 24 * 3600 * 1000

  let statusRows = 0, geoRows = 0, pathRows = 0, estRequests = 0
  let windowsTried = 0, windowsWithData = 0
  let earliest = null

  // Walk newest→oldest so the first window covers the most recent (retained) data.
  // Once a window is rejected for exceeding retention, every older one will be
  // too, so we stop there.
  for (let winEnd = now; winEnd > startMs; winEnd -= WINDOW_MS) {
    const winStart = Math.max(winEnd - WINDOW_MS, startMs)
    const sinceISO = new Date(winStart).toISOString()
    const untilISO = new Date(winEnd).toISOString()
    windowsTried++
    try {
      const { status, geo } = await fetchTrafficByHour(sinceISO, untilISO)
      if (status.length) saveTrafficStatus(status)
      if (geo.length) saveTrafficGeo(geo)
      statusRows += status.length
      geoRows += geo.length
      estRequests += status.reduce((s, r) => s + r.count, 0)
      if (status.length) {
        windowsWithData++
        earliest = sinceISO // walking newest→oldest, so the last write is the earliest
      }

      // Paths come from the adaptive dataset, which has a tighter range cap, so
      // sub-chunk this window into ≤1-day slices. Best-effort — never fatal.
      for (let pe = winEnd; pe > winStart; pe -= PATH_WINDOW_MS) {
        const ps = Math.max(pe - PATH_WINDOW_MS, winStart)
        try {
          const paths = await fetchPathStatus(new Date(ps).toISOString(), new Date(pe).toISOString())
          if (paths.length) { saveTrafficPaths(paths); pathRows += paths.length }
        } catch { /* paths best-effort */ }
      }
    } catch {
      // Window exceeds Cloudflare's retention — older windows won't have data either.
      break
    }
  }

  return { days, statusRows, geoRows, pathRows, estRequests, windowsTried, windowsWithData, earliest }
}
