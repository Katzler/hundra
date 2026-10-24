import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles/tokens.css'
import './styles/global.css'

// Be webbläsaren att inte rensa vår data när utrymmet börjar ta slut.
navigator.storage?.persist?.().catch(() => {})

// Laddar om automatiskt när en ny version har installerats. En app på hemskärmen i iOS
// letar sällan efter uppdateringar själv, så vi frågar varje gång den öppnas igen.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {})
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
