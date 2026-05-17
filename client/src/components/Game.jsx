import { useState, useEffect, useRef } from 'react'
import { useGame } from '../hooks/useGame'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useStats } from '../hooks/useStats'
import { GAME_STATES } from '../lib/constants'
import AudioPlayer from './AudioPlayer'
import GuessList from './GuessList'
import GuessInput from './GuessInput'
import ResultModal from './ResultModal'

export default function Game() {
  const {
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
  } = useGame()

  const { play, stop, isPlaying, progress, currentDuration, setGuessNumber } = useAudioPlayer(previewUrl)
  const { recordResult } = useStats()

  const [showResult, setShowResult] = useState(false)
  const resultRecorded = useRef(false)

  useEffect(() => {
    setGuessNumber(currentGuessNumber)
  }, [currentGuessNumber, setGuessNumber])

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING && !resultRecorded.current) {
      resultRecorded.current = true
      recordResult(gameState, guesses.length)
      setTimeout(() => setShowResult(true), 800)
    }
  }, [gameState, guesses.length, recordResult])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-transparent border-t-twice-hot-pink border-r-twice-purple animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-guess-wrong/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-guess-wrong/60">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    )
  }

  const gameOver = gameState !== GAME_STATES.PLAYING

  return (
    <div className="w-full max-w-lg mx-auto pt-8">
      <AudioPlayer
        play={play}
        stop={stop}
        isPlaying={isPlaying}
        progress={progress}
        currentDuration={currentDuration}
        gameOver={false}
      />

      <GuessList guesses={guesses} />

      <GuessInput
        onGuess={makeGuess}
        onSkip={skipGuess}
        disabled={gameOver}
      />

      {gameOver && !showResult && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowResult(true)}
            className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-twice-pink to-twice-purple hover:opacity-80 transition-opacity"
          >
            View Results
          </button>
        </div>
      )}

      {showResult && (
        <ResultModal
          gameState={gameState}
          revealedSong={revealedSong}
          guesses={guesses}
          gameNumber={gameNumber}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  )
}
