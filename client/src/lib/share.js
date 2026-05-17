import { MAX_GUESSES } from './constants'

export function generateShareText(gameNumber, guesses, won) {
  const guessCount = won ? guesses.length : 'X'
  const header = `Twicedle #${gameNumber} ${guessCount}/${MAX_GUESSES}`

  const grid = guesses
    .map((g) => {
      if (g.type === 'correct') return '\u{1F7E9}'
      if (g.type === 'skipped') return '\u{2B1C}'
      return '\u{1F7E5}'
    })
    .join('')

  return `${header}\n\n${grid}`
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
