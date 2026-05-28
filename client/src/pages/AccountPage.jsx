import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useSound } from '../lib/SoundContext'
import { loadStats } from '../lib/storage'
import { fetchCloudStats } from '../lib/api'
import { copyToClipboard } from '../lib/share'
import { ALL_GROUP_IDS, GAME_NAMES } from '../lib/constants'

// Real group display names (the game names live in GAME_NAMES).
const GROUP_LABELS = {
  twice: 'TWICE',
  newjeans: 'NewJeans',
  lesserafim: 'LE SSERAFIM',
  aespa: 'aespa',
  redvelvet: 'Red Velvet',
  kissoflife: 'KISS OF LIFE',
  ive: 'IVE',
  blackpink: 'BLACKPINK',
  kpopdle: 'All Groups',
}

// Per-group gradient + glow — matches the homepage card identities and the
// design mockup's data-grp palette. Drives each per-game card's --game-* vars.
const GROUP_GRADIENTS = {
  twice:      { grad: 'linear-gradient(135deg, #FF2D78 0%, #A855F7 100%)', glow: 'rgba(255,45,120,0.4)' },
  newjeans:   { grad: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)', glow: 'rgba(6,182,212,0.4)' },
  lesserafim: { grad: 'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)', glow: 'rgba(244,63,94,0.4)' },
  aespa:      { grad: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)', glow: 'rgba(16,185,129,0.4)' },
  redvelvet:  { grad: 'linear-gradient(135deg, #EF4444 0%, #FB7185 100%)', glow: 'rgba(239,68,68,0.4)' },
  kissoflife: { grad: 'linear-gradient(135deg, #F97316 0%, #EAB308 100%)', glow: 'rgba(249,115,22,0.4)' },
  ive:        { grad: 'linear-gradient(135deg, #3B82F6 0%, #F59E0B 100%)', glow: 'rgba(59,130,246,0.4)' },
  blackpink:  { grad: 'linear-gradient(135deg, #1a1a2e 0%, #EC4899 100%)', glow: 'rgba(236,72,153,0.4)' },
  kpopdle:    { grad: 'linear-gradient(135deg, #FF2D78 0%, #A855F7 50%, #6366F1 100%)', glow: 'rgba(168,85,247,0.4)' },
}

// Catalog index for the "#001" microcopy on each card.
const CATALOG_INDEX = Object.fromEntries(ALL_GROUP_IDS.map((g, i) => [g, i + 1]))

const EMPTY_DIST = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

function aggregate(statsMap) {
  const out = { played: 0, won: 0, curStreak: 0, maxStreak: 0, groupsPlayed: 0, dist: { ...EMPTY_DIST } }
  for (const s of Object.values(statsMap)) {
    if (!s) continue
    const played = s.gamesPlayed ?? 0
    if (played > 0) out.groupsPlayed += 1
    out.played += played
    out.won += s.gamesWon ?? 0
    out.curStreak = Math.max(out.curStreak, s.currentStreak ?? 0)
    out.maxStreak = Math.max(out.maxStreak, s.maxStreak ?? 0)
    for (const k of [1, 2, 3, 4, 5, 6]) out.dist[k] += s.guessDistribution?.[k] ?? 0
  }
  return out
}

// Weighted average guesses-per-win from a guess distribution (null if no wins).
function avgGuesses(dist) {
  let n = 0, sum = 0
  for (const k of [1, 2, 3, 4, 5, 6]) {
    const c = dist?.[k] ?? 0
    n += c
    sum += k * c
  }
  return n > 0 ? sum / n : null
}

