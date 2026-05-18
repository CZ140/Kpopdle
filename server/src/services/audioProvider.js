import { getDeezerPreview, searchDeezerPreview } from './deezerPreview.js'
import * as cache from '../utils/cache.js'

export async function getPreviewUrl(song, artistName = '') {
  const cacheKey = `preview-${song.id}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  // Primary: Deezer by ID
  if (song.deezerId) {
    try {
      const url = await getDeezerPreview(song.deezerId)
      if (url) {
        cache.set(cacheKey, url)
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
        cache.set(cacheKey, url)
        return url
      }
    } catch (err) {
      console.warn(`Deezer search failed for "${song.title}":`, err.message)
    }
  }

  console.error(`No preview URL available for "${song.title}"`)
  return null
}
