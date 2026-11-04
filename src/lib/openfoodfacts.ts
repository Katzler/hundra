// Uppslag av streckkoder i Open Food Facts, en öppen databas över livsmedel (ODbL).
// Bara streckkoden skickas, aldrig något om användaren eller loggen.

import type { Per100 } from '../data/foods'
import { kindById, kindFor } from '../data/kinds'
import { roundMacros, type Macros } from './calc'
import { normalize } from './search'

/** En vara som gick att använda: namn och kcal finns. Näringen är per 100 g, om den finns. */
export type Product = { name: string; emoji: string; per100: Per100; macros100?: Macros }

export type Lookup =
  | { kind: 'found'; product: Product }
  /** Varan finns, men utan kcal eller namn. Det som finns följer med till formuläret. */
  | { kind: 'incomplete'; name?: string; per100?: Partial<Per100>; macros100?: Macros }
  | { kind: 'missing' }
  /** Inget nät, eller inget svar i tid. */
  | { kind: 'offline' }
  /** Open Food Facts svarade med ett fel, t.ex. för många anrop. */
  | { kind: 'error' }

const FIELDS = [
  'product_name',
  'product_name_sv',
  'brands',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'categories_tags',
].join(',')

export const productUrl = (code: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${code}?fields=${FIELDS}&lc=sv`

/** Länken till varan på Open Food Facts webbplats, där man kan rätta eller fylla i den. */
export const productPage = (code: string) => `https://se.openfoodfacts.org/product/${code}`

/** Slår upp en kod. Ger upp efter `timeoutMs` och räknar det som ingen anslutning. */
export async function lookupBarcode(
  code: string,
  { signal, timeoutMs = 8000, fetchFn = fetch }: { signal?: AbortSignal; timeoutMs?: number; fetchFn?: typeof fetch } = {},
): Promise<Lookup> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' }
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), timeoutMs)
  const abort = () => timeout.abort()
  signal?.addEventListener('abort', abort)
  try {
    const res = await fetchFn(productUrl(code), { signal: timeout.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (res.status === 404) return { kind: 'missing' }
    if (!res.ok) return { kind: 'error' }
    return parseProduct(await res.json())
  } catch (e) {
    // Avbrutet av användaren: det är inget svar alls. Annars nådde vi inte fram (inget nät eller för långsamt).
    if (signal?.aborted) throw e
    return { kind: 'offline' }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

const TO_BASE: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, ml: 1, cl: 10, dl: 100, l: 1000 }
const isVolume = (unit: string) => ['ml', 'cl', 'dl', 'l'].includes(unit)
const AMOUNT = /(\d+(?:[.,]\d+)?)\s*(kg|mg|g|ml|cl|dl|l)\b/i

/** "1,5 l" → 1500 ml, "500 g" → 500 g. */
function parseAmount(text: string): { n: number; measure: Per100['measure'] } | undefined {
  const m = AMOUNT.exec(text)
  if (!m) return undefined
  const unit = m[2].toLowerCase()
  return { n: Number(m[1].replace(',', '.')) * TO_BASE[unit], measure: isVolume(unit) ? 'ml' : 'g' }
}

/** "4 x 125 g": en förpackning är en av fyra, inte alla tillsammans. */
function parseMultipack(text: string): { n: number; measure: Per100['measure'] } | undefined {
  const m = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?\s*(?:kg|mg|g|ml|cl|dl|l))\b/i.exec(text)
  return m ? parseAmount(m[2]) : undefined
}

const size = (n: number | undefined) => (n !== undefined && n >= 1 && n <= 10_000 ? Math.round(n * 10) / 10 : undefined)

/** "MELLANMJÖLK" → "Mellanmjölk". Namn i blandad stil lämnas som de är. */
function tidyName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (/\p{L}/u.test(clean) && clean === clean.toUpperCase()) return clean.charAt(0) + clean.slice(1).toLowerCase()
  return clean
}

/** Märket först, som man säger det: "Arla Mellanmjölk", om det inte redan står i namnet. */
function withBrand(name: string, brands: unknown): string {
  const brand = typeof brands === 'string' ? tidyName(brands.split(',')[0]) : ''
  if (!brand || normalize(name).includes(normalize(brand))) return name
  return `${brand} ${name}`
}

