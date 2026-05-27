// Speed-based round scoring (BATTLE_SPEC GD-5). Pure + deterministic so it's
// trivially unit-testable. Time is measured from when the clip starts (startAt),
// computed on the server clock (FR-18). A miss / no correct guess scores 0.
export function scoreGuess(elapsedMs) {
  const seconds = elapsedMs / 1000
  if (seconds < 0) return 0
  if (seconds <= 3) return 5
  if (seconds <= 8) return 4
  if (seconds <= 15) return 3
  if (seconds <= 25) return 2
  if (seconds <= 30) return 1
  return 0
}
