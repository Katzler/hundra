import { describe, expect, it } from 'vitest'
import {
  bmr,
  budgetFor,
  dayPoints,
  forecastKgPerWeek,
  formatKg,
  formatKgPerWeek,
  formatPoints,
  rollingAverage,
  tdee,
  toKcal,
  toPoints,
  withBudget,
  type Entry,
  type Profile,
} from './calc'
import { addDays, lastNDays, resolveDay } from './dates'

const man: Profile = { sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 }
const kvinna: Profile = { sex: 'kvinna', age: 30, heightCm: 165, weightKg: 60, activity: 2 }

let seq = 0
const entry = (date: string, kcalPerUnit: number, qty = 1): Entry => ({
  id: String(seq++),
  date,
  foodId: 'x',
  name: 'x',
  emoji: '',
  unit: '',
  kcalPerUnit,
  qty,
  at: 0,
})

describe('energibehov', () => {
  it('räknar BMR enligt Mifflin-St Jeor', () => {
    expect(bmr(man)).toBe(1780)
    expect(bmr(kvinna)).toBeCloseTo(1320.25)
  })

  it('räknar TDEE med aktivitetsfaktor', () => {
    expect(tdee(man)).toBe(2759)
    expect(tdee(kvinna)).toBe(1815)
  })
})

describe('poäng', () => {
  it('100 poäng är hela budgeten', () => {
    expect(toPoints(2759, 2759)).toBe(100)
  })

  it('samma potatis kostar fler poäng för en mindre person', () => {
    const potatis = 75
    expect(Math.round(toPoints(potatis, tdee(man)))).toBe(3)
    expect(Math.round(toPoints(potatis, tdee(kvinna)))).toBe(4)
  })

  it('poäng och kcal går fram och tillbaka', () => {
    expect(toPoints(toKcal(7, 2400), 2400)).toBeCloseTo(7)
  })

  it('visar heltal och "<1" för nästan gratis saker', () => {
    expect(formatPoints(0)).toBe('0')
    expect(formatPoints(0.2)).toBe('<1')
    expect(formatPoints(2.5)).toBe('3')
    expect(formatPoints(24.4)).toBe('24')
  })
})

describe('budgethistorik', () => {
  const history = [
    { from: '2026-01-01', kcal: 2500 },
    { from: '2026-03-01', kcal: 2400 },
  ]

  it('använder den period som gällde dagen', () => {
    expect(budgetFor('2026-02-15', history)).toBe(2500)
    expect(budgetFor('2026-03-01', history)).toBe(2400)
    expect(budgetFor('2026-10-01', history)).toBe(2400)
  })

  it('dagar före första perioden använder den första', () => {
    expect(budgetFor('2025-12-01', history)).toBe(2500)
  })

  it('gamla dagar ändras inte när vikten ändras', () => {
    const entries = [entry('2026-02-15', 1250)]
    const before = dayPoints(entries, '2026-02-15', history)
    const after = dayPoints(entries, '2026-02-15', withBudget(history, '2026-10-24', 2200))
    expect(before).toBe(50)
    expect(after).toBe(50)
  })

  it('samma dag skrivs över i stället för att stapla perioder', () => {
    const h = withBudget(withBudget(history, '2026-10-24', 2300), '2026-10-24', 2200)
    expect(h).toEqual([...history, { from: '2026-10-24', kcal: 2200 }])
  })

  it('lägger inte till en period om budgeten är oförändrad', () => {
    expect(withBudget(history, '2026-10-24', 2400)).toEqual(history)
  })
})

describe('snitt över tid', () => {
  const end = '2026-10-24'
  const history = [{ from: '2026-01-01', kcal: 2000 }]

  it('hoppar över dagar utan loggning', () => {
    const entries = [entry(end, 1800), entry(addDays(end, -2), 2200)]
    const r = rollingAverage(entries, history, end, 7)
    expect(r.loggedDays).toBe(2)
    expect(r.totalDays).toBe(7)
    expect(r.avg).toBeCloseTo(100)
    expect(r.days).toHaveLength(7)
    expect(r.days[6]).toEqual({ date: end, points: 90 })
    expect(r.days[5].points).toBeNull()
  })

  it('summerar flera rader och antal samma dag', () => {
    const entries = [entry(end, 500, 2), entry(end, 200, 3)]
    expect(rollingAverage(entries, history, end, 1).avg).toBeCloseTo(80)
  })

  it('ignorerar dagar utanför intervallet', () => {
    const entries = [entry(addDays(end, -7), 4000), entry(addDays(end, 1), 4000), entry(end, 1000)]
    expect(rollingAverage(entries, history, end, 7).avg).toBeCloseTo(50)
  })

  it('räknar inte dagar med 0 kcal som loggade', () => {
    const entries = [entry(end, 1000), entry(addDays(end, -1), 0)]
    const r = rollingAverage(entries, history, end, 7)
    expect(r.loggedDays).toBe(1)
    expect(r.avg).toBeCloseTo(50)
  })

  it('ger null när inget är loggat', () => {
    expect(rollingAverage([], history, end, 30).avg).toBeNull()
  })

  it('dagarna kommer i ordning, äldst först', () => {
    expect(lastNDays(end, 3)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24'])
  })
})

describe('prognos', () => {
  it('under 100 i snitt ger viktnedgång', () => {
    // 10 % under 2 750 kcal = 275 kcal/dag ≈ 0,25 kg/vecka
    expect(forecastKgPerWeek(90, 2750)).toBeCloseTo(-0.25, 2)
  })

  it('över 100 ger viktuppgång och 100 ger ingen förändring', () => {
    expect(forecastKgPerWeek(110, 2750)).toBeGreaterThan(0)
    expect(forecastKgPerWeek(100, 2750)).toBe(0)
  })

  it('säger "mindre än 0,1 kg" i stället för 0,0', () => {
    expect(formatKgPerWeek(0.02)).toBe('mindre än 0,1 kg i veckan')
    expect(formatKgPerWeek(-0.26)).toMatch(/^ungefär [−-]0,3 kg i veckan$/)
  })

  it('formaterar med svenskt decimaltecken och tecken', () => {
    expect(formatKg(-0.26)).toMatch(/^[−-]0,3$/)
    expect(formatKg(0.21)).toBe('+0,2')
  })
})

describe('vald dag', () => {
  it('gäller samma dag', () => {
    expect(resolveDay({ date: '2026-10-22', on: '2026-10-24' }, '2026-10-24')).toBe('2026-10-22')
  })

  it('nästa morgon börjar appen på idag igen', () => {
    expect(resolveDay({ date: '2026-10-23', on: '2026-10-24' }, '2026-10-25')).toBe('2026-10-25')
  })

  it('idag eller framtid betyder idag', () => {
    expect(resolveDay(null, '2026-10-24')).toBe('2026-10-24')
    expect(resolveDay({ date: '2026-10-24', on: '2026-10-24' }, '2026-10-24')).toBe('2026-10-24')
  })
})
