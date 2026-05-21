import { useState, useCallback, useEffect } from 'react'
import { loadStats, saveStats } from '../lib/storage'
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
      const today = new Date().toISOString().split('T')[0]
      // Guard against double-recording when the component remounts with an already-completed game
      if (prev.lastPlayedDate === today) return prev

      const updated = { ...prev }
      updated.gamesPlayed += 1

      if (gameState === 'won') {
        updated.gamesWon += 1
        updated.currentStreak += 1
        updated.maxStreak = Math.max(updated.maxStreak, updated.currentStreak)
        updated.guessDistribution = { ...updated.guessDistribution }
        updated.guessDistribution[String(guessCount)] =
          (updated.guessDistribution[String(guessCount)] || 0) + 1
      } else {
        updated.currentStreak = 0
      }

      updated.lastPlayedDate = today
      saveStats(group, updated)
      if (user) saveCloudStats(group, updated)

      return updated
    })
  }, [group, user])

  return { stats, recordResult }
}
