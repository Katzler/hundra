// Streckkoder på svenska matvaror: EAN-13 nästan alltid, EAN-8 på små förpackningar och
// ibland UPC på importerade varor. Allt görs om till samma form innan det slås upp.

/** Kontrollsiffran stämmer för EAN-8, UPC-A, EAN-13 och GTIN-14. */
export function validCheckDigit(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  // Från höger väger varannan siffra tre gånger så mycket, med början på den närmast kontrollsiffran.
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** UPC-E är en hoptryckt UPC-A. Den fylls ut till tolv siffror. */
export function expandUpcE(code: string): string | null {
  const m = /^([01])(\d{6})(\d)$/.exec(code)
  if (!m) return null
  const [, system, d, check] = m
  const last = Number(d[5])
  const body =
    last <= 2
      ? d.slice(0, 2) + d[5] + '0000' + d.slice(2, 5)
      : last === 3
        ? d.slice(0, 3) + '00000' + d.slice(3, 5)
        : last === 4
          ? d.slice(0, 4) + '00000' + d[4]
          : d.slice(0, 5) + '0000' + d[5]
  return system + body + check
}

/**
 * Koden som den slås upp: bara siffror, och UPC som EAN-13. null om den inte är en giltig kod.
 * `format` är det läsaren såg, t.ex. "UPC-E", eftersom en kod med åtta siffror kan vara båda sorterna.
 */
export function normalizeBarcode(raw: string, format?: string): string | null {
  const code = raw.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(code)) return null
  if (code.length === 8) {
    const upcE = format?.toUpperCase().replace(/[^A-Z]/g, '') === 'UPCE'
    if (!upcE && validCheckDigit(code)) return code
    const upcA = expandUpcE(code)
    return upcA && validCheckDigit(upcA) ? '0' + upcA : null
  }
  const full = code.length === 12 ? '0' + code : code.length === 14 && code.startsWith('0') ? code.slice(1) : code
  return full.length === 13 && validCheckDigit(full) ? full : null
}

/**
 * Butikens egna koder, som på lösvikt, deli och frukt man väger själv. De börjar på 2 och
 * har ofta pris eller vikt inbakat, så de går inte att slå upp någonstans.
 */
export function isStoreCode(code: string): boolean {
  return (code.length === 13 || code.length === 8) && code.startsWith('2')
}
