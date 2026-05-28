import { Link } from 'react-router-dom'

// Segmented Cover/Audio switch shared by the audio game (GroupPage) and Coverdle
// (CoverGame), so each daily mode links to the other. `current` marks the active
// side; the other is a Link. Lives on per-group routes only (kpopdle has no cover).
const ICONS = {
  cover: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  audio: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ),
}

function ModeItem({ group, mode, current, label }) {
  const active = current === mode
  if (active) {
    return (
      <button className="mtog active" role="tab" aria-selected="true" type="button">
        {ICONS[mode]} {label}
      </button>
    )
  }
  const to = mode === 'cover' ? `/${group}/cover` : `/${group}`
  return (
    <Link to={to} className="mtog" role="tab" aria-selected="false">
      {ICONS[mode]} {label}
    </Link>
  )
}

export default function ModeToggle({ group, current }) {
  return (
    <div className="cv-mode-toggle" role="tablist" aria-label="Game mode">
      <ModeItem group={group} mode="audio" current={current} label="Audio" />
      <ModeItem group={group} mode="cover" current={current} label="Cover" />
    </div>
  )
}
