import { useState, useEffect, useCallback } from 'react'
import { fetchSongList } from '../lib/api'
import { useGroup } from '../lib/GroupContext'
import { captureException } from '../lib/observability'

export function useSongList() {
  const group = useGroup()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    async function load() {
      try {
        const data = await fetchSongList(group)
        if (!cancelled) setSongs(data.songs)
      } catch (err) {
        if (!cancelled) setError(true)
        captureException(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [group, reloadKey])

  const retry = useCallback(() => setReloadKey((k) => k + 1), [])

  return { songs, loading, error, retry }
}
