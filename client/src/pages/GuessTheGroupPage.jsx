import { useState, useCallback, useMemo } from 'react'
import { GroupContext } from '../lib/GroupContext'
import { LAUNCH_DATES, GUESS_GROUP_MAX_GUESSES, GUESS_GROUP_GAME_NAME } from '../lib/constants'
import { getKSTDateString } from '../lib/dateUtils'
import { useSound } from '../lib/SoundContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import GuessTheGroupGame from '../components/GuessTheGroupGame'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'

const GTG_COLORS = { primary: '#22D3EE', secondary: '#A855F7' }
const GTG_LAUNCH = LAUNCH_DATES['guess-the-group']
// 3-stop ladder matching design brief 2: 1s → 3s → 6s. Each stop roughly
// doubles, giving the player meaningfully more signal on each retry.
const GTG_LADDER = [1, 3, 6]

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

export default function GuessTheGroupPage() {
  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const { playSound } = useSound()

  useDocumentMeta({
    title: 'Guess the Group — Daily K-pop Clip Challenge',
    description: 'Hear one daily K-pop clip and name the group in 3 tries. A cross-group K-pop guessing game from all 8 groups, new every day at midnight KST.',
    path: '/guess-the-group',
  })

  const today = getKSTDateString()
  const yesterday = subtractDay(today)

  const prevDate = useMemo(() => {
    if (archiveDate === null) return yesterday >= GTG_LAUNCH ? yesterday : null
    const prev = subtractDay(archiveDate)
    return prev >= GTG_LAUNCH ? prev : null
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
    <GroupContext.Provider value={{
      id: 'guess-the-group',
      archiveDate,
      setArchiveDate,
      launchDate: GTG_LAUNCH,
      practiceMode: false,
      difficulty: 'normal',
      setDifficulty: () => {},
      maxGuesses: GUESS_GROUP_MAX_GUESSES,
      snippetLadder: GTG_LADDER,
      gameName: GUESS_GROUP_GAME_NAME,
    }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': GTG_COLORS.primary, '--color-secondary': GTG_COLORS.secondary }}
      >
        <Header onOpenArchive={() => setShowArchive(true)} />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-24 sm:pb-8">
          <GuessTheGroupGame key={archiveDate ?? 'today'} />
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

      {showArchive && (
        <ArchiveModal
          launchDate={GTG_LAUNCH}
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
