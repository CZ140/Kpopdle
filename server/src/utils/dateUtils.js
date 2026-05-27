export function getKSTDateString() {
  // Date.now() is UTC-absolute, so shifting it by +9h yields the KST instant
  // regardless of the server's local timezone. (Matches the client formula.)
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

// Calculate a game number (days since launch) for display
const LAUNCH_DATE = '2026-02-20'

export function getGameNumber(dateString) {
  const launch = new Date(LAUNCH_DATE)
  const current = new Date(dateString)
  const diff = current.getTime() - launch.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
}
