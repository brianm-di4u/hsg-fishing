// Packs art-src/ into assets/pack-<name>.js: classic scripts that register base64 assets (see src/js/gfx/assets.js),
// so images and models load under file:// and WebGL accepts the images (data: URIs are not tainted).
//   node games/fishing/tools/pack-assets.mjs [--only pack1,pack2]
// art-src/art.json: { "items": [ { "name": "fish-largemouth", "src": "fish/largemouth.png", "pack": "fish",
//   "w": 768, "keyWhite": 22, "trim": true, "quality": 0.86 } ], "models": [ { "name": "boat", "src": "blender/export/boat.glb", "pack": "models" } ] }
// Images are re-encoded to WebP with the harness's Chromium (no image libraries). Writes src/js/gfx/packs.json
// (the pack list the game may request) and art-src/sheet.png (a contact sheet for review).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..'), SRC = path.join(GAME, 'art-src'), OUT = path.join(GAME, 'assets');
const require = createRequire(path.resolve(GAME, '../../shared/test-harness/package.json'));
const { chromium } = require('playwright');
const args = process.argv.slice(2); const oi = args.indexOf('--only'); const only = oi >= 0 ? args[oi + 1].split(',') : null;
const spec = JSON.parse(fs.readFileSync(path.join(SRC, 'art.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const packs = {}; const sheet = [];
const browser = await chromium.launch(); const page = await browser.newPage(); await page.setContent('<!doctype html><body></body>');
for (const it of spec.items || []) {
  if (only && !only.includes(it.pack)) continue;
  const file = path.join(SRC, it.src); if (!fs.existsSync(file)) { console.log('  missing', it.src); continue; }
  const url = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  const out = await page.evaluate(async ({ url, it }) => {
    const img = new Image(); img.src = url; await img.decode();
    let c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; let g = c.getContext('2d'); g.drawImage(img, 0, 0);
    if (it.keyWhite) { // flood-fill near-white from the border, then feather the edge
      const W = c.width, H = c.height, d = g.getImageData(0, 0, W, H), p = d.data, lim = 255 - it.keyWhite, seen = new Uint8Array(W * H), st = [];
      const white = (i) => p[i * 4] >= lim && p[i * 4 + 1] >= lim && p[i * 4 + 2] >= lim;
      for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
      while (st.length) { const i = st.pop(); if (seen[i] || !white(i)) continue; seen[i] = 1; const x = i % W, y = (i / W) | 0; if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W); }
      for (let i = 0; i < W * H; i++) if (seen[i]) p[i * 4 + 3] = 0;
      for (let i = 0; i < W * H; i++) { if (seen[i]) continue; const x = i % W, y = (i / W) | 0; let n = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && seen[j]) n++; if (n) p[i * 4 + 3] = Math.round(255 * (1 - n * 0.2)); void x; void y; }
      g.putImageData(d, 0, 0);
    }
    if (it.trim) { const W = c.width, H = c.height, p = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad); const t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1; t.getContext('2d').drawImage(c, -x0, -y0); c = t; }
    const w = it.w || c.width, h = Math.round(w * c.height / c.width); const o = document.createElement('canvas'); o.width = w; o.height = h; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, w, h);
    const data = o.toDataURL('image/webp', it.quality || 0.86);
    return { b64: data.split(',')[1], w, h };
  }, { url, it });
  (packs[it.pack] = packs[it.pack] || []).push({ name: it.name, mime: 'image/webp', b64: out.b64 });
  sheet.push({ name: it.name, url: 'data:image/webp;base64,' + out.b64, w: out.w, h: out.h });
  console.log(`  ${it.name.padEnd(22)} ${out.w}×${out.h}  ${(out.b64.length * 0.75 / 1024).toFixed(0)} KB`);
}
for (const m of spec.models || []) {
  if (only && !only.includes(m.pack)) continue;
  const file = path.join(SRC, m.src); if (!fs.existsSync(file)) { console.log('  missing', m.src); continue; }
  const b64 = fs.readFileSync(file).toString('base64'); (packs[m.pack] = packs[m.pack] || []).push({ name: m.name, mime: 'model/gltf-binary', b64 });
  console.log(`  ${m.name.padEnd(22)} model  ${(b64.length * 0.75 / 1024).toFixed(0)} KB`);
}
for (const [name, list] of Object.entries(packs)) {
  const body = `/* Ouachita Bass Classic asset pack "${name}" — generated by tools/pack-assets.mjs from art-src/; do not edit. */\n(window.__FISH_ASSETS = window.__FISH_ASSETS || []).push(\n${list.map((a) => JSON.stringify(a)).join(',\n')}\n);\n`;
  fs.writeFileSync(path.join(OUT, `pack-${name}.js`), body); console.log(`pack-${name}.js ${(body.length / 1024).toFixed(0)} KB`);
}
const all = fs.readdirSync(OUT).filter((f) => /^pack-.*\.js$/.test(f)).map((f) => f.slice(5, -3)).sort();
fs.writeFileSync(path.join(GAME, 'src/js/gfx/packs.json'), JSON.stringify(all));
if (sheet.length) {
  await page.setContent(`<body style="margin:0;background:#2a3a44;font:12px sans-serif;color:#fff;display:flex;flex-wrap:wrap;width:1600px">${sheet.map((s) => `<div style="width:390px;margin:4px;background:#3a4a54"><img src="${s.url}" style="width:390px;height:200px;object-fit:contain;background:repeating-conic-gradient(#556 0 25%,#667 0 50%) 0/20px 20px"><div>${s.name} ${s.w}×${s.h}</div></div>`).join('')}</body>`);
  await page.setViewportSize({ width: 1600, height: 900 }); await page.screenshot({ path: path.join(SRC, 'sheet.png'), fullPage: true });
}
await browser.close();
