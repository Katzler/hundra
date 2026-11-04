import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { applyPicks, choiceSummary, hasChoices as choicesFor, preferred, type Picks } from '../data/choices'
import type { Food, Per100 } from '../data/foods'
import { isStoreCode } from '../lib/barcode'
import { budgetFor, dayKcal, formatPoints, formatQty, toPoints } from '../lib/calc'
import { dayTitle, todayKey, type DateKey } from '../lib/dates'
import { lookupBarcode, productPage, type Lookup } from '../lib/openfoodfacts'
import { packagedBase } from '../lib/packaged'
import { parseQuantity, searchFoods } from '../lib/search'
import { useUI } from '../store/ui'
import { allFoods, foodByBarcode, isFavorite, itemOf, MEAL_PREFIX, mealKcal, recentFoods, sameItem, useStore, type Meal } from '../store/useStore'
import { ChoiceSheet } from './ChoiceSheet'
import { CustomFoodForm } from './CustomFoodForm'
import { FavoritePicker } from './FavoritePicker'
import { FoodIcon } from './FoodIcon'
import { FoodRow } from './FoodRow'
import { BarcodeIcon, ChevronLeft, ChevronRight, PlusIcon, SearchIcon, XIcon } from './icons'
import { ScanSheet } from './ScanSheet'
import { Sheet } from './Sheet'

type View =
  | { kind: 'home' }
  /** Ny vara. Från en skanning följer koden med, och det som var känt om varan. */
  | { kind: 'create'; barcode?: string; initial?: Partial<Food>; per100?: Partial<Per100>; note?: string }

/** Id för en skannad vara som ännu inte sparats. Den sparas som egen vara när man lägger till den. */
const SCANNED_ID = 'skannad'

// Vad formuläret säger när en skannad vara inte gick att använda direkt.
const SCAN_NOTES: Record<Exclude<Lookup['kind'], 'found'>, string> = {
  incomplete: 'Varan finns i Open Food Facts men saknar näringsvärde. Skriv av det från förpackningen, så känns varan igen nästa gång.',
  missing: 'Hittade inte varan i Open Food Facts. Skriv av näringsvärdet från förpackningen, så känns den igen nästa gång.',
  offline: 'Kunde inte nå Open Food Facts. Skriv av näringsvärdet från förpackningen, så känns varan igen nästa gång.',
  error: 'Open Food Facts svarar inte just nu. Skriv av näringsvärdet från förpackningen, så känns varan igen nästa gång.',
}

