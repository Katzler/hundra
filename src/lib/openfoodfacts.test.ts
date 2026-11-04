import { describe, expect, it } from 'vitest'
import { lookupBarcode, parseProduct, productUrl } from './openfoodfacts'

// Exempelsvar i samma form som Open Food Facts API (v2) med bara de fält appen ber om.
const mjolk = {
  code: '7310865004703',
  status: 1,
  product: {
    product_name: 'Mellanmjölk 1,5 %',
    product_name_sv: 'Mellanmjölk 1,5 %',
    brands: 'Arla,Arla Foods',
    quantity: '1,5 l',
    product_quantity: '1500',
    product_quantity_unit: 'ml',
    nutriments: { 'energy-kcal_100g': 46, 'energy-kj_100g': 194 },
    categories_tags: ['en:dairies', 'en:milks'],
  },
}

const choklad = {
  status: 1,
  product: {
    product_name: 'MJÖLKCHOKLAD',
    brands: 'Marabou',
    quantity: '200 g',
    product_quantity: 200,
    serving_size: '4 bitar (25 g)',
    serving_quantity: 25,
    nutriments: { 'energy-kcal_100g': 540, proteins_100g: 7.5, fat_100g: 31, carbohydrates_100g: '56,5' },
    categories_tags: ['en:snacks', 'en:sweet-snacks', 'en:chocolates'],
  },
}

const fakeFetch = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch

describe('Open Food Facts', () => {
  it('mjölk: kcal per 100 ml, förpackning i liter, märket först, emoji från kategorin', () => {
    const r = parseProduct(mjolk)
    expect(r).toEqual({
      kind: 'found',
      product: { name: 'Arla Mellanmjölk 1,5 %', emoji: '🥛', per100: { kcal: 46, measure: 'ml', pack: 1500, kind: 'dryck' } },
    })
  })

  it('choklad: portionen följer med, versaler blir vanlig text', () => {
    const r = parseProduct(choklad)
    expect(r.kind).toBe('found')
    if (r.kind !== 'found') return
    expect(r.product.name).toBe('Marabou Mjölkchoklad')
    expect(r.product.emoji).toBe('🍫')
    expect(r.product.per100).toEqual({ kcal: 540, measure: 'g', serving: 25, pack: 200, kind: 'choklad' })
    expect(r.product.macros100).toEqual([7.5, 31, 56.5])
  })

  it('näringen följer bara med när protein, fett och kolhydrater finns', () => {
    const r = parseProduct({ status: 1, product: { product_name: 'Te', nutriments: { 'energy-kcal_100g': 1, proteins_100g: 0 } } })
    expect(r.kind === 'found' && 'macros100' in r.product).toBe(false)
  })

  it('märket läggs inte till när det redan står i namnet', () => {
    const r = parseProduct({ status: 1, product: { product_name: 'Oatly Havredryck', brands: 'Oatly', nutriments: { 'energy-kcal_100g': 46 } } })
    expect(r.kind === 'found' && r.product.name).toBe('Oatly Havredryck')
  })

  it('bara kJ: kcal räknas fram', () => {
    const r = parseProduct({ status: 1, product: { product_name: 'Knäcke', nutriments: { energy_100g: 1500 } } })
    expect(r.kind === 'found' && r.product.per100.kcal).toBe(358.5)
  })

  it('flerpack: en förpackning är en av dem', () => {
    const r = parseProduct({
      status: 1,
      product: { product_name: 'Yoghurt', quantity: '4 x 125 g', product_quantity: 500, nutriments: { 'energy-kcal_100g': 80 } },
    })
    expect(r.kind === 'found' && r.product.per100.pack).toBe(125)
  })

  it('utan kcal eller med orimliga kcal: det som finns följer med till formuläret', () => {
    expect(parseProduct({ status: 1, product: { product_name: 'Sylt', quantity: '400 g' } })).toEqual({
      kind: 'incomplete',
      name: 'Sylt',
      per100: { measure: 'g', pack: 400, kind: 'sylt' },
    })
    expect(parseProduct({ status: 1, product: { product_name: 'Fel', nutriments: { 'energy-kcal_100g': 2100 } } }).kind).toBe('incomplete')
  })

  it('utan namn är varan ofullständig', () => {
    expect(parseProduct({ status: 1, product: { nutriments: { 'energy-kcal_100g': 100 } } }).kind).toBe('incomplete')
  })

  it('status 0 och 404 betyder att varan inte finns', async () => {
    expect(parseProduct({ status: 0, status_verbose: 'product not found' })).toEqual({ kind: 'missing' })
    expect(await lookupBarcode('7310865004703', { fetchFn: fakeFetch(404, { status: 0 }) })).toEqual({ kind: 'missing' })
  })

  it('uppslaget hämtar varan och gör om den', async () => {
    const r = await lookupBarcode('7310865004703', { fetchFn: fakeFetch(200, mjolk) })
    expect(r.kind).toBe('found')
  })

  it('serverfel och nätfel ger begripliga svar i stället för att krascha', async () => {
    expect(await lookupBarcode('7310865004703', { fetchFn: fakeFetch(429, {}) })).toEqual({ kind: 'error' })
    const failing = (async () => {
      throw new TypeError('Load failed')
    }) as typeof fetch
    expect(await lookupBarcode('7310865004703', { fetchFn: failing })).toEqual({ kind: 'offline' })
  })

  it('för långsamt svar räknas som ingen anslutning', async () => {
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))) as typeof fetch
    expect(await lookupBarcode('7310865004703', { fetchFn: slow, timeoutMs: 10 })).toEqual({ kind: 'offline' })
  })

  it('bara de fält som behövs efterfrågas', () => {
    expect(productUrl('7310865004703')).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/7310865004703\?fields=/)
  })
})
