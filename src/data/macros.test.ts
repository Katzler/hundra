import { describe, expect, it } from 'vitest'
import { macroKcal } from '../lib/calc'
import { FOODS } from './foods'
import { MACROS } from './macros'

describe('näringsvärden', () => {
  it('varje vara i grundlistan har protein, fett och kolhydrater', () => {
    expect(FOODS.filter((f) => !f.macros).map((f) => f.id)).toEqual([])
  })

  it('inga värden för varor som inte finns', () => {
    const ids = new Set(FOODS.map((f) => f.id))
    expect(Object.keys(MACROS).filter((id) => !ids.has(id))).toEqual([])
  })

  it('värdena är gram, aldrig negativa', () => {
    expect(FOODS.filter((f) => f.macros!.some((g) => !Number.isFinite(g) || g < 0)).map((f) => f.id)).toEqual([])
  })

  // Fångar skrivfel. Fiber ger lite energi som inte syns här, och i alkohol kommer det mesta från alkoholen.
  it('energin i näringen stämmer ungefär med varans kcal', () => {
    const off = FOODS.flatMap((f) => {
      const e = macroKcal(f.macros!)
      const slack = Math.max(f.kcal * 0.15, 10)
      const bad = f.category === 'alkohol' ? e > f.kcal + slack : Math.abs(e - f.kcal) > slack
      return bad ? [`${f.id}: ${f.kcal} kcal men ${Math.round(e)} i näringen`] : []
    })
    expect(off).toEqual([])
  })
})
