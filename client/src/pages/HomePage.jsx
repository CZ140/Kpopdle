import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import GroupCard from '../components/GroupCard'
import { fetchGroups } from '../lib/api'
import { loadGameState, loadStats } from '../lib/storage'
import { useAuth } from '../lib/AuthContext'
import { getKSTDateString } from '../lib/dateUtils'
import HowToPlayModal from '../components/HowToPlayModal'

const PLATFORM_LAUNCH = new Date('2026-02-20')

function getDayNumber() {
  return Math.floor((Date.now() - PLATFORM_LAUNCH.getTime()) / 86400000) + 1
}

function formatTopbarDate() {
  return new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase().replace(',', ' ·')
}

function useKSTCountdown() {
  function compute() {
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(now.getTime() + kstOffset + now.getTimezoneOffset() * 60 * 1000)
    const kstMidnight = new Date(kstNow)
    kstMidnight.setHours(24, 0, 0, 0)
    const diff = Math.max(0, kstMidnight.getTime() - kstNow.getTime())
    return {
      h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
      m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    }
  }
  const [parts, setParts] = useState(compute)
  useEffect(() => {
    const id = setInterval(() => setParts(compute()), 1000)
    return () => clearInterval(id)
  }, [])
  return parts
}

export default function HomePage() {
  const countdown = useKSTCountdown()
  const navigate = useNavigate()
  const { user, login, logout } = useAuth()

  const [groups, setGroups] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load(attempts = 0) {
      try {
        const data = await fetchGroups()
        if (!cancelled) setGroups(data.map((g, i) => ({ ...g, index: i + 1 })))
      } catch {
        if (!cancelled && attempts < 4) {
          setTimeout(() => load(attempts + 1), 1500)
          return
        }
        if (!cancelled) setGroups([])
      } finally {
        if (!cancelled) setLoadingGroups(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const today = getKSTDateString()

  // Best current streak across all loaded groups
  const bestStreak = groups.reduce((max, g) => Math.max(max, loadStats(g.id).currentStreak), 0)

  // Check solved state for each active group from localStorage
  function getSolvedState(groupId) {
    const state = loadGameState(groupId, today)
    if (!state || state.gameState === 'playing') return { isSolved: false, isWon: false, guessCount: 0, revealedSong: null }
    return {
      isSolved: true,
      isWon: state.gameState === 'won',
      guessCount: state.guesses?.length ?? 0,
      revealedSong: state.revealedSong ?? null,
    }
  }

  const solvedCount = groups.filter((g) => {
    const s = loadGameState(g.id, today)
    return s && s.gameState !== 'playing'
  }).length

  return (
    <>
      {/* Ambient backdrop */}
      <div className="kp-backdrop">
        <div className="kp-grid-noise" />
        <div className="kp-orb" style={{ width: 520, height: 520, background: 'radial-gradient(circle, #FF2D78 0%, transparent 65%)', top: -120, left: -120, opacity: 0.55, animationDelay: '0s' }} />
        <div className="kp-orb" style={{ width: 600, height: 600, background: 'radial-gradient(circle, #A855F7 0%, transparent 65%)', top: '10%', right: -180, opacity: 0.55, animationDelay: '-7s' }} />
        <div className="kp-orb" style={{ width: 480, height: 480, background: 'radial-gradient(circle, #06B6D4 0%, transparent 65%)', bottom: -120, left: '20%', opacity: 0.55, animationDelay: '-14s' }} />
        <div className="kp-orb" style={{ width: 380, height: 380, background: 'radial-gradient(circle, #6366F1 0%, transparent 65%)', top: '50%', left: '45%', opacity: 0.4, animationDelay: '-18s' }} />
        <div className="kp-orb" style={{ width: 340, height: 340, background: 'radial-gradient(circle, #F59E0B 0%, transparent 65%)', bottom: '5%', right: '8%', opacity: 0.35, animationDelay: '-11s' }} />
      </div>

      {/* Page content */}
      <div className="relative z-[1] max-w-[1320px] mx-auto px-8 pt-10 pb-20">

        {/* Top strip */}
        <div className="flex items-center justify-between mb-20 font-mono text-[12px] text-white/38 uppercase tracking-[0.08em]">
          <div className="flex items-center gap-2">
            <span className="kp-live-dot" />
            LIVE · DAY {getDayNumber()}
          </div>
          <div className="flex items-center gap-4">
            <div
              className="px-3 py-1.5 rounded-full border border-white/[0.14] text-white/62 text-[12px]"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
            >
              🔥 Streak <b className="text-[#FF2D78] font-bold">{bestStreak}</b>
            </div>
            <div>{formatTopbarDate()}</div>
            {user ? (
              <button
                onClick={logout}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-white/[0.14] text-white/62 text-[12px] hover:border-white/30 transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
                title={`Signed in as ${user.email} — click to sign out`}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">
                    {user.displayName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
                <span>{user.displayName}</span>
              </button>
            ) : user === null ? (
              <button
                onClick={login}
                className="px-3 py-1.5 rounded-full border border-white/[0.14] text-white/62 text-[12px] hover:border-white/30 hover:text-white/80 transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
              >
                Sign in
              </button>
            ) : null}
          </div>
        </div>

        {/* Hero */}
        <header className="text-center mb-[72px]">
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.14] font-mono text-[11px] tracking-[0.14em] uppercase text-white/62 mb-8"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #FF2D78, #A855F7)',
                boxShadow: '0 0 10px rgba(255,45,120,0.8)',
              }}
            />
            Daily song · {groups.length} groups · resets at midnight KST
          </div>

          <h1
            className="font-black leading-[0.92] tracking-[-0.04em] m-0 mb-6"
            style={{
              fontSize: 'clamp(64px, 11vw, 156px)',
              background: 'linear-gradient(135deg, #FF2D78 0%, #EC4899 30%, #A855F7 70%, #6366F1 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 40px rgba(168,85,247,0.35))',
            }}
          >
            K-POPDLE
          </h1>

          <p className="text-white/62 m-0 mb-2 font-normal" style={{ fontSize: 'clamp(16px, 1.6vw, 20px)' }}>
            <b className="text-white font-medium">Daily K-pop Song Quiz</b>
            <span className="text-white/38 mx-3">·</span>
            Listen, guess, repeat.
          </p>

          <div
            className="mt-9 inline-flex items-center gap-4 px-[22px] py-[14px] rounded-2xl border border-white/[0.14] font-mono"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px) saturate(160%)' }}
          >
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/38">Next drop in</span>
            <span className="text-[18px] font-semibold text-white tracking-[0.02em]">
              {countdown.h}<span className="text-white/38 font-normal mx-0.5">h</span>{' '}
              {countdown.m}<span className="text-white/38 font-normal mx-0.5">m</span>{' '}
              {countdown.s}<span className="text-white/38 font-normal mx-0.5">s</span>
            </span>
          </div>
        </header>

        {/* K-POPDLE cross-group challenge banner */}
        <div
          className="relative rounded-2xl overflow-hidden mb-10 cursor-pointer group"
          onClick={() => navigate('/kpopdle')}
          style={{ background: 'linear-gradient(135deg, #FF2D78 0%, #A855F7 35%, #6366F1 65%, #06B6D4 100%)' }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-[1] flex items-center justify-between px-8 py-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 mb-1">Daily Cross-Group Challenge</div>
              <h2 className="text-4xl font-black tracking-tight text-white leading-none mb-2">K-POPDLE</h2>
              <p className="text-sm text-white/80 font-medium">Any song. Any group. One daily shot.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
                {groups.length} groups · {groups.reduce((n, g) => n + (g.members || 0), 0)}+ songs
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0d0d14] text-sm font-black tracking-wide group-hover:scale-105 transition-transform">
                PLAY →
              </button>
            </div>
          </div>
        </div>

        {/* Section heading */}
        <div className="flex items-end justify-between mb-7 px-1">
          <h2 className="text-[22px] font-bold tracking-tight m-0">Pick your group</h2>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/38">
            <b className="text-white/62 font-medium">{groups.length}</b> games ·{' '}
            <b className="text-white/62 font-medium">{solvedCount}</b> solved today
          </div>
        </div>

        {/* Card grid */}
        {loadingGroups ? (
          <div className="text-center text-white/30 font-mono text-sm py-20">Loading…</div>
        ) : (
          <div className="kp-card-grid">
            {groups.map((group) => {
              const { isSolved, isWon, guessCount, revealedSong } = getSolvedState(group.id)
              return (
                <GroupCard
                  key={group.id}
                  group={group}
                  isSolved={isSolved}
                  isWon={isWon}
                  guessCount={guessCount}
                  revealedSong={revealedSong}
                />
              )
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-white/[0.08] flex justify-between items-center flex-wrap gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-white/38">
          <div className="flex items-center gap-2.5">
            A new song every day at midnight KST <span className="kp-heart">♥</span>
          </div>
          <div>
            Made by <a href="https://github.com/CZ140" target="_blank" rel="noopener noreferrer" className="text-white/62 border-b border-white/[0.08] hover:text-white/90 transition-colors">@CZ140</a>
            {' · '}
            <button
              onClick={() => setShowHowToPlay(true)}
              className="text-white/62 border-b border-white/[0.08] hover:text-[#FF2D78] transition-colors bg-transparent cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em]"
            >
              How to play
            </button>
          </div>
        </footer>
      </div>

      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
    </>
  )
}
