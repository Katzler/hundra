import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { LastChoice, Picks } from '../data/choices'
import { FOODS, type Food } from '../data/foods'
import { daySlot, tdee, withBudget, type BudgetPeriod, type Entry, type Profile, type Weight } from '../lib/calc'
import { todayKey, type DateKey } from '../lib/dates'
import { useUI } from './ui'

/** Hur ofta en vara loggats. `slots` räknar per del av dygnet (morgon, lunch, eftermiddag, kväll). */
export type Usage = Record<string, { count: number; last: number; slots?: number[] }>

export type MealItem = { foodId: string; name: string; emoji: string; unit: string; kcalPerUnit: number; qty: number }
export type Meal = { id: string; name: string; items: MealItem[] }

/** Nyckeln i localStorage. Får aldrig bytas – all historik ligger under den. */
export const STORAGE_KEY = 'hundra-v1'

/** Snabbval kan vara en vara eller en sparad måltid ("måltid:<id>"). */
export const MEAL_PREFIX = 'måltid:'

/** Favoriternas fyra kategorier på Idag. Samma vara får ligga i flera. */
export const FAVORITE_GROUPS = [
  { id: 'frukost', name: 'Frukost', icon: 'grot', emoji: '🥣' },
  { id: 'lunch', name: 'Lunch', icon: 'kottbullar-mos', emoji: '🍝' },
  { id: 'middag', name: 'Middag', icon: 'lax-potatis', emoji: '🍽️' },
  { id: 'skrap', name: 'Skräp', icon: 'chips-pase', emoji: '🍟' },
] as const

export type FavoriteGroup = (typeof FAVORITE_GROUPS)[number]['id']
export type FavoriteGroups = Record<FavoriteGroup, string[]>

/** Så många ryms i hjulet. */
export const FAVORITE_LIMIT = 12

const emptyGroups = (): FavoriteGroups => ({ frukost: [], lunch: [], middag: [], skrap: [] })

/** Alla mål är snitt per dag. 100 = hålla vikten. */
export const GOALS = [
  { value: 100, title: 'Hålla vikten' },
  { value: 95, title: 'Gå ner lite' },
  { value: 90, title: 'Gå ner lugnt' },
  { value: 85, title: 'Gå ner' },
] as const

export type Data = {
  profile: Profile | null
  budgetHistory: BudgetPeriod[]
  entries: Entry[]
  customFoods: Food[]
  usage: Usage
  /** Favoriterna per kategori, i vald ordning. Varor och måltider ("måltid:<id>"). */
  favoriteGroups: FavoriteGroups
  meals: Meal[]
  /** Senaste valet (storlek, tillagning, mängd …) per vara, så att (+) lägger till samma sak igen. */
  lastChoices: Record<string, LastChoice>
  weights: Weight[]
  /** Dagar som inte ska räknas i snittet, t.ex. när man glömt logga det mesta. */
  excludedDays: DateKey[]
  /** Mål för snittet per dag. */
  goal: number
  /** Justering av energibehovet efter faktisk vikttrend. 1 = ingen justering. */
  calibration: number
  /** När ett kalibreringsförslag senast avböjdes. */
  calibrationDismissedAt: number | null
  lastBackupAt: number | null
  backupSnoozedUntil: number | null
  trendRange: number
}

type Actions = {
  setProfile: (p: Profile, opts?: { fromStart?: boolean }) => void
  /** `picks` är valen i snabbvalsarket. De sparas som förval för varan. */
  addFood: (food: Food, date: DateKey, qty?: number, picks?: Picks) => void
  setQty: (entryId: string, qty: number) => void
  removeEntry: (entryId: string) => Entry | undefined
  restoreEntry: (entry: Entry) => void
  setDayEntries: (date: DateKey, entries: Entry[]) => void
  addCustomFood: (f: Omit<Food, 'id' | 'category' | 'custom'>) => Food
  updateCustomFood: (id: string, patch: Partial<Omit<Food, 'id'>>) => void
  deleteCustomFood: (id: string) => void
  setFavorites: (group: FavoriteGroup, ids: string[]) => void
  /** Returnerar true om id:t nu ligger i kategorin. */
  toggleFavorite: (group: FavoriteGroup, id: string) => boolean
  saveMeal: (meal: Omit<Meal, 'id'> & { id?: string }) => Meal
  deleteMeal: (id: string) => void
  logMeal: (id: string, date: DateKey) => void
  logWeight: (date: DateKey, kg: number) => void
  deleteWeight: (date: DateKey) => void
  toggleExcludedDay: (date: DateKey) => void
  setGoal: (goal: number) => void
  setCalibration: (factor: number) => void
  dismissCalibration: () => void
  markBackup: () => void
  snoozeBackup: () => void
  setTrendRange: (n: number) => void
  importData: (data: Data) => void
  resetAll: () => void
}

