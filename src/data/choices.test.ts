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

  it('senaste valet blir förval men mängden är den vanliga, och val som inte finns längre faller tillbaka', () => {
    const f = food('kycklingfile')
    const p = preferred(f, { picks: { storlek: 'stor', tillagning: 'finns-inte' }, qty: 2 })
    expect(p.picks).toEqual({ storlek: 'stor', tillagning: 'ugn' })
    expect(p.qty).toBe(1)
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

  it('ris och pasta räknas kokt, men kan mätas okokt', () => {
    const ris = food('ris')
    expect(ris.unit).toContain('kokt')
    expect(applyPicks(ris, { enhet: 'kokt' })).toMatchObject({ unit: '1 dl kokt', kcal: 104 })
    const okokt = applyPicks(ris, { enhet: 'okokt' })
    expect(okokt).toMatchObject({ unit: '1 dl okokt', kcal: 300 })
    expect(amountText(1, okokt.unit)).toBe('1 dl okokt')
    expect(applyPicks(food('pasta'), { enhet: 'okokt' }).unit).toBe('100 g okokt')
  })

  it('tacos räknas styckvis, tre mjuka som förval', () => {
    const p = preferred(food('tacos'))
    expect(p).toMatchObject({ qty: 3, food: { unit: '1 st', kcal: 280 } })
    expect(applyPicks(food('tacos'), { typ: 'hard' }).kcal).toBe(180)
  })

  it('flera skivor eller styck räknas ett i taget, med den vanliga mängden som förval', () => {
    const p = preferred(food('salami'))
    expect(p).toMatchObject({ qty: 3, food: { unit: '1 skiva', kcal: 30 } })
    expect(amountText(p.qty, p.food.unit)).toBe('3 skivor')
    expect(preferred(food('sushi')).qty).toBe(10)
    expect(applyPicks(food('omelett'), {}).unit).toBe('1 ägg')
    expect(preferred({ ...food('salami'), custom: true }).qty).toBe(1)
  })

  it('brödskiva och smörgåsar har sort och bröd', () => {
    expect(applyPicks(food('brodskiva'), { sort: 'grovt' })).toMatchObject({ name: 'Brödskiva, grovt', kcal: 100 })
    expect(applyPicks(food('macka-ost'), { brod: 'knacke', smor: 'utan' })).toMatchObject({ name: 'Smörgås med ost på knäcke, utan smör', kcal: 105 })
  })

  it('pluralen stämmer', () => {
    expect(amountText(2, '1 portion (2½ dl kokt)')).toBe('2 portioner (2½ dl kokt)')
    expect(amountText(0.5, '1 skiva')).toBe('½ skiva')
    expect(amountText(2, '1 glas')).toBe('2 glas')
  })

  it('större förpackning byter enheten', () => {
    expect(applyPicks(food('lask'), { storlek: 'flaska' }).unit).toBe('1 flaska (50 cl)')
    expect(applyPicks(food('ol'), { storlek: 'halv' }).unit).toBe('50 cl')
  })

  it('mängden skrivs naturligt', () => {
    expect(amountText(2, '1 msk')).toBe('2 msk')
    expect(amountText(1.5, '1 dl')).toBe('1½ dl')
    expect(amountText(2, '2 skivor')).toBe('2 × 2 skivor')
    expect(choiceSummary(food('kycklingfile'), { storlek: 'stor', tillagning: 'stekt' }, 1)).toBe('Stor · Stekt · 1 st')
  })
})
