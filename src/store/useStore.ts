import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FOODS, type Food } from '../data/foods'
import { tdee, withBudget, type BudgetPeriod, type Entry, type Profile } from '../lib/calc'
import { todayKey, type DateKey } from '../lib/dates'

type Usage = Record<string, { count: number; last: number }>

export type Data = {
  profile: Profile | null
  budgetHistory: BudgetPeriod[]
  entries: Entry[]
  customFoods: Food[]
  favorites: string[]
  usage: Usage
  /** Egna snabbval i vald ordning. null = automatiskt efter det man äter mest. */
  quickPicks: string[] | null
}

type Actions = {
  setProfile: (p: Profile) => void
  addFood: (food: Food, date: DateKey, qty?: number) => void
  setQty: (entryId: string, qty: number) => void
  removeEntry: (entryId: string) => Entry | undefined
  restoreEntry: (entry: Entry) => void
  addCustomFood: (f: Omit<Food, 'id' | 'category' | 'custom'>) => Food
  updateCustomFood: (id: string, patch: Partial<Omit<Food, 'id'>>) => void
  deleteCustomFood: (id: string) => void
  toggleFavorite: (foodId: string) => void
  setQuickPicks: (ids: string[] | null) => void
  importData: (data: Data) => void
  resetAll: () => void
}

const empty: Data = {
  profile: null,
  budgetHistory: [],
  entries: [],
  customFoods: [],
  favorites: [],
  usage: {},
  quickPicks: null,
}

// crypto.randomUUID kräver https, men appen ska gå att testa via LAN-IP också.
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...empty,

      setProfile: (profile) =>
        set((s) => ({
          profile,
          budgetHistory: withBudget(s.budgetHistory, todayKey(), tdee(profile)),
        })),

      addFood: (food, date, qty = 1) =>
        set((s) => {
          const usage = {
            ...s.usage,
            [food.id]: { count: (s.usage[food.id]?.count ?? 0) + qty, last: Date.now() },
          }
          const existing = s.entries.find((e) => e.date === date && e.foodId === food.id)
          if (existing) {
            return {
              usage,
              entries: s.entries.map((e) => (e === existing ? { ...e, qty: e.qty + qty } : e)),
            }
          }
          const entry: Entry = {
            id: uid(),
            date,
            foodId: food.id,
            name: food.name,
            emoji: food.emoji,
            unit: food.unit,
            kcalPerUnit: food.kcal,
            qty,
            at: Date.now(),
          }
          return { usage, entries: [...s.entries, entry] }
        }),

      setQty: (entryId, qty) =>
        set((s) => ({
          entries:
            qty <= 0
              ? s.entries.filter((e) => e.id !== entryId)
              : s.entries.map((e) => (e.id === entryId ? { ...e, qty } : e)),
        })),

      removeEntry: (entryId) => {
        const entry = get().entries.find((e) => e.id === entryId)
        set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }))
        return entry
      },

      restoreEntry: (entry) =>
        set((s) => ({
          entries: s.entries.some((e) => e.id === entry.id) ? s.entries : [...s.entries, entry],
        })),

      addCustomFood: (f) => {
        const food: Food = { ...f, id: 'egen-' + uid(), category: 'egna', custom: true }
        set((s) => ({ customFoods: [...s.customFoods, food] }))
        return food
      },

      updateCustomFood: (id, patch) =>
        set((s) => ({ customFoods: s.customFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),

      deleteCustomFood: (id) =>
        set((s) => ({
          customFoods: s.customFoods.filter((f) => f.id !== id),
          favorites: s.favorites.filter((x) => x !== id),
          quickPicks: s.quickPicks?.filter((x) => x !== id) ?? null,
        })),

      toggleFavorite: (foodId) =>
        set((s) => ({
          favorites: s.favorites.includes(foodId)
            ? s.favorites.filter((x) => x !== foodId)
            : [...s.favorites, foodId],
        })),

      setQuickPicks: (quickPicks) => set({ quickPicks }),

      importData: (data) => set({ ...empty, ...data }),

      resetAll: () => set(empty),
    }),
    {
      name: 'hundra-v1',
      version: 1,
      partialize: ({ profile, budgetHistory, entries, customFoods, favorites, usage, quickPicks }) => ({
        profile,
        budgetHistory,
        entries,
        customFoods,
        favorites,
        usage,
        quickPicks,
      }),
    },
  ),
)

export function allFoods(custom: Food[]): Food[] {
  return [...custom, ...FOODS]
}

/** De mest använda varorna, där nyligen använda väger tyngre. */
export function topFoods(foods: Food[], usage: Usage, limit = 8): Food[] {
  const now = Date.now()
  const byId = new Map(foods.map((f) => [f.id, f]))
  return Object.entries(usage)
    .filter(([id]) => byId.has(id))
    .map(([id, u]) => {
      const daysAgo = (now - u.last) / 86_400_000
      return { food: byId.get(id)!, score: u.count / (1 + daysAgo / 7) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.food)
}

const STARTER_IDS = ['kaffe-mjolk', 'macka-ost', 'potatis', 'banan', 'agg', 'pasta', 'apple', 'yoghurt']

/** Snabbvalen: de egna i vald ordning, annars de mest använda fyllda med vanliga varor. */
export function quickFoods(foods: Food[], usage: Usage, picks: string[] | null, limit = 8): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  if (picks) return picks.map((id) => byId.get(id)).filter((f): f is Food => !!f)
  const top = topFoods(foods, usage, limit)
  const fill = STARTER_IDS.map((id) => byId.get(id)).filter((f): f is Food => !!f && !top.includes(f))
  return [...top, ...fill].slice(0, limit)
}

export function recentFoods(foods: Food[], usage: Usage, limit = 12): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  return Object.entries(usage)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, limit)
    .map(([id]) => byId.get(id)!)
}

export function exportData(s: Data): string {
  const { profile, budgetHistory, entries, customFoods, favorites, usage, quickPicks } = s
  return JSON.stringify(
    {
      app: 'hundra',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { profile, budgetHistory, entries, customFoods, favorites, usage, quickPicks },
    },
    null,
    2,
  )
}

/** Kastar ett fel med en begriplig text om filen inte ser ut som en export från appen. */
export function parseImport(text: string): Data {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Filen är inte en giltig JSON-fil.')
  }
  const root = json as { app?: string; data?: Partial<Data> }
  if (root?.app !== 'hundra' || typeof root.data !== 'object' || !root.data) {
    throw new Error('Filen ser inte ut att vara en export från Hundra.')
  }
  const d = root.data
  if (!Array.isArray(d.entries) || !Array.isArray(d.budgetHistory)) {
    throw new Error('Filen saknar loggdata.')
  }
  return {
    profile: d.profile ?? null,
    budgetHistory: d.budgetHistory,
    entries: d.entries,
    customFoods: Array.isArray(d.customFoods) ? d.customFoods : [],
    favorites: Array.isArray(d.favorites) ? d.favorites : [],
    usage: d.usage && typeof d.usage === 'object' ? d.usage : {},
    quickPicks: Array.isArray(d.quickPicks) ? d.quickPicks : null,
  }
}
