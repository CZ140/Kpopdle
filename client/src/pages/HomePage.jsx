import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import GroupCard from '../components/GroupCard'
import { loadGameState, loadStats } from '../lib/storage'

// Groups data — replace body of this with fetchGroups() once backend is ready
const GROUPS = [
  {
    id: 'twice', index: 1,
    displayName: 'TWICE', gameName: 'TWICEDLE',
    tagline: 'Daily TWICE Song Quiz',
    members: 9, active: true,
    colors: { primary: '#FF2D78', secondary: '#A855F7' },
    launchDate: '2026-02-20',
  },
  {
    id: 'newjeans', index: 2,
    displayName: 'NewJeans', gameName: 'NEWJEANDLE',
    tagline: 'Daily NewJeans Song Quiz',
    members: 5, active: false,
    colors: { primary: '#06B6D4', secondary: '#6366F1' },
    launchDate: null,
  },
  {
    id: 'lesserafim', index: 3,
    displayName: 'LE SSERAFIM', gameName: 'SERAFIDLE',
    tagline: 'Daily LE SSERAFIM Song Quiz',
    members: 5, active: false,
    colors: { primary: '#F43F5E', secondary: '#F59E0B' },
    launchDate: null,
  },
  {
    id: 'aespa', index: 4,
    displayName: 'aespa', gameName: 'AESPADLE',
    tagline: 'Daily aespa Song Quiz',
    members: 4, active: false,
    colors: { primary: '#10B981', secondary: '#06B6D4' },
    launchDate: null,
  },
  {
    id: 'redvelvet', index: 5,
    displayName: 'Red Velvet', gameName: 'VELVETLE',
    tagline: 'Daily Red Velvet Song Quiz',
    members: 5, active: false,
    colors: { primary: '#EF4444', secondary: '#FB7185' },
    launchDate: null,
  },
  {
    id: 'kissoflife', index: 6,
    displayName: 'KISS OF LIFE', gameName: 'KOLFDLE',
    tagline: 'Daily KISS OF LIFE Song Quiz',
    members: 4, active: false,
    colors: { primary: '#F97316', secondary: '#EAB308' },
    launchDate: null,
  },
  {
    id: 'ive', index: 7,
    displayName: 'IVE', gameName: 'IVEDLE',
    tagline: 'Daily IVE Song Quiz',
    members: 6, active: false,
    colors: { primary: '#3B82F6', secondary: '#F59E0B' },
    launchDate: null,
  },
  {
    id: 'blackpink', index: 8,
    displayName: 'BLACKPINK', gameName: 'BPINKDLE',
    tagline: 'Daily BLACKPINK Song Quiz',
    members: 4, active: false,
    colors: { primary: '#1a1a2e', secondary: '#EC4899' },
    launchDate: null,
  },
]

const TWICE_LAUNCH = new Date('2026-02-20')

function getDayNumber() {
  return Math.floor((Date.now() - TWICE_LAUNCH.getTime()) / 86400000) + 1
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

  const today = new Date().toISOString().slice(0, 10)
  const stats = loadStats()
  const twiceState = loadGameState(today)
  const twiceDone = twiceState && twiceState.gameState !== 'playing'
  const twiceGuesses = twiceState?.guesses?.length ?? 0
  const solvedCount = twiceDone ? 1 : 0

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
          <div className="flex items-center gap-7">
            <div
              className="px-3 py-1.5 rounded-full border border-white/[0.14] text-white/62 text-[12px]"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
            >
              🔥 Streak <b className="text-[#FF2D78] font-bold">{stats.currentStreak}</b>
            </div>
            <div>{formatTopbarDate()}</div>
          </div>
        </div>

        {/* Hero */}
        <header className="text-center mb-[72px]">
          {/* Eyebrow pill */}
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
            Daily song · 8 groups · resets at midnight KST
          </div>

          {/* Logo */}
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

          {/* Tagline */}
          <p className="text-white/62 m-0 mb-2 font-normal" style={{ fontSize: 'clamp(16px, 1.6vw, 20px)' }}>
            <b className="text-white font-medium">Daily K-pop Song Quiz</b>
            <span className="text-white/38 mx-3">·</span>
            Listen, guess, repeat.
          </p>

          {/* Countdown */}
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

        {/* Section heading */}
        <div className="flex items-end justify-between mb-7 px-1">
          <h2 className="text-[22px] font-bold tracking-tight m-0">Pick your group</h2>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/38">
            <b className="text-white/62 font-medium">{GROUPS.filter(g => g.active).length}</b> games ·{' '}
            <b className="text-white/62 font-medium">{solvedCount}</b> solved today
          </div>
        </div>

        {/* Card grid */}
        <div className="kp-card-grid">
          {GROUPS.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              isSolved={group.id === 'twice' && twiceDone}
              guessCount={group.id === 'twice' ? twiceGuesses : 0}
            />
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-white/[0.08] flex justify-between items-center flex-wrap gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-white/38">
          <div className="flex items-center gap-2.5">
            A new song every day at midnight KST <span className="kp-heart">♥</span>
          </div>
          <div>
            Made by <span className="text-white/62 border-b border-white/[0.08]">@you</span>
            {' · '}
            <button
              onClick={() => navigate('/twice')}
              className="text-white/62 border-b border-white/[0.08] hover:text-[#FF2D78] transition-colors bg-transparent cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em]"
            >
              How to play
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}
