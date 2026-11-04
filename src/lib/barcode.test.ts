import { describe, expect, it } from 'vitest'
import { expandUpcE, isStoreCode, normalizeBarcode, validCheckDigit } from './barcode'

describe('streckkoder', () => {
  it('kontrollsiffran räknas rätt för EAN-13, EAN-8 och UPC-A', () => {
    expect(validCheckDigit('4006381333931')).toBe(true)
    expect(validCheckDigit('4006381333932')).toBe(false)
    expect(validCheckDigit('96385074')).toBe(true)
    expect(validCheckDigit('96385075')).toBe(false)
    expect(validCheckDigit('036000291452')).toBe(true)
    expect(validCheckDigit('abc')).toBe(false)
  })

  it('UPC-A blir EAN-13 med en nolla först', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
  })

  it('mellanslag och bindestreck tas bort, felaktiga koder ger null', () => {
    expect(normalizeBarcode('400 6381 33393-1')).toBe('4006381333931')
    expect(normalizeBarcode('4006381333932')).toBeNull()
    expect(normalizeBarcode('12345')).toBeNull()
    expect(normalizeBarcode('hej')).toBeNull()
  })

  it('UPC-E fylls ut till tolv siffror och blir EAN-13', () => {
    expect(expandUpcE('01234565')).toBe('012345000065')
    expect(expandUpcE('04252614')).toBe('042100005264')
    expect(normalizeBarcode('01234565', 'UPC-E')).toBe('0012345000065')
  })

  it('åtta siffror är EAN-8 om inget annat sägs', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
    expect(normalizeBarcode('96385074', 'EAN-8')).toBe('96385074')
  })

  it('GTIN-14 med en nolla först blir EAN-13', () => {
    expect(normalizeBarcode('04006381333931')).toBe('4006381333931')
  })

  it('butikens egna koder för vägda varor känns igen', () => {
    expect(isStoreCode('2312345012340')).toBe(true)
    expect(isStoreCode('7310865004703')).toBe(false)
  })
})
