/**
 * Renders a 1200×630 Open Graph card per group into client/public/og/{groupId}.jpg
 * using the Playwright Chromium the client already has for E2E.
 *
 * Usage:  node scripts/generate-og-images.mjs [groupId ...]
 */
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(__dirname, '..', 'client', 'package.json'))
const { chromium } = require('@playwright/test')

const groups = JSON.parse(readFileSync(join(__dirname, '..', 'server', 'src', 'data', 'groups.json'), 'utf-8'))
const OUT_DIR = join(__dirname, '..', 'client', 'public', 'og')
const only = process.argv.slice(2)

const html = (g) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0D0B1A; color: #fff; font-family: Poppins, sans-serif; position: relative; }
  .orb { position: absolute; border-radius: 50%; filter: blur(10px); }
  .o1 { width: 700px; height: 700px; top: -300px; left: -200px; background: radial-gradient(circle, ${g.colors.primary} 0%, transparent 65%); opacity: .7; }
  .o2 { width: 640px; height: 640px; bottom: -320px; right: -160px; background: radial-gradient(circle, ${g.colors.secondary} 0%, transparent 65%); opacity: .6; }
  .wrap { position: relative; height: 100%; padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 22px; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.55); }
  .eyebrow b { color: #fff; font-weight: 500; }
  .name { font-size: ${g.gameName.length > 9 ? 148 : 176}px; font-weight: 900; line-height: .92; letter-spacing: -.045em;
          background: linear-gradient(135deg, ${g.colors.primary} 0%, ${g.colors.secondary} 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { font-size: 40px; margin-top: 18px; color: rgba(255,255,255,.85); }
  .sub b { font-weight: 900; color: #fff; }
  .foot { display: flex; justify-content: space-between; align-items: center; font-family: 'JetBrains Mono', monospace; font-size: 24px; color: rgba(255,255,255,.55); }
  .grid { display: flex; gap: 10px; }
  .grid i { width: 40px; height: 40px; border-radius: 8px; background: rgba(255,255,255,.12); }
  .grid i.ok { background: #4ADE80; } .grid i.no { background: #FF6B6B; }
</style></head><body>
<div class="orb o1"></div><div class="orb o2"></div>
<div class="wrap">
  <div class="eyebrow"><b>K-POPDLE</b> · daily song quiz</div>
  <div>
    <div class="name">${g.gameName}</div>
    <div class="sub">Guess the <b>${g.displayName}</b> song from a clip.</div>
  </div>
  <div class="foot">
    <div class="grid"><i class="no"></i><i class="no"></i><i class="ok"></i><i></i><i></i><i></i></div>
    <span>k-popdle.com/${g.id}</span>
  </div>
</div></body></html>`

mkdirSync(OUT_DIR, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const g of groups) {
  if (only.length && !only.includes(g.id)) continue
  await page.setContent(html(g), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(OUT_DIR, `${g.id}.jpg`), type: 'jpeg', quality: 86 })
  console.log(`✓ og/${g.id}.jpg`)
}
await browser.close()
