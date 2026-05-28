import { useState } from 'react'
import { nameInitials } from '../../lib/initials'

export default function Lobby({ state, myId, onReady }) {
  const [copied, setCopied] = useState(false)

  if (!state) return <p className="text-center text-sm text-white/40">Connecting…</p>

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
    } catch { /* clipboard blocked — the field is selectable as a fallback */ }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="btl-pill mb-3 mx-auto"><span className="pip" />Lobby<span className="pip foe" /></div>
        <h1 className="text-2xl font-black tracking-tight">Battle ready</h1>
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/38 mt-1">
          {state.scope === 'all' ? 'ALL GROUPS' : (state.scope || '').toUpperCase()} · BEST OF 5
        </p>
      </div>

      {/* Invite */}
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-[0.18em] text-white/38 mb-2">Invite a friend</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.target.select()}
            className="flex-1 px-3.5 py-3 rounded-xl bg-black/40 border border-white/[0.14] text-sm font-mono text-white truncate focus:outline-none"
          />
          <button onClick={copy} className="btl-cta" style={{ width: 'auto', padding: '0 18px' }}>
            {copied ? '✓ COPIED' : 'COPY'}
          </button>
        </div>
      </div>

      {/* Roster — two seat cards + VS plate */}
      <div className="btl-roster">
        <Seat side="you" player={me} />
        <span className="btl-roster-vs">VS</span>
        {opponent ? (
          <Seat side="foe" player={opponent} />
        ) : (
          <EmptySeat inviteUrl={inviteUrl} />
        )}
      </div>

      {/* Ready CTA */}
      {bothReady ? (
        <div
          className="px-4 py-4 rounded-xl border border-white/[0.18] text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, color-mix(in oklab, #EC4899 12%, transparent), color-mix(in oklab, #6366F1 12%, transparent))' }}
        >
          <p className="font-black text-base" style={{
            background: 'linear-gradient(135deg, #EC4899, #A855F7, #6366F1)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>Both ready — starting…</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/40 mt-1">Round 1 incoming</p>
        </div>
      ) : me?.ready ? (
        <div className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-center text-sm text-white/55">
          Ready ✓ — waiting for your opponent
        </div>
      ) : (
        <button onClick={onReady} disabled={!opponent} className="btl-cta">
          {opponent ? "I'M READY →" : 'WAITING FOR OPPONENT…'}
        </button>
      )}
    </div>
  )
}

function Seat({ side, player }) {
  const label = side === 'you' ? '▸ YOU' : 'OPPONENT ◂'
  const state = !player.connected
    ? { cls: '', text: 'Disconnected' }
    : player.ready
      ? { cls: 'ready', text: 'Ready' }
      : { cls: 'waiting', text: 'Not ready' }
  return (
    <div className={`btl-seat ${side}`}>
      <div className="btl-seat-tag">{label}</div>
      <span className="btl-mono xl" style={{ '--c': side === 'you' ? 'var(--btl-you)' : 'var(--btl-foe)' }}>
        {nameInitials(player.displayName)}
        <span className={`btl-presence ${player.connected ? '' : 'off'}`} />
      </span>
      <div className="btl-seat-name">{player.displayName}</div>
      <div className={`btl-seat-state ${state.cls}`}>{state.text}</div>
    </div>
  )
}

function EmptySeat() {
  return (
    <div className="btl-seat empty foe">
      <div className="btl-seat-tag">OPPONENT ◂</div>
      <span className="btl-waiting-ring">+</span>
      <div className="btl-seat-name text-white/50">Waiting…</div>
      <div className="btl-seat-state waiting">Share the link</div>
    </div>
  )
}
