import db from './db.js'
import { isScannerPath } from '../utils/botPatterns.js'

// ---------------------------------------------------------------------------
// Request telemetry: every meaningful request (pages + API, assets excluded by
// the middleware) lands here. This is the data that powers the admin dashboard
// — effectively our own copy of what Cloudflare shows, but owned and queryable.
//
// Privacy: ip_hash is a salted HMAC of the client IP (never the raw address),
// so we can count unique visitors without storing PII. country comes free from
// Cloudflare's cf-ipcountry edge header.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS request_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          INTEGER NOT NULL,                 -- unix seconds
    method      TEXT    NOT NULL,
    path        TEXT    NOT NULL,
    status      INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    ip_hash     TEXT,
    country     TEXT,
    ua          TEXT,
    is_bot      INTEGER NOT NULL DEFAULT 0,
    user_id     INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_request_log_ts     ON request_log(ts);
  CREATE INDEX IF NOT EXISTS idx_request_log_status ON request_log(status);
`)

const insertStmt = db.prepare(`
  INSERT INTO request_log (ts, method, path, status, duration_ms, ip_hash, country, ua, is_bot, user_id)
  VALUES (@ts, @method, @path, @status, @durationMs, @ipHash, @country, @ua, @isBot, @userId)
`)

export function recordRequest(row) {
  insertStmt.run({
    ts:         row.ts ?? Math.floor(Date.now() / 1000),
    method:     row.method,
    path:       row.path,
    status:     row.status,
    durationMs: row.durationMs,
    ipHash:     row.ipHash ?? null,
    country:    row.country ?? null,
    ua:         row.ua ?? null,
    isBot:      row.isBot ? 1 : 0,
    userId:     row.userId ?? null,
  })
}

// Delete telemetry older than 90 days so the table never grows unbounded.
export function pruneOldRequests() {
  const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 3600
  return db.prepare('DELETE FROM request_log WHERE ts < ?').run(cutoff).changes
}

// ---------------------------------------------------------------------------
// Cloudflare backfill — historical aggregates imported (via scripts/backfillCloudflare.js)
// for the period before our own per-request telemetry existed. Stored in their
// own tables, never mixed into request_log, and merged into the dashboard only
// for the slice of a time range that predates the telemetry boundary.
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS th_status (
    bucket_hour INTEGER NOT NULL,
    status      INTEGER NOT NULL,
    count       INTEGER NOT NULL,
    PRIMARY KEY (bucket_hour, status)
  );
  CREATE TABLE IF NOT EXISTS th_geo (
    bucket_hour INTEGER NOT NULL,
    country     TEXT    NOT NULL,
    count       INTEGER NOT NULL,
    PRIMARY KEY (bucket_hour, country)
  );
  CREATE TABLE IF NOT EXISTS th_path (
    day    TEXT    NOT NULL,
    path   TEXT    NOT NULL,
    status INTEGER NOT NULL,
    count  INTEGER NOT NULL,
    PRIMARY KEY (day, path, status)
  );
`)

const upsertStatus = db.prepare(`INSERT INTO th_status (bucket_hour, status, count) VALUES (@bucketHour, @status, @count)
  ON CONFLICT(bucket_hour, status) DO UPDATE SET count = excluded.count`)
const upsertGeo = db.prepare(`INSERT INTO th_geo (bucket_hour, country, count) VALUES (@bucketHour, @country, @count)
  ON CONFLICT(bucket_hour, country) DO UPDATE SET count = excluded.count`)
const upsertPath = db.prepare(`INSERT INTO th_path (day, path, status, count) VALUES (@day, @path, @status, @count)
  ON CONFLICT(day, path, status) DO UPDATE SET count = excluded.count`)

export const saveTrafficStatus = db.transaction((rows) => { for (const r of rows) upsertStatus.run(r) })
export const saveTrafficGeo    = db.transaction((rows) => { for (const r of rows) upsertGeo.run(r) })
export const saveTrafficPaths  = db.transaction((rows) => { for (const r of rows) upsertPath.run(r) })

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

