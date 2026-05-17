export async function getSpotifyPreview(spotifyTrackId) {
  const embedUrl = `https://open.spotify.com/embed/track/${spotifyTrackId}`

  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!response.ok) return null

  const html = await response.text()

  // Extract preview URL from the embed page's embedded JSON
  const match = html.match(/"audioPreview":\s*\{\s*"url":\s*"(https:\/\/p\.scdn\.co\/mp3-preview\/[^"]+)"/)
  if (match && match[1]) {
    return match[1]
  }

  return null
}