export const emptyData: Data = {
  profile: null,
  budgetHistory: [],
  entries: [],
  customFoods: [],
  usage: {},
  favoriteGroups: emptyGroups(),
  meals: [],
  lastChoices: {},
  weights: [],
  excludedDays: [],
  goal: 100,
  calibration: 1,
  calibrationDismissedAt: null,
  lastBackupAt: null,
  backupSnoozedUntil: null,
  trendRange: 7,
}

/** Fälten som sparas och exporteras. En enda lista, så att inget nytt fält glöms bort någonstans. */
export const DATA_KEYS = Object.keys(emptyData) as (keyof Data)[]

export function pickData(s: Data): Data {
  return Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as Data
}

// Om telefonens lagring är full sparas inget – då ska användaren få veta det, inte tro att allt är sparat.
let warnedFull = false
// Lagringen skrivs inte förrän sparad data har lästs in. Misslyckas inläsningen ska ett tomt
// startläge aldrig kunna skriva över det som finns sparat.
let hydrated = false
const safeStorage: StateStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    if (!hydrated) return
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

/** Räknar upp (eller ner) hur ofta en vara använts, även per del av dygnet. */
function bumpUsage(usage: Usage, foodId: string, delta: number, at = Date.now()): Usage {
  const cur = usage[foodId] ?? { count: 0, last: 0 }
  const slots = [...(cur.slots ?? [0, 0, 0, 0])]
  const slot = daySlot(at)
  slots[slot] = Math.max(0, slots[slot] + delta)
  return {
    ...usage,
    [foodId]: { count: Math.max(0, cur.count + delta), last: delta > 0 ? at : cur.last, slots },
  }
}

/** Samma vara med samma val (namn, enhet och kcal). Stor stekt kycklingfilé är inte samma rad som liten. */
export const sameItem = (a: Omit<MealItem, 'qty'>, b: Omit<MealItem, 'qty'>) =>
  a.foodId === b.foodId && a.name === b.name && a.unit === b.unit && a.kcalPerUnit === b.kcalPerUnit

/** Lägger till antal av en vara på en dag – samma vara samma dag slås ihop, som i en kundvagn. */
function addToDay(entries: Entry[], date: DateKey, item: MealItem): Entry[] {
  const existing = entries.find((e) => e.date === date && sameItem(e, item))
  if (existing) {
    const qty = existing.qty + item.qty
    return qty <= 0 ? entries.filter((e) => e !== existing) : entries.map((e) => (e === existing ? { ...e, qty } : e))
  }
  if (item.qty <= 0) return entries
  return [...entries, { id: uid(), date, at: Date.now(), ...item }]
}

export const itemOf = (food: Food, qty: number): MealItem => ({
  foodId: food.id,
  name: food.name,
  emoji: food.emoji,
  unit: food.unit,
  kcalPerUnit: food.kcal,
  qty,
})


/**
 * Version 1 → 2: favoriterna blir snabbval (två begrepp för samma sak), och användningen
 * per del av dygnet räknas fram ur loggen.
 */
