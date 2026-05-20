import { getDeezerPreview, searchDeezerPreview } from './deezerPreview.js'
import * as cache from '../utils/cache.js'

// Deezer signs URLs with a short expiry (~29 min). Parse it and cache only until
// 5 minutes before it expires so we never serve a stale URL.
function deezerTtl(url) {
  const match = url.match(/exp=(\d+)/)
  if (match) {
    const expiresMs = parseInt(match[1]) * 1000
    const ttl = expiresMs - Date.now() - 5 * 60 * 1000 // 5 min safety margin
    return Math.max(ttl, 60 * 1000) // at least 1 minute
  }
  return 20 * 60 * 1000 // fallback: 20 minutes
}

export async function getPreviewUrl(song, artistName = '') {
  const cacheKey = `preview-${song.id}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  // Primary: Deezer by ID
  if (song.deezerId) {
    try {
      const url = await getDeezerPreview(song.deezerId, song.title)
      if (url) {
        cache.set(cacheKey, url, deezerTtl(url))
        return url
      }
    } catch (err) {
      console.warn(`Deezer preview failed for "${song.title}":`, err.message)
    }
  }

  // Fallback: Deezer search by artist + title
  if (artistName) {
    try {
      const url = await searchDeezerPreview(artistName, song.title)
      if (url) {
        cache.set(cacheKey, url, deezerTtl(url))
        return url
      }
    } catch (err) {
      console.warn(`Deezer search failed for "${song.title}":`, err.message)
    }
  }

  console.error(`No preview URL available for "${song.title}"`)
  return null
}
