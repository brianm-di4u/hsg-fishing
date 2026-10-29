// Before/after sheets: pairs screenshots with the same name from two milestones side by side.
//   node tools/before-after.mjs [--before visual-before] [--after visual-final] [--extra review-final]
// Writes screenshots/<after>/before-after/<viewport>-NN.png. With --extra, adds GPU review shots from
// screenshots/<extra>/ as a third column where a name matches the "gpu" map below.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
const require = createRequire(path.resolve(GAME, 'shared/test-harness/package.json'));
const { chromium } = require('playwright');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const before = arg('before', 'visual-before'), after = arg('after', 'visual-final'), extra = arg('extra', null);
const SS = path.join(GAME, 'screenshots');
// harness shot → the matching real-GPU dev shot (the harness renders with SwiftShader on the low tier)
const gpu = { '01-title': 'title', '02-river-chain': 'campaign', '04-briefing': 'briefing-ouachita', '05-map-hamilton': 'map-hamilton-5-9', '05-map-ouachita': 'map-ouachita-10-10',
  '06b-boat-running': 'run-hamilton', '08-hud': 'spot-h-docks-5-10-clear', '12-fight': 'fight-h-garvan', '46b-jump': 'jump-h-docks', '14-catch-card': 'catch-largemouth', '27-weighin-reveal': 'weighin', '10-retrieve-sonar': 'underwater-o-geo' };
const url = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const browser = await chromium.launch();
for (const vp of ['desktop', 'mobile']) {
  const bd = path.join(SS, before, vp), ad = path.join(SS, after, vp); if (!fs.existsSync(bd) || !fs.existsSync(ad)) continue;
  const names = fs.readdirSync(ad).filter((f) => f.endsWith('.png') && fs.existsSync(path.join(bd, f))).map((f) => f.slice(0, -4));
  const per = vp === 'desktop' ? 3 : 2; const out = path.join(SS, after, 'before-after'); fs.mkdirSync(out, { recursive: true });
  for (let s = 0; s * per < names.length; s++) {
    const rows = names.slice(s * per, s * per + per).map((n) => {
      const g = extra && gpu[n] && path.join(SS, extra, gpu[n] + (vp === 'mobile' ? '-m' : '') + '.png');
      const cell = (f, cap) => `<figure><img src="${url(f)}"><figcaption>${cap}</figcaption></figure>`;
      return `<div class="row">${cell(path.join(bd, n + '.png'), `${n} · before`)}${cell(path.join(ad, n + '.png'), `${n} · after (harness, SwiftShader, low tier)`)}${g && fs.existsSync(g) ? cell(g, `${n} · after (real GPU)`) : ''}</div>`;
    }).join('');
    const page = await browser.newPage({ viewport: { width: vp === 'desktop' ? 1980 : 1240, height: 900 } });
    await page.setContent(`<style>body{margin:0;background:#1b2630;font:13px sans-serif;color:#eee}.row{display:flex;gap:8px;padding:6px}figure{margin:0;flex:1}img{width:100%;display:block}figcaption{padding:3px}</style>${rows}`);
    await page.screenshot({ path: path.join(out, `${vp}-${String(s + 1).padStart(2, '0')}.png`), fullPage: true }); await page.close();
  }
  console.log(vp, names.length, 'pairs');
}
await browser.close();
