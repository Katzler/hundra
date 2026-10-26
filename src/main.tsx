import { markLoaded } from './lib/startup'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/tokens.css'
import './styles/global.css'

markLoaded()

// Be webbläsaren att inte rensa vår data när utrymmet börjar ta slut.
navigator.storage?.persist?.().catch(() => {})

// Nya versioner tas i bruk först när man lämnar appen, aldrig när den startar, medan den används
// eller medan ett ark är öppet. Tidigare laddades appen om direkt om den nyss hade öppnats, men på
// iPhone gav det två starter i rad och lång svart skärm morgonen efter en publicering. När appen
// hämtas fram ur bakgrunden letar iOS sällan efter uppdateringar själv, så då frågar vi.
let updateReady = false
let reloadReady = false
let registration: ServiceWorkerRegistration | undefined

// Inte medan ett ark (t.ex. ett halvifyllt formulär) är öppet – då väntar vi till nästa gång.
const hiddenAndIdle = () => document.visibilityState === 'hidden' && !document.body.dataset.sheetOpen

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady = true
    if (hiddenAndIdle()) updateSW()
  },
  // Den nya versionen har tagit över. Syns appen just nu väntar omladdningen tills man lämnar den.
  // När iOS väcker en frusen app kan meddelandet komma innan sidan hunnit bli synlig, så vi
  // kontrollerar igen en stund senare. Har sidan varit frusen under tiden väntar vi till nästa gång.
  onNeedReload() {
    reloadReady = true
    const at = Date.now()
    setTimeout(() => {
      if (Date.now() - at < 5000 && hiddenAndIdle()) window.location.reload()
    }, 300)
  },
  onRegisteredSW(_url, reg) {
    registration = reg
  },
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    registration?.update().catch(() => {})
  } else if (hiddenAndIdle()) {
    if (reloadReady) window.location.reload()
    else if (updateReady) updateSW()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
