import { createContext, useContext, useState, useCallback, useRef } from 'react'

const SoundContext = createContext(null)

const MUTE_KEY = 'kpopdle-sounds-muted'

let _audioCtx = null
function getAudioCtx() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {})
    return _audioCtx
  } catch {
    return null
  }
}

function tone(ctx, freq, startTime, duration, volume = 0.1, oscType = 'sine', freqEnd = null) {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = oscType
    osc.frequency.setValueAtTime(freq, startTime)
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration)
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
    osc.start(startTime)
    osc.stop(startTime + duration + 0.01)
  } catch {}
}

function synthesize(type) {
  const ctx = getAudioCtx()
  if (!ctx) return
  const t = ctx.currentTime
  switch (type) {
    case 'click':
      tone(ctx, 700, t, 0.04, 0.07, 'sine', 350)
      break
    case 'correct':
      tone(ctx, 523.25, t, 0.18, 0.12, 'sine')
      tone(ctx, 659.25, t + 0.1, 0.2, 0.12, 'sine')
      break
    case 'wrong':
      tone(ctx, 240, t, 0.18, 0.07, 'sawtooth', 160)
      break
    case 'skip':
      tone(ctx, 420, t, 0.09, 0.07, 'sine')
      break
    case 'win':
      tone(ctx, 523.25, t, 0.15, 0.13, 'sine')
      tone(ctx, 659.25, t + 0.1, 0.15, 0.13, 'sine')
      tone(ctx, 783.99, t + 0.2, 0.15, 0.13, 'sine')
      tone(ctx, 1046.5, t + 0.3, 0.35, 0.15, 'sine')
      break
    case 'loss':
      tone(ctx, 440, t, 0.22, 0.1, 'sine')
      tone(ctx, 370.99, t + 0.16, 0.22, 0.1, 'sine')
      tone(ctx, 329.63, t + 0.32, 0.35, 0.1, 'sine')
      break
    case 'navigate':
      tone(ctx, 550, t, 0.05, 0.06, 'sine', 750)
      break
    case 'modal':
      tone(ctx, 380, t, 0.09, 0.06, 'sine', 650)
      break
  }
}

export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === 'true' } catch { return false }
  })
  const mutedRef = useRef(muted)

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    try { localStorage.setItem(MUTE_KEY, String(next)) } catch {}
  }, [])

  const playSound = useCallback((type) => {
    if (mutedRef.current) return
    try { synthesize(type) } catch {}
  }, [])

  return (
    <SoundContext.Provider value={{ playSound, muted, toggleMuted }}>
      {children}
    </SoundContext.Provider>
  )
}

export const useSound = () => useContext(SoundContext)
