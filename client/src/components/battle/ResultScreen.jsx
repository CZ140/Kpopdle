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

  // Compact, semantic headline. The big gradient wordmark below is the visual
  // anchor; this eyebrow communicates what happened in JetBrains-Mono voice.
  const eyebrow = matchOver.forfeit
    ? 'Match abandoned'
    : matchOver.draw
      ? 'Draw'
      : iWon
        ? 'Victory'
        : 'Defeat'
  const headline = matchOver.forfeit
    ? 'You win 🏆'
    : matchOver.draw
      ? "It's a draw"
      : iWon
        ? 'You win 🏆'
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
    <div>
      <div className="text-center mb-8">
        <div className="btl-eyebrow mb-5 mx-auto"><span className="pip-l" />{eyebrow}<span className="pip-r" /></div>
        <h1 className="btl-winner-headline">{headline}</h1>
        {matchOver.forfeit && (
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-white/40 mt-3">
            Opponent left the match
          </p>
        )}
      </div>

      {/* Final score — dual you-pink / foe-cyan */}
      <div className="btl-arena rounded-2xl p-6 mb-6">
        <div className="btl-score-row">
          <div className="text-left min-w-0">
            <div className={`btl-score-num you tabular-nums ${iWon || matchOver.draw ? '' : 'opacity-60'}`}>{me?.score ?? 0}</div>
            <div className="btl-score-lbl truncate">{me?.displayName ?? 'You'} · YOU</div>
          </div>
          <div className="btl-vs-pill">VS</div>
          <div className="text-right min-w-0">
            <div className={`btl-score-num foe tabular-nums ${!iWon && !matchOver.draw ? '' : 'opacity-60'}`}>{opp?.score ?? 0}</div>
            <div className="btl-score-lbl truncate">{opp?.displayName ?? 'Opponent'}</div>
          </div>
        </div>
      </div>

      {/* Per-round breakdown */}
      {matchOver.rounds?.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40 mb-2 px-1">Rounds</p>
          <div className="flex flex-col gap-1.5">
            {matchOver.rounds.map((r) => {
              const mine = r.results.find((x) => x.playerId === myId)
              const theirs = r.results.find((x) => x.playerId !== myId)
              const myPts = mine?.points ?? 0
              const theirPts = theirs?.points ?? 0
              const youWonRound = myPts > theirPts
              const theyWonRound = theirPts > myPts
              return (
                <div key={r.roundIndex} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-sm text-white/70 truncate mr-2">
                    <span className="text-[10px] font-mono text-white/30 mr-2">{String(r.roundIndex + 1).padStart(2, '0')}</span>
                    {r.answer.title}
                  </span>
                  <span className="tabular-nums whitespace-nowrap text-sm font-bold">
                    <span className={youWonRound ? 'text-[#FF2D78]' : 'text-white/40'}>{myPts}</span>
                    <span className="text-white/20 mx-1.5">·</span>
                    <span className={theyWonRound ? 'text-[#06B6D4]' : 'text-white/40'}>{theirPts}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {oppRequested && !iRequested && (
        <p className="text-center text-[11px] font-mono uppercase tracking-[0.14em] text-[#FF2D78] mb-2 animate-pulse">
          ⚔ Opponent wants a rematch
        </p>
      )}
      <button
        onClick={onRematch}
        disabled={iRequested}
        className="btl-btn-primary w-full px-5 py-4 rounded-xl font-black tracking-wide"
      >
        {iRequested ? 'WAITING FOR OPPONENT…' : 'REMATCH →'}
      </button>
      <div className="flex gap-2 mt-2">
        <button onClick={share} className="btl-btn-ghost flex-1 px-4 py-3 rounded-xl font-bold text-sm">
          {copied ? 'Copied!' : 'Share result'}
        </button>
        <Link to="/battle" className="btl-btn-ghost flex-1 px-4 py-3 rounded-xl font-bold text-sm text-center">
          New match
        </Link>
      </div>
    </div>
  )
}
