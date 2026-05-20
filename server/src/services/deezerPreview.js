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
    if (data.title.toLowerCase().trim() !== expectedTitle.toLowerCase().trim()) {
      console.warn(`Deezer ID ${deezerTrackId} returned "${data.title}" but expected "${expectedTitle}" — skipping`)
      return null
    }
  }

  return data.preview
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
    if (
      track.preview &&
      track.title?.toLowerCase().trim() === normalizedTitle &&
      track.artist?.name?.toLowerCase().trim() === normalizedArtist
    ) {
      return track.preview
    }
  }

  return null
}
