import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@mg/tokens/build/tokens.css'
import '@mg/ui/dist/index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
