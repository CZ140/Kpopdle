import { useState, useEffect, useRef } from 'react'
import { useGame } from '../hooks/useGame'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useStats } from '../hooks/useStats'
import { GAME_STATES } from '../lib/constants'
import AudioPlayer from './AudioPlayer'
import GuessList from './GuessList'
import GuessInput from './GuessInput'
import ResultModal from './ResultModal'

export default function Game({ onStartPractice }) {
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
    isArchive,
    makeGuess,
    skipGuess,
  } = useGame()

  const { play, stop, isPlaying, progress, currentDuration, setGuessNumber, volume, changeVolume } = useAudioPlayer(previewUrl)
  const { recordResult } = useStats()

  const [showResult, setShowResult] = useState(false)
  const resultRecorded = useRef(false)

  useEffect(() => {
    setGuessNumber(currentGuessNumber)
  }, [currentGuessNumber, setGuessNumber])

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING && !resultRecorded.current) {
      resultRecorded.current = true
      if (!isArchive) recordResult(gameState, guesses.length)
      setTimeout(() => setShowResult(true), 800)
    }
  }, [gameState, guesses.length, recordResult, isArchive])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: 'var(--color-primary)', borderRightColor: 'var(--color-secondary)' }} />
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
        volume={volume}
        onVolumeChange={changeVolume}
      />

      <GuessList guesses={guesses} />

      <GuessInput
        onGuess={makeGuess}
        onSkip={skipGuess}
        disabled={gameOver}
      />

      {gameOver && !showResult && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setShowResult(true)}
            className="text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            View Results
          </button>

          {!isArchive && onStartPractice && (
            <>
              <span className="text-white/20 text-sm">·</span>
              <button
                onClick={onStartPractice}
                className="flex items-center gap-1.5 text-sm font-semibold text-white/40 hover:text-white/70 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Practice Mode
              </button>
            </>
          )}
        </div>
      )}

      {showResult && (
        <ResultModal
          gameState={gameState}
          revealedSong={revealedSong}
          guesses={guesses}
          gameNumber={gameNumber}
          isArchive={isArchive}
          onStartPractice={!isArchive ? onStartPractice : undefined}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  )
}
