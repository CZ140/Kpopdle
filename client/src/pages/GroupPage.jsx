import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GroupContext } from '../lib/GroupContext'
import { migrateStorageIfNeeded, loadDifficulty, saveDifficulty } from '../lib/storage'
import { ALL_GROUP_IDS, GAME_NAMES, GROUP_META } from '../lib/constants'
import { getKSTDateString } from '../lib/dateUtils'
import { useSound } from '../lib/SoundContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import Game from '../components/Game'
import PracticeGame from '../components/PracticeGame'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'
import DifficultyModal from '../components/DifficultyModal'

// kpopdle is a cross-group game, not a group page — exclude it
const VALID_GROUPS = ALL_GROUP_IDS.filter(id => id !== 'kpopdle')

// Game UI colors — primary must be a vivid color usable on dark bg (BLACKPINK uses pink not dark)
const GROUP_GAME_COLORS = {
  twice:      { primary: '#FF2D78', secondary: '#A855F7' },
  newjeans:   { primary: '#38BDF8', secondary: '#818CF8' },
  lesserafim: { primary: '#60A5FA', secondary: '#2563EB' },
  aespa:      { primary: '#C084FC', secondary: '#67E8F9' },
  redvelvet:  { primary: '#EF4444', secondary: '#FB7185' },
  kissoflife: { primary: '#F97316', secondary: '#EAB308' },
  ive:        { primary: '#7C3AED', secondary: '#F59E0B' },
  blackpink:  { primary: '#EC4899', secondary: '#DB2777' },
}

const GROUP_LAUNCH_DATES = {
  twice:      '2026-02-20',
  newjeans:   '2026-05-18',
  lesserafim: '2026-05-18',
  aespa:      '2026-05-18',
  redvelvet:  '2026-05-18',
  kissoflife: '2026-05-18',
  ive:        '2026-05-18',
  blackpink:  '2026-05-18',
}

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

export default function GroupPage() {
  const { group } = useParams()
  const navigate = useNavigate()
  const { playSound } = useSound()

  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)
  const [practiceKey, setPracticeKey] = useState(0)
  const [difficulty, setDifficultyState] = useState(loadDifficulty)

  const setDifficulty = useCallback((d) => {
    setDifficultyState(d)
    saveDifficulty(d)
  }, [])

  useEffect(() => {
    if (group === 'twice') migrateStorageIfNeeded()
  }, [group])

  // Reset all modes when switching groups
  useEffect(() => {
    setArchiveDate(null)
    setShowArchive(false)
    setPracticeMode(false)
    setPracticeKey(0)
  }, [group])

  const startPractice = useCallback(() => {
    setPracticeMode(true)
    setPracticeKey(k => k + 1)
  }, [])

  const playAnotherPractice = useCallback(() => {
    setPracticeKey(k => k + 1)
  }, [])

  const exitPractice = useCallback(() => {
    setPracticeMode(false)
  }, [])

  // Compute these before any conditional return so hooks below always run
  const launchDate = GROUP_LAUNCH_DATES[group] ?? '2099-01-01'
  const today = getKSTDateString()
  const yesterday = subtractDay(today)

  const prevDate = useMemo(() => {
    if (archiveDate === null) {
      return yesterday >= launchDate ? yesterday : null
    }
    const prev = subtractDay(archiveDate)
    return prev >= launchDate ? prev : null
  }, [archiveDate, launchDate, yesterday])

  const nextDate = useMemo(() => {
    if (archiveDate === null) return null
    const next = addDay(archiveDate)
    if (next >= today) return null // null means "go to today"
    return next
  }, [archiveDate, today])

  const handlePrev = useCallback(() => {
    if (prevDate) {
      playSound('navigate')
      setArchiveDate(prevDate)
    }
  }, [prevDate, playSound])

  const handleNext = useCallback(() => {
    if (archiveDate !== null) {
      playSound('navigate')
      setArchiveDate(nextDate)
    }
  }, [archiveDate, nextDate, playSound])

  // Per-route SEO: each group page gets its own title/description/canonical.
  const meta = GROUP_META[group]
  const gameName = GAME_NAMES[group]
  useDocumentMeta({
    title: meta ? `${gameName} — ${meta.tagline} | K-POPDLE` : undefined,
    description: meta
      ? `Guess the daily ${meta.displayName} song from a short audio clip. ${gameName} is a free K-pop Heardle — 6 tries, optional hints, and a new song every day at midnight KST.`
      : undefined,
    path: meta ? `/${group}` : '/',
  })

  if (!VALID_GROUPS.includes(group)) {
    navigate('/')
    return null
  }

  const colors = GROUP_GAME_COLORS[group] ?? GROUP_GAME_COLORS.twice

  return (
    <GroupContext.Provider value={{ id: group, archiveDate, setArchiveDate, launchDate, practiceMode, difficulty, setDifficulty }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': colors.primary, '--color-secondary': colors.secondary }}
      >
        <Header
          onOpenArchive={practiceMode ? undefined : () => setShowArchive(true)}
          onExitPractice={practiceMode ? exitPractice : undefined}
          onOpenDifficulty={() => setShowDifficulty(true)}
        />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-24 sm:pb-8">
          {practiceMode ? (
            <PracticeGame key={`practice-${practiceKey}`} onPlayAgain={playAnotherPractice} />
          ) : (
            // key causes Game to fully remount when switching between archive dates
            <Game key={archiveDate ?? 'today'} onStartPractice={startPractice} />
          )}
        </main>

        {/* Day navigation arrows */}
        {!practiceMode && (
          <>
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
          </>
        )}
      </div>

      {showDifficulty && (
        <DifficultyModal onClose={() => setShowDifficulty(false)} />
      )}

      {showArchive && (
        <ArchiveModal
          launchDate={launchDate}
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