type Props = {
  open: boolean
  date: DateKey
  /** Text som skrevs i fältet på Idag innan arkets sökfält fick fokus. */
  typed: string
  /** Arket öppnades med streckkodsknappen: kameran startar direkt. */
  scan?: boolean
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

export function AddSheet({ open, date, typed, scan, onClose, inputRef }: Props) {
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
  const [scanning, setScanning] = useState(false)
  // Koden som slås upp just nu, och meddelandet om en kod inte gick att använda.
  const [looking, setLooking] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const lookupRef = useRef<AbortController | null>(null)

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
    setScanning(false)
    setNotice(null)
    lookupRef.current?.abort()
    setLooking(null)
  }, [open, date])

  useEffect(() => {
    if (open && scan) setScanning(true)
  }, [open, scan])

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

  const startScan = () => {
    // Tangentbordet fälls ner, annars ligger det kvar ovanpå kameran.
    inputRef.current?.blur()
    setNotice(null)
    setScanning(true)
  }

  /** En läst kod: först de egna varorna, sedan Open Food Facts, annars formuläret. */
  const onCode = async (code: string) => {
    setScanning(false)
    setQuery('')
    setNotice(null)
    setView({ kind: 'home' })
    const own = foodByBarcode(useStore.getState().customFoods, code)
    if (own) {
      setChoosing(own)
      return
    }
    if (isStoreCode(code)) {
      setNotice('Det här är butikens egen kod, som på lösvikt och deli. Den går inte att slå upp. Sök på varan i stället.')
      return
    }
    lookupRef.current?.abort()
    const ctrl = new AbortController()
    lookupRef.current = ctrl
    setLooking(code)
    let result: Lookup
    try {
      result = await lookupBarcode(code, { signal: ctrl.signal })
    } catch {
      return // avbrutet
    }
    if (ctrl.signal.aborted) return
    setLooking(null)
    if (result.kind === 'found') {
      const { name, emoji, per100 } = result.product
      setChoosing({ id: SCANNED_ID, name, emoji, ...packagedBase(per100), category: 'egna', custom: true, barcode: code, per100 })
      return
    }
    setView({
      kind: 'create',
      barcode: code,
      note: SCAN_NOTES[result.kind],
      initial: result.kind === 'incomplete' && result.name ? { name: result.name } : {},
      per100: result.kind === 'incomplete' ? result.per100 : { measure: 'g' },
    })
  }

  // En skannad vara sparas som egen vara med koden först när den läggs till.
  const scanned = choosing?.id === SCANNED_ID ? choosing : null
  const addScanned = (picks: Picks, n: number) => {
    if (!scanned) return
    const { name, emoji, unit, kcal, barcode, per100 } = scanned
    const saved = addCustomFood({ name, emoji, unit, kcal, barcode, per100 })
    addFood(applyPicks(saved, picks), date, n, picks)
    showToast(`${saved.name} sparad och tillagd${dayNote}`)
  }
  const editScanned = () => {
    if (!scanned) return
    setChoosing(null)
    setView({
      kind: 'create',
      barcode: scanned.barcode,
      initial: { name: scanned.name, emoji: scanned.emoji },
      per100: scanned.per100,
      note: 'Rätta det som inte stämmer med förpackningen.',
    })
  }

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
          {query ? (
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
          ) : (
            // Som mikrofonen i iOS sökfält: syns när fältet är tomt och byts mot krysset när man skriver.
            <button type="button" className="search-scan" onClick={startScan} aria-label="Skanna streckkod" tabIndex={open ? 0 : -1}>
              <BarcodeIcon size={21} />
            </button>
          )}
        </div>

        {view.kind === 'create' ? (
          <>
            {view.note && <p className="scan-note">{view.note}</p>}
            <CustomFoodForm
              key={view.barcode ?? 'ny'}
              budgetKcal={budget}
              initial={view.barcode ? view.initial : { name: trimmed }}
              per100={view.per100}
              submitLabel="Spara och lägg till"
              onSubmit={(f) => {
                const food = addCustomFood(view.barcode ? { ...f, barcode: view.barcode } : f)
                add(food, view.barcode ? 1 : qty)
                showToast(`${food.name} sparad och tillagd${dayNote}`)
                setQuery('')
                setView({ kind: 'home' })
              }}
            />
            {view.barcode && (
              <p className="hint-text scan-code">
                Streckkod {view.barcode} ·{' '}
                <a href={productPage(view.barcode)} target="_blank" rel="noreferrer">
                  Lägg till i Open Food Facts
                </a>
              </p>
            )}
          </>
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
            {looking && (
              <div className="card scan-looking" role="status">
                <span className="spinner" aria-hidden />
                <span>Letar upp varan …</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    lookupRef.current?.abort()
                    setLooking(null)
                  }}
                >
                  Avbryt
                </button>
              </div>
            )}
            {notice && (
              <p className="scan-note" role="status">
                {notice}
              </p>
            )}
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
      <ChoiceSheet
        food={choosing}
        qty={qty}
        date={date}
        onClose={() => setChoosing(null)}
        onConfirm={scanned ? (_variant, n, picks) => addScanned(picks, n) : undefined}
        note={
          scanned ? (
            <>
              Från Open Food Facts.{' '}
              <button type="button" className="inline-link" onClick={editScanned}>
                Stämmer inte? Ändra
              </button>
            </>
          ) : undefined
        }
      />
      <FavoritePicker item={favoriting} onClose={() => setFavoriting(null)} />
      <ScanSheet open={scanning} onClose={() => setScanning(false)} onCode={(code) => void onCode(code)} />
    </Sheet>
  )
}
