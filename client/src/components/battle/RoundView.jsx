import { useState, useEffect, useRef } from 'react'
import { GroupContext } from '../../lib/GroupContext'
import { toLocalTime } from '../../lib/serverTime'
import { getSavedVolume, saveVolume } from '../../lib/volume'
import GuessInput from '../GuessInput'
import VolumeSlider from '../VolumeSlider'

// One Battle round: a synchronized countdown, the clip (served opaquely from the
// proxy), the reused autocomplete, a live opponent indicator, and the reveal.
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
  // The autocomplete pulls from the scope's song list via GroupContext.
  const songListId = state.scope === 'all' ? 'kpopdle' : state.scope

  const opponent = state.players.find((p) => p.id !== myId)
  const myResult = liveResults[myId]
  const oppResult = opponent ? liveResults[opponent.id] : null
  const iAnswered = !!myResult?.correct

  // Tick for the countdown / elapsed timer.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  // Start playback the moment the synchronized clip start is reached.
  useEffect(() => {
    if (!round || reveal || playedRef.current) return
    if (now >= startLocal && audioRef.current) {
      playedRef.current = true
      audioRef.current.play().catch(() => setNeedsTap(true))
    }
  }, [now, startLocal, round, reveal])

  // Keep the audio element's volume in sync with the (persisted) preference.
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
    return (
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-white/30 mb-2">
          Round {reveal.roundIndex + 1} of {state.totalRounds}
        </p>
        <h2 className="text-2xl font-black tracking-tight">{reveal.answer.title}</h2>
        <p className="text-sm text-white/40 mt-1">
          {reveal.answer.groupDisplayName}
          {reveal.answer.releaseYear ? ` · ${reveal.answer.releaseYear}` : ''}
        </p>

        <div className="flex flex-col gap-2 mt-6">
          {reveal.results.map((r) => (
            <div key={r.playerId} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className="font-bold text-sm">
                {r.displayName}{r.playerId === myId ? ' (you)' : ''}
              </span>
              <span className="text-sm">
                <span className="text-white/40">{r.elapsedMs != null ? `${(r.elapsedMs / 1000).toFixed(1)}s · ` : 'no answer · '}</span>
                <span className="font-black text-[#EC4899]">+{r.points}</span>
              </span>
            </div>
          ))}
        </div>

        <Scoreboard scores={reveal.scores} myId={myId} />
        <p className="text-xs text-white/30 mt-6">The full 5-round match + winner arrive in the next milestone.</p>
      </div>
    )
  }

  // --- Active round ---------------------------------------------------------
  const audioUrl = `/api/battle/${state.id}/clip/${round.clipToken}`
  const progress = Math.min(100, (elapsedMs / windowMs) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-white/30">
          Round {round.roundIndex + 1} of {round.totalRounds}
        </span>
        <OpponentStatus opponent={opponent} result={oppResult} />
      </div>

      <audio ref={audioRef} src={audioUrl} preload="auto" />

      <div className="mb-5">
        <VolumeSlider volume={volume} onChange={changeVolume} />
      </div>

      {inCountdown ? (
        <div className="py-12 text-center">
          <p className="text-sm text-white/40 mb-2">Get ready…</p>
          <p className="text-6xl font-black text-[#EC4899] tabular-nums">{Math.ceil(countdownMs / 1000)}</p>
        </div>
      ) : (
        <div className="py-6">
          {/* progress / elapsed */}
          <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden mb-2">
            <div className="h-full bg-[#EC4899] transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-xs text-white/30 tabular-nums mb-6">{(elapsedMs / 1000).toFixed(1)}s</p>

          {needsTap && (
            <button onClick={tapToPlay} className="w-full mb-4 px-4 py-3 rounded-xl font-bold bg-[#EC4899] text-white">
              ▶ Tap to start the clip
            </button>
          )}

          {iAnswered ? (
            <div className="px-4 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <p className="font-bold text-emerald-400">Correct! +{myResult.points}</p>
              <p className="text-xs text-white/40 mt-1">Waiting for the round to finish…</p>
            </div>
          ) : (
            <GroupContext.Provider value={{ id: songListId }}>
              <GuessInput onGuess={onGuess} disabled={inCountdown} />
            </GroupContext.Provider>
          )}
          {myResult && !myResult.correct && (
            <p className="text-center text-xs text-white/40 mt-3">Not quite — keep guessing!</p>
          )}
        </div>
      )}

      <Scoreboard scores={state.players.map((p) => ({ playerId: p.id, displayName: p.displayName, score: p.score }))} myId={myId} />
    </div>
  )
}

function OpponentStatus({ opponent, result }) {
  if (!opponent) return <span className="text-xs text-white/30">—</span>
  let label = 'guessing…'
  let color = 'text-white/40'
  if (!opponent.connected) { label = 'disconnected'; color = 'text-white/20' }
  else if (result?.correct) { label = 'got it ✓'; color = 'text-emerald-400' }
  return (
    <span className={`text-xs font-medium ${color}`}>
      {opponent.displayName}: {label}
    </span>
  )
}

function Scoreboard({ scores, myId }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-white/[0.06]">
      {scores.map((s) => (
        <div key={s.playerId} className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-white/30">{s.displayName}{s.playerId === myId ? ' (you)' : ''}</p>
          <p className="text-xl font-black tabular-nums">{s.score}</p>
        </div>
      ))}
    </div>
  )
}
