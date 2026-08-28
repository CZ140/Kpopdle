import { useState } from 'react'
import { generateShareText, copyToClipboard } from '../lib/share'
import { useDifficulty, useGroup, useMaxGuesses, useGameName } from '../lib/GroupContext'
import { GAME_NAMES } from '../lib/constants'

export default function ShareButton({ gameNumber, guesses, won, hintsUsed = 0, gameName: gameNameOverride }) {
  const difficulty = useDifficulty()
  const group = useGroup()
  const maxGuesses = useMaxGuesses()
  // A per-mode name overrides the GAME_NAMES lookup: an explicit prop (e.g.
  // "COVERDLE") wins, else the GroupContext name (e.g. "Guess the Group").
  const contextGameName = useGameName()
  const gameName = gameNameOverride ?? contextGameName ?? GAME_NAMES[group] ?? 'K-POPDLE'
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const text = generateShareText(gameNumber, guesses, won, difficulty, hintsUsed, gameName, maxGuesses, window.location.pathname)
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
