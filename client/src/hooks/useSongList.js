import { useState, useEffect } from 'react'
import { fetchSongList } from '../lib/api'
import { useGroup } from '../lib/GroupContext'

export function useSongList() {
  const group = useGroup()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSongList(group)
        setSongs(data.songs)
      } catch {
        console.error('Failed to load song list')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [group])

  return { songs, loading }
}
