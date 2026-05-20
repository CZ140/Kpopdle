import { useNavigate } from 'react-router-dom'

export default function GroupCard({ group, isSolved = false, isWon = false, guessCount = 0, revealedSong = null }) {
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
        {/* Top row */}
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10px] tracking-[0.1em] text-white/60">
            {group.members} MEMBERS
          </span>
          {/* Status indicator */}
          {!isSolved ? (
            <div className="w-6 h-6 rounded-full border-2 border-white/20" />
          ) : isWon ? (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-green-950"
              style={{ background: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.55)' }}
            >
              ✓
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white"
              style={{ background: 'rgba(239,68,68,0.85)', boxShadow: '0 0 12px rgba(239,68,68,0.45)' }}
            >
              ✕
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
