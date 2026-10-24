import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AddSheet } from '../components/AddSheet'
import { QuickPicksSheet } from '../components/QuickPicksSheet'
import { FoodIcon } from '../components/FoodIcon'
import { EntryRow } from '../components/FoodRow'
import { ChevronLeft, ChevronRight, PlusIcon } from '../components/icons'
import { Ring } from '../components/Ring'
import { SwipeRow } from '../components/SwipeRow'
import type { Food } from '../data/foods'
import { budgetFor, entryKcal, formatPoints, toPoints } from '../lib/calc'
import { addDays, dayLong, dayTitle, resolveDay, type DateKey, type PickedDay } from '../lib/dates'
import { useToday } from '../lib/hooks'
import { haptic, useUI } from '../store/ui'
import { allFoods, quickFoods, useStore } from '../store/useStore'


export function Today() {
  const today = useToday()
  const [picked, setPicked] = useState<PickedDay | null>(null)
  const date = resolveDay(picked, today)
  const goTo = (d: DateKey) => setPicked(d < today ? { date: d, on: today } : null)
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const entries = useStore((s) => s.entries)
  const history = useStore((s) => s.budgetHistory)
  const custom = useStore((s) => s.customFoods)
  const quickPicks = useStore((s) => s.quickPicks)
  const [editingPicks, setEditingPicks] = useState(false)
  const addFood = useStore((s) => s.addFood)
  const setQty = useStore((s) => s.setQty)
  const removeEntry = useStore((s) => s.removeEntry)
  const restoreEntry = useStore((s) => s.restoreEntry)
  const showToast = useUI((s) => s.showToast)

  const budget = budgetFor(date, history)
  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === date).sort((a, b) => a.at - b.at),
    [entries, date],
  )
  const total = toPoints(dayEntries.reduce((s, e) => s + entryKcal(e), 0), budget)
  const left = 100 - total

  // Automatiska snabbval låses när skärmen visas, så att chipsen inte hoppar runt medan man trycker.
  const quick = useMemo(
    () => quickFoods(allFoods(custom), useStore.getState().usage, quickPicks),
    [custom, quickPicks],
  )

  const openAdd = () => {
    // Fokus måste sättas direkt i trycket för att iOS ska visa tangentbordet.
    flushSync(() => setAdding(true))
    searchRef.current?.focus({ preventScroll: true })
  }

  const quickAdd = (food: Food) => {
    haptic()
    addFood(food, date)
    showToast(`${food.name} +1${dayNote}`, {
      label: 'Ångra',
      run: () => {
        const e = useStore.getState().entries.find((x) => x.date === date && x.foodId === food.id)
        if (e) setQty(e.id, e.qty - 1)
      },
    })
  }

  const isToday = date === today
  // Loggar man på en annan dag än idag ska bekräftelsen säga det.
  const dayNote = isToday ? '' : ` · ${dayTitle(date, today)}`

  const remove = (id: string) => {
    const removed = removeEntry(id)
    if (removed) showToast(`${removed.name} borttagen`, { label: 'Ångra', run: () => restoreEntry(removed) })
  }


  return (
    <main className="screen today">
      <header className="day-header">
        <button type="button" className="day-heading" onClick={() => setPicked(null)} disabled={isToday}>
          <span className="eyebrow">{dayLong(date)}</span>
          <span className="large-title">{dayTitle(date, today)}</span>
        </button>
        <div className="day-nav">
          <button type="button" className="icon-btn" onClick={() => goTo(addDays(date, -1))} aria-label="Föregående dag">
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => goTo(addDays(date, 1))}
            disabled={isToday}
            aria-label="Nästa dag"
          >
            <ChevronRight />
          </button>
        </div>
      </header>

      <section className="ring-section">
        <Ring value={total} />
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

      <section aria-label="Snabbval">
        <h2 className="section-title">
          Snabbval
          <button type="button" className="section-action" onClick={() => setEditingPicks(true)}>
            Ändra
          </button>
        </h2>
        <div className="chips">
          {quick.map((f) => (
            <button key={f.id} type="button" className="chip" onClick={() => quickAdd(f)}>
              <span className="chip-emoji" aria-hidden>
                <FoodIcon id={f.id} emoji={f.emoji} size={26} />
              </span>
              <span className="chip-name">{f.name}</span>
              <span className="chip-points">{formatPoints(toPoints(f.kcal, budget))}</span>
            </button>
          ))}
          {quick.length === 0 && (
            <button type="button" className="chip chip-add" onClick={() => setEditingPicks(true)}>
              <PlusIcon size={16} />
              Lägg till snabbval
            </button>
          )}
        </div>
      </section>

      <section aria-label="Dagens mat">
        <h2 className="section-title">
          {isToday ? 'Dagens mat' : 'Den här dagen'}
          {dayEntries.length > 0 && <span className="section-meta">{formatPoints(total)} p</span>}
        </h2>
        {dayEntries.length > 0 ? (
          <div className="group">
            {dayEntries.map((e) => (
              <SwipeRow key={e.id} onDelete={() => remove(e.id)}>
                <EntryRow
                  entry={e}
                  points={toPoints(entryKcal(e), budget)}
                  onQty={(q) => (q <= 0 ? remove(e.id) : setQty(e.id, q))}
                />
              </SwipeRow>
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <p>Tryck på ett snabbval ovan eller på <strong>Lägg till mat</strong>.</p>
          </div>
        )}
        {dayEntries.length > 0 && <p className="hint-text">Svep åt vänster på en rad för att ta bort den.</p>}
      </section>

      <button type="button" className="fab" onClick={openAdd}>
        <PlusIcon size={20} />
        Lägg till mat
      </button>

      <QuickPicksSheet open={editingPicks} onClose={() => setEditingPicks(false)} budgetKcal={budget} />
      <AddSheet open={adding} date={date} onClose={() => setAdding(false)} inputRef={searchRef} />
    </main>
  )
}
