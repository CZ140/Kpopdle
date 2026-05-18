import { useMemo } from 'react'
import { loadArchiveGameState, loadGameState } from '../lib/storage'
import { useGroup } from '../lib/GroupContext'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getKSTToday() {
  const now = new Date()
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000) + now.getTimezoneOffset() * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

function getGameNumber(dateString, launchDate) {
  const launch = new Date(launchDate)
  const current = new Date(dateString)
  return Math.floor((current.getTime() - launch.getTime()) / 86400000) + 1
}

function formatDate(dateString) {
  const [, m, d] = dateString.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
}

export default function ArchiveModal({ launchDate, onSelect, onClose }) {
  const group = useGroup()
  const today = getKSTToday()

  const dates = useMemo(() => {
    if (!launchDate) return []
    const result = []
    const start = new Date(launchDate)
    const cur = new Date(today)
    cur.setDate(cur.getDate() - 1) // most recent past game = yesterday

    while (cur >= start) {
      result.push(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() - 1)
    }
    return result
  }, [launchDate, today])

  function getStatus(date) {
    const isToday = date === today
    const saved = isToday
      ? loadGameState(group, date)
      : loadArchiveGameState(group, date)
    if (!saved) return 'unplayed'
    if (saved.gameState === 'won') return 'won'
    if (saved.gameState === 'lost') return 'lost'
    return 'started'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel rounded-2xl w-full max-w-sm flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Archive</h2>
            <p className="text-xs text-white/40 mt-0.5">{dates.length} past {dates.length === 1 ? 'game' : 'games'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-3 py-3">
          {dates.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">No archive games yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {dates.map((date) => {
                const num = getGameNumber(date, launchDate)
                const status = getStatus(date)
                return (
                  <button
                    key={date}
                    onClick={() => onSelect(date)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all hover:bg-white/[0.06] group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-white/30 w-10 text-right">#{num}</span>
                      <div>
                        <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                          {formatDate(date)}
                        </span>
                        <span className="text-xs text-white/30 ml-2">{date.slice(0, 4)}</span>
                      </div>
                    </div>
                    <StatusPip status={status} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusPip({ status }) {
  if (status === 'won') {
    return (
      <span className="text-xs font-bold text-green-400 flex items-center gap-1">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Won
      </span>
    )
  }
  if (status === 'lost') {
    return <span className="text-xs font-bold text-white/25">Played</span>
  }
  if (status === 'started') {
    return <span className="text-xs font-bold text-twice-pink">In progress</span>
  }
  return (
    <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
