import { useState } from 'react'
import { buildChallengeUrl, challengePreface, copyToClipboard } from '../lib/share'
import { useGroup } from '../lib/GroupContext'
import { useAuth } from '../lib/AuthContext'
import { GAME_NAMES } from '../lib/constants'

// "Challenge a friend" (and the symmetric "Challenge back"): copies a stateless
// link that drops a friend onto the same group + date and encodes this player's
// result for a head-to-head compare. No answer is in the link.
export default function ChallengeButton({ gameDate, guesses, won, hintsUsed = 0, label = 'Challenge a friend' }) {
  const group = useGroup()
  const { user } = useAuth()
  const gameName = GAME_NAMES[group] ?? 'K-POPDLE'
  const [copied, setCopied] = useState(false)

  async function handleChallenge() {
    const name = user?.displayName ?? ''
    const url = buildChallengeUrl({
      group,
      gameDate,
      name,
      attempts: guesses.length,
      won,
      hintsUsed,
    })
    const absolute = `${window.location.origin}${url}`
    const text = `${challengePreface(gameName, name)}\n${absolute}`
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleChallenge}
      className="px-8 py-3 rounded-xl text-white font-bold text-sm glow-btn"
      style={{ background: 'linear-gradient(to right, var(--color-secondary), var(--color-primary))' }}
    >
      {copied ? 'Link copied!' : label}
    </button>
  )
}
