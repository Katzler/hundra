// Ritar appikonerna (grön bakgrund, vit ring) som PNG utan beroenden.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}

function icon(size) {
  const S = 4 // supersampling
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.3
  const W = size * 0.115
  const sweep = 0.82 // andel av varvet
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let ring = 0
      let track = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S - cx
          const py = y + (sy + 0.5) / S - cy
          const d = Math.hypot(px, py)
          // vinkel från toppen, medurs, 0..1
          let a = Math.atan2(px, -py) / (2 * Math.PI)
          if (a < 0) a += 1
          const onBand = Math.abs(d - R) <= W / 2
          const capStart = Math.hypot(px - 0, py + R) <= W / 2
          const ex = Math.sin(sweep * 2 * Math.PI) * R
          const ey = -Math.cos(sweep * 2 * Math.PI) * R
          const capEnd = Math.hypot(px - ex, py - ey) <= W / 2
          if ((onBand && a <= sweep) || capStart || capEnd) ring++
          else if (onBand) track++
        }
      }
      const t = y / size
      // bakgrund: lodrät gradient
      const bg = [0x3d + (0x2c - 0x3d) * t, 0xd6 + (0xb0 - 0xd6) * t, 0x6a + (0x4d - 0x6a) * t]
      const fr = ring / (S * S)
      const ft = (track / (S * S)) * 0.28
      const f = Math.min(1, fr + ft)
      const o = y * (size * 4 + 1) + 1 + x * 4
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(bg[i] * (1 - f) + 255 * f)
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', icon(192))
writeFileSync('public/icon-512.png', icon(512))
writeFileSync('public/apple-touch-icon.png', icon(180))

const r = 30, w = 11.5, sweep = 0.82
const ex = 50 + Math.sin(sweep * 2 * Math.PI) * r
const ey = 50 - Math.cos(sweep * 2 * Math.PI) * r
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3dd66a"/><stop offset="1" stop-color="#2cb04d"/></linearGradient></defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${w}"/>
  <path d="M50 ${50 - r} A${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>
</svg>
`,
)
console.log('ikoner klara')
