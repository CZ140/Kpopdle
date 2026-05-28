import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { GroupContext } from '../lib/GroupContext'
import { migrateStorageIfNeeded, loadDifficulty, saveDifficulty } from '../lib/storage'
import { ALL_GROUP_IDS, GAME_NAMES, GROUP_META, LAUNCH_DATES } from '../lib/constants'
import { getKSTDateString } from '../lib/dateUtils'
import { parseChallenge, CHALLENGE_DATE_RE } from '../lib/share'
import { useSound } from '../lib/SoundContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import Game from '../components/Game'
import PracticeGame from '../components/PracticeGame'
import Header from '../components/Header'
import ModeToggle from '../components/ModeToggle'
import ChallengeBanner from '../components/ChallengeBanner'
import ArchiveModal from '../components/ArchiveModal'
import DifficultyModal from '../components/DifficultyModal'
import GameAboutSection from '../components/GameAboutSection'

// kpopdle is a cross-group game, not a group page — exclude it
const VALID_GROUPS = ALL_GROUP_IDS.filter(id => id !== 'kpopdle')

// Per-group SEO blurbs — distinguishing copy per route so Google doesn't
// flag the group pages as near-duplicates. Each blurb leans on
// real-world detail (era, distinctive sound, member count) so the body
// text isn't just templated.
const GROUP_BLURBS = {
  twice:      { era: 'JYP\'s 9-member powerhouse', vibe: 'sugar-rush hooks and crystal-clear harmonies', span: 'their 2015 "Like OOH-AHH" debut through the latest comeback' },
  newjeans:   { era: 'ADOR\'s 5-member breakout', vibe: 'Y2K-coded R&B, jersey-club percussion and effortless cool', span: 'their 2022 debut Bunnies-era through every follow-up release' },
  lesserafim: { era: 'HYBE/Source Music\'s 5-member group', vibe: 'sharp choreo, defiant lyrics and a polished hip-hop edge', span: 'FEARLESS through UNFORGIVEN and beyond' },
  aespa:      { era: 'SM\'s 4-member 4th-gen flagship', vibe: 'hyperpop synths, metaverse worldbuilding and Karina-led power vocals', span: 'Black Mamba through MY WORLD and the latest Drama era' },
  redvelvet:  { era: 'SM\'s long-running 5-member duo-concept group', vibe: 'the contrast between bright "Red" pop and moody "Velvet" R&B', span: '"Happiness" in 2014 all the way through Cosmic' },
  kissoflife: { era: 'S2 Entertainment\'s rising 4-member act', vibe: 'R&B-leaning vocal showcases and silky group harmonies', span: 'their 2023 debut through Born to be XX and Lose Yourself' },
  ive:        { era: 'Starship\'s 6-member 4th-gen hit-makers', vibe: 'maximalist hooks, runway-grade visuals and Yujin/Wonyoung\'s star power', span: 'ELEVEN and LOVE DIVE through I AM and beyond' },
  blackpink:  { era: 'YG\'s globally dominant 4-member group', vibe: 'trap-pop drops, EDM crescendos and stadium-scale choruses', span: 'WHISTLE in 2016 through BORN PINK and every solo era' },
}

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
  const [searchParams] = useSearchParams()

  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)
  const [practiceKey, setPracticeKey] = useState(0)
  const [difficulty, setDifficultyState] = useState(loadDifficulty)
  // Async "challenge a friend" — decoded challenger result + a "challenged you" banner.
  const [challenge, setChallenge] = useState(null)
  const [challengeFallback, setChallengeFallback] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const setDifficulty = useCallback((d) => {
    setDifficultyState(d)
    saveDifficulty(d)
  }, [])

  useEffect(() => {
    if (group === 'twice') migrateStorageIfNeeded()
  }, [group])

  // Reset all modes when switching groups
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: clear all
       group-scoped UI state when the :group route param changes */
    setArchiveDate(null)
    setShowArchive(false)
    setPracticeMode(false)
    setPracticeKey(0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [group])

  // Async challenge: decode `?c=` (challenger result) and `?d=` (game date).
  // A garbage/absent `c` yields null → plays as a normal game (FR-7). When `d`
  // is a valid past date, drive the archive view; today's date stays on /today.
  // An invalid/pre-launch/future `d` falls back to today with a dismissible notice.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: derive
       challenge/archive UI state from the URL on mount and on group/param change */
    const decoded = parseChallenge(searchParams)
    setChallenge(decoded)
    setBannerDismissed(false)

    const today = getKSTDateString()
    const launch = LAUNCH_DATES[group] ?? '2099-01-01'
    const d = searchParams.get('d')

    if (d && CHALLENGE_DATE_RE.test(d) && d < today && d >= launch) {
      setArchiveDate(d)
      setChallengeFallback(false)
    } else if (d && d !== today) {
      // d present but unplayable (future, pre-launch, or malformed) → land on today.
      setArchiveDate(null)
      setChallengeFallback(decoded !== null)
    } else {
      // No date, or d === today → today's daily.
      setArchiveDate(null)
      setChallengeFallback(false)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [group, searchParams])

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
          {!practiceMode && challenge && !bannerDismissed && (
            <div className="w-full mt-4 flex justify-center px-2">
              <ChallengeBanner
                challenge={challenge}
                gameName={gameName ?? 'K-POPDLE'}
                gameNumber={null}
                fallbackNotice={challengeFallback}
                onDismiss={() => setBannerDismissed(true)}
              />
            </div>
          )}
          {!practiceMode && (
            <div className="w-full max-w-lg mx-auto mt-4 flex justify-center">
              <ModeToggle group={group} current="audio" />
            </div>
          )}
          {practiceMode ? (
            <PracticeGame key={`practice-${practiceKey}`} onPlayAgain={playAnotherPractice} />
          ) : (
            // key causes Game to fully remount when switching between archive dates
            <Game key={archiveDate ?? 'today'} onStartPractice={startPractice} challenge={challenge} />
          )}
        </main>

        {!practiceMode && (() => {
          const meta = GROUP_META[group]
          const blurb = GROUP_BLURBS[group]
          const name = meta?.displayName ?? group
          return (
            <GameAboutSection
              eyebrow={`Daily ${name} song quiz`}
              title={`About the Daily ${name} Heardle on K-POPDLE`}
              paragraphs={[
                `The ${name} daily is a free Heardle-style song quiz built around ${blurb?.era ?? `${name}'s discography`}. Every day at midnight KST a new ${name} track is selected from a curated catalog covering ${blurb?.span ?? 'their full discography'}, and you have six tries to identify it from progressively longer audio clips.`,
                `${name}'s catalog leans into ${blurb?.vibe ?? 'their signature sound'}, which makes the daily challenge feel different from a cross-group round — you're listening for ${name}-specific production cues, vocal lines, and ad-libs rather than guessing across the whole K-pop landscape. Title tracks and B-sides are both in rotation, so even devoted fans regularly run into deep-cut surprises.`,
                `Use the archive arrows below to replay any previous ${name} daily back to launch, or jump into Coverdle for the same group to guess the album cover instead. Your ${name} streak, stats, and guess distribution are saved locally — no sign-up required — and the difficulty selector controls how generous the snippet ladder is across all 6 tries.`,
              ]}
              howToPlay={[
                `Press play to hear today's ${name} clip — it starts at one second.`,
                'Type your guess in the search box and pick a song from the autocomplete dropdown.',
                'A wrong (or skipped) guess unlocks a longer snippet — up to six tries total.',
                `Solve it to keep your ${name} streak alive. A fresh ${name} song drops at midnight KST.`,
              ]}
            />
          )
        })()}

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
