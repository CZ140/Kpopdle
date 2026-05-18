import ShareButton from './ShareButton'
import Countdown from './Countdown'

export default function ResultModal({ gameState, revealedSong, guesses, gameNumber, isArchive = false, onClose }) {
  const won = gameState === 'won'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4" onClick={onClose}>
      <div
        className="modal-panel rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {isArchive && (
          <div className="text-center mb-3">
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-twice-pink/70 bg-twice-pink/10 px-3 py-1 rounded-full">
              Archive #{gameNumber}
            </span>
          </div>
        )}

        <div className="text-center mb-6">
          {won ? (
            <>
              <div className="text-4xl mb-2">*</div>
              <h2 className="text-2xl font-black text-gradient mb-1">You got it!</h2>
              <p className="text-sm text-white/40">
                Guessed in {guesses.length} {guesses.length === 1 ? 'try' : 'tries'}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black text-white/80 mb-1">Better luck next time!</h2>
              <p className="text-sm text-white/40">The answer was:</p>
            </>
          )}
        </div>

        {revealedSong && (
          <div className="glass-card rounded-xl p-5 mb-6 text-center">
            <p className="text-xl font-black text-white mb-1">{revealedSong.title}</p>
            <p className="text-sm text-white/40 font-medium">{revealedSong.album} ({revealedSong.releaseYear})</p>
            {revealedSong.spotifyId && (
              <a
                href={`https://open.spotify.com/track/${revealedSong.spotifyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-twice-pink hover:text-twice-peach transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Listen on Spotify
              </a>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-5">
          {isArchive ? (
            <p className="text-xs text-white/25 font-mono uppercase tracking-widest">Archive · Results not saved to stats</p>
          ) : (
            <>
              <ShareButton gameNumber={gameNumber} guesses={guesses} won={won} />
              <Countdown />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
