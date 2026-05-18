import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroup, useArchiveDate } from '../lib/GroupContext'
import StatsModal from './StatsModal'

const GROUP_META = {
  twice:      { gameName: 'TWICEDLE',   tagline: 'Daily TWICE Song Quiz' },
  newjeans:   { gameName: 'NEWJEANDLE', tagline: 'Daily NewJeans Song Quiz' },
  lesserafim: { gameName: 'SERAFIDLE',  tagline: 'Daily LE SSERAFIM Song Quiz' },
  aespa:      { gameName: 'AESPADLE',   tagline: 'Daily aespa Song Quiz' },
  redvelvet:  { gameName: 'VELVETLE',   tagline: 'Daily Red Velvet Song Quiz' },
  kissoflife: { gameName: 'KOLFDLE',    tagline: 'Daily KISS OF LIFE Song Quiz' },
  ive:        { gameName: 'IVEDLE',     tagline: 'Daily IVE Song Quiz' },
  blackpink:  { gameName: 'BPINKDLE',   tagline: 'Daily BLACKPINK Song Quiz' },
}

export default function Header({ onOpenArchive }) {
  const group = useGroup()
  const archiveDate = useArchiveDate()
  const navigate = useNavigate()
  const [showStats, setShowStats] = useState(false)

  const meta = GROUP_META[group] ?? GROUP_META.twice
  const isArchive = archiveDate !== null

  return (
    <>
      <header className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover:text-twice-pink"
          aria-label="Back to homepage"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-black tracking-wider text-gradient select-none">
            {meta.gameName}
          </h1>
          {isArchive ? (
            <p className="text-[10px] uppercase tracking-[0.3em] text-twice-pink/70 font-bold -mt-0.5">
              Archive · {archiveDate}
            </p>
          ) : (
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-medium -mt-0.5">
              {meta.tagline}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenArchive}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover:text-twice-pink"
            aria-label="Archive"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </button>

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
        </div>
      </header>

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </>
  )
}
