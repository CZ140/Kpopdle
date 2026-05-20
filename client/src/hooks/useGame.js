import { useState, useEffect, useCallback } from 'react'
import { MAX_GUESSES, GAME_STATES } from '../lib/constants'
import { fetchDailyGame, fetchArchiveGame, submitGuess } from '../lib/api'
import { loadGameState, saveGameState, loadArchiveGameState, saveArchiveGameState } from '../lib/storage'
import { useGroup, useArchiveDate } from '../lib/GroupContext'

export function useGame() {
  const group = useGroup()
  const archiveDate = useArchiveDate()
  const isArchive = archiveDate !== null

  const [gameDate, setGameDate] = useState(null)
  const [gameNumber, setGameNumber] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [gameState, setGameState] = useState(GAME_STATES.PLAYING)
  const [revealedSong, setRevealedSong] = useState(null)
  const [hints, setHints] = useState(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const currentGuessNumber = guesses.length

  useEffect(() => {
    setLoading(true)
    setError(null)
    setGuesses([])
    setGameState(GAME_STATES.PLAYING)
    setRevealedSong(null)

    async function init() {
      try {
        const data = isArchive
          ? await fetchArchiveGame(group, archiveDate)
          : await fetchDailyGame(group)

        setGameDate(data.gameDate)
        setGameNumber(data.gameNumber)
        setPreviewUrl(data.previewUrl)
        setHints(data.hints || null)

        const saved = isArchive
          ? loadArchiveGameState(group, data.gameDate)
          : loadGameState(group, data.gameDate)

        if (saved) {
          setGuesses(saved.guesses)
          setGameState(saved.gameState)
          setRevealedSong(saved.revealedSong)
          setHintsUsed(saved.hintsUsed || 0)
        } else {
          setHintsUsed(0)
        }
      } catch (err) {
        setError('Failed to load game. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [group, archiveDate])

  useEffect(() => {
    if (gameDate && !loading) {
      const state = { guesses, gameState, revealedSong, hintsUsed }
      if (isArchive) {
        saveArchiveGameState(group, gameDate, state)
      } else {
        saveGameState(group, gameDate, state)
      }
    }
  }, [group, gameDate, guesses, gameState, revealedSong, hintsUsed, loading, isArchive])

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

  const revealHint = useCallback(() => {
    setHintsUsed(prev => Math.min(prev + 1, 3))
  }, [])

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
    hints,
    hintsUsed,
    revealHint,
    loading,
    error,
    isArchive,
    makeGuess,
    skipGuess,
  }
}
