import { expect, it, vi } from 'vitest'

// Det här är exakt det som händer när appen startar: data finns redan sparad innan koden laddas.
it('sparad data läses in automatiskt när appen startar', async () => {
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  })
  mem.set(
    'hundra-v1',
    JSON.stringify({
      version: 1,
      state: {
        profile: { sex: 'man', age: 30, heightCm: 180, weightKg: 80, activity: 3 },
        budgetHistory: [{ from: '2026-01-01', kcal: 2759 }],
        entries: [{ id: 'a', date: '2026-10-24', foodId: 'banan', name: 'Banan', emoji: '🍌', unit: '1 st', kcalPerUnit: 100, qty: 1, at: 1 }],
        customFoods: [],
        favorites: [],
        usage: {},
        quickPicks: null,
      },
    }),
  )
  vi.resetModules()
  const { useStore } = await import('./useStore')
  expect(useStore.persist.hasHydrated()).toBe(true)
  expect(useStore.getState().profile?.weightKg).toBe(80)
  expect(useStore.getState().entries).toHaveLength(1)
  vi.unstubAllGlobals()
})

// Telefonen har data från version 4 när den nya versionen startar första gången.
it('data från version 4 läses in, och näringen är av', async () => {
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  })
  mem.set(
    'hundra-v1',
    JSON.stringify({
      version: 4,
      state: {
        profile: { sex: 'kvinna', age: 40, heightCm: 168, weightKg: 70, activity: 2 },
        budgetHistory: [{ from: '2026-01-01', kcal: 2100 }],
        entries: [{ id: 'a', date: '2026-10-24', foodId: 'banan', name: 'Banan', emoji: '🍌', unit: '1 st', kcalPerUnit: 100, qty: 1, at: 1 }],
        customFoods: [{ id: 'egen-a', name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcal: 600, category: 'egna', custom: true }],
        favoriteGroups: { frukost: ['banan'], lunch: [], middag: [], skrap: [] },
        goal: 95,
      },
    }),
  )
  vi.resetModules()
  const { useStore } = await import('./useStore')
  expect(useStore.persist.hasHydrated()).toBe(true)
  const s = useStore.getState()
  expect(s.entries).toHaveLength(1)
  expect(s.customFoods).toHaveLength(1)
  expect(s.goal).toBe(95)
  expect(s.showMacros).toBe(false)
  // Det som skrivs tillbaka har den nya versionen och samma rader.
  s.setShowMacros(true)
  const saved = JSON.parse(mem.get('hundra-v1')!)
  expect(saved.version).toBe(6)
  expect(saved.state.entries).toHaveLength(1)
  expect(saved.state.showMacros).toBe(true)
  vi.unstubAllGlobals()
})

// Telefonen har data från version 5 (med näring) när versionen med streckkoder startar.
it('data från version 5 läses in, och skannade varor sparas med streckkod och näringsvärde', async () => {
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  })
  mem.set(
    'hundra-v1',
    JSON.stringify({
      version: 5,
      state: {
        profile: { sex: 'kvinna', age: 40, heightCm: 170, weightKg: 70, activity: 2 },
        budgetHistory: [{ from: '2026-01-01', kcal: 2100 }],
        entries: [
          { id: 'a', date: '2026-10-24', foodId: 'banan', name: 'Banan', emoji: '🍌', unit: '1 st', kcalPerUnit: 100, macrosPerUnit: [1.2, 0.3, 23], qty: 1, at: 1 },
        ],
        customFoods: [{ id: 'egen-1', name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcal: 600, macros: [30, 25, 60] }],
        favoriteGroups: { frukost: ['banan'], lunch: [], middag: [], skrap: [] },
        showMacros: true,
      },
    }),
  )
  vi.resetModules()
  const { useStore } = await import('./useStore')
  expect(useStore.persist.hasHydrated()).toBe(true)
  const s = useStore.getState()
  expect(s.entries[0].macrosPerUnit).toEqual([1.2, 0.3, 23])
  expect(s.customFoods[0]).toMatchObject({ name: 'Lasagne', macros: [30, 25, 60] })
  expect(s.showMacros).toBe(true)
  // Det som sparas efter inläsningen är version 6 och har kvar allt.
  s.addCustomFood({ name: 'Choklad', emoji: '🍫', unit: '100 g', kcal: 540, barcode: '7310511210502', per100: { kcal: 540, measure: 'g' } })
  const stored = JSON.parse(mem.get('hundra-v1')!)
  expect(stored.version).toBe(6)
  expect(stored.state.entries).toHaveLength(1)
  expect(stored.state.customFoods[0].macros).toEqual([30, 25, 60])
  expect(stored.state.customFoods[1]).toMatchObject({ barcode: '7310511210502', per100: { kcal: 540, measure: 'g' } })
  vi.unstubAllGlobals()
})
