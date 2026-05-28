import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getBattleSocket, getPlayerToken, getSavedName, saveName } from '../lib/battleSocket'
import { syncServerTime } from '../lib/serverTime'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { ALL_GROUP_IDS, GROUP_META } from '../lib/constants'
import { loadStats } from '../lib/storage'
import { useAuth } from '../lib/AuthContext'
import { useSound } from '../lib/SoundContext'
import { nameInitials } from '../lib/initials'
import Lobby from '../components/battle/Lobby'
import RoundView from '../components/battle/RoundView'
import ResultScreen from '../components/battle/ResultScreen'
import GameAboutSection from '../components/GameAboutSection'

const SCOPES = [
  { id: 'all', label: 'All groups' },
  ...ALL_GROUP_IDS.filter((id) => id !== 'kpopdle').map((id) => ({
    id,
    label: GROUP_META[id].displayName,
  })),
]

export default function BattlePage() {
  // Single "/battle/*" route — the matchId is the splat. Using one route (rather
  // than separate /battle and /battle/:matchId) means create -> room is a
  // re-render of the same instance, not an unmount/remount, so the battle:state
  // listener is never detached mid-flow (which previously dropped a join broadcast).
  const splat = useParams()['*'] || ''
  const matchId = splat.split('/')[0] || null
  const navigate = useNavigate()

  useDocumentMeta({
    title: 'K-POPDLE Battle — Live 1v1 Song Guessing',
    description: 'Challenge a friend to a real-time K-pop song-guessing battle. Same clips, race to guess, best score wins.',
    path: '/battle',
  })

  const [name, setName] = useState(getSavedName)
  const [nameDraft, setNameDraft] = useState(getSavedName)
  const [scope, setScope] = useState('all')
  const [state, setState] = useState(null)
  const [myId, setMyId] = useState(null)
  const [error, setError] = useState(null)
  const [round, setRound] = useState(null) // latest battle:round_start payload
  const [reveal, setReveal] = useState(null) // latest battle:round_reveal payload
  const [liveResults, setLiveResults] = useState({}) // playerId -> { correct, points } for the active round
  const [matchOver, setMatchOver] = useState(null) // battle:match_over payload

  // Attach socket listeners for this page's lifetime (the socket itself is a
  // singleton that outlives route remounts — see battleSocket.js).
  useEffect(() => {
    const socket = getBattleSocket()
    const onState = (s) => { setState(s); setError(null) }
    const onError = (e) => setError(e)
    const onRoundStart = (payload) => {
      setRound(payload)
      setReveal(null)
      setLiveResults({}) // fresh round
      setMatchOver(null) // (covers rematch)
    }
    const onGuessResult = (r) => {
      setLiveResults((prev) => ({ ...prev, [r.playerId]: { correct: r.correct, points: r.points } }))
    }
    const onReveal = (payload) => setReveal(payload)
    const onMatchOver = (payload) => setMatchOver(payload)
    socket.on('battle:state', onState)
    socket.on('battle:error', onError)
    socket.on('battle:round_start', onRoundStart)
    socket.on('battle:guess_result', onGuessResult)
    socket.on('battle:round_reveal', onReveal)
    socket.on('battle:match_over', onMatchOver)
    // Sync the server clock once so the round countdown lines up (FR-5).
    syncServerTime()
    return () => {
      socket.off('battle:state', onState)
      socket.off('battle:error', onError)
      socket.off('battle:round_start', onRoundStart)
      socket.off('battle:guess_result', onGuessResult)
      socket.off('battle:round_reveal', onReveal)
      socket.off('battle:match_over', onMatchOver)
    }
  }, [])

  // Join when we know which match + who we are, and RE-join on every (re)connect
  // so a dropped/restored socket always pulls fresh room state.
  useEffect(() => {
    if (!matchId || !name) return
    const socket = getBattleSocket()
    const join = () =>
      socket.emit(
        'battle:join',
        { matchId, displayName: name, playerToken: getPlayerToken() },
        (res) => {
          if (res?.error) setError(res.error)
          else { setMyId(res.playerId); setState(res.state) }
        },
      )
    if (socket.connected) join()
    socket.on('connect', join) // resync on reconnect
    return () => socket.off('connect', join)
  }, [matchId, name])

  const handleCreate = useCallback(() => {
    const finalName = nameDraft.trim() || 'Player'
    saveName(finalName)
    setName(finalName)
    const socket = getBattleSocket()
    const create = () =>
      socket.emit(
        'battle:create',
        { scope, displayName: finalName, playerToken: getPlayerToken() },
        (res) => {
          if (res?.error) { setError(res.error); return }
          setMyId(res.playerId)
          setState(res.state)
          navigate(`/battle/${res.matchId}`)
        },
      )
    if (socket.connected) create()
    else socket.once('connect', create)
  }, [nameDraft, scope, navigate])

  const handleConfirmName = useCallback(() => {
    const finalName = nameDraft.trim() || 'Player'
    saveName(finalName)
    setName(finalName)
  }, [nameDraft])

  const handleReady = useCallback(() => getBattleSocket().emit('battle:ready'), [])

  const handleGuess = useCallback((guess) => {
    if (!round) return
    getBattleSocket().emit('battle:guess', { roundIndex: round.roundIndex, guess })
  }, [round])

  const handleRematch = useCallback(() => getBattleSocket().emit('battle:rematch'), [])

  // --- Render ---------------------------------------------------------------
  // The Battle palette is the §0 cross-group pair (EC4899 + 6366F1). Setting
  // --color-* here cascades into GuessInput's themed autocomplete and into all
  // the .btl-* classes that read from var(--btl-you|foe).
  const shell = (children, { wide = false } = {}) => (
    <div
      className="relative min-h-screen text-white flex flex-col items-center px-4 sm:px-6 py-6"
      style={{ '--color-primary': '#EC4899', '--color-secondary': '#6366F1' }}
    >
      <div className="kp-backdrop">
        <div className="kp-grid-noise" />
        {/* Two-tone backdrop: pink-left + indigo-right, the §0 cross-group palette */}
        <div className="kp-orb" style={{ width: 560, height: 560, background: 'radial-gradient(circle, #EC4899 0%, transparent 65%)', top: -160, left: -180, opacity: 0.38, animationDelay: '0s' }} />
        <div className="kp-orb" style={{ width: 560, height: 560, background: 'radial-gradient(circle, #6366F1 0%, transparent 65%)', bottom: -160, right: -180, opacity: 0.38, animationDelay: '-9s' }} />
      </div>
      <div className="btl-line" />

      <div className={`relative z-10 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} flex items-center justify-between gap-2 mb-6 sm:mb-8`}>
        <Link to="/" className="btl-back">← K-POPDLE</Link>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <StreakPill />
          <AccountPill />
          <span className="btl-chip"><span className="live-dot" />BATTLE</span>
        </div>
      </div>
      <div className={`relative z-10 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} flex flex-col gap-5`}>{children}</div>
    </div>
  )

  // Terminal errors (match expired, server restarted, full, no songs). Any
  // battle:state broadcast clears `error`, so this only shows for dead-ends.
  if (error) {
    const isNotFound = error.code === 'not_found'
    return shell(
      <div className="text-center py-10">
        <h1 className="text-2xl font-black tracking-tight mb-2">
          {isNotFound ? 'Match not found' : 'Battle ended'}
        </h1>
        <p className="text-sm text-white/50 mb-8">
          {error.message || 'This battle has expired or never existed.'}
        </p>
        <Link to="/battle" className="btl-cta inline-flex w-auto px-6 py-3.5">
          Start a new battle
        </Link>
      </div>,
    )
  }

  // Need a display name before joining a shared link.
  if (matchId && !name) {
    return shell(
      <div className="text-center py-8">
        <div className="btl-pill mb-6 mx-auto"><span className="pip" />Incoming challenge<span className="pip foe" /></div>
        <h1 className="text-3xl font-black tracking-tight mb-2">Join the battle</h1>
        <p className="text-sm text-white/55 mb-8">Pick a name your opponent will see.</p>
        <NameInput value={nameDraft} onChange={setNameDraft} onSubmit={handleConfirmName} />
        <button onClick={handleConfirmName} className="btl-cta mt-4">Join</button>
      </div>,
    )
  }

  // Create screen.
  if (!matchId) {
    return shell(
      <div className="py-2">
        <div className="text-center mb-8">
          <div className="btl-pill mb-6 mx-auto"><span className="pip" />1v1 · Best of 5<span className="pip foe" /></div>
          <h1 className="btl-title justify-center">
            <span className="side-l">BAT</span>
            <span className="vs">VS</span>
            <span className="side-r">TLE</span>
          </h1>
          <p className="text-sm text-white/55 max-w-xs mx-auto leading-relaxed mt-4">
            Challenge a friend to a live 1v1. Same clip, fastest correct guess wins the round.
          </p>
        </div>

        <label className="block text-[10px] font-mono uppercase tracking-[0.18em] text-white/38 mb-2">Your name</label>
        <NameInput value={nameDraft} onChange={setNameDraft} onSubmit={handleCreate} />

        <label className="block text-[10px] font-mono uppercase tracking-[0.18em] text-white/38 mt-5 mb-2">Songs from</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.14] text-white focus:outline-none focus:border-[#EC4899]/50 transition-colors"
        >
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#0d0b1a]">{s.label}</option>
          ))}
        </select>

        <button onClick={handleCreate} className="btl-cta mt-6">CREATE MATCH →</button>

        <GameAboutSection
          eyebrow="Live 1v1 K-pop song battle"
          title="About K-POPDLE Battle — Real-time K-pop Heardle 1v1"
          paragraphs={[
            'K-POPDLE Battle is a live, real-time 1v1 version of the daily Heardle. Both players hear the exact same clip at the exact same moment over WebSockets, race to type the correct song, and the faster correct guess takes the round. Matches are best-of-five, with a sudden-death tiebreaker if the score lands at 2-2.',
            'You can scope a match to "all groups" (the full 500+ song cross-group pool) or to a single group when you want a focused TWICE-vs-TWICE, BLACKPINK-vs-BLACKPINK, or any other group-specific showdown. Pick a display name, pick a scope, hit Create Match, and share the URL — whoever opens it joins your room. No accounts, no install, runs in the browser.',
            'Round scoring rewards speed: a correct guess scores points scaled to how quickly you locked it in, so a fast 2-second answer beats a slow 8-second one even though both are correct. Streaks and per-group stats keep accumulating across regular K-POPDLE play, so practicing the daily Heardle directly sharpens your reflexes for Battle.',
          ]}
          howToPlay={[
            'Type a display name and pick which groups\' songs to draw from.',
            'Hit "Create Match" and copy the link — share it with whoever you\'re challenging.',
            'Once both players are in the lobby, click "Ready." The first clip starts the moment both sides ready up.',
            'Type your guess as fast as you can. Best-of-five rounds; sudden death at 2-2.',
          ]}
        />
      </div>,
    )
  }

  // ===== Persistent scoreboard for every in-match phase =====
  // Lobby still renders the scoreboard with placeholder state so the visual anchor is there from
  // the moment you land in the room — even before the opponent joins.
  if (state && state.phase === 'FINISHED' && matchOver) {
    return shell(
      <ResultScreen state={state} matchOver={matchOver} myId={myId} onRematch={handleRematch} />,
      { wide: true },
    )
  }

  const inRound = state && (round || reveal) && (state.phase === 'ROUND_ACTIVE' || state.phase === 'ROUND_REVEAL')
  if (inRound) {
    return shell(
      <>
        <MatchHeader state={state} myId={myId} round={round} reveal={reveal} liveResults={liveResults} />
        <RoundView state={state} round={round} reveal={reveal} myId={myId} liveResults={liveResults} onGuess={handleGuess} />
      </>,
      { wide: true },
    )
  }

  // Lobby (waiting / ready-up).
  return shell(
    <>
      <MatchHeader state={state} myId={myId} lobby />
      <Lobby state={state} myId={myId} onReady={handleReady} />
    </>,
    { wide: true },
  )
}

