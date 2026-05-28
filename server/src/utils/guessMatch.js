// Shared title-matching for the cross-group autocomplete, which appends a
// " (Group Name)" label to disambiguate same-titled songs across groups. We
// strip that label before comparing to the bare song title. Used by the
// K-POPDLE daily game and Battle mode (both draw from the labeled merged pool).
//
// NOTE: the per-group daily game (routes/game.js) intentionally does NOT use
// this — its titles are unlabeled and some legitimately contain parentheses
// (e.g. "TT (Japanese ver.)"), which this label-strip would mangle.

export function normalizeGuessTitle(guess) {
  const raw = String(guess ?? '').trim()
  const labelled = raw.match(/^(.+?)\s+\([^)]+\)$/)
  return (labelled ? labelled[1] : raw).trim()
}

export function isCorrectGuess(guess, songTitle) {
  return normalizeGuessTitle(guess).toLowerCase() === String(songTitle ?? '').toLowerCase()
}
