import { useEffect, useState } from 'react'
import { fetchBattleStats } from '../../lib/api'
import { getPlayerToken } from '../../lib/battleSocket'

// Compact W-L-D + streak strip for the Battle lobby. Reads `x-player-token`
// keyed stats so anonymous players still see their record. Renders nothing
// (not even a skeleton) for first-time players to keep the lobby clean — the
// `totalMatches === 0` branch returns null below.
export default function BattleStatsStrip() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchBattleStats(getPlayerToken())
      .then((s) => { if (!cancelled) setStats(s) })
      .catch(() => { /* keep stats null; we'll render nothing */ })
    return () => { cancelled = true }
  }, [])

  if (!stats || stats.totalMatches === 0) return null

  const { totalMatches, wins, losses, draws, winRate, currentStreak, bestStreak } = stats

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/38">Your record</span>
        <span className="text-[11px] font-mono text-white/55 tabular-nums">{totalMatches} {totalMatches === 1 ? 'match' : 'matches'}</span>
      </div>
      <div className="flex items-center gap-4 sm:gap-5 font-mono tabular-nums">
        <Stat label="W" value={wins} color="#10B981" />
        <Stat label="L" value={losses} color="#F43F5E" />
        {draws > 0 && <Stat label="D" value={draws} color="#94A3B8" />}
        <Divider />
        <Stat label="WIN%" value={`${winRate}%`} color="#EC4899" />
        {currentStreak >= 2 && (
          <Stat label="STREAK" value={`🔥${currentStreak}`} color="#F59E0B" title={`Best: ${bestStreak}`} />
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color, title }) {
  return (
    <div className="flex flex-col items-center leading-tight" title={title}>
      <span className="text-[14px] sm:text-[15px] font-bold" style={{ color }}>{value}</span>
      <span className="text-[9px] uppercase tracking-[0.14em] text-white/38 mt-0.5">{label}</span>
    </div>
  )
}

function Divider() {
  return <span className="w-px h-6 bg-white/[0.1]" aria-hidden="true" />
}
