import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OverlayWidget from './OverlayWidget'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayWidget />
  </StrictMode>,
)
