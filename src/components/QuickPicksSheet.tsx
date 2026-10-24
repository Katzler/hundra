import { useEffect, useMemo, useState } from 'react'
import { formatPoints, toPoints } from '../lib/calc'
import { searchFoods } from '../lib/search'
import { haptic } from '../store/ui'
import { allFoods, quickFoods, useStore } from '../store/useStore'
import { FoodIcon } from './FoodIcon'
import { CheckIcon, SearchIcon, XIcon } from './icons'
import { Sheet } from './Sheet'

type Props = { open: boolean; onClose: () => void; budgetKcal: number }

/** Välj själv vilka varor som ligger bland snabbvalen på Idag. */
export function QuickPicksSheet({ open, onClose, budgetKcal }: Props) {
  const [query, setQuery] = useState('')
  const custom = useStore((s) => s.customFoods)
  const usage = useStore((s) => s.usage)
  const quickPicks = useStore((s) => s.quickPicks)
  const setQuickPicks = useStore((s) => s.setQuickPicks)
  const foods = useMemo(() => allFoods(custom), [custom])

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  // Så länge man inte valt något eget utgår vi från de automatiska snabbvalen, låsta när arket öppnas.
  const autoIds = useMemo(
    () => (open ? quickFoods(allFoods(useStore.getState().customFoods), useStore.getState().usage, null).map((f) => f.id) : []),
    [open],
  )

  const picks = quickPicks ?? autoIds
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const picked = picks.map((id) => byId.get(id)).filter((f) => !!f)

  const suggestions = useMemo(() => quickFoods(foods, usage, null, 24), [foods, usage])
  const results = useMemo(() => searchFoods(foods, query, usage).slice(0, 40), [foods, query, usage])
  const list = query.trim() ? results : suggestions

  const toggle = (id: string) => {
    haptic()
    setQuickPicks(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id])
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Ändra snabbval"
      title="Snabbval"
      right={
        <button type="button" className="bar-btn bar-btn-strong" onClick={onClose}>
          Klar
        </button>
      }
    >
      <div className="picks-preview">
        {picked.length > 0 ? (
          <div className="chips chips-wrap">
            {picked.map((f) => (
              <button key={f.id} type="button" className="chip chip-editing" onClick={() => toggle(f.id)} aria-label={`Ta bort ${f.name}`}>
                <span className="chip-emoji" aria-hidden>
                  <FoodIcon id={f.id} emoji={f.emoji} size={26} />
                </span>
                <span className="chip-name">{f.name}</span>
                <span className="chip-remove" aria-hidden>
                  <XIcon size={9} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-text">Inga snabbval än. Välj några nedan.</p>
        )}
        <p className="hint-text">
          {quickPicks ? 'Tryck på ett snabbval för att ta bort det.' : 'Just nu väljs snabbvalen automatiskt efter det du äter mest.'}
        </p>
      </div>

      <div className="search">
        <SearchIcon className="search-icon" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök vara att lägga till"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Sök vara"
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Rensa">
            <XIcon size={10} />
          </button>
        )}
      </div>

      {!query.trim() && <h3 className="section-title">Förslag</h3>}
      {list.length > 0 ? (
        <div className="group">
          {list.map((f) => {
            const on = picks.includes(f.id)
            return (
              <button key={f.id} type="button" className="row nav-row" onClick={() => toggle(f.id)} aria-pressed={on}>
                <span className="emoji" aria-hidden>
                  <FoodIcon id={f.id} emoji={f.emoji} />
                </span>
                <span className="row-text">
                  <span className="row-title">{f.name}</span>
                  <span className="row-sub">
                    {f.unit} · {formatPoints(toPoints(f.kcal, budgetKcal))} p
                  </span>
                </span>
                <span className={`check ${on ? 'is-on' : ''}`} aria-hidden>
                  {on && <CheckIcon />}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="empty-text">Hittade inget som heter ”{query.trim()}”.</p>
      )}

      {quickPicks && (
        <button type="button" className="link-btn reset-picks" onClick={() => setQuickPicks(null)}>
          Återställ till automatiskt
        </button>
      )}
    </Sheet>
  )
}
