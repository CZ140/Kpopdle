import { useCountdown } from '../hooks/useCountdown'

export default function Countdown() {
  const timeLeft = useCountdown()

  return (
    <div className="text-center">
      <p className="text-[10px] text-white/25 uppercase tracking-[0.2em] font-medium mb-1">Next Twicedle in</p>
      <p className="text-2xl font-black text-white/90 font-mono tracking-wider">{timeLeft}</p>
    </div>
  )
}
