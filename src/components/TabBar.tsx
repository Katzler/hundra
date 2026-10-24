import { ChartTabIcon, PersonTabIcon, RingTabIcon } from './icons'

export type Tab = 'idag' | 'trend' | 'profil'

const TABS: { id: Tab; label: string; Icon: typeof RingTabIcon }[] = [
  { id: 'idag', label: 'Idag', Icon: RingTabIcon },
  { id: 'trend', label: 'Trend', Icon: ChartTabIcon },
  { id: 'profil', label: 'Profil', Icon: PersonTabIcon },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Flikar">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`tab ${tab === id ? 'is-active' : ''}`}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => {
            if (tab === id) window.scrollTo({ top: 0, behavior: 'smooth' })
            onChange(id)
          }}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