export function migrateData(persisted: unknown, version: number): Data {
  const d = (isObj(persisted) ? { ...persisted } : {}) as Record<string, unknown>
  if (version < 2) {
    const favorites = Array.isArray(d.favorites) ? (d.favorites as unknown[]).filter(isStr) : []
    const { data } = sanitizeData(d)
    if (favorites.length) {
      const base = oldPicks(d) ?? quickIds(allFoods(data.customFoods), data.usage, null, data.meals)
      d.quickPicks = [...base, ...favorites.filter((id) => !base.includes(id))]
    }
    const usage = { ...data.usage }
    for (const e of data.entries) {
      const u = usage[e.foodId]
      if (!u) continue
      const slots = [...(u.slots ?? [0, 0, 0, 0])]
      if (e.at > 0) slots[daySlot(e.at)] += e.qty
      usage[e.foodId] = { ...u, slots }
    }
    d.usage = usage
    delete d.favorites
  }
  // Version 2 → 3: grekisk yoghurt blir en vara där man väljer fetthalt. Användning och snabbval
  // flyttas till den, och den fetthalt man åt senast blir förval. Gamla rader i loggen behåller sitt id.
  if (version < 3) {
    const { data } = sanitizeData(d)
    const old: Record<string, string> = { 'grekisk-yoghurt-5': '5 %', 'grekisk-yoghurt-2': '2 %', 'grekisk-yoghurt-0': '0 %' }
    const id = 'grekisk-yoghurt'
    const usage = { ...data.usage }
    let latest = { fat: '10 %', last: usage[id]?.last ?? -1 }
    for (const [oldId, fat] of Object.entries(old)) {
      const u = usage[oldId]
      if (!u) continue
      const cur = usage[id]
      const slots = cur?.slots || u.slots ? [0, 1, 2, 3].map((i) => (cur?.slots?.[i] ?? 0) + (u.slots?.[i] ?? 0)) : undefined
      usage[id] = { count: (cur?.count ?? 0) + u.count, last: Math.max(cur?.last ?? 0, u.last), ...(slots ? { slots } : {}) }
      delete usage[oldId]
      if (u.last > latest.last) latest = { fat, last: u.last }
    }
    d.usage = usage
    const picks = oldPicks(d)
    if (picks) d.quickPicks = [...new Set(picks.map((x) => (x in old ? id : x)))]
    if (latest.fat !== '10 %') d.lastChoices = { ...data.lastChoices, [id]: { picks: { fetthalt: latest.fat }, qty: 1 } }
  }
  // Version 3 → 4: favoriterna delas upp i Frukost, Lunch, Middag och Skräp. Inget ska försvinna,
  // så de tidigare favoriterna (egna eller automatiska) hamnar i alla fyra, och sedan rensar man själv.
  if (version < 4) {
    const { data } = sanitizeData(d)
    const ids = quickIds(allFoods(data.customFoods), data.usage, oldPicks(d), data.meals)
    d.favoriteGroups = Object.fromEntries(FAVORITE_GROUPS.map((g) => [g.id, [...ids]]))
    delete d.quickPicks
  }
  return d as unknown as Data
}

/** Snabbvalen före version 4: en lista, eller null för automatiska. */
const oldPicks = (d: Record<string, unknown>): string[] | null => (Array.isArray(d.quickPicks) ? d.quickPicks.filter(isStr) : null)

export function allFoods(custom: Food[]): Food[] {
  return [...custom, ...FOODS]
}

