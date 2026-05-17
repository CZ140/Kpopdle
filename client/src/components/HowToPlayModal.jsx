export default function HowToPlayModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4" onClick={onClose}>
      <div
        className="modal-panel rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gradient">How to Play</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm text-white/60 leading-relaxed">
          <p>Listen to the intro of a <strong className="text-twice-pink font-semibold">TWICE</strong> song and guess which one it is.</p>
          <p>You have <strong className="text-white font-semibold">6 guesses</strong> to get it right.</p>
          <p>Wrong or skipped guesses unlock a <strong className="text-white font-semibold">longer snippet</strong> of the song:</p>

          <div className="bg-white/[0.04] rounded-xl p-4 space-y-1.5 font-mono text-xs border border-white/[0.06]">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <p key={n} className="flex justify-between">
                <span className="text-white/40">Guess {n}</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-twice-pink to-twice-purple font-bold">{n} second{n > 1 ? 's' : ''}</span>
              </p>
            ))}
          </div>

          <p className="pt-1">A new song is available every day. Good luck, <strong className="text-twice-peach font-semibold">ONCE!</strong></p>
        </div>
      </div>
    </div>
  )
}
