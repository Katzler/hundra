import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { choiceSummary, hasChoices as choicesFor, preferred } from '../data/choices'
import type { Food } from '../data/foods'
import { budgetFor, dayKcal, formatPoints, formatQty, toPoints } from '../lib/calc'
import { dayTitle, todayKey, type DateKey } from '../lib/dates'
import { parseQuantity, searchFoods } from '../lib/search'
import { useUI } from '../store/ui'
import { allFoods, isFavorite, itemOf, MEAL_PREFIX, mealKcal, recentFoods, sameItem, useStore, type Meal } from '../store/useStore'
import { ChoiceSheet } from './ChoiceSheet'
import { CustomFoodForm } from './CustomFoodForm'
import { FavoritePicker } from './FavoritePicker'
import { FoodIcon } from './FoodIcon'
import { FoodRow } from './FoodRow'
import { ChevronLeft, ChevronRight, PlusIcon, SearchIcon, XIcon } from './icons'
import { Sheet } from './Sheet'

type View = { kind: 'home' } | { kind: 'create' }

type Props = {
  open: boolean
  date: DateKey
  /** Text som skrevs i fältet på Idag innan arkets sökfält fick fokus. */
  typed: string
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

export function AddSheet({ open, date, typed, onClose, inputRef }: Props) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>({ kind: 'home' })
  const custom = useStore((s) => s.customFoods)
  const usage = useStore((s) => s.usage)
  const favoriteGroups = useStore((s) => s.favoriteGroups)
  const meals = useStore((s) => s.meals)
  const lastChoices = useStore((s) => s.lastChoices)
  const entries = useStore((s) => s.entries)
  const history = useStore((s) => s.budgetHistory)
  const addFood = useStore((s) => s.addFood)
  const logMeal = useStore((s) => s.logMeal)
  const setDayEntries = useStore((s) => s.setDayEntries)
  const setQty = useStore((s) => s.setQty)
  const addCustomFood = useStore((s) => s.addCustomFood)
  const showToast = useUI((s) => s.showToast)
  const bodyRef = useRef<HTMLDivElement>(null)
  const startKcal = useRef(0)
  const [choosing, setChoosing] = useState<Food | null>(null)
  const [favoriting, setFavoriting] = useState<Food | null>(null)

  const foods = useMemo(() => allFoods(custom), [custom])
  const budget = budgetFor(date, history)
  const dayEntries = useMemo(() => entries.filter((e) => e.date === date), [entries, date])
  const isPicked = (id: string) => isFavorite(favoriteGroups, id)
  const dayNote = date === todayKey() ? '' : ` · ${dayTitle(date)}`

  useEffect(() => {
    if (typed) setQuery(typed)
  }, [typed])

  useEffect(() => {
    if (open) {
      startKcal.current = dayKcal(useStore.getState().entries, date)
      return
    }
    // Nollställ när arket stängs, så att sökfältet syns och kan få fokus direkt nästa gång.
    setQuery('')
    setView({ kind: 'home' })
    setChoosing(null)
    setFavoriting(null)
  }, [open, date])

  useEffect(() => {
    bodyRef.current?.closest('.sheet-body')?.scrollTo({ top: 0 })
  }, [query, view])

  // "3 potatis" söker på potatis och lägger till 3 åt gången.
  const { qty, rest } = parseQuantity(query)
  const sessionPoints = toPoints(dayKcal(entries, date) - startKcal.current, budget)
  const results = useMemo(() => searchFoods(foods, rest, usage).slice(0, 60), [foods, rest, usage])
  // Ordningen låses när arket öppnas, så att raderna inte byter plats medan man trycker.
  const recent = useMemo(
    () => (open ? recentFoods(foods, useStore.getState().usage, 8) : []),
    [open, foods],
  )
  const month = new Date().getMonth() + 1
  const seasonal = useMemo(() => foods.filter((f) => f.months?.includes(month)), [foods, month])

  const add = (food: Food, n = qty) => addFood(food, date, n)

  const logMealWithUndo = (meal: Meal) => {
    const before = useStore.getState().entries.filter((e) => e.date === date)
    logMeal(meal.id, date)
    showToast(`${meal.name} tillagd${dayNote}`, { label: 'Ångra', run: () => setDayEntries(date, before) })
  }

  const row = (food: Food) => {
    // Raden visar och lägger till senaste valet, t.ex. stor stekt kycklingfilé.
    const hasChoices = choicesFor(food)
    const pref = preferred(food, lastChoices[food.id])
    const item = itemOf(pref.food, pref.qty)
    const entry = dayEntries.find((e) => sameItem(e, item))
    return (
    <FoodRow
      key={food.id}
      food={food}
      points={toPoints(pref.food.kcal * pref.qty, budget)}
      sub={hasChoices ? choiceSummary(food, pref.picks, pref.qty) : undefined}
      qty={entry?.qty ?? 0}
      picked={isPicked(food.id)}
      onAdd={() => add(pref.food, qty !== 1 ? qty : pref.qty)}
      onOpen={hasChoices ? () => setChoosing(food) : undefined}
      onQty={(q) => {
        if (entry) setQty(entry.id, q)
      }}
      onLongPress={() => setFavoriting(food)}
    />
    )
  }

  const mealRow = (meal: Meal) => (
    <div key={meal.id} className="row food-row">
      <button type="button" className="row-main" onClick={() => logMealWithUndo(meal)}>
        <span className="emoji" aria-hidden>
          <FoodIcon id="maltid-egen" emoji="🍱" />
        </span>
        <span className="row-text">
          <span className="row-title">
            <span className="row-name">{meal.name}</span>
            {isPicked(MEAL_PREFIX + meal.id) && <span className="row-badge">favorit</span>}
          </span>
          <span className="row-sub">{meal.items.map((i) => `${formatQty(i.qty)} ${i.name.toLowerCase()}`).join(', ')}</span>
        </span>
        <span className="row-points">{formatPoints(toPoints(mealKcal(meal), budget))} p</span>
      </button>
      <button type="button" className="add-btn" aria-label={`Lägg till ${meal.name}`} onClick={() => logMealWithUndo(meal)}>
        <PlusIcon size={18} />
      </button>
    </div>
  )

  const trimmed = rest.trim()
  const searching = query.trim().length > 0 && view.kind === 'home'
  const matchingMeals = searching ? meals.filter((m) => m.name.toLowerCase().includes(trimmed.toLowerCase())) : []

  const back =
    view.kind !== 'home' ? (
      <button type="button" className="bar-btn bar-btn-back" onClick={() => setView({ kind: 'home' })}>
        <ChevronLeft size={18} />
        Tillbaka
      </button>
    ) : null

  const title =
    view.kind === 'create'
      ? 'Ny vara'
      : date === todayKey()
        ? 'Lägg till'
        : `Lägg till · ${dayTitle(date)}`

  const formView = view.kind === 'create'

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
        Math.abs(sessionPoints) >= 0.5 && !formView ? (
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
        <div className={`search ${formView ? 'is-hidden' : ''}`}>
          <SearchIcon className="search-icon" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Klar fäller bara ner tangentbordet – den ska aldrig logga något.
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            placeholder="Sök mat, t.ex. 2 potatis"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="Sök mat"
            tabIndex={open ? 0 : -1}
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Rensa"
            >
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
              showToast(`${food.name} sparad och tillagd${dayNote}`)
              setQuery('')
              setView({ kind: 'home' })
            }}
          />
        ) : searching ? (
          <>
            {qty !== 1 && (
              <p className="qty-note">
                Lägger till <strong>{formatQty(qty)}</strong> åt gången
              </p>
            )}
            {matchingMeals.length > 0 && <div className="group">{matchingMeals.map(mealRow)}</div>}
            {results.length > 0 && <div className="group">{results.map(row)}</div>}
            {results.length === 0 && matchingMeals.length === 0 && <p className="empty-text">Hittade inget som heter ”{trimmed}”.</p>}
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
        ) : (
          <>
            {meals.length > 0 && (
              <>
                <h3 className="section-title">Mina måltider</h3>
                <div className="group">{meals.map(mealRow)}</div>
              </>
            )}
            {recent.length > 0 && (
              <>
                <h3 className="section-title">Senaste</h3>
                <div className="group">{recent.map(row)}</div>
              </>
            )}
            {seasonal.length > 0 && (
              <>
                <h3 className="section-title">Säsong</h3>
                <div className="group">{seasonal.map(row)}</div>
              </>
            )}
            <p className="hint-text">
              Tips: tryck på en vara för att välja storlek och mängd, eller på + för att lägga till samma som sist. Håll inne för att lägga den
              bland favoriterna.
            </p>
          </>
        )}
      </div>
      <ChoiceSheet food={choosing} qty={qty} date={date} onClose={() => setChoosing(null)} />
      <FavoritePicker item={favoriting} onClose={() => setFavoriting(null)} />
    </Sheet>
  )
}
