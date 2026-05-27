import { describe, it, expect } from 'vitest'
import { normalizeGuessTitle, isCorrectGuess } from './guessMatch.js'

describe('guessMatch', () => {
  it('strips the " (Group Name)" autocomplete label', () => {
    expect(normalizeGuessTitle('Cheer Up (TWICE)')).toBe('Cheer Up')
    expect(normalizeGuessTitle('  Ditto  ')).toBe('Ditto')
  })

  it('matches case-insensitively, with or without a label', () => {
    expect(isCorrectGuess('cheer up (twice)', 'Cheer Up')).toBe(true)
    expect(isCorrectGuess('CHEER UP', 'Cheer Up')).toBe(true)
    expect(isCorrectGuess('Fancy', 'Cheer Up')).toBe(false)
  })

  it('handles empty / nullish guesses safely', () => {
    expect(isCorrectGuess('', 'Cheer Up')).toBe(false)
    expect(isCorrectGuess(undefined, 'Cheer Up')).toBe(false)
  })
})
