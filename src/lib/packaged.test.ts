import { describe, expect, it } from 'vitest'
import { applyPicks, hasChoices, preferred, questionsFor } from '../data/choices'
import type { Food, Per100 } from '../data/foods'
import { defaultMeasure, macrosToPer100, macrosToUnit, measures, packagedBase, rowAfterEdit, sizeText } from './packaged'

const scanned = (per100: Per100, name = 'Vara'): Food => ({
  id: 'egen-1',
  name,
  emoji: '🍽️',
  ...packagedBase(per100),
  category: 'egna',
  custom: true,
  barcode: '7310865004703',
  per100,
})

describe('varor från en förpackning', () => {
  it('storlekar skrivs som på förpackningen', () => {
    expect(sizeText(30, 'g')).toBe('30 g')
    expect(sizeText(1500, 'ml')).toBe('1,5 l')
    expect(sizeText(1000, 'g')).toBe('1 kg')
  })

  it('choklad: portion, förpackning och 100 g, med portionen som förval', () => {
    const p: Per100 = { kcal: 540, measure: 'g', serving: 25, pack: 200 }
    expect(measures(p).map((m) => m.id)).toEqual(['portion', 'forpackning', 'hundra'])
    expect(defaultMeasure(p)).toMatchObject({ unit: '1 portion (25 g)', kcal: 135 })
  })

  it('en burk läsk är en portion, en liter mjölk dricks i glas', () => {
    expect(defaultMeasure({ kcal: 42, measure: 'ml', pack: 330 }).id).toBe('forpackning')
    const milk: Per100 = { kcal: 46, measure: 'ml', pack: 1500 }
    expect(measures(milk).map((m) => m.id)).toEqual(['forpackning', 'glas', 'hundra'])
    expect(defaultMeasure(milk)).toMatchObject({ id: 'glas', kcal: 92 })
  })

  it('en stor påse chips räknas per 100 g, inte hela påsen', () => {
    expect(defaultMeasure({ kcal: 530, measure: 'g', pack: 200 }).id).toBe('hundra')
  })

  it('valarket frågar om mått och räknar om kcal', () => {
    const food = scanned({ kcal: 540, measure: 'g', serving: 25, pack: 200 })
    expect(hasChoices(food)).toBe(true)
    expect(questionsFor(food)[0].options.map((o) => o.label)).toEqual(['Portion', 'Förpackning', '100 g'])
    expect(preferred(food).food).toMatchObject({ unit: '1 portion (25 g)', kcal: 135 })
    expect(applyPicks(food, { enhet: 'forpackning' })).toMatchObject({ name: 'Vara', unit: '1 förpackning (200 g)', kcal: 1080 })
  })

  it('näringen per 100 g sparas per förvalt mått och räknas om med måttet', () => {
    const p: Per100 = { kcal: 540, measure: 'g', serving: 25, pack: 200 }
    const perPortion = macrosToUnit(p, [7.5, 31, 56.5])
    expect(perPortion).toEqual([1.9, 7.8, 14.1])
    expect(macrosToPer100(p, '1 portion (25 g)', perPortion)).toEqual([7.6, 31.2, 56.4])
    const food = { ...scanned(p), macros: perPortion }
    expect(applyPicks(food, { enhet: 'hundra' }).macros).toEqual([7.6, 31.2, 56.4])
  })

  it('vanliga egna varor har fortfarande inga frågor', () => {
    const food: Food = { id: 'egen-2', name: 'Lasagne', emoji: '🍝', unit: '1 bit', kcal: 600, category: 'egna', custom: true }
    expect(questionsFor(food)).toEqual([])
  })

  it('ändrat näringsvärde: raderna behåller sitt mått men får nya kcal', () => {
    const before = scanned({ kcal: 500, measure: 'g', serving: 25 })
    const after = scanned({ kcal: 400, measure: 'g', serving: 25 }, 'Ny vara')
    const row = { name: 'Vara', emoji: '🍽️', unit: '100 g', kcalPerUnit: 500 }
    expect(rowAfterEdit(before, after, row)).toEqual({ name: 'Ny vara', emoji: '🍽️', unit: '100 g', kcalPerUnit: 400 })
    const base = { ...row, unit: before.unit, kcalPerUnit: before.kcal }
    expect(rowAfterEdit(before, after, base)).toMatchObject({ unit: '1 portion (25 g)', kcalPerUnit: 100 })
  })
})