// Den första kategorin som stämmer ger emojin. De mer precisa står först.
const CATEGORY_EMOJI: [string, string][] = [
  ['en:chocolates', '🍫'],
  ['en:candies', '🍬'],
  ['en:biscuits', '🍪'],
  ['en:cakes', '🍰'],
  ['en:ice-creams', '🍦'],
  ['en:chips-and-fries', '🍟'],
  ['en:crisps', '🍟'],
  ['en:popcorn', '🍿'],
  ['en:nuts', '🥜'],
  ['en:cheeses', '🧀'],
  ['en:yogurts', '🥛'],
  ['en:milks', '🥛'],
  ['en:plant-based-milk-alternatives', '🥛'],
  ['en:eggs', '🥚'],
  ['en:breakfast-cereals', '🥣'],
  ['en:breads', '🍞'],
  ['en:pizzas', '🍕'],
  ['en:pastas', '🍝'],
  ['en:rices', '🍚'],
  ['en:potatoes', '🥔'],
  ['en:fishes', '🐟'],
  ['en:seafood', '🐟'],
  ['en:poultries', '🍗'],
  ['en:meats', '🥩'],
  ['en:fruits', '🍎'],
  ['en:vegetables', '🥦'],
  ['en:coffees', '☕'],
  ['en:teas', '🍵'],
  ['en:beers', '🍺'],
  ['en:wines', '🍷'],
  ['en:juices', '🧃'],
  ['en:sodas', '🥤'],
  ['en:beverages', '🧃'],
  ['en:meals', '🍲'],
  ['en:sauces', '🥫'],
  ['en:dairies', '🥛'],
  ['en:snacks', '🍿'],
]

function emojiFor(tags: string[], fallback = '🍽️'): string {
  return CATEGORY_EMOJI.find(([tag]) => tags.includes(tag))?.[1] ?? fallback
}

/** Gör om svaret från Open Food Facts till en vara, eller säger vad som saknas. */
export function parseProduct(json: unknown): Lookup {
  const root = (json ?? {}) as { status?: unknown; product?: Record<string, unknown> }
  const p = root.product
  if (!p || root.status === 0) return { kind: 'missing' }
  const n = (p.nutriments ?? {}) as Record<string, unknown>

  // kcal per 100 g om det finns, annars räknat från kJ. energy_100g är alltid i kJ.
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g'])
  const rawKcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined)
  // Över 900 kcal per 100 g finns inte (rent fett är 900). Då har någon troligen skrivit kJ som kcal.
  const kcal = rawKcal !== undefined && rawKcal >= 0 && rawKcal <= 900 ? Math.round(rawKcal * 10) / 10 : undefined

  const quantity = typeof p.quantity === 'string' ? p.quantity : ''
  const quantityUnit = typeof p.product_quantity_unit === 'string' ? p.product_quantity_unit.toLowerCase() : ''
  const parsed = parseAmount(quantity)
  const measure: Per100['measure'] = quantityUnit === 'ml' || (!quantityUnit && parsed?.measure === 'ml') ? 'ml' : 'g'
  const pack = size(parseMultipack(quantity)?.n ?? num(p.product_quantity) ?? parsed?.n)
  const servingText = typeof p.serving_size === 'string' ? p.serving_size : ''
  const serving = size(num(p.serving_quantity) ?? parseAmount(servingText)?.n)

  const rawName = [p.product_name_sv, p.product_name].find((x): x is string => typeof x === 'string' && x.trim() !== '')
  const name = rawName ? withBrand(tidyName(rawName), p.brands).slice(0, 80) : undefined

  // Protein, fett och kolhydrater per 100 g. Bara om alla tre finns och är rimliga.
  const grams = [n.proteins_100g, n.fat_100g, n.carbohydrates_100g].map(num)
  const macros100 = grams.every((g) => g !== undefined && g >= 0 && g <= 100) ? roundMacros(grams as Macros) : undefined
  const withMacros = macros100 ? { macros100 } : {}

  // Typen ger naturliga mått: en klick Bregott, en skål yoghurt, en skiva ost.
  const tags = Array.isArray(p.categories_tags) ? p.categories_tags.filter((t): t is string => typeof t === 'string') : []
  const type = kindFor(name ?? '', tags, measure)
  const emoji = kindById(type)?.emoji ?? emojiFor(tags, type === 'dryck' ? '🥛' : '🍽️')

  const sizes = { measure, ...(serving ? { serving } : {}), ...(pack ? { pack } : {}), ...(type ? { kind: type } : {}) }
  if (!name || kcal === undefined) return { kind: 'incomplete', name, per100: { ...sizes, ...(kcal !== undefined ? { kcal } : {}) }, ...withMacros }
  return { kind: 'found', product: { name, emoji, per100: { kcal, ...sizes }, ...withMacros } }
}
