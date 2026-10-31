// Snabbval när man trycker på en vara: storlek, tillagning, fetthalt, enhet och så vidare.
// Varje vara får de frågor som är vanligast för just den. Valen räknas om till en vanlig
// rad med eget namn, egen enhet och egna kcal, så att loggen ser ut som förut.

import { formatQty } from '../lib/calc'
import type { Food } from './foods'

/** Ett svar på en fråga. */
export type Option = {
  id: string
  label: string
  /** Liten text under, t.ex. "ca 150 g". */
  note?: string
  /** Skalar kcal. */
  factor?: number
  /** Lägger till kcal per enhet innan storleken räknas in, t.ex. fett vid stekning. */
  add?: number
  /** Ersätter varans kcal per portion, t.ex. för en annan fetthalt. */
  kcal?: number
  /** Ersätter enheten, t.ex. "1 msk". */
  unit?: string
  /** Läggs till namnet, med eget skiljetecken: ", stekt" eller " 2 %". */
  tag?: string
  /** Snabbval för mängden när det här svaret är valt. */
  amounts?: number[]
  /** Mängden man oftast tar när det här svaret väljs. */
  qty?: number
}

export type Question = { id: string; title: string; options: Option[]; default: string }

export type Picks = Record<string, string>

/** Senaste valet för en vara, så att nästa gång går på ett tryck. */
export type LastChoice = { picks: Picks; qty: number }

export const DEFAULT_AMOUNTS = [0.5, 1, 1.5, 2, 3]

// ——— Byggstenar ———

const size = (
  title = 'Storlek',
  notes: [string?, string?, string?] = [],
  labels = ['Liten', 'Normal', 'Stor'],
  factors = [0.75, 1.35],
): Question => ({
  id: 'storlek',
  title,
  default: 'normal',
  options: [
    { id: 'liten', label: labels[0], note: notes[0], factor: factors[0], tag: `, ${labels[0].toLowerCase()}` },
    { id: 'normal', label: labels[1], note: notes[1] },
    { id: 'stor', label: labels[2], note: notes[2], factor: factors[1], tag: `, ${labels[2].toLowerCase()}` },
  ],
})

const portion = (notes: [string?, string?, string?] = []): Question => ({
  id: 'portion',
  title: 'Portion',
  default: 'normal',
  options: [
    { id: 'liten', label: 'Liten', note: notes[0], factor: 0.7, tag: ', liten portion' },
    { id: 'normal', label: 'Normal', note: notes[1] },
    { id: 'stor', label: 'Stor', note: notes[2], factor: 1.4, tag: ', stor portion' },
  ],
})

const lot = (labels = ['Lite', 'Normalt', 'Mycket']): Question => ({
  id: 'mangd',
  title: 'Hur mycket',
  default: 'normal',
  options: [
    { id: 'lite', label: labels[0], factor: 0.5, tag: `, ${labels[0].toLowerCase()}` },
    { id: 'normal', label: labels[1] },
    { id: 'mycket', label: labels[2], factor: 1.8, tag: `, ${labels[2].toLowerCase()}` },
  ],
})

/** Kött och fisk: tillagningen avgör hur mycket fett som följer med. */
const cook = (fat = 40, opts: { breaded?: boolean; boiled?: string } = {}): Question => ({
  id: 'tillagning',
  title: 'Tillagning',
  default: 'ugn',
  options: [
    { id: 'ugn', label: opts.boiled ?? 'Ugn / kokt', note: 'utan fett' },
    { id: 'stekt', label: 'Stekt', note: 'i smör/olja', add: fat, tag: ', stekt' },
    { id: 'grillad', label: 'Grillad', add: Math.round(fat / 4), tag: ', grillad' },
    ...(opts.breaded ? [{ id: 'panerad', label: 'Panerad', add: fat * 3, tag: ', panerad' }] : []),
  ],
})

