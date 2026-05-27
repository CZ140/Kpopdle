import { useState, useCallback, useEffect } from 'react'
import { loadStats, saveStats } from '../lib/storage'
import { computeNextStats } from '../lib/stats'
import { getKSTDateString, getKSTDateStringOffset } from '../lib/dateUtils'
import { useGroup } from '../lib/GroupContext'
import { useAuth } from '../lib/AuthContext'
import { fetchCloudStats, saveCloudStats } from '../lib/api'

export function useStats() {
  const group = useGroup()
  const { user } = useAuth()
  const [stats, setStats] = useState(() => loadStats(group))

  // When logged in, load cloud stats for this group.
  // If cloud has more games played than localStorage, use cloud as source of truth.
  useEffect(() => {
    if (!user) return
    fetchCloudStats().then(cloud => {
      const cloudGroup = cloud[group]
      if (!cloudGroup) return
      setStats(local => {
        if (cloudGroup.gamesPlayed > local.gamesPlayed) {
          saveStats(group, cloudGroup)
          return cloudGroup
        }
        return local
      })
    }).catch(() => {})
  }, [group, user?.id])

  const recordResult = useCallback((gameState, guessCount) => {
    setStats((prev) => {
      // KST dates so the streak aligns with the game day (which rolls at KST
      // midnight), not the browser's UTC day.
      const today = getKSTDateString()
      const yesterday = getKSTDateStringOffset(-1)
      const updated = computeNextStats(prev, gameState, guessCount, today, yesterday)

      if (updated === prev) return prev // already recorded today — no-op
      saveStats(group, updated)
      if (user) saveCloudStats(group, updated)
      return updated
    })
  }, [group, user])

  return { stats, recordResult }
}
