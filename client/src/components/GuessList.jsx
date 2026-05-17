import { MAX_GUESSES } from '../lib/constants'
import GuessRow from './GuessRow'

export default function GuessList({ guesses }) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => guesses[i] || null)

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-2 mb-6">
      {rows.map((guess, i) => (
        <GuessRow key={i} guess={guess} index={i} />
      ))}
    </div>
  )
}
