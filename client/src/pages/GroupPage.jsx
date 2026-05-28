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
  twice:       { era: 'JYP\'s 9-member powerhouse', vibe: 'sugar-rush hooks and crystal-clear harmonies', span: 'their 2015 "Like OOH-AHH" debut through the latest comeback' },
  newjeans:    { era: 'ADOR\'s 5-member breakout', vibe: 'Y2K-coded R&B, jersey-club percussion and effortless cool', span: 'their 2022 debut Bunnies-era through every follow-up release' },
  lesserafim:  { era: 'HYBE/Source Music\'s 5-member group', vibe: 'sharp choreo, defiant lyrics and a polished hip-hop edge', span: 'FEARLESS through UNFORGIVEN and beyond' },
  aespa:       { era: 'SM\'s 4-member 4th-gen flagship', vibe: 'hyperpop synths, metaverse worldbuilding and Karina-led power vocals', span: 'Black Mamba through MY WORLD and the latest Drama era' },
  redvelvet:   { era: 'SM\'s long-running 5-member duo-concept group', vibe: 'the contrast between bright "Red" pop and moody "Velvet" R&B', span: '"Happiness" in 2014 all the way through Cosmic' },
  kissoflife:  { era: 'S2 Entertainment\'s rising 4-member act', vibe: 'R&B-leaning vocal showcases and silky group harmonies', span: 'their 2023 debut through Born to be XX and Lose Yourself' },
  ive:         { era: 'Starship\'s 6-member 4th-gen hit-makers', vibe: 'maximalist hooks, runway-grade visuals and Yujin/Wonyoung\'s star power', span: 'ELEVEN and LOVE DIVE through I AM and beyond' },
  blackpink:   { era: 'YG\'s globally dominant 4-member group', vibe: 'trap-pop drops, EDM crescendos and stadium-scale choruses', span: 'WHISTLE in 2016 through BORN PINK and every solo era' },
  bts:         { era: 'HYBE\'s 7-member global juggernaut', vibe: 'stadium-sized hip-hop, soaring chorus hooks and the ARMY-fueled lore that defined a generation', span: 'No More Dream in 2013 through the Map of the Soul era, Dynamite, Butter and the 2026 OT7 reunion' },
  straykids:   { era: 'JYP\'s 8-member self-producing crew', vibe: 'genre-mashing 3RACHA production, EDM drops, hip-hop ferocity and unrelenting concept pivots', span: 'their 2018 District 9 debut through Noeasy, Maxident, 5-Star, Ate and the latest Karma era' },
  seventeen:   { era: 'Pledis\'s 13-member self-producing collective', vibe: 'synchronized 13-way choreography, three-unit harmonies and razor-sharp self-written pop hooks', span: 'Adore U in 2015 through Don\'t Wanna Cry, HOME, HOT, FML, Seventeenth Heaven and 17 Is Right Here' },
  gidle:       { era: 'CUBE\'s 5-member 4th-gen self-produced act', vibe: 'Soyeon-helmed concept pivots that swing from sultry to bratty to defiant, with sharp Korean-language hooks', span: 'LATATA in 2018 through HWAA, TOMBOY, Nxde, Queencard, Super Lady and the I Sway era' },
  enhypen:     { era: 'HYBE/Belift Lab\'s 7-member I-LAND winners', vibe: 'vampire-coded dark-pop, layered vocal harmonies and theatrical b-sides with cinematic production', span: 'Given-Taken in 2020 through Drunk-Dazed, Tamed-Dashed, Dark Blood, Romance: Untold and Desire: Unleash' },
  ateez:       { era: 'KQ\'s 8-member theatrical powerhouse', vibe: 'cinematic worldbuilding, pirate-lore concept arcs and EDM-rock crescendos with extreme live vocals', span: 'Pirate King in 2018 through the Treasure, Zero: Fever, The World and Golden Hour albums' },
  txt:         { era: 'HYBE/Big Hit\'s 5-member dream-pop quintet', vibe: 'kaleidoscopic synth-pop, emo-rock crossovers and coming-of-age storytelling threaded across every era', span: 'Crown in 2019 through Blue Hour, 0X1=LOVESONG, Sugar Rush Ride, Chasing That Feeling and the Star Chapter era' },
  itzy:        { era: 'JYP\'s 5-member girl-crush leaders', vibe: 'punchy attitude anthems, fashion-runway choreography and Yeji-led delivery built for music-show charts', span: 'DALLA DALLA in 2019 through WANNABE, Not Shy, MAFIA In the morning, SNEAKERS, Cake, BORN TO BE and GOLD' },
  illit:       { era: 'HYBE/Belift Lab\'s 5-member youth-pop rookies', vibe: 'feather-light Y2K production, Magnetic-style hyper-pop hooks and warm pastel branding', span: 'Magnetic in 2024 through Lucky Girl Syndrome, Cherish, Tick-Tack and the bomb and NOT CUTE ANYMORE follow-ups' },
  nmixx:       { era: 'JYP\'s 6-member "mixx-pop" specialists', vibe: 'mid-song genre flips, Spanish-flair beats and four-vocalist tag-teams over orchestral hooks', span: 'O.O in 2022 through DICE, Love Me Like This, Soñar (Breaker), DASH and the Blue Valentine era' },
  exo:         { era: 'SM\'s long-running 9-member EXO-K/M giants', vibe: 'cinematic vocal layering, K-R&B grandeur and a decade of stadium-scale title tracks', span: 'MAMA in 2012 through Growl, Call Me Baby, Monster, Ko Ko Bop, Love Shot, Obsession and the Exist comeback' },
  bigbang:     { era: 'YG\'s 4-member 2nd-gen icons', vibe: 'genre-defying solo-led big-room pop, G-Dragon\'s production fingerprints and trap-pop anthems', span: 'Lies in 2007 through Haru Haru, Fantastic Baby, Bang Bang Bang, FXXK IT and Still Life' },
  shinee:      { era: 'SM\'s pearl-aqua 4-member vocal showcase', vibe: 'tight choreography, contemporary-R&B production and Onew/Key/Minho/Taemin vocal interplay', span: 'Replay in 2008 through Lucifer, Sherlock, View, Don\'t Call Me, Atlantis and Hard' },
  mamamoo:     { era: 'RBW\'s 4-member vocal powerhouse', vibe: 'color-spectrum era branding, vocal acrobatics and unapologetic girl-crush swagger', span: 'Mr. Ambiguous in 2014 through Um Oh Ah Yeh, Décalcomanie, HIP, AYA and the latest releases' },
  snsd:        { era: "SM's legendary 8-member 2nd-gen flagship", vibe: 'sugar-bright synth-pop, Sone pastel theming and the Korean Wave at its commercial peak', span: 'Into the New World in 2007 through Gee, Genie, Oh!, The Boys, I Got a Boy, Mr.Mr., Lion Heart and the FOREVER 1 reunion' },
  babymonster: { era: "YG's 7-member 5th-gen breakout", vibe: 'trap-pop drops, Ahyeon-led vocal anchors and YG\'s signature big-room production', span: 'BATTER UP in 2023 through SHEESH, LIKE THAT, FOREVER, DRIP and the WE GO UP era' },
  riize:       { era: "SM's bright 7-member 5th-gen rookies", vibe: 'fresh city-pop palettes, brass-led hooks and a deliberate light-and-breezy modern boy-band vibe', span: 'Get A Guitar in 2023 through Memories, Talk Saxy, Love 119, Boom Boom Bass and the Odyssey album' },
  boynextdoor: { era: "HYBE/KOZ's 6-member Zico-produced rookies", vibe: 'boy-band warmth crossed with old-school hip-hop production cues from producer-leader Zico', span: 'One and Only in 2023 through But Sometimes, Earth, Wind & Fire, Dangerous and the 19.99 and No Genre eras' },
  tws:         { era: "Pledis's bright 6-member SEVENTEEN-sibling group", vibe: 'youth-pop hooks, sparkling production and easy-to-love coming-of-age songwriting', span: 'plot twist in 2024 through Oh Mymy : 7s, hey! hey!, BFF and the play hard era' },
  zerobaseone: { era: "WAKEONE's 9-member Boys Planet survival winners", vibe: 'polished concept pop, choreo-forward title tracks and a relentless four-album-deep rookie velocity', span: 'In Bloom in 2023 through Crush, Take My Hand, Feel the POP, Good So Bad and BLUE' },
}

// Game UI colors — primary must be a vivid color usable on dark bg (BLACKPINK uses pink not dark)
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
