import { useState, useRef, useCallback, useEffect } from 'react'
import { SNIPPET_DURATIONS } from '../lib/constants'

const VOLUME_KEY = 'kpopdle-volume'

function getSavedVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY))
    return isNaN(v) ? 0.8 : Math.min(1, Math.max(0, v))
  } catch {
    return 0.8
  }
}

export function useAudioPlayer(previewUrl, durations = SNIPPET_DURATIONS) {
  const audioRef = useRef(null)
  const animationFrameRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentGuess, setCurrentGuess] = useState(0)
  const [volume, setVolume] = useState(getSavedVolume)

  const currentDuration = durations[Math.min(currentGuess, durations.length - 1)]

  useEffect(() => {
    if (previewUrl) {
      audioRef.current = new Audio(previewUrl)
      audioRef.current.preload = 'auto'
      audioRef.current.volume = getSavedVolume()

      return () => {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [previewUrl])

  const changeVolume = useCallback((newVolume) => {
    const clamped = Math.min(1, Math.max(0, newVolume))
    setVolume(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
    try { localStorage.setItem(VOLUME_KEY, String(clamped)) } catch {}
  }, [])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio || isPlaying) return

    audio.currentTime = 0
    setIsPlaying(true)
    setProgress(0)
    audio.play()

    const startTime = Date.now()
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000
      const pct = Math.min(elapsed / currentDuration, 1)
      setProgress(pct)

      if (elapsed >= currentDuration) {
        audio.pause()
        setIsPlaying(false)
        setProgress(1)
      } else {
        animationFrameRef.current = requestAnimationFrame(tick)
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick)
  }, [currentDuration, isPlaying])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setIsPlaying(false)
    setProgress(0)
  }, [])

  const setGuessNumber = useCallback((num) => {
    setCurrentGuess(num)
    setProgress(0)
  }, [])

  return { play, stop, isPlaying, progress, currentDuration, setGuessNumber, volume, changeVolume }
}
