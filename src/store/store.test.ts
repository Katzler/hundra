import { beforeEach, describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { todayKey } from '../lib/dates'
import { packagedBase } from '../lib/packaged'
import {
  DATA_KEYS,
  emptyData,
  exportData,
  FAVORITE_LIMIT,
  foodByBarcode,
  mealItemOf,
  migrateData,
  parseImport,
  pickData,
  quickFoods,
  sanitizeData,
  STORE_VERSION,
  useStore,
} from './useStore'

const potatis = FOODS.find((f) => f.id === 'potatis')!
const banan = FOODS.find((f) => f.id === 'banan')!
const day = '2026-10-24'
const per100 = { kcal: 540, measure: 'g' as const, serving: 25, pack: 200 }
const choklad = { name: 'Marabou Mjölkchoklad', emoji: '🍫', ...packagedBase(per100), barcode: '7310511210502', per100 }

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
    s.toggleFavorite('lunch', 'potatis')
    s.saveMeal({ name: 'Frukost', items: [{ foodId: 'banan', name: 'Banan', emoji: '🍌', unit: '1 st', kcalPerUnit: 100, qty: 1 }] })
    s.logWeight(day, 70.4)
    s.toggleExcludedDay('2026-10-20')
    s.setGoal(90)
    s.setCalibration(0.95)
    s.markBackup()
    s.setTrendRange(30)
    s.setShowMacros(true)
    s.setTrackedMacro(2, false)
    s.addCustomFood({ name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcal: 600, macros: [30, 25, 60] })
    s.addCustomFood(choklad)
    const before = pickData(useStore.getState())
    expect(before.entries[0].macrosPerUnit).toBeDefined()
    // Varje fält ska ha ett annat värde än standard, annars testar vi inte att det följer med.
    for (const k of DATA_KEYS) if (k !== 'calibrationDismissedAt' && k !== 'backupSnoozedUntil') expect(before[k], k).not.toEqual(emptyData[k])
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
    expect(d.favoriteGroups.frukost).toEqual(['potatis', 'banan'])
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
    expect(d.favoriteGroups.skrap).toEqual(['grekisk-yoghurt', 'banan'])
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

  it('favoriter följer med i export och försvinner när en egen vara tas bort', () => {
    const s = useStore.getState()
    const egen = s.addCustomFood({ name: 'Mammas lasagne', emoji: '🍝', unit: '1 bit', kcal: 600 })
    s.setFavorites('middag', ['potatis', egen.id])
    s.setFavorites('skrap', [egen.id])
    const text = exportData(useStore.getState())
    s.deleteCustomFood(egen.id)
    expect(useStore.getState().favoriteGroups).toMatchObject({ middag: ['potatis'], skrap: [] })
    s.importData(parseImport(text))
    expect(useStore.getState().favoriteGroups).toMatchObject({ middag: ['potatis', egen.id], skrap: [egen.id] })
  })

  it('samma vara kan ligga i flera kategorier, och en full kategori tar inte emot fler', () => {
    const s = useStore.getState()
    expect(s.toggleFavorite('frukost', 'banan')).toBe(true)
    expect(s.toggleFavorite('skrap', 'banan')).toBe(true)
    expect(useStore.getState().favoriteGroups).toMatchObject({ frukost: ['banan'], lunch: [], middag: [], skrap: ['banan'] })
    expect(s.toggleFavorite('frukost', 'banan')).toBe(false)
    expect(useStore.getState().favoriteGroups.frukost).toEqual([])
    s.setFavorites('lunch', Array.from({ length: FAVORITE_LIMIT }, (_, i) => `vara-${i}`))
    expect(s.toggleFavorite('lunch', 'banan')).toBe(false)
    expect(useStore.getState().favoriteGroups.lunch).toHaveLength(FAVORITE_LIMIT)
  })

  it('version 3 migreras: de tidigare favoriterna hamnar i alla fyra kategorierna', () => {
    const egna = migrateData({ budgetHistory: [], entries: [], quickPicks: ['banan', 'måltid:x'] }, 3)
    expect(egna.favoriteGroups).toEqual({ frukost: ['banan', 'måltid:x'], lunch: ['banan', 'måltid:x'], middag: ['banan', 'måltid:x'], skrap: ['banan', 'måltid:x'] })
    expect('quickPicks' in egna).toBe(false)
    // Automatiska favoriter (null) blir de som visades, så att inget försvinner.
    const auto = migrateData({ budgetHistory: [], entries: [], usage: { potatis: { count: 9, last: Date.now() } }, quickPicks: null }, 3)
    expect(auto.favoriteGroups.middag[0]).toBe('potatis')
    expect(auto.favoriteGroups.middag).toHaveLength(8)
    // Redan migrerad data rörs inte.
    const v4 = { favoriteGroups: { frukost: ['agg'], lunch: [], middag: [], skrap: [] } }
    expect(migrateData(v4, 4).favoriteGroups).toEqual(v4.favoriteGroups)
  })

  it('trasiga favoriter tvättas', () => {
    expect(sanitizeData({ favoriteGroups: { frukost: ['a', 42, 'a'], lunch: 'x', annat: ['b'] } }).data.favoriteGroups).toEqual({
      frukost: ['a'],
      lunch: [],
      middag: [],
      skrap: [],
    })
    expect(sanitizeData({}).data.favoriteGroups).toEqual(emptyData.favoriteGroups)
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
    expect(data.favoriteGroups.lunch).toEqual(['potatis'])
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

  it('näringen kopieras till raden, och följer med när dagen sparas som måltid', () => {
    const s = useStore.getState()
    s.addFood(potatis, day, 2)
    const e = useStore.getState().entries[0]
    expect(e.macrosPerUnit).toEqual(potatis.macros)
    expect(mealItemOf(e)).toMatchObject({ foodId: 'potatis', qty: 2, macrosPerUnit: potatis.macros })
  })

  it('ändrad näring på en egen vara gäller dagens rader, och kan tas bort', () => {
    const s = useStore.getState()
    const today = todayKey()
    const egen = s.addCustomFood({ name: 'Bar', emoji: '🍫', unit: '1 st', kcal: 200 })
    expect('macros' in egen).toBe(false)
    s.addFood(egen, '2026-01-01')
    s.addFood(egen, today)
    s.updateCustomFood(egen.id, { macros: [20, 7, 15] })
    let rows = useStore.getState().entries
    expect(rows.find((e) => e.date === today)?.macrosPerUnit).toEqual([20, 7, 15])
    expect(rows.find((e) => e.date === '2026-01-01')?.macrosPerUnit).toBeUndefined()
    s.updateCustomFood(egen.id, { macros: undefined })
    rows = useStore.getState().entries
    expect(rows.find((e) => e.date === today)?.macrosPerUnit).toBeUndefined()
    expect(useStore.getState().customFoods[0].macros).toBeUndefined()
  })

  it('version 4 läses in oförändrad: näringen är av och gamla rader finns kvar', () => {
    const v4 = {
      profile: { sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 },
      budgetHistory: [{ from: '2026-01-01', kcal: 2759 }],
      entries: [{ id: 'a', date: day, foodId: 'potatis', name: 'Potatis', emoji: '🥔', unit: '1 st medel', kcalPerUnit: 75, qty: 2, at: 1 }],
      favoriteGroups: { frukost: ['potatis'], lunch: [], middag: [], skrap: [] },
      goal: 90,
    }
    const { data, dropped } = sanitizeData(migrateData(v4, 4))
    expect(dropped).toBe(0)
    expect(data.showMacros).toBe(false)
    expect(data.entries).toEqual(v4.entries)
    expect(data.goal).toBe(90)
  })

  it('trasig näring tvättas bort men raden finns kvar', () => {
    const { data, dropped } = sanitizeData({
      entries: [{ id: 'a', date: day, foodId: 'x', name: 'X', kcalPerUnit: 100, qty: 1, macrosPerUnit: [1, 'två', 3] }],
      customFoods: [{ id: 'egen-a', name: 'A', kcal: 100, macros: [-1, 2, 3] }],
      showMacros: 'ja',
    })
    expect(dropped).toBe(0)
    expect('macrosPerUnit' in data.entries[0]).toBe(false)
    expect('macros' in data.customFoods[0]).toBe(false)
    expect(data.showMacros).toBe(false)
  })

  it('exporten har den nya versionen', () => {
    expect(JSON.parse(exportData(pickData(useStore.getState()))).version).toBe(STORE_VERSION)
    expect(STORE_VERSION).toBe(8)
  })

  it('skannade varor behåller streckkod och näringsvärde i lagringen', async () => {
    const s = useStore.getState()
    const food = s.addCustomFood(choklad)
    s.addFood(food, day)
    const saved = pickData(useStore.getState())
    const stored = localStorage.getItem('hundra-v1')!
    useStore.setState({ ...emptyData })
    localStorage.setItem('hundra-v1', stored)
    await useStore.persist.rehydrate()
    expect(pickData(useStore.getState())).toEqual(saved)
    expect(foodByBarcode(useStore.getState().customFoods, '7310511210502')).toMatchObject({ barcode: '7310511210502', per100 })
    expect(JSON.parse(stored).version).toBe(STORE_VERSION)
  })

  it('trasig streckkod och trasigt näringsvärde tvättas bort, varan finns kvar', () => {
    const { data, dropped } = sanitizeData({
      customFoods: [
        { id: 'egen-a', name: 'A', kcal: 100, unit: '100 g', barcode: 'abc', per100: { kcal: 5000, measure: 'g' } },
        { id: 'egen-b', name: 'B', kcal: 100, unit: '100 g', per100: { kcal: 100, measure: 'liter', serving: 30 } },
        { id: 'egen-c', name: 'C', kcal: 135, unit: '1 portion (25 g)', per100: { kcal: 540, measure: 'g', serving: 25, pack: -1 } },
      ],
    })
    expect(dropped).toBe(0)
    expect(data.customFoods[0].barcode).toBeUndefined()
    expect(data.customFoods[0].per100).toBeUndefined()
    expect(data.customFoods[1].per100).toBeUndefined()
    expect(data.customFoods[2].per100).toEqual({ kcal: 540, measure: 'g', serving: 25 })
  })

  it('version 5 migreras till 6 utan att något försvinner', () => {
    const v5 = {
      profile: { sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 },
      budgetHistory: [{ from: '2026-01-01', kcal: 2500 }],
      entries: [{ id: 'a', date: day, at: 1, foodId: 'egen-1', name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcalPerUnit: 600, qty: 1 }],
      customFoods: [{ id: 'egen-1', name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcal: 600, macros: [30, 25, 60], category: 'egna', custom: true }],
      favoriteGroups: { frukost: ['egen-1'], lunch: [], middag: [], skrap: [] },
    }
    const { data } = sanitizeData(migrateData(v5, 5))
    expect(data.entries).toHaveLength(1)
    expect(data.customFoods).toEqual(v5.customFoods)
    expect(data.favoriteGroups.frukost).toEqual(['egen-1'])
    expect(JSON.parse(exportData(data)).version).toBe(STORE_VERSION)
  })

  it('ändrad skannad vara: dagens rader behåller sitt mått, tidigare dagar ligger fast', () => {
    const s = useStore.getState()
    const food = s.addCustomFood(choklad)
    const today = todayKey()
    s.addFood(food, today)
    s.addFood({ ...food, unit: '100 g', kcal: 540 }, today)
    s.addFood(food, '2026-01-01')
    s.updateCustomFood(food.id, { name: 'Mjölkchoklad', per100: { ...per100, kcal: 500 }, ...packagedBase({ ...per100, kcal: 500 }) })
    const rows = useStore.getState().entries
    expect(rows.find((e) => e.date === today && e.unit === '100 g')).toMatchObject({ name: 'Mjölkchoklad', kcalPerUnit: 500 })
    expect(rows.find((e) => e.date === today && e.unit === '1 portion (25 g)')?.kcalPerUnit).toBe(125)
    expect(rows.find((e) => e.date === '2026-01-01')).toMatchObject({ name: 'Marabou Mjölkchoklad', kcalPerUnit: 135 })
  })

  it('man kan följa bara protein, men aldrig ingenting', () => {
    const s = useStore.getState()
    expect(useStore.getState().trackedMacros).toEqual([true, true, true])
    s.setTrackedMacro(1, false)
    s.setTrackedMacro(2, false)
    expect(useStore.getState().trackedMacros).toEqual([true, false, false])
    s.setTrackedMacro(0, false)
    expect(useStore.getState().trackedMacros).toEqual([true, false, false])
  })

  it('version 6 läses in med alla tre ringarna, och trasiga val tvättas', () => {
    expect(sanitizeData(migrateData({ showMacros: true }, 6)).data.trackedMacros).toEqual([true, true, true])
    expect(sanitizeData({ trackedMacros: [false, false, false] }).data.trackedMacros).toEqual([true, true, true])
    expect(sanitizeData({ trackedMacros: [true, 'nej', false] }).data.trackedMacros).toEqual([true, true, true])
    expect(sanitizeData({ trackedMacros: [true, false, false] }).data.trackedMacros).toEqual([true, false, false])
  })

  it('version 7 migreras till 8: skannade varor får naturliga mått, loggen ligger fast', () => {
    const bregott = { id: 'egen-b', name: 'Bregott Normalsaltat', emoji: '🥛', unit: '100 g', kcal: 720, macros: [0.5, 80, 0.5], per100: { kcal: 720, measure: 'g', pack: 600 }, barcode: '7310865071736' }
    const okand = { id: 'egen-o', name: 'Konstig vara', emoji: '🍽️', unit: '100 g', kcal: 300, per100: { kcal: 300, measure: 'g' } }
    const entry = { id: 'a', date: day, at: 1, foodId: 'egen-b', name: 'Bregott Normalsaltat', emoji: '🥛', unit: '100 g', kcalPerUnit: 720, qty: 0.5 }
    const v7 = {
      customFoods: [bregott, okand],
      entries: [entry],
      lastChoices: { 'egen-b': { picks: { enhet: 'hundra' }, qty: 1 }, 'egen-o': { picks: { enhet: 'hundra' }, qty: 1 }, potatis: { picks: { storlek: 'stor' }, qty: 2 } },
    }
    const { data } = sanitizeData(migrateData(v7, 7))
    expect(data.customFoods[0]).toMatchObject({ unit: '1 klick', kcal: 57.6, macros: [0, 6.4, 0], per100: { kind: 'smor', pack: 600 }, barcode: '7310865071736' })
    expect(data.customFoods[1]).toMatchObject({ unit: '100 g', kcal: 300 })
    expect(data.customFoods[1].per100?.kind).toBeUndefined()
    expect(Object.keys(data.lastChoices).sort()).toEqual(['egen-o', 'potatis'])
    expect(data.entries).toEqual([entry])
  })

  it('import avvisar fel filer', () => {
    expect(() => parseImport('inte json')).toThrow()
    expect(() => parseImport('{"app":"annat"}')).toThrow()
  })
})
