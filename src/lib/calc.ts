import { addDays, fromKey, lastNDays, type DateKey } from './dates'

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

export type DayStat = {
  date: DateKey
  points: number | null
  /** Dagen är loggad men användaren har valt att inte räkna med den i snittet. */
  excluded?: boolean
}

export type Average = {
  /** null om inga dagar är loggade. */
  avg: number | null
  loggedDays: number
  totalDays: number
  days: DayStat[]
}

/** Snitt över de n senaste dagarna. Dagar utan något loggat, och dagar man valt bort, räknas inte med. */
export function rollingAverage(
  entries: Entry[],
  history: BudgetPeriod[],
  end: DateKey,
  n: number,
  excluded: readonly DateKey[] = [],
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
    // En dag med bara vatten eller kaffe svart räknas inte som en loggad dag.
    const points = !kcal || kcal <= 0 ? null : toPoints(kcal, budgetFor(date, history))
    return excluded.includes(date) && points !== null ? { date, points, excluded: true } : { date, points }
  })
  const logged = days.filter((d) => d.points !== null && !d.excluded) as { date: DateKey; points: number }[]
  const avg = logged.length ? logged.reduce((s, d) => s + d.points, 0) / logged.length : null
  return { avg, loggedDays: logged.length, totalDays: n, days }
}

/** Så många hela loggade dagar behövs innan appen vågar visa en prognos i kg. */
export const MIN_FORECAST_DAYS = 4

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

/** "−0,3 kg i veckan", eller "mindre än 0,1 kg i veckan" när förändringen avrundas bort. */
export function formatKgPerWeek(kg: number): string {
  if (Math.abs(kg) < 0.05) return 'mindre än 0,1 kg i veckan'
  return `ungefär ${formatKg(kg)} kg i veckan`
}

export const formatInt = (n: number) => new Intl.NumberFormat('sv-SE').format(Math.round(n))

/** "½", "1½", "2" eller "0,3" – antal portioner som det skrivs i en meny. */
export function formatQty(qty: number): string {
  const whole = Math.floor(qty)
  const frac = qty - whole
  if (Math.abs(frac - 0.5) < 0.01) return `${whole || ''}½`
  if (frac < 0.01) return String(whole)
  return String(Math.round(qty * 100) / 100).replace('.', ',')
}

/** Tid på dygnet: 0 morgon, 1 lunch, 2 eftermiddag, 3 kväll. Används för att föreslå rätt snabbval. */
export function daySlot(time: number | Date): 0 | 1 | 2 | 3 {
  const h = new Date(time).getHours()
  if (h >= 5 && h < 10) return 0
  if (h >= 10 && h < 14) return 1
  if (h >= 14 && h < 17) return 2
  return 3
}

// ───────── Vikt ─────────

export type Weight = { date: DateKey; kg: number }
export type WeightPoint = { date: DateKey; kg: number | null; trend: number }

/**
 * Utjämnad vikt (exponentiellt glidande medel, ca 10 % per dag, som i The Hacker's Diet).
 * Dagar utan vägning fylls med en rak linje mellan vägningarna, så att trenden inte hoppar.
 */
export function weightTrend(weights: Weight[], end?: DateKey): WeightPoint[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return []
  const last = end && end > sorted[sorted.length - 1].date ? end : sorted[sorted.length - 1].date
  const byDate = new Map(sorted.map((w) => [w.date, w.kg]))
  const out: WeightPoint[] = []
  let trend = sorted[0].kg
  let prev = sorted[0]
  let nextIdx = 1
  for (let date = sorted[0].date; date <= last; date = addDays(date, 1)) {
    const measured = byDate.get(date) ?? null
    let kg: number
    if (measured !== null) {
      kg = measured
      prev = { date, kg }
      while (nextIdx < sorted.length && sorted[nextIdx].date <= date) nextIdx++
    } else if (nextIdx < sorted.length) {
      const next = sorted[nextIdx]
      const span = daysBetween(prev.date, next.date)
      kg = prev.kg + ((next.kg - prev.kg) * daysBetween(prev.date, date)) / span
    } else {
      kg = prev.kg
    }
    trend = trend + 0.1 * (kg - trend)
    out.push({ date, kg: measured, trend })
  }
  return out
}

export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000)
}

