import { useState, useCallback, useMemo } from 'react'
import { GroupContext } from '../lib/GroupContext'
import { loadDifficulty, saveDifficulty } from '../lib/storage'
import { getKSTDateString } from '../lib/dateUtils'
import { useSound } from '../lib/SoundContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import Game from '../components/Game'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'
import DifficultyModal from '../components/DifficultyModal'

const KPOPDLE_COLORS = { primary: '#EC4899', secondary: '#6366F1' }
const KPOPDLE_LAUNCH = '2026-05-21'

function subtractDay(dateStr) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

function addDay(dateStr) {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function KpopdlePage() {
  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [difficulty, setDifficultyState] = useState(loadDifficulty)
  const { playSound } = useSound()

  useDocumentMeta({
    title: 'K-POPDLE Daily Challenge — Guess the K-pop Song',
    description: 'One daily K-pop song drawn from all 8 groups — guess it in 6 tries without knowing the group. A new cross-group K-pop Heardle challenge every day at midnight KST.',
    path: '/kpopdle',
  })

  const setDifficulty = useCallback((d) => {
    setDifficultyState(d)
    saveDifficulty(d)
  }, [])

  const today = getKSTDateString()
  const yesterday = subtractDay(today)

  const prevDate = useMemo(() => {
    if (archiveDate === null) return yesterday >= KPOPDLE_LAUNCH ? yesterday : null
    const prev = subtractDay(archiveDate)
    return prev >= KPOPDLE_LAUNCH ? prev : null
  }, [archiveDate, yesterday])

  const nextDate = useMemo(() => {
    if (archiveDate === null) return null
    const next = addDay(archiveDate)
    return next >= today ? null : next
  }, [archiveDate, today])

  const handlePrev = useCallback(() => {
    if (prevDate) { playSound('navigate'); setArchiveDate(prevDate) }
  }, [prevDate, playSound])

  const handleNext = useCallback(() => {
    if (archiveDate !== null) { playSound('navigate'); setArchiveDate(nextDate) }
  }, [archiveDate, nextDate, playSound])

  return (
    <GroupContext.Provider value={{ id: 'kpopdle', archiveDate, setArchiveDate, launchDate: KPOPDLE_LAUNCH, practiceMode: false, difficulty, setDifficulty }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': KPOPDLE_COLORS.primary, '--color-secondary': KPOPDLE_COLORS.secondary }}
      >
        <Header
          onOpenArchive={() => setShowArchive(true)}
          onOpenDifficulty={() => setShowDifficulty(true)}
        />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-24 sm:pb-8">
          <Game key={archiveDate ?? 'today'} />
        </main>

        {prevDate !== null && (
          <button
            onClick={handlePrev}
            className="fixed left-3 bottom-5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-20 w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/[0.08] sm:bg-white/[0.06] backdrop-blur-sm hover:bg-white/[0.12] border border-white/[0.1] sm:border-white/[0.08] text-white/50 sm:text-white/35 hover:text-white/70 transition-all duration-200"
            aria-label="Previous day"
            title="Previous game"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {archiveDate !== null && (
          <button
            onClick={handleNext}
            className="fixed right-3 bottom-5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-20 w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/[0.08] sm:bg-white/[0.06] backdrop-blur-sm hover:bg-white/[0.12] border border-white/[0.1] sm:border-white/[0.08] text-white/50 sm:text-white/35 hover:text-white/70 transition-all duration-200"
            aria-label="Next day"
            title={nextDate === null ? "Today's game" : "Next game"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      {showDifficulty && (
        <DifficultyModal onClose={() => setShowDifficulty(false)} />
      )}

      {showArchive && (
        <ArchiveModal
          launchDate={KPOPDLE_LAUNCH}
          onSelect={(date) => {
            setArchiveDate(date)
            setShowArchive(false)
          }}
          onClose={() => setShowArchive(false)}
        />
      )}
    </GroupContext.Provider>
  )
}
