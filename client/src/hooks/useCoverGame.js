import { useState, useEffect, useCallback } from 'react'
import { MAX_GUESSES, GAME_STATES } from '../lib/constants'
import { fetchDailyCoverGame, fetchArchiveCoverGame, submitCoverGuess } from '../lib/api'
import {
  loadCoverGameState,
  saveCoverGameState,
  loadCoverArchiveGameState,
  saveCoverArchiveGameState,
} from '../lib/storage'
import { useGroup, useArchiveDate } from '../lib/GroupContext'

// Coverdle variant of useGame — identical 6-guess loop, but it fetches the
// album-cover endpoints and exposes `coverUrl` instead of `previewUrl`. State is
// persisted under the `${group}-cover-*` storage namespace (FR-7) so it never
// collides with the audio daily.
export function useCoverGame() {
  const group = useGroup()
  const archiveDate = useArchiveDate()
  const isArchive = archiveDate !== null

  const [gameDate, setGameDate] = useState(null)
  const [gameNumber, setGameNumber] = useState(null)
  const [coverUrl, setCoverUrl] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [gameState, setGameState] = useState(GAME_STATES.PLAYING)
  // `revealedAlbum` is { album, releaseYear, coverUrl, tracks } — the server
  // hands it back when the game ends. Named for the answer space (albums).
  const [revealedAlbum, setRevealedAlbum] = useState(null)
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
    setRevealedAlbum(null)

    async function init() {
      try {
        const data = isArchive
          ? await fetchArchiveCoverGame(group, archiveDate)
          : await fetchDailyCoverGame(group)

        setGameDate(data.gameDate)
        setGameNumber(data.gameNumber)
        setCoverUrl(data.coverUrl)
        setHints(data.hints || null)

        const saved = isArchive
          ? loadCoverArchiveGameState(group, data.gameDate)
          : loadCoverGameState(group, data.gameDate)

        if (saved) {
          setGuesses(saved.guesses)
          setGameState(saved.gameState)
          setRevealedAlbum(saved.revealedAlbum ?? null)
          setHintsUsed(saved.hintsUsed || 0)
        } else {
          setHintsUsed(0)
        }
      } catch {
        setError('Failed to load game. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [group, archiveDate])

  useEffect(() => {
    if (gameDate && !loading) {
      const state = { guesses, gameState, revealedAlbum, hintsUsed }
      if (isArchive) {
        saveCoverArchiveGameState(group, gameDate, state)
      } else {
        saveCoverGameState(group, gameDate, state)
      }
    }
  }, [group, gameDate, guesses, gameState, revealedAlbum, hintsUsed, loading, isArchive])

  const makeGuess = useCallback(async (albumName) => {
    if (gameState !== GAME_STATES.PLAYING) return
    if (currentGuessNumber >= MAX_GUESSES) return

    try {
      const result = await submitCoverGuess(group, gameDate, albumName)

      // `song` is reused as the guess-row label by GuessList — keep the field
      // name (the row doesn't care that the value is now an album).
      const newGuess = {
        song: albumName,
        type: result.correct ? 'correct' : 'wrong',
      }

      const newGuesses = [...guesses, newGuess]
      setGuesses(newGuesses)

      if (result.correct) {
        setGameState(GAME_STATES.WON)
        setRevealedAlbum(result.album)
      } else if (newGuesses.length >= MAX_GUESSES) {
        // Server withholds the answer on wrong guesses — fetch it explicitly
        const reveal = await submitCoverGuess(group, gameDate, '')
        setGameState(GAME_STATES.LOST)
        setRevealedAlbum(reveal.album)
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
        const result = await submitCoverGuess(group, gameDate, '')
        setGameState(GAME_STATES.LOST)
        setRevealedAlbum(result.album)
      } catch {
        setError('Failed to load answer. Please refresh.')
      }
    }
  }, [group, gameState, currentGuessNumber, guesses, gameDate])

  return {
    gameDate,
    gameNumber,
    coverUrl,
    guesses,
    gameState,
    currentGuessNumber,
    revealedAlbum,
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
