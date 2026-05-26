import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { fetchAdminDashboard, triggerBackfill } from '../lib/api'
import { StatCard, AreaChart, Donut, BarList, Sparkline, Section } from '../components/admin/charts'
import { fmtNum, fmtMs, COUNTRY_FLAG } from '../components/admin/format'

const GROUP_META = {
  twice:      ['TWICE', '#FF2D78'],
  newjeans:   ['NewJeans', '#38BDF8'],
  lesserafim: ['LE SSERAFIM', '#60A5FA'],
  aespa:      ['aespa', '#C084FC'],
  redvelvet:  ['Red Velvet', '#EF4444'],
  kissoflife: ['KISS OF LIFE', '#F97316'],
  ive:        ['IVE', '#7C3AED'],
  blackpink:  ['BLACKPINK', '#EC4899'],
  kpopdle:    ['K-POPDLE', '#FF6B35'],
}

const RANGES = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
]

function statusColor(s) {
  if (s >= 500) return '#FF6B6B'
  if (s === 429) return '#EC4899'
  if (s === 404) return '#3B82F6'
  if (s === 403) return '#F59E0B'
  if (s === 401) return '#A855F7'
  if (s === 499) return '#8B5CF6'
  if (s >= 400) return '#14B8A6'
  if (s >= 300) return '#38BDF8'
  return '#4ADE80'
}

