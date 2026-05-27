export function getKSTDateString() {
  // Simply shift UTC by +9h — no timezone offset manipulation needed since Date.now() is always UTC
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

// KST date N days from today (negative = past). Used for streak gap detection.
export function getKSTDateStringOffset(days) {
  const d = new Date(Date.now() + 9 * 3600000)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
