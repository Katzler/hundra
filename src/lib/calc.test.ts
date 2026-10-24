import { describe, expect, it } from 'vitest'
import {
  bmr,
  budgetFor,
  dayPoints,
  forecastKgPerWeek,
  formatKg,
  formatKgPerWeek,
  formatQty,
  daySlot,
  weightTrend,
  estimateCalibration,
  weekdayAverages,
  topSources,
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

describe('portioner och tid på dygnet', () => {
  it('skriver halvor som i en meny', () => {
    expect(formatQty(0.5)).toBe('½')
    expect(formatQty(1.5)).toBe('1½')
    expect(formatQty(3)).toBe('3')
  })

  it('delar in dygnet i fyra delar', () => {
    expect(daySlot(new Date(2026, 9, 24, 7))).toBe(0)
    expect(daySlot(new Date(2026, 9, 24, 12))).toBe(1)
    expect(daySlot(new Date(2026, 9, 24, 15))).toBe(2)
    expect(daySlot(new Date(2026, 9, 24, 20))).toBe(3)
    expect(daySlot(new Date(2026, 9, 24, 2))).toBe(3)
  })
})

describe('uteslutna dagar', () => {
  it('räknas inte i snittet men syns i diagrammet', () => {
    const end = '2026-10-24'
    const history = [{ from: '2026-01-01', kcal: 2000 }]
    const r = rollingAverage([entry(end, 2000), entry(addDays(end, -1), 400)], history, end, 7, [addDays(end, -1)])
    expect(r.avg).toBeCloseTo(100)
    expect(r.loggedDays).toBe(1)
    expect(r.days[5]).toMatchObject({ points: 20, excluded: true })
  })
})

describe('vikttrend', () => {
  it('jämnar ut dagliga hopp och fyller luckor', () => {
    const t = weightTrend(
      [
        { date: '2026-10-01', kg: 80 },
        { date: '2026-10-11', kg: 79 },
      ],
      '2026-10-12',
    )
    expect(t).toHaveLength(12)
    expect(t[5].kg).toBeNull()
    expect(t[11].trend).toBeLessThan(80)
    expect(t[11].trend).toBeGreaterThan(79)
  })
})

describe('självkalibrering', () => {
  const today = '2026-10-24'
  const days = (n: number, kcal: number) => Array.from({ length: n }, (_, i) => entry(addDays(today, -1 - i), kcal))

  it('föreslår lägre budget när vikten står still på ett snitt under 100', () => {
    // Äter 2 300 kcal mot en budget på 2 500, men vikten står still → förbrukningen är ca 2 300.
    const weights = Array.from({ length: 9 }, (_, i) => ({ date: addDays(today, -1 - i * 5), kg: 80 }))
    const c = estimateCalibration({
      entries: days(28, 2300),
      weights,
      excluded: [],
      today,
      currentBudget: 2500,
      currentFactor: 1,
      firstDay: addDays(today, -60),
    })
    expect(c).not.toBeNull()
    expect(c!.expenditure).toBe(2300)
    expect(c!.factor).toBe(0.95) // högst 5 % per gång
  })

  it('ger inget förslag på för tunt underlag', () => {
    const c = estimateCalibration({
      entries: days(10, 2300),
      weights: [{ date: addDays(today, -2), kg: 80 }],
      excluded: [],
      today,
      currentBudget: 2500,
      currentFactor: 1,
      firstDay: addDays(today, -60),
    })
    expect(c).toBeNull()
  })
})

describe('mönster', () => {
  it('räknar snitt per veckodag med måndag först', () => {
    const avgs = weekdayAverages([
      { date: '2026-10-19', points: 90 }, // måndag
      { date: '2026-10-24', points: 130 }, // lördag
      { date: '2026-10-25', points: null },
    ])
    expect(avgs[0]).toBe(90)
    expect(avgs[5]).toBe(130)
    expect(avgs[6]).toBeNull()
  })

  it('visar vilka varor som gav flest poäng', () => {
    const e1 = { ...entry('2026-10-20', 1000), foodId: 'pizza', name: 'Pizza' }
    const e2 = { ...entry('2026-10-21', 250), foodId: 'ol', name: 'Öl' }
    const top = topSources([e1, e2], '2026-10-01', '2026-10-31')
    expect(top[0]).toMatchObject({ foodId: 'pizza', share: 0.8 })
  })
})
