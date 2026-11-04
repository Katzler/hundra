// Naturliga mått för varor från en förpackning. Näringsvärdet står per 100 g, men ingen räknar
// Bregott eller yoghurt i gram: man tar en klick, en skål eller en skiva. Varans typ känns igen
// på kategorin i Open Food Facts eller på namnet, och typen ger måtten med ungefärlig vikt.

import { normalize } from '../lib/search'

export type KindMeasure = {
  id: string
  label: string
  unit: string
  /** Vikt i gram (eller ml för dryck). */
  amount: number
  /** Om förpackningen räknas i ml och måttet då väger annat, t.ex. en kula glass. */
  amountMl?: number
  /** Liten text under valet. Utan den visas ungefärlig vikt. null visar ingenting. */
  note?: string | null
  /** Styckmått som en skiva eller ett kex: står portionen på förpackningen och liknar måttet, gäller den vikten. */
  countable?: boolean
  amounts?: number[]
  /** Hur många man brukar ta, t.ex. 2 kex. */
  qty?: number
}

export type Kind = {
  id: string
  /** Utan emoji väljs den efter kategorin, t.ex. mjölk eller juice. */
  emoji?: string
  /** Kategorier i Open Food Facts. */
  tags: string[]
  /** Ord i namnet, utan accenter. Sammansatta ord räknas också: "herrgårdsost" är ost. */
  words: string[]
  /** Bara för fast eller flytande, t.ex. så att chokladmjölk inte blir choklad. */
  only?: 'g' | 'ml'
  /** Är förpackningen högst så här stor äter man ofta hela, t.ex. en yoghurtburk eller en läskburk. */
  whole?: number
  /** Det första måttet är förvalt. */
  measures: KindMeasure[]
}

const tsk = (amount = 5): KindMeasure => ({ id: 'tsk', label: 'Tesked', unit: '1 tsk', amount })
const msk = (amount = 15): KindMeasure => ({ id: 'msk', label: 'Matsked', unit: '1 msk', amount })
const dl = (amount = 100, note?: string | null): KindMeasure => ({ id: 'dl', label: 'Deciliter', unit: '1 dl', amount, note })
const skiva = (amount: number, qty?: number): KindMeasure => ({
  id: 'skiva',
  label: 'Skiva',
  unit: '1 skiva',
  amount,
  countable: true,
  amounts: [1, 2, 3, 4, 6],
  ...(qty ? { qty } : {}),
})
const portion = (amount: number, note?: string): KindMeasure => ({ id: 'mal', label: 'Portion', unit: '1 portion', amount, note, countable: true })

