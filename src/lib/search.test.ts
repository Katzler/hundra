import { describe, expect, it } from 'vitest'
import { FOODS } from '../data/foods'
import { normalize, parseQuantity, searchFoods } from './search'

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

  it('hittar sammansatta ord men inte brus från korta sökord', () => {
    expect(names('potatis')).toContain('Klyftpotatis')
    expect(names('ol')).not.toContain('Broccoli')
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

  it('läser ut antal i början av sökningen', () => {
    expect(parseQuantity('3 potatis')).toEqual({ qty: 3, rest: 'potatis' })
    expect(parseQuantity('½ pizza')).toEqual({ qty: 0.5, rest: 'pizza' })
    expect(parseQuantity('1½ pasta')).toEqual({ qty: 1.5, rest: 'pasta' })
    expect(parseQuantity('1,5 pasta')).toEqual({ qty: 1.5, rest: 'pasta' })
    expect(parseQuantity('en halv pizza')).toEqual({ qty: 0.5, rest: 'pizza' })
    expect(parseQuantity('två ägg')).toEqual({ qty: 2, rest: 'agg' })
    expect(parseQuantity('potatis')).toEqual({ qty: 1, rest: 'potatis' })
    expect(names(parseQuantity('2 ägg').rest)[0]).toBe('Ägg')
  })

  it('hittar via kategorinamn och ignorerar enbokstavsträffar på portionen', () => {
    expect(names('frukt')).toContain('Banan')
    expect(names('s')).not.toContain('Ägg')
  })

  it('tål ett stavfel när nästan inget annat hittas', () => {
    expect(names('kotbullar')).toContain('Köttbullar')
    expect(names('bannan')).toContain('Banan')
    expect(names('xyzqq')).toEqual([])
  })
})
