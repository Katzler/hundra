import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { Toast } from './components/Toast'
import { WhatsNewSheet } from './components/WhatsNewSheet'
import { hasSeenNews, markNewsSeen } from './lib/news'
import { markFirstFrame } from './lib/startup'
import { Onboarding } from './screens/Onboarding'
import { Profile } from './screens/Profile'
import { Today } from './screens/Today'
import { Trend } from './screens/Trend'
import { useStore } from './store/useStore'

export function App() {
  const hasProfile = useStore((s) => s.profile !== null)
  const [tab, setTab] = useState<Tab>('idag')
  // Nyheterna gäller bara den som redan använde appen. Den som börjar nu ser dem aldrig.
  const [newsDue] = useState(() => hasProfile && !hasSeenNews())
  const [newsOpen, setNewsOpen] = useState(false)

  useEffect(() => {
    requestAnimationFrame(markFirstFrame)
  }, [])

  useEffect(() => {
    if (!hasProfile) return
    if (!newsDue) {
      markNewsSeen()
      return
    }
    // En liten stund efter starten, så att man hinner se appen först.
    const t = setTimeout(() => setNewsOpen(true), 600)
    return () => clearTimeout(t)
  }, [hasProfile, newsDue])

  const closeNews = useCallback(() => {
    setNewsOpen(false)
    markNewsSeen()
  }, [])

  if (!hasProfile) return <Onboarding />

  return (
    <div className="app">
      {tab === 'idag' && <Today />}
      {tab === 'trend' && <Trend />}
      {tab === 'profil' && <Profile />}
      <TabBar
        tab={tab}
        onChange={(t) => {
          setTab(t)
          window.scrollTo({ top: 0 })
        }}
      />
      <WhatsNewSheet open={newsOpen} onClose={closeNews} />
      <Toast />
    </div>
  )
}
