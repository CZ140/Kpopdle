import { Link } from 'react-router-dom'
import { loadGameState, loadCoverGameState } from '../lib/storage'

// The homepage "habit loop": three dailies to finish each day — K-POPDLE,
// Guess the Group, and any one group's daily (audio or cover). State comes
// straight from localStorage, so this costs nothing server-side.
const done = (s) => !!s && s.gameState !== 'playing'

export default function DailySet({ groups, today }) {
  const playedGroup = groups.find(g => done(loadGameState(g.id, today)) || done(loadCoverGameState(g.id, today)))
  const items = [
    { id: 'kpopdle', label: 'K-POPDLE', to: '/kpopdle', color: '#F97316', ok: done(loadGameState('kpopdle', today)) },
    { id: 'gtg', label: 'Guess the Group', to: '/guess-the-group', color: '#22D3EE', ok: done(loadGameState('guess-the-group', today)) },
    { id: 'group', label: playedGroup ? `${playedGroup.displayName} daily` : 'A group daily', to: playedGroup ? `/${playedGroup.id}` : '#hp-groups', color: '#FF2D78', ok: !!playedGroup },
  ]
  const count = items.filter(i => i.ok).length

  // Three arc segments on one ring; each fills in its mode colour when done.
  const r = 22, C = 2 * Math.PI * r, seg = C / 3, gap = 4

  return (
    <div className="hp-dailyset" aria-label={`Today's set: ${count} of 3 done`}>
      <div className="hp-dailyset-ring">
        <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
          {items.map((it, i) => (
            <circle key={it.id} cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
              stroke={it.ok ? it.color : 'rgba(255,255,255,0.12)'}
              strokeDasharray={`${seg - gap} ${C - seg + gap}`}
              transform={`rotate(${-90 + i * 120} 28 28)`} />
          ))}
        </svg>
        <span>{count === 3 ? '✓' : `${count}/3`}</span>
      </div>
      <div className="hp-dailyset-body">
        <div className="hp-dailyset-title">{count === 3 ? "Today's set complete" : "Today's set"}</div>
        <div className="hp-dailyset-items">
          {items.map(it => (
            <Link key={it.id} to={it.to} className={`hp-dailyset-item${it.ok ? ' is-done' : ''}`} style={{ '--c': it.color }}>
              <i /> {it.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
