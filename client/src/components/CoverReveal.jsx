import { useState } from 'react'

// Progressive de-obfuscation curve (FR-2, GD-1/GD-3): one stage per wrong/skipped
// guess. Index = number of guesses made so far. Stage 0 (no guesses) is fully
// blurred; the cover sharpens with each guess and is fully clear once solved/lost.
// Six stages map 1:1 to the six guesses (MAX_GUESSES).
const BLUR_STAGES = [32, 20, 12, 6, 2, 0]

export default function CoverReveal({ coverUrl, currentGuessNumber = 0, isGameOver = false }) {
  // Track the specific URL that failed to load, so navigating to a new cover
  // (e.g. archive day) clears the error without a setState-in-effect.
  const [failedUrl, setFailedUrl] = useState(null)
  const failed = failedUrl === coverUrl

  // Fully clear on win/loss; otherwise pick the stage for the current guess count.
  const blur = isGameOver
    ? 0
    : BLUR_STAGES[Math.min(currentGuessNumber, BLUR_STAGES.length - 1)]

  if (!coverUrl || failed) {
    // Graceful placeholder, mirroring AudioPlayer's "preview unavailable" (FR-9).
    return (
      <div className="w-full max-w-md mx-auto mb-8 flex items-center justify-center aspect-square rounded-2xl bg-white/[0.04] border border-white/[0.06]">
        <p className="text-sm text-white/30 font-medium">Album cover unavailable</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/[0.04]">
        <img
          src={coverUrl}
          alt={isGameOver ? 'Album cover' : 'Blurred album cover — guess the song'}
          onError={() => setFailedUrl(coverUrl)}
          draggable={false}
          className="w-full h-full object-cover select-none transition-[filter] duration-500 ease-out"
          style={{
            // Slight scale hides the soft transparent edges that `blur()` creates.
            filter: `blur(${blur}px)`,
            transform: blur > 0 ? 'scale(1.06)' : 'scale(1)',
          }}
        />
      </div>
    </div>
  )
}
