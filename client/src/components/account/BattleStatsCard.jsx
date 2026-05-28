import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchBattleStats } from '../../lib/api'
import { getPlayerToken } from '../../lib/battleSocket'

// Account-page Battle panel. Mirrors the visual language of the daily-game
// stat tiles (acct-panel / acct-specular) so the page stays cohesive.
//
// We always send `x-player-token` alongside the cookie — that way a player who
// battled anonymously before signing in still sees their device's history
// here, even though the server keys it under `p:<token>` rather than the
// account. (A future "merge p: into u: on sign-in" pass is the right fix.)
export default function BattleStatsCard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchBattleStats(getPlayerToken())
      .then((s) => { if (!cancelled) { setStats(s); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="acct-panel acct-specular text-center py-10 mb-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/38">Loading Battle stats…</div>
      </div>
    )
  }

  if (!stats || stats.totalMatches === 0) {
    return (
      <div
        className="acct-panel acct-specular mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(99,102,241,0.06))' }}
      >
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/38 mb-1.5">Battle</div>
          <h3 className="m-0 text-[18px] font-extrabold tracking-[-0.01em]">No battles yet</h3>
          <p className="m-0 mt-1 text-sm text-white/55">Challenge a friend to a live 1v1 and your record will show up here.</p>
        </div>
        <Link
          to="/battle"
          className="px-5 py-2.5 rounded-full text-white text-[12px] font-mono uppercase tracking-[0.1em] whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #EC4899, #6366F1)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
        >
          Start a battle →
        </Link>
      </div>
    )
  }

  const { totalMatches, wins, losses, draws, winRate, currentStreak, bestStreak, avgScore, fastestCorrectMs, recent } = stats
  const fastest = fastestCorrectMs != null ? `${(fastestCorrectMs / 1000).toFixed(1)}s` : '—'

  return (
    <section className="mb-14">
      <div className="flex items-end justify-between mb-6 px-0.5">
        <h2 className="text-[22px] font-bold m-0 tracking-[-0.01em]">Battle</h2>
        <Link to="/battle" className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors">
          New match →
        </Link>
      </div>

      <div className="acct-panel acct-specular" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.05), rgba(99,102,241,0.05))' }}>
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <Kpi label="Matches" value={totalMatches} />
          <Kpi label="Win rate" value={`${winRate}%`} accent="#EC4899" />
          <Kpi label="W · L · D" value={`${wins} · ${losses}${draws ? ` · ${draws}` : ''}`} />
          <Kpi label="Current streak" value={currentStreak > 0 ? `🔥 ${currentStreak}` : '—'} />
          <Kpi label="Best streak" value={bestStreak} />
          <Kpi label="Fastest guess" value={fastest} />
        </div>

        {/* Recent matches */}
        {recent.length > 0 && (
          <>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/38 mb-2.5">Last {recent.length} match{recent.length === 1 ? '' : 'es'}</div>
            <div className="flex flex-col gap-1.5">
              {recent.map((m, i) => (
                <RecentRow key={`${m.matchId}-${m.finishedAt}-${i}`} m={m} avgScore={avgScore} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Kpi({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/38 mb-1.5">{label}</div>
      <div className="text-[20px] font-extrabold tracking-[-0.01em] tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  )
}

const OUTCOME_STYLE = {
  win:  { color: '#10B981', text: 'WON',  glyph: '▲' },
  loss: { color: '#F43F5E', text: 'LOST', glyph: '▼' },
  draw: { color: '#94A3B8', text: 'TIE',  glyph: '=' },
}

function RecentRow({ m }) {
  const style = OUTCOME_STYLE[m.outcome] ?? OUTCOME_STYLE.draw
  const when = formatWhen(m.finishedAt)
  const scope = m.scope === 'all' ? 'All groups' : m.scope.toUpperCase()
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.025] border border-white/[0.06] px-3 py-2.5">
      <span
        className="w-9 text-center font-mono text-[10px] font-bold tracking-[0.1em]"
        style={{ color: style.color }}
        title={style.text}
      >
        {style.glyph} {style.text}
      </span>
      <span className="flex-1 min-w-0 text-sm text-white/85 truncate">
        vs <b className="font-semibold">{m.opponentName || 'Opponent'}</b>
        {m.forfeit && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/38">
            · forfeit{m.forfeitBySelf ? ' (you)' : ''}
          </span>
        )}
      </span>
      <span className="font-mono text-[11px] text-white/55 tabular-nums whitespace-nowrap">
        {m.ownScore}<span className="text-white/30 mx-1">–</span>{m.oppScore}
      </span>
      <span className="hidden sm:inline font-mono text-[10px] text-white/38 uppercase tracking-[0.1em] whitespace-nowrap">{scope}</span>
      <span className="font-mono text-[10px] text-white/38 whitespace-nowrap w-20 text-right">{when}</span>
    </div>
  )
}

// Server stores `finished_at` as UTC ISO-ish ('YYYY-MM-DD HH:MM:SS'). Parse
// permissively and fall back to the raw string if the format ever shifts.
function formatWhen(s) {
  if (!s) return ''
  const ms = Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(ms)) return s
  const diffSec = (Date.now() - ms) / 1000
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(ms).toLocaleDateString()
}