/** Dryck i glas: litet, vanligt eller stort glas. */
const glass = (notes: [string, string, string] = ['1½ dl', '2 dl', '3 dl']): Question => ({
  id: 'storlek',
  title: 'Storlek',
  default: 'normal',
  options: [
    { id: 'liten', label: 'Litet glas', note: notes[0], factor: 0.75, tag: ', litet glas' },
    { id: 'normal', label: 'Glas', note: notes[1] },
    { id: 'stor', label: 'Stort glas', note: notes[2], factor: 1.5, tag: ', stort glas' },
  ],
})

const cupSize: Question = {
  id: 'storlek',
  title: 'Storlek',
  default: 'normal',
  options: [
    { id: 'liten', label: 'Liten', factor: 0.7, tag: ', liten' },
    { id: 'normal', label: 'Mellan' },
    { id: 'stor', label: 'Stor', factor: 1.4, tag: ', stor' },
  ],
}

const can = (big = 1.5): Question => ({
  id: 'storlek',
  title: 'Storlek',
  default: 'burk',
  options: [
    { id: 'glas', label: 'Glas', note: '2 dl', factor: 0.6, tag: ', glas', unit: '1 glas' },
    { id: 'burk', label: 'Burk', note: '33 cl' },
    { id: 'flaska', label: 'Flaska', note: '50 cl', factor: big, tag: ', 50 cl', unit: '1 flaska (50 cl)' },
  ],
})

const MSK_PER_DL = 100 / 15

/**
 * Sked och deciliter för varor som mäts så. `base` är hur många matskedar varans portion är,
 * `unit` vilken enhet som är förvald och `qty` hur många av den.
 */
const spoons = (base: number, unit: 'tsk' | 'msk' | 'dl', qty = 1): Question => ({
  id: 'enhet',
  title: 'Enhet',
  default: unit,
  options: [
    { id: 'tsk', label: 'tsk', factor: 1 / 3 / base, unit: '1 tsk', amounts: [1, 2, 3, 4], qty: unit === 'tsk' ? qty : 1 },
    { id: 'msk', label: 'msk', factor: 1 / base, unit: '1 msk', amounts: [1, 2, 3, 4, 6], qty: unit === 'msk' ? qty : 1 },
    { id: 'dl', label: 'dl', factor: MSK_PER_DL / base, unit: '1 dl', amounts: [0.5, 1, 1.5, 2, 3], qty: unit === 'dl' ? qty : 1 },
  ],
})

/** Yoghurt, kvarg och fil: portionen är 2 dl, som också är ungefär 200 g. */
const cup = (portion = '1 portion (2 dl)', portionDl = 2): Question => ({
  id: 'enhet',
  title: 'Enhet',
  default: 'portion',
  options: [
    { id: 'portion', label: 'Portion', unit: portion, amounts: [0.5, 1, 1.5, 2] },
    { id: 'dl', label: 'dl', factor: 1 / portionDl, unit: '1 dl', amounts: [0.5, 1, 1.5, 2, 3], qty: 1 },
    { id: 'msk', label: 'msk', factor: 0.15 / portionDl, unit: '1 msk', amounts: [1, 2, 3, 4, 6], qty: 2 },
    { id: 'tsk', label: 'tsk', factor: 0.05 / portionDl, unit: '1 tsk', amounts: [1, 2, 3, 4] },
    { id: 'gram', label: '100 g', factor: 1 / portionDl, unit: '100 g', amounts: [0.5, 1, 1.5, 2, 2.5] },
  ],
})

/**
 * Ris, pasta och gryn: portionen räknas kokt, men många mäter upp okokt. `dl` är portionens
 * kokta mängd. `raw` är den okokta enheten med sina kcal och hur mycket kokt den blir.
 */
const cooked = (dl: number, raw: { unit: '1 dl' | '100 g'; kcal: number; note: string }, extra: Option[] = []): Question => ({
  id: 'enhet',
  title: 'Mått',
  default: 'portion',
  options: [
    { id: 'portion', label: 'Portion', note: `${formatQty(dl)} dl kokt`, amounts: [0.5, 1, 1.5, 2] },
    { id: 'kokt', label: 'dl kokt', factor: 1 / dl, unit: '1 dl kokt', amounts: [1, 2, 2.5, 3, 4], qty: dl },
    { id: 'okokt', label: `${raw.unit.replace('1 ', '')} okokt`, note: raw.note, kcal: raw.kcal, unit: `${raw.unit} okokt`, amounts: [0.5, 1, 1.5, 2], qty: 1 },
    ...extra,
  ],
})

