import { useState, useEffect, useRef, useMemo } from 'react'
import { useGame } from '../hooks/useGame'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useStats } from '../hooks/useStats'
import { GAME_STATES } from '../lib/constants'
import { useSnippetLadder, useArchiveDate } from '../lib/GroupContext'
import GuessInput from './GuessInput'
import ResultModal from './ResultModal'
import VolumeSlider from './VolumeSlider'
import { recordGameResult, fetchCommunityStats, fetchGroups } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useSound } from '../lib/SoundContext'

// Total visualized track length on the timeline. Matches the design's 12s
// horizon — the longest snippet (6s) fills half, leaving headroom on the right.
const TOTAL_TRACK = 12

// ─── Audio console (custom, design-aligned) ─────────────────────────────────
function AudioConsole({ play, stop, isPlaying, currentDuration, durations, currentGuessNumber, totalAttempts, volume, onVolumeChange }) {
  // The "unlocked" duration on the timeline shows what the *current* attempt
  // can hear (currentDuration), not the longest possible snippet.
  const unlocked = Math.min(currentDuration, TOTAL_TRACK)
  const fillPct = (unlocked / TOTAL_TRACK) * 100

  return (
    <div className="gtg-audio">
      <div className={`gtg-play ${isPlaying ? 'is-playing' : ''}`}>
        <button
          className="gtg-play-btn"
          onClick={isPlaying ? stop : play}
          aria-label={isPlaying ? 'Stop snippet' : 'Play snippet'}
          type="button"
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      <div className="gtg-timeline">
        <div className="gtg-tl-meta">
          <span className="tl-now"><span className="tl-dot" />{unlocked}s</span>
          <span className="tl-total">/ {TOTAL_TRACK}s</span>
        </div>
        <div className="gtg-tl-bar">
          <div className="tl-fill" style={{ width: fillPct + '%' }} />
          {durations.map((s, i) => {
            const pct = (s / TOTAL_TRACK) * 100
            return (
              <div key={i} className={`tl-mark ${i < currentGuessNumber ? 'reached' : ''}`} style={{ left: pct + '%' }}>
                <span className="tl-mark-label">{s}s</span>
              </div>
            )
          })}
        </div>
        <div className="gtg-tl-cap">
          SNIPPET · TRY {Math.min(currentGuessNumber + 1, totalAttempts)} OF {totalAttempts}
        </div>
        {onVolumeChange && (
          <div className="gtg-volume">
            <VolumeSlider volume={volume} onChange={onVolumeChange} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 3-orb attempts row ─────────────────────────────────────────────────────
function AttemptsRow({ guesses, totalAttempts, gameOver }) {
  return (
    <div className="gtg-attempts">
      <div className="att-lbl">ATTEMPTS</div>
      <div className="att-orbs">
        {Array.from({ length: totalAttempts }, (_, i) => {
          const g = guesses[i]
          let state = 'empty'
          let label
          if (g) {
            if (g.type === 'correct') state = 'correct'
            else if (g.type === 'wrong') state = 'wrong'
            else if (g.type === 'skipped') state = 'wrong'
            label = g.song ? g.song.toUpperCase() : 'SKIPPED'
          } else if (i === guesses.length && !gameOver) {
            state = 'current'
          }
          return (
            <div key={i} className={`att-orb ${state}`}>
              <div className="att-num">{i + 1}</div>
              <div className="att-glyph">
                {state === 'wrong'   && '✕'}
                {state === 'correct' && '✓'}
                {state === 'current' && <span className="att-pulse" />}
              </div>
              {label && <div className="att-label">{label}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Group chip ─────────────────────────────────────────────────────────────
function GroupChip({ group, status, onClick }) {
  const interactive = status === 'default'
  return (
    <button
      className={`gtg-chip ${status}`}
      style={{ '--gp': group.p, '--gs': group.s }}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      type="button"
      aria-label={`Guess ${group.name}`}
    >
      <div className="chip-row">
        <div className="chip-dots">
          <span style={{ background: group.p, color: group.p }} />
          <span style={{ background: group.s, color: group.s }} />
        </div>
        {status === 'wrong' && (
          <div className="chip-badge wrong" aria-label="Wrong">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>
          </div>
        )}
        {status === 'correct' && (
          <div className="chip-badge correct" aria-label="Correct">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 L10 17 L19 7"/></svg>
          </div>
        )}
        {status === 'answer' && (
          <div className="chip-badge answer" aria-label="Today's answer">
            <span className="cb-ring" />
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M12 2 L14.5 8.5 L21 9 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9 L9.5 8.5 Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="chip-name">{group.name}</div>
      <div className="chip-foot">
        <span className="chip-meta">{group.meta}</span>
        {status === 'wrong'   && <span className="chip-status-text wrong">WRONG GUESS</span>}
        {status === 'correct' && <span className="chip-status-text correct">YOUR ANSWER</span>}
        {status === 'answer'  && <span className="chip-status-text answer">TODAY&apos;S ANSWER</span>}
      </div>
    </button>
  )
}

export default function GuessTheGroupGame() {
  // Chip data is derived at runtime from the active group registry so the
  // answer-space picker grows automatically as new groups launch.
  const [chipGroups, setChipGroups] = useState([])
  useEffect(() => {
    fetchGroups()
      .then((gs) => {
        setChipGroups(
          gs.map((g) => ({
            id: g.id,
            name: g.displayName,
            meta: `${g.members} MEMBERS`,
            p: g.colors.primary,
            s: g.colors.secondary,
          }))
        )
      })
      .catch(() => {})
  }, [])

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

  const archiveDate = useArchiveDate()
  const snippetLadder = useSnippetLadder()
  const { user, login } = useAuth()
  const { playSound } = useSound()
  const gameOver = gameState !== GAME_STATES.PLAYING
  const totalAttempts = snippetLadder.length

  const { play, stop, isPlaying, currentDuration, durations, setGuessNumber, volume, changeVolume } = useAudioPlayer(previewUrl, snippetLadder, gameOver)
  const { recordResult } = useStats()

  const [showResult, setShowResult] = useState(false)
  const [communityStats, setCommunityStats] = useState(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const resultRecorded = useRef(false)
  const lastGuessCount = useRef(0)

  // Sync snippet ladder with the current attempt
  useEffect(() => {
    setGuessNumber(currentGuessNumber)
  }, [currentGuessNumber, setGuessNumber])

  // Per-guess sound
  useEffect(() => {
    if (guesses.length > lastGuessCount.current) {
      lastGuessCount.current = guesses.length
      const last = guesses[guesses.length - 1]
      if (last?.type === 'correct') playSound('correct')
      else if (last?.type === 'wrong') playSound('wrong')
    }
  }, [guesses, playSound])

  // Record + show result modal once on game over
  useEffect(() => {
    if (gameState !== GAME_STATES.PLAYING && !resultRecorded.current) {
      resultRecorded.current = true
      if (gameState === GAME_STATES.WON) playSound('win')
      else if (gameState === GAME_STATES.LOST) playSound('loss')
      if (!isArchive) {
        recordResult(gameState, guesses.length)
        if (user === null && !sessionStorage.getItem('loginPromptShown')) {
          sessionStorage.setItem('loginPromptShown', '1')
          setTimeout(() => setShowLoginPrompt(true), 2000)
        }
        if (revealedSong) {
          recordGameResult({
            groupId: 'guess-the-group',
            songId: revealedSong.id,
            songTitle: revealedSong.title,
            guessCount: guesses.length,
            won: gameState === GAME_STATES.WON,
            wrongGuesses: guesses.filter(g => g.type === 'wrong').map(g => g.song),
            hintsUsed: 0,
            difficulty: 'normal',
          })
        }
      }
      setTimeout(() => {
        setShowResult(true)
        if (!isArchive && gameDate) {
          fetchCommunityStats('guess-the-group', gameDate).then(setCommunityStats).catch(() => {})
        }
      }, 800)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, guesses, isArchive, revealedSong])

  // Build the chip-status map from the player's wrong guesses + winning/loss outcome.
  // Wrong guesses map to 'wrong', the winning guess to 'correct', and on a loss the
  // revealed group's chip becomes 'answer'. Remaining chips are 'default' (in-play)
  // or 'disabled' once the game is over.
  const chipStatus = useMemo(() => {
    const status = {}
    const correctName = revealedSong?.groupDisplayName?.toLowerCase()
    for (const g of guesses) {
      if (g.type === 'wrong' && g.song) {
        const match = chipGroups.find(c => c.name.toLowerCase() === g.song.toLowerCase())
        if (match) status[match.id] = 'wrong'
      } else if (g.type === 'correct' && g.song) {
        const match = chipGroups.find(c => c.name.toLowerCase() === g.song.toLowerCase())
        if (match) status[match.id] = 'correct'
      }
    }
    if (gameState === GAME_STATES.LOST && correctName) {
      const match = chipGroups.find(c => c.name.toLowerCase() === correctName)
      if (match) status[match.id] = 'answer'
    }
    return status
  }, [guesses, gameState, revealedSong, chipGroups])

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
    <div className={`gtg ${gameOver ? 'is-over' : ''} w-full`}>
      <div className="gtg-content">
        {/* Hero */}
        <header className="gtg-hero">
          <div className="hero-pill">CROSS-GROUP · {totalAttempts} TRIES</div>
          <h1 className="hero-title">Guess the Group</h1>
          <p className="hero-sub">
            Name the K-pop group from the clip.
            <span className="hs-sep">·</span>
            Pick a card, or type the name.
            {gameNumber != null && (<>
              <span className="hs-sep">·</span>
              <span className="font-mono">#{gameNumber}{archiveDate ? ` · ${archiveDate}` : ''}</span>
            </>)}
          </p>
        </header>

        {/* Audio + attempts */}
        <div className="gtg-console">
          <AudioConsole
            play={play}
            stop={stop}
            isPlaying={isPlaying}
            currentDuration={currentDuration}
            durations={durations}
            currentGuessNumber={currentGuessNumber}
            totalAttempts={totalAttempts}
            volume={volume}
            onVolumeChange={changeVolume}
          />
          <AttemptsRow guesses={guesses} totalAttempts={totalAttempts} gameOver={gameOver} />
        </div>

        {/* Group picker — primary affordance */}
        <div className={`gtg-grid ${gameOver ? 'is-over' : ''}`}>
          {chipGroups.map((g) => {
            const status = chipStatus[g.id] || (gameOver ? 'disabled' : 'default')
            return (
              <GroupChip
                key={g.id}
                group={g}
                status={status}
                onClick={() => makeGuess(g.name)}
              />
            )
          })}
        </div>

        {/* Typeahead — secondary affordance */}
        {!gameOver && (
          <div className="gtg-typeahead">
            <GuessInput onGuess={makeGuess} onSkip={skipGuess} disabled={gameOver} />
          </div>
        )}

        {/* Reveal panel */}
        {gameOver && revealedSong && (
          <div className={`gtg-reveal ${gameState === GAME_STATES.WON ? 'won' : 'lost'}`}>
            <div className="rv-tag">
              {gameState === GAME_STATES.WON
                ? `SOLVED · TRY ${guesses.length} OF ${totalAttempts}`
                : 'OUT OF TRIES · ANSWER REVEALED'}
            </div>
            <div className="rv-group">{revealedSong.groupDisplayName}</div>
            <div className="rv-song">
              <span className="rv-eyebrow">TODAY&apos;S TRACK</span>
              <span className="rv-song-name">{revealedSong.title}</span>
              {(revealedSong.album || revealedSong.releaseYear) && (
                <span className="rv-song-meta">
                  {[revealedSong.album, revealedSong.releaseYear].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            {!showResult && (
              <div className="rv-actions">
                <button
                  onClick={() => setShowResult(true)}
                  className="gtg-btn-primary"
                  type="button"
                >
                  VIEW RESULTS<span className="gs-arrow">→</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
          gameDate={gameDate}
          hintsUsed={0}
          isArchive={isArchive}
          communityStats={communityStats}
          gameName="Guess the Group"
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  )
}
