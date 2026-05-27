import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getBattleSocket, getPlayerToken, getSavedName, saveName } from '../lib/battleSocket'
import { syncServerTime } from '../lib/serverTime'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { ALL_GROUP_IDS, GROUP_META } from '../lib/constants'
import Lobby from '../components/battle/Lobby'
import RoundView from '../components/battle/RoundView'
import ResultScreen from '../components/battle/ResultScreen'

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
  // --color-* feed GuessInput's themed active-option styling on the battle page.
  const shell = (children) => (
    <div
      className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center px-4 py-10"
      style={{ '--color-primary': '#EC4899', '--color-secondary': '#A855F7' }}
    >
      <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-8 self-start">
        ← K-POPDLE
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )

  // Terminal errors (match expired, server restarted, full, no songs). Any
  // battle:state broadcast clears `error`, so this only shows for dead-ends.
  if (error) {
    const isNotFound = error.code === 'not_found'
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight mb-2">
          {isNotFound ? 'Match not found' : 'Battle ended'}
        </h1>
        <p className="text-sm text-white/40 mb-6">
          {error.message || 'This battle has expired or never existed.'}
        </p>
        <Link to="/battle" className="inline-block px-5 py-3 rounded-xl font-bold bg-[#EC4899] text-white hover:opacity-90 transition-opacity">
          Start a new battle
        </Link>
      </div>,
    )
  }

  // Need a display name before joining a shared link.
  if (matchId && !name) {
    return shell(
      <div>
        <h1 className="text-2xl font-black tracking-tight mb-1">Join the battle</h1>
        <p className="text-sm text-white/40 mb-6">Pick a name your opponent will see.</p>
        <NameInput value={nameDraft} onChange={setNameDraft} onSubmit={handleConfirmName} />
        <button
          onClick={handleConfirmName}
          className="w-full mt-3 px-5 py-3 rounded-xl font-bold bg-[#EC4899] text-white hover:opacity-90 transition-opacity"
        >
          Join
        </button>
      </div>,
    )
  }

  // Create screen.
  if (!matchId) {
    return shell(
      <div>
        <h1 className="text-3xl font-black tracking-tight mb-1">Battle</h1>
        <p className="text-sm text-white/40 mb-8">Challenge a friend to a live 1v1. Race to guess the song.</p>

        <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Your name</label>
        <NameInput value={nameDraft} onChange={setNameDraft} onSubmit={handleCreate} />

        <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mt-6 mb-2">Songs from</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-[#EC4899]/50"
        >
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#0a0a0f]">{s.label}</option>
          ))}
        </select>

        <button
          onClick={handleCreate}
          className="w-full mt-8 px-5 py-3.5 rounded-xl font-black bg-[#EC4899] text-white hover:opacity-90 transition-opacity"
        >
          Create match
        </button>
      </div>,
    )
  }

  // Match over → results + rematch.
  if (state && state.phase === 'FINISHED' && matchOver) {
    return shell(<ResultScreen state={state} matchOver={matchOver} myId={myId} onRematch={handleRematch} />)
  }

  // In a round (active clip or reveal).
  const inRound = state && (round || reveal) && (state.phase === 'ROUND_ACTIVE' || state.phase === 'ROUND_REVEAL')
  if (inRound) {
    return shell(
      <RoundView state={state} round={round} reveal={reveal} myId={myId} liveResults={liveResults} onGuess={handleGuess} />,
    )
  }

  // Lobby (waiting / ready-up).
  return shell(<Lobby state={state} myId={myId} onReady={handleReady} />)
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
      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:border-[#EC4899]/50"
    />
  )
}
