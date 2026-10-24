import { useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import { ArrowDown, ArrowUp, EqualIcon } from '../components/icons'
import { Segmented } from '../components/Segmented'
import { budgetFor, forecastKgPerWeek, formatKgPerWeek, MIN_FORECAST_DAYS, rollingAverage } from '../lib/calc'
import { addDays } from '../lib/dates'
import { useAnimatedNumber, useToday } from '../lib/hooks'
import { useStore } from '../store/useStore'

const RANGES = [
  { value: 7, label: '7 dagar' },
  { value: 30, label: '30 dagar' },
  { value: 90, label: '90 dagar' },
]

export function Trend() {
  const today = useToday()
  const [range, setRange] = useState(7)
  const entries = useStore((s) => s.entries)
  const history = useStore((s) => s.budgetHistory)

  // Bara hela dagar räknas. Dagen som pågår skulle annars alltid dra ner snittet.
  const yesterday = addDays(today, -1)
  const stats = useMemo(() => rollingAverage(entries, history, yesterday, range), [entries, history, yesterday, range])
  const avg = stats.avg
  const animated = useAnimatedNumber(avg ?? 0)
  const budget = budgetFor(today, history)
  const kg = avg !== null ? forecastKgPerWeek(avg, budget) : 0
  const diff = avg !== null ? Math.round(avg - 100) : 0
  const steady = Math.abs(diff) <= 3

  return (
    <main className="screen trend">
      <header className="page-header">
        <span className="large-title">Trend</span>
      </header>

      <Segmented label="Period" options={RANGES} value={range} onChange={setRange} />

      <section className="card stat-card">
        <div className="stat-label">Snitt per dag</div>
        <div className="stat-row">
          <span className="stat-value">{avg === null ? '–' : Math.round(animated)}</span>
          <span className="stat-of">av 100</span>
        </div>
        <div className="stat-sub">
          Loggat {stats.loggedDays} av {stats.totalDays} dagar
        </div>
        <BarChart days={stats.days} avg={avg} />
      </section>

      {avg !== null ? (
        <section className="card insight">
          <span className={`insight-icon ${steady ? 'is-steady' : diff < 0 ? 'is-down' : 'is-up'}`}>
            {steady ? <EqualIcon /> : diff < 0 ? <ArrowDown /> : <ArrowUp />}
          </span>
          <div>
            <div className="insight-title">
              {steady ? 'Du ligger runt 100' : diff < 0 ? `${Math.abs(diff)} under 100 i snitt` : `${diff} över 100 i snitt`}
            </div>
            <div className="insight-text">
              {stats.loggedDays < MIN_FORECAST_DAYS
                ? `Prognosen visas när du loggat minst ${MIN_FORECAST_DAYS} hela dagar (${MIN_FORECAST_DAYS - stats.loggedDays} kvar).`
                : steady
                  ? 'Vikten bör hålla sig ungefär stabil.'
                  : `${formatKgPerWeek(kg).replace(/^./, (c) => c.toUpperCase())} om du fortsätter så här.`}
            </div>
          </div>
        </section>
      ) : (
        <section className="card empty-card">
          <p>Snittet räknas på hela dagar. Det du loggar idag kommer med här i morgon.</p>
        </section>
      )}

      <p className="hint-text">
        Enskilda dagar spelar liten roll. Titta på 30 dagar för att se vart du är på väg. Snittet räknas på hela dagar, och dagar utan loggning räknas inte med.
      </p>
    </main>
  )
}
