import GuessRow from './GuessRow'
import { useMaxGuesses } from '../lib/GroupContext'

export default function GuessList({ guesses }) {
  const maxGuesses = useMaxGuesses()
  const rows = Array.from({ length: maxGuesses }, (_, i) => guesses[i] || null)

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-2 mb-6">
      {rows.map((guess, i) => (
        <GuessRow key={i} guess={guess} index={i} />
      ))}
    </div>
  )
}
