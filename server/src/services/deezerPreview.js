export async function getDeezerPreview(deezerTrackId) {
  const response = await fetch(`https://api.deezer.com/track/${deezerTrackId}`)
  if (!response.ok) return null
  const data = await response.json()
  return data.preview || null
}

export async function searchDeezerPreview(artistName, songTitle) {
  const query = encodeURIComponent(`artist:"${artistName}" ${songTitle}`)
  const response = await fetch(`https://api.deezer.com/search?q=${query}&limit=10`)
  if (!response.ok) return null
  const data = await response.json()
  if (data.data && data.data.length > 0) {
    for (const track of data.data) {
      if (track.preview) return track.preview
    }
  }
  return null
}
