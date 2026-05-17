import { getSpotifyPreview } from './spotifyPreview.js'
import { getDeezerPreview, searchDeezerPreview } from './deezerPreview.js'
import * as cache from '../utils/cache.js'

export async function getPreviewUrl(song) {
  const cacheKey = `preview-${song.id}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  // Try Spotify embed scraping first
  if (song.spotifyId) {
    try {
      const url = await getSpotifyPreview(song.spotifyId)
      if (url) {
        cache.set(cacheKey, url)
        return url
      }
    } catch (err) {
      console.warn(`Spotify preview failed for "${song.title}":`, err.message)
    }
  }

  // Fallback to Deezer
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

  // Final fallback: search Deezer by title
  try {
    const url = await searchDeezerPreview(song.title)
    if (url) {
      cache.set(cacheKey, url)
      return url
    }
  } catch (err) {
    console.warn(`Deezer search failed for "${song.title}":`, err.message)
  }

  console.error(`No preview URL available for "${song.title}"`)
  return null
}