const STATUS_LABELS = {
  400: '400 Bad Request', 401: '401 Unauthorized', 403: '403 Forbidden',
  404: '404 Not Found', 429: '429 Rate Limited', 499: '499 Client Closed',
  500: '500 Server Error', 502: '502 Bad Gateway', 503: '503 Unavailable',
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [hours, setHours] = useState(24)
  const [state, setState] = useState({ loading: true, status: 200, data: null })
  const [backfill, setBackfill] = useState({ running: false, msg: null })

  const load = useCallback((h) => {
    fetchAdminDashboard(h)
      .then(({ status, data }) => setState({ loading: false, status, data }))
      .catch(() => setState({ loading: false, status: 0, data: null }))
  }, [])

  const doBackfill = useCallback(async () => {
    setBackfill({ running: true, msg: null })
    const r = await triggerBackfill(30)
    if (r.ok) {
      setBackfill({ running: false, msg: `Imported ~${(r.estRequests ?? 0).toLocaleString()} requests` })
      load(hours)
    } else {
      setBackfill({ running: false, msg: r.error || 'Backfill failed' })
    }
  }, [hours, load])

  useEffect(() => { load(hours) }, [hours, load])

  // Live-ish: refresh every 30s while viewing.
  useEffect(() => {
    const id = setInterval(() => load(hours), 30_000)
    return () => clearInterval(id)
  }, [hours, load])

  // --- Access states -------------------------------------------------------
  if (user === undefined || state.loading) return <Centered><Spinner /></Centered>

  if (state.status === 401) {
    return (
      <Centered>
        <div className="modal-panel rounded-2xl p-8 text-center max-w-sm">
          <h1 className="text-lg font-black text-white mb-2">Admin access</h1>
          <p className="text-sm text-white/50 mb-6">Sign in with an authorized account to view analytics.</p>
          <button onClick={login} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#FF2D78,#A855F7)' }}>
            Sign in with Google
          </button>
        </div>
      </Centered>
    )
  }

  if (state.status === 403) {
    return (
      <Centered>
        <div className="modal-panel rounded-2xl p-8 text-center max-w-sm">
          <h1 className="text-lg font-black text-white mb-2">Not authorized</h1>
          <p className="text-sm text-white/50 mb-6">This account isn't on the admin allowlist.</p>
          <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 border border-white/10 hover:bg-white/[0.06]">
            Back to game
          </button>
        </div>
      </Centered>
    )
  }

  if (!state.data) return <Centered><p className="text-white/40 text-sm">Couldn't load analytics.</p></Centered>

  const d = state.data
  const k = d.kpis

  // Time-axis formatter depends on the selected window.
  const formatX = (t) => {
    const dt = new Date(t * 1000)
    return hours <= 24
      ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : dt.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
  }

  const donutData = d.statusBreakdown.map(s => ({
    label: STATUS_LABELS[s.status] || `${s.status}`,
    value: s.count,
    color: statusColor(s.status),
  }))
  const totalErrors = d.statusBreakdown.reduce((a, s) => a + s.count, 0)

  const errorPathItems = d.topErrorPaths.map(p => ({
    label: p.path,
    value: p.count,
    color: statusColor(p.status),
    tag: p.isBot ? 'BOT' : String(p.status),
    tagColor: p.isBot ? '#8B5CF6' : statusColor(p.status),
  }))

  const geoItems = d.geo.map(g => ({
    label: g.country,
    icon: COUNTRY_FLAG(g.country),
    value: g.requests,
    display: fmtNum(g.requests),
    color: '#38BDF8',
  }))

  const slowItems = d.latency.slowest.map(s => ({
    label: s.path,
    value: s.avg_ms,
    display: fmtMs(s.avg_ms),
    color: s.avg_ms > 1000 ? '#FF6B6B' : s.avg_ms > 400 ? '#F59E0B' : '#4ADE80',
  }))

  const gameItems = d.games.byGroup.map(g => {
    const [name, color] = GROUP_META[g.group_id] || [g.group_id, '#A855F7']
    return { label: name, value: g.plays, display: `${fmtNum(g.plays)} · ${g.win_rate}%`, color }
  })

  const humanTotal = k.totalRequests - k.botRequests

  return (
    <div className="min-h-screen flex flex-col bg-twice-dark bg-orbs">
      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] text-white/50" aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <h1 className="text-xl font-black tracking-wider" style={{ background: 'linear-gradient(135deg,#FF2D78,#A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Analytics
        </h1>
        <span className="kp-live-dot ml-1" title="Live — refreshes every 30s" />
        <div className="ml-auto flex items-center gap-2">
          {backfill.msg && <span className="text-[11px] text-white/45 max-w-[180px] truncate" title={backfill.msg}>{backfill.msg}</span>}
          <button
            onClick={doBackfill}
            disabled={backfill.running}
            title="Import historical traffic from Cloudflare into the dashboard"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/60 border border-white/10 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-50 transition-all"
          >
            {backfill.running ? 'Importing…' : '⟳ Backfill'}
          </button>
          <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
            {RANGES.map(r => (
              <button key={r.hours} onClick={() => setHours(r.hours)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={hours === r.hours ? { background: 'rgba(168,85,247,0.2)', color: '#C084FC' } : { color: 'rgba(255,255,255,0.4)' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Requests" value={fmtNum(k.totalRequests)} sub={d.telemetrySince ? 'incl. Cloudflare backfill' : `${fmtNum(humanTotal)} human`} accent="#4ADE80" />
          <StatCard label="Error rate" value={`${k.errorRate}%`} sub={`${k.serverErrors} server (5xx)`} danger={k.errorRate > 20} accent="#F59E0B" />
          <StatCard label="Unique visitors" value={fmtNum(k.uniqueVisitors)} sub="live only · by IP" accent="#38BDF8" />
          <StatCard label="Bot requests" value={fmtNum(k.botRequests)} sub="scanners & crawlers" accent="#8B5CF6" />
          <StatCard label="Registered users" value={fmtNum(k.totalUsers)} sub={`+${d.userGrowth.newThisWeek} this week`} accent="#FF2D78" />
          <StatCard label="Games played" value={fmtNum(k.gamesInWindow)} sub="in selected window" accent="#FF6B35" />
        </div>

        {/* Traffic + errors over time */}
        <Section
          title="Traffic & errors over time"
          subtitle={d.telemetrySince ? 'Left of the marker is Cloudflare backfill; right is live telemetry' : 'Total requests, with 4xx / 5xx overlaid'}
        >
          <AreaChart
            data={d.traffic}
            height={210}
            formatX={formatX}
            boundaryT={d.telemetrySince}
            series={[
              { key: 'total', color: '#38BDF8', label: 'Total' },
              { key: 'c4xx', color: '#F59E0B', label: '4xx' },
              { key: 'c5xx', color: '#FF6B6B', label: '5xx' },
            ]}
          />
          <Legend items={[['Total', '#38BDF8'], ['4xx', '#F59E0B'], ['5xx', '#FF6B6B']]} />
        </Section>

        {/* Error distribution + top error paths */}
        <div className="grid lg:grid-cols-2 gap-5">
          <Section title="Error status distribution">
            {donutData.length
              ? <Donut data={donutData} centerLabel="ERRORS" centerValue={fmtNum(totalErrors)} />
              : <p className="text-white/30 text-sm py-8 text-center">No errors in this window 🎉</p>}
          </Section>
          <Section title="Top error paths" subtitle="BOT = vulnerability scans (safe to ignore)">
            <BarList items={errorPathItems} />
          </Section>
        </div>

        {/* Latency */}
        <Section title="Response latency" subtitle="Human traffic only — bot 404s would skew this optimistically">
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[['p50', d.latency.p50], ['p95', d.latency.p95], ['p99', d.latency.p99], ['max', d.latency.max]].map(([label, v]) => (
              <div key={label} className="text-center modal-panel rounded-xl py-3">
                <p className="text-2xl font-black" style={{ color: v > 1000 ? '#FF6B6B' : v > 400 ? '#F59E0B' : '#4ADE80' }}>{fmtMs(v)}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold text-white/40 mb-3 uppercase tracking-[0.15em]">Slowest endpoints (avg)</p>
          <BarList items={slowItems} />
        </Section>

        {/* Geography + growth */}
        <div className="grid lg:grid-cols-2 gap-5">
          <Section title="Top countries" subtitle="By requests (live + Cloudflare backfill)">
            <BarList items={geoItems} />
          </Section>
          <Section title="Audience growth">
            <div className="mb-5">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Daily visitors · 14d</span>
              </div>
              <Sparkline values={d.activeUsers.map(a => a.visitors)} color="#38BDF8" />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Sign-ups · 30d</span>
                <span className="text-xs text-white/40">{d.userGrowth.total} total</span>
              </div>
              <Sparkline values={d.userGrowth.daily.map(s => s.signups)} color="#FF2D78" />
            </div>
          </Section>
        </div>

        {/* Game analytics */}
        <Section title="Game analytics" subtitle={`${fmtNum(d.games.totalPlays)} games all-time · ${d.games.winRate}% win rate`}>
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-bold text-white/40 mb-3 uppercase tracking-[0.15em]">Plays by group · win rate</p>
              <BarList items={gameItems} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/40 mb-3 uppercase tracking-[0.15em]">Plays per day · 30d</p>
              <Sparkline values={d.games.daily.map(g => g.plays)} color="#FF6B35" height={120} />
            </div>
          </div>
        </Section>

        {/* Live request feed */}
        <Section title="Recent requests" subtitle="Most recent 40 — live">
          <div className="flex flex-col gap-0.5 font-mono text-[12px]">
            {d.recent.map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-white/[0.03]">
                <span className="text-white/30 w-16 flex-shrink-0">{new Date(r.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span className="w-12 flex-shrink-0 font-bold text-center rounded px-1" style={{ color: statusColor(r.status), background: `${statusColor(r.status)}1A` }}>{r.status}</span>
                <span className="w-12 flex-shrink-0 text-white/40">{r.method}</span>
                <span className="flex-1 truncate text-white/65" title={r.path}>{r.path}</span>
                {r.isBot ? <span className="flex-shrink-0 text-[9px] font-bold uppercase text-violet-400/80">bot</span> : null}
                <span className="flex-shrink-0">{COUNTRY_FLAG(r.country)}</span>
                <span className="w-14 text-right flex-shrink-0 text-white/35">{fmtMs(r.durationMs)}</span>
              </div>
            ))}
          </div>
        </Section>

        <p className="text-center text-[11px] text-white/25 py-4">
          Updated {new Date(d.generatedAt * 1000).toLocaleTimeString()} · telemetry retained 90 days · IPs hashed, never stored
        </p>
      </main>
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 justify-center">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-white/50">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}
        </span>
      ))}
    </div>
  )
}

function Centered({ children }) {
  return <div className="min-h-screen flex items-center justify-center bg-twice-dark bg-orbs px-4">{children}</div>
}

function Spinner() {
  return <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#FF2D78', borderRightColor: '#A855F7' }} />
}
