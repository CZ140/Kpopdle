import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GroupContext } from '../lib/GroupContext'
import { migrateStorageIfNeeded } from '../lib/storage'
import Game from '../components/Game'
import Header from '../components/Header'
import ArchiveModal from '../components/ArchiveModal'

const VALID_GROUPS = ['twice', 'newjeans', 'lesserafim', 'aespa', 'redvelvet', 'kissoflife', 'ive', 'blackpink']

const GROUP_LAUNCH_DATES = {
  twice:      '2026-02-20',
  newjeans:   '2026-05-18',
  lesserafim: '2026-05-18',
  aespa:      '2026-05-18',
  redvelvet:  '2026-05-18',
  kissoflife: '2026-05-18',
  ive:        '2026-05-18',
  blackpink:  '2026-05-18',
}

export default function GroupPage() {
  const { group } = useParams()
  const navigate = useNavigate()

  const [archiveDate, setArchiveDate] = useState(null)
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    if (group === 'twice') migrateStorageIfNeeded()
  }, [group])

  // Reset archive mode when switching groups
  useEffect(() => {
    setArchiveDate(null)
    setShowArchive(false)
  }, [group])

  if (!VALID_GROUPS.includes(group)) {
    navigate('/')
    return null
  }

  const launchDate = GROUP_LAUNCH_DATES[group]

  return (
    <GroupContext.Provider value={{ id: group, archiveDate }}>
      <div className="min-h-screen flex flex-col bg-twice-dark bg-orbs">
        <Header onOpenArchive={() => setShowArchive(true)} />
        <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
          {/* key causes Game to fully remount when switching between archive dates */}
          <Game key={archiveDate ?? 'today'} />
        </main>
      </div>

      {showArchive && (
        <ArchiveModal
          launchDate={launchDate}
          onSelect={(date) => {
            setArchiveDate(date)
            setShowArchive(false)
          }}
          onClose={() => setShowArchive(false)}
        />
      )}
    </GroupContext.Provider>
  )
}
