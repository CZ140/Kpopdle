import { useState, useEffect, useRef } from 'react'
import { GroupContext } from '../../lib/GroupContext'
import { nameInitials } from '../../lib/initials'
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
  const me = state.players.find((p) => p.id === myId)
  const myResult = liveResults[myId]
  const oppResult = opponent ? liveResults[opponent.id] : null
  const iAnswered = !!myResult?.correct

  // Tick for the countdown / elapsed timer.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  // Each new round mounts a fresh <audio> element (the reveal in between has
  // none), so reset the auto-play guard or only round 1 would ever play.
  useEffect(() => {
    playedRef.current = false
    // Intentional reset when the round's clip changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNeedsTap(false)
  }, [round?.clipToken])

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
    const mineResult = reveal.results.find((r) => r.playerId === myId)
    const theirResult = reveal.results.find((r) => r.playerId !== myId)
    const isLast = reveal.roundIndex + 1 >= state.totalRounds
    return (
      <div>
        <div className="text-center mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40 mb-3">
            Round {reveal.roundIndex + 1} of {state.totalRounds} · Reveal
          </p>
          <h2 className="text-3xl font-black tracking-tight">{reveal.answer.title}</h2>
          <p className="text-sm text-white/50 mt-1">
            {reveal.answer.groupDisplayName}
            {reveal.answer.releaseYear ? ` · ${reveal.answer.releaseYear}` : ''}
          </p>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          <RevealRow result={mineResult} side="you" isYou />
          <RevealRow result={theirResult} side="foe" />
        </div>

        <Scoreboard
          scores={reveal.scores}
          myId={myId}
          totalRounds={state.totalRounds}
          activeRoundIndex={reveal.roundIndex}
        />

        <p className="text-center text-[10px] font-mono uppercase tracking-[0.14em] text-white/30 mt-6">
          {isLast ? 'Tallying the result…' : 'Next round starting…'}
        </p>
      </div>
    )
  }

  // --- Active round ---------------------------------------------------------
  const audioUrl = `/api/battle/${state.id}/clip/${round.clipToken}`
  const progress = Math.min(100, (elapsedMs / windowMs) * 100)
  const elapsedSec = (elapsedMs / 1000).toFixed(1)

  return (
    <div>
      {/* Arena header strip — live indicator + round meta */}
      <div className="btl-arena rounded-2xl mb-5">
        <div className="btl-arena-head">
          <span><span className="live-dot" />LIVE</span>
          <span>{round.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${round.roundIndex + 1} / ${round.totalRounds}`}</span>
          <span className="timer tabular-nums">{elapsedSec}s</span>
        </div>

        {inCountdown ? (
          <div className="py-10 text-center px-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40 mb-3">Get ready…</p>
            <p className="btl-countdown-num tabular-nums">{Math.ceil(countdownMs / 1000)}</p>
          </div>
        ) : (
          <div className="px-5 py-5">
            <audio ref={audioRef} src={audioUrl} preload="auto" />
            <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden mb-2">
              <div className="btl-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <VolumeSlider volume={volume} onChange={changeVolume} />
          </div>
        )}
      </div>

      {/* Active-round body */}
      {!inCountdown && (
        <>
          {needsTap && (
            <button onClick={tapToPlay} className="btl-btn-primary w-full mb-4 px-4 py-3.5 rounded-xl font-bold">
              ▶ Tap to start the clip
            </button>
          )}

          {iAnswered ? (
            <div className="px-4 py-4 rounded-xl border border-emerald-500/30 text-center"
                 style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(6,182,212,0.10))' }}>
              <p className="font-black text-emerald-300 text-lg">Correct! +{myResult.points}</p>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40 mt-1">Waiting for the round to finish…</p>
            </div>
          ) : (
            <GroupContext.Provider value={{ id: songListId }}>
              <GuessInput onGuess={onGuess} disabled={inCountdown} />
            </GroupContext.Provider>
          )}
          {myResult && !myResult.correct && (
            <p className="text-center text-xs text-white/50 mt-3">Not quite — keep guessing!</p>
          )}
        </>
      )}

      {inCountdown && (
        <p className="text-center text-xs text-white/45 mt-2">
          <span className="font-bold text-white/65">{me?.displayName ?? 'You'}</span>
          <span className="mx-2 text-white/25">vs</span>
          <span className="font-bold text-white/65">{opponent?.displayName ?? '…'}</span>
        </p>
      )}

      <Scoreboard
        scores={state.players.map((p) => ({ playerId: p.id, displayName: p.displayName, score: p.score }))}
        myId={myId}
        oppResult={oppResult}
        opponent={opponent}
        totalRounds={state.totalRounds}
        activeRoundIndex={round.roundIndex}
      />
    </div>
  )
}

// Reveal row — one per player, you-pink or foe-cyan tinted.
function RevealRow({ result, side, isYou }) {
  if (!result) return null
  const youColor = side === 'you'
  return (
    <div className={`btl-side ${side}`}>
      <span className="av">{nameInitials(result.displayName)}</span>
      <div className="who">
        <div className="label">{isYou ? '▸ YOU' : 'OPPONENT ◂'}</div>
        <div className="name">{result.displayName}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40">
          {result.elapsedMs != null ? `${(result.elapsedMs / 1000).toFixed(1)}s` : 'no answer'}
        </p>
        <p className={`text-xl font-black tabular-nums ${youColor ? 'text-[#FF2D78]' : 'text-[#06B6D4]'}`}>
          +{result.points}
        </p>
      </div>
    </div>
  )
}

// Live scoreboard: pips strip on top, you/vs/foe scores below.
function Scoreboard({ scores, myId, opponent, oppResult, totalRounds = 5, activeRoundIndex = -1 }) {
  const me = scores.find((s) => s.playerId === myId)
  const opp = scores.find((s) => s.playerId !== myId)
  if (!me) return null

  return (
    <div className="mt-6 pt-5 border-t border-white/[0.08]">
      <div className="btl-pips justify-center mb-4">
        {Array.from({ length: totalRounds }).map((_, i) => (
          <div key={i} className={`pip ${i === activeRoundIndex ? 'active' : ''}`} />
        ))}
      </div>
      <div className="btl-score-row">
        <div className="text-left">
          <div className="btl-score-num you tabular-nums">{me.score}</div>
          <div className="btl-score-lbl">{me.displayName} · YOU</div>
        </div>
        <div className="btl-vs-pill">VS</div>
        <div className="text-right">
          <div className="btl-score-num foe tabular-nums">{opp?.score ?? 0}</div>
          <div className="btl-score-lbl">{opp?.displayName ?? 'OPP'}{oppResult?.correct ? ' · GOT IT ✓' : opponent && !opponent.connected ? ' · DISCONNECTED' : ''}</div>
        </div>
      </div>
    </div>
  )
}
