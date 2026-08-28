import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@mg/tokens/build/tokens.css'
import '@mg/ui/dist/index.css'
import App from './App.tsx'
import { installChunkErrorHandler } from './lib/handleChunkError'

// Recarrega a aba uma única vez se um chunk lazy sumiu por causa de um deploy
// novo do frontend (ver handleChunkError.ts). No-op no fluxo normal.
installChunkErrorHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
