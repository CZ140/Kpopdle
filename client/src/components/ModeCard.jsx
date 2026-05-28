// Landscape "pick what to play" card for the homepage Modes section
// (design brief 4). Same kpop-card DNA (glass + frost + specular border +
// hover bloom) but the action is the mode, not a group. Each mode has a
// distinct visual centerpiece.
//
// The mode catalogue (route actions, copy, palette) lives in `lib/modes.js`.

import { useNavigate } from 'react-router-dom'

// Per-mode centerpiece. Pure CSS/SVG — no images, scales cleanly.
// Only the modes actually in the catalogue need a visual here; Daily Song
// and Coverdle were dropped from the section (they're reached via the group
// grid below + in-game ModeToggle).
function ModeVisual({ id }) {
  if (id === 'group') {
    const dots = [
      { p: '#FF2D78', s: '#A855F7', label: 'T' },
      { p: '#06B6D4', s: '#6366F1', label: 'N' },
      { p: '#10B981', s: '#06B6D4', label: 'A' },
      { p: '#EC4899', s: '#1a1a2e', label: 'B' },
    ]
    return (
      <div className="mv mv-group">
        <div className="mvg-core">?</div>
        {dots.map((d, i) => (
          <div key={i} className={`mvg-orbit pos-${i + 1}`} style={{ '--p': d.p, '--s': d.s }}>
            <div className="mvg-dots"><span /><span /></div>
            <div className="mvg-letter">{d.label}</div>
          </div>
        ))}
        <svg className="mvg-lines" viewBox="0 0 200 120" preserveAspectRatio="none">
          <line x1="100" y1="60" x2="30" y2="22" />
          <line x1="100" y1="60" x2="170" y2="22" />
          <line x1="100" y1="60" x2="30" y2="98" />
          <line x1="100" y1="60" x2="170" y2="98" />
        </svg>
      </div>
    )
  }
  if (id === 'kpopdle') {
    return (
      <div className="mv mv-kpopdle">
        <div className="mk-card c4" style={{ background: 'linear-gradient(135deg,#06B6D4,#6366F1)' }} />
        <div className="mk-card c3" style={{ background: 'linear-gradient(135deg,#10B981,#06B6D4)' }} />
        <div className="mk-card c2" style={{ background: 'linear-gradient(135deg,#FF2D78,#A855F7)' }} />
        <div className="mk-card c1" style={{ background: 'linear-gradient(135deg,#F97316,#EAB308)' }}>
          <div className="mk-glyph">★</div>
        </div>
      </div>
    )
  }
  if (id === 'battle') {
    // Two anonymous silhouettes flanking a VS plate — semantically "two
    // players square off," without committing to specific fake usernames.
    return (
      <div className="mv mv-battle">
        <div className="mb-side l">
          <div className="mb-av" style={{ background: 'linear-gradient(135deg,#FF2D78,#A855F7)' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 22a8 8 0 0 1 16 0Z" />
            </svg>
          </div>
        </div>
        <div className="mb-vs">VS</div>
        <div className="mb-side r">
          <div className="mb-av" style={{ background: 'linear-gradient(135deg,#06B6D4,#6366F1)' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 22a8 8 0 0 1 16 0Z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function ModeCard({ mode }) {
  const navigate = useNavigate()

  function handleClick() {
    if (mode.locked || !mode.onClick) return
    mode.onClick(navigate)
  }

  return (
    <button
      type="button"
      className={`mode-card ${mode.locked ? 'locked' : ''}`}
      style={{ '--glow': mode.glow, '--mg': mode.gradient }}
      onClick={handleClick}
      aria-disabled={mode.locked || undefined}
      aria-label={`${mode.name} — ${mode.oneliner}`}
    >
      <div className="mc-gradient" />
      <div className="mc-frost" />
      <div className="mc-body">
        <div className="mc-visual">
          <ModeVisual id={mode.id} />
        </div>
        <div className="mc-info">
          <div className="mc-meta">{mode.meta}</div>
          <div className="mc-name">{mode.name}</div>
          <div className="mc-oneliner">{mode.oneliner}</div>
          <div className="mc-foot">
            <span className={`mc-cta ${mode.locked ? 'ghost' : ''}`}>
              {mode.cta}<span className="cta-arrow">{mode.locked ? '↗' : '→'}</span>
            </span>
          </div>
        </div>
      </div>
      {mode.badge && (
        <span className={`mc-badge ${mode.badge.toLowerCase()}`}>{mode.badge}</span>
      )}
    </button>
  )
}
