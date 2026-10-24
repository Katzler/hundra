import { describe, expect, it } from 'vitest'
import { CATEGORIES, FOODS } from '../data/foods'
import { ICONS } from './riso'

describe('ikoner', () => {
  it('varje vara i grundlistan har en ikon', () => {
    expect(FOODS.filter((f) => !ICONS[f.id]).map((f) => f.id)).toEqual([])
  })

  it('varje kategori pekar på en ikon som finns', () => {
    expect(CATEGORIES.filter((c) => !ICONS[c.icon]).map((c) => c.id)).toEqual([])
  })

  it('ikonerna följer formatet i stilguiden', () => {
    for (const [id, svg] of Object.entries(ICONS)) {
      const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
      expect(root, id).toContain('viewBox="0 0 64 64"')
      expect(root, id).not.toMatch(/\s(width|height)=/)
      // Bläcket byts ut mot rätt färg för ljust/mörkt läge när ikonen visas.
      expect(svg, id).toContain('var(--ink, #2b2118)')
      expect(svg, id).not.toMatch(/<(text|style|script|image|use)\b/)
      for (const [, ref] of svg.matchAll(/id="([^"]+)"/g)) expect(ref.startsWith(`riso-${id}-`), `${id}: ${ref}`).toBe(true)
    }
  })
})
