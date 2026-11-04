// Varor från en förpackning: näringsvärdet står per 100 g eller 100 ml, men man äter en portion,
// en hel förpackning eller ett glas. Här räknas de måtten fram.

import type { Food, Per100 } from '../data/foods'
import { roundMacros, scaleMacros, type Macros } from './calc'

export type MeasureId = 'portion' | 'forpackning' | 'glas' | 'hundra'

export type Measure = {
  id: MeasureId
  label: string
  note?: string
  unit: string
  kcal: number
  /** Måttet i gram eller ml, t.ex. 25 för en portion på 25 g. */
  amount: number
  amounts?: number[]
}

/** Ett glas är 2 dl, som i resten av matlistan. */
const GLASS_ML = 200

/** Under det här räknas en hel förpackning som en portion, t.ex. en burk läsk eller en chokladbit. */
const SMALL_PACK = 400
const SMALL_PACK_KCAL = 700

const decimal = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** "30 g", "330 ml", "1,5 l", "1 kg". */
export function sizeText(n: number, measure: Per100['measure']): string {
  if (n >= 1000) return `${decimal(n / 1000)} ${measure === 'ml' ? 'l' : 'kg'}`
  return `${decimal(n)} ${measure}`
}

const kcalFor = (p: Per100, amount: number) => Math.round(((p.kcal * amount) / 100) * 10) / 10

/** Måtten som går att välja, med portion och förpackning bara när de är kända. */
export function measures(p: Per100): Measure[] {
  const out: Measure[] = []
  if (p.serving) {
    const size = sizeText(p.serving, p.measure)
    out.push({ id: 'portion', label: 'Portion', note: size, unit: `1 portion (${size})`, kcal: kcalFor(p, p.serving), amount: p.serving })
  }
  if (p.pack && p.pack !== p.serving) {
    const size = sizeText(p.pack, p.measure)
    out.push({ id: 'forpackning', label: 'Förpackning', note: size, unit: `1 förpackning (${size})`, kcal: kcalFor(p, p.pack), amount: p.pack })
  }
  // Dryck i stora förpackningar dricker man i glas.
  if (p.measure === 'ml' && p.serving !== GLASS_ML && (!p.pack || p.pack >= 500)) {
    out.push({ id: 'glas', label: 'Glas', note: '2 dl', unit: '1 glas (2 dl)', kcal: kcalFor(p, GLASS_ML), amount: GLASS_ML })
  }
  out.push({ id: 'hundra', label: `100 ${p.measure}`, unit: `100 ${p.measure}`, kcal: kcalFor(p, 100), amount: 100, amounts: [0.5, 1, 1.5, 2, 3] })
  return out
}

/** Måttet man oftast äter: portionen, en liten förpackning, ett glas eller 100 g. */
export function defaultMeasure(p: Per100): Measure {
  const all = measures(p)
  const pick = (id: MeasureId) => all.find((m) => m.id === id)
  const pack = pick('forpackning')
  const smallPack = pack && p.pack! <= SMALL_PACK && pack.kcal <= SMALL_PACK_KCAL ? pack : undefined
  return pick('portion') ?? smallPack ?? pick('glas') ?? pick('hundra')!
}

/** Måttet som en rad i loggen eller en vara har, utifrån enheten. */
export function measureByUnit(p: Per100, unit: string): Measure | undefined {
  return measures(p).find((m) => m.unit === unit)
}

/** Enhet och kcal som varan sparas med: förvalt mått. */
export function packagedBase(p: Per100): { unit: string; kcal: number } {
  const m = defaultMeasure(p)
  return { unit: m.unit, kcal: m.kcal }
}

/**
 * Näringen på förpackningen står per 100 g, men varan sparar den per enhet, som alla andra
 * varor. `macrosToUnit` räknar om till det förvalda måttet, `macrosToPer100` tillbaka.
 */
export function macrosToUnit(p: Per100, macros100: Macros): Macros {
  return roundMacros(scaleMacros(macros100, defaultMeasure(p).amount / 100))
}

export function macrosToPer100(p: Per100, unit: string, macros: Macros): Macros {
  const m = measureByUnit(p, unit) ?? defaultMeasure(p)
  return roundMacros(scaleMacros(macros, 100 / m.amount))
}

/**
 * En rad i dagens logg efter att en egen vara ändrats. Rader med ett annat mått än förvalet,
 * t.ex. 100 g, behåller sitt mått men får det nya näringsvärdet.
 */
export function rowAfterEdit(
  before: Food,
  after: Food,
  row: { name: string; emoji: string; unit: string; kcalPerUnit: number },
): { name: string; emoji: string; unit: string; kcalPerUnit: number } {
  const named = { name: after.name, emoji: after.emoji }
  const measure = before.per100 ? measureByUnit(before.per100, row.unit) : undefined
  if (measure && after.per100) {
    const same = measures(after.per100).find((m) => m.id === measure.id)
    if (same) return { ...named, unit: same.unit, kcalPerUnit: same.kcal }
  }
  if (row.unit === before.unit) return { ...named, unit: after.unit, kcalPerUnit: after.kcal }
  return { ...named, unit: row.unit, kcalPerUnit: row.kcalPerUnit }
}