const GRYN = (kcal: number) => ({ unit: '1 dl' as const, kcal, note: '≈ 3 dl kokt' })
const PASTA = (kcal: number) => ({ unit: '100 g' as const, kcal, note: '≈ 3½ dl kokt' })

const fat = (options: [string, number][], def: string, title = 'Fetthalt'): Question => ({
  id: 'fetthalt',
  title,
  default: def,
  options: options.map(([label, kcal]) => ({ id: label, label, kcal, tag: ` ${label}` })),
})

const milk: Question = {
  id: 'mjolk',
  title: 'Mjölk',
  default: 'mellan',
  options: [
    { id: 'mellan', label: 'Mellan' },
    { id: 'latt', label: 'Lätt', factor: 0.8, tag: ', lättmjölk' },
    { id: 'standard', label: 'Standard', factor: 1.15, tag: ', standardmjölk' },
    { id: 'havre', label: 'Havre', factor: 1.05, tag: ', havremjölk' },
  ],
}

// ——— Varorna ———

const MEAT = [size(), cook()]

/** Smörgåsar: brödet och smöret avgör mest, pålägget står i namnet. */
const SANDWICH: Question[] = [
  { id: 'brod', title: 'Bröd', default: 'skiva', options: [{ id: 'skiva', label: 'Brödskiva' }, { id: 'knacke', label: 'Knäcke', add: -40, tag: ' på knäcke' }, { id: 'fralla', label: 'Fralla', add: 90, tag: ' på fralla' }] },
  { id: 'smor', title: 'Smör', default: 'med', options: [{ id: 'med', label: 'Med smör' }, { id: 'utan', label: 'Utan', add: -35, tag: ', utan smör' }] },
]

