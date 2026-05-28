import { useMemo } from 'react'

// Wax-seal recipient banner shown above the game when the player opens a
// challenge link. Replaces the small inline banner that lived in GroupPage —
// see game-plans/challenge-design (brief 3).
//
// Props:
//   challenge: { name, attempts, won, hintsUsed }   (parsed challenge payload)
//   gameName:  e.g. "TWICEDLE" / "K-POPDLE" / "Guess the Group"
//   gameNumber: integer day number (DAY #N), or null
//   fallbackNotice: if true, show "(That date wasn't available — here's today's.)"
//   onDismiss: () => void

// Two-letter initials for the seal disk. "soojin_94" → "SO", "Min Ki" → "MK".
function initialsFor(name) {
  if (!name) return '?'
  const clean = name.replace(/[_\-.]/g, ' ').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Reconstruct a 6-block result grid from the challenger's score. The challenge
// payload only carries (attempts, won) — we don't have their per-guess detail —
// so we render: (attempts-1) wrong + 1 correct + empties if won; 6 wrong if lost.
function reconstructGrid(attempts, won, max = 6) {
  const blocks = []
  if (won) {
    for (let i = 0; i < attempts - 1; i++) blocks.push('wrong')
    blocks.push('correct')
    while (blocks.length < max) blocks.push('empty')
  } else {
    for (let i = 0; i < max; i++) blocks.push('wrong')
  }
  return blocks
}

function ResultBlock({ kind }) {
  return <span className={`vs-block ${kind}`} />
}

export default function ChallengeBanner({ challenge, gameName, gameNumber, fallbackNotice = false, onDismiss }) {
  const initials = useMemo(() => initialsFor(challenge.name), [challenge.name])
  const blocks = useMemo(
    () => reconstructGrid(challenge.attempts, challenge.won),
    [challenge.attempts, challenge.won]
  )

  const scoreLabel = challenge.won ? challenge.attempts : 'X'
  const dayLabel = gameNumber != null ? `${gameName.toUpperCase()} · DAY #${gameNumber}` : gameName.toUpperCase()
  const display = challenge.name || 'A friend'

  return (
    <div className="cf cf-banner w-full">
      <div className="cf-banner-edge" />

      {/* Wax-seal avatar */}
      <div className="cf-banner-seal">
        <div className="seal-ring" />
        <div className="seal-disk">{initials}</div>
      </div>

      <div className="cf-banner-body">
        <div className="cf-banner-eyebrow">
          <span className="env-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          CHALLENGE INVITE
        </div>
        <div className="cf-banner-line">
          <b className="ch-name">{display}</b>
          <span className="ch-action">wants to beat your score on</span>
          <b className="ch-game">{dayLabel}</b>
        </div>

        <div className="cf-banner-target">
          <div className="bt-label">THEIR SCORE TO BEAT</div>
          <div className="bt-row">
            <div className="bt-score">
              <b>{scoreLabel}</b><span>/6</span>
            </div>
            <div className="bt-grid">
              {blocks.map((k, i) => <ResultBlock key={i} kind={k} />)}
            </div>
          </div>
        </div>

        {fallbackNotice && (
          <p className="cf-banner-note">
            That date wasn&apos;t available — you&apos;re playing today&apos;s instead.
          </p>
        )}
      </div>

      <div className="cf-banner-cta">
        <button
          type="button"
          className="cf-btn-primary big"
          onClick={() => {
            // Smooth-scroll the game into view as the "Play" affordance — the
            // game is already mounted below this banner.
            document.querySelector('.gtg, .coverdle, .kp-audio, main')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          PLAY THE CHALLENGE<span className="cs-arrow">→</span>
        </button>
        <button
          type="button"
          className="cf-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss challenge banner"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