// MatchHeader — the persistent two-tone scoreboard at the top of every
// in-match screen. Shows monogram avatars + display names + status + live
// score for both sides, with a center VS plate. The lobby variant shows a
// dimmed empty foe seat until the opponent joins.
function MatchHeader({ state, myId, round, reveal, liveResults = {}, lobby = false }) {
  if (!state) return null
  const me = state.players.find((p) => p.id === myId)
  const opp = state.players.find((p) => p.id !== myId)
  const suddenDeath = round?.suddenDeath || reveal?.suddenDeath
  return (
    <div className={`btl-scoreboard ${suddenDeath ? 'sudden' : ''}`}>
      <SideBlock side="you" player={me} liveResult={liveResults[me?.id]} reveal={reveal} lobby={lobby} />
      <span className={`btl-vs-plate ${suddenDeath ? 'sudden' : ''}`}>VS</span>
      <SideBlock side="foe" player={opp} liveResult={liveResults[opp?.id]} reveal={reveal} lobby={lobby} dim={!opp} />
    </div>
  )
}

function SideBlock({ side, player, liveResult, reveal, lobby, dim }) {
  if (!player) {
    return (
      <div className={`btl-pblock ${side} dim`}>
        <span className="btl-mono dim">?</span>
        <div className="btl-pmeta">
          <div className="btl-ptag">{side === 'you' ? 'YOU' : 'OPPONENT'}</div>
          <div className="btl-pname text-white/40">Waiting…</div>
          <div className="btl-pstatus gone">No one here yet</div>
        </div>
        <div className="btl-pscore opacity-40">0</div>
      </div>
    )
  }
  const status = computeStatus({ player, liveResult, reveal, lobby })
  return (
    <div className={`btl-pblock ${side} ${dim ? 'dim' : ''}`}>
      <span className="btl-mono">
        {nameInitials(player.displayName)}
        <span className={`btl-presence ${player.connected ? '' : 'off'}`} />
      </span>
      <div className="btl-pmeta">
        <div className="btl-ptag">{side === 'you' ? '▸ YOU' : 'OPPONENT ◂'}</div>
        <div className="btl-pname">{player.displayName}</div>
        <PlayerStatus status={status} side={side} />
      </div>
      <div className="btl-pscore tabular-nums">{player.score ?? 0}</div>
    </div>
  )
}

