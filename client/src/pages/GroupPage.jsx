import { useParams, useNavigate } from 'react-router-dom'
import Game from '../components/Game'
import Header from '../components/Header'

const VALID_GROUPS = ['twice', 'newjeans', 'lesserafim', 'aespa', 'redvelvet', 'kissoflife', 'ive', 'blackpink']

export default function GroupPage() {
  const { group } = useParams()
  const navigate = useNavigate()

  if (!VALID_GROUPS.includes(group)) {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-twice-dark bg-orbs">
      <Header />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
        <Game />
      </main>
    </div>
  )
}
