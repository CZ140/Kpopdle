import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useSound } from '../lib/SoundContext'
import { loadStats } from '../lib/storage'
import { fetchCloudStats } from '../lib/api'
import { ALL_GROUP_IDS } from '../lib/constants'

const GROUP_LABELS = {
  twice:      'TWICE',
  newjeans:   'NewJeans',
  lesserafim: 'LE SSERAFIM',
  aespa:      'aespa',
  redvelvet:  'Red Velvet',
  kissoflife: 'KISS OF LIFE',
  ive:        'IVE',
  blackpink:  'BLACKPINK',
  kpopdle:    'K-POPDLE',
}

const GROUP_SHORT = {
  twice:      'TWICE',
  newjeans:   'NJ',
  lesserafim: 'LSF',
  aespa:      'aespa',
  redvelvet:  'RV',
  kissoflife: 'KOL',
  ive:        'IVE',
  blackpink:  'BP',
  kpopdle:    'K-POP',
}

const GROUP_COLORS = {
  twice:      '#FF2D78',
  newjeans:   '#38BDF8',
  lesserafim: '#60A5FA',
  aespa:      '#C084FC',
  redvelvet:  '#EF4444',
  kissoflife: '#F97316',
  ive:        '#7C3AED',
  blackpink:  '#EC4899',
  kpopdle:    '#FF6B35',
}

function aggregateStats(statsMap) {
  const combined = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  }
  for (const stats of Object.values(statsMap)) {
    if (!stats) continue
    combined.gamesPlayed += stats.gamesPlayed ?? 0
    combined.gamesWon += stats.gamesWon ?? 0
    combined.currentStreak = Math.max(combined.currentStreak, stats.currentStreak ?? 0)
    combined.maxStreak = Math.max(combined.maxStreak, stats.maxStreak ?? 0)
    for (const k of ['1', '2', '3', '4', '5', '6']) {
      combined.guessDistribution[k] += stats.guessDistribution?.[k] ?? 0
    }
  }
  return combined
}

export default function AccountPage() {
  const navigate = useNavigate()
  const { user, logout, deleteAccount } = useAuth()
  const { playSound } = useSound()
  const [selected, setSelected] = useState('all')
  const [statsMap, setStatsMap] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Redirect if not logged in (null = confirmed logged out, undefined = still checking)
  useEffect(() => {
    if (user === null) navigate('/')
  }, [user, navigate])

  useEffect(() => {
    // Load local stats as initial values
    const local = {}
    for (const g of ALL_GROUP_IDS) local[g] = loadStats(g)
    // Intentional: seed the view with local stats on mount before cloud fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatsMap(local)

    if (!user) return
    // Fetch cloud stats and prefer cloud if it has more games played
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

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-twice-dark">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#FF2D78', borderRightColor: '#A855F7' }} />
      </div>
    )
  }

  if (!user) return null

  const currentStats = selected === 'all'
    ? aggregateStats(statsMap)
    : (statsMap[selected] ?? { gamesPlayed: 0, gamesWon: 0, currentStreak: 0, maxStreak: 0, guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } })

  const winPct = currentStats.gamesPlayed > 0
    ? Math.round((currentStats.gamesWon / currentStats.gamesPlayed) * 100)
    : 0

  const maxDistValue = Math.max(...Object.values(currentStats.guessDistribution), 1)
  const accentColor = selected === 'all' ? '#FF2D78' : (GROUP_COLORS[selected] ?? '#FF2D78')

  return (
    <div
      className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
      style={{ '--color-primary': accentColor, '--color-secondary': accentColor }}
    >
      {/* Header */}
      <header className="relative z-10 flex items-center px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => { playSound('click'); navigate(-1) }}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-black tracking-wider" style={{ background: 'linear-gradient(135deg, #FF2D78, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Account
          </h1>
        </div>
        <div className="w-9" />
      </header>

      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col gap-6">
        {/* Profile */}
        <div className="flex items-center gap-4 px-1">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-14 h-14 rounded-full ring-2 ring-white/10" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 ring-2 ring-white/10 flex items-center justify-center text-xl font-bold text-white">
              {user.displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <p className="text-base font-bold text-white leading-tight">{user.displayName}</p>
            <p className="text-sm text-white/40 mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="modal-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">Statistics</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/30 flex items-center gap-1">
              ☁ synced
            </span>
          </div>

          {/* Group selector tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: 'none' }}>
            <GroupTab
              label="All"
              active={selected === 'all'}
              color="#FF2D78"
              onClick={() => { playSound('click'); setSelected('all') }}
            />
            {ALL_GROUP_IDS.map(g => (
              <GroupTab
                key={g}
                label={GROUP_SHORT[g] ?? g.toUpperCase()}
                active={selected === g}
                color={GROUP_COLORS[g] ?? '#FF2D78'}
                onClick={() => { playSound('click'); setSelected(g) }}
                title={GROUP_LABELS[g]}
              />
            ))}
          </div>

          {/* Selected group label */}
          {selected !== 'all' && (
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">
              {GROUP_LABELS[selected]}
            </p>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { value: currentStats.gamesPlayed, label: 'Played' },
              { value: winPct, label: 'Win %' },
              { value: currentStats.currentStreak, label: 'Current' },
              { value: currentStats.maxStreak, label: 'Max' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Guess distribution */}
          <p className="text-[11px] font-bold text-white/40 mb-3 uppercase tracking-[0.15em]">Guess Distribution</p>
          <div className="space-y-2">
            {Object.entries(currentStats.guessDistribution).map(([guess, count]) => (
              <div key={guess} className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white/40 w-3 text-right">{guess}</span>
                <div className="flex-1 h-6 relative">
                  <div
                    className="h-full rounded-md flex items-center justify-end px-2.5 min-w-[24px] transition-all duration-500"
                    style={{
                      width: `${Math.max((count / maxDistValue) * 100, 8)}%`,
                      background: `linear-gradient(to right, color-mix(in srgb, ${accentColor} 35%, transparent), color-mix(in srgb, ${accentColor} 15%, transparent))`,
                    }}
                  >
                    <span className="text-[11px] font-bold text-white/80">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account actions */}
        <div className="modal-panel rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-1">Account</h2>

          <button
            onClick={() => { playSound('click'); logout() }}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white/55 hover:text-white/80 hover:bg-white/[0.07] border border-white/[0.08] transition-all duration-200"
          >
            Sign out
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => { playSound('click'); setShowDeleteConfirm(true) }}
              className="w-full py-3 rounded-xl text-sm font-semibold text-red-400/65 hover:text-red-400 hover:bg-red-400/[0.06] border border-red-400/[0.15] hover:border-red-400/30 transition-all duration-200"
            >
              Delete Account
            </button>
          ) : (
            <div className="rounded-xl border border-red-400/25 bg-red-400/[0.04] p-4 flex flex-col gap-3">
              <p className="text-sm text-white/55 leading-relaxed">
                This will permanently erase your account and all stats. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { playSound('click'); setShowDeleteConfirm(false) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { playSound('click'); deleteAccount() }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-all"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function GroupTab({ label, active, color, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex-shrink-0 h-8 px-3 rounded-lg text-[12px] font-bold transition-all duration-200"
      style={active ? {
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color: color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      } : {
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.35)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {label}
    </button>
  )
}