// Derive a status from the available signals. Lobby phase has no liveResult yet;
// reveal carries the final per-round outcome; ROUND_ACTIVE uses liveResult.
function computeStatus({ player, liveResult, reveal, lobby }) {
  if (!player.connected) return { kind: 'gone', text: 'Disconnected' }
  if (lobby) return { kind: 'guessing', text: player.ready ? 'Ready' : 'Not ready' }
  if (reveal) {
    const r = reveal.results?.find((x) => x.playerId === player.id)
    if (r?.correct) return { kind: 'got', text: `+${r.points} · ${(r.elapsedMs / 1000).toFixed(1)}s` }
    return { kind: 'missed', text: 'no answer' }
  }
  if (liveResult?.correct) return { kind: 'got', text: `Got it · +${liveResult.points}` }
  return { kind: 'guessing', text: 'Guessing…' }
}

function PlayerStatus({ status }) {
  const cls = `btl-pstatus ${status.kind}`
  if (status.kind === 'guessing') {
    return (
      <div className={cls}>
        <span className="btl-pdot" />
        {status.text}
      </div>
    )
  }
  if (status.kind === 'got') return <div className={cls}>✓ {status.text}</div>
  if (status.kind === 'missed') return <div className={cls}>✕ {status.text}</div>
  return <div className={cls}>{status.text}</div>
}

