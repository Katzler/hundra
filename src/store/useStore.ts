import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { FOODS, type Food } from '../data/foods'
import { tdee, withBudget, type BudgetPeriod, type Entry, type Profile } from '../lib/calc'
import { todayKey, type DateKey } from '../lib/dates'
import { useUI } from './ui'

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

// Om telefonens lagring är full sparas inget – då ska användaren få veta det, inte tro att allt är sparat.
let warnedFull = false
const safeStorage: StateStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
      warnedFull = false
    } catch {
      if (!warnedFull) useUI.getState().showToast('Kunde inte spara – lagringen är full. Exportera en backup.')
      warnedFull = true
    }
  },
  removeItem: (key) => localStorage.removeItem(key),
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

      // Dagens rader följer med ändringen; tidigare dagar behåller sin kopia så att historiken ligger fast.
      updateCustomFood: (id, patch) =>
        set((s) => {
          const today = todayKey()
          return {
            customFoods: s.customFoods.map((f) => (f.id === id ? { ...f, ...patch } : f)),
            entries: s.entries.map((e) =>
              e.foodId === id && e.date === today
                ? {
                    ...e,
                    name: patch.name ?? e.name,
                    emoji: patch.emoji ?? e.emoji,
                    unit: patch.unit ?? e.unit,
                    kcalPerUnit: patch.kcal ?? e.kcalPerUnit,
                  }
                : e,
            ),
          }
        }),

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
      // Nyckeln får aldrig bytas: all historik ligger under den. Höj i stället `version`
      // och skriv en migrering i `migrate` om datamodellen ändras.
      name: 'hundra-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted) => persisted as Data,
      // Trasig eller gammal data i lagringen tvättas i stället för att krascha appen.
      merge: (persisted, current) => ({ ...current, ...sanitizeData(persisted).data }),
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

const isDate = (v: unknown): v is DateKey => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isNum = (v: unknown, min = -Infinity): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min
const isStr = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function cleanProfile(p: unknown): Profile | null {
  if (!isObj(p)) return null
  const ok =
    (p.sex === 'man' || p.sex === 'kvinna') &&
    isNum(p.age, 1) &&
    isNum(p.heightCm, 50) &&
    isNum(p.weightKg, 20) &&
    [1, 2, 3, 4, 5].includes(p.activity as number)
  return ok ? (p as unknown as Profile) : null
}

const cleanEntry = (e: unknown): Entry | null =>
  isObj(e) &&
  isStr(e.id) &&
  isDate(e.date) &&
  isStr(e.foodId) &&
  isStr(e.name) &&
  isNum(e.kcalPerUnit, 0) &&
  isNum(e.qty, 0) &&
  (e.qty as number) > 0
    ? {
        id: e.id,
        date: e.date,
        foodId: e.foodId,
        name: e.name,
        emoji: isStr(e.emoji) ? e.emoji : '🍽️',
        unit: isStr(e.unit) ? e.unit : '',
        kcalPerUnit: e.kcalPerUnit,
        qty: e.qty,
        at: isNum(e.at) ? e.at : 0,
      }
    : null

const cleanFood = (f: unknown): Food | null =>
  isObj(f) && isStr(f.id) && isStr(f.name) && isNum(f.kcal, 0)
    ? {
        id: f.id,
        name: f.name,
        emoji: isStr(f.emoji) ? f.emoji : '🍽️',
        unit: isStr(f.unit) ? f.unit : '1 portion',
        kcal: f.kcal,
        category: 'egna',
        custom: true,
      }
    : null

/**
 * Tvättar data från en importfil eller från lagringen: det som är trasigt tas bort i stället för
 * att krascha appen. `dropped` räknar hur många rader som inte gick att läsa.
 */
export function sanitizeData(raw: unknown): { data: Data; dropped: number } {
  const d = isObj(raw) ? raw : {}
  let dropped = 0
  const list = <T>(v: unknown, clean: (x: unknown) => T | null): T[] => {
    if (!Array.isArray(v)) return []
    const out = v.map(clean).filter((x): x is T => x !== null)
    dropped += v.length - out.length
    return out
  }
  const usage: Usage = {}
  if (isObj(d.usage))
    for (const [id, u] of Object.entries(d.usage))
      if (isObj(u) && isNum(u.count) && isNum(u.last)) usage[id] = { count: u.count, last: u.last }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : [])
  return {
    data: {
      profile: cleanProfile(d.profile),
      budgetHistory: list(d.budgetHistory, (b) =>
        isObj(b) && isDate(b.from) && isNum(b.kcal, 500) ? { from: b.from, kcal: b.kcal } : null,
      ).sort((a, b) => a.from.localeCompare(b.from)),
      entries: list(d.entries, cleanEntry),
      customFoods: list(d.customFoods, cleanFood),
      favorites: strings(d.favorites),
      usage,
      quickPicks: Array.isArray(d.quickPicks) ? strings(d.quickPicks) : null,
    },
    dropped,
  }
}

/** Kastar ett fel med en begriplig text om filen inte ser ut som en export från appen. */
export function parseImport(text: string): Data & { dropped: number } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Filen är inte en giltig JSON-fil.')
  }
  const root = json as { app?: string; data?: unknown }
  if (root?.app !== 'hundra' || !isObj(root.data)) {
    throw new Error('Filen ser inte ut att vara en export från Hundra.')
  }
  if (!Array.isArray(root.data.entries) || !Array.isArray(root.data.budgetHistory)) {
    throw new Error('Filen saknar loggdata.')
  }
  const { data, dropped } = sanitizeData(root.data)
  return { ...data, dropped }
}
