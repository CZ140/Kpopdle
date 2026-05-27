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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/kpopdle" element={<KpopdlePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/stats" element={<Suspense fallback={null}><StatsPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
        <Route path="/:group" element={<GroupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
