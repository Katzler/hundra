import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles/tokens.css'
import './styles/global.css'

// Be webbläsaren att inte rensa vår data när utrymmet börjar ta slut.
navigator.storage?.persist?.().catch(() => {})

// Nya versioner tas i bruk utan att störa: direkt om appen nyss öppnades, annars när man
// lämnar den, så att den aldrig laddar om mitt i användningen. En app på hemskärmen i iOS
// letar sällan efter uppdateringar själv, så vi frågar varje gång den öppnas igen.
const JUST_OPENED_MS = 3000
let shownAt = Date.now()
let updateReady = false

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady = true
    if (document.visibilityState === 'hidden' || Date.now() - shownAt < JUST_OPENED_MS) updateSW(true)
  },
  onRegisteredSW(_url, registration) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (updateReady) updateSW(true)
      } else {
        shownAt = Date.now()
        registration?.update().catch(() => {})
      }
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
