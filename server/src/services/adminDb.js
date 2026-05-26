import db from './db.js'

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
// Dashboard queries
// ---------------------------------------------------------------------------

const now = () => Math.floor(Date.now() / 1000)

// Headline KPI cards for the selected window.
function getKpis(sinceTs) {
  const reqs = db.prepare(`
    SELECT
      COUNT(*)                                                  AS total,
      SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 END)  AS c4xx,
      SUM(CASE WHEN status >= 500 THEN 1 END)                   AS c5xx,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)               AS bots,
      COUNT(DISTINCT CASE WHEN is_bot = 0 THEN ip_hash END)     AS visitors
    FROM request_log WHERE ts >= ?
  `).get(sinceTs)

  const total = reqs.total || 0
  const errors = (reqs.c4xx || 0) + (reqs.c5xx || 0)

  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  const games = db.prepare('SELECT COUNT(*) AS n FROM game_results WHERE played_at >= ?')
    .get(new Date(sinceTs * 1000).toISOString()).n

  return {
    totalRequests: total,
    errorRate: total ? +(errors * 100 / total).toFixed(1) : 0,
    serverErrors: reqs.c5xx || 0,
    uniqueVisitors: reqs.visitors || 0,
    botRequests: reqs.bots || 0,
    totalUsers: users,
    gamesInWindow: games,
  }
}

// Requests + errors bucketed over time for the area chart.
function getTrafficSeries(sinceTs, bucketSeconds) {
  return db.prepare(`
    SELECT
      (ts / @b) * @b                                            AS bucket,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END)               AS human,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)               AS bot,
      SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 END)  AS c4xx,
      SUM(CASE WHEN status >= 500 THEN 1 END)                   AS c5xx
    FROM request_log
    WHERE ts >= @since
    GROUP BY bucket
    ORDER BY bucket
  `).all({ b: bucketSeconds, since: sinceTs }).map(r => ({
    t: r.bucket,
    human: r.human || 0,
    bot: r.bot || 0,
    c4xx: r.c4xx || 0,
    c5xx: r.c5xx || 0,
  }))
}

// Status-code distribution (4xx/5xx) for the donut.
function getStatusBreakdown(sinceTs) {
  return db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM request_log
    WHERE ts >= ? AND status >= 400
    GROUP BY status
    ORDER BY count DESC
  `).all(sinceTs)
}

// Top error paths, tagged by whether they're mostly bot scans vs real failures.
function getTopErrorPaths(sinceTs) {
  return db.prepare(`
    SELECT
      path,
      COUNT(*)                          AS count,
      MAX(status)                       AS status,
      ROUND(AVG(is_bot) * 100)          AS bot_pct
    FROM request_log
    WHERE ts >= ? AND status >= 400
    GROUP BY path
    ORDER BY count DESC
    LIMIT 15
  `).all(sinceTs).map(r => ({
    path: r.path,
    count: r.count,
    status: r.status,
    isBot: r.bot_pct >= 50,
  }))
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

// Geographic split via Cloudflare's cf-ipcountry header (human traffic).
function getGeo(sinceTs) {
  return db.prepare(`
    SELECT COALESCE(country, '??') AS country, COUNT(DISTINCT ip_hash) AS visitors, COUNT(*) AS requests
    FROM request_log
    WHERE ts >= ? AND is_bot = 0
    GROUP BY country
    ORDER BY visitors DESC
    LIMIT 12
  `).all(sinceTs)
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
  // Pick a bucket size that yields a readable number of points across the window.
  const bucketSeconds = hours <= 24 ? 3600 : hours <= 24 * 7 ? 6 * 3600 : 24 * 3600

  return {
    rangeHours: hours,
    generatedAt: now(),
    kpis: getKpis(sinceTs),
    traffic: getTrafficSeries(sinceTs, bucketSeconds),
    statusBreakdown: getStatusBreakdown(sinceTs),
    topErrorPaths: getTopErrorPaths(sinceTs),
    latency: getLatency(sinceTs),
    geo: getGeo(sinceTs),
    userGrowth: getUserGrowth(),
    activeUsers: getActiveUsers(),
    games: getGameAnalytics(),
    recent: getRecentRequests(40),
  }
}
