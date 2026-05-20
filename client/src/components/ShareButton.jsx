import { useState } from 'react'
import { generateShareText, copyToClipboard } from '../lib/share'
import { useDifficulty, useGroup } from '../lib/GroupContext'
import { GAME_NAMES } from '../lib/constants'

export default function ShareButton({ gameNumber, guesses, won, hintsUsed = 0 }) {
  const difficulty = useDifficulty()
  const group = useGroup()
  const gameName = GAME_NAMES[group] ?? 'K-POPDLE'
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const text = generateShareText(gameNumber, guesses, won, difficulty, hintsUsed, gameName)
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="px-8 py-3 rounded-xl text-white font-bold text-sm glow-btn"
      style={{ background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }}
    >
      {copied ? 'Copied!' : 'Share Results'}
    </button>
  )
}
