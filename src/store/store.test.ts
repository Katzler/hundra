import { beforeEach, describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { exportData, parseImport, useStore } from './useStore'

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
    s.addFood(egen, day)
    s.updateCustomFood(egen.id, { kcal: 900 })
    expect(useStore.getState().entries[0].kcalPerUnit).toBe(600)
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

  it('import avvisar fel filer', () => {
    expect(() => parseImport('inte json')).toThrow()
    expect(() => parseImport('{"app":"annat"}')).toThrow()
  })
})
