export function getKSTDateString() {
  // Simply shift UTC by +9h — no timezone offset manipulation needed since Date.now() is always UTC
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}
