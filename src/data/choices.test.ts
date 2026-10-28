import { describe, expect, it } from 'vitest'
import { amountText, applyPicks, choiceSummary, fillPicks, preferred, questionsFor, usualQty } from './choices'
import { FOODS } from './foods'

const food = (id: string) => FOODS.find((f) => f.id === id)!

describe('snabbval', () => {
  it('kycklingfilé frågar om storlek och tillagning', () => {
    expect(questionsFor(food('kycklingfile')).map((q) => q.id)).toEqual(['storlek', 'tillagning'])
  })

  it('förvalen ger varan som den står i listan', () => {
    const f = food('kycklingfile')
    const v = applyPicks(f, {})
    expect(v).toMatchObject({ name: f.name, unit: f.unit, kcal: f.kcal })
  })

  it('stor stekt kycklingfilé får fett och större portion', () => {
    const v = applyPicks(food('kycklingfile'), { storlek: 'stor', tillagning: 'stekt' })
    expect(v.name).toBe('Kycklingfilé, stor, stekt')
    expect(v.kcal).toBe(Math.round((180 + 40) * 1.35 * 10) / 10)
  })

  it('grekisk yoghurt: fetthalt och enhet', () => {
    const f = food('grekisk-yoghurt')
    expect(applyPicks(f, {}).name).toBe('Grekisk yoghurt 10 %')
    const v = applyPicks(f, { fetthalt: '2 %', enhet: 'dl' })
    expect(v).toMatchObject({ name: 'Grekisk yoghurt 2 %', unit: '1 dl', kcal: 70 })
  })

  it('varor som mäts i msk får sked och deciliter, med vanlig mängd', () => {
    const f = food('hummus')
    expect(questionsFor(f)[0].id).toBe('enhet')
    const picks = fillPicks(questionsFor(f))
    expect(picks.enhet).toBe('msk')
    expect(usualQty(f, picks)).toBe(2)
    expect(applyPicks(f, picks).kcal * 2).toBeCloseTo(f.kcal)
  })

  it('egna varor och vatten har inga frågor', () => {
    expect(questionsFor({ ...food('banan'), custom: true, category: 'egna' })).toEqual([])
    expect(questionsFor(food('vatten'))).toEqual([])
  })

  it('senaste valet blir förval, och val som inte finns längre faller tillbaka', () => {
    const f = food('kycklingfile')
    const p = preferred(f, { picks: { storlek: 'stor', tillagning: 'finns-inte' }, qty: 2 })
    expect(p.picks).toEqual({ storlek: 'stor', tillagning: 'ugn' })
    expect(p.qty).toBe(2)
    expect(p.food.name).toBe('Kycklingfilé, stor')
  })

  it('varje fråga har ett förval som finns och unika svar', () => {
    for (const f of FOODS)
      for (const q of questionsFor(f)) {
        expect(q.options.some((o) => o.id === q.default), `${f.id}/${q.id}`).toBe(true)
        expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length)
        expect(applyPicks(f, {}).kcal).toBeGreaterThanOrEqual(0)
      }
  })

  it('mängden skrivs naturligt', () => {
    expect(amountText(2, '1 msk')).toBe('2 msk')
    expect(amountText(1.5, '1 dl')).toBe('1½ dl')
    expect(amountText(2, '2 skivor')).toBe('2 × 2 skivor')
    expect(choiceSummary(food('kycklingfile'), { storlek: 'stor', tillagning: 'stekt' }, 1)).toBe('Stor · Stekt · 1 st')
  })
})
