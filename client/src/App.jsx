import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import GroupPage from './pages/GroupPage'
import KpopdlePage from './pages/KpopdlePage'
import AccountPage from './pages/AccountPage'

// Admin dashboard is lazy-loaded so its charts never weigh down the game bundle.
const AdminPage = lazy(() => import('./pages/AdminPage'))
// Public stats page — lazy so it doesn't add to the game bundle.
const StatsPage = lazy(() => import('./pages/StatsPage'))
// Battle (real-time multiplayer) — lazy so socket.io-client stays out of the
// daily-game bundle for the majority of players who never open it.
const BattlePage = lazy(() => import('./pages/BattlePage'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/kpopdle" element={<KpopdlePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/stats" element={<Suspense fallback={null}><StatsPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
        {/* Single splat route so create→room is a re-render, not a remount
            (keeps the live socket listener attached across the transition). */}
        <Route path="/battle/*" element={<Suspense fallback={null}><BattlePage /></Suspense>} />
        <Route path="/:group" element={<GroupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
