import { logger } from './observability.js'

const DEEZER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; kpopdle/1.0)',
  'Accept': 'application/json',
}
const TIMEOUT_MS = 30000

async function deezerFetch(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { headers: DEEZER_HEADERS, signal: controller.signal })
    clearTimeout(timer)
    return response
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

export async function getDeezerPreview(deezerTrackId, expectedTitle = null) {
  const response = await deezerFetch(`https://api.deezer.com/track/${deezerTrackId}`)
  if (!response.ok) return null
  const data = await response.json()
  if (!data.preview) return null

  if (expectedTitle && data.title) {
    const returned = data.title.toLowerCase().trim()
    const expected = expectedTitle.toLowerCase().trim()
    // Accept exact match OR "Korean prefix English title" pattern (returned ends with expected)
    if (returned !== expected && !returned.endsWith(expected)) {
      logger.warn(`Deezer ID ${deezerTrackId} returned "${data.title}" but expected "${expectedTitle}" — skipping`)
      return null
    }
  }

  return data.preview
}

// Album cover for a Deezer track. Same GET /track/{id} call as the preview
// client; the nested `album` object carries cover_small/medium/big/xl plus
// md5_image. We take cover_big (500²) — a good balance of quality and weight —
// and the md5 hash (handy if we ever want to build other sizes). Returns null
// when the track has no album cover so callers can skip the song (FR-8).
export async function getDeezerAlbumCover(deezerTrackId) {
  const response = await deezerFetch(`https://api.deezer.com/track/${deezerTrackId}`)
  if (!response.ok) return null
  const data = await response.json()
  const album = data.album
  if (!album) return null

  const coverUrl = album.cover_big || album.cover_xl || album.cover_medium || album.cover
  if (!coverUrl) return null

  return { coverUrl, coverMd5: album.md5_image ?? null }
}

export async function searchDeezerPreview(artistName, songTitle) {
  // Note: artist:"name" quoted filter returns broken results on Deezer's API.
  // Unquoted "ArtistName SongTitle" search + validating both fields is reliable.
  const query = encodeURIComponent(`${artistName} ${songTitle}`)
  const response = await deezerFetch(`https://api.deezer.com/search?q=${query}&limit=20`)
  if (!response.ok) return null
  const data = await response.json()
  if (!data.data || data.data.length === 0) return null

  const normalizedTitle = songTitle.toLowerCase().trim()
  const normalizedArtist = artistName.toLowerCase().trim()
  for (const track of data.data) {
    const trackTitle = track.title?.toLowerCase().trim() ?? ''
    const titleMatch = trackTitle === normalizedTitle || trackTitle.endsWith(normalizedTitle)
    if (
      track.preview &&
      titleMatch &&
      track.artist?.name?.toLowerCase().trim() === normalizedArtist
    ) {
      return track.preview
    }
  }

  return null
}
