import { useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import { FoodIcon } from '../components/FoodIcon'
import { ArrowDown, ArrowUp, EqualIcon, ScaleIcon } from '../components/icons'
import { Segmented } from '../components/Segmented'
import { WeightChart } from '../components/WeightChart'
import { WeightSheet } from '../components/WeightSheet'
import {
  budgetFor,
  estimateCalibration,
  forecastKgPerWeek,
  formatInt,
  formatKg,
  formatKgPerWeek,
  MIN_FORECAST_DAYS,
  rollingAverage,
  tdee,
  topSources,
  weekdayAverages,
  weightTrend,
} from '../lib/calc'
import { addDays } from '../lib/dates'
import { useAnimatedNumber, useToday } from '../lib/hooks'
import { useUI } from '../store/ui'
import { useStore } from '../store/useStore'

const RANGES = [
  { value: 7, label: '7 dagar' },
  { value: 30, label: '30 dagar' },
  { value: 90, label: '90 dagar' },
]

const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']
const DAY = 86_400_000

export function Trend() {
  const today = useToday()
  const range = useStore((s) => s.trendRange)
  const setRange = useStore((s) => s.setTrendRange)
  const entries = useStore((s) => s.entries)
  const history = useStore((s) => s.budgetHistory)
  const excludedDays = useStore((s) => s.excludedDays)
  const weights = useStore((s) => s.weights)
  const goal = useStore((s) => s.goal)
  const profile = useStore((s) => s.profile)
  const calibration = useStore((s) => s.calibration)
  const dismissedAt = useStore((s) => s.calibrationDismissedAt)
  const logWeight = useStore((s) => s.logWeight)
  const setProfile = useStore((s) => s.setProfile)
  const setCalibration = useStore((s) => s.setCalibration)
  const dismissCalibration = useStore((s) => s.dismissCalibration)
  const showToast = useUI((s) => s.showToast)
  const [weighing, setWeighing] = useState(false)

  // Bara hela dagar räknas. Dagen som pågår skulle annars alltid dra ner snittet.
  const yesterday = addDays(today, -1)
  const stats = useMemo(
    () => rollingAverage(entries, history, yesterday, range, excludedDays),
    [entries, history, yesterday, range, excludedDays],
  )
  const avg = stats.avg
  const animated = useAnimatedNumber(avg ?? 0)
  const budget = budgetFor(today, history)
  const kg = avg !== null ? forecastKgPerWeek(avg, budget) : 0
  const diff = avg !== null ? Math.round(avg - 100) : 0
  const steady = Math.abs(diff) <= 3
  const excludedInRange = stats.days.filter((d) => d.excluded).length

  // Jämförelse som i Apple Fitness: 30 mot 90 dagar.
  const avg30 = useMemo(() => rollingAverage(entries, history, yesterday, 30, excludedDays), [entries, history, yesterday, excludedDays])
  const avg90 = useMemo(() => rollingAverage(entries, history, yesterday, 90, excludedDays), [entries, history, yesterday, excludedDays])
  const lowWarning = useMemo(() => {
    const two = rollingAverage(entries, history, yesterday, 14, excludedDays)
    return two.loggedDays >= 7 && two.avg !== null && two.avg < 70
  }, [entries, history, yesterday, excludedDays])

  // Mönster: veckodagar (efter fyra veckor) och varor som gav flest poäng.
  const weekdays = useMemo(() => (range >= 30 && stats.loggedDays >= 20 ? weekdayAverages(stats.days) : null), [range, stats])
  const weekdaySpread = weekdays ? spread(weekdays) : null
  const sources = useMemo(
    () => (range >= 30 ? topSources(entries, addDays(yesterday, -(range - 1)), yesterday) : []),
    [entries, yesterday, range],
  )

  // Vikt
  const trend = useMemo(() => weightTrend(weights, today), [weights, today])
  const lastWeight = weights.length ? weights[weights.length - 1].kg : (profile?.weightKg ?? null)
  const trendNow = trend.length ? trend[trend.length - 1].trend : null
  const trendWeekAgo = trend.length > 7 ? trend[trend.length - 8].trend : null
  const shownTrend = trend.slice(-Math.max(range, 14))

  // Självkalibrering
  const firstDay = useMemo(() => entries.reduce<string | null>((min, e) => (min === null || e.date < min ? e.date : min), null), [entries])
  const suggestion = useMemo(
    () =>
      profile && (!dismissedAt || Date.now() - dismissedAt > 14 * DAY)
        ? estimateCalibration({ entries, weights, excluded: excludedDays, today, currentBudget: budget, currentFactor: calibration, firstDay })
        : null,
    [profile, dismissedAt, entries, weights, excludedDays, today, budget, calibration, firstDay],
  )

  const saveWeight = (value: number) => {
    logWeight(today, value)
    setWeighing(false)
    // Budgeten följer med när trendvikten har ändrats minst 1 kg mot profilen. Gamla dagar påverkas inte.
    const t = weightTrend([...useStore.getState().weights], today)
    const now = t.length ? t[t.length - 1].trend : value
    if (profile && Math.abs(now - profile.weightKg) >= 1) {
      setProfile({ ...profile, weightKg: Math.round(now * 10) / 10 })
      showToast('Vikten sparad · dina 100 poäng räknades om')
    } else {
      showToast('Vikten sparad')
    }
  }

  return (
    <main className="screen trend">
      <header className="page-header">
        <h1 className="large-title">Trend</h1>
      </header>

      <Segmented label="Period" options={RANGES} value={range} onChange={setRange} />

      <section className="card stat-card">
        <div className="stat-label">Snitt per dag</div>
        <div className="stat-row">
          <span className="stat-value">{avg === null ? '–' : Math.round(animated)}</span>
          <span className="stat-of">av 100{goal < 100 ? ` · mål ${goal}` : ''}</span>
        </div>
        {excludedInRange > 0 && (
          <div className="stat-sub">{excludedInRange} {excludedInRange === 1 ? 'dag räknas' : 'dagar räknas'} inte</div>
        )}
        <BarChart days={stats.days} avg={avg} goal={goal} />
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
              {goal < 100 && stats.loggedDays >= MIN_FORECAST_DAYS && ` Ditt mål är ${goal}.`}
            </div>
          </div>
        </section>
      ) : (
        <section className="card empty-card">
          <p>Snittet räknas på hela dagar. Det du loggar idag kommer med här i morgon.</p>
        </section>
      )}

      {lowWarning && (
        <section className="card care-card">
          <div className="tip-title">Ditt snitt är lågt</div>
          <p className="muted small">
            De senaste två veckorna har du legat under 70 i snitt. Att äta för lite under lång tid kan göra dig trött och påverka hälsan. Om du vill gå ner i
            vikt räcker det oftast att ligga runt 85–95. Prata gärna med vården om du är orolig för ditt ätande.
          </p>
        </section>
      )}

      {suggestion && (
        <section className="card calibrate-card">
          <div className="tip-title">Dina 100 poäng kan behöva justeras</div>
          <p className="muted small">
            Din vikt har inte rört sig som snittet förutsäger. Utifrån det du loggat och din vikttrend de senaste fyra veckorna verkar din förbrukning vara
            ungefär {formatInt(suggestion.expenditure)} kcal per dag, inte {formatInt(budget)}. Det kan bero på att aktivitetsnivån eller portionerna
            uppskattats lite fel – det är helt normalt.
          </p>
          <div className="backup-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setCalibration(suggestion.factor)
                showToast('Dina 100 poäng är justerade')
              }}
            >
              Justera {suggestion.factor < calibration ? 'ner' : 'upp'} försiktigt
            </button>
            <button type="button" className="link-btn" onClick={dismissCalibration}>
              Inte nu
            </button>
          </div>
        </section>
      )}

      <h2 className="section-title">
        Vikt
        <button type="button" className="section-action" onClick={() => setWeighing(true)}>
          Väg in
        </button>
      </h2>
      <section className="card weight-card">
        {trendNow !== null ? (
          <>
            <div className="stat-row">
              <span className="stat-value small-value">{formatKg(trendNow).replace('+', '')}</span>
              <span className="stat-of">kg</span>
            </div>
            <div className="stat-sub">
              Utjämnad trend
              {trendWeekAgo !== null && ` · ${formatKg(trendNow - trendWeekAgo)} kg senaste veckan`}
            </div>
            <WeightChart points={shownTrend} />
          </>
        ) : (
          <button type="button" className="weight-empty" onClick={() => setWeighing(true)}>
            <ScaleIcon size={22} />
            <span>
              Väg in då och då så ser du en lugn trend – och efter några veckor kan appen justera vad 100 poäng betyder för just dig.
            </span>
          </button>
        )}
      </section>

      {(weekdays || sources.length > 0 || avg90.loggedDays >= 30) && <h2 className="section-title">Mönster</h2>}
      {avg90.loggedDays >= 30 && avg30.avg !== null && avg90.avg !== null && (
        <section className="card compare-card">
          <div>
            <div className="stat-label">30 dagar</div>
            <div className="compare-value">{Math.round(avg30.avg)}</div>
          </div>
          <div>
            <div className="stat-label">90 dagar</div>
            <div className="compare-value">{Math.round(avg90.avg)}</div>
          </div>
        </section>
      )}
      {weekdays && weekdaySpread !== null && weekdaySpread.diff > 10 && (
        <section className="card">
          <div className="stat-label">Veckodagar</div>
          <div className="weekday-bars" role="img" aria-label={`${WEEKDAY_NAMES[weekdaySpread.hi]} ligger högst och ${WEEKDAY_NAMES[weekdaySpread.lo]} lägst.`}>
            {weekdays.map((v, i) => (
              <span key={i} className="weekday-bar">
                <span className={`week-fill ${v === null ? 'is-empty' : v > 100 ? 'is-over' : ''}`} style={{ height: v === null ? 3 : `${Math.max(8, (v / 140) * 100)}%` }} />
                <span className="week-day">{WEEKDAY_NAMES[i][0]}</span>
              </span>
            ))}
          </div>
          <p className="insight-text">
            {WEEKDAY_NAMES[weekdaySpread.hi]} ligger {Math.round(weekdaySpread.diff)} poäng över {WEEKDAY_NAMES[weekdaySpread.lo].toLowerCase()} i snitt.
          </p>
        </section>
      )}
      {sources.length > 0 && (
        <section className="card">
          <div className="stat-label">Gav flest poäng senaste {range} dagarna</div>
          <div className="sources">
            {sources.map((src) => (
              <div key={src.foodId} className="source">
                <span className="emoji" aria-hidden>
                  <FoodIcon id={src.foodId} emoji={src.emoji} />
                </span>
                <span className="row-name">{src.name}</span>
                <span className="row-points">{Math.round(src.share * 100)} %</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="hint-text">
        Enskilda dagar spelar liten roll. Titta på 30 dagar för att se vart du är på väg. Dagar utan loggning, och dagar du valt att inte räkna med, ingår inte.
      </p>
      {profile && calibration !== 1 && (
        <p className="hint-text">
          Dina 100 poäng är justerade efter vikttrenden ({Math.round((calibration - 1) * 100)} %, {formatInt(Math.round(tdee(profile) * calibration))} kcal).
        </p>
      )}

      <WeightSheet open={weighing} lastKg={lastWeight} onSave={saveWeight} onClose={() => setWeighing(false)} />
    </main>
  )
}

function spread(values: (number | null)[]): { hi: number; lo: number; diff: number } | null {
  const idx = values.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null)
  if (idx.length < 5) return null
  const hi = idx.reduce((a, b) => (b[0] > a[0] ? b : a))
  const lo = idx.reduce((a, b) => (b[0] < a[0] ? b : a))
  return { hi: hi[1], lo: lo[1], diff: hi[0] - lo[0] }
}
