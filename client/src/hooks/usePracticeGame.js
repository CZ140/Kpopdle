import { useState, useEffect, useCallback } from 'react'
import { MAX_GUESSES, GAME_STATES } from '../lib/constants'
import { fetchPracticeGame, submitPracticeGuess } from '../lib/api'
import { useGroup } from '../lib/GroupContext'

export function usePracticeGame() {
  const group = useGroup()

  const [practiceSongId, setPracticeSongId] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [gameState, setGameState] = useState(GAME_STATES.PLAYING)
  const [revealedSong, setRevealedSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const currentGuessNumber = guesses.length

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPracticeGame(group)
        if (!cancelled) {
          setPreviewUrl(data.previewUrl)
          setPracticeSongId(data.practiceSongId)
        }
      } catch {
        if (!cancelled) setError('Failed to load practice song. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [group])

  const makeGuess = useCallback(async (songTitle) => {
    if (gameState !== GAME_STATES.PLAYING) return
    if (currentGuessNumber >= MAX_GUESSES) return

    try {
      const result = await submitPracticeGuess(group, practiceSongId, songTitle)
      const newGuess = { song: songTitle, type: result.correct ? 'correct' : 'wrong' }
      const newGuesses = [...guesses, newGuess]
      setGuesses(newGuesses)

      if (result.correct) {
        setGameState(GAME_STATES.WON)
        setRevealedSong(result.song)
      } else if (newGuesses.length >= MAX_GUESSES) {
        // Server no longer returns the song on wrong guesses — fetch it explicitly
        const reveal = await submitPracticeGuess(group, practiceSongId, '')
        setGameState(GAME_STATES.LOST)
        setRevealedSong(reveal.song)
      }
    } catch {
      setError('Failed to submit guess. Please try again.')
    }
  }, [group, gameState, currentGuessNumber, guesses, practiceSongId])

  const skipGuess = useCallback(async () => {
    if (gameState !== GAME_STATES.PLAYING) return
    if (currentGuessNumber >= MAX_GUESSES) return

    const newGuess = { song: null, type: 'skipped' }
    const newGuesses = [...guesses, newGuess]
    setGuesses(newGuesses)

    if (newGuesses.length >= MAX_GUESSES) {
      try {
        const result = await submitPracticeGuess(group, practiceSongId, '')
        setGameState(GAME_STATES.LOST)
        setRevealedSong(result.song)
      } catch {
        setError('Failed to load answer. Please refresh.')
      }
    }
  }, [group, gameState, currentGuessNumber, guesses, practiceSongId])

  return {
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
