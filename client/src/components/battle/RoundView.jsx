import { useState, useEffect, useRef } from 'react'
import { GroupContext } from '../../lib/GroupContext'
import { nameInitials } from '../../lib/initials'
import { toLocalTime } from '../../lib/serverTime'
import { getSavedVolume, saveVolume } from '../../lib/volume'
import GuessInput from '../GuessInput'

// One Battle round: synchronized countdown → auto-play clip with waveform +
// status pills + guess input → reveal. The persistent top scoreboard (rendered
// by BattlePage) carries the live score; this component renders everything
// below it.
export default function RoundView({ state, round, reveal, myId, liveResults, onGuess }) {
  const [now, setNow] = useState(() => Date.now())
  const [needsTap, setNeedsTap] = useState(false)
  const [volume, setVolume] = useState(getSavedVolume)
  const audioRef = useRef(null)
  const playedRef = useRef(false)

  const startLocal = round ? toLocalTime(round.startAt) : 0
  const countdownMs = startLocal - now
  const inCountdown = countdownMs > 0
  const elapsedMs = Math.max(0, now - startLocal)
  const windowMs = round?.windowMs ?? 30000
  const songListId = state.scope === 'all' ? 'kpopdle' : state.scope

  const opponent = state.players.find((p) => p.id !== myId)
  const me = state.players.find((p) => p.id === myId)
  const myResult = liveResults[myId]
  const oppResult = opponent ? liveResults[opponent.id] : null
  const iAnswered = !!myResult?.correct

  // Tick.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  // Each new round mounts a fresh <audio>, so reset the auto-play guard.
  useEffect(() => {
    playedRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNeedsTap(false)
  }, [round?.clipToken])

  // Start playback the moment startAt is reached.
  useEffect(() => {
    if (!round || reveal || playedRef.current) return
    if (now >= startLocal && audioRef.current) {
      playedRef.current = true
      audioRef.current.play().catch(() => setNeedsTap(true))
    }
  }, [now, startLocal, round, reveal])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume, round, reveal])

  const changeVolume = (v) => setVolume(saveVolume(v))

  const tapToPlay = () => {
    setNeedsTap(false)
    audioRef.current?.play().catch(() => setNeedsTap(true))
  }

  // --- Reveal ---------------------------------------------------------------
  if (reveal) {
    const isLast = reveal.roundIndex + 1 >= state.totalRounds
    return (
      <div className="btl-reveal">
        <div className="btl-reveal-head">
          <span className="btl-reveal-tag">Round {reveal.roundIndex + 1} of {state.totalRounds} · Reveal</span>
          <span className="btl-reveal-auto">
            <span className="auto-dot" />
            {isLast ? 'Tallying…' : 'Next round'}
          </span>
        </div>
        <h2 className="btl-reveal-title">{reveal.answer.title}</h2>
        <div className="btl-reveal-meta">
          <b>{reveal.answer.groupDisplayName}</b>
          {reveal.answer.releaseYear ? ` · ${reveal.answer.releaseYear}` : ''}
        </div>
        <div className="btl-reveal-results">
          <RevealRow result={reveal.results.find((r) => r.playerId === myId)} side="you" isYou />
          <RevealRow result={reveal.results.find((r) => r.playerId !== myId)} side="foe" />
        </div>
      </div>
    )
  }

  // --- Active round --------------------------------------------------------
  const audioUrl = `/api/battle/${state.id}/clip/${round.clipToken}`
  const progressFrac = Math.min(1, elapsedMs / windowMs)
  const elapsedSec = (elapsedMs / 1000).toFixed(1)

  return (
    <div className="flex flex-col gap-4">
      {round.suddenDeath && <SuddenDeathBanner />}

      {inCountdown ? (
        <div className="relative flex flex-col items-center justify-center py-10 sm:py-14">
          <div className="btl-count-ring" />
          <div className="btl-count-ring r2" />
          <div className="btl-count-ring r3" />
          <span className="btl-count tabular-nums">{Math.ceil(countdownMs / 1000)}</span>
          <p className="btl-count-sub">
            Get ready · {round.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${round.roundIndex + 1} of ${round.totalRounds}`}
          </p>
        </div>
      ) : needsTap ? (
        <div className="py-8 flex flex-col items-center">
          <div className="btl-autoplay-block">
            <div className="ap-glyph">▶</div>
            <h3>Tap to start the clip</h3>
            <p>Your browser blocked autoplay. Give it a tap and the round will sync up.</p>
            <button onClick={tapToPlay} className="btl-cta">PLAY CLIP</button>
          </div>
          <audio ref={audioRef} src={audioUrl} preload="auto" />
        </div>
      ) : (
        <>
          {/* Now-playing strip: elapsed · waveform · volume — no play button */}
          <div className="btl-now">
            <div className="btl-now-elapsed">
              <span>{elapsedSec}</span>
              <span className="lbl">Elapsed</span>
            </div>
            <Waveform progress={progressFrac} />
            <VolumeRail volume={volume} onChange={changeVolume} />
          </div>
          <audio ref={audioRef} src={audioUrl} preload="auto" />

          {/* Status pills — you / foe live state */}
          <div className="btl-status-row">
            <StatusPill side="you" player={me} liveResult={myResult} />
            <StatusPill side="foe" player={opponent} liveResult={oppResult} />
          </div>

          {/* Guess input (or correct splash) */}
          {iAnswered ? (
            <div
              className="px-4 py-4 rounded-xl border border-emerald-500/30 text-center"
              style={{ background: 'linear-gradient(135deg, color-mix(in oklab, #4ADE80 12%, transparent), color-mix(in oklab, #6366F1 10%, transparent))' }}
            >
              <p className="font-black text-emerald-300 text-lg">Correct! +{myResult.points}</p>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/40 mt-1">
                Waiting for the round to finish…
              </p>
            </div>
          ) : (
            <GroupContext.Provider value={{ id: songListId }}>
              <GuessInput onGuess={onGuess} disabled={inCountdown} />
            </GroupContext.Provider>
          )}
          {myResult && !myResult.correct && (
            <p className="text-center text-xs text-white/50 -mt-1">Not quite — keep guessing!</p>
          )}
        </>
      )}
    </div>
  )
}

// Decorative waveform: bars colored "played" up to the elapsed fraction, with a
// single "live" bar at the cursor that pulses. Not driven by real audio data —
// purely visual progress.
function Waveform({ progress, bars = 40 }) {
  const liveIdx = Math.floor(progress * bars)
  return (
    <div className="btl-wave-wrap min-w-0">
      <div className="btl-wave">
        {Array.from({ length: bars }).map((_, i) => {
          const h = 6 + Math.abs(Math.sin(i * 0.7) + Math.sin(i * 0.31)) * 14
          const cls = i < liveIdx ? 'played' : i === liveIdx ? 'live' : ''
          return <div key={i} className={`bar ${cls}`} style={{ height: `${h}px` }} />
        })}
      </div>
    </div>
  )
}

function VolumeRail({ volume, onChange }) {
  // Visual rail with native range overlaid for accessibility.
  const pct = Math.round(volume * 100)
  return (
    <div className="btl-vol">
      <div className="btl-vol-rail" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        onChange(v)
      }}>
        <div className="btl-vol-fill" style={{ width: `${pct}%` }} />
        <div className="btl-vol-knob" style={{ left: `${pct}%` }} />
      </div>
      <span className="btl-vol-lbl">VOL {pct}</span>
    </div>
  )
}

function StatusPill({ side, player, liveResult }) {
  if (!player) {
    return (
      <div className="btl-status-pill gone">
        <span className="side-mono">?</span>
        <span className="side-name">Opponent</span>
        <span className="side-state">— · —</span>
      </div>
    )
  }
  const initials = nameInitials(player.displayName)
  const status = !player.connected
    ? { cls: 'gone', text: 'Disconnected' }
    : liveResult?.correct
      ? { cls: 'got', text: `Got it · +${liveResult.points}` }
      : { cls: 'guessing', text: 'Guessing…' }
  return (
    <div className={`btl-status-pill ${side} ${status.cls}`}>
      <span className="side-mono">{initials}</span>
      <span className="side-name">{player.displayName}</span>
      <span className="side-state">
        {status.cls === 'guessing' && (
          <span className="side-dots"><span /><span /><span /></span>
        )}
        {status.cls === 'got' && '✓ '}
        {status.text}
      </span>
    </div>
  )
}

function RevealRow({ result, side, isYou }) {
  if (!result) return null
  const wonSide = result.correct
  return (
    <div className={`btl-result-row ${wonSide ? 'win' : 'miss'}`}>
      <span className="btl-mono" style={{ '--c': side === 'you' ? 'var(--btl-you)' : 'var(--btl-foe)' }}>
        {nameInitials(result.displayName)}
      </span>
      <div className="rmeta">
        <div className="rname">{result.displayName}{isYou ? ' (you)' : ''}</div>
        <div className="rtime">
          {result.elapsedMs != null ? `${(result.elapsedMs / 1000).toFixed(1)}s` : 'no answer'}
        </div>
      </div>
      <div className="rpts">{result.correct ? `+${result.points}` : '+0'}</div>
    </div>
  )
}

function SuddenDeathBanner() {
  return (
    <div className="btl-sudden-banner">
      <div className="btl-sudden-bolt">⚡</div>
      <div>
        <div className="btl-sudden-title">Sudden death</div>
        <span className="btl-sudden-rule">
          Tied after 5 — <b>first decisive round wins</b>
        </span>
      </div>
    </div>
  )
}
