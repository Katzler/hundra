// Kontrollerar att ikonfilerna följer formatet i design/riso/STILGUIDE.md.
// Användning: node scripts/check-icons.mjs [fil.svg ...]   (utan argument: alla i src/icons/riso)
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

const DIR = 'src/icons/riso'
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(DIR).filter((f) => f.endsWith('.svg')).map((f) => join(DIR, f))

let bad = 0
for (const file of files) {
  const id = basename(file, '.svg')
  const svg = readFileSync(file, 'utf8')
  const problems = []
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
  if (!root.includes('viewBox="0 0 64 64"')) problems.push('roten saknar viewBox="0 0 64 64"')
  if (/\s(width|height)=/.test(root)) problems.push('roten har width/height')
  if (!svg.includes('var(--ink, #2b2118)')) problems.push('ingen bläcklinje med var(--ink, #2b2118)')
  for (const tag of ['text', 'style', 'script', 'image', 'use', 'foreignObject'])
    if (new RegExp(`<${tag}\\b`).test(svg)) problems.push(`förbjudet element <${tag}>`)
  if (/href=|https?:/.test(svg.replace('http://www.w3.org/2000/svg', ''))) problems.push('extern referens')
  for (const [, i] of svg.matchAll(/id="([^"]+)"/g))
    if (!i.startsWith(`riso-${id}-`)) problems.push(`id "${i}" saknar prefixet riso-${id}-`)
  for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g))
    if (!svg.includes(`id="${ref}"`)) problems.push(`url(#${ref}) pekar på ett id som inte finns`)
  if (!svg.includes(`riso-${id}-grain`) || !svg.includes(`riso-${id}-ink`)) problems.push('saknar grain- eller ink-filtret')
  const kb = Buffer.byteLength(svg) / 1024
  if (kb > 4.5) problems.push(`för stor (${kb.toFixed(1)} kB, max ca 3,5)`)
  if (problems.length) {
    bad++
    console.log(`✗ ${id}: ${problems.join('; ')}`)
  }
}
console.log(`${files.length - bad} av ${files.length} ok`)
process.exit(bad ? 1 : 0)