/** Frågor per vara. En tom lista betyder att varan läggs till direkt, utan frågor. */
const BY_FOOD: Record<string, Question[]> = {
  // Frukost
  'grekisk-yoghurt': [fat([['10 %', 220], ['5 %', 180], ['2 %', 140], ['0 %', 110]], '10 %'), cup()],
  'yoghurt': [fat([['3 %', 130], ['0,5 %', 85]], '3 %'), cup()],
  'kvarg': [fat([['0,2 %', 130], ['3 %', 180], ['Vanilj', 190]], '0,2 %', 'Sort'), cup()],
  'grot': [{ id: 'vatska', title: 'Kokt på', default: 'vatten', options: [{ id: 'vatten', label: 'Vatten' }, { id: 'mjolk', label: 'Mjölk', note: '2 dl per dl gryn', add: 90, tag: ', på mjölk' }, { id: 'havre', label: 'Havredryck', note: '2 dl per dl gryn', add: 90, tag: ', på havredryck' }] }],
  'filmjolk-musli': [portion()],
  'bacon': [],
  'aggrora': [],
  'omelett': [],
  'amerikanska-pannkakor': [],
  'smoothie': [glass()],

  // Bröd
  'brodskiva': [{ id: 'sort', title: 'Sort', default: 'limpa', options: [{ id: 'limpa', label: 'Limpa', note: 'mjukt bröd' }, { id: 'formbrod', label: 'Formbröd', note: 'rostbröd', kcal: 70, tag: ', formbröd' }, { id: 'grovt', label: 'Grovt', note: 'fullkorn, frön', kcal: 100, tag: ', grovt' }, { id: 'surdeg', label: 'Surdeg', kcal: 120, tag: ', surdeg' }] }],
  'macka-ost': SANDWICH,
  'macka-skinka': SANDWICH,
  'macka-agg': SANDWICH,
  'macka-avokado': SANDWICH,
  'macka-jordnot': SANDWICH,

  // Potatis, pasta & ris
  'potatis': [size('Storlek', ['ca 50 g', 'ca 90 g', 'ca 130 g'], ['Liten', 'Medel', 'Stor'])],
  'bakad-potatis': [size()],
  'sotpotatis': [size()],
  // Kokt mängd är förval. Okokt finns för den som mäter upp innan, 1 dl okokt ris blir ca 3 dl kokt.
  'pasta': [cooked(3, PASTA(360))],
  'fullkornspasta': [cooked(3, PASTA(340))],
  'nudlar': [cooked(3, PASTA(360), [{ id: 'snabb', label: 'Snabbnudlar', note: '1 paket', kcal: 380, unit: '1 paket', tag: ', snabbnudlar', amounts: [1, 2], qty: 1 }])],
  'ris': [cooked(2.5, GRYN(300))],
  'bulgur': [cooked(2.5, GRYN(290))],
  'couscous': [cooked(2.5, GRYN(270))],
  'quinoa': [cooked(2, GRYN(310))],
  'matvete': [cooked(2.5, GRYN(270))],
  'rosti': [],
  'pommes': [size('Storlek', ['ca 80 g', 'ca 115 g', 'ca 150 g'], ['Liten', 'Mellan', 'Stor'], [0.7, 1.35])],

  // Kött, fisk & protein
  'kycklingfile': [size('Storlek', ['ca 110 g', 'ca 150 g', 'ca 200 g'], ['Liten', 'Medium', 'Stor']), cook()],
  'kycklingklubba': MEAT,
  'lax': [size('Storlek', ['ca 90 g', 'ca 125 g', 'ca 170 g']), cook(40)],
  'vit-fisk': [size('Storlek', ['ca 90 g', 'ca 125 g', 'ca 170 g']), cook(40, { breaded: true })],
  'biff': [size('Storlek', ['ca 150 g', 'ca 200 g', 'ca 270 g']), cook(30, { boiled: 'Ugn' })],
  'flaskkotlett': [size(), cook(30, { breaded: true, boiled: 'Ugn' })],
  'flaskfile': [portion(['ca 100 g', 'ca 150 g', 'ca 200 g']), cook(30, { boiled: 'Ugn' })],
  'flaskkarre': [size(), cook(30, { boiled: 'Ugn' })],
  'lammkotlett': [],
  'hamburgerbiff': [size('Storlek', ['ca 90 g', 'ca 150 g', 'ca 200 g'])],
  'kottfars': [portion(['ca 90 g', 'ca 125 g', 'ca 175 g'])],
  'vegofars': [portion(['ca 90 g', 'ca 125 g', 'ca 175 g'])],
  'tofu': [cook(40, { boiled: 'Naturell' })],
  'halloumi': [],
  'grillkorv': [cook(20, { boiled: 'Kokt' })],
  'kottbullar': [],
  'fiskpinnar': [],
  'vegobullar': [],
  'prinskorv': [],
  'falukorv': [],
  'kycklingvingar': [],
  'falafel-bollar': [],
  'surimi': [],
  'tonfisk': [fat([['i vatten', 150], ['i olja', 280]], 'i vatten', 'Sort')],
  'bonor': [{ id: 'enhet', title: 'Mått', default: 'portion', options: [{ id: 'portion', label: 'Portion', note: '1½ dl kokta' }, { id: 'paket', label: 'Burk / paket', note: 'ca 250 g avrunnet', kcal: 260, unit: '1 burk' }, { id: 'torra', label: 'dl torra', note: '≈ 2½ dl kokta', kcal: 290, unit: '1 dl torra', amounts: [0.5, 1, 1.5, 2] }] }],
  'sardiner': [],
  'makrill': [],
  'skinka': [],
  'salami': [],
  'kalkon': [],
  'parmaskinka': [],
  'rostbiff': [],
  'kycklingpalagg': [],
  'leverpastej': [],
  'rokt-lax': [],
  'gravad-lax': [],
  'kassler': [],
  'chorizo': [],

  // Grönt & frukt: frukt i olika storlekar, grönsaker räknas sällan.
  'banan': [size()],
  'apple': [size()],
  'paron': [size()],
  'apelsin': [size()],
  'persika': [size()],
  'mango': [size()],
  'avokado': [size()],
  'morot': [size()],
  'paprika': [size()],
  'vindruvor': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'torkad-frukt': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'fruktsallad': [portion()],
  'rotfrukter': [portion()],

  // Mejeri & ägg
  'agg': [{ id: 'tillagning', title: 'Tillagning', default: 'kokt', options: [{ id: 'kokt', label: 'Kokt' }, { id: 'stekt', label: 'Stekt', add: 35, tag: ', stekt' }] }],
  'ost': [fat([['28 %', 50], ['17 %', 40], ['10 %', 30]], '28 %')],
  'mjolk': [
    fat([['1,5 %', 90], ['0,5 %', 80], ['3 %', 120], ['Laktosfri', 90]], '1,5 %', 'Sort'),
    { id: 'enhet', title: 'Enhet', default: 'glas', options: [{ id: 'glas', label: 'Glas', note: '2 dl' }, { id: 'dl', label: 'dl', factor: 0.5, unit: '1 dl', amounts: [0.5, 1, 1.5, 2, 3] }] },
  ],
  'havremjolk': [{ id: 'enhet', title: 'Enhet', default: 'glas', options: [{ id: 'glas', label: 'Glas', note: '2 dl' }, { id: 'dl', label: 'dl', factor: 0.5, unit: '1 dl', amounts: [0.5, 1, 1.5, 2, 3] }] }],
  'filmjolk': [fat([['3 %', 120], ['1,5 %', 90], ['0,5 %', 75]], '3 %'), cup('2 dl')],
  'keso': [fat([['4 %', 100], ['1,5 %', 70]], '4 %'), cup('1 dl', 1)],
  'yoghurt-smak': [cup('2 dl')],
  'skyr': [{ id: 'enhet', title: 'Enhet', default: 'burk', options: [{ id: 'burk', label: 'Burk', note: '150 g', amounts: [0.5, 1, 1.5, 2] }, { id: 'dl', label: 'dl', factor: 0.7, unit: '1 dl' }, { id: 'gram', label: '100 g', factor: 0.67, unit: '100 g' }] }],
  'fetaost': [],
  'mozzarella': [],
  'brie': [],
  'chevre': [],

  // Måltider och snabbmat som räknas i styck
  // Fredagstacos räknas styckvis. Mjuka tortillas med köttfärs, ost och sås är vanligast.
  'tacos': [{ id: 'typ', title: 'Typ', default: 'mjuk', options: [{ id: 'mjuk', label: 'Mjuk tortilla', note: 'med fyllning', amounts: [1, 2, 3, 4, 5], qty: 3 }, { id: 'hard', label: 'Hårt skal', note: 'med fyllning', kcal: 180, tag: ', hårda skal', amounts: [1, 2, 3, 4, 5], qty: 3 }] }],
  'sushi': [],
  'dumplings': [],
  'kaldolmar': [],
  'kroppkakor': [],
  'blodpudding': [],
  'kraftor': [],
  'pannkakor': [],
  'nuggets': [],
  'varmkorv': [],
  'pirog': [],
  'pizzabit': [],
  'hamburgarmeny': [{ id: 'storlek', title: 'Storlek', default: 'mellan', options: [{ id: 'liten', label: 'Liten', factor: 0.8, tag: ', liten' }, { id: 'mellan', label: 'Mellan' }, { id: 'stor', label: 'Stor', factor: 1.2, tag: ', stor' }] }],
  'pizza': [{ id: 'storlek', title: 'Storlek', default: 'normal', options: [{ id: 'barn', label: 'Barnpizza', factor: 0.7, tag: ', barnpizza' }, { id: 'normal', label: 'Normal' }, { id: 'familj', label: 'Familj', note: 'delas ofta', factor: 2.5, tag: ', familjepizza' }] }],

  // Fika som räknas i styck
  'kaka': [],
  'kex': [],
  'pepparkakor': [],

  // Snacks
  'chips-nave': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'ostbagar': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'notter': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'godis-nave': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'lakrits': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'tortillachips': [lot(['Liten näve', 'Näve', 'Stor näve'])],
  'popcorn': [size('Storlek', [], ['Liten skål', 'Skål', 'Stor skål'])],
  'chips-pase': [size('Påse', ['ca 100 g', 'ca 175 g', 'ca 275 g'])],
  'godis-pase': [size('Påse', ['ca 100 g', 'ca 200 g', 'ca 300 g'], undefined, [0.5, 1.5])],
  'glass-skal': [],
  'mjukglass': [size()],

  // Dryck
  'vatten': [],
  'kaffe': [],
  'te': [],
  'lask-zero': [],
  'energidryck-zero': [],
  'kaffe-mjolk': [{ id: 'storlek', title: 'Storlek', default: 'kopp', options: [{ id: 'kopp', label: 'Kopp' }, { id: 'mugg', label: 'Mugg', factor: 1.6, tag: ', mugg' }] }],
  'latte': [cupSize, milk],
  'cappuccino': [cupSize, milk],
  'iskaffe': [cupSize, milk],
  'oboy': [{ id: 'storlek', title: 'Storlek', default: 'kopp', options: [{ id: 'kopp', label: 'Kopp' }, { id: 'mugg', label: 'Mugg', factor: 1.6, tag: ', mugg' }] }],
  'juice': [glass()],
  'saft': [glass()],
  'julmust': [glass()],
  'lask': [can()],
  'energidryck': [{ id: 'storlek', title: 'Storlek', default: 'liten', options: [{ id: 'liten', label: 'Burk', note: '25 cl' }, { id: 'stor', label: 'Stor burk', note: '50 cl', factor: 2, tag: ', 50 cl', unit: '1 burk (50 cl)' }] }],
  'proteinshake': [],
  'kombucha': [],
  'iste': [],
  'sportdryck': [],

  // Alkohol
  'ol': [
    { id: 'storlek', title: 'Storlek', default: 'burk', options: [{ id: 'burk', label: 'Burk', note: '33 cl' }, { id: 'stor', label: 'Stor', note: '40 cl', factor: 1.2, tag: ', 40 cl', unit: '40 cl' }, { id: 'halv', label: 'Halvliter', note: '50 cl', factor: 1.5, tag: ', 50 cl', unit: '50 cl' }] },
    { id: 'typ', title: 'Typ', default: 'lager', options: [{ id: 'lager', label: 'Lager', note: '5 %' }, { id: 'folkol', label: 'Folköl', note: '3,5 %', factor: 0.8, tag: ', folköl' }, { id: 'ipa', label: 'IPA', note: '6–7 %', factor: 1.35, tag: ', IPA' }] },
  ],
  'ol-stor': [],
  'lattol': [can()],
  'alkoholfri-ol': [can()],
  'vin': [{ id: 'storlek', title: 'Glas', default: 'normal', options: [{ id: 'litet', label: 'Litet', note: '12 cl', factor: 0.8, tag: ', litet glas' }, { id: 'normal', label: 'Normalt', note: '15 cl' }, { id: 'stort', label: 'Stort', note: '20 cl', factor: 1.33, tag: ', stort glas' }] }],
  'bubbel': [{ id: 'storlek', title: 'Glas', default: 'normal', options: [{ id: 'litet', label: 'Litet', note: '10 cl', factor: 0.8, tag: ', litet glas' }, { id: 'normal', label: 'Normalt', note: '12 cl' }, { id: 'stort', label: 'Stort', note: '15 cl', factor: 1.25, tag: ', stort glas' }] }],
  'vin-flaska': [],
  'cider': [can(), { id: 'typ', title: 'Typ', default: 'sot', options: [{ id: 'sot', label: 'Söt' }, { id: 'torr', label: 'Torr', factor: 0.65, tag: ', torr' }] }],
  'hard-seltzer': [],
  'drink': [
    { id: 'sprit', title: 'Sprit', default: 'enkel', options: [{ id: 'enkel', label: 'Enkel', note: '4 cl' }, { id: 'dubbel', label: 'Dubbel', note: '8 cl', add: 90, tag: ', dubbel' }] },
    { id: 'blandning', title: 'Blandad med', default: 'vanlig', options: [{ id: 'vanlig', label: 'Läsk / tonic' }, { id: 'zero', label: 'Sockerfritt', add: -100, tag: ', sockerfri' }] },
  ],
  'shot': [{ id: 'storlek', title: 'Storlek', default: 'fyra', options: [{ id: 'tva', label: '2 cl', factor: 0.5, unit: '2 cl' }, { id: 'fyra', label: '4 cl' }, { id: 'sex', label: '6 cl', factor: 1.5, unit: '6 cl' }] }],

  // Sås & tillbehör
  'smor': [
    { id: 'sort', title: 'Sort', default: 'smor', options: [{ id: 'smor', label: 'Smör / Bregott' }, { id: 'latt', label: 'Lätt', note: '40 %', factor: 0.55, tag: ', lätt' }] },
    lot(['Tunt', 'Klick', 'Rejält']),
  ],
  'gradde': [
    { id: 'sort', title: 'Sort', default: 'visp', options: [{ id: 'visp', label: 'Vispgrädde', note: '40 %' }, { id: 'mat', label: 'Matlagning', note: '15 %', factor: 0.45, tag: ', matlagningsgrädde' }, { id: 'kaffe', label: 'Kaffegrädde', note: '12 %', factor: 0.35, tag: ', kaffegrädde' }] },
    spoons(1, 'msk'),
  ],
  'sas': [spoons(MSK_PER_DL / 2, 'dl', 0.5)],
  'bearnaise': [spoons(MSK_PER_DL / 2, 'dl', 0.5)],
  'vaniljsas': [spoons(MSK_PER_DL / 2, 'dl', 0.5)],
  'kokosmjolk': [spoons(MSK_PER_DL / 2, 'dl', 0.5)],
}

