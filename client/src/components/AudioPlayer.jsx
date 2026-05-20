export default function AudioPlayer({ play, stop, isPlaying, progress, currentDuration, maxDuration, durations, isGameOver = false, volume = 0.8, onVolumeChange }) {
  return (
    <div className="w-full max-w-md mx-auto mb-8">
      {/* Progress bar container */}
      <div className="relative h-2.5 bg-white/[0.06] rounded-full overflow-hidden mb-3">
        {/* Snippet duration markers — hidden when game is over */}
        {!isGameOver && durations.slice(0, -1).map((d) => (
          <div
            key={d}
            className="absolute top-0 h-full w-px bg-white/10"
            style={{ left: `${(d / maxDuration) * 100}%` }}
          />
        ))}

        {/* Current allowed duration indicator */}
        <div
          className="absolute top-0 h-full bg-white/[0.04] rounded-full transition-all duration-300"
          style={{ width: `${(currentDuration / maxDuration) * 100}%` }}
        />

        {/* Playback progress */}
        <div
          className={`absolute top-0 h-full rounded-full transition-none${isPlaying ? ' progress-gradient' : ''}`}
          style={{
            width: `${(progress * currentDuration / maxDuration) * 100}%`,
            ...(isPlaying ? {} : { background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }),
          }}
        />
      </div>

      {/* Duration labels */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-[11px] font-medium text-white/30 tabular-nums">
          {isPlaying ? `${Math.min(Math.ceil(progress * currentDuration), currentDuration)}s` : '0s'}
        </span>
        <span className="text-[11px] font-medium text-white/30 tabular-nums">
          {currentDuration}s / {maxDuration}s
        </span>
      </div>

      {/* Play button */}
      <div className="flex justify-center mb-5">
        <button
          onClick={isPlaying ? stop : play}
          disabled={false}
          className={`w-[72px] h-[72px] rounded-full disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 glow-btn ${isPlaying ? 'playing' : ''}`}
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-8 h-8 ml-1">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-3 px-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white/30 flex-shrink-0">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={e => onVolumeChange?.(parseFloat(e.target.value))}
          className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-secondary) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
          }}
          aria-label="Volume"
        />
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white/30 flex-shrink-0">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      </div>
    </div>
  )
}
