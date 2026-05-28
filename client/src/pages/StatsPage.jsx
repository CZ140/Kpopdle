import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchGroups, fetchStatsSummary, fetchSongDifficulty } from '../lib/api'
import { GAME_NAMES } from '../lib/constants'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

// Small glass stat card.
function Kpi({ label, value, sub }) {
  return (
    <div
      className="flex-1 min-w-[140px] rounded-2xl border border-white/[0.12] px-5 py-4"
      style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">{label}</div>
      <div className="text-3xl font-black tracking-tight text-white leading-none">{value}</div>
      {sub && <div className="font-mono text-[11px] text-white/40 mt-1.5">{sub}</div>}
    </div>
  )
}

export default function StatsPage() {
  useDocumentMeta({
    title: 'Community Stats — Win Rates & Hardest Songs | K-POPDLE',
    description: 'Live community stats across all K-POPDLE groups: win rates, average guesses, hint usage, and the hardest songs players struggle with most.',
    path: '/stats',
  })

  const [summary, setSummary] = useState([])
  const [groupsById, setGroupsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [selectedGroup, setSelectedGroup] = useState(null)
  const [hardest, setHardest] = useState([])
  const [hardestLoading, setHardestLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const [summaryData, groupsData] = await Promise.all([fetchStatsSummary(), fetchGroups()])
        if (cancelled) return
        const byId = {}
        for (const g of groupsData) byId[g.id] = g
        setGroupsById(byId)
        setSummary(summaryData)
        // Default the hardest-songs section to the most-played group.
        if (summaryData.length > 0) setSelectedGroup(summaryData[0].group_id)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedGroup) return
    let cancelled = false
    setHardestLoading(true)
    fetchSongDifficulty(selectedGroup)
      .then((rows) => { if (!cancelled) setHardest(rows) })
      .catch(() => { if (!cancelled) setHardest([]) })
      .finally(() => { if (!cancelled) setHardestLoading(false) })
    return () => { cancelled = true }
  }, [selectedGroup])

  const displayName = (id) => groupsById[id]?.displayName ?? GAME_NAMES[id] ?? id
  const colorOf = (id) => groupsById[id]?.colors?.primary ?? '#FF2D78'

  const totalGames = summary.reduce((n, r) => n + (r.total_games || 0), 0)
  const overallWinRate = totalGames
    ? Math.round(summary.reduce((n, r) => n + (r.win_rate || 0) * (r.total_games || 0), 0) / totalGames)
    : 0

  return (
    <>
      <div className="kp-backdrop">
        <div className="kp-grid-noise" />
        <div className="kp-orb" style={{ width: 520, height: 520, background: 'radial-gradient(circle, #FF2D78 0%, transparent 65%)', top: -120, left: -120, opacity: 0.5 }} />
        <div className="kp-orb" style={{ width: 560, height: 560, background: 'radial-gradient(circle, #A855F7 0%, transparent 65%)', top: '8%', right: -160, opacity: 0.5, animationDelay: '-7s' }} />
        <div className="kp-orb" style={{ width: 420, height: 420, background: 'radial-gradient(circle, #06B6D4 0%, transparent 65%)', bottom: -120, left: '25%', opacity: 0.45, animationDelay: '-14s' }} />
      </div>

      <div className="relative z-[1] max-w-[1080px] mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-16 sm:pb-20">
        {/* Top strip — matches HomePage / AccountPage pattern */}
        <div className="flex items-center justify-between gap-2 mb-10 font-mono text-[11px] sm:text-[12px] text-white/38 uppercase tracking-[0.08em]">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="kp-live-dot" />
            LIVE · COMMUNITY
          </div>
          <Link
            to="/"
            className="kp-pill inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-white/62 hover:text-white hover:border-white/30 transition-colors"
          >
            <span className="w-[18px] h-[18px] rounded-full bg-white/[0.08] inline-flex items-center justify-center text-[11px]">←</span>
            K-POPDLE
          </Link>
        </div>

        {/* Header */}
        <header className="text-center mb-12">
          <div className="kp-pill inline-flex items-center gap-2.5 px-4 py-2 rounded-full font-mono text-[11px] tracking-[0.14em] uppercase text-white/62 mb-6">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #FF2D78, #A855F7)',
                boxShadow: '0 0 10px rgba(255,45,120,0.8)',
              }}
            />
            Updated live · across every group
          </div>
          <h1
            className="font-black tracking-[-0.03em] leading-[0.95] m-0 mb-4"
            style={{
              fontSize: 'clamp(36px, 7vw, 64px)',
              background: 'linear-gradient(135deg, #FF2D78 0%, #EC4899 30%, #A855F7 70%, #6366F1 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.3))',
            }}
          >
            Community Stats
          </h1>
          <p className="text-white/62 m-0" style={{ fontSize: 'clamp(14px, 1.5vw, 17px)' }}>
            How everyone&apos;s doing — across every group, updated live.
          </p>
        </header>

        {loading ? (
          <div className="text-center text-white/30 font-mono text-sm py-20">Loading…</div>
        ) : error ? (
          <div className="text-center text-white/40 font-mono text-sm py-20">
            Couldn&apos;t load stats.{' '}
            <Link to="/stats" reloadDocument className="text-[#FF2D78] underline hover:no-underline">Retry</Link>
          </div>
        ) : totalGames === 0 ? (
          <div className="text-center text-white/40 font-mono text-sm py-20">
            No games recorded yet — be the first to play!{' '}
            <Link to="/" className="text-[#FF2D78] underline hover:no-underline">Pick a group →</Link>
          </div>
        ) : (
          <>
            {/* Overall KPIs */}
            <div className="flex flex-wrap gap-3 mb-12">
              <Kpi label="Games played" value={totalGames.toLocaleString()} sub="across all groups" />
              <Kpi label="Overall win rate" value={`${overallWinRate}%`} sub="players who guessed it" />
              <Kpi label="Active games" value={summary.length} sub="groups with plays" />
            </div>

            {/* Per-group leaderboard */}
            <section className="mb-14">
              <h2 className="text-xl font-bold tracking-tight mb-5 px-1">Group leaderboard</h2>
              <div className="space-y-2">
                {summary.map((row, i) => (
                  <div
                    key={row.group_id}
                    className="flex items-center gap-3 sm:gap-4 rounded-xl border border-white/[0.1] px-4 py-3.5"
                    style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}
                  >
                    <span className="font-mono text-[13px] text-white/30 w-5 text-right tabular-nums">{i + 1}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorOf(row.group_id) }} />
                    <Link
                      to={`/${row.group_id}`}
                      className="flex-1 min-w-0 font-semibold text-white/90 hover:text-white transition-colors truncate"
                    >
                      {displayName(row.group_id)}
                      <span className="hidden sm:inline text-white/30 font-mono text-[11px] ml-2">{GAME_NAMES[row.group_id]}</span>
                    </Link>
                    <div className="flex items-center gap-4 sm:gap-7 font-mono text-[12px] sm:text-[13px] text-right tabular-nums">
                      <div className="hidden sm:block">
                        <div className="text-white/85">{(row.total_games || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-white/35 uppercase tracking-wider">plays</div>
                      </div>
                      <div>
                        <div className="font-bold" style={{ color: colorOf(row.group_id) }}>{row.win_rate ?? 0}%</div>
                        <div className="text-[10px] text-white/35 uppercase tracking-wider">win</div>
                      </div>
                      <div>
                        <div className="text-white/85">{row.avg_guesses ?? '—'}</div>
                        <div className="text-[10px] text-white/35 uppercase tracking-wider">avg</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Hardest songs */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-1">
                <h2 className="text-xl font-bold tracking-tight">Hardest songs</h2>
                <select
                  value={selectedGroup ?? ''}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="rounded-lg border border-white/[0.14] bg-white/[0.06] text-white/80 text-sm px-3 py-1.5 font-medium focus:outline-none focus:border-white/30"
                  aria-label="Choose a group"
                >
                  {summary.map((row) => (
                    <option key={row.group_id} value={row.group_id} className="bg-[#15151c]">
                      {displayName(row.group_id)}
                    </option>
                  ))}
                </select>
              </div>

              {hardestLoading ? (
                <div className="text-center text-white/30 font-mono text-sm py-12">Loading…</div>
              ) : hardest.length === 0 ? (
                <div className="text-center text-white/40 font-mono text-sm py-12">No song data yet for this group.</div>
              ) : (
                <div className="space-y-1.5">
                  {hardest.slice(0, 10).map((song, i) => (
                    <div
                      key={`${song.song_id}-${song.song_title}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <span className="font-mono text-[13px] text-white/30 w-5 text-right tabular-nums">{i + 1}</span>
                      <span className="flex-1 min-w-0 text-white/85 text-sm font-medium truncate">{song.song_title}</span>
                      <div className="flex items-center gap-4 sm:gap-6 font-mono text-[12px] text-right tabular-nums">
                        <div>
                          <div className="font-bold text-white/85">{song.win_rate ?? 0}%</div>
                          <div className="text-[10px] text-white/35 uppercase tracking-wider">win</div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-white/70">{song.avg_guesses ?? '—'}</div>
                          <div className="text-[10px] text-white/35 uppercase tracking-wider">avg</div>
                        </div>
                        <div>
                          <div className="text-white/70">{song.plays ?? 0}</div>
                          <div className="text-[10px] text-white/35 uppercase tracking-wider">plays</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <footer className="mt-16 pt-8 border-t border-white/[0.08] text-center font-mono text-[11px] uppercase tracking-[0.12em] text-white/38">
          <Link to="/" className="hover:text-white/70 transition-colors">← Back to K-POPDLE</Link>
        </footer>
      </div>
    </>
  )
}
