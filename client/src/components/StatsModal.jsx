import { useStats } from '../hooks/useStats'

export default function StatsModal({ onClose }) {
  const { stats } = useStats()
  const winPct = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0

  const maxDistValue = Math.max(...Object.values(stats.guessDistribution), 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4" onClick={onClose}>
      <div
        className="modal-panel rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gradient">Statistics</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-7">
          {[
            { value: stats.gamesPlayed, label: 'Played' },
            { value: winPct, label: 'Win %' },
            { value: stats.currentStreak, label: 'Current' },
            { value: stats.maxStreak, label: 'Max' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Guess distribution */}
        <h3 className="text-[11px] font-bold text-white/40 mb-3 uppercase tracking-[0.15em]">Guess Distribution</h3>
        <div className="space-y-2">
          {Object.entries(stats.guessDistribution).map(([guess, count]) => (
            <div key={guess} className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-white/40 w-3 text-right">{guess}</span>
              <div className="flex-1 h-6 relative">
                <div
                  className="h-full bg-gradient-to-r from-twice-hot-pink/30 to-twice-purple/20 rounded-md flex items-center justify-end px-2.5 min-w-[24px] transition-all duration-500"
                  style={{ width: `${Math.max((count / maxDistValue) * 100, 8)}%` }}
                >
                  <span className="text-[11px] font-bold text-white/80">{count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
