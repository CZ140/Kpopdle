// Playback volume slider — shared by the daily game's AudioPlayer and Battle's
// RoundView so the control looks and behaves identically. Themed via --color-*.
export default function VolumeSlider({ volume, onChange }) {
  return (
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
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
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
  )
}
