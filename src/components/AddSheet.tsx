import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { CATEGORIES, type CategoryId, type Food } from '../data/foods'
import { budgetFor, dayKcal, formatPoints, toPoints } from '../lib/calc'
import { dayTitle, todayKey, type DateKey } from '../lib/dates'
import { searchFoods } from '../lib/search'
import { haptic, useUI } from '../store/ui'
import { allFoods, recentFoods, useStore } from '../store/useStore'
import { CustomFoodForm } from './CustomFoodForm'
import { FoodRow } from './FoodRow'
import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon, XIcon } from './icons'
import { Sheet } from './Sheet'

type View = { kind: 'home' } | { kind: 'category'; id: CategoryId } | { kind: 'create' }

type Props = {
  open: boolean
  date: DateKey
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

export function AddSheet({ open, date, onClose, inputRef }: Props) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>({ kind: 'home' })
  const custom = useStore((s) => s.customFoods)
  const usage = useStore((s) => s.usage)
  const favorites = useStore((s) => s.favorites)
  const entries = useStore((s) => s.entries)
  const history = useStore((s) => s.budgetHistory)
  const addFood = useStore((s) => s.addFood)
  const setQty = useStore((s) => s.setQty)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const addCustomFood = useStore((s) => s.addCustomFood)
  const showToast = useUI((s) => s.showToast)
  const bodyRef = useRef<HTMLDivElement>(null)
  const startKcal = useRef(0)

  const foods = useMemo(() => allFoods(custom), [custom])
  const budget = budgetFor(date, history)
  const dayEntries = useMemo(() => entries.filter((e) => e.date === date), [entries, date])
  const qtyOf = (id: string) => dayEntries.find((e) => e.foodId === id)?.qty ?? 0

  useEffect(() => {
    if (!open) return
    startKcal.current = dayKcal(useStore.getState().entries, date)
    setQuery('')
    setView({ kind: 'home' })
  }, [open, date])

  useEffect(() => {
    bodyRef.current?.closest('.sheet-body')?.scrollTo({ top: 0 })
  }, [query, view])

  const sessionPoints = toPoints(dayKcal(entries, date) - startKcal.current, budget)
  const results = useMemo(() => searchFoods(foods, query, usage).slice(0, 60), [foods, query, usage])
  const recent = useMemo(
    () => recentFoods(foods, usage, 8 + favorites.length).filter((f) => !favorites.includes(f.id)).slice(0, 8),
    [foods, usage, favorites],
  )
  const favoriteFoods = useMemo(
    () => favorites.map((id) => foods.find((f) => f.id === id)).filter(Boolean) as Food[],
    [favorites, foods],
  )

  const add = (food: Food) => addFood(food, date)

  const row = (food: Food) => (
    <FoodRow
      key={food.id}
      food={food}
      points={toPoints(food.kcal, budget)}
      qty={qtyOf(food.id)}
      favorite={favorites.includes(food.id)}
      onAdd={() => add(food)}
      onQty={(q) => {
        const e = dayEntries.find((x) => x.foodId === food.id)
        if (e) setQty(e.id, q)
      }}
      onLongPress={() => {
        const was = favorites.includes(food.id)
        toggleFavorite(food.id)
        showToast(was ? `${food.name} borttagen från favoriter` : `${food.name} sparad som favorit`)
      }}
    />
  )

  const trimmed = query.trim()
  const searching = trimmed.length > 0 && view.kind !== 'create'
  const category = view.kind === 'category' ? CATEGORIES.find((c) => c.id === view.id) : undefined
  const categoryFoods = view.kind === 'category' ? foods.filter((f) => f.category === view.id) : []

  const back =
    view.kind !== 'home' ? (
      <button type="button" className="bar-btn bar-btn-back" onClick={() => setView({ kind: 'home' })}>
        <ChevronLeft size={18} />
        Tillbaka
      </button>
    ) : null

  const title = view.kind === 'create' ? 'Ny vara' : category ? category.name : date === todayKey() ? 'Lägg till' : `Lägg till · ${dayTitle(date)}`

  return (
    <Sheet
      open={open}
      onClose={onClose}
      keepMounted
      label="Lägg till mat"
      title={title}
      left={back}
      right={
        <button type="button" className="bar-btn bar-btn-strong" onClick={onClose}>
          Klar
        </button>
      }
      footer={
        Math.abs(sessionPoints) >= 0.5 && view.kind !== 'create' ? (
          <div className="sheet-footer">
            <button type="button" className="primary-btn" onClick={onClose}>
              Klar · {sessionPoints > 0 ? '+' : '−'}
              {formatPoints(Math.abs(sessionPoints))} p
            </button>
          </div>
        ) : null
      }
    >
      <div ref={bodyRef}>
        <div className={`search ${view.kind === 'create' ? 'is-hidden' : ''}`}>
          <SearchIcon className="search-icon" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                e.preventDefault()
                haptic()
                add(results[0])
                showToast(`${results[0].emoji} ${results[0].name} +1`)
                setQuery('')
              }
            }}
            placeholder="Sök mat, t.ex. potatis"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="Sök mat"
            tabIndex={open ? 0 : -1}
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Rensa">
              <XIcon size={10} />
            </button>
          )}
        </div>

        {view.kind === 'create' ? (
          <CustomFoodForm
            budgetKcal={budget}
            initial={{ name: trimmed }}
            submitLabel="Spara och lägg till"
            onSubmit={(f) => {
              const food = addCustomFood(f)
              add(food)
              showToast(`${food.emoji} ${food.name} sparad och tillagd`)
              setQuery('')
              setView({ kind: 'home' })
            }}
          />
        ) : searching ? (
          <>
            {results.length > 0 && <div className="group">{results.map(row)}</div>}
            {results.length === 0 && <p className="empty-text">Hittade inget som heter ”{trimmed}”.</p>}
            <div className="group">
              <button type="button" className="row create-row" onClick={() => setView({ kind: 'create' })}>
                <span className="emoji emoji-tint" aria-hidden>
                  <PlusIcon size={18} />
                </span>
                <span className="row-text">
                  <span className="row-title">Skapa ”{trimmed}”</span>
                  <span className="row-sub">Egen vara med egna poäng</span>
                </span>
                <ChevronRight size={16} className="row-chevron" />
              </button>
            </div>
          </>
        ) : view.kind === 'category' ? (
          categoryFoods.length > 0 ? (
            <div className="group">{categoryFoods.map(row)}</div>
          ) : (
            <p className="empty-text">Inga egna varor än. Sök efter något och välj ”Skapa”.</p>
          )
        ) : (
          <>
            {favoriteFoods.length > 0 ? (
              <>
                <h3 className="section-title">Favoriter</h3>
                <div className="group">{favoriteFoods.map(row)}</div>
              </>
            ) : null}
            {recent.length > 0 && (
              <>
                <h3 className="section-title">Senaste</h3>
                <div className="group">{recent.map(row)}</div>
              </>
            )}
            <h3 className="section-title">Kategorier</h3>
            <div className="category-grid">
              {CATEGORIES.filter((c) => c.id !== 'egna' || custom.length > 0).map((c) => (
                <button key={c.id} type="button" className="category" onClick={() => setView({ kind: 'category', id: c.id })}>
                  <span className="category-emoji" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="category-name">{c.name}</span>
                </button>
              ))}
            </div>
            {favoriteFoods.length === 0 && <p className="hint-text">Tips: håll inne på en vara för att spara den som favorit.</p>}
          </>
        )}
      </div>
    </Sheet>
  )
}
