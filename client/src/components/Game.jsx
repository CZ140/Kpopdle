import { useState, useEffect, useRef } from 'react'
import { useGame } from '../hooks/useGame'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useStats } from '../hooks/useStats'
import { GAME_STATES, DIFFICULTIES } from '../lib/constants'
import { useDifficulty } from '../lib/GroupContext'
import AudioPlayer from './AudioPlayer'
import GuessList from './GuessList'
import GuessInput from './GuessInput'
import ResultModal from './ResultModal'
import { recordGameResult, fetchCommunityStats } from '../lib/api'
import { useGroup } from '../lib/GroupContext'
import { useAuth } from '../lib/AuthContext'

export default function Game({ onStartPractice }) {
  const {
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
  } = useGame()

  const group = useGroup()
  const difficulty = useDifficulty()
  const { user, login } = useAuth()
  const gameOver = gameState !== GAME_STATES.PLAYING
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const { play, stop, isPlaying, progress, currentDuration, maxDuration, durations, setGuessNumber, volume, changeVolume, hasAudio } = useAudioPlayer(previewUrl, DIFFICULTIES[difficulty], gameOver)
  const { recordResult } = useStats()

  const [showResult, setShowResult] = useState(false)
  const [communityStats, setCommunityStats] = useState(null)
  const resultRecorded = useRef(false)

  useEffect(() => {
    setGuessNumber(currentGuessNumber)
  }, [currentGuessNumber, setGuessNumber])

  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING && !resultRecorded.current) {
      resultRecorded.current = true
      if (!isArchive) {
        recordResult(gameState, guesses.length)
        // Show login prompt once per browser session to logged-out users
        if (user === null && !sessionStorage.getItem('loginPromptShown')) {
          sessionStorage.setItem('loginPromptShown', '1')
          setTimeout(() => setShowLoginPrompt(true), 2000)
        }
        if (revealedSong) {
          recordGameResult({
            groupId: group,
            songId: revealedSong.id,
            songTitle: revealedSong.title,
            guessCount: guesses.length,
            won: gameState === GAME_STATES.WON,
            wrongGuesses: guesses.filter(g => g.type === 'wrong').map(g => g.song),
            hintsUsed,
            difficulty,
          })
        }
      }
      setTimeout(() => {
        setShowResult(true)
        // Fetch after the delay so the user's own record is already written to the DB
        if (!isArchive && gameDate) {
          fetchCommunityStats(group, gameDate).then(setCommunityStats).catch(() => {})
        }
      }, 800)
    }
  }, [gameState, guesses, recordResult, isArchive, revealedSong, group, hintsUsed, difficulty])

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

  return (
    <div className="w-full max-w-lg mx-auto pt-8">
      <AudioPlayer
        play={play}
        stop={stop}
        isPlaying={isPlaying}
        progress={progress}
        currentDuration={currentDuration}
        maxDuration={maxDuration}
        durations={durations}
        isGameOver={gameOver}
        volume={volume}
        onVolumeChange={changeVolume}
        hasAudio={hasAudio}
      />

      {!gameOver && hints && (
        <div className="mt-3 mb-1">
          {hintsUsed > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {hintsUsed >= 1 && (
                <p className="text-xs text-center text-white/50">
                  💡 Era — <span className="text-white/70 font-medium">{hints.era}</span>
                </p>
              )}
              {hintsUsed >= 2 && (
                <p className="text-xs text-center text-white/50">
                  💡 Year — <span className="text-white/70 font-medium">{hints.year}</span>
                </p>
              )}
              {hintsUsed >= 3 && (
                <p className="text-xs text-center text-white/50">
                  💡 Starts with — <span className="text-white/70 font-medium">&ldquo;{hints.firstLetter}&rdquo;</span>
                </p>
              )}
            </div>
          )}
          {hintsUsed < 3 && (
            <div className="text-center">
              <button
                onClick={revealHint}
                className="text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                {hintsUsed === 0 ? '💡 Need a hint?' : `💡 Another hint? (${3 - hintsUsed} left)`}
              </button>
            </div>
          )}
        </div>
      )}

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

      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop" onClick={() => setShowLoginPrompt(false)}>
          <div
            className="modal-panel rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <p className="text-base font-bold text-white">Save your streak</p>
              <button onClick={() => setShowLoginPrompt(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-white/50 mb-5">Sign in with Google to sync your streaks and stats across any device.</p>
            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-[#0d0d14] font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      )}

      {showResult && (
        <ResultModal
          gameState={gameState}
          revealedSong={revealedSong}
          guesses={guesses}
          gameNumber={gameNumber}
          hintsUsed={hintsUsed}
          isArchive={isArchive}
          communityStats={communityStats}
          onStartPractice={!isArchive ? onStartPractice : undefined}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  )
}
