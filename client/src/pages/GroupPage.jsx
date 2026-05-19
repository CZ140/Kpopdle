import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GroupContext } from '../lib/GroupContext'
import { migrateStorageIfNeeded } from '../lib/storage'
import Game from '../components/Game'
import PracticeGame from '../components/PracticeGame'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'

const VALID_GROUPS = ['twice', 'newjeans', 'lesserafim', 'aespa', 'redvelvet', 'kissoflife', 'ive', 'blackpink']

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

export default function GroupPage() {
  const { group } = useParams()
  const navigate = useNavigate()

  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)
  const [practiceKey, setPracticeKey] = useState(0)

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

  if (!VALID_GROUPS.includes(group)) {
    navigate('/')
    return null
  }

  const launchDate = GROUP_LAUNCH_DATES[group]

  const colors = GROUP_GAME_COLORS[group] ?? GROUP_GAME_COLORS.twice

  return (
    <GroupContext.Provider value={{ id: group, archiveDate, practiceMode }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': colors.primary, '--color-secondary': colors.secondary }}
      >
        <Header
          onOpenArchive={practiceMode ? undefined : () => setShowArchive(true)}
          onExitPractice={practiceMode ? exitPractice : undefined}
        />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
          {practiceMode ? (
            <PracticeGame key={`practice-${practiceKey}`} onPlayAgain={playAnotherPractice} />
          ) : (
            // key causes Game to fully remount when switching between archive dates
            <Game key={archiveDate ?? 'today'} onStartPractice={startPractice} />
          )}
        </main>
      </div>

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