/** Kategorier där nästan allt har samma fråga. Varor i BY_FOOD går före. */
const BY_CATEGORY: Partial<Record<Food['category'], Question[]>> = {
  frukost: [portion()],
  kolhydrat: [portion()],
  protein: [portion()],
  maltid: [portion()],
  snabbmat: [portion()],
  fika: [size()],
  dryck: [glass()],
  alkohol: [cupSize],
}

const SINGULAR: Record<string, string> = { st: 'st', skivor: 'skiva', bitar: 'bit', kulor: 'kula', ägg: 'ägg' }

/**
 * Varor som "3 skivor" eller "5 st" räknas styckvis: enheten blir 1 skiva och mängden börjar på 3.
 * Då blir en till skiva en till, inte 3 till. Egna varor behåller sin enhet.
 */
function counted(food: Food): { unit: string; kcal: number; n: number } | null {
  const m = /^(\d+) (st|skivor|bitar|kulor|ägg)$/.exec(food.unit)
  if (food.custom || !m || Number(m[1]) < 2) return null
  const n = Number(m[1])
  return { unit: `1 ${SINGULAR[m[2]]}`, kcal: Math.round((food.kcal / n) * 10) / 10, n }
}

/** Snabbval runt den vanliga mängden, och 1 för den som bara tar en: 1–5 för 3, 1 och 4–7 för 5, 5–15 för 10. */
function countAmounts(n: number): number[] {
  if (n > 6) return [n / 2, n * 0.75, n, n * 1.25, n * 1.5].map(Math.round)
  if (n <= 3) return [1, 2, 3, 4, 5].slice(0, n + 2)
  return [1, n - 1, n, n + 1, n + 2]
}

