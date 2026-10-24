import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATEGORIES, FOODS } from '../data/foods'
import { ICON_IDS } from './riso/ids'

const ICONS = import.meta.glob('./riso/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const svgs = Object.entries(ICONS).map(([path, svg]) => [path.slice(7, -4), svg] as const)

describe('ikoner', () => {
  it('varje vara i grundlistan har en ikon', () => {
    expect(FOODS.filter((f) => !ICON_IDS.has(f.id)).map((f) => f.id)).toEqual([])
  })

  it('listan över ikoner stämmer med SVG-filerna (kör npm run icons:raster)', () => {
    expect([...ICON_IDS].sort()).toEqual(svgs.map(([id]) => id).sort())
  })

  it('varje kategori pekar på en ikon som finns', () => {
    expect(CATEGORIES.filter((c) => !ICON_IDS.has(c.icon)).map((c) => c.id)).toEqual([])
  })

  it('varje ikon är förrenderad i ljust och mörkt läge (kör npm run icons:raster)', () => {
    const missing = [...ICON_IDS].filter(
      (id) => !existsSync(`public/icons/riso/light/${id}.webp`) || !existsSync(`public/icons/riso/dark/${id}.webp`),
    )
    expect(missing).toEqual([])
  })

  it('ikonerna följer formatet i stilguiden', () => {
    for (const [id, svg] of svgs) {
      const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
      expect(root, id).toContain('viewBox="0 0 64 64"')
      expect(root, id).not.toMatch(/\s(width|height)=/)
      // Bläcket byts mot rätt färg för ljust/mörkt läge när ikonen förrenderas.
      expect(svg, id).toContain('var(--ink, #2b2118)')
      expect(svg, id).not.toMatch(/<(text|style|script|image|use)\b/)
      for (const [, ref] of svg.matchAll(/id="([^"]+)"/g)) expect(ref.startsWith(`riso-${id}-`), `${id}: ${ref}`).toBe(true)
    }
  })
})