function NameInput({ value, onChange, onSubmit }) {
  return (
    <input
      type="text"
      value={value}
      maxLength={24}
      placeholder="e.g. ONCE_4ever"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.14] text-white placeholder-white/25 focus:outline-none focus:border-[#EC4899]/60 transition-colors"
    />
  )
}

// Top-strip pills, ported from HomePage's top strip so Battle picks up the
// same identity (streak + account) every other page shows. `bestStreak` is the
// max of any single-group current streak — Battle isn't tied to one group, and
// this matches what HomePage displays.
function StreakPill() {
  const bestStreak = ALL_GROUP_IDS.reduce(
    (max, id) => Math.max(max, loadStats(id).currentStreak),
    0,
  )
  return (
    <div
      className="kp-pill flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-white/62 text-[11px] sm:text-[12px] font-mono uppercase tracking-[0.08em]"
      title={`Best current streak across all groups: ${bestStreak}`}
    >
      <span aria-hidden="true">🔥</span>
      {/* Hide the "Streak" word on mobile to save horizontal room next to the BATTLE chip */}
      <span className="hidden sm:inline">Streak</span>
      <b className="font-bold text-[#FF2D78] tabular-nums">{bestStreak}</b>
    </div>
  )
}

function AccountPill() {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const { playSound } = useSound()
  // `user === undefined` is still-loading — render nothing so the strip doesn't
  // flicker a Sign-in button that immediately swaps to an avatar.
  if (user === undefined) return null
  if (user) {
    return (
      <button
        onClick={() => { playSound('click'); navigate('/account') }}
        className="kp-pill flex items-center gap-2 px-2 sm:px-2.5 py-1.5 rounded-full text-white/62 text-[11px] sm:text-[12px] hover:border-white/30 transition-colors"
        title={`Account — ${user.email}`}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.displayName} className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">
            {user.displayName?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <span className="hidden sm:inline max-w-[110px] truncate">{user.displayName}</span>
      </button>
    )
  }
  return (
    <button
      onClick={() => { playSound('click'); login() }}
      className="kp-pill px-2.5 sm:px-3 py-1.5 rounded-full text-white/62 text-[11px] sm:text-[12px] hover:border-white/30 hover:text-white/80 transition-colors"
    >
      Sign in
    </button>
  )
}
