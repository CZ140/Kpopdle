import { useState } from 'react'
import { Link } from 'react-router-dom'
import { copyToClipboard } from '../../lib/share'
import { nameInitials } from '../../lib/initials'

export default function ResultScreen({ state, matchOver, myId, onRematch }) {
  const [copied, setCopied] = useState(false)
  if (!matchOver) return null

  const me = matchOver.scores.find((s) => s.playerId === myId)
  const opp = matchOver.scores.find((s) => s.playerId !== myId)
  const iWon = matchOver.winnerId === myId
  const draw = matchOver.draw
  const forfeit = matchOver.forfeit
  const variant = forfeit ? 'forfeit' : draw ? 'draw' : iWon ? 'win' : 'lose'

  const headline = forfeit
    ? 'YOU WIN BY FORFEIT'
    : draw
      ? "IT'S A DRAW"
      : iWon
        ? 'VICTORY'
        : 'DEFEAT'
  const sub = forfeit
    ? 'Opponent left the match'
    : draw
      ? 'Evenly matched.'
      : iWon
        ? <>You won <b>{me?.score}</b>–{opp?.score}.</>
        : <>{opp?.displayName ?? 'Opponent'} won <b>{opp?.score}</b>–{me?.score}.</>

  const iRequested = state?.players.find((p) => p.id === myId)?.wantsRematch
  const oppRequested = state?.players.find((p) => p.id !== myId)?.wantsRematch

  const share = async () => {
    const line = draw
      ? `Draw ${me?.score}–${opp?.score}`
      : `${iWon ? 'Won' : 'Lost'} ${me?.score}–${opp?.score}`
    const text = `K-POPDLE Battle ⚔️\n${line}\n\nThink you can beat me? k-popdle.com/battle`
    if (await copyToClipboard(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className={`btl-final ${variant}`}>
      <h1 className="btl-final-verdict">{headline}</h1>
      <p className="btl-final-sub">{sub}</p>

      <div className="btl-final-score">
        <FinalSide side="you" name={me?.displayName ?? 'You'} score={me?.score ?? 0} lost={!iWon && !draw && !forfeit} />
        <span className="btl-vs-plate">VS</span>
        <FinalSide side="foe" name={opp?.displayName ?? 'Opponent'} score={opp?.score ?? 0} lost={iWon || forfeit} disconnected={forfeit} />
      </div>

      {matchOver.rounds?.length > 0 && (
        <div className="btl-bd">
          <div className="btl-bd-row head">
            <span>#</span>
            <span>SONG</span>
            <span>YOU</span>
            <span className="btl-bd-vs">vs</span>
            <span>OPP</span>
          </div>
          {matchOver.rounds.map((r) => {
            const mine = r.results.find((x) => x.playerId === myId)
            const theirs = r.results.find((x) => x.playerId !== myId)
            const myPts = mine?.points ?? 0
            const theirPts = theirs?.points ?? 0
            const youWon = myPts > theirPts
            const theyWon = theirPts > myPts
            const isSudden = r.roundIndex >= (state?.totalRounds ?? 5)
            return (
              <div key={r.roundIndex} className={`btl-bd-row ${isSudden ? 'sudden' : ''}`}>
                <span className="btl-bd-no">{isSudden ? 'SD' : String(r.roundIndex + 1).padStart(2, '0')}</span>
                <span className="btl-bd-ans">{r.answer.title}</span>
                <span className={`btl-bd-pts ${youWon ? 'you-win' : myPts === 0 ? 'zero' : ''}`}>{myPts}</span>
                <span className="btl-bd-vs">vs</span>
                <span className={`btl-bd-pts ${theyWon ? 'foe-win' : theirPts === 0 ? 'zero' : ''}`}>{theirPts}</span>
              </div>
            )
          })}
        </div>
      )}

      {oppRequested && !iRequested && (
        <p className="text-center text-[11px] font-mono uppercase tracking-[0.18em] mb-2 animate-pulse" style={{ color: '#EC4899' }}>
          ⚔ Opponent wants a rematch
        </p>
      )}
      <button onClick={onRematch} disabled={iRequested} className="btl-cta">
        {iRequested ? 'WAITING FOR OPPONENT…' : 'REMATCH →'}
      </button>
      <div className="btl-cta-row">
        <button onClick={share} className="btl-cta ghost">{copied ? '✓ Copied!' : 'Share result'}</button>
        <Link to="/battle" className="btl-cta ghost" style={{ textDecoration: 'none' }}>New match</Link>
      </div>
    </div>
  )
}

function FinalSide({ side, name, score, lost, disconnected }) {
  const label = side === 'you' ? '▸ YOU' : 'OPPONENT ◂'
  return (
    <div className={`btl-final-side ${side} ${lost ? 'lost' : ''}`}>
      <span className="btl-mono lg" style={{ '--c': side === 'you' ? 'var(--btl-you)' : 'var(--btl-foe)' }}>
        {nameInitials(name)}
        {disconnected && <span className="btl-presence off" />}
      </span>
      <span className="ftag">{label}</span>
      <span className="fname">{name}</span>
      <span className="fpts tabular-nums">{score}</span>
    </div>
  )
}
