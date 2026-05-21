import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import { SoundProvider } from './lib/SoundContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SoundProvider>
        <App />
      </SoundProvider>
    </AuthProvider>
  </StrictMode>,
)
