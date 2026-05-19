import { useState, useRef, useEffect } from 'react'
import { useSongList } from '../hooks/useSongList'

export default function GuessInput({ onGuess, onSkip, disabled }) {
  const { songs } = useSongList()
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const filtered = query.length > 0
    ? songs.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => {
    setSelectedIndex(-1)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(song) {
    setQuery('')
    setShowDropdown(false)
    onGuess(song)
  }

  function handleKeyDown(e) {
    if (!showDropdown || filtered.length === 0) {
      if (e.key === 'Enter' && filtered.length === 1) {
        handleSelect(filtered[0])
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0) {
        handleSelect(filtered[selectedIndex])
      } else if (filtered.length === 1) {
        handleSelect(filtered[0])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => query.length > 0 && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Know it? Search for the song..."
            className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-white/25 input-glow disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-all duration-200"
          />

          {showDropdown && filtered.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden dropdown-glass max-h-72 overflow-y-auto"
            >
              {filtered.map((song, i) => (
                <button
                  key={song}
                  onClick={() => handleSelect(song)}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-all duration-150 ${
                    i === selectedIndex ? '' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                  }`}
                  style={i === selectedIndex ? {
                    background: 'linear-gradient(to right, color-mix(in srgb, var(--color-primary) 20%, transparent), color-mix(in srgb, var(--color-secondary) 10%, transparent))',
                    color: 'var(--color-primary)',
                  } : undefined}
                >
                  {song}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onSkip}
          disabled={disabled}
          className="h-12 px-5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white/40 hover:text-white/70 hover:bg-white/[0.1] hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-sm font-semibold"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
