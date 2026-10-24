import { describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { normalize, searchFoods } from './search'

const names = (q: string) => searchFoods(FOODS, q).map((f) => f.name)

describe('sök', () => {
  it('tar bort accenter och skiftläge', () => {
    expect(normalize('Äggröra')).toBe('aggrora')
    expect(normalize('  Kaffe,  svart ')).toBe('kaffe svart')
  })

  it('hittar potatis först', () => {
    expect(names('potatis')[0]).toBe('Potatis')
    expect(names('pot')[0]).toBe('Potatis')
  })

  it('går att söka utan å, ä och ö', () => {
    expect(names('agg')).toContain('Ägg')
    expect(names('ol')).toContain('Öl')
  })

  it('hittar via alias', () => {
    expect(names('macka')).toContain('Smörgås med ost')
    expect(names('pommes')[0]).toBe('Pommes frites')
  })

  it('matchar flera ord', () => {
    expect(names('pasta bol')[0]).toBe('Pasta bolognese')
  })

  it('ger tomt resultat för tom sökning och för nonsens', () => {
    expect(names('')).toEqual([])
    expect(names('xyzqq')).toEqual([])
  })

  it('har unika id:n i grundlistan', () => {
    const ids = FOODS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
