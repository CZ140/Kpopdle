const API_BASE = '/api'

export async function fetchDailyGame(group) {
  const res = await fetch(`${API_BASE}/${group}/game/today`)
  if (!res.ok) throw new Error('Failed to fetch daily game')
  return res.json()
}

export async function submitGuess(group, gameDate, guess) {
  const res = await fetch(`${API_BASE}/${group}/game/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameDate, guess }),
  })
  if (!res.ok) throw new Error('Failed to submit guess')
  return res.json()
}

export async function fetchSongList(group) {
  const res = await fetch(`${API_BASE}/${group}/songs`)
  if (!res.ok) throw new Error('Failed to fetch song list')
  return res.json()
}

export async function fetchArchiveGame(group, date) {
  const res = await fetch(`${API_BASE}/${group}/game/archive/${date}`)
  if (!res.ok) throw new Error('Failed to fetch archive game')
  return res.json()
}

export async function fetchGroups() {
  const res = await fetch(`${API_BASE}/groups`)
  if (!res.ok) throw new Error('Failed to fetch groups')
  return res.json()
}

// Public community stats (powers the /stats page).
export async function fetchStatsSummary() {
  const res = await fetch(`${API_BASE}/stats/summary`)
  if (!res.ok) throw new Error('Failed to fetch stats summary')
  return res.json()
}

export async function fetchSongDifficulty(group) {
  const res = await fetch(`${API_BASE}/stats/songs/${group}`)
  if (!res.ok) throw new Error('Failed to fetch song difficulty')
  return res.json()
}

export async function fetchPracticeGame(group) {
  const res = await fetch(`${API_BASE}/${group}/game/practice`)
  if (!res.ok) throw new Error('Failed to fetch practice game')
  return res.json()
}

export function recordGameResult(payload) {
  // Fire-and-forget — never block the UI on this
  fetch(`${API_BASE}/stats/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

export async function fetchCloudStats() {
  const r = await fetch(`${API_BASE}/auth/stats`, { credentials: 'include' })
  if (!r.ok) return {}
  return r.json()
}

export function saveCloudStats(group, stats) {
  fetch(`${API_BASE}/auth/stats/${group}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats }),
  }).catch(() => {})
}

export async function fetchCommunityStats(group, date) {
  try {
    const path = group === 'kpopdle'
      ? `${API_BASE}/kpopdle/game/community/${date}`
      : `${API_BASE}/${group}/game/community/${date}`
    const res = await fetch(path)
    if (!res.ok) return null
    const data = await res.json()
    return data.totalPlays >= 2 ? data : null
  } catch {
    return null
  }
}

export function importLocalStats(statsMap) {
  fetch(`${API_BASE}/auth/import`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats: statsMap }),
  }).catch(() => {})
}

// Admin analytics dashboard. Returns { status, data } so the page can tell
// "not logged in" (401) apart from "logged in but not an admin" (403).
export async function fetchAdminDashboard(hours = 24) {
  const res = await fetch(`${API_BASE}/admin/dashboard?hours=${hours}`, { credentials: 'include' })
  if (!res.ok) return { status: res.status, data: null }
  return { status: 200, data: await res.json() }
}

// Trigger a Cloudflare historical backfill (admin only). Runs server-side.
export async function triggerBackfill(days = 30) {
  const res = await fetch(`${API_BASE}/admin/backfill?days=${days}`, { method: 'POST', credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, ...data }
}

export async function submitPracticeGuess(group, practiceSongId, guess) {
  const res = await fetch(`${API_BASE}/${group}/game/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameDate: 'practice', practiceSongId, guess }),
  })
  if (!res.ok) throw new Error('Failed to submit guess')
  return res.json()
}
