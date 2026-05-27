import { MAX_GUESSES } from './constants'

export function generateShareText(gameNumber, guesses, won, difficulty = 'normal', hintsUsed = 0, gameName = 'K-POPDLE', maxGuesses = MAX_GUESSES) {
  const guessCount = won ? guesses.length : 'X'
  const badge = difficulty !== 'normal' ? `[${difficulty.toUpperCase()}] ` : ''
  const header = `${badge}${gameName} #${gameNumber} ${guessCount}/${maxGuesses}`

  const grid = guesses
    .map((g) => {
      if (g.type === 'correct') return '\u{1F7E9}'
      if (g.type === 'skipped') return '\u{2B1C}'
      return '\u{1F7E5}'
    })
    .join('')

  const hintRow = hintsUsed > 0 ? '\n' + '\u{1F4A1}'.repeat(hintsUsed) : ''

  return `${header}\n\n${grid}${hintRow}`
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
