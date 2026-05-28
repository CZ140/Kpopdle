// First letter of each word, uppercased, capped at 2 chars. Falls back to the
// first 2 chars when there's only one word ("Soojin" → "SO"). Names like
// "Player One" become "PO", not "PL" — so the you/foe avatars stay visually
// distinct even when display names share a leading word.
export function nameInitials(name) {
  const s = (name || '?').trim()
  if (!s) return '?'
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
