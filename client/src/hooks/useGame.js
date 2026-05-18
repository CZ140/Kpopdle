import { useState, useEffect, useCallback } from 'react'
import { MAX_GUESSES, GAME_STATES } from '../lib/constants'
import { fetchDailyGame, submitGuess } from '../lib/api'
import { loadGameState, saveGameState } from '../lib/storage'
import { useGroup } from '../lib/GroupContext'

export function useGame() {
  const group = useGroup()

  const [gameDate, setGameDate] = useState(null)
  const [gameNumber, setGameNumber] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [gameState, setGameState] = useState(GAME_STATES.PLAYING)
  const [revealedSong, setRevealedSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const currentGuessNumber = guesses.length

  useEffect(() => {
    async function init() {
      try {
        const data = await fetchDailyGame(group)
        setGameDate(data.gameDate)
        setGameNumber(data.gameNumber)
        setPreviewUrl(data.previewUrl)

        const saved = loadGameState(group, data.gameDate)
        if (saved) {
          setGuesses(saved.guesses)
          setGameState(saved.gameState)
          setRevealedSong(saved.revealedSong)
        }
      } catch (err) {
        setError('Failed to load today\'s game. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [group])

  useEffect(() => {
    if (gameDate && !loading) {
      saveGameState(group, gameDate, { guesses, gameState, revealedSong })
    }
  }, [group, gameDate, guesses, gameState, revealedSong, loading])

  const makeGuess = useCallback(async (songTitle) => {
    if (gameState !== GAME_STATES.PLAYING) return
    if (currentGuessNumber >= MAX_GUESSES) return

    try {
      const result = await submitGuess(group, gameDate, songTitle)

      const newGuess = {
        song: songTitle,
        type: result.correct ? 'correct' : 'wrong',
      }

      const newGuesses = [...guesses, newGuess]
      setGuesses(newGuesses)

      if (result.correct) {
        setGameState(GAME_STATES.WON)
        setRevealedSong(result.song)
      } else if (newGuesses.length >= MAX_GUESSES) {
        setGameState(GAME_STATES.LOST)
        setRevealedSong(result.song)
      }
    } catch {
      setError('Failed to submit guess. Please try again.')
    }
  }, [group, gameState, currentGuessNumber, guesses, gameDate])

  const skipGuess = useCallback(async () => {
    if (gameState !== GAME_STATES.PLAYING) return
    if (currentGuessNumber >= MAX_GUESSES) return

    const newGuess = { song: null, type: 'skipped' }
    const newGuesses = [...guesses, newGuess]
    setGuesses(newGuesses)

    if (newGuesses.length >= MAX_GUESSES) {
      try {
        const result = await submitGuess(group, gameDate, '')
        setGameState(GAME_STATES.LOST)
        setRevealedSong(result.song)
      } catch {
        setError('Failed to load answer. Please refresh.')
      }
    }
  }, [group, gameState, currentGuessNumber, guesses, gameDate])

  return {
    gameDate,
    gameNumber,
    previewUrl,
    guesses,
    gameState,
    currentGuessNumber,
    revealedSong,
    loading,
    error,
    makeGuess,
    skipGuess,
  }
}
