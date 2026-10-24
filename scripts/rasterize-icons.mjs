// Förrenderar Riso-ikonerna till skarpa WebP-bilder med headless Chrome.
// Safari ritar SVG-filter (kornet och bläckdarret) i låg upplösning när en SVG visas som <img>,
// så ikonerna blir suddiga på Retina. Här ritas varje ikon i 4x storlek, i ljust och mörkt läge.
//
// Användning: node scripts/rasterize-icons.mjs [id ...]   (utan argument: alla ikoner)
// Resultat:   public/icons/riso/{light,dark}/<id>.webp och listan src/icons/riso/ids.ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'src/icons/riso'
const OUT = 'public/icons/riso'
const SIZE = 144 // px – räcker till 36 px i 4x
const QUALITY = 0.9
const INK = { light: '#2b2118', dark: '#F2EDE4' }
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4))

const icons = ids.map((id) => ({ id, svg: readFileSync(join(SRC, `${id}.svg`), 'utf8') }))

// Sidan ritar varje ikon på en canvas och lägger resultatet som JSON i <pre id="out">.
const html = `<!doctype html><meta charset="utf-8"><pre id="out"></pre><script>
const icons = ${JSON.stringify(icons)};
const INK = ${JSON.stringify(INK)};
const S = ${SIZE};
const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src });
(async () => {
  const out = {};
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  for (const { id, svg } of icons) {
    for (const [mode, ink] of Object.entries(INK)) {
      const sized = svg.replace('<svg', '<svg width="' + S + '" height="' + S + '"').replaceAll('var(--ink, #2b2118)', ink);
      const img = await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized));
      g.clearRect(0, 0, S, S);
      g.drawImage(img, 0, 0, S, S);
      out[mode + '/' + id] = c.toDataURL('image/webp', ${QUALITY}).split(',')[1];
    }
  }
  document.getElementById('out').textContent = JSON.stringify(out);
})();
</script>`

const dir = mkdtempSync(join(tmpdir(), 'rasterize-'))
const page = join(dir, 'page.html')
writeFileSync(page, html)
const dom = execFileSync(
  CHROME,
  ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=120000', '--dump-dom', `file://${page}`],
  { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' },
)
rmSync(dir, { recursive: true, force: true })

const json = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)?.[1]
if (!json) throw new Error('Chrome gav inget resultat')
const out = JSON.parse(json.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))

let bytes = 0
for (const [key, b64] of Object.entries(out)) {
  const [mode, id] = key.split('/')
  mkdirSync(join(OUT, mode), { recursive: true })
  const buf = Buffer.from(b64, 'base64')
  bytes += buf.length
  writeFileSync(join(OUT, mode, `${id}.webp`), buf)
}
// Listan över alla ikoner som appen använder (alla SVG-filer, även de som inte renderades nu).
const all = readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort()
writeFileSync(
  join(SRC, 'ids.ts'),
  `// Genererad av scripts/rasterize-icons.mjs – ändra inte för hand.\nexport const ICON_IDS: ReadonlySet<string> = new Set(${JSON.stringify(all, null, 2)})\n`,
)
console.log(`${Object.keys(out).length} bilder, ${(bytes / 1024).toFixed(0)} kB totalt, ${all.length} ikoner i listan`)
