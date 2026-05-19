import { useState, useEffect, useRef } from 'react'
import { usePracticeGame } from '../hooks/usePracticeGame'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { GAME_STATES, DIFFICULTIES } from '../lib/constants'
import { useDifficulty } from '../lib/GroupContext'
import AudioPlayer from './AudioPlayer'
import GuessList from './GuessList'
import GuessInput from './GuessInput'
import ResultModal from './ResultModal'

export default function PracticeGame({ onPlayAgain }) {
  const {
    previewUrl,
    guesses,
    gameState,
    currentGuessNumber,
    revealedSong,
    loading,
    error,
    makeGuess,
    skipGuess,
  } = usePracticeGame()

  const difficulty = useDifficulty()
  const { play, stop, isPlaying, progress, currentDuration, setGuessNumber, volume, changeVolume } = useAudioPlayer(previewUrl, DIFFICULTIES[difficulty])

  const [showResult, setShowResult] = useState(false)
  const resultShown = useRef(false)

  useEffect(() => {
    setGuessNumber(currentGuessNumber)
  }, [currentGuessNumber, setGuessNumber])

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING && !resultShown.current) {
      resultShown.current = true
      setTimeout(() => setShowResult(true), 800)
    }
  }, [gameState])

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
      {/* Practice mode banner */}
      <div className="flex items-center justify-center mb-6">
        <div
          className="flex items-center gap-2.5 px-4 py-2 rounded-full border text-sm font-semibold"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)',
            background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            color: 'var(--color-primary)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 opacity-80">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Practice Mode
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
              color: 'color-mix(in srgb, var(--color-primary) 80%, white)',
            }}
          >
            Unlimited
          </span>
        </div>
      </div>

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
          <span className="text-white/20 text-sm">·</span>
          <button
            onClick={onPlayAgain}
            className="flex items-center gap-1.5 text-sm font-semibold text-white/40 hover:text-white/70 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            New Song
          </button>
        </div>
      )}

      {showResult && (
        <ResultModal
          gameState={gameState}
          revealedSong={revealedSong}
          guesses={guesses}
          gameNumber={null}
          isArchive={false}
          isPractice={true}
          onPlayAgain={onPlayAgain}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  )
}