// Build a 26-week play heatmap from local daily game-state keys
// (`{group}-game-{YYYY-MM-DD}`). Intensity = number of groups played that day.
// Cloud stats are aggregate-only, so this reflects this device's history.
function buildHeatmap() {
  const re = new RegExp(`^(${ALL_GROUP_IDS.join('|')})-game-(\\d{4}-\\d{2}-\\d{2})$`)
  const byDate = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const m = key && key.match(re)
      if (!m) continue
      let st
      try { st = JSON.parse(localStorage.getItem(key)) } catch { continue }
      const played = !!st && (
        (st.gameState && st.gameState !== 'playing') ||
        (Array.isArray(st.guesses) && st.guesses.length > 0)
      )
      if (!played) continue
      ;(byDate[m[2]] ||= new Set()).add(m[1])
    }
  } catch { /* localStorage unavailable */ }

  const cells = []
  let totalPlays = 0, activeDays = 0
  for (let i = 181; i >= 0; i--) {
    // KST-shifted date string, matching how game keys are stored.
    const ds = new Date(Date.now() + 9 * 3600000 - i * 86400000).toISOString().split('T')[0]
    const count = byDate[ds] ? byDate[ds].size : 0
    if (count > 0) { totalPlays += count; activeDays += 1 }
    cells.push({ ds, lvl: count >= 4 ? 4 : count, count })
  }
  return { cells, totalPlays, activeDays, hasData: activeDays > 0 }
}

