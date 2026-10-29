// Real-GPU performance pass (the test harness renders with SwiftShader): fps in the busiest scenes, load timings,
// heap and download size, at desktop and phone sizes. Phone runs throttle the CPU 4× as a stand-in for a phone.
//   node tools/perf.mjs [--swiftshader] [--cpu=4]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..'), ROOT = path.resolve(GAME);
const require = createRequire(path.join(ROOT, 'shared/test-harness/package.json'));
const { chromium } = require('playwright');
const soft = process.argv.includes('--swiftshader');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((res) => server.listen(0, '127.0.0.1', res)); const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: soft ? [] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
for (const vp of ['desktop', 'mobile']) {
  const ctx = await browser.newContext(vp === 'mobile' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  if (vp === 'mobile') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now(); await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game); const hooks = Date.now() - t0;
  const G = (m, ...a) => page.evaluate(([m, a]) => window.__game[m](...a), [m, a]);
  await page.waitForFunction(() => { const s = window.__game.getState(); return s.gfx && !s.gfx.loading && s.gfx.plates; }, null, { timeout: 60000 }); const ready = Date.now() - t0;
  const fps = (ms = 2500) => page.evaluate((ms) => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); if (t - ts[0] < ms) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); res({ fps: Math.round((ts.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000) * 10) / 10, p95ms: Math.round(d[Math.floor(d.length * 0.95)] * 10) / 10 }); } }; requestAnimationFrame(f); }), ms);
  const idle = async () => { await page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600); };
  const row = { vp, hooksMs: hooks, readyMs: ready, gpu: (await G('getState')).gfx.gpu, tier: (await G('getState')).gfx.tier };
  await G('newGame', { mode: 'quick', lake: 'ouachita', month: 10, tier: 'regional', seed: 3, start: true, hour: 600, weather: { sky: 'clear' } }); await idle();
  row.mapOuachita = await fps();
  await G('act', 'runTo', 'o-upper'); row.run = await fps(1500); await G('act', 'finishAnim');
  await G('newGame', { mode: 'quick', lake: 'hamilton', month: 5, tier: 'regional', seed: 3, start: true, hour: 600, weather: { sky: 'clear' } }); await idle();
  await G('act', 'runTo', 'h-docks'); await G('act', 'finishAnim'); await G('act', 'fishHere'); await idle();
  row.spotDocks = await fps();
  await G('act', 'cast', 0.45, 0.35, 1); await G('act', 'finishAnim'); await G('act', 'forceBite', 'largemouth', 5); await G('act', 'setHook'); await G('act', 'reel', true);
  row.fight = await fps();
  await G('newGame', { mode: 'quick', lake: 'ouachita', month: 1, tier: 'regional', seed: 3, start: true, hour: 660, weather: { sky: 'rain' } }); await idle();
  await G('act', 'runTo', 'o-dam'); await G('act', 'finishAnim'); await G('act', 'fishHere'); await idle();
  row.rainDam = await fps();
  row.heapMB = Math.round(await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0)));
  results.push(row); console.log(JSON.stringify(row));
  await ctx.close();
}
const sizes = { 'index.html': fs.statSync(path.join(GAME, 'index.html')).size, three: fs.statSync(path.join(GAME, 'vendor/three-0.180.0.min.js')).size };
for (const f of fs.readdirSync(path.join(GAME, 'assets')).filter((x) => x.startsWith('pack-'))) sizes[f] = fs.statSync(path.join(GAME, 'assets', f)).size;
console.log('sizes KB', JSON.stringify(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, Math.round(v / 1024)]))), 'total MB', (Object.values(sizes).reduce((a, b) => a + b, 0) / 1048576).toFixed(2));
fs.writeFileSync(path.join(GAME, 'screenshots', `perf-${soft ? 'swiftshader' : 'gpu'}.json`), JSON.stringify({ results, sizes }, null, 1));
await browser.close(); server.close();
