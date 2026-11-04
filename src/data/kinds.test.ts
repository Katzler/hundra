import { describe, expect, it } from 'vitest'
import { kindFor } from './kinds'

describe('varutyper för skannade varor', () => {
  it('känns igen på namnet, också i sammansatta ord', () => {
    const cases: [string, string | undefined, ('g' | 'ml')?][] = [
      ['Bregott Normalsaltat', 'smor'],
      ['Lätta Original', 'smor'],
      ['Arla Yoghurt Naturell 3 %', 'yoghurt'],
      ['Vaniljyoghurt', 'yoghurt'],
      ['Filmjölk 3 %', 'yoghurt'],
      ['A-fil', 'yoghurt'],
      ['Herrgårdsost 28 %', 'ost'],
      ['Gräddost', 'ost'],
      ['Mjukost', 'mjukost'],
      ['Mellanmjölk', 'dryck', 'ml'],
      ['Havredryck', 'dryck', 'ml'],
      ['Chokladmjölk', 'dryck', 'ml'],
      ['Marabou Mjölkchoklad', 'choklad', 'g'],
      ['Jordnötssmör Crunchy', 'notkram'],
      ['Lingonsylt', 'sylt'],
      ['Knäckebröd Råg', 'knacke'],
      ['Tortillachips', 'chips', 'g'],
      ['Tortilla Original', 'brodst'],
      ['Pastasås Basilika', 'sas'],
      ['Kycklingfilé', 'kott'],
      ['Frigående ägg', 'agg'],
      ['Crème fraiche', 'gradde'],
      ['Jasminris', 'ris'],
      ['Kalles Kaviar', 'kaviar'],
    ]
    for (const [name, kind, measure] of cases) expect(kindFor(name, [], measure), name).toBe(kind)
  })

  it('ord som bara liknar känns inte igen', () => {
    expect(kindFor('Smörgåsgurka')).toBeUndefined()
    expect(kindFor('Frost')).toBeUndefined()
    expect(kindFor('Ostkaka')).toBeUndefined()
  })

  it('kategorin går före namnet, och ost är inte yoghurt', () => {
    expect(kindFor('Normalsaltat', ['en:dairies', 'en:butters'])).toBe('smor')
    expect(kindFor('Präst', ['en:dairies', 'en:fermented-milk-products', 'en:cheeses'])).toBe('ost')
    expect(kindFor('Naturell', ['en:dairies', 'en:fermented-milk-products', 'en:yogurts'])).toBe('yoghurt')
  })
})
