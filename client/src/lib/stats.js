// Pure streak/stats reducer — extracted from useStats so the streak rules are
// unit-testable without React. Wordle-style daily streak: a win only extends
// the streak if the previous play was *yesterday*; any gap restarts it.
//
// `today` and `yesterday` are KST date strings (YYYY-MM-DD) passed in by the
// caller so this stays a pure function.
export function computeNextStats(prev, gameState, guessCount, today, yesterday) {
  // Idempotent guard: a result for today is already recorded (handles remounts
  // and React StrictMode double-invocation).
  if (prev.lastPlayedDate === today) return prev

  const next = { ...prev, guessDistribution: { ...prev.guessDistribution } }
  next.gamesPlayed += 1

  if (gameState === 'won') {
    next.gamesWon += 1
    // Continue the streak only across consecutive days; otherwise start fresh.
    next.currentStreak = prev.lastPlayedDate === yesterday ? prev.currentStreak + 1 : 1
    next.maxStreak = Math.max(prev.maxStreak, next.currentStreak)
    const key = String(guessCount)
    next.guessDistribution[key] = (next.guessDistribution[key] || 0) + 1
  } else {
    next.currentStreak = 0
  }

  next.lastPlayedDate = today
  return next
}
