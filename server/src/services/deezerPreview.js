export async function getDeezerPreview(deezerTrackId) {
  const response = await fetch(`https://api.deezer.com/track/${deezerTrackId}`)

  if (!response.ok) return null

  const data = await response.json()

  if (data.preview) {
    return data.preview
  }

  return null
}

export async function searchDeezerPreview(songTitle) {
  const query = encodeURIComponent(`TWICE ${songTitle}`)
  const response = await fetch(`https://api.deezer.com/search?q=${query}&limit=10`)

  if (!response.ok) return null

  const data = await response.json()

  if (data.data && data.data.length > 0) {
    for (const track of data.data) {
      if (track.preview) {
        return track.preview
      }
    }
  }

  return null
}
