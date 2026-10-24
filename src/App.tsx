import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { Toast } from './components/Toast'
import { Onboarding } from './screens/Onboarding'
import { Profile } from './screens/Profile'
import { Today } from './screens/Today'
import { Trend } from './screens/Trend'
import { useStore } from './store/useStore'

export function App() {
  const hasProfile = useStore((s) => s.profile !== null)
  const [tab, setTab] = useState<Tab>('idag')

  if (!hasProfile) return <Onboarding />

  return (
    <div className="app">
      {tab === 'idag' && <Today onOpenTrend={() => setTab('trend')} />}
      {tab === 'trend' && <Trend />}
      {tab === 'profil' && <Profile />}
      <TabBar
        tab={tab}
        onChange={(t) => {
          setTab(t)
          window.scrollTo({ top: 0 })
        }}
      />
      <Toast />
    </div>
  )
}