/** Om trycket på varan öppnar valen: frågor eller styckräkning. */
export function hasChoices(food: Food): boolean {
  return questionsFor(food).length > 0 || !!counted(food)
}

/** "1 msk", "2 msk", "1 tsk", "½ dl" och "1 dl" blir sked och deciliter. */
function spoonsFromUnit(unit: string): Question | null {
  const m = /^(½|\d+)\s*(tsk|msk|dl)( riven)?$/.exec(unit)
  if (!m) return null
  const n = m[1] === '½' ? 0.5 : Number(m[1])
  const unitName = m[2] as 'tsk' | 'msk' | 'dl'
  const msk = n * (unitName === 'tsk' ? 1 / 3 : unitName === 'dl' ? MSK_PER_DL : 1)
  return spoons(msk, unitName, n)
}

/** Frågorna för en vara. Egna varor har inga. */
export function questionsFor(food: Food): Question[] {
  if (food.custom) return []
  if (food.id in BY_FOOD) return BY_FOOD[food.id]
  const spoon = spoonsFromUnit(food.unit)
  if (spoon) return [spoon]
  return BY_CATEGORY[food.category] ?? []
}

/** Valen fyllda med förval där något saknas eller inte längre finns. */
export function fillPicks(questions: Question[], picks: Picks = {}): Picks {
  return Object.fromEntries(
    questions.map((q) => [q.id, q.options.some((o) => o.id === picks[q.id]) ? picks[q.id] : q.default]),
  )
}

