import { useState } from 'react'
import { Link } from 'react-router-dom'
import { copyToClipboard } from '../../lib/share'

export default function ResultScreen({ state, matchOver, myId, onRematch }) {
  const [copied, setCopied] = useState(false)
  if (!matchOver) return null

  const me = matchOver.scores.find((s) => s.playerId === myId)
  const opp = matchOver.scores.find((s) => s.playerId !== myId)
  const iWon = matchOver.winnerId === myId
  const winner = matchOver.scores.find((s) => s.playerId === matchOver.winnerId)
  const headline = matchOver.forfeit
    ? 'Opponent left — you win 🏆'
    : matchOver.draw
      ? "It's a draw"
      : iWon
        ? 'You win! 🏆'
        : `${winner?.displayName ?? 'Opponent'} wins`

  const iRequested = state?.players.find((p) => p.id === myId)?.wantsRematch
  const oppRequested = state?.players.find((p) => p.id !== myId)?.wantsRematch

  const share = async () => {
    const line = matchOver.draw
      ? `Draw ${me?.score}–${opp?.score}`
      : `${iWon ? 'Won' : 'Lost'} ${me?.score}–${opp?.score}`
    const text = `K-POPDLE Battle ⚔️\n${line}\n\nThink you can beat me? k-popdle.com/battle`
    if (await copyToClipboard(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-3xl font-black tracking-tight mb-6">{headline}</h1>

      {/* Final score */}
      <div className="flex items-center justify-center gap-6 mb-8">
        <ScoreBlock label={`${me?.displayName ?? 'You'} (you)`} score={me?.score ?? 0} highlight={iWon} />
        <span className="text-white/20 font-black">vs</span>
        <ScoreBlock label={opp?.displayName ?? 'Opponent'} score={opp?.score ?? 0} highlight={!iWon && !matchOver.draw} />
      </div>

      {/* Per-round breakdown */}
      <div className="flex flex-col gap-1.5 mb-8 text-left">
        {matchOver.rounds.map((r) => {
          const mine = r.results.find((x) => x.playerId === myId)
          const theirs = r.results.find((x) => x.playerId !== myId)
          return (
            <div key={r.roundIndex} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] text-sm">
              <span className="text-white/50 truncate mr-2">
                <span className="text-white/30">{r.roundIndex + 1}.</span> {r.answer.title}
              </span>
              <span className="tabular-nums whitespace-nowrap">
                <span className={mine?.points >= (theirs?.points ?? 0) ? 'font-bold text-[#EC4899]' : 'text-white/40'}>{mine?.points ?? 0}</span>
                <span className="text-white/20"> · </span>
                <span className={(theirs?.points ?? 0) > (mine?.points ?? 0) ? 'font-bold text-[#EC4899]' : 'text-white/40'}>{theirs?.points ?? 0}</span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      {oppRequested && !iRequested && (
        <p className="text-xs text-[#EC4899] font-bold mb-2">Your opponent wants a rematch!</p>
      )}
      <button
        onClick={onRematch}
        disabled={iRequested}
        className="w-full px-5 py-3.5 rounded-xl font-black bg-[#EC4899] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {iRequested ? 'Waiting for opponent…' : 'Rematch'}
      </button>
      <div className="flex gap-2 mt-2">
        <button onClick={share} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white transition-colors">
          {copied ? 'Copied!' : 'Share result'}
        </button>
        <Link to="/battle" className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white transition-colors text-center">
          New match
        </Link>
      </div>
    </div>
  )
}

function ScoreBlock({ label, score, highlight }) {
  return (
    <div className="text-center">
      <p className={`text-5xl font-black tabular-nums ${highlight ? 'text-[#EC4899]' : 'text-white/70'}`}>{score}</p>
      <p className="text-xs text-white/40 mt-1 max-w-[8rem] truncate">{label}</p>
    </div>
  )
}