const now = () => Math.floor(Date.now() / 1000)

// Boundary: the moment our own per-request telemetry began (earliest request_log
// row). Historical backfill fills strictly before it; live data covers at/after
// it — so the two sources cover disjoint time and never double-count.
function getLiveSince() {
  const r = db.prepare('SELECT MIN(ts) AS t FROM request_log').get()
  return r.t ?? now()
}

function historyAvailable(sinceTs, liveSince) {
  return !!db.prepare('SELECT 1 FROM th_status WHERE bucket_hour >= ? AND bucket_hour < ? LIMIT 1').get(sinceTs, liveSince)
}

// Imported request/4xx/5xx totals for the pre-boundary slice of the window.
function getHistoryTotals(sinceTs, liveSince) {
  const r = db.prepare(`
    SELECT
      SUM(count)                                                          AS total,
      SUM(CASE WHEN status >= 400 AND status < 500 THEN count ELSE 0 END) AS c4xx,
      SUM(CASE WHEN status >= 500 THEN count ELSE 0 END)                  AS c5xx
    FROM th_status WHERE bucket_hour >= ? AND bucket_hour < ?
  `).get(sinceTs, liveSince)
  return { total: r.total || 0, c4xx: r.c4xx || 0, c5xx: r.c5xx || 0 }
}

// Headline KPI cards for the selected window. Request totals merge live
// telemetry with Cloudflare backfill; unique-visitor and bot counts are
// live-only (those dimensions don't exist in the imported aggregates).
function getKpis(sinceTs, liveSince) {
  const reqs = db.prepare(`
    SELECT
      COUNT(*)                                                  AS total,
      SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 END)  AS c4xx,
      SUM(CASE WHEN status >= 500 THEN 1 END)                   AS c5xx,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)               AS bots,
      COUNT(DISTINCT CASE WHEN is_bot = 0 THEN ip_hash END)     AS visitors
    FROM request_log WHERE ts >= ?
  `).get(sinceTs)

  const hist = getHistoryTotals(sinceTs, liveSince)
  const total = (reqs.total || 0) + hist.total
  const errors = (reqs.c4xx || 0) + (reqs.c5xx || 0) + hist.c4xx + hist.c5xx

  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  const games = db.prepare('SELECT COUNT(*) AS n FROM game_results WHERE played_at >= ?')
    .get(new Date(sinceTs * 1000).toISOString()).n

  return {
    totalRequests: total,
    errorRate: total ? +(errors * 100 / total).toFixed(1) : 0,
    serverErrors: (reqs.c5xx || 0) + hist.c5xx,
    uniqueVisitors: reqs.visitors || 0,
    botRequests: reqs.bots || 0,
    totalUsers: users,
    gamesInWindow: games,
  }
}

// Total / 4xx / 5xx requests bucketed over time. Merges live telemetry (at/after
// the boundary) with Cloudflare backfill (strictly before it) into one series.
function getTrafficSeries(sinceTs, bucketSeconds, liveSince) {
  const live = db.prepare(`
    SELECT (ts / @b) * @b                                       AS bucket,
      COUNT(*)                                                  AS total,
      SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 END)  AS c4xx,
      SUM(CASE WHEN status >= 500 THEN 1 END)                   AS c5xx
    FROM request_log WHERE ts >= @since GROUP BY bucket
  `).all({ b: bucketSeconds, since: sinceTs })

  const hist = db.prepare(`
    SELECT (bucket_hour / @b) * @b                                          AS bucket,
      SUM(count)                                                            AS total,
      SUM(CASE WHEN status >= 400 AND status < 500 THEN count ELSE 0 END)   AS c4xx,
      SUM(CASE WHEN status >= 500 THEN count ELSE 0 END)                    AS c5xx
    FROM th_status WHERE bucket_hour >= @since AND bucket_hour < @live GROUP BY bucket
  `).all({ b: bucketSeconds, since: sinceTs, live: liveSince })

  // Pre-fill every bucket across the window with zeros so the chart has a
  // continuous time axis — no gaps, and points are spaced by real time rather
  // than by index (which distorts when backfill leaves multi-hour holes).
  const start = Math.floor(sinceTs / bucketSeconds) * bucketSeconds
  const lastBucket = Math.floor(now() / bucketSeconds) * bucketSeconds
  const map = new Map()
  for (let t = start; t <= lastBucket; t += bucketSeconds) {
    map.set(t, { t, total: 0, c4xx: 0, c5xx: 0 })
  }

  for (const r of [...hist, ...live]) {
    const e = map.get(r.bucket)
    if (!e) continue
    e.total += r.total || 0
    e.c4xx += r.c4xx || 0
    e.c5xx += r.c5xx || 0
  }
  return [...map.values()] // Map preserves ascending insertion (time) order
}

