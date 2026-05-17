export default function GuessRow({ guess, index }) {
  if (!guess) {
    return (
      <div className="h-11 flex items-center px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <span className="text-white/15 text-sm font-medium">{index + 1}</span>
      </div>
    )
  }

  const styles = {
    correct: 'bg-guess-correct/10 border-guess-correct/40 text-guess-correct',
    wrong: 'bg-guess-wrong/10 border-guess-wrong/30 text-guess-wrong/80',
    skipped: 'bg-white/[0.03] border-white/[0.08] text-white/30',
  }

  const icons = {
    correct: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    wrong: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    skipped: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  }

  return (
    <div className={`h-11 flex items-center gap-3 px-4 rounded-xl border transition-all duration-300 ${styles[guess.type]}`}>
      {icons[guess.type]}
      <span className="text-sm font-medium truncate">
        {guess.type === 'skipped' ? 'SKIPPED' : guess.song}
      </span>
    </div>
  )
}
