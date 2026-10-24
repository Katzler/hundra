import { useMemo, useState } from 'react'
import { budgetFor, entryKcal, toPoints, type BudgetPeriod, type Entry } from '../lib/calc'
import { fromKey, toKey, type DateKey } from '../lib/dates'
import { ChevronLeft, ChevronRight } from './icons'
import { MiniRing } from './Ring'
import { Sheet } from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  today: DateKey
  selected: DateKey
  entries: Entry[]
  history: BudgetPeriod[]
  excluded: DateKey[]
  onPick: (date: DateKey) => void
}

const monthName = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' })
const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

/** Månadsvy med en liten ring per dag, som i Apple Fitness. Ett tryck öppnar dagen. */
export function CalendarSheet({ open, onClose, today, selected, entries, history, excluded, onPick }: Props) {
  const [month, setMonth] = useState(() => selected.slice(0, 7))

  // Poäng per dag räknas en gång för hela loggen.
  const pointsByDay = useMemo(() => {
    const kcal = new Map<DateKey, number>()
    for (const e of entries) kcal.set(e.date, (kcal.get(e.date) ?? 0) + entryKcal(e))
    const out = new Map<DateKey, number>()
    for (const [date, k] of kcal) if (k > 0) out.set(date, toPoints(k, budgetFor(date, history)))
    return out
  }, [entries, history])

  const first = fromKey(`${month}-01`)
  const lead = (first.getDay() + 6) % 7 // måndag först
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (DateKey | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
  const shift = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1, 12)
    setMonth(toKey(d).slice(0, 7))
  }
  const isCurrentMonth = month === today.slice(0, 7)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Kalender"
      title="Kalender"
      right={
        <button type="button" className="bar-btn bar-btn-strong" onClick={onClose}>
          Klar
        </button>
      }
    >
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Föregående månad">
          <ChevronLeft />
        </button>
        <h2 className="cal-title">{monthName.format(first)}</h2>
        <button type="button" className="icon-btn" onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Nästa månad">
          <ChevronRight />
        </button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="cal-weekday" aria-hidden>
            {d}
          </span>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <span key={`x${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              className={`cal-day ${date === selected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
              disabled={date > today}
              onClick={() => {
                onPick(date)
                onClose()
              }}
              aria-label={`${fromKey(date).getDate()} ${monthName.format(fromKey(date)).split(' ')[0]}${
                pointsByDay.has(date) ? `, ${Math.round(pointsByDay.get(date)!)} poäng` : ', inget loggat'
              }`}
            >
              <MiniRing value={pointsByDay.get(date) ?? null} size={34} stroke={4.5} muted={excluded.includes(date)} />
              <span className="cal-num">{fromKey(date).getDate()}</span>
            </button>
          ),
        )}
      </div>
      {!isCurrentMonth && (
        <button
          type="button"
          className="link-btn cal-today"
          onClick={() => {
            onPick(today)
            onClose()
          }}
        >
          Gå till idag
        </button>
      )}
      <p className="hint-text">Grå ring = dagen räknas inte i snittet. Tryck på en dag för att se eller logga i efterhand.</p>
    </Sheet>
  )
}