// Status-code distribution (4xx/5xx) for the donut — live + backfill.
function getStatusBreakdown(sinceTs, liveSince) {
  const live = db.prepare(`
    SELECT status, COUNT(*) AS count FROM request_log
    WHERE ts >= ? AND status >= 400 GROUP BY status
  `).all(sinceTs)
  const hist = db.prepare(`
    SELECT status, SUM(count) AS count FROM th_status
    WHERE bucket_hour >= ? AND bucket_hour < ? AND status >= 400 GROUP BY status
  `).all(sinceTs, liveSince)

  const map = new Map()
  for (const r of [...live, ...hist]) map.set(r.status, (map.get(r.status) || 0) + r.count)
  return [...map.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)
}

// Top error paths, tagged as bot scans vs real failures — live + backfill.
function getTopErrorPaths(sinceTs, liveSince) {
  const live = db.prepare(`
    SELECT path, COUNT(*) AS count, MAX(status) AS status FROM request_log
    WHERE ts >= ? AND status >= 400 GROUP BY path
  `).all(sinceTs)
  const sinceDay = new Date(sinceTs * 1000).toISOString().slice(0, 10)
  const liveDay = new Date(liveSince * 1000).toISOString().slice(0, 10)
  const hist = db.prepare(`
    SELECT path, SUM(count) AS count, MAX(status) AS status FROM th_path
    WHERE day >= ? AND day < ? AND status >= 400 GROUP BY path
  `).all(sinceDay, liveDay)

  const map = new Map()
  for (const r of [...live, ...hist]) {
    const e = map.get(r.path) || { path: r.path, count: 0, status: 0 }
    e.count += r.count
    e.status = Math.max(e.status, r.status)
    map.set(r.path, e)
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map(r => ({ path: r.path, count: r.count, status: r.status, isBot: isScannerPath(r.path) }))
}

// Latency percentiles + slowest endpoints (human traffic only — bot scans hit
// 404 instantly and would skew the numbers optimistically).
function getLatency(sinceTs) {
  const durations = db.prepare(`
    SELECT duration_ms FROM request_log
    WHERE ts >= ? AND is_bot = 0
    ORDER BY duration_ms
  `).all(sinceTs).map(r => r.duration_ms)

  const pct = (p) => {
    if (!durations.length) return 0
    const idx = Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))
    return durations[idx]
  }

  const slowest = db.prepare(`
    SELECT path,
           COUNT(*)            AS count,
           ROUND(AVG(duration_ms)) AS avg_ms,
           MAX(duration_ms)    AS max_ms
    FROM request_log
    WHERE ts >= ? AND is_bot = 0
    GROUP BY path
    HAVING count >= 3
    ORDER BY avg_ms DESC
    LIMIT 10
  `).all(sinceTs)

  return {
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
    max: durations.length ? durations[durations.length - 1] : 0,
    slowest,
  }
}

