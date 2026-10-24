import { beforeEach, describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { todayKey } from '../lib/dates'
import { exportData, parseImport, quickFoods, sanitizeData, useStore } from './useStore'

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

  it('export och import ger tillbaka samma data', () => {
    const s = useStore.getState()
    s.setProfile({ sex: 'kvinna', age: 40, heightCm: 170, weightKg: 70, activity: 2 })
    s.addFood(potatis, day, 2)
    s.toggleFavorite('potatis')
    const before = useStore.getState()
    const text = exportData(before)
    s.resetAll()
    s.importData(parseImport(text))
    const after = useStore.getState()
    expect(after.entries).toEqual(before.entries)
    expect(after.profile).toEqual(before.profile)
    expect(after.favorites).toEqual(['potatis'])
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

  it('import avvisar fel filer', () => {
    expect(() => parseImport('inte json')).toThrow()
    expect(() => parseImport('{"app":"annat"}')).toThrow()
  })
})
