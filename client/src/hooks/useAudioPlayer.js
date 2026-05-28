import { useState, useRef, useCallback, useEffect } from 'react'
import { SNIPPET_DURATIONS } from '../lib/constants'
import { getSavedVolume, saveVolume } from '../lib/volume'

export function useAudioPlayer(previewUrl, durations = SNIPPET_DURATIONS, isGameOver = false) {
  const audioRef = useRef(null)
  const animationFrameRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentGuess, setCurrentGuess] = useState(0)
  const [volume, setVolume] = useState(getSavedVolume)
  const [audioDuration, setAudioDuration] = useState(30)

  const hasAudio = Boolean(previewUrl)

  useEffect(() => {
    if (!previewUrl) return
    const audio = new Audio(previewUrl)
    audio.preload = 'auto'
    audio.volume = getSavedVolume()
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration))
      }
    })
    audioRef.current = audio

    return () => {
      audio.pause()
      audioRef.current = null
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [previewUrl])

  const changeVolume = useCallback((newVolume) => {
    const clamped = saveVolume(newVolume)
    setVolume(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
  }, [])

  const snippetDuration = durations[Math.min(currentGuess, durations.length - 1)]
  const currentDuration = isGameOver ? audioDuration : snippetDuration
  const maxDuration = isGameOver ? audioDuration : durations[durations.length - 1]

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio || isPlaying) return

    audio.currentTime = 0
    setIsPlaying(true)
    setProgress(0)

    const playPromise = audio.play()

    const startTime = Date.now()
    const dur = isGameOver ? (audio.duration || audioDuration) : snippetDuration

    let onEnded = null

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000
      setProgress(Math.min(elapsed / dur, 1))

      if (!isGameOver && elapsed >= dur) {
        audio.pause()
        setIsPlaying(false)
        setProgress(1)
      } else {
        animationFrameRef.current = requestAnimationFrame(tick)
      }
    }

    if (isGameOver) {
      onEnded = () => {
        cancelAnimationFrame(animationFrameRef.current)
        setIsPlaying(false)
        setProgress(1)
        audio.removeEventListener('ended', onEnded)
      }
      audio.addEventListener('ended', onEnded)
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    // AbortError is normal — thrown when play() is interrupted by pause() or unmount
    playPromise?.catch((err) => {
      if (err.name === 'AbortError') return
      cancelAnimationFrame(animationFrameRef.current)
      if (onEnded) audio.removeEventListener('ended', onEnded)
      setIsPlaying(false)
      setProgress(0)
    })
  }, [snippetDuration, isPlaying, isGameOver, audioDuration])

  const stop = useCallback(() => {
    if (audioRef.current) audioRef.current.pause()
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    setIsPlaying(false)
    setProgress(0)
  }, [])

  const setGuessNumber = useCallback((num) => {
    setCurrentGuess(num)
    setProgress(0)
  }, [])

  return { play, stop, isPlaying, progress, currentDuration, maxDuration, durations, setGuessNumber, volume, changeVolume, hasAudio }
}
