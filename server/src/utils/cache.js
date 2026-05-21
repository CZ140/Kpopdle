const cache = new Map()
const DEFAULT_TTL = 60 * 60 * 1000 // 1 hour
const MAX_SIZE = 500

export function get(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  // Refresh insertion order so least-recently-used eviction stays accurate
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

export function set(key, value, ttl = DEFAULT_TTL) {
  if (cache.size >= MAX_SIZE) {
    // Map preserves insertion order — first key is the oldest
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl })
}
