// Läser streckkoder ur kamerabilder och foton med ZXing (WebAssembly). Safari på iPhone har
// ingen inbyggd streckkodsläsare. Läsaren laddas först när man skannar. WebAssembly-filen ligger
// hos oss, inte på ett CDN, och service workern sparar den för offline (se vite.config.ts).

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import type { ReaderOptions } from 'zxing-wasm/reader'
import { normalizeBarcode } from './barcode'

type Reader = typeof import('zxing-wasm/reader')

// Bara koderna på matvaror. Färre format går fortare och ger färre felläsningar.
const OPTIONS: ReaderOptions = {
  formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: false,
  maxNumberOfSymbols: 1,
}

let reader: Promise<Reader> | null = null

/** Laddar läsaren en gång. Misslyckas det (t.ex. utan nät första gången) försöker nästa anrop igen. */
export function loadReader(): Promise<Reader> {
  reader ??= (async () => {
    const zxing = await import('zxing-wasm/reader')
    await zxing.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    })
    return zxing
  })().catch((e: unknown) => {
    reader = null
    throw e
  })
  return reader
}

/** Den första giltiga streckkoden i bilden, som EAN-13 eller EAN-8. */
export async function readCode(image: ImageData): Promise<string | null> {
  const zxing = await loadReader()
  for (const r of await zxing.readBarcodes(image, OPTIONS)) {
    const code = r.isValid ? normalizeBarcode(r.text, r.format) : null
    if (code) return code
  }
  return null
}

/** Största sidan på en bild som läses. Större ger inget bättre resultat, bara långsammare. */
const PHOTO_MAX = 1800

/** Läser ett foto från kameran eller bildbiblioteket. Webbläsaren vänder bilden rätt. */
export async function readPhoto(file: Blob): Promise<string | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const scale = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await readCode(ctx.getImageData(0, 0, canvas.width, canvas.height))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export type Crop = { x: number; y: number; w: number; h: number }

/**
 * Den del av kamerabilden som syns i ramen. Videon fyller vyn (object-fit: cover), så kanterna av
 * bilden syns inte. Ramen är 84 % × 36 % mitt i vyn; vi läser lite mer än så för att vara snälla.
 */
export function cropOf(video: { w: number; h: number }, view: { w: number; h: number }): Crop {
  const scale = Math.max(view.w / video.w, view.h / video.h)
  const visW = view.w / scale
  const visH = view.h / scale
  const x0 = (video.w - visW) / 2
  const y0 = (video.h - visH) / 2
  return { x: x0 + visW * 0.04, y: y0 + visH * 0.26, w: visW * 0.92, h: visH * 0.48 }
}
