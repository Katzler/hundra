import { lastNDays, type DateKey } from './dates'

export type Sex = 'man' | 'kvinna'
export type ActivityLevel = 1 | 2 | 3 | 4 | 5

export type Profile = {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: ActivityLevel
}

/** Från och med `from` motsvarar 100 poäng `kcal`. */
export type BudgetPeriod = { from: DateKey; kcal: number }

export type Entry = {
  id: string
  date: DateKey
  foodId: string
  name: string
  emoji: string
  unit: string
  /** Kopia av varans kcal när den loggades, så att historiken ligger fast. */
  kcalPerUnit: number
  qty: number
  at: number
}

export const ACTIVITY: Record<ActivityLevel, { factor: number; title: string; text: string }> = {
  1: { factor: 1.2, title: 'Stillasittande', text: 'Kontorsjobb, lite rörelse' },
  2: { factor: 1.375, title: 'Lätt aktiv', text: 'Promenader, runt 5–7 000 steg' },
  3: { factor: 1.55, title: 'Måttligt aktiv', text: 'Tränar 3–4 gånger i veckan eller står mycket på jobbet' },
  4: { factor: 1.725, title: 'Mycket aktiv', text: 'Tränar nästan varje dag eller har ett fysiskt jobb' },
  5: { factor: 1.9, title: 'Extremt aktiv', text: 'Tungt fysiskt jobb plus träning' },
}

/** Ungefär så mycket energi motsvarar ett kilo kroppsfett. */
export const KCAL_PER_KG = 7700

/** Mifflin-St Jeor */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return p.sex === 'man' ? base + 5 : base - 161
}

/** Dagligt energibehov, det vill säga 100 poäng. */
export function tdee(p: Profile): number {
  return Math.round(bmr(p) * ACTIVITY[p.activity].factor)
}

export function kcalPerPoint(budgetKcal: number): number {
  return budgetKcal / 100
}

export function toPoints(kcal: number, budgetKcal: number): number {
  return kcal / kcalPerPoint(budgetKcal)
}

export function toKcal(points: number, budgetKcal: number): number {
  return points * kcalPerPoint(budgetKcal)
}

/** Budgeten som gällde en viss dag. Dagar före första perioden använder den första. */
export function budgetFor(date: DateKey, history: BudgetPeriod[]): number {
  if (history.length === 0) return 2000
  let current = history[0]
  for (const period of history) {
    if (period.from <= date) current = period
    else break
  }
  return current.kcal
}

/** Lägger till en ny period från `from`. Samma dag skrivs över i stället för att stapla perioder. */
export function withBudget(history: BudgetPeriod[], from: DateKey, kcal: number): BudgetPeriod[] {
  const kept = history.filter((p) => p.from < from)
  const last = kept[kept.length - 1]
  if (last && last.kcal === kcal) return kept
  return [...kept, { from, kcal }]
}

export function entryKcal(e: Entry): number {
  return e.kcalPerUnit * e.qty
}

export function dayKcal(entries: Entry[], date: DateKey): number {
  let sum = 0
  for (const e of entries) if (e.date === date) sum += entryKcal(e)
  return sum
}

export function dayPoints(entries: Entry[], date: DateKey, history: BudgetPeriod[]): number {
  return toPoints(dayKcal(entries, date), budgetFor(date, history))
}

export type DayStat = { date: DateKey; points: number | null }

export type Average = {
  /** null om inga dagar är loggade. */
  avg: number | null
  loggedDays: number
  totalDays: number
  days: DayStat[]
}

/** Snitt över de n senaste dagarna. Dagar utan något loggat räknas inte med. */
export function rollingAverage(
  entries: Entry[],
  history: BudgetPeriod[],
  end: DateKey,
  n: number,
): Average {
  const keys = lastNDays(end, n)
  const start = keys[0]
  const kcalByDay = new Map<DateKey, number>()
  for (const e of entries) {
    if (e.date < start || e.date > end) continue
    kcalByDay.set(e.date, (kcalByDay.get(e.date) ?? 0) + entryKcal(e))
  }
  const days = keys.map((date) => {
    const kcal = kcalByDay.get(date)
    return { date, points: kcal === undefined ? null : toPoints(kcal, budgetFor(date, history)) }
  })
  const logged = days.filter((d) => d.points !== null) as { date: DateKey; points: number }[]
  const avg = logged.length ? logged.reduce((s, d) => s + d.points, 0) / logged.length : null
  return { avg, loggedDays: logged.length, totalDays: n, days }
}

/** Ungefärlig viktförändring per vecka om snittet håller i sig. Negativt = ner i vikt. */
export function forecastKgPerWeek(avgPoints: number, budgetKcal: number): number {
  return (((avgPoints - 100) / 100) * budgetKcal * 7) / KCAL_PER_KG
}

/** Heltal i gränssnittet, "<1" för det som nästan inte kostar något. */
export function formatPoints(points: number): string {
  if (points > 0 && points < 0.5) return '<1'
  return String(Math.round(points))
}

const kgFormat = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

export function formatKg(kg: number): string {
  return kgFormat.format(Math.round(kg * 10) / 10)
}

export const formatInt = (n: number) => new Intl.NumberFormat('sv-SE').format(Math.round(n))
