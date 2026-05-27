import db from './db.js'

// Audio health is derived from the most recent cache-warm pass (updated by the
// warmCache loop in index.js) rather than a live Deezer call — so the
// healthcheck never hammers Deezer and never depends on its latency.
let lastWarm = { ok: false, at: null, failures: [] }

export function recordWarmResult({ ok, failures = [] }) {
  lastWarm = { ok, failures, at: Math.floor(Date.now() / 1000) }
}

export function getHealth() {
  let dbOk = false
  try {
    db.prepare('SELECT 1').get()
    dbOk = true
  } catch {
    // dbOk stays false
  }

  return {
    // Liveness = DB reachable. This is the only hard dependency a container
    // restart can actually fix. Audio (Deezer) is reported but NON-fatal:
    // it's an external service, so failing the healthcheck on it would just
    // trigger pointless restart loops and break deploys during Deezer blips.
    healthy: dbOk,
    db: dbOk,
    audio: lastWarm.ok,
    lastWarmAt: lastWarm.at,
    warmFailures: lastWarm.failures,
    uptimeSeconds: Math.floor(process.uptime()),
  }
}
