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
