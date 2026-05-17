import { useState } from 'react'
import { generateShareText, copyToClipboard } from '../lib/share'

export default function ShareButton({ gameNumber, guesses, won }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const text = generateShareText(gameNumber, guesses, won)
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="px-8 py-3 rounded-xl bg-gradient-to-r from-twice-hot-pink to-twice-purple text-white font-bold text-sm glow-btn"
    >
      {copied ? 'Copied!' : 'Share Results'}
    </button>
  )
}