// Geographic split — by requests so live telemetry and Cloudflare backfill
// merge cleanly (the imported aggregates have no per-visitor dimension).
function getGeo(sinceTs, liveSince) {
  const live = db.prepare(`
    SELECT COALESCE(country, '??') AS country, COUNT(*) AS requests
    FROM request_log WHERE ts >= ? GROUP BY country
  `).all(sinceTs)
  const hist = db.prepare(`
    SELECT country, SUM(count) AS requests FROM th_geo
    WHERE bucket_hour >= ? AND bucket_hour < ? GROUP BY country
  `).all(sinceTs, liveSince)

  const map = new Map()
  for (const r of [...live, ...hist]) {
    const cc = r.country || '??'
    map.set(cc, (map.get(cc) || 0) + r.requests)
  }
  return [...map.entries()]
    .map(([country, requests]) => ({ country, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 12)
}

// Signups over the last 30 days + cumulative total.
function getUserGrowth() {
  const daily = db.prepare(`
    SELECT DATE(created_at, 'unixepoch') AS day, COUNT(*) AS signups
    FROM users
    WHERE created_at >= unixepoch() - 30 * 24 * 3600
    GROUP BY day
    ORDER BY day
  `).all()

  const total = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  const newThisWeek = db.prepare(
    'SELECT COUNT(*) AS n FROM users WHERE created_at >= unixepoch() - 7 * 24 * 3600'
  ).get().n

  return { daily, total, newThisWeek }
}

// Daily active visitors (distinct human IPs) over the last 14 days.
function getActiveUsers() {
  return db.prepare(`
    SELECT DATE(ts, 'unixepoch') AS day,
           COUNT(DISTINCT ip_hash)                               AS visitors,
           COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) AS signed_in
    FROM request_log
    WHERE is_bot = 0 AND ts >= unixepoch() - 14 * 24 * 3600
    GROUP BY day
    ORDER BY day
  `).all()
}

// Game-play analytics: per-group summary + plays per day + headline totals.
function getGameAnalytics() {
  const byGroup = db.prepare(`
    SELECT
      group_id,
      COUNT(*)                              AS plays,
      ROUND(SUM(won) * 100.0 / COUNT(*), 1) AS win_rate,
      ROUND(AVG(guess_count), 2)            AS avg_guesses
    FROM game_results
    GROUP BY group_id
    ORDER BY plays DESC
  `).all()

  const daily = db.prepare(`
    SELECT DATE(played_at) AS day, COUNT(*) AS plays
    FROM game_results
    WHERE played_at >= datetime('now', '-30 days')
    GROUP BY day
    ORDER BY day
  `).all()

  const totals = db.prepare(`
    SELECT COUNT(*) AS plays,
           ROUND(SUM(won) * 100.0 / COUNT(*), 1) AS win_rate
    FROM game_results
  `).get()

  return { byGroup, daily, totalPlays: totals.plays || 0, winRate: totals.win_rate || 0 }
}

// Live feed: the most recent requests, for an at-a-glance "what's happening now".
function getRecentRequests(limit = 40) {
  return db.prepare(`
    SELECT ts, method, path, status, duration_ms AS durationMs, country, is_bot AS isBot
    FROM request_log
    ORDER BY id DESC
    LIMIT ?
  `).all(limit)
}

// Single entry point the dashboard route calls — one round-trip for the client.
export function getDashboard({ hours = 24 } = {}) {
  const sinceTs = now() - hours * 3600
  const liveSince = getLiveSince()
  // Pick a bucket size that yields a readable number of points across the window.
  const bucketSeconds = hours <= 24 ? 3600 : hours <= 24 * 7 ? 6 * 3600 : 24 * 3600

  return {
    rangeHours: hours,
    generatedAt: now(),
    // Boundary between Cloudflare backfill (before) and our telemetry (after),
    // only surfaced when there's actually imported history in this window.
    telemetrySince: historyAvailable(sinceTs, liveSince) ? liveSince : null,
    kpis: getKpis(sinceTs, liveSince),
    traffic: getTrafficSeries(sinceTs, bucketSeconds, liveSince),
    statusBreakdown: getStatusBreakdown(sinceTs, liveSince),
    topErrorPaths: getTopErrorPaths(sinceTs, liveSince),
    latency: getLatency(sinceTs),
    geo: getGeo(sinceTs, liveSince),
    userGrowth: getUserGrowth(),
    activeUsers: getActiveUsers(),
    games: getGameAnalytics(),
    recent: getRecentRequests(40),
  }
}
