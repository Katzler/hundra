import type { Food } from '../data/foods'

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
    if (unitWords.some((w) => w.startsWith(term))) {
      worst = Math.max(worst, 5)
      continue
    }
    // Sammansatta ord: "klyftpotatis" ska hittas på "potatis". Korta sökord ger för mycket brus.
    if (term.length >= 3 && name.includes(term)) {
      worst = Math.max(worst, 3)
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
