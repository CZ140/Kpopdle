const API_BASE = '/api'

export async function fetchDailyGame() {
  const res = await fetch(`${API_BASE}/game/today`)
  if (!res.ok) throw new Error('Failed to fetch daily game')
  return res.json()
}

export async function submitGuess(gameDate, guess) {
  const res = await fetch(`${API_BASE}/game/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameDate, guess }),
  })
  if (!res.ok) throw new Error('Failed to submit guess')
  return res.json()
}

export async function fetchSongList() {
  const res = await fetch(`${API_BASE}/songs`)
  if (!res.ok) throw new Error('Failed to fetch song list')
  return res.json()
}
