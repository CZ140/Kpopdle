import Game from './components/Game'
import Header from './components/Header'

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-twice-dark bg-orbs">
      <Header />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
        <Game />
      </main>
    </div>
  )
}

export default App
