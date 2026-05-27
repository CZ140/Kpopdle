import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import { SoundProvider } from './lib/SoundContext.jsx'
import { initSentry, ErrorBoundary } from './lib/observability'

initSentry()

const errorFallback = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d12', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '1rem', textAlign: 'center' }}>
    <div>
      <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Something went wrong.</p>
      <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Try refreshing the page.</p>
    </div>
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fallback={errorFallback}>
      <AuthProvider>
        <SoundProvider>
          <App />
        </SoundProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
