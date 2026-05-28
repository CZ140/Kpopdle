import { useNavigate } from 'react-router-dom'

// Mode icons — match the in-game <ModeToggle> so the visual language is
// consistent (music-note = audio, framed-image = cover).
const MODE_ICONS = {
  audio: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ),
  cover: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
}

// Per-mode completion pip — green tick when won, red X when lost, the mode
// icon when not yet played. Reads as "audio/cover today: solved / missed /
// untouched" without needing a hover tooltip.
function ModePip({ mode, label, solved, won }) {
  const state = !solved ? 'idle' : won ? 'won' : 'lost'
  return (
    <span
      className={`gc-pip ${state}`}
      title={`${label} — ${state === 'idle' ? 'not played' : state === 'won' ? 'solved' : 'missed'}`}
      aria-label={`${label} ${state === 'idle' ? 'not played today' : state === 'won' ? 'solved today' : 'missed today'}`}
    >
      <span className="gc-pip-dot" aria-hidden="true">
        {state === 'won' ? '✓' : state === 'lost' ? '✕' : MODE_ICONS[mode]}
      </span>
    </span>
  )
}

export default function GroupCard({
  group,
  isSolved = false,
  isWon = false,
  guessCount = 0,
  revealedSong = null,
  coverSolved = false,
  coverWon = false,
}) {
  const navigate = useNavigate()
  const isActive = group.active

  function handleClick() {
    if (isActive) navigate(`/${group.id}`)
  }

  const filledPips = isSolved ? Math.max(1, guessCount) : 0

  return (
    <div
      className={`kpop-card${isSolved ? ' solved' : ''}${!isActive ? ' inactive' : ''}`}
      style={{ '--glow': group.colors.primary }}
      onClick={handleClick}
      role={isActive ? 'button' : undefined}
    >
      {/* Gradient background */}
      <div
        className="kp-card-gradient"
        style={{
          background: `linear-gradient(135deg, ${group.colors.primary} 0%, ${group.colors.secondary} 100%)`
        }}
      />

      {/* Frost overlay */}
      <div className="kp-card-frost" />


      {/* Guess progress strip */}
      <div className="kp-stat-strip">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <span key={i} style={{ '--fill': i < filledPips ? 1 : 0 }} />
        ))}
      </div>

      {/* Card body */}
      <div
        className="relative z-[1] flex flex-col justify-between h-full"
        style={{ padding: 22 }}
      >
        {/* Top row — members on the left, per-mode pips on the right */}
        <div className="flex justify-between items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-white/60">
            {group.members} MEMBERS
          </span>
          {isActive && (
            <div className="gc-pips">
              <ModePip mode="audio" label="Audio"   solved={isSolved}    won={isWon} />
              <ModePip mode="cover" label="Coverdle" solved={coverSolved} won={coverWon} />
            </div>
          )}
        </div>

        {/* Bottom content */}
        <div>
          <h3
            className="font-extrabold text-white leading-none mb-1.5"
            style={{
              fontSize: 'clamp(22px, 2.2vw, 32px)',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 16px rgba(0,0,0,0.3)',
            }}
          >
            {group.gameName}
          </h3>
          <p className="text-xs font-medium text-white/70 uppercase tracking-[0.14em] mb-[18px]">
            {group.displayName}
          </p>
          <div className="flex items-center justify-between gap-3">
            {/* Today's game label */}
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 min-w-0">
              Today's game
              {isActive ? (
                <span className="block font-sans normal-case text-[13px] font-semibold tracking-tight mt-1 text-white/95 kp-song-text truncate">
                  {isSolved && revealedSong ? `"${revealedSong.title}"` : '▓▓▓▓ ▓▓▓▓▓▓'}
                </span>
              ) : (
                <span className="block font-sans normal-case text-[13px] font-medium tracking-tight mt-1 text-white/35">
                  Coming soon
                </span>
              )}
            </div>

            {/* Play button */}
            <button
              className={`inline-flex items-center gap-2 px-[14px] py-[9px] rounded-full text-xs font-bold tracking-[0.02em] flex-shrink-0 transition-colors duration-300 ${
                !isActive
                  ? 'bg-white/[0.08] text-white/40 cursor-default border border-white/[0.1]'
                  : isSolved
                  ? 'text-white/85 border border-white/[0.15]'
                  : 'bg-white/95 text-[#0d0d14]'
              }`}
              style={isSolved && isActive ? { background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' } : undefined}
              disabled={!isActive}
              tabIndex={isActive ? 0 : -1}
            >
              {isActive ? (
                <>PLAY <span className="kp-play-arrow">→</span></>
              ) : (
                'SOON'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