export function chosenOptions(questions: Question[], picks: Picks): Option[] {
  const full = fillPicks(questions, picks)
  return questions.map((q) => q.options.find((o) => o.id === full[q.id])!)
}

/** Varan som den blir med valen: samma id, men eget namn, egen enhet och egna kcal per enhet. */
export function applyPicks(food: Food, picks: Picks): Food {
  const c = counted(food)
  const one = c ? { ...food, unit: c.unit, kcal: c.kcal } : food
  const options = chosenOptions(questionsFor(food), picks)
  if (!options.length) return one
  const base = options.reduce((k, o) => o.kcal ?? k, one.kcal)
  const add = options.reduce((s, o) => s + (o.add ?? 0), 0)
  const factor = options.reduce((f, o) => f * (o.factor ?? 1), 1)
  const kcal = Math.max(0, Math.round((base + add) * factor * 10) / 10)
  return {
    ...food,
    name: food.name + options.map((o) => o.tag ?? '').join(''),
    unit: options.reduce((u, o) => o.unit ?? u, one.unit),
    kcal,
  }
}

/** Snabbvalen för mängden med de här valen. */
export function amountsFor(food: Food, picks: Picks): number[] {
  const c = counted(food)
  return chosenOptions(questionsFor(food), picks).reduce<number[] | undefined>((a, o) => o.amounts ?? a, undefined) ?? (c ? countAmounts(c.n) : DEFAULT_AMOUNTS)
}

