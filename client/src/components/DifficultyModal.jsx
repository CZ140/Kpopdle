import { DIFFICULTIES } from '../lib/constants'
import { useDifficulty, useSetDifficulty } from '../lib/GroupContext'

const OPTIONS = [
  {
    id: 'easy',
    label: 'Easy',
    description: 'More time to listen each guess',
    emoji: '🎵',
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'The default experience',
    emoji: '🎶',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'For true superfans',
    emoji: '🔥',
  },
]

function formatDurations(durations) {
  return durations.map((d) => `${d}s`).join(' · ')
}

export default function DifficultyModal({ onClose }) {
  const difficulty = useDifficulty()
  const setDifficulty = useSetDifficulty()

  function handleSelect(id) {
    setDifficulty(id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel rounded-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Difficulty</h2>
            <p className="text-xs text-white/40 mt-0.5">Changes clip length per guess</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 p-4">
          {OPTIONS.map((opt) => {
            const isSelected = difficulty === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className="w-full text-left px-4 py-4 rounded-xl border transition-all duration-200"
                style={isSelected ? {
                  borderColor: 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
                  background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                } : {
                  borderColor: 'rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{opt.emoji}</span>
                    <span
                      className="text-sm font-bold"
                      style={isSelected ? { color: 'var(--color-primary)' } : { color: 'rgba(255,255,255,0.85)' }}
                    >
                      {opt.label}
                    </span>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-white/35 mb-2">{opt.description}</p>
                <p className="font-mono text-[10px] tracking-wider text-white/25">
                  {formatDurations(DIFFICULTIES[opt.id])}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
