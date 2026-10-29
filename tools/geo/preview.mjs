// Renders data/geo/<lake>.json to research/geo/preview-<lake>.png (water, hillshade, bridges, creeks, dams, islands,
// spots and landmarks from src/js/data.js) with a lake-unit grid, for checking spot placement by eye.
//   node games/fishing/tools/geo/preview.mjs [lake ...]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.resolve(ROOT, '../../shared/test-harness/package.json'));
const { chromium } = require('playwright');
const argv = process.argv.slice(2); const pi = argv.indexOf('--placed');
const placed = pi >= 0 ? JSON.parse(fs.readFileSync(argv[pi + 1], 'utf8')) : {};
const rest = argv.filter((a, i) => i !== pi && i !== pi + 1);
const ids = rest.length ? rest : ['catherine', 'hamilton', 'ouachita', 'degray'];

const browser = await chromium.launch();
for (const id of ids) {
  const geo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geo', id + '.json'), 'utf8'));
  const page = await browser.newPage({ viewport: { width: 2000, height: 1250 } });
  await page.setContent('<body style="margin:0"><canvas id="c" width="2000" height="1250"></canvas></body>');
  await page.evaluate(async ({ geo, def }) => {
    const unrle = (b64, n) => { const s = atob(b64); const m = new Uint8Array(n); let k = 0, v = 0, i = 0; while (i < s.length) { let r = 0, sh = 0, c; do { c = s.charCodeAt(i++); r |= (c & 127) << sh; sh += 7; } while (c & 128); m.fill(v, k, k + r); k += r; v ^= 1; } return m; };
    const [GW, GH] = geo.grid; const mask = unrle(geo.mask, GW * GH), other = unrle(geo.other, GW * GH);
    const c = document.getElementById('c').getContext('2d'); const S = 2;
    const img = new Image(); img.src = geo.dem.png; await img.decode();
    const dc = document.createElement('canvas'); dc.width = geo.dem.w; dc.height = geo.dem.h; const dx = dc.getContext('2d'); dx.drawImage(img, 0, 0);
    const D = dx.getImageData(0, 0, dc.width, dc.height).data; const h = (i, j) => D[(Math.min(dc.height - 1, Math.max(0, j)) * dc.width + Math.min(dc.width - 1, Math.max(0, i))) * 4] / 255 * (geo.dem.max - geo.dem.min) + geo.dem.min;
    const sh = c.createImageData(dc.width, dc.height); const cell = 1000 / dc.width * geo.frame.mPerUnit;
    for (let j = 0; j < dc.height; j++) for (let i = 0; i < dc.width; i++) { const gx = (h(i + 1, j) - h(i - 1, j)) / (2 * cell), gy = (h(i, j + 1) - h(i, j - 1)) / (2 * cell); const l = Math.max(0, Math.min(1, 0.6 - gx * 1.5 + gy * 1.5 + h(i, j) / geo.dem.max * 0.3)); const o = (j * dc.width + i) * 4; sh.data[o] = 70 + 120 * l; sh.data[o + 1] = 95 + 110 * l; sh.data[o + 2] = 55 + 70 * l; sh.data[o + 3] = 255; }
    dx.putImageData(sh, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(dc, 0, 0, 2000, 1250);
    const wi = c.createImageData(GW, GH); for (let k = 0; k < GW * GH; k++) { if (mask[k]) { wi.data[k * 4] = 40; wi.data[k * 4 + 1] = 110; wi.data[k * 4 + 2] = 170; wi.data[k * 4 + 3] = 255; } else if (other[k]) { wi.data[k * 4] = 90; wi.data[k * 4 + 1] = 150; wi.data[k * 4 + 2] = 200; wi.data[k * 4 + 3] = 255; } }
    const wc = document.createElement('canvas'); wc.width = GW; wc.height = GH; wc.getContext('2d').putImageData(wi, 0, 0); c.imageSmoothingEnabled = false; c.drawImage(wc, 0, 0, 2000, 1250);
    c.font = '14px sans-serif'; c.lineWidth = 1;
    for (let x = 0; x <= 1000; x += 50) { c.strokeStyle = x % 100 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(x * S, 0); c.lineTo(x * S, 1250); c.stroke(); if (!(x % 100)) { c.fillStyle = '#fff'; c.fillText(x, x * S + 2, 14); } }
    for (let y = 0; y <= 625; y += 50) { c.strokeStyle = y % 100 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(0, y * S); c.lineTo(2000, y * S); c.stroke(); if (!(y % 100)) { c.fillStyle = '#fff'; c.fillText(y, 2, y * S - 2); } }
    c.lineWidth = 6; c.strokeStyle = '#f0c'; for (const b of geo.bridges) { c.beginPath(); c.moveTo(b.a[0] * S, b.a[1] * S); c.lineTo(b.b[0] * S, b.b[1] * S); c.stroke(); c.fillStyle = '#f0c'; c.fillText(b.name, b.b[0] * S + 6, b.b[1] * S); }
    c.strokeStyle = '#fff'; for (const d of geo.dams) { c.beginPath(); d.pts.forEach((p, i) => (i ? c.lineTo(p[0] * S, p[1] * S) : c.moveTo(p[0] * S, p[1] * S))); c.stroke(); }
    const dot = (x, y, col, t, r = 6) => { c.fillStyle = col; c.beginPath(); c.arc(x * S, y * S, r, 0, 7); c.fill(); c.fillStyle = '#000'; c.fillText(t, x * S + 9, y * S + 5); c.fillStyle = '#fff'; c.fillText(t, x * S + 8, y * S + 4); };
    for (const k of geo.creeks) dot(k.x, k.y, '#0ff', k.name, 5);
    dot(geo.dam[0], geo.dam[1], '#fff', 'DAM', 8); dot(geo.inflow[0], geo.inflow[1], '#ff0', 'INFLOW', 8);
    if (def) { for (const s of def.spots) dot(s.x, s.y, s.hidden ? '#6c3' : '#f80', s.id + ' ' + s.type, 7); dot(def.ramp.x, def.ramp.y, '#a70', 'RAMP ' + def.ramp.name, 8); for (const l of def.landmarks) dot(l.x, l.y, '#c33', 'LM ' + l.label, 7); for (const m of def.markers || []) dot(m.x, m.y, '#fff', '#' + m.n, 4); }
  }, { geo, def: placed[id] || null });
  const out = path.join(ROOT, 'research/geo', `preview-${id}.png`);
  await page.screenshot({ path: out }); await page.close(); console.log('wrote', path.relative(process.cwd(), out));
}
await browser.close();
