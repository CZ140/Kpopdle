import { useState, useEffect } from 'react'

function getTimeUntilMidnightKST() {
  const kstMs = Date.now() + 9 * 3600000
  const msIntoDayKST = kstMs % 86400000
  return 86400000 - msIntoDayKST
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function useCountdown() {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnightKST())

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeUntilMidnightKST()
      setTimeLeft(remaining)

      if (remaining <= 0) {
        window.location.reload()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return formatTime(timeLeft)
}
