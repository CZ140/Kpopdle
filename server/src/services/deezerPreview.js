export async function getDeezerPreview(deezerTrackId, expectedTitle = null) {
  const response = await fetch(`https://api.deezer.com/track/${deezerTrackId}`)
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
  const response = await fetch(`https://api.deezer.com/search?q=${query}&limit=20`)
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
