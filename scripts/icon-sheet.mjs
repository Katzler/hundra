// Kontaktark för ikoner: node scripts/icon-sheet.mjs <ut.png> <fil.svg> [fil.svg ...]
// Varje ikon visas stor (96 px) på ljus bakgrund och i appstorlek (30 px i en 38 px cirkel)
// i både ljust och mörkt läge, med filnamnet under. Renderas med macOS qlmanage (WebKit).
import { readFileSync, writeFileSync, renameSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const [outArg, ...fileArgs] = process.argv.slice(2)
if (!outArg || !fileArgs.length) {
  console.error('Användning: node scripts/icon-sheet.mjs <ut.png> <fil.svg> [fil.svg ...]')
  process.exit(1)
}

const COLS = 6
const CELL = 150
// Samma ikon kan förekomma flera gånger på arket, så id:n görs unika per förekomst.
let n = 0
const inline = (svg, size) => {
  const k = `i${n++}`
  return svg
    .replace(/<\?xml[^>]*>/, '')
    .replace(/id="([^"]+)"/g, `id="${k}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${k}-$1)`)
    .replace('<svg', `<svg width="${size}" height="${size}"`)
}

const cells = fileArgs
  .map((f) => {
    const svg = readFileSync(resolve(f), 'utf8')
    return `<div style="width:${CELL}px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;border-right:1px solid #ddd;border-bottom:1px solid #ddd;background:#F2F2F7;--ink:#2b2118">
      ${inline(svg, 96)}
      <div style="display:flex;gap:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:#E3E3E8;display:grid;place-items:center">${inline(svg, 30)}</div>
        <div style="width:38px;height:38px;border-radius:50%;background:#2C2C2E;display:grid;place-items:center;--ink:#F2EDE4;box-shadow:0 0 0 6px #000">${inline(svg, 30)}</div>
      </div>
      <div style="font:11px -apple-system;color:#333;text-align:center;word-break:break-all">${basename(f, '.svg')}</div>
    </div>`
  })
  .join('')

const width = COLS * CELL
const rows = Math.ceil(fileArgs.length / COLS)
const height = rows * 190
const html = `<!doctype html><html><body style="margin:0;background:#fff">
<div style="display:flex;flex-wrap:wrap;width:${width}px">${cells}</div></body></html>`

const dir = mkdtempSync(join(tmpdir(), 'iconsheet-'))
const htmlPath = join(dir, 'sheet.html')
writeFileSync(htmlPath, html)
execFileSync('qlmanage', ['-t', '-s', String(Math.max(width, height)), '-o', dir, htmlPath], { stdio: 'ignore' })
const png = join(dir, 'sheet.html.png')
if (!existsSync(png)) throw new Error('qlmanage gav ingen bild')
renameSync(png, resolve(outArg))
rmSync(dir, { recursive: true, force: true })
console.log(resolve(outArg))
