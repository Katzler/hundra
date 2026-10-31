import { useEffect, useMemo, useState } from 'react'
import { formatPoints, toPoints } from '../lib/calc'
import { searchFoods } from '../lib/search'
import { haptic, useUI } from '../store/ui'
import {
  allFoods,
  FAVORITE_GROUPS,
  FAVORITE_LIMIT,
  itemsOf,
  MEAL_PREFIX,
  mealKcal,
  quickFoods,
  useStore,
  type FavoriteGroup,
} from '../store/useStore'
import { FoodIcon } from './FoodIcon'
import { CheckIcon, SearchIcon, XIcon } from './icons'
import { Segmented } from './Segmented'
import { Sheet } from './Sheet'

type Props = { group: FavoriteGroup | null; onClose: () => void; budgetKcal: number }

/** Välj själv vilka varor och måltider som ligger i varje favoritkategori på Idag. */
export function FavoritesSheet({ group, onClose, budgetKcal }: Props) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<FavoriteGroup>('frukost')
  const custom = useStore((s) => s.customFoods)
  const usage = useStore((s) => s.usage)
  const groups = useStore((s) => s.favoriteGroups)
  const meals = useStore((s) => s.meals)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const showToast = useUI((s) => s.showToast)
  const foods = useMemo(() => allFoods(custom), [custom])
  const open = group !== null

  useEffect(() => {
    if (!group) return
    setQuery('')
    setTab(group)
  }, [group])

  const picks = groups[tab]
  const tabName = FAVORITE_GROUPS.find((g) => g.id === tab)!.name
  // Både varor och sparade måltider kan ligga bland favoriterna.
  const picked = itemsOf(foods, picks, meals).map((q) =>
    q.kind === 'food'
      ? { id: q.food.id, name: q.food.name, icon: q.food.id, emoji: q.food.emoji }
      : { id: MEAL_PREFIX + q.meal.id, name: q.meal.name, icon: 'maltid-egen', emoji: '🍱' },
  )

  const suggestions = useMemo(() => quickFoods(foods, usage, null, 24), [foods, usage])
  const results = useMemo(() => searchFoods(foods, query, usage).slice(0, 40), [foods, query, usage])
  const list = query.trim() ? results : suggestions

  const toggle = (id: string) => {
    if (!picks.includes(id) && picks.length >= FAVORITE_LIMIT) {
      showToast(`${tabName} är full. Ta bort en favorit först.`)
      return
    }
    haptic()
    toggleFavorite(tab, id)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Ändra favoriter"
      title="Favoriter"
      right={
        <button type="button" className="bar-btn bar-btn-strong" onClick={onClose}>
          Klar
        </button>
      }
    >
      <Segmented label="Kategori" options={FAVORITE_GROUPS.map((g) => ({ value: g.id, label: g.name }))} value={tab} onChange={setTab} />

      <div className="picks-preview">
        {picked.length > 0 ? (
          <div className="chips chips-wrap">
            {picked.map((f) => (
              <button key={f.id} type="button" className="chip chip-editing" onClick={() => toggle(f.id)} aria-label={`Ta bort ${f.name}`}>
                <span className="chip-emoji" aria-hidden>
                  <FoodIcon id={f.icon} emoji={f.emoji} size={26} />
                </span>
                <span className="chip-name">{f.name}</span>
                <span className="chip-remove" aria-hidden>
                  <XIcon size={9} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-text">Inga favoriter i {tabName.toLowerCase()} än. Välj några nedan.</p>
        )}
        <p className="hint-text">
          Tryck på en favorit för att ta bort den. Samma vara kan ligga i flera kategorier. {picks.length} av {FAVORITE_LIMIT}.
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

      {!query.trim() && meals.length > 0 && (
        <>
          <h3 className="section-title">Mina måltider</h3>
          <div className="group">
            {meals.map((m) => {
              const on = picks.includes(MEAL_PREFIX + m.id)
              return (
                <button key={m.id} type="button" className="row nav-row" onClick={() => toggle(MEAL_PREFIX + m.id)} aria-pressed={on}>
                  <span className="emoji" aria-hidden>
                    <FoodIcon id="maltid-egen" emoji="🍱" />
                  </span>
                  <span className="row-text">
                    <span className="row-title">
                      <span className="row-name">{m.name}</span>
                    </span>
                    <span className="row-sub">
                      {m.items.length} varor · {formatPoints(toPoints(mealKcal(m), budgetKcal))} p
                    </span>
                  </span>
                  <span className={`check ${on ? 'is-on' : ''}`} aria-hidden>
                    {on && <CheckIcon />}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
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
                  <span className="row-title">
                    <span className="row-name">{f.name}</span>
                  </span>
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
    </Sheet>
  )
}
