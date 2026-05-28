import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GroupContext } from '../lib/GroupContext'
import { migrateStorageIfNeeded, loadDifficulty } from '../lib/storage'
import { ALL_GROUP_IDS, GROUP_META, LAUNCH_DATES } from '../lib/constants'
import { getKSTDateString } from '../lib/dateUtils'
import { useSound } from '../lib/SoundContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import CoverGame from '../components/CoverGame'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'
import GameAboutSection from '../components/GameAboutSection'

// kpopdle is a cross-group game, not a group page — exclude it
const VALID_GROUPS = ALL_GROUP_IDS.filter(id => id !== 'kpopdle')

// Game UI colors — mirrors GroupPage so Coverdle inherits each group's palette.
const GROUP_GAME_COLORS = {
  twice:       { primary: '#FF2D78', secondary: '#A855F7' },
  newjeans:    { primary: '#38BDF8', secondary: '#818CF8' },
  lesserafim:  { primary: '#60A5FA', secondary: '#2563EB' },
  aespa:       { primary: '#C084FC', secondary: '#67E8F9' },
  redvelvet:   { primary: '#EF4444', secondary: '#FB7185' },
  kissoflife:  { primary: '#F97316', secondary: '#EAB308' },
  ive:         { primary: '#7C3AED', secondary: '#F59E0B' },
  blackpink:   { primary: '#EC4899', secondary: '#DB2777' },
  bts:         { primary: '#7B2CBF', secondary: '#C77DFF' },
  straykids:   { primary: '#FACC15', secondary: '#1F2937' },
  seventeen:   { primary: '#FF8AC8', secondary: '#75B6FF' },
  gidle:       { primary: '#A78BFA', secondary: '#F472B6' },
  enhypen:     { primary: '#DC2626', secondary: '#FCA5A5' },
  ateez:       { primary: '#F59E0B', secondary: '#18181B' },
  txt:         { primary: '#0EA5E9', secondary: '#DDD6FE' },
  itzy:        { primary: '#DB2777', secondary: '#FCD34D' },
  illit:       { primary: '#F9A8D4', secondary: '#FEF3C7' },
  nmixx:       { primary: '#1D4ED8', secondary: '#FB7185' },
  exo:         { primary: '#60A5FA', secondary: '#94A3B8' },
  bigbang:     { primary: '#FBBF24', secondary: '#B91C1C' },
  shinee:      { primary: '#14B8A6', secondary: '#F0F9FF' },
  mamamoo:     { primary: '#BE185D', secondary: '#FACC15' },
  snsd:        { primary: '#F472B6', secondary: '#93C5FD' },
  babymonster: { primary: '#C026D3', secondary: '#F472B6' },
  riize:       { primary: '#06B6D4', secondary: '#FFEDD5' },
  boynextdoor: { primary: '#EA580C', secondary: '#FED7AA' },
  tws:         { primary: '#38BDF8', secondary: '#FBCFE8' },
  zerobaseone: { primary: '#6366F1', secondary: '#FB923C' },
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

export default function CoverPage() {
  const { group } = useParams()
  const navigate = useNavigate()
  const { playSound } = useSound()

  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  // Difficulty has no snippet effect in cover mode, but the share badge reads it.
  const difficulty = loadDifficulty()

  useEffect(() => {
    if (group === 'twice') migrateStorageIfNeeded()
  }, [group])

  // Reset archive when switching groups
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: clear
       group-scoped UI state when the :group route param changes */
    setArchiveDate(null)
    setShowArchive(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [group])

  const launchDate = LAUNCH_DATES[group] ?? '2099-01-01'
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
    if (next >= today) return null
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

  const meta = GROUP_META[group]
  useDocumentMeta({
    title: meta ? `COVERDLE — Guess the ${meta.displayName} Album Cover | K-POPDLE` : undefined,
    description: meta
      ? `Guess the daily ${meta.displayName} song from a blurred album cover that sharpens with every wrong guess. A free K-pop album-cover game — 6 tries, a new cover every day.`
      : undefined,
    path: meta ? `/${group}/cover` : '/',
  })

  if (!VALID_GROUPS.includes(group)) {
    navigate('/')
    return null
  }

  const colors = GROUP_GAME_COLORS[group] ?? GROUP_GAME_COLORS.twice

  return (
    <GroupContext.Provider value={{ id: group, archiveDate, setArchiveDate, launchDate, practiceMode: false, difficulty, setDifficulty: () => {}, coverMode: true }}>
      <div
        className="min-h-screen flex flex-col bg-twice-dark bg-orbs"
        style={{ '--color-primary': colors.primary, '--color-secondary': colors.secondary }}
      >
        {/* Difficulty has no effect in cover mode — pass a no-op so the header button is inert. */}
        <Header onOpenArchive={() => setShowArchive(true)} onOpenDifficulty={() => {}} />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-24 sm:pb-8">
          {/* key fully remounts the round when switching archive dates */}
          <CoverGame key={archiveDate ?? 'today'} />
        </main>

        {(() => {
          const name = meta?.displayName ?? group
          return (
            <GameAboutSection
              eyebrow={`Daily ${name} album-cover guess`}
              title={`About Coverdle — Daily ${name} Album Cover Game`}
              paragraphs={[
                `Coverdle is the visual companion to K-POPDLE's audio Heardle: instead of guessing a song from a clip, you guess a ${name} album from its cover art. Every day at midnight KST a new ${name} release is selected, and the cover starts heavily pixelated — sharpening one step every time you guess wrong or use the skip button.`,
                `The answer space is the album (or EP, or mini-album), not the title track. That's a deliberate choice: many K-pop releases share cover art across all tracks on the project, so guessing at the song level was unsolvable. Naming the album gives you a fair 1-of-N guess from ${name}'s discography, and the autocomplete dropdown surfaces only the eligible releases as you type.`,
                `Three optional hints — release year, color palette, and a member silhouette — let you trade attempts for context if a cover stumps you. Past Coverdle rounds for ${name} are replayable through the archive arrows, and your Coverdle streak is tracked separately from the audio Heardle so the two modes never collide.`,
              ]}
              howToPlay={[
                `A pixelated ${name} album cover appears at the top of the page.`,
                'Type your guess in the search box and pick an album from the autocomplete dropdown.',
                'Wrong guesses sharpen the cover one step closer to fully revealed.',
                `Identify the album within six tries to win. A new ${name} Coverdle drops every day at midnight KST.`,
              ]}
            />
          )
        })()}

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
            title={nextDate === null ? "Today's game" : 'Next game'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
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
