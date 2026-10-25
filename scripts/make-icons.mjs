// Gör appikonerna (hemskärm, installation, flik) av public/icon.svg med headless Chrome.
// Användning: node scripts/make-icons.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const svg = readFileSync('public/icon.svg', 'utf8')
const BG = '#3D78D8' // bakgrunden i ikonen, fyller marginalen på den maskerbara varianten

// scale < 1 = maskerbar ikon: motivet krymps till säkra zonen (80 %) så att Android kan beskära fritt.
const OUTPUTS = [
  { file: 'public/icon-192.png', size: 192, scale: 1 },
  { file: 'public/icon-512.png', size: 512, scale: 1 },
  { file: 'public/icon-maskable-512.png', size: 512, scale: 0.8 },
  { file: 'public/apple-touch-icon.png', size: 180, scale: 1 },
]

// På den maskerbara ikonen tas papperskornet bort, annars syns en kant där motivet krympts.
const plain = svg.replace(/<rect[^>]*-paper\)"\/>/, '')

const html = `<!doctype html><pre id="out"></pre><script>
const svg = ${JSON.stringify(svg)};
const plain = ${JSON.stringify(plain)};
const outputs = ${JSON.stringify(OUTPUTS)};
(async () => {
  const res = {};
  for (const o of outputs) {
    const img = new Image();
    const src = o.scale < 1 ? plain : svg;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src.replace('<svg', '<svg width="' + o.size + '" height="' + o.size + '"'));
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = o.size;
    const g = c.getContext('2d');
    g.fillStyle = '${BG}'; g.fillRect(0, 0, o.size, o.size);
    const s = o.size * o.scale, off = (o.size - s) / 2;
    g.drawImage(img, off, off, s, s);
    res[o.file] = c.toDataURL('image/png').split(',')[1];
  }
  document.getElementById('out').textContent = JSON.stringify(res);
})();
</script>`

const dir = mkdtempSync(join(tmpdir(), 'appicon-'))
writeFileSync(join(dir, 'p.html'), html)
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=20000', '--dump-dom', `file://${join(dir, 'p.html')}`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'ignore'],
})
rmSync(dir, { recursive: true, force: true })
const json = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)?.[1]
if (!json) throw new Error('Chrome gav inget resultat')
for (const [file, b64] of Object.entries(JSON.parse(json.replaceAll('&quot;', '"')))) {
  writeFileSync(file, Buffer.from(b64, 'base64'))
  console.log(file)
}
