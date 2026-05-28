import { useState } from 'react'
import { nameInitials } from '../../lib/initials'

export default function Lobby({ state, myId, onReady }) {
  const [copied, setCopied] = useState(false)

  if (!state) {
    return <p className="text-center text-sm text-white/40">Connecting…</p>
  }

  const inviteUrl = `${window.location.origin}/battle/${state.id}`
  const players = state.players || []
  const me = players.find((p) => p.id === myId)
  const opponent = players.find((p) => p.id !== myId)
  const bothReady = state.phase === 'READY_CHECK'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="btl-eyebrow mb-5 mx-auto"><span className="pip-l" />Lobby<span className="pip-r" /></div>
        <h1 className="text-3xl font-black tracking-tight mb-1">Battle ready</h1>
        <p className="text-xs font-mono uppercase tracking-[0.14em] text-white/40">
          {state.scope === 'all' ? 'ALL GROUPS' : state.scope} · BEST OF 5
        </p>
      </div>

      {/* Invite link */}
      <label className="block text-[10px] font-mono uppercase tracking-[0.14em] text-white/40 mb-2">
        Invite a friend
      </label>
      <div className="flex gap-2 mb-8">
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.target.select()}
          className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white/70 focus:outline-none"
        />
        <button
          onClick={copy}
          className="btl-btn-primary px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Roster — you/foe dual identity */}
      <div className="flex flex-col gap-2 mb-8">
        <PlayerRow player={me} side="you" />
        {opponent ? (
          <PlayerRow player={opponent} side="foe" />
        ) : (
          <div className="px-4 py-5 rounded-xl border border-dashed border-white/[0.12] text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/30 mb-1">Opponent ◂</p>
            <p className="text-sm text-white/50">Waiting for an opponent to join…</p>
          </div>
        )}
      </div>

      {/* Ready / status */}
      {bothReady ? (
        <div className="px-4 py-4 rounded-xl border border-white/[0.14] text-center relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg, rgba(255,45,120,0.10), rgba(6,182,212,0.10))' }}>
          <p className="font-black text-base" style={{
            background: 'linear-gradient(135deg, #FF2D78, #A855F7, #06B6D4)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>Both ready — starting…</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/40 mt-1">Round 1 incoming</p>
        </div>
      ) : me?.ready ? (
        <div className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-center text-sm text-white/55">
          Ready ✓ — waiting for your opponent
        </div>
      ) : (
        <button
          onClick={onReady}
          disabled={!opponent}
          className="btl-btn-primary w-full px-5 py-4 rounded-xl font-black tracking-wide"
        >
          {opponent ? "I'M READY →" : 'WAITING FOR OPPONENT…'}
        </button>
      )}
    </div>
  )
}

function PlayerRow({ player, side }) {
  if (!player) return null
  const initials = nameInitials(player.displayName)
  const label = side === 'you' ? '▸ YOU' : 'OPPONENT ◂'
  return (
    <div className={`btl-side ${side}`}>
      <span className="av">{initials}</span>
      <div className="who">
        <div className="label">{label}</div>
        <div className="name">{player.displayName}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${player.connected ? 'bg-emerald-400' : 'bg-white/20'}`}
          title={player.connected ? 'connected' : 'disconnected'}
          style={player.connected ? { boxShadow: '0 0 8px rgba(74,222,128,0.6)' } : undefined}
        />
        <span className={`text-[10px] font-mono uppercase tracking-[0.14em] ${player.ready ? 'text-emerald-400' : 'text-white/30'}`}>
          {player.ready ? 'Ready' : 'Not ready'}
        </span>
      </div>
    </div>
  )
}
