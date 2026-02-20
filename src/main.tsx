import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'
import ReactGA from 'react-ga4'
import './index.css'
import App from './App.tsx'

inject()
injectSpeedInsights()
ReactGA.initialize('G-FF0L8VCCGF') // Replace G-XXXXXXXXXX with your GA4 Measurement ID

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