// ───────── Självkalibrering ─────────

export type Calibration = {
  /** Uppskattad verklig förbrukning per dag i kcal. */
  expenditure: number
  /** Föreslagen ny kalibreringsfaktor (högst ±5 % ändring per gång, totalt 0,8–1,2). */
  factor: number
}

/** Antal dagar som ett kalibreringsförslag bygger på. */
export const CALIBRATION_DAYS = 28

/**
 * Jämför det man loggat med hur vikten faktiskt rört sig de senaste 4 veckorna. Om vikten står
 * still på ett snitt av 92 betyder 100 poäng i själva verket mindre än appen trodde. Ger null när
 * underlaget är för tunt: minst 70 % loggade dagar och vägningar i både början och slutet.
 */
export function estimateCalibration(input: {
  entries: Entry[]
  weights: Weight[]
  excluded: readonly DateKey[]
  today: DateKey
  currentBudget: number
  currentFactor: number
  firstDay: DateKey | null
}): Calibration | null {
  const { entries, weights, excluded, today, currentBudget, currentFactor, firstDay } = input
  const end = addDays(today, -1)
  const start = addDays(end, -(CALIBRATION_DAYS - 1))
  // De första två veckorna går mest vatten, så de räknas inte.
  if (!firstDay || daysBetween(firstDay, start) < 14) return null
  const kcalByDay = new Map<DateKey, number>()
  for (const e of entries) {
    if (e.date < start || e.date > end || excluded.includes(e.date)) continue
    kcalByDay.set(e.date, (kcalByDay.get(e.date) ?? 0) + entryKcal(e))
  }
  const loggedKcal = [...kcalByDay.values()].filter((k) => k > 0)
  if (loggedKcal.length < CALIBRATION_DAYS * 0.7) return null
  const inWindow = weights.filter((w) => w.date >= start && w.date <= end)
  const hasStart = inWindow.some((w) => w.date <= addDays(start, 6))
  const hasEnd = inWindow.some((w) => w.date >= addDays(end, -6))
  if (!hasStart || !hasEnd) return null
  const trend = weightTrend(weights, end)
  const at = (d: DateKey) => trend.find((p) => p.date === d)?.trend
  const t0 = at(start)
  const t1 = at(end)
  if (t0 === undefined || t1 === undefined) return null
  const intake = loggedKcal.reduce((s, k) => s + k, 0) / loggedKcal.length
  const expenditure = intake - ((t1 - t0) * KCAL_PER_KG) / CALIBRATION_DAYS
  const ratio = expenditure / currentBudget
  if (Math.abs(ratio - 1) < 0.03) return null
  const stepped = Math.min(Math.max(currentFactor * ratio, currentFactor * 0.95), currentFactor * 1.05)
  const factor = Math.round(Math.min(Math.max(stepped, 0.8), 1.2) * 100) / 100
  if (factor === currentFactor) return null
  return { expenditure: Math.round(expenditure), factor }
}

// ───────── Mönster ─────────

/** Snitt per veckodag, måndag först. null för veckodagar utan loggade dagar. */
export function weekdayAverages(days: DayStat[]): (number | null)[] {
  const sums = Array(7).fill(0)
  const counts = Array(7).fill(0)
  for (const d of days) {
    if (d.points === null || d.excluded) continue
    const i = (fromKey(d.date).getDay() + 6) % 7
    sums[i] += d.points
    counts[i]++
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : null))
}

export type Source = { foodId: string; name: string; emoji: string; share: number }

/** Vilka varor som gav flest poäng under perioden, som andel av allt man ätit. */
export function topSources(entries: Entry[], start: DateKey, end: DateKey, limit = 3): Source[] {
  const byFood = new Map<string, { kcal: number; name: string; emoji: string }>()
  let total = 0
  for (const e of entries) {
    if (e.date < start || e.date > end) continue
    const kcal = entryKcal(e)
    total += kcal
    const cur = byFood.get(e.foodId) ?? { kcal: 0, name: e.name, emoji: e.emoji }
    cur.kcal += kcal
    byFood.set(e.foodId, cur)
  }
  if (total <= 0) return []
  return [...byFood.entries()]
    .map(([foodId, v]) => ({ foodId, name: v.name, emoji: v.emoji, share: v.kcal / total }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit)
}
