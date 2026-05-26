// Dependency-free SVG chart primitives for the admin dashboard.
// Hand-rolled instead of pulling in Recharts so the game bundle stays lean
// (this whole page is lazy-loaded anyway) and the data viz is fully ours.
import { fmtNum } from './format'

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
export function StatCard({ label, value, sub, accent = '#A855F7', danger }) {
  return (
    <div className="modal-panel rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{label}</span>
      <span
        className="text-3xl font-black leading-none"
        style={{ color: danger ? '#FF6B6B' : 'white' }}
      >
        {value}
      </span>
      {sub != null && (
        <span className="text-[11px] font-medium" style={{ color: accent }}>{sub}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-series area + line chart
// ---------------------------------------------------------------------------
export function AreaChart({ data, series, height = 190, formatX }) {
  const W = 640, H = height, padL = 34, padR = 10, padT = 14, padB = 22
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  if (!data || data.length === 0) {
    return <Empty height={height} />
  }

  const maxY = Math.max(1, ...data.flatMap(d => series.map(s => d[s.key] ?? 0)))
  const n = data.length
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v) => padT + innerH - (v / maxY) * innerH

  // Tidy y gridlines
  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxY / ticks) * i))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" role="img">
      {/* gridlines */}
      {gridVals.map((gv, i) => {
        const yy = y(gv)
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">{fmtNum(gv)}</text>
          </g>
        )
      })}

      {series.map((s) => {
        const linePts = data.map((d, i) => `${x(i)},${y(d[s.key] ?? 0)}`)
        const areaPath = `M ${padL},${padT + innerH} L ${linePts.join(' L ')} L ${x(n - 1)},${padT + innerH} Z`
        return (
          <g key={s.key}>
            {s.fill !== false && (
              <path d={areaPath} fill={s.color} opacity="0.12" />
            )}
            <polyline
              points={linePts.join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        )
      })}

      {/* x labels — first, middle, last */}
      {formatX && [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="9" fill="rgba(255,255,255,0.35)">
          {formatX(data[i].t)}
        </text>
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Donut (status distribution)
// ---------------------------------------------------------------------------
export function Donut({ data, centerLabel, centerValue }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const R = 60, C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" width="150" height="150" className="flex-shrink-0">
        <g transform="rotate(-90 80 80)">
          {total === 0 ? (
            <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
          ) : data.map((d, i) => {
            const len = (d.value / total) * C
            const seg = (
              <circle
                key={i}
                cx="80" cy="80" r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="18"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return seg
          })}
        </g>
        <text x="80" y="74" textAnchor="middle" fontSize="26" fontWeight="800" fill="white">{centerValue}</text>
        <text x="80" y="92" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)" letterSpacing="1">{centerLabel}</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-white/60 truncate">{d.label}</span>
            <span className="text-white/40 font-mono ml-auto pl-2">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horizontal bar list (top paths, geo, slowest, per-group)
// ---------------------------------------------------------------------------
export function BarList({ items, accent = '#A855F7' }) {
  const max = Math.max(1, ...items.map(i => i.value))
  if (!items.length) return <Empty height={120} />
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <div className="w-40 flex-shrink-0 flex items-center gap-1.5 min-w-0">
            {it.icon && <span className="flex-shrink-0">{it.icon}</span>}
            <span className="truncate font-mono text-[12px] text-white/70" title={it.label}>{it.label}</span>
            {it.tag && (
              <span className="flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${it.tagColor || '#FF6B6B'}22`, color: it.tagColor || '#FF6B6B' }}>
                {it.tag}
              </span>
            )}
          </div>
          <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.04]">
            <div
              className="h-full rounded-md transition-all duration-500"
              style={{ width: `${Math.max((it.value / max) * 100, 3)}%`, background: `linear-gradient(90deg, ${it.color || accent}, ${it.color || accent}88)` }}
            />
          </div>
          <span className="w-14 text-right font-mono text-[12px] text-white/55 flex-shrink-0">{it.display ?? it.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline (small inline trend)
// ---------------------------------------------------------------------------
export function Sparkline({ values, color = '#A855F7', height = 44 }) {
  const W = 240, H = height
  if (!values || values.length === 0) return <Empty height={height} />
  const max = Math.max(1, ...values)
  const n = values.length
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v) => H - 4 - (v / max) * (H - 8)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none">
      <path d={`M ${x(0)},${H} L ${pts.join(' L ')} L ${x(n - 1)},${H} Z`} fill={color} opacity="0.13" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Section({ title, subtitle, children, right }) {
  return (
    <section className="modal-panel rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-[11px] text-white/35 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function Empty({ height }) {
  return (
    <div className="flex items-center justify-center text-white/25 text-xs" style={{ height }}>
      No data yet
    </div>
  )
}