/** De mest använda varorna, där nyligen använda väger tyngre – och, med nog underlag, rätt tid på dygnet. */
export function topFoods(foods: Food[], usage: Usage, limit = 8, now = Date.now()): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  const slot = daySlot(now)
  const enoughData = Object.values(usage).reduce((s, u) => s + u.count, 0) >= 20
  return Object.entries(usage)
    .filter(([id]) => byId.has(id))
    .map(([id, u]) => {
      const daysAgo = (now - u.last) / 86_400_000
      const slotShare = enoughData && u.slots && u.count > 0 ? (u.slots[slot] ?? 0) / u.count : 0
      return { food: byId.get(id)!, score: (u.count / (1 + daysAgo / 7)) * (1 + 2 * slotShare) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.food)
}

const STARTER_IDS = ['kaffe-mjolk', 'macka-ost', 'potatis', 'banan', 'agg', 'pasta', 'apple', 'yoghurt']

/** Snabbvalens id:n: de egna i vald ordning, annars de mest använda fyllda med vanliga varor. */
export function quickIds(foods: Food[], usage: Usage, picks: string[] | null, _meals: Meal[], limit = 8): string[] {
  if (picks) return picks
  const top = topFoods(foods, usage, limit).map((f) => f.id)
  const fill = STARTER_IDS.filter((id) => !top.includes(id) && foods.some((f) => f.id === id))
  return [...top, ...fill].slice(0, limit)
}

export type QuickItem = { kind: 'food'; food: Food } | { kind: 'meal'; meal: Meal }

/** Snabbvalen som varor och måltider. Id:n som inte längre finns hoppas över. */
export function quickItems(foods: Food[], usage: Usage, picks: string[] | null, meals: Meal[], limit = 8): QuickItem[] {
  return itemsOf(foods, quickIds(foods, usage, picks, meals, limit), meals)
}

/** Id:n som varor och måltider, i samma ordning. Id:n som inte längre finns hoppas över. */
export function itemsOf(foods: Food[], ids: string[], meals: Meal[]): QuickItem[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  return ids
    .map((id): QuickItem | null => {
      if (id.startsWith(MEAL_PREFIX)) {
        const meal = meals.find((m) => MEAL_PREFIX + m.id === id)
        return meal ? { kind: 'meal', meal } : null
      }
      const food = byId.get(id)
      return food ? { kind: 'food', food } : null
    })
    .filter((x): x is QuickItem => x !== null)
}

/** Ligger id:t i någon av favoritkategorierna? */
export const isFavorite = (groups: FavoriteGroups, id: string) => FAVORITE_GROUPS.some((g) => groups[g.id].includes(id))

/** Bakåtkompatibel hjälpare: bara varorna bland snabbvalen. */
export function quickFoods(foods: Food[], usage: Usage, picks: string[] | null, limit = 8): Food[] {
  return quickItems(foods, usage, picks, [], limit).flatMap((q) => (q.kind === 'food' ? [q.food] : []))
}

export function recentFoods(foods: Food[], usage: Usage, limit = 12): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]))
  return Object.entries(usage)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, limit)
    .map(([id]) => byId.get(id)!)
}

export function mealKcal(meal: Meal): number {
  return meal.items.reduce((s, i) => s + i.kcalPerUnit * i.qty, 0)
}

