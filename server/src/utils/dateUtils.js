export function getKSTDateString() {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kst = new Date(now.getTime() + kstOffset + now.getTimezoneOffset() * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

// Calculate a game number (days since launch) for display
const LAUNCH_DATE = '2026-02-20'

export function getGameNumber(dateString) {
  const launch = new Date(LAUNCH_DATE)
  const current = new Date(dateString)
  const diff = current.getTime() - launch.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
}
