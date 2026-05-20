import { useState, useCallback } from 'react'
import { GroupContext } from '../lib/GroupContext'
import { loadDifficulty, saveDifficulty } from '../lib/storage'
import Game from '../components/Game'
import Header from '../components/Header'
import DifficultyModal from '../components/DifficultyModal'

const KPOPDLE_COLORS = { primary: '#EC4899', secondary: '#6366F1' }

export default function KpopdlePage() {
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [difficulty, setDifficultyState] = useState(loadDifficulty)

  const setDifficulty = useCallback((d) => {
    setDifficultyState(d)
    saveDifficulty(d)
  }, [])

  return (
    <GroupContext.Provider value={{ id: 'kpopdle', archiveDate: null, practiceMode: false, difficulty, setDifficulty }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': KPOPDLE_COLORS.primary, '--color-secondary': KPOPDLE_COLORS.secondary }}
      >
        <Header
          onOpenArchive={undefined}
          onOpenDifficulty={() => setShowDifficulty(true)}
        />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
          <Game />
        </main>
      </div>

      {showDifficulty && (
        <DifficultyModal onClose={() => setShowDifficulty(false)} />
      )}
    </GroupContext.Provider>
  )
}