/** Mängden man oftast tar med de här valen, t.ex. 2 msk hummus. */
export function usualQty(food: Food, picks: Picks): number {
  return chosenOptions(questionsFor(food), picks).reduce((q, o) => o.qty ?? q, counted(food)?.n ?? 1)
}

/**
 * Varan och mängden som ett tryck på (+) eller en favorit lägger till. Varianten är senaste valet,
 * men mängden är alltid den vanliga: annars blev en favorit 2 potatisar för att man en gång tog två.
 */
export function preferred(food: Food, last?: LastChoice): { food: Food; qty: number; picks: Picks } {
  const questions = questionsFor(food)
  if (!hasChoices(food)) return { food, qty: 1, picks: {} }
  const picks = fillPicks(questions, last?.picks)
  return { food: applyPicks(food, picks), qty: usualQty(food, picks), picks }
}

const PLURAL: Record<string, string> = {
  skiva: 'skivor', bit: 'bitar', kula: 'kulor', burk: 'burkar', tallrik: 'tallrikar', skål: 'skålar', kopp: 'koppar',
  flaska: 'flaskor', portion: 'portioner', näve: 'nävar', klick: 'klickar', påse: 'påsar', låda: 'lådor', strut: 'strutar', hel: 'hela',
}

/** "2 msk", "1½ dl", "3 skivor", annars "2 × 2 skivor". */
export function amountText(qty: number, unit: string): string {
  const m = /^1 (\S+)(.*)$/.exec(unit)
  if (m) return `${formatQty(qty)} ${qty > 1 ? (PLURAL[m[1]] ?? m[1]) : m[1]}${m[2]}`
  return qty === 1 ? unit : `${formatQty(qty)} × ${unit}`
}

/** Raden under namnet i listan: de val som skiljer sig från förvalen, och mängden. */
export function choiceSummary(food: Food, picks: Picks, qty: number): string {
  const questions = questionsFor(food)
  const full = fillPicks(questions, picks)
  const labels = questions.filter((q) => full[q.id] !== q.default).map((q) => q.options.find((o) => o.id === full[q.id])!.label)
  return [...labels, amountText(qty, applyPicks(food, picks).unit)].join(' · ')
}
