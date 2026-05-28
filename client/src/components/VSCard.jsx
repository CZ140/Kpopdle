import { useMemo, useState } from 'react'
import { buildChallengeUrl, challengePreface, challengeVerdict, copyToClipboard } from '../lib/share'
import { useGroup } from '../lib/GroupContext'
import { useAuth } from '../lib/AuthContext'
import { GAME_NAMES, MAX_GUESSES } from '../lib/constants'

// Head-to-head card shown inside ResultModal when a challenge is present.
// Replaces the small "Head to Head" panel + the standalone Share/Challenge
// buttons with the dual-side comparison from design brief 3.

function initialsFor(name) {
  if (!name) return '?'
  const clean = name.replace(/[_\-.]/g, ' ').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function ResultBlock({ kind }) {
  return <span className={`vs-block ${kind}`} />
}

// Pad an attempt array up to `max` with 'empty' blocks. Used for both
// reconstructed (challenger) and real (you) grids so they're always aligned.
function padBlocks(blocks, max = MAX_GUESSES) {
  const out = blocks.slice(0, max)
  while (out.length < max) out.push('empty')
  return out
}

// Reconstruct the challenger's per-attempt grid from (attempts, won) alone —
// the share payload doesn't carry per-guess detail.
function reconstructFoeGrid(attempts, won, max = MAX_GUESSES) {
  if (won) {
    const arr = []
    for (let i = 0; i < attempts - 1; i++) arr.push('wrong')
    arr.push('correct')
    return padBlocks(arr, max)
  }
  return Array.from({ length: max }, () => 'wrong')
}

// Map our guess types into the design's block kinds.
const TYPE_TO_KIND = {
  correct: 'correct',
  wrong: 'wrong',
  skipped: 'skipped',
}
function youGrid(guesses, max = MAX_GUESSES) {
  const arr = guesses.map(g => TYPE_TO_KIND[g.type] ?? 'wrong')
  return padBlocks(arr, max)
}

export default function VSCard({
  you,            // { name, attempts, won, guesses[] }
  challenge,      // { name, attempts, won, hintsUsed }
  gameLabel,      // e.g. "TWICEDLE · DAY #98" (already formatted)
  gameDate,       // ISO date — needed to mint a return challenge link
  hintsUsed = 0,
  onReplayArchive,
}) {
  const group = useGroup()
  const { user } = useAuth()
  const gameName = GAME_NAMES[group] ?? 'K-POPDLE'
  const [copied, setCopied] = useState(false)

  const verdict = useMemo(() => challengeVerdict(you, challenge), [you, challenge])
  const bothLost = !you.won && !challenge.won
  const outcome = bothLost ? 'both-lost' : verdict === 'tie' ? 'tie' : verdict === 'you' ? 'you-win' : 'they-win'

  const verdictCopy = {
    'you-win':   { headline: 'YOU WIN',     sub: challenge.won && you.won
                                                ? `By ${challenge.attempts - you.attempts} guesses · Pat yourself on the back.`
                                                : 'You solved it. They didn’t. Easy.' },
    'they-win':  { headline: 'THEY WIN',    sub: challenge.won && you.won
                                                ? `By ${you.attempts - challenge.attempts} guesses · Challenge back for revenge.`
                                                : 'They solved it. You didn’t. Challenge back.' },
    'tie':       { headline: 'IT’S A TIE',  sub: 'You both solved on the same try. Spooky.' },
    'both-lost': { headline: 'BOTH MISSED', sub: 'Nobody solved today. Better luck tomorrow.' },
  }[outcome]

  const youInitials = initialsFor(you.name || user?.displayName)
  const foeInitials = initialsFor(challenge.name)

  const youBlocks = useMemo(() => youGrid(you.guesses), [you.guesses])
  const foeBlocks = useMemo(() => reconstructFoeGrid(challenge.attempts, challenge.won), [challenge.attempts, challenge.won])

  async function handleChallengeBack() {
    const name = user?.displayName ?? ''
    const url = buildChallengeUrl({
      group,
      gameDate,
      name,
      attempts: you.attempts,
      won: you.won,
      hintsUsed,
    })
    const absolute = `${window.location.origin}${url}`
    const text = `${challengePreface(gameName, name)}\n${absolute}`
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    }
  }

  async function handleShare() {
    // Mirror ShareButton: copy a spoiler-free emoji grid summary.
    const grid = youBlocks
      .filter(b => b !== 'empty')
      .map(b => b === 'correct' ? '🟩' : b === 'skipped' ? '⬜' : '🟥')
      .join('')
    const summary = `${gameLabel}\nMe: ${you.won ? you.attempts : 'X'}/${MAX_GUESSES} · ${challenge.name || 'Friend'}: ${challenge.won ? challenge.attempts : 'X'}/${MAX_GUESSES}\n\n${grid}`
    await copyToClipboard(summary)
  }

  return (
    <div className={`cf cf-vs ${outcome}`}>
      <div className="cf-vs-head">
        <span className="vh-pill">
          {bothLost ? 'DOUBLE MISS' : verdict === 'tie' ? 'TIE GAME' : verdict === 'you' ? 'VICTORY' : 'DEFEAT'}
        </span>
        <span className="vh-game">{gameLabel}</span>
      </div>

      <div className="cf-vs-body">
        {/* YOU side */}
        <div className={`cf-side you ${outcome === 'you-win' ? 'win' : (verdict === 'tie' || bothLost) ? 'neutral' : 'lose'}`}>
          {outcome === 'you-win' && (
            <div className="side-crown" aria-label="Winner">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7z" />
              </svg>
            </div>
          )}
          <div className="side-avatar"><span>{youInitials}</span></div>
          <div className="side-tag">YOU</div>
          <div className="side-name">{you.name || user?.displayName || 'You'}</div>
          <div className="side-score">
            <span className="ss-num">{you.won ? you.attempts : 'X'}</span>
            <span className="ss-total">/{MAX_GUESSES}</span>
          </div>
          <div className="side-grid">
            {youBlocks.map((k, i) => <ResultBlock key={i} kind={k} />)}
          </div>
        </div>

        <div className="cf-vs-spine">
          <div className="spine-line" />
          <div className={`spine-pill ${verdict === 'tie' ? 'tie' : ''}`}>{verdict === 'tie' ? 'TIE' : 'VS'}</div>
          <div className="spine-line" />
        </div>

        {/* CHALLENGER side */}
        <div className={`cf-side foe ${outcome === 'they-win' ? 'win' : (verdict === 'tie' || bothLost) ? 'neutral' : 'lose'}`}>
          {outcome === 'they-win' && (
            <div className="side-crown" aria-label="Winner">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7z" />
              </svg>
            </div>
          )}
          <div className="side-avatar"><span>{foeInitials}</span></div>
          <div className="side-tag">CHALLENGER</div>
          <div className="side-name">{challenge.name || 'Challenger'}</div>
          <div className="side-score">
            <span className="ss-num">{challenge.won ? challenge.attempts : 'X'}</span>
            <span className="ss-total">/{MAX_GUESSES}</span>
          </div>
          <div className="side-grid">
            {foeBlocks.map((k, i) => <ResultBlock key={i} kind={k} />)}
          </div>
        </div>
      </div>

      <div className="cf-vs-verdict">
        <div className="vv-headline">{verdictCopy.headline}</div>
        <div className="vv-sub">{verdictCopy.sub}</div>
      </div>

      <div className={`cf-vs-actions ${copied ? 'copied' : ''}`}>
        {onReplayArchive ? (
          <button type="button" className="cf-btn-ghost" onClick={onReplayArchive}>REPLAY ARCHIVE</button>
        ) : (
          <span />
        )}
        <button type="button" className="cf-btn-primary" onClick={handleChallengeBack}>
          {copied ? (
            <>
              <span className="ok-tick">✓</span>
              LINK COPIED
            </>
          ) : (
            <>CHALLENGE BACK <span className="cs-icon">↺</span></>
          )}
        </button>
        <button type="button" className="cf-btn-share" aria-label="Share result" onClick={handleShare}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  )
}
