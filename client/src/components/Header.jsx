import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroup, useArchiveDate, usePracticeMode, useDifficulty } from '../lib/GroupContext'
import { loadStats } from '../lib/storage'
import { useAuth } from '../lib/AuthContext'
import { useSound } from '../lib/SoundContext'
import StatsModal from './StatsModal'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function formatArchiveDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

const DIFFICULTY_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

const GROUP_META = {
  twice:      { gameName: 'TWICEDLE',   tagline: 'Daily TWICE Song Quiz' },
  newjeans:   { gameName: 'NEWJEANDLE', tagline: 'Daily NewJeans Song Quiz' },
  lesserafim: { gameName: 'SERAFIDLE',  tagline: 'Daily LE SSERAFIM Song Quiz' },
  aespa:      { gameName: 'AESPADLE',   tagline: 'Daily aespa Song Quiz' },
  redvelvet:  { gameName: 'VELVETLE',   tagline: 'Daily Red Velvet Song Quiz' },
  kissoflife: { gameName: 'KOLFDLE',    tagline: 'Daily KISS OF LIFE Song Quiz' },
  ive:        { gameName: 'IVEDLE',     tagline: 'Daily IVE Song Quiz' },
  blackpink:  { gameName: 'BPINKDLE',   tagline: 'Daily BLACKPINK Song Quiz' },
  kpopdle:    { gameName: 'K-POPDLE',   tagline: 'All Groups · One Daily Song' },
}

export default function Header({ onOpenArchive, onExitPractice, onOpenDifficulty }) {
  const group = useGroup()
  const archiveDate = useArchiveDate()
  const practiceMode = usePracticeMode()
  const difficulty = useDifficulty()
  const navigate = useNavigate()
  const [showStats, setShowStats] = useState(false)

  const { user, login } = useAuth()
  const { playSound, muted, toggleMuted } = useSound()
  const meta = GROUP_META[group] ?? GROUP_META.twice
  const isArchive = archiveDate !== null
  const currentStreak = loadStats(group).currentStreak

  return (
    <>
      <header className="relative z-10 flex items-center px-5 py-4 border-b border-white/[0.06]">
        <div className="flex-1 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover-group-primary"
            aria-label="Back to homepage"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black tracking-wider text-gradient select-none">
            {meta.gameName}
          </h1>
          {isArchive ? (
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold -mt-0.5" style={{ color: 'var(--color-primary)' }}>
              Past Game · {formatArchiveDate(archiveDate)}
            </p>
          ) : practiceMode ? null : (
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-medium -mt-0.5">
              {meta.tagline}
            </p>
          )}
        </div>

        <div className="flex-1 flex items-center justify-end gap-1">
          {practiceMode ? (
            <button
              onClick={() => { playSound('click'); onExitPractice() }}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover-group-primary"
              aria-label="Exit Practice"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : onOpenArchive ? (
            <button
              onClick={() => { playSound('modal'); onOpenArchive() }}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover-group-primary"
              aria-label="Past Games"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              <span className="text-[12px] font-semibold">Past Games</span>
            </button>
          ) : null}

          <button
            onClick={() => { playSound('modal'); onOpenDifficulty() }}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl transition-all duration-200 font-mono text-[13px] font-bold uppercase tracking-wider"
            style={{
              color: difficulty === 'normal' ? 'rgba(255,255,255,0.45)' : 'var(--color-primary)',
              background: difficulty === 'normal' ? 'rgba(255,255,255,0.05)' : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              border: difficulty === 'normal' ? '1px solid rgba(255,255,255,0.08)' : '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)',
            }}
            aria-label="Difficulty"
          >
            {DIFFICULTY_LABELS[difficulty]}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-60">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {!practiceMode && !isArchive && currentStreak > 0 && (
            <div
              className="h-9 px-3 flex items-center font-mono text-[13px] font-bold rounded-xl"
              style={{ color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
            >
              🔥{currentStreak}
            </div>
          )}

          <button
            onClick={() => { playSound('click'); toggleMuted() }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/35 hover:text-white/60"
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {user ? (
            <button
              onClick={() => { playSound('click'); navigate('/account') }}
              className="flex items-center gap-2 h-9 px-2 rounded-xl hover:bg-white/[0.08] transition-all duration-200"
              title={`Account — ${user.email}`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold text-white">
                  {user.displayName?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </button>
          ) : user === null ? (
            <button
              onClick={() => { playSound('click'); login() }}
              className="h-9 px-3 rounded-xl text-[12px] font-semibold text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200"
            >
              Sign in
            </button>
          ) : null}

          <button
            onClick={() => { playSound('modal'); setShowStats(true) }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all duration-200 text-white/50 hover-group-secondary"
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
