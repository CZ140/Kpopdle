import { useState, useCallback, useEffect } from 'react'
import { loadStats, saveStats } from '../lib/storage'
import { computeNextStats } from '../lib/stats'
import { getKSTDateString, getKSTDateStringOffset } from '../lib/dateUtils'
import { useGroup } from '../lib/GroupContext'
import { useAuth } from '../lib/AuthContext'
import { fetchCloudStats, saveCloudStats } from '../lib/api'

// `groupOverride` lets Coverdle record its streaks under a `${group}-cover` key
// so they stay separate from the audio daily's stats (FR-7). Defaults to the
// route group for the audio game.
export function useStats(groupOverride) {
  const routeGroup = useGroup()
  const group = groupOverride ?? routeGroup
  const { user } = useAuth()
  const [stats, setStats] = useState(() => loadStats(group))

  // When logged in, load cloud stats for this group.
  // If cloud has more games played than localStorage, use cloud as source of truth.
  // Cover-mode keys (`*-cover`) are local-only — cloud sync covers audio dailies.
  useEffect(() => {
    if (!user || group.endsWith('-cover')) return
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
      if (user && !group.endsWith('-cover')) saveCloudStats(group, updated)
      return updated
    })
  }, [group, user])

  return { stats, recordResult }
}