export function exportData(s: Data): string {
  return JSON.stringify({ app: 'hundra', version: 4, exportedAt: new Date().toISOString(), data: pickData(s) }, null, 2)
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

const cleanItem = (e: Record<string, unknown>): MealItem | null =>
  isStr(e.foodId) && isStr(e.name) && isNum(e.kcalPerUnit, 0) && isNum(e.qty, 0) && (e.qty as number) > 0
    ? {
        foodId: e.foodId,
        name: e.name,
        emoji: isStr(e.emoji) ? e.emoji : '🍽️',
        unit: isStr(e.unit) ? e.unit : '',
        kcalPerUnit: e.kcalPerUnit,
        qty: e.qty,
      }
    : null

const cleanEntry = (e: unknown): Entry | null => {
  if (!isObj(e) || !isStr(e.id) || !isDate(e.date)) return null
  const item = cleanItem(e)
  return item ? { id: e.id, date: e.date, at: isNum(e.at) ? e.at : 0, ...item } : null
}

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

const cleanMeal = (m: unknown): Meal | null => {
  if (!isObj(m) || !isStr(m.id) || !isStr(m.name) || !Array.isArray(m.items)) return null
  const items = m.items.map((i) => (isObj(i) ? cleanItem(i) : null)).filter((i): i is MealItem => i !== null)
  return items.length ? { id: m.id, name: m.name, items } : null
}

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
      if (isObj(u) && isNum(u.count) && isNum(u.last))
        usage[id] = {
          count: u.count,
          last: u.last,
          ...(Array.isArray(u.slots) && u.slots.length === 4 && u.slots.every((x) => isNum(x, 0)) ? { slots: u.slots as number[] } : {}),
        }
  const lastChoices: Record<string, LastChoice> = {}
  if (isObj(d.lastChoices))
    for (const [id, c] of Object.entries(d.lastChoices))
      if (isObj(c) && isObj(c.picks) && isNum(c.qty, 0) && c.qty > 0)
        lastChoices[id] = { picks: Object.fromEntries(Object.entries(c.picks).filter(([, v]) => isStr(v))) as Picks, qty: c.qty }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : [])
  const numOr = (v: unknown, fallback: number, min: number, max: number) => (isNum(v, min) && v <= max ? v : fallback)
  const timeOrNull = (v: unknown) => (isNum(v, 0) ? v : null)
  return {
    data: {
      profile: cleanProfile(d.profile),
      budgetHistory: list(d.budgetHistory, (b) =>
        isObj(b) && isDate(b.from) && isNum(b.kcal, 500) ? { from: b.from, kcal: b.kcal } : null,
      ).sort((a, b) => a.from.localeCompare(b.from)),
      entries: list(d.entries, cleanEntry),
      customFoods: list(d.customFoods, cleanFood),
      usage,
      favoriteGroups: Object.fromEntries(
        FAVORITE_GROUPS.map((g) => [g.id, isObj(d.favoriteGroups) ? [...new Set(strings(d.favoriteGroups[g.id]))] : []]),
      ) as FavoriteGroups,
      meals: list(d.meals, cleanMeal),
      lastChoices,
      weights: list(d.weights, (w) => (isObj(w) && isDate(w.date) && isNum(w.kg, 20) && w.kg < 400 ? { date: w.date, kg: w.kg } : null)),
      excludedDays: strings(d.excludedDays).filter(isDate),
      goal: numOr(d.goal, 100, 80, 100),
      calibration: numOr(d.calibration, 1, 0.8, 1.2),
      calibrationDismissedAt: timeOrNull(d.calibrationDismissedAt),
      lastBackupAt: timeOrNull(d.lastBackupAt),
      backupSnoozedUntil: timeOrNull(d.backupSnoozedUntil),
      trendRange: [7, 30, 90].includes(d.trendRange as number) ? (d.trendRange as number) : 7,
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
  const root = json as { app?: string; version?: number; data?: unknown }
  if (root?.app !== 'hundra' || !isObj(root.data)) {
    throw new Error('Filen ser inte ut att vara en export från Hundra.')
  }
  if (!Array.isArray(root.data.entries) || !Array.isArray(root.data.budgetHistory)) {
    throw new Error('Filen saknar loggdata.')
  }
  // Äldre exporter går igenom samma migrering som lagringen.
  const migrated = migrateData(root.data, isNum(root.version) ? root.version : 1)
  const { data, dropped } = sanitizeData(migrated)
  return { ...data, dropped }
}

const withoutFavorite = (groups: FavoriteGroups, id: string): FavoriteGroups =>
  Object.fromEntries(FAVORITE_GROUPS.map((g) => [g.id, groups[g.id].filter((x) => x !== id)])) as FavoriteGroups

// Lagringen skapas sist i filen: den läser in sparad data direkt, och då måste alla
// hjälpfunktioner och konstanter ovanför redan finnas.
export const useStore = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...emptyData,

      setProfile: (profile, opts) =>
        set((s) => {
          const kcal = Math.round(tdee(profile) * s.calibration)
          // "Rätta från början" gör att även gamla dagar räknas mot de nya uppgifterna.
          const from = opts?.fromStart ? (s.budgetHistory[0]?.from ?? todayKey()) : todayKey()
          return {
            profile,
            budgetHistory: opts?.fromStart ? [{ from, kcal }] : withBudget(s.budgetHistory, from, kcal),
          }
        }),

      addFood: (food, date, qty = 1, picks) =>
        set((s) => ({
          usage: bumpUsage(s.usage, food.id, qty),
          entries: addToDay(s.entries, date, itemOf(food, qty)),
          ...(picks ? { lastChoices: { ...s.lastChoices, [food.id]: { picks, qty } } } : {}),
        })),

      // Ändrat antal följer med i användningen, så att + följt av − inte flyttar upp varan.
      setQty: (entryId, qty) =>
        set((s) => {
          const entry = s.entries.find((e) => e.id === entryId)
          if (!entry) return s
          return {
            usage: entry.foodId in s.usage ? bumpUsage(s.usage, entry.foodId, qty - entry.qty) : s.usage,
            entries:
              qty <= 0
                ? s.entries.filter((e) => e.id !== entryId)
                : s.entries.map((e) => (e.id === entryId ? { ...e, qty } : e)),
          }
        }),

      removeEntry: (entryId) => {
        const entry = get().entries.find((e) => e.id === entryId)
        set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }))
        return entry
      },

      restoreEntry: (entry) =>
        set((s) => ({
          entries: s.entries.some((e) => e.id === entry.id) ? s.entries : [...s.entries, entry],
        })),

      setDayEntries: (date, dayEntries) =>
        set((s) => ({ entries: [...s.entries.filter((e) => e.date !== date), ...dayEntries] })),

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
          favoriteGroups: withoutFavorite(s.favoriteGroups, id),
        })),

      setFavorites: (group, ids) => set((s) => ({ favoriteGroups: { ...s.favoriteGroups, [group]: ids } })),

      // En full kategori tar inte emot fler; då blir svaret false.
      toggleFavorite: (group, id) => {
        const ids = get().favoriteGroups[group]
        const on = !ids.includes(id)
        if (on && ids.length >= FAVORITE_LIMIT) return false
        get().setFavorites(group, on ? [...ids, id] : ids.filter((x) => x !== id))
        return on
      },

      saveMeal: (m) => {
        const meal: Meal = { id: m.id ?? uid(), name: m.name.trim() || 'Min måltid', items: m.items }
        set((s) => ({
          meals: s.meals.some((x) => x.id === meal.id) ? s.meals.map((x) => (x.id === meal.id ? meal : x)) : [...s.meals, meal],
        }))
        return meal
      },

      deleteMeal: (id) =>
        set((s) => ({
          meals: s.meals.filter((m) => m.id !== id),
          favoriteGroups: withoutFavorite(s.favoriteGroups, MEAL_PREFIX + id),
        })),

      logMeal: (id, date) =>
        set((s) => {
          const meal = s.meals.find((m) => m.id === id)
          if (!meal) return s
          let entries = s.entries
          let usage = bumpUsage(s.usage, MEAL_PREFIX + id, 1)
          for (const item of meal.items) {
            entries = addToDay(entries, date, item)
            usage = bumpUsage(usage, item.foodId, item.qty)
          }
          return { entries, usage }
        }),

      logWeight: (date, kg) =>
        set((s) => ({
          weights: [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)),
        })),

      deleteWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date) })),

      toggleExcludedDay: (date) =>
        set((s) => ({
          excludedDays: s.excludedDays.includes(date) ? s.excludedDays.filter((d) => d !== date) : [...s.excludedDays, date],
        })),

      setGoal: (goal) => set({ goal }),

      // Ny kalibrering gäller från idag, så att gamla dagar inte räknas om.
      setCalibration: (calibration) =>
        set((s) => ({
          calibration,
          calibrationDismissedAt: null,
          budgetHistory: s.profile
            ? withBudget(s.budgetHistory, todayKey(), Math.round(tdee(s.profile) * calibration))
            : s.budgetHistory,
        })),

      dismissCalibration: () => set({ calibrationDismissedAt: Date.now() }),

      markBackup: () => set({ lastBackupAt: Date.now(), backupSnoozedUntil: null }),

      snoozeBackup: () => set({ backupSnoozedUntil: Date.now() + 7 * 86_400_000 }),

      setTrendRange: (trendRange) => set({ trendRange }),

      importData: (data) => set({ ...emptyData, ...data }),

      resetAll: () => set(emptyData),
    }),
    {
      // Nyckeln får aldrig bytas: all historik ligger under den. Höj i stället `version`
      // och skriv en migrering i `migrate` om datamodellen ändras.
      name: STORAGE_KEY,
      version: 4,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted, version) => migrateData(persisted, version),
      // Trasig eller gammal data i lagringen tvättas i stället för att krascha appen.
      merge: (persisted, current) => ({ ...current, ...sanitizeData(persisted).data }),
      partialize: (s) => pickData(s),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Kunde inte läsa sparad data', error)
          useUI.setState({ hydrationError: error instanceof Error ? error.message : String(error) })
          return
        }
        hydrated = true
      },
    },
  ),
)
