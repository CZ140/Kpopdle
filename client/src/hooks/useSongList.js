import { useState, useEffect } from 'react'
import { fetchSongList } from '../lib/api'

export function useSongList() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSongList()
        setSongs(data.songs)
      } catch {
        console.error('Failed to load song list')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { songs, loading }
}
