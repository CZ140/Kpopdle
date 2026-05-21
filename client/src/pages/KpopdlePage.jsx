import { useState, useCallback } from 'react'
import { GroupContext } from '../lib/GroupContext'
import { loadDifficulty, saveDifficulty } from '../lib/storage'
import Game from '../components/Game'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'
import DifficultyModal from '../components/DifficultyModal'

const KPOPDLE_COLORS = { primary: '#EC4899', secondary: '#6366F1' }
const KPOPDLE_LAUNCH = '2026-05-21'

export default function KpopdlePage() {
  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [difficulty, setDifficultyState] = useState(loadDifficulty)

  const setDifficulty = useCallback((d) => {
    setDifficultyState(d)
    saveDifficulty(d)
  }, [])

  return (
    <GroupContext.Provider value={{ id: 'kpopdle', archiveDate, practiceMode: false, difficulty, setDifficulty }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': KPOPDLE_COLORS.primary, '--color-secondary': KPOPDLE_COLORS.secondary }}
      >
        <Header
          onOpenArchive={() => setShowArchive(true)}
          onOpenDifficulty={() => setShowDifficulty(true)}
        />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
          <Game key={archiveDate ?? 'today'} />
        </main>
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
