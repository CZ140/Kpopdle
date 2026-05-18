import { useState, useCallback } from 'react'
import { loadStats, saveStats } from '../lib/storage'
import { useGroup } from '../lib/GroupContext'

export function useStats() {
  const group = useGroup()
  const [stats, setStats] = useState(() => loadStats(group))

  const recordResult = useCallback((gameState, guessCount) => {
    setStats((prev) => {
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

      updated.lastPlayedDate = new Date().toISOString().split('T')[0]
      saveStats(group, updated)
      return updated
    })
  }, [group])

  return { stats, recordResult }
}
