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

export async function fetchGroups() {
  const res = await fetch(`${API_BASE}/groups`)
  if (!res.ok) throw new Error('Failed to fetch groups')
  return res.json()
}
