import { useState, useEffect, useCallback } from 'react'
import { fetchSongList } from '../lib/api'
import { useGroup, useCoverMode } from '../lib/GroupContext'
import { captureException } from '../lib/observability'

export function useSongList() {
  const group = useGroup()
  // Coverdle's autocomplete is deduped album names, not song titles. The
  // server's /:group/cover/albums-list endpoint returns the same {songs:[...]}
  // shape so this hook stays mode-agnostic past the mode-dependent URL.
  const coverMode = useCoverMode()
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
        const data = await fetchSongList(group, coverMode ? { mode: 'cover' } : undefined)
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
  }, [group, coverMode, reloadKey])

  const retry = useCallback(() => setReloadKey((k) => k + 1), [])

  return { songs, loading, error, retry }
}
