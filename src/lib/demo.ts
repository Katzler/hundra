// Testdata för utveckling: ett par månader av rimliga dagar runt 100 poäng.

import { FOODS } from '../data/foods'
import { addDays, type DateKey } from './dates'
import { budgetFor, type BudgetPeriod, type Entry } from './calc'
import { uid } from '../store/useStore'

const MEALS = [
  ['kaffe-mjolk', 'macka-ost', 'macka-ost'],
  ['grot', 'kaffe-mjolk', 'banan'],
  ['yoghurt-musli', 'kaffe'],
  ['kyckling-ris', 'sallad'],
  ['bolognese'],
  ['dagens-lunch'],
  ['matlada', 'apple'],
  ['lax-potatis'],
  ['kottbullar-mos', 'lask'],
  ['tacos', 'ol'],
  ['pizza'],
  ['soppa', 'brodskiva', 'brodskiva'],
  ['kanelbulle', 'latte'],
  ['chips-nave', 'chips-nave'],
  ['vin', 'vin'],
  ['godis-nave'],
]

const byId = new Map(FOODS.map((f) => [f.id, f]))

export function demoEntries(today: DateKey, history: BudgetPeriod[], days = 60): Entry[] {
  const out: Entry[] = []
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = days; i >= 1; i--) {
    const date = addDays(today, -i)
    if (rand() < 0.15) continue // glömda dagar
    const target = budgetFor(date, history) * (0.72 + rand() * 0.3)
    let kcal = 0
    const qty = new Map<string, number>()
    while (kcal < target) {
      const meal = MEALS[Math.floor(rand() * MEALS.length)]
      for (const id of meal) {
        qty.set(id, (qty.get(id) ?? 0) + 1)
        kcal += byId.get(id)!.kcal
      }
    }
    for (const [id, q] of qty) {
      const f = byId.get(id)!
      out.push({ id: uid(), date, foodId: id, name: f.name, emoji: f.emoji, unit: f.unit, kcalPerUnit: f.kcal, qty: q, at: i })
    }
  }
  return out
}
