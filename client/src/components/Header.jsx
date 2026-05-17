import { useState } from 'react'
import HowToPlayModal from './HowToPlayModal'
import StatsModal from './StatsModal'

export default function Header() {
  const [showHelp, setShowHelp] = useState(false)
  const [showStats, setShowStats] = useState(false)

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => setShowHelp(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover:text-twice-pink"
          aria-label="How to play"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-black tracking-wider text-gradient select-none">
            TWICEDLE
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-medium -mt-0.5">
            Daily TWICE Song Quiz
          </p>
        </div>

        <button
          onClick={() => setShowStats(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover:text-twice-purple"
          aria-label="Statistics"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </button>
      </header>

      {showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} />}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </>
  )
}
