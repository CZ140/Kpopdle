import VolumeSlider from './VolumeSlider'

export default function AudioPlayer({ play, stop, isPlaying, progress, currentDuration, maxDuration, durations, isGameOver = false, volume = 0.8, onVolumeChange, hasAudio = true }) {
  if (!hasAudio) {
    return (
      <div className="w-full max-w-md mx-auto mb-8 flex items-center justify-center h-[180px]">
        <p className="text-sm text-white/30 font-medium">Audio preview unavailable</p>
      </div>
    )
  }

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
          disabled={!hasAudio}
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
      <VolumeSlider volume={volume} onChange={onVolumeChange} />
    </div>
  )
}
