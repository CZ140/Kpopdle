import { describe, it, expect } from 'vitest'
import { generateShareText } from './share'

const guess = (type) => ({ type, song: type === 'correct' ? 'Answer' : 'Wrong' })

describe('generateShareText — header', () => {
  it('includes game name, number, and guess count on a win', () => {
    const text = generateShareText(42, [guess('correct')], true)
    expect(text).toContain('K-POPDLE #42 1/6')
  })

  it('shows X/6 on a loss', () => {
    const text = generateShareText(1, [guess('wrong'), guess('wrong')], false)
    expect(text).toContain('X/6')
  })

  it('uses a custom game name', () => {
    const text = generateShareText(5, [guess('correct')], true, 'normal', 0, 'TWICEDLE')
    expect(text).toContain('TWICEDLE #5')
  })

  it('prefixes difficulty badge for easy mode', () => {
    const text = generateShareText(1, [guess('correct')], true, 'easy')
    expect(text).toContain('[EASY]')
  })

  it('prefixes difficulty badge for hard mode', () => {
    const text = generateShareText(1, [guess('correct')], true, 'hard')
    expect(text).toContain('[HARD]')
  })

  it('has no badge for normal mode', () => {
    const text = generateShareText(1, [guess('correct')], true, 'normal')
    expect(text).not.toContain('[NORMAL]')
    expect(text).not.toContain('[')
  })
})

describe('generateShareText — emoji grid', () => {
  it('uses 🟩 for a correct guess', () => {
    const text = generateShareText(1, [guess('correct')], true)
    expect(text).toContain('🟩')
  })

  it('uses 🟥 for a wrong guess', () => {
    const text = generateShareText(1, [guess('wrong')], false)
    expect(text).toContain('🟥')
  })

  it('uses ⬜ for a skipped guess', () => {
    const text = generateShareText(1, [guess('skipped')], false)
    expect(text).toContain('⬜')
  })

  it('emits one emoji per guess in the correct order', () => {
    const guesses = [guess('wrong'), guess('skipped'), guess('correct')]
    const text = generateShareText(1, guesses, true)
    const grid = text.split('\n\n')[1].split('\n')[0]
    expect(grid).toBe('🟥⬜🟩')
  })

  it('produces a 6-emoji grid for a 6-guess win', () => {
    const guesses = [
      guess('wrong'), guess('wrong'), guess('wrong'),
      guess('wrong'), guess('wrong'), guess('correct'),
    ]
    const text = generateShareText(1, guesses, true)
    const grid = text.split('\n\n')[1].split('\n')[0]
    expect([...grid].filter(c => c !== '\n').length).toBe(6)
    expect(grid.endsWith('🟩')).toBe(true)
  })
})

describe('generateShareText — hint row', () => {
  it('omits the hint row when no hints were used', () => {
    const text = generateShareText(1, [guess('correct')], true, 'normal', 0)
    expect(text).not.toContain('💡')
  })

  it('shows one 💡 for one hint used', () => {
    const text = generateShareText(1, [guess('correct')], true, 'normal', 1)
    expect(text).toContain('\n💡')
  })

  it('shows three 💡 for three hints used', () => {
    const text = generateShareText(1, [guess('correct')], true, 'normal', 3)
    expect(text).toContain('💡💡💡')
  })
})
