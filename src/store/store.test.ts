import { beforeEach, describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { todayKey } from '../lib/dates'
import { DATA_KEYS, emptyData, exportData, migrateData, parseImport, pickData, quickFoods, sanitizeData, useStore } from './useStore'

const potatis = FOODS.find((f) => f.id === 'potatis')!
const banan = FOODS.find((f) => f.id === 'banan')!
const day = '2026-10-24'

describe('store', () => {
  beforeEach(() => useStore.getState().resetAll())

  it('slår ihop samma vara samma dag, som en kundvagn', () => {
    const { addFood } = useStore.getState()
    addFood(potatis, day)
    addFood(potatis, day)
    addFood(potatis, day)
    addFood(banan, day)
    addFood(potatis, '2026-10-23')
    const entries = useStore.getState().entries
    expect(entries).toHaveLength(3)
    expect(entries.find((e) => e.foodId === 'potatis' && e.date === day)?.qty).toBe(3)
    expect(useStore.getState().usage.potatis.count).toBe(4)
  })

  it('tar bort raden när antalet blir 0', () => {
    const s = useStore.getState()
    s.addFood(banan, day)
    const id = useStore.getState().entries[0].id
    s.setQty(id, 2)
    expect(useStore.getState().entries[0].qty).toBe(2)
    s.setQty(id, 0)
    expect(useStore.getState().entries).toHaveLength(0)
  })

  it('sparar en kopia av kcal så att ändrade egna varor inte skriver om historiken', () => {
    const s = useStore.getState()
    const egen = s.addCustomFood({ name: 'Mammas lasagne', emoji: '🍝', unit: '1 bit', kcal: 600 })
    s.addFood(egen, '2026-01-02')
    s.updateCustomFood(egen.id, { kcal: 900 })
    expect(useStore.getState().entries[0].kcalPerUnit).toBe(600)
  })

  it('ändrad egen vara gäller dagens rader men inte tidigare dagar', () => {
    const s = useStore.getState()
    const egen = s.addCustomFood({ name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcal: 600 })
    const today = todayKey()
    s.addFood(egen, '2026-01-01')
    s.addFood(egen, today)
    s.updateCustomFood(egen.id, { name: 'Mammas lasagne', kcal: 900 })
    const rows = useStore.getState().entries
    expect(rows.find((e) => e.date === '2026-01-01')?.kcalPerUnit).toBe(600)
    expect(rows.find((e) => e.date === today)).toMatchObject({ kcalPerUnit: 900, name: 'Mammas lasagne' })
  })

  it('ångra borttagning lägger tillbaka raden', () => {
    const s = useStore.getState()
    s.addFood(banan, day)
    const removed = s.removeEntry(useStore.getState().entries[0].id)!
    expect(useStore.getState().entries).toHaveLength(0)
    s.restoreEntry(removed)
    expect(useStore.getState().entries).toEqual([removed])
  })

  it('profil ger en budgetperiod', () => {
    useStore.getState().setProfile({ sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 })
    expect(useStore.getState().budgetHistory.at(-1)?.kcal).toBe(2759)
  })

  it('export och import ger tillbaka exakt samma data – alla fält', () => {
    const s = useStore.getState()
    s.setProfile({ sex: 'kvinna', age: 40, heightCm: 170, weightKg: 70, activity: 2 })
    s.addFood(potatis, day, 2, { storlek: 'stor' })
    s.toggleQuickPick('potatis')
    s.saveMeal({ name: 'Frukost', items: [{ foodId: 'banan', name: 'Banan', emoji: '🍌', unit: '1 st', kcalPerUnit: 100, qty: 1 }] })
    s.logWeight(day, 70.4)
    s.toggleExcludedDay('2026-10-20')
    s.setGoal(90)
    s.setCalibration(0.95)
    s.markBackup()
    s.setTrendRange(30)
    const before = pickData(useStore.getState())
    // Varje fält ska ha ett annat värde än standard, annars testar vi inte att det följer med.
    for (const k of DATA_KEYS) if (k !== 'calibrationDismissedAt' && k !== 'backupSnoozedUntil' && k !== 'customFoods') expect(before[k], k).not.toEqual(emptyData[k])
    const text = exportData(before)
    s.resetAll()
    const { dropped, ...imported } = parseImport(text)
    expect(dropped).toBe(0)
    s.importData(imported)
    expect(pickData(useStore.getState())).toEqual(before)
  })

  it('version 1 migreras: favoriter blir snabbval och dygnsdelar räknas fram', () => {
    const v1 = {
      profile: null,
      budgetHistory: [],
      entries: [{ id: 'a', date: '2026-10-01', foodId: 'potatis', name: 'Potatis', emoji: '', unit: '', kcalPerUnit: 75, qty: 2, at: new Date(2026, 9, 1, 12).getTime() }],
      customFoods: [],
      favorites: ['banan'],
      usage: { potatis: { count: 2, last: 1 } },
      quickPicks: ['potatis'],
    }
    const d = migrateData(v1, 1)
    expect(d.quickPicks).toEqual(['potatis', 'banan'])
    expect(d.usage.potatis.slots).toEqual([0, 2, 0, 0])
    expect('favorites' in d).toBe(false)
  })

  it('version 2 migreras: grekisk yoghurt i fetthalter blir en vara, senaste fetthalten blir förval', () => {
    const v2 = {
      budgetHistory: [],
      entries: [{ id: 'a', date: '2026-10-01', foodId: 'grekisk-yoghurt-2', name: 'Grekisk yoghurt 2 %', emoji: '', unit: '', kcalPerUnit: 140, qty: 1, at: 5 }],
      usage: {
        'grekisk-yoghurt': { count: 1, last: 2, slots: [1, 0, 0, 0] },
        'grekisk-yoghurt-2': { count: 3, last: 9, slots: [3, 0, 0, 0] },
        'grekisk-yoghurt-0': { count: 1, last: 4 },
      },
      quickPicks: ['grekisk-yoghurt-2', 'grekisk-yoghurt', 'banan'],
    }
    const d = migrateData(v2, 2)
    expect(d.usage['grekisk-yoghurt']).toEqual({ count: 5, last: 9, slots: [4, 0, 0, 0] })
    expect(d.usage['grekisk-yoghurt-2']).toBeUndefined()
    expect(d.quickPicks).toEqual(['grekisk-yoghurt', 'banan'])
    expect(d.lastChoices['grekisk-yoghurt'].picks).toEqual({ fetthalt: '2 %' })
    // Loggen rörs inte.
    expect(sanitizeData(d).data.entries[0].foodId).toBe('grekisk-yoghurt-2')
  })

  it('samma vara med olika val blir olika rader, samma val slås ihop', () => {
    const s = useStore.getState()
    s.addFood(potatis, day)
    s.addFood({ ...potatis, name: 'Potatis, stor', kcal: 101 }, day, 1, { storlek: 'stor' })
    s.addFood({ ...potatis, name: 'Potatis, stor', kcal: 101 }, day, 1, { storlek: 'stor' })
    const rows = useStore.getState().entries
    expect(rows.map((e) => [e.name, e.qty])).toEqual([['Potatis', 1], ['Potatis, stor', 2]])
    expect(useStore.getState().lastChoices.potatis).toEqual({ picks: { storlek: 'stor' }, qty: 1 })
  })

  it('ändrat antal följer med i användningen, så att + följt av − inte flyttar upp varan', () => {
    const s = useStore.getState()
    s.addFood(banan, day)
    const id = useStore.getState().entries[0].id
    s.setQty(id, 0)
    expect(useStore.getState().usage.banan.count).toBe(0)
  })

  it('en måltid läggs till med ett tryck och slås ihop med det som redan finns', () => {
    const s = useStore.getState()
    s.addFood(banan, day)
    const meal = s.saveMeal({
      name: 'Frukost',
      items: [
        { foodId: 'banan', name: 'Banan', emoji: '🍌', unit: '1 st', kcalPerUnit: 100, qty: 1 },
        { foodId: 'kaffe-mjolk', name: 'Kaffe', emoji: '☕', unit: '1 kopp', kcalPerUnit: 30, qty: 2 },
      ],
    })
    s.logMeal(meal.id, day)
    const rows = useStore.getState().entries
    expect(rows.find((e) => e.foodId === 'banan')?.qty).toBe(2)
    expect(rows.find((e) => e.foodId === 'kaffe-mjolk')?.qty).toBe(2)
  })

  it('rätta från början gör att även gamla dagar räknas mot de nya uppgifterna', () => {
    const s = useStore.getState()
    s.importData({ ...emptyData, budgetHistory: [{ from: '2026-01-01', kcal: 3000 }] })
    s.setProfile({ sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 }, { fromStart: true })
    expect(useStore.getState().budgetHistory).toEqual([{ from: '2026-01-01', kcal: 2759 }])
  })

  it('egna snabbval följer med i export och försvinner när en egen vara tas bort', () => {
    const s = useStore.getState()
    const egen = s.addCustomFood({ name: 'Mammas lasagne', emoji: '🍝', unit: '1 bit', kcal: 600 })
    s.setQuickPicks(['potatis', egen.id])
    const text = exportData(useStore.getState())
    s.deleteCustomFood(egen.id)
    expect(useStore.getState().quickPicks).toEqual(['potatis'])
    s.importData(parseImport(text))
    expect(useStore.getState().quickPicks).toEqual(['potatis', egen.id])
  })

  it('snabbval är automatiska tills man valt egna', () => {
    const foods = [...useStore.getState().customFoods, ...FOODS]
    expect(quickFoods(foods, {}, null).map((f) => f.id)).toContain('kaffe-mjolk')
    expect(quickFoods(foods, {}, ['banan', 'finns-inte', 'potatis']).map((f) => f.id)).toEqual(['banan', 'potatis'])
  })

  it('import tar bort trasiga rader i stället för att krascha', () => {
    const file = JSON.stringify({
      app: 'hundra',
      data: {
        profile: { sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 },
        budgetHistory: [{ from: '2026-01-01', kcal: 2500 }, { from: 'igår', kcal: 'mycket' }],
        entries: [
          { id: 'a', date: '2026-01-02', foodId: 'potatis', name: 'Potatis', kcalPerUnit: 75, qty: 2, at: 1 },
          { id: 'b', date: '2026-01-02', foodId: 'x', name: 'Trasig', kcalPerUnit: 'NaN', qty: 1 },
          null,
        ],
        quickPicks: ['potatis', 42],
      },
    })
    const data = parseImport(file)
    expect(data.entries.map((e) => e.id)).toEqual(['a'])
    expect(data.budgetHistory).toEqual([{ from: '2026-01-01', kcal: 2500 }])
    expect(data.quickPicks).toEqual(['potatis'])
    expect(data.dropped).toBe(3)
  })

  it('trasig data i lagringen ger tomt läge, ingen krasch', () => {
    expect(sanitizeData('skräp').data.entries).toEqual([])
    expect(sanitizeData({ profile: { sex: 'x' } }).data.profile).toBeNull()
  })

  it('allt som ändras sparas i lagringen och läses in igen', async () => {
    const s = useStore.getState()
    s.setProfile({ sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 })
    s.addFood(potatis, day, 3)
    s.logWeight(day, 80.2)
    s.setGoal(90)
    const saved = pickData(useStore.getState())
    const stored = localStorage.getItem('hundra-v1')!
    useStore.setState({ ...emptyData }) // som en ny start av appen…
    localStorage.setItem('hundra-v1', stored) // …med det som låg sparat på telefonen
    await useStore.persist.rehydrate()
    expect(pickData(useStore.getState())).toEqual(saved)
  })

  it('import avvisar fel filer', () => {
    expect(() => parseImport('inte json')).toThrow()
    expect(() => parseImport('{"app":"annat"}')).toThrow()
  })
})
