import { useState } from 'react'

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
      <h1 className="text-2xl font-black tracking-tight mb-1">Battle lobby</h1>
      <p className="text-sm text-white/40 mb-6">
        {state.scope === 'all' ? 'All groups' : state.scope} · best of 5
      </p>

      {/* Invite link */}
      <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
        Invite a friend
      </label>
      <div className="flex gap-2 mb-8">
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.target.select()}
          className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white/70 focus:outline-none"
        />
        <button
          onClick={copy}
          className="px-4 py-2.5 rounded-xl font-bold text-sm bg-[#EC4899] text-white hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Roster */}
      <div className="flex flex-col gap-2 mb-8">
        <PlayerRow player={me} you label="You" />
        {opponent ? (
          <PlayerRow player={opponent} />
        ) : (
          <div className="px-4 py-4 rounded-xl border border-dashed border-white/[0.1] text-center text-sm text-white/30">
            Waiting for an opponent to join…
          </div>
        )}
      </div>

      {/* Ready / status */}
      {bothReady ? (
        <div className="px-4 py-4 rounded-xl bg-[#EC4899]/10 border border-[#EC4899]/30 text-center">
          <p className="font-bold text-[#EC4899]">Both ready!</p>
          <p className="text-xs text-white/40 mt-1">Live rounds arrive in the next milestone.</p>
        </div>
      ) : me?.ready ? (
        <div className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center text-sm text-white/50">
          Ready ✓ — waiting for your opponent
        </div>
      ) : (
        <button
          onClick={onReady}
          disabled={!opponent}
          className="w-full px-5 py-3.5 rounded-xl font-black bg-[#EC4899] text-white hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {opponent ? "I'm ready" : 'Waiting for opponent…'}
        </button>
      )}
    </div>
  )
}

function PlayerRow({ player, you, label }) {
  if (!player) return null
  return (
    <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-2 h-2 rounded-full ${player.connected ? 'bg-emerald-400' : 'bg-white/20'}`}
          title={player.connected ? 'connected' : 'disconnected'}
        />
        <span className="font-bold text-sm">{player.displayName}</span>
        {you && <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</span>}
      </div>
      <span className={`text-xs font-bold ${player.ready ? 'text-emerald-400' : 'text-white/25'}`}>
        {player.ready ? 'Ready' : 'Not ready'}
      </span>
    </div>
  )
}
