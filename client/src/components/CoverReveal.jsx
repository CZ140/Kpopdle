import { useEffect, useRef, useState } from 'react'

// Progressive de-obfuscation via canvas MOSAIC/pixelation (FR-2, design "Coverdle").
// One stage per wrong/skipped guess: index = guesses made so far. Stage 0 is the
// chunkiest mosaic; each guess sharpens one step; the cover snaps fully crisp on
// win/loss. Mirrors the design's STAGE_RES ladder (image-equivalent of the audio
// game's lengthening snippet).
const STAGE_RES = [6, 12, 22, 40, 90, 480]
// Backing-store resolution the mosaic is upscaled into (CSS then scales to box).
const CANVAS_SIZE = 480

export default function CoverReveal({ coverUrl, currentGuessNumber = 0, isGameOver = false, won = false }) {
  const canvasRef = useRef(null)
  // Track the URL that failed so navigating to a new cover clears the error.
  const [failedUrl, setFailedUrl] = useState(null)
  const failed = failedUrl === coverUrl

  useEffect(() => {
    if (!coverUrl || failed) return
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_SIZE * dpr
    canvas.height = CANVAS_SIZE * dpr
    const ctx = canvas.getContext('2d')

    // Cross-origin (Deezer CDN) image: NOT setting crossOrigin keeps the load
    // working without CORS headers. The canvas becomes "tainted" — fine here
    // because we only draw for display and never read pixels back.
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (isGameOver) {
        // Win/loss: full crispness.
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        return
      }
      const res = STAGE_RES[Math.min(currentGuessNumber, STAGE_RES.length - 1)]
      // Downscale to `res` then upscale with smoothing off → hard mosaic blocks.
      const off = document.createElement('canvas')
      off.width = res
      off.height = res
      off.getContext('2d').drawImage(img, 0, 0, res, res)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(off, 0, 0, res, res, 0, 0, canvas.width, canvas.height)
    }
    img.onerror = () => setFailedUrl(coverUrl)
    img.src = coverUrl
  }, [coverUrl, currentGuessNumber, isGameOver, failed])

  return (
    <div className={`cv-cover-frame ${isGameOver && won ? 'won' : ''}`}>
      <div className="cover-halo" />
      <div className="cover-inset">
        {!coverUrl || failed ? (
          <div className="cover-unavailable">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.38)' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M3 21 L21 3" />
            </svg>
            <div className="cu-label">ALBUM COVER<br />UNAVAILABLE</div>
            <div className="cu-sub">Guess from audio only</div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="cover-canvas"
            role="img"
            aria-label={isGameOver ? 'Album cover' : 'Pixelated album cover — guess the song'}
          />
        )}
      </div>
      <span className="frame-corner tl" />
      <span className="frame-corner tr" />
      <span className="frame-corner bl" />
      <span className="frame-corner br" />
      {isGameOver && won && (
        <div className="win-shine"><div className="ws-burst" /></div>
      )}
    </div>
  )
}

// 6-segment "focus" reveal-progress indicator shown under the cover (FR-2 / design).
export function FocusIndicator({ currentGuessNumber = 0, isGameOver = false, total = 6 }) {
  const stage = isGameOver ? total : Math.min(currentGuessNumber + 1, total)
  const pct = Math.round((stage / total) * 100)
  return (
    <div className="focus-row">
      <span className="focus-label">FOCUS</span>
      <span className="focus-segs">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`focus-seg ${i < stage ? 'on' : ''} ${!isGameOver && i === stage - 1 ? 'live' : ''}`}
          />
        ))}
      </span>
      <span className="focus-pct">{pct}%</span>
    </div>
  )
}
