import { useState, useEffect } from 'react'

function getTimeUntilMidnightKST() {
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset + now.getTimezoneOffset() * 60 * 1000)

  const kstMidnight = new Date(kstNow)
  kstMidnight.setHours(24, 0, 0, 0)

  return kstMidnight.getTime() - kstNow.getTime()
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
