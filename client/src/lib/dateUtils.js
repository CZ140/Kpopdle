export function getKSTDateString() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600000 + now.getTimezoneOffset() * 60000)
  return kst.toISOString().slice(0, 10)
}
