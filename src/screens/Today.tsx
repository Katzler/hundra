import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AddSheet } from '../components/AddSheet'
import { BackupCard, backupDue } from '../components/BackupCard'
import { CalendarSheet } from '../components/CalendarSheet'
import { FoodIcon } from '../components/FoodIcon'
import { EntryRow } from '../components/FoodRow'
import { CalendarIcon, ChevronLeft, ChevronRight, PlusIcon } from '../components/icons'
import { MealSheet } from '../components/MealSheet'
import { QuickPicksSheet } from '../components/QuickPicksSheet'
import { Ring } from '../components/Ring'
import { SwipeRow } from '../components/SwipeRow'
import { WeekStrip } from '../components/WeekStrip'
import { budgetFor, entryKcal, formatPoints, rollingAverage, toPoints } from '../lib/calc'
import { addDays, dayLong, dayTitle, resolveDay, type DateKey, type PickedDay } from '../lib/dates'
import { useToday } from '../lib/hooks'
import { haptic, useUI } from '../store/ui'
import { allFoods, mealKcal, quickItems, useStore, type MealItem, type QuickItem } from '../store/useStore'

/** Under så här många poäng kan en passerad dag vara ofullständig. */
const SHORT_DAY = 35

export function Today({ onOpenTrend }: { onOpenTrend: () => void }) {
  const today = useToday()
  const [picked, setPicked] = useState<PickedDay | null>(null)
  const date = resolveDay(picked, today)
  const goTo = (d: DateKey) => setPicked(d < today ? { date: d, on: today } : null)
  const [adding, setAdding] = useState(false)
  const [editingPicks, setEditingPicks] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [mealSource, setMealSource] = useState<{ items: MealItem[] } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const entries = useStore((s) => s.entries)
  const history = useStore((s) => s.budgetHistory)
  const custom = useStore((s) => s.customFoods)
  const quickPicks = useStore((s) => s.quickPicks)
  const meals = useStore((s) => s.meals)
  const excludedDays = useStore((s) => s.excludedDays)
  const goal = useStore((s) => s.goal)
  const showBackup = useStore((s) => backupDue(s))
  const addFood = useStore((s) => s.addFood)
  const logMeal = useStore((s) => s.logMeal)
  const setDayEntries = useStore((s) => s.setDayEntries)
  const setQty = useStore((s) => s.setQty)
  const removeEntry = useStore((s) => s.removeEntry)
  const restoreEntry = useStore((s) => s.restoreEntry)
  const toggleExcludedDay = useStore((s) => s.toggleExcludedDay)
  const showToast = useUI((s) => s.showToast)

  const budget = budgetFor(date, history)
  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => a.at - b.at), [entries, date])
  const total = toPoints(dayEntries.reduce((s, e) => s + entryKcal(e), 0), budget)
  const left = 100 - total
  const isToday = date === today
  const excluded = excludedDays.includes(date)
  // Loggar man på en annan dag än idag ska bekräftelsen säga det.
  const dayNote = isToday ? '' : ` · ${dayTitle(date, today)}`

  const week = useMemo(
    () => rollingAverage(entries, history, addDays(today, -1), 7, excludedDays),
    [entries, history, today, excludedDays],
  )

  // Automatiska snabbval låses när skärmen visas, så att chipsen inte hoppar runt medan man trycker.
  const quick = useMemo(
    () => quickItems(allFoods(custom), useStore.getState().usage, quickPicks, meals),
    [custom, quickPicks, meals],
  )

  const openAdd = () => {
    // Fokus måste sättas direkt i trycket för att iOS ska visa tangentbordet.
    flushSync(() => setAdding(true))
    searchRef.current?.focus({ preventScroll: true })
  }

  const quickAdd = (item: QuickItem) => {
    haptic()
    if (item.kind === 'meal') {
      const before = useStore.getState().entries.filter((e) => e.date === date)
      logMeal(item.meal.id, date)
      showToast(`${item.meal.name} tillagd${dayNote}`, { label: 'Ångra', run: () => setDayEntries(date, before) })
      return
    }
    const food = item.food
    addFood(food, date)
    showToast(`${food.name} +1${dayNote}`, {
      label: 'Ångra',
      run: () => {
        const e = useStore.getState().entries.find((x) => x.date === date && x.foodId === food.id)
        if (e) setQty(e.id, e.qty - 1)
      },
    })
  }

  const remove = (id: string) => {
    const removed = removeEntry(id)
    if (removed) showToast(`${removed.name} borttagen`, { label: 'Ångra', run: () => restoreEntry(removed) })
  }

  return (
    <main className="screen today">
      <header className="day-header">
        <button type="button" className="day-heading" onClick={() => setCalendarOpen(true)} aria-label={`${dayLong(date)}. Öppna kalendern.`}>
          <span className="eyebrow">
            {dayLong(date)} <CalendarIcon size={13} />
          </span>
          <h1 className="large-title">{dayTitle(date, today)}</h1>
        </button>
        <div className="day-nav">
          <button type="button" className="icon-btn" onClick={() => goTo(addDays(date, -1))} aria-label="Föregående dag">
            <ChevronLeft />
          </button>
          <button type="button" className="icon-btn" onClick={() => goTo(addDays(date, 1))} disabled={isToday} aria-label="Nästa dag">
            <ChevronRight />
          </button>
        </div>
      </header>

      <section className="ring-section">
        <Ring value={total} goal={goal} />
        <p className="ring-note">
          {dayEntries.length === 0
            ? 'Inget loggat än'
            : left >= 0.5
              ? `${formatPoints(left)} kvar till 100`
              : left > -0.5
                ? 'Precis 100'
                : `${formatPoints(-left)} över 100`}
        </p>
      </section>

      {!isToday && dayEntries.length > 0 && (
        <section className={`card exclude-card ${total < SHORT_DAY ? 'is-short' : ''}`}>
          {total < SHORT_DAY && !excluded && (
            <p className="small">Den här dagen ser kort ut. Glömde du något? Logga det i efterhand, eller räkna inte med dagen.</p>
          )}
          <label className="toggle-row">
            <span className="row-title">Räkna med i snittet</span>
            <input type="checkbox" className="switch" checked={!excluded} onChange={() => toggleExcludedDay(date)} />
          </label>
        </section>
      )}

      {week.loggedDays >= 3 && <WeekStrip week={week} goal={goal} onOpen={onOpenTrend} />}

      <section aria-labelledby="quick-title">
        <h2 className="section-title" id="quick-title">
          Snabbval
          <button type="button" className="section-action" onClick={() => setEditingPicks(true)}>
            Ändra
          </button>
        </h2>
        <div className="chips">
          {quick.map((item) => {
            const id = item.kind === 'food' ? item.food.id : item.meal.id
            const name = item.kind === 'food' ? item.food.name : item.meal.name
            const kcal = item.kind === 'food' ? item.food.kcal : mealKcal(item.meal)
            return (
              <button
                key={id}
                type="button"
                className="chip"
                onClick={() => quickAdd(item)}
                aria-label={`Lägg till ${name}`}
              >
                <span className="chip-emoji" aria-hidden>
                  {item.kind === 'food' ? (
                    <FoodIcon id={item.food.id} emoji={item.food.emoji} size={26} />
                  ) : (
                    <FoodIcon id="maltid-egen" emoji="🍱" size={26} />
                  )}
                </span>
                <span className="chip-name">{name}</span>
                <span className="chip-points">{formatPoints(toPoints(kcal, budget))}</span>
              </button>
            )
          })}
          {quick.length === 0 && (
            <button type="button" className="chip chip-add" onClick={() => setEditingPicks(true)}>
              <PlusIcon size={16} />
              Lägg till snabbval
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="day-title">
        <h2 className="section-title" id="day-title">
          {isToday ? 'Dagens mat' : 'Den här dagen'}
          {dayEntries.length > 0 && <span className="section-meta">{formatPoints(total)} p</span>}
        </h2>
        {dayEntries.length > 0 ? (
          <div className="group">
            {dayEntries.map((e) => (
              <SwipeRow key={e.id} onDelete={() => remove(e.id)}>
                <EntryRow entry={e} points={toPoints(entryKcal(e), budget)} onQty={(q) => (q <= 0 ? remove(e.id) : setQty(e.id, q))} />
              </SwipeRow>
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <p>
              Tryck på ett snabbval ovan eller på <strong>Lägg till mat</strong>.
            </p>
          </div>
        )}
        {dayEntries.length > 0 && (
          <div className="day-actions">
            {dayEntries.some((e) => e.foodId !== 'snabbpoang') && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  setMealSource({
                    items: dayEntries
                      .filter((e) => e.foodId !== 'snabbpoang')
                      .map(({ foodId, name, emoji, unit, kcalPerUnit, qty }) => ({ foodId, name, emoji, unit, kcalPerUnit, qty })),
                  })
                }
              >
                Spara som måltid
              </button>
            )}
          </div>
        )}
      </section>

      {showBackup && isToday && <BackupCard />}

      <button type="button" className="fab" onClick={openAdd}>
        <PlusIcon size={20} />
        Lägg till mat
      </button>

      <CalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        today={today}
        selected={date}
        entries={entries}
        history={history}
        excluded={excludedDays}
        onPick={goTo}
      />
      <MealSheet source={mealSource} budgetKcal={budget} onClose={() => setMealSource(null)} />
      <QuickPicksSheet open={editingPicks} onClose={() => setEditingPicks(false)} budgetKcal={budget} />
      <AddSheet open={adding} date={date} onClose={() => setAdding(false)} inputRef={searchRef} />
    </main>
  )
}
