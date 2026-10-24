import { CATEGORIES, type Food } from '../data/foods'

/** Gemener utan accenter: "Äggröra" → "aggrora", så att man kan skriva utan svenskt tangentbord. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const words = (s: string) => normalize(s).split(' ').filter(Boolean)

const categoryWords = new Map<string, string[]>(CATEGORIES.map((c) => [c.id, words(c.name)]))

const NUMBER_WORDS: Record<string, number> = { en: 1, ett: 1, tva: 2, tre: 3, fyra: 4, fem: 5, sex: 6, halv: 0.5, halva: 0.5 }

/**
 * Plockar ut ett antal i början av sökningen: "3 potatis", "½ pizza", "1,5 pasta", "en halv pizza".
 * Returnerar antalet och resten av sökningen.
 */
export function parseQuantity(raw: string): { qty: number; rest: string } {
  const text = raw.trim().replace(/^(\d+)\s*½/, (_, n) => `${n}.5 `).replace(/^½/, '0.5 ')
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:st|x|×)?\s+(.+)$/i)
  if (m) {
    const qty = Number(m[1].replace(',', '.'))
    if (qty > 0 && qty <= 50) return { qty, rest: m[2] }
  }
  const w = normalize(text).match(/^(en |ett )?(halv|halva|en|ett|tva|tre|fyra|fem|sex) (.+)$/)
  if (w) {
    const qty = w[1] && (w[2] === 'halv' || w[2] === 'halva') ? 0.5 : NUMBER_WORDS[w[2]]
    if (qty) return { qty, rest: w[3] }
  }
  return { qty: 1, rest: raw }
}

/** Lägre är bättre, null betyder ingen träff. */
function score(food: Food, query: string, terms: string[]): number | null {
  const name = normalize(food.name)
  if (name === query) return 0
  if (name.startsWith(query)) return 1

  const nameWords = words(food.name)
  const aliasWords = (food.aliases ?? []).flatMap(words)
  const aliases = (food.aliases ?? []).map(normalize)
  const unitWords = words(food.unit)

  // Varje sökord måste matcha början av något ord.
  let worst = 2
  for (const term of terms) {
    if (nameWords.some((w) => w.startsWith(term))) continue
    if (aliases.some((a) => a.startsWith(term)) || aliasWords.some((w) => w.startsWith(term))) {
      worst = Math.max(worst, 3)
      continue
    }
    // En enda bokstav ska inte träffa portionsenheten ("s" → "1 st").
    if (term.length >= 2 && unitWords.some((w) => w.startsWith(term))) {
      worst = Math.max(worst, 5)
      continue
    }
    // Sammansatta ord: "klyftpotatis" ska hittas på "potatis". Korta sökord ger för mycket brus.
    if (term.length >= 3 && name.includes(term)) {
      worst = Math.max(worst, 3)
      continue
    }
    // Kategorinamn: "frukt" visar allt i Grönt & frukt, "fika" allt i Fika & bakverk.
    if (term.length >= 3 && categoryWords.get(food.category)?.some((w) => w.startsWith(term))) {
      worst = Math.max(worst, 6)
      continue
    }
    return null
  }
  return worst
}

export function searchFoods(
  foods: Food[],
  rawQuery: string,
  usage: Record<string, { count: number }> = {},
): Food[] {
  const query = normalize(rawQuery)
  if (!query) return []
  const terms = query.split(' ')
  const hits: { food: Food; s: number }[] = []
  for (const food of foods) {
    const s = score(food, query, terms)
    if (s !== null) hits.push({ food, s })
  }
  return hits
    .sort(
      (a, b) =>
        a.s - b.s ||
        (usage[b.food.id]?.count ?? 0) - (usage[a.food.id]?.count ?? 0) ||
        a.food.name.length - b.food.name.length,
    )
    .map((h) => h.food)
}