export default function AccountPage() {
  const navigate = useNavigate()
  const { user, logout, deleteAccount } = useAuth()
  const { playSound } = useSound()
  const [statsMap, setStatsMap] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { document.title = 'Account · K-POPDLE' }, [])

  // Redirect if logged out (null = confirmed, undefined = still checking).
  useEffect(() => {
    if (user === null) navigate('/')
  }, [user, navigate])

  useEffect(() => {
    // Seed with local stats, then prefer cloud where it has more games played.
    const local = {}
    for (const g of ALL_GROUP_IDS) local[g] = loadStats(g)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatsMap(local)

    if (!user) return
    fetchCloudStats().then(cloud => {
      setStatsMap(prev => {
        const merged = { ...prev }
        for (const g of ALL_GROUP_IDS) {
          if (cloud[g] && (cloud[g].gamesPlayed ?? 0) > (prev[g]?.gamesPlayed ?? 0)) {
            merged[g] = cloud[g]
          }
        }
        return merged
      })
    }).catch(() => {})
  }, [user])

  // Local-only and stable for the session — compute once.
  const heatmap = useMemo(() => buildHeatmap(), [])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-twice-dark">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#FF2D78', borderRightColor: '#A855F7' }} />
      </div>
    )
  }
  if (!user) return null

  const combined = aggregate(statsMap)
  const hasGames = combined.played > 0
  const winPct = hasGames ? Math.round((combined.won / combined.played) * 100) : 0
  const avg = avgGuesses(combined.dist)
  const missTotal = Math.max(0, combined.played - combined.won)
  const maxComb = Math.max(...Object.values(combined.dist), missTotal, 1)

  const tiles = [
    { hl: true, label: 'Total Games', value: combined.played.toLocaleString(), sub: `across ${combined.groupsPlayed} group${combined.groupsPlayed === 1 ? '' : 's'}` },
    { label: 'Win Rate', value: winPct, unit: '%', sub: `${combined.won.toLocaleString()} of ${combined.played.toLocaleString()}` },
    { label: 'Current Streak', value: combined.curStreak, unit: 'days', sub: `best ${combined.maxStreak}` },
    { label: 'Max Streak', value: combined.maxStreak, unit: 'days', sub: 'all-time best' },
    { label: 'Avg. Guesses', value: avg != null ? avg.toFixed(1) : '—', unit: '/6', sub: 'per win' },
  ]

  const games = ALL_GROUP_IDS
    .map(g => {
      const s = statsMap[g]
      const played = s?.gamesPlayed ?? 0
      if (played <= 0) return null
      const won = s?.gamesWon ?? 0
      const dist = s?.guessDistribution ?? {}
      const miss = Math.max(0, played - won)
      return {
        id: g,
        played,
        won,
        winPct: Math.round((won / played) * 100),
        streak: s?.currentStreak ?? 0,
        avg: avgGuesses(dist),
        dist,
        miss,
        maxBar: Math.max(...[1, 2, 3, 4, 5, 6].map(k => dist[k] ?? 0), miss, 1),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.played - a.played)

  async function handleShare() {
    playSound('click')
    const lines = [
      `K-POPDLE — ${user.displayName}'s stats`,
      `${combined.played} games · ${winPct}% wins · 🔥 ${combined.curStreak} streak`,
      avg != null
        ? `Avg ${avg.toFixed(1)}/6 · ${combined.groupsPlayed} groups played`
        : `${combined.groupsPlayed} groups played`,
      window.location.origin,
    ]
    const text = lines.join('\n')
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch { /* cancelled / unsupported */ }
    }
    if (await copyToClipboard(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const initial = user.displayName?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      {/* Ambient backdrop — shared with the homepage */}
      <div className="kp-backdrop">
        <div className="kp-grid-noise" />
        <div className="kp-orb" style={{ width: 520, height: 520, background: 'radial-gradient(circle, #FF2D78 0%, transparent 65%)', top: -120, left: -120, opacity: 0.45 }} />
        <div className="kp-orb" style={{ width: 600, height: 600, background: 'radial-gradient(circle, #A855F7 0%, transparent 65%)', top: '10%', right: -180, opacity: 0.45, animationDelay: '-7s' }} />
        <div className="kp-orb" style={{ width: 480, height: 480, background: 'radial-gradient(circle, #06B6D4 0%, transparent 65%)', bottom: -120, left: '20%', opacity: 0.45, animationDelay: '-14s' }} />
        <div className="kp-orb" style={{ width: 380, height: 380, background: 'radial-gradient(circle, #6366F1 0%, transparent 65%)', top: '50%', left: '45%', opacity: 0.3, animationDelay: '-18s' }} />
      </div>

      <div className="relative z-[1] max-w-[1320px] mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-16 sm:pb-20">

        {/* Top strip */}
        <div className="flex items-center justify-between gap-2 mb-10 sm:mb-14 font-mono text-[12px] text-white/38 uppercase tracking-[0.08em]">
          <button
            onClick={() => { playSound('click'); navigate('/') }}
            className="font-sans font-black text-[16px] tracking-[-0.01em] bg-transparent border-0 cursor-pointer p-0"
            style={{ background: 'linear-gradient(135deg, #FF2D78, #A855F7)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
          >
            K-POPDLE
          </button>
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              onClick={() => { playSound('click'); navigate('/') }}
              className="kp-pill inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-white/62 hover:text-white hover:border-white/30 transition-colors"
            >
              <span className="w-[18px] h-[18px] rounded-full bg-white/[0.08] inline-flex items-center justify-center text-[11px]">←</span>
              Back to games
            </button>
            <div className="kp-pill px-3 py-1.5 rounded-full text-white/62">
              🔥 Streak <b className="text-[#FF2D78] font-bold">{combined.curStreak}</b>
            </div>
          </div>
        </div>

        {/* Profile hero */}
        <section className="acct-profile acct-specular mb-8">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="acct-avatar-xl" referrerPolicy="no-referrer" />
          ) : (
            <div className="acct-avatar-xl">{initial}</div>
          )}

          <div className="min-w-0">
            <h1 className="m-0 mb-1 text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] truncate">{user.displayName}</h1>
            <p className="font-mono text-[13px] text-white/38 m-0 mb-3.5 tracking-[0.04em] truncate">{user.email}</p>
            <div className="flex flex-wrap gap-2">
              {hasGames ? (
                <>
                  <Tag gradient>★ {combined.played.toLocaleString()} GAMES</Tag>
                  <Tag>{winPct}% WIN RATE</Tag>
                  <Tag>{combined.groupsPlayed} GROUP{combined.groupsPlayed === 1 ? '' : 'S'}</Tag>
                  {combined.maxStreak > 0 && <Tag>🔥 BEST {combined.maxStreak}</Tag>}
                </>
              ) : (
                <Tag>NO GAMES YET</Tag>
              )}
            </div>
          </div>

          <div className="acct-profile-side flex flex-col gap-2.5 items-end">
            <button
              onClick={handleShare}
              className="px-[18px] py-2.5 rounded-full border-0 text-white text-[12px] font-mono uppercase tracking-[0.1em] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #FF2D78, #A855F7)', boxShadow: '0 8px 24px rgba(168,85,247,0.3)' }}
            >
              {copied ? 'Copied ✓' : 'Share Stats'}
            </button>
          </div>
        </section>

        {hasGames ? (
          <>
            {/* Combined stat tiles */}
            <div className="acct-stats-row mb-14">
              {tiles.map(t => (
                <div key={t.label} className={`acct-stat acct-specular${t.hl ? ' hl' : ''}`}>
                  <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/38 m-0 mb-3">{t.label}</p>
                  <p className="value">{t.value}{t.unit && <span className="unit">{t.unit}</span>}</p>
                  {t.sub && <p className="mt-2 text-[11px] text-white/38 font-mono">{t.sub}</p>}
                </div>
              ))}
            </div>

            {/* Combined activity */}
            <div className="flex items-end justify-between mb-6 px-0.5">
              <h2 className="text-[22px] font-bold m-0 tracking-[-0.01em]">Combined activity</h2>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/38">All groups</div>
            </div>

            <div className={`mb-14 ${heatmap.hasData ? 'acct-activity-row' : ''}`}>
              {heatmap.hasData && (
                <div className="acct-panel acct-specular">
                  <h3 className="m-0 mb-1 text-[15px] font-semibold">Play streak</h3>
                  <p className="m-0 mb-6 font-mono text-[12px] text-white/38 uppercase tracking-[0.1em]">Last 26 weeks · this device</p>
                  <div className="acct-heatmap">
                    {heatmap.cells.map((c, i) => (
                      <span key={i} data-l={c.lvl || undefined} title={c.count > 0 ? `${c.ds} · ${c.count} played` : c.ds} />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2.5 font-mono text-[10px] text-white/38 tracking-[0.12em] uppercase">
                    <span>Less</span>
                    <div className="acct-scale inline-flex gap-[3px]">
                      <span /><span data-l="1" /><span data-l="2" /><span data-l="3" /><span data-l="4" />
                    </div>
                    <span>More</span>
                    <span className="ml-auto">{heatmap.activeDays} active days</span>
                  </div>
                </div>
              )}

              <div className="acct-panel acct-specular">
                <h3 className="m-0 mb-1 text-[15px] font-semibold">Guess distribution</h3>
                <p className="m-0 mb-6 font-mono text-[12px] text-white/38 uppercase tracking-[0.1em]">Across all games</p>
                <div className="flex flex-col gap-2.5">
                  {[1, 2, 3, 4, 5, 6].map(k => (
                    <DistRow key={k} n={k} count={combined.dist[k]} pct={combined.played ? (combined.dist[k] / combined.played) * 100 : 0} max={maxComb} />
                  ))}
                  <DistRow miss n="×" count={missTotal} pct={combined.played ? (missTotal / combined.played) * 100 : 0} max={maxComb} />
                </div>
              </div>
            </div>

            {/* Per-game breakdown */}
            <div className="flex items-end justify-between mb-6 px-0.5">
              <h2 className="text-[22px] font-bold m-0 tracking-[-0.01em]">Per-game breakdown</h2>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/38">{games.length} game{games.length === 1 ? '' : 's'} · by playtime</div>
            </div>

            <div className="acct-games">
              {games.map((g, i) => (
                <GameCard key={g.id} game={g} rank={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="acct-panel acct-specular text-center py-14 mb-14">
            <p className="text-lg font-bold text-white/80 mb-2">No games played yet</p>
            <p className="text-sm text-white/40 mb-6">Play a daily round and your stats will show up here.</p>
            <button
              onClick={() => { playSound('click'); navigate('/') }}
              className="px-6 py-2.5 rounded-full text-white text-sm font-bold cursor-pointer border-0"
              style={{ background: 'linear-gradient(135deg, #FF2D78, #A855F7)', boxShadow: '0 8px 24px rgba(168,85,247,0.3)' }}
            >
              Play today's games →
            </button>
          </div>
        )}

        {/* Account management — kept from the original page */}
        <div className="acct-panel acct-specular">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">Account</h2>
              <p className="text-xs text-white/40 mt-1">Manage your sign-in and data</p>
            </div>
            {!showDeleteConfirm && (
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  onClick={() => { playSound('click'); logout() }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white/55 hover:text-white/80 hover:bg-white/[0.07] border border-white/[0.08] transition-all duration-200"
                >
                  Sign out
                </button>
                <button
                  onClick={() => { playSound('click'); setShowDeleteConfirm(true) }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-red-400/65 hover:text-red-400 hover:bg-red-400/[0.06] border border-red-400/[0.15] hover:border-red-400/30 transition-all duration-200"
                >
                  Delete Account
                </button>
              </div>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.04] p-4 flex flex-col gap-3">
              <p className="text-sm text-white/55 leading-relaxed">
                This will permanently erase your account and all stats. This cannot be undone.
              </p>
              <div className="flex gap-2 sm:justify-end">
                <button
                  onClick={() => { playSound('click'); setShowDeleteConfirm(false) }}
                  className="flex-1 sm:flex-none sm:px-6 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { playSound('click'); deleteAccount() }}
                  className="flex-1 sm:flex-none sm:px-6 py-2.5 rounded-xl text-sm font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-all"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/[0.08] flex justify-between items-center flex-wrap gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-white/38">
          <div>{user.displayName} · {user.email}</div>
          <button
            onClick={() => { playSound('click'); navigate('/') }}
            className="text-white/62 border-b border-white/[0.08] hover:text-[#FF2D78] transition-colors bg-transparent cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] p-0"
          >
            ← Back to today's games
          </button>
        </footer>
      </div>
    </>
  )
}

function Tag({ children, gradient = false }) {
  return (
    <span
      className="px-3 py-1.5 rounded-full font-mono text-[11px] tracking-[0.08em] uppercase"
      style={gradient ? {
        background: 'linear-gradient(135deg, rgba(255,45,120,0.18), rgba(168,85,247,0.18))',
        border: '1px solid rgba(255,45,120,0.4)',
        color: '#fff',
      } : {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.62)',
      }}
    >
      {children}
    </span>
  )
}

function DistRow({ n, count, pct, max, miss = false }) {
  return (
    <div className={`acct-dist-row${miss ? ' miss' : ''}`}>
      <span className={`font-mono text-[13px] font-semibold ${miss ? 'text-white/38' : 'text-white/62'}`}>{n}</span>
      <div className="bar">
        <div className="fill" style={{ width: `${Math.max((count / max) * 100, count > 0 ? 6 : 0)}%` }}>
          {count > 0 ? count : ''}
        </div>
      </div>
      <span className="text-right font-mono text-[12px] text-white/38">{pct.toFixed(1)}%</span>
    </div>
  )
}

function GameCard({ game, rank }) {
  const { grad, glow } = GROUP_GRADIENTS[game.id] ?? GROUP_GRADIENTS.twice
  const bars = [1, 2, 3, 4, 5, 6].map(k => ({ key: String(k), value: game.dist[k] ?? 0, miss: false }))
  bars.push({ key: '×', value: game.miss, miss: true })

  return (
    <div className="acct-game-card acct-specular" style={{ '--game-gradient': grad, '--game-glow': glow }}>
      <div className="stripe" />
      <div className="flex justify-between items-start mb-5">
        <div className="flex items-center gap-3.5">
          <div className="acct-game-orb" />
          <div>
            <h4 className="m-0 text-[18px] font-extrabold tracking-[-0.01em] leading-none">{GAME_NAMES[game.id]}</h4>
            <div className="mt-1 font-mono text-[11px] text-white/38 uppercase tracking-[0.12em]">
              {GROUP_LABELS[game.id]} · #{String(CATALOG_INDEX[game.id]).padStart(3, '0')}
            </div>
          </div>
        </div>
        {rank === 0 && <span className="acct-rank gold">★ Most played</span>}
        {rank === 1 && <span className="acct-rank silver">2nd most</span>}
      </div>

      <div className="acct-game-stats mb-[18px]">
        <GS label="Played" value={game.played} />
        <GS label="Wins" value={<>{game.won} <span className="pct">{game.winPct}%</span></>} />
        <GS label="Streak" value={game.streak} />
        <GS label="Avg." value={game.avg != null ? game.avg.toFixed(1) : '—'} />
      </div>

      <div className="acct-mini-dist">
        {bars.map(b => (
          <div key={b.key} className={`col${b.miss ? ' miss' : ''}`}>
            <div className="bar-wrap">
              <div className="bar" style={{ height: `${Math.max((b.value / game.maxBar) * 100, b.value > 0 ? 4 : 0)}%` }} />
            </div>
            <div className="font-mono text-[9px] text-white/38 tracking-[0.06em]">{b.key}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GS({ label, value }) {
  return (
    <div className="acct-gs">
      <div className="font-mono text-[9px] text-white/38 tracking-[0.14em] uppercase mb-1.5">{label}</div>
      <div className="gs-value">{value}</div>
    </div>
  )
}
