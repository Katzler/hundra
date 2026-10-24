import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { loadIcons } from './lib/foodIcons'
import './styles/tokens.css'
import './styles/global.css'

// Be webbläsaren att inte rensa vår data när utrymmet börjar ta slut.
navigator.storage?.persist?.().catch(() => {})
loadIcons()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