// Ordningen spelar roll: den första typen som stämmer gäller. De mer precisa står först,
// t.ex. jordnötssmör före smör, filmjölk före mjölk och tortillachips före tortilla.
export const KINDS: Kind[] = [
  {
    id: 'notkram',
    emoji: '🥜',
    tags: ['en:nut-butters', 'en:peanut-butters', 'en:cocoa-and-hazelnuts-spreads', 'en:hazelnut-spreads', 'en:chocolate-spreads'],
    words: ['jordnotssmor', 'notsmor', 'nutella', 'notkram', 'chokladkram'],
    measures: [msk(16), tsk(7)],
  },
  {
    id: 'smor',
    emoji: '🧈',
    tags: ['en:butters', 'en:margarines', 'en:spreadable-fats', 'en:dairy-spreads', 'en:plant-based-spreads'],
    words: ['bregott', 'smor', 'margarin', 'latta', 'flora', 'becel', 'milda'],
    measures: [{ id: 'klick', label: 'Klick', unit: '1 klick', amount: 8, note: 'till en macka', countable: true, amounts: [1, 2, 3, 4] }, tsk(5), msk(12)],
  },
  {
    id: 'sylt',
    emoji: '🍓',
    tags: ['en:jams', 'en:marmalades', 'en:fruit-preserves', 'en:honeys'],
    words: ['sylt', 'marmelad', 'honung', 'gele'],
    measures: [msk(20), tsk(7)],
  },
  {
    id: 'mjukost',
    emoji: '🧀',
    tags: ['en:cream-cheeses', 'en:spreadable-cheeses'],
    words: ['mjukost', 'farskost', 'philadelphia'],
    measures: [msk(15), tsk(5)],
  },
  {
    id: 'keso',
    emoji: '🥛',
    tags: ['en:cottage-cheeses'],
    words: ['keso', 'cottage'],
    measures: [dl(100), msk(15)],
  },
  {
    id: 'yoghurt',
    emoji: '🥛',
    // Inte en:fermented-milk-products: där ligger osten också.
    tags: ['en:yogurts', 'en:fermented-milks', 'en:quarks', 'en:skyrs'],
    words: ['yoghurt', 'yogurt', 'filmjolk', 'fil', 'afil', 'kvarg', 'skyr', 'kesella', 'ymer'],
    whole: 250,
    measures: [{ id: 'skal', label: 'Skål', unit: '1 skål (2 dl)', amount: 200, note: '2 dl' }, dl(100, null)],
  },
  {
    id: 'gradde',
    emoji: '🥛',
    tags: ['en:creams', 'en:sour-creams', 'en:cooking-creams', 'en:whipping-creams'],
    words: ['gradde', 'graddfil', 'fraiche', 'smetana'],
    measures: [msk(15), dl(100)],
  },
  {
    id: 'ost',
    emoji: '🧀',
    tags: ['en:cheeses'],
    words: ['ost', 'prastost', 'herrgard', 'gouda', 'cheddar', 'brie', 'mozzarella', 'parmesan', 'halloumi', 'feta'],
    measures: [{ ...skiva(10), note: 'hyvlad, ca 10 g' }, { id: 'bit', label: 'Bit', unit: '1 bit', amount: 30, countable: true }],
  },
  {
    id: 'sas',
    emoji: '🥫',
    tags: ['en:sauces', 'en:condiments', 'en:mayonnaises', 'en:ketchup', 'en:mustards', 'en:salad-dressings', 'en:dips'],
    words: ['ketchup', 'senap', 'majonnas', 'dressing', 'sas', 'aioli', 'bearnaise', 'remoulad', 'dipp', 'salsa', 'pesto'],
    measures: [msk(15), dl(100)],
  },
  {
    id: 'olja',
    emoji: '🫗',
    tags: ['en:vegetable-oils', 'en:olive-oils', 'en:cooking-oils'],
    words: ['olja'],
    measures: [msk(14), tsk(5)],
  },
  {
    id: 'chips',
    emoji: '🍟',
    tags: ['en:crisps', 'en:potato-crisps', 'en:salty-snacks', 'en:popcorn', 'en:tortilla-chips'],
    words: ['chips', 'ostbagar', 'popcorn', 'nachos', 'snacks'],
    only: 'g',
    whole: 60,
    measures: [{ id: 'skal', label: 'Skål', unit: '1 skål', amount: 30 }, { id: 'nave', label: 'Näve', unit: '1 näve', amount: 15 }],
  },
  {
    id: 'choklad',
    emoji: '🍫',
    tags: ['en:chocolates', 'en:chocolate-bars'],
    words: ['choklad'],
    only: 'g',
    whole: 100,
    measures: [
      { id: 'rad', label: 'Rad', unit: '1 rad', amount: 25, note: '4 bitar', amounts: [0.5, 1, 2, 3, 4] },
      { id: 'bit', label: 'Bit', unit: '1 bit', amount: 6, countable: true, amounts: [1, 2, 4, 6, 8] },
    ],
  },
  {
    id: 'godis',
    emoji: '🍬',
    tags: ['en:candies', 'en:confectioneries', 'en:gummies'],
    words: ['godis', 'lakrits', 'kola', 'skumgodis'],
    only: 'g',
    whole: 80,
    measures: [{ id: 'nave', label: 'Näve', unit: '1 näve', amount: 25 }],
  },
  {
    id: 'kex',
    emoji: '🍪',
    tags: ['en:biscuits', 'en:cookies', 'en:crackers'],
    words: ['kex', 'kakor', 'cookies', 'digestive', 'ballerina', 'singoalla'],
    only: 'g',
    measures: [{ id: 'st', label: 'Kex', unit: '1 st', amount: 12, countable: true, amounts: [1, 2, 3, 4, 6], qty: 2 }],
  },
  {
    id: 'glass',
    emoji: '🍦',
    tags: ['en:ice-creams', 'en:frozen-desserts'],
    words: ['glass'],
    whole: 150,
    measures: [{ id: 'kula', label: 'Kula', unit: '1 kula', amount: 50, amountMl: 90, amounts: [1, 2, 3, 4] }],
  },
  {
    id: 'vin',
    emoji: '🍷',
    tags: ['en:wines'],
    words: ['vin'],
    measures: [{ id: 'glas', label: 'Glas', unit: '1 glas (15 cl)', amount: 150, note: '15 cl' }],
  },
  {
    id: 'dryck',
    tags: [
      'en:milks',
      'en:plant-based-milk-alternatives',
      'en:juices',
      'en:fruit-juices',
      'en:nectars',
      'en:sodas',
      'en:carbonated-drinks',
      'en:soft-drinks',
      'en:iced-teas',
      'en:energy-drinks',
      'en:smoothies',
    ],
    words: ['mjolk', 'dryck', 'juice', 'lask', 'cola', 'nektar', 'smoothie', 'lemonad'],
    whole: 500,
    measures: [{ id: 'glas', label: 'Glas', unit: '1 glas (2 dl)', amount: 200, note: '2 dl' }, dl(100, null)],
  },
  {
    id: 'knacke',
    emoji: '🍞',
    tags: ['en:crispbreads', 'en:rusks', 'en:rice-cakes'],
    words: ['knacke', 'knackebrod', 'wasa', 'skorpor', 'skorpa', 'riskakor', 'riskaka'],
    measures: [skiva(12)],
  },
  {
    id: 'brodst',
    emoji: '🫓',
    tags: ['en:tortillas', 'en:wraps', 'en:flatbreads', 'en:bagels', 'en:burger-buns', 'en:hot-dog-buns'],
    words: ['tortilla', 'wrap', 'wraps', 'pita', 'pitabrod', 'tunnbrod', 'bagel', 'hamburgerbrod', 'korvbrod'],
    measures: [{ id: 'st', label: 'Styck', unit: '1 st', amount: 50, countable: true, amounts: [1, 2, 3, 4] }],
  },
  {
    id: 'brod',
    emoji: '🍞',
    tags: ['en:breads', 'en:sliced-breads'],
    words: ['brod', 'limpa', 'toast', 'formfranska', 'lingongrova', 'levain'],
    measures: [skiva(35)],
  },
  {
    id: 'pastej',
    emoji: '🍞',
    tags: ['en:pates', 'en:liver-pates'],
    words: ['leverpastej', 'pastej'],
    measures: [{ ...skiva(20), note: 'till en macka' }],
  },
  {
    id: 'kaviar',
    emoji: '🐟',
    tags: ['en:fish-roes'],
    words: ['kaviar', 'kalles'],
    measures: [msk(12)],
  },
  {
    id: 'palagg',
    emoji: '🥓',
    tags: ['en:hams', 'en:salamis', 'en:cold-cuts'],
    words: ['skinka', 'salami', 'palagg', 'rostbiff', 'pastrami'],
    measures: [skiva(8, 2)],
  },
  {
    id: 'kott',
    emoji: '🥩',
    tags: ['en:meats', 'en:poultries', 'en:fishes', 'en:fish-fillets', 'en:sausages'],
    words: ['fars', 'file', 'kyckling', 'lax', 'torsk', 'biff', 'kotlett', 'entrecote', 'kottbullar', 'korv'],
    measures: [portion(125)],
  },
  {
    id: 'agg',
    emoji: '🥚',
    tags: ['en:eggs', 'en:chicken-eggs'],
    words: ['agg'],
    measures: [{ id: 'st', label: 'Ägg', unit: '1 ägg', amount: 55, countable: true, amounts: [1, 2, 3, 4] }],
  },
  {
    id: 'musli',
    emoji: '🥣',
    tags: ['en:mueslis', 'en:granolas'],
    words: ['musli', 'granola'],
    measures: [dl(45)],
  },
  {
    id: 'gryn',
    emoji: '🥣',
    tags: ['en:rolled-oats', 'en:oat-flakes'],
    words: ['havregryn', 'gryn'],
    measures: [dl(35)],
  },
  {
    id: 'flingor',
    emoji: '🥣',
    tags: ['en:breakfast-cereals'],
    words: ['flingor', 'cornflakes', 'fras', 'puffar'],
    measures: [{ id: 'skal', label: 'Skål', unit: '1 skål', amount: 30 }, dl(13)],
  },
  {
    id: 'pasta',
    emoji: '🍝',
    tags: ['en:pastas', 'en:dry-pastas'],
    words: ['pasta', 'spaghetti', 'makaroner', 'penne', 'fusilli', 'tagliatelle', 'nudlar'],
    measures: [portion(75, 'ca 75 g okokt')],
  },
  {
    id: 'ris',
    emoji: '🍚',
    tags: ['en:rices'],
    words: ['ris', 'bulgur', 'couscous', 'quinoa', 'matvete'],
    measures: [portion(60, 'ca 60 g okokt')],
  },
  {
    id: 'maltid',
    emoji: '🍲',
    tags: ['en:meals', 'en:pizzas', 'en:frozen-ready-meals', 'en:ready-meals'],
    words: ['pizza', 'lasagne', 'pirog'],
    whole: 700,
    measures: [portion(350)],
  },
]

const BY_ID = new Map(KINDS.map((k) => [k.id, k]))

export const kindById = (id: string | undefined): Kind | undefined => (id ? BY_ID.get(id) : undefined)

/** Ett ord i namnet stämmer med sökordet, också i sammansatta ord: "herrgardsost" är "ost". */
function matches(word: string, key: string): boolean {
  return word === key || (word.endsWith(key) && word.length >= key.length + 3) || (key.length >= 5 && word.startsWith(key))
}

/** Varans typ, först från kategorierna i Open Food Facts och sedan från namnet. */
export function kindFor(name: string, tags: string[] = [], measure?: 'g' | 'ml'): string | undefined {
  const allowed = KINDS.filter((k) => !k.only || !measure || k.only === measure)
  const byTag = allowed.find((k) => k.tags.some((t) => tags.includes(t)))
  if (byTag) return byTag.id
  const words = normalize(name).split(' ').filter(Boolean)
  return allowed.find((k) => k.words.some((key) => words.some((w) => matches(w, key))))?.id
}
