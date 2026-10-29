// Dev screenshots of the 3D scenes with the real GPU (the harness runs SwiftShader). Serves the repo locally,
// runs a scenario through window.__game, saves PNGs to screenshots/dev/ and prints console errors and fps.
//   node games/fishing/tools/shot.mjs <scenario> [--mobile] [--swiftshader] [--q=low] [--gl=0]
// Scenarios are below (map-<lake>, spot-<id>, fight, night, ...).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..'), ROOT = path.resolve(GAME, '../..');
const require = createRequire(path.join(ROOT, 'shared/test-harness/package.json'));
const { chromium } = require('playwright');
const args = process.argv.slice(2); const flag = (n) => args.find((a) => a.startsWith('--' + n));
const mobile = !!flag('mobile'), soft = !!flag('swiftshader');
const qs = ['q', 'gl'].map((k) => flag(k)).filter(Boolean).map((f) => f.slice(2)).join('&');
const scen = args.filter((a) => !a.startsWith('--'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: soft ? [] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('request', (q) => { if (!q.url().startsWith(`http://127.0.0.1:${port}`) && !q.url().startsWith('data:')) errs.push('EXTERNAL ' + q.url()); });
await page.goto(`http://127.0.0.1:${port}/games/fishing/index.html${qs ? '?' + qs : ''}`);
try { await page.waitForFunction(() => window.__game, null, { timeout: 8000 }); } catch (e) { console.log(errs.join(' | ')); process.exit(1); }
const G = (m, ...a) => page.evaluate(([m, a]) => window.__game[m](...a), [m, a]);
const ready = async (ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await G('isIdle')) return; await page.waitForTimeout(100); } console.log('  (not idle)'); };
const fps = (ms = 1500) => page.evaluate((ms) => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000) * 10) / 10); }; requestAnimationFrame(f); }), ms);
const outName = (flag('out') || '--out=dev').slice(6); const out = path.join(GAME, 'screenshots', outName); fs.mkdirSync(out, { recursive: true });
const shot = async (name) => { const f = path.join(out, `${name}${mobile ? '-m' : ''}${soft ? '-sw' : ''}.png`); await page.screenshot({ path: f }); console.log('  shot', path.relative(ROOT, f)); };
const quick = (o) => G('newGame', { mode: 'quick', lake: o.lake || 'hamilton', month: o.month || 5, tier: 'regional', seed: o.seed || 7, start: true, hour: o.hour != null ? o.hour * 60 : undefined, weather: o.weather });
const fish = async (spot) => { await G('act', 'runTo', spot); await G('act', 'finishAnim'); await G('act', 'fishHere'); };

const S = {
  async map(lake = 'hamilton', month = 5, hour) { await quick({ lake, month, hour }); await ready(); console.log('  fps', await fps()); await shot(`map-${lake}-${month}${hour ? '-' + hour : ''}`); },
  async run(lake = 'hamilton', spot = 'h-garvan') { await quick({ lake }); await ready(); await G('act', 'runTo', spot); await page.waitForTimeout(900); console.log('  fps', await fps(600)); await shot(`run-${lake}`); },
  async spot(id = 'h-garvan', lake = 'hamilton', month = 5, hour, sky) { await quick({ lake, month, hour, weather: sky ? { sky } : undefined }); await ready(); await fish(id); await ready(); console.log('  fps', await fps()); await shot(`spot-${id}-${month}${hour ? '-' + hour : ''}${sky ? '-' + sky : ''}`); },
  async cast(id = 'h-garvan') { await quick({}); await ready(); await fish(id); await ready(); await G('act', 'cast', 0.4, 0.35, 1); await G('act', 'finishAnim'); await G('act', 'reel', true); await page.waitForTimeout(600); console.log('  fps', await fps()); await shot(`cast-${id}`); },
  async fight(id = 'h-garvan') { await quick({}); await ready(); await fish(id); await ready(); await G('act', 'cast', 0.5, 0.3, 1); await G('act', 'finishAnim'); await G('act', 'forceBite', 'largemouth', 5); await G('act', 'setHook'); await G('act', 'reel', true); await page.waitForTimeout(700); console.log('  fps', await fps()); await shot(`fight-${id}`); },
  async title() { await ready(); await page.waitForTimeout(500); await shot('title'); },
  async campaign() { await ready(); await G('scene', 'campaign'); await page.waitForTimeout(400); await shot('campaign'); },
  async briefing(lake = 'ouachita', month = 10) { await G('newGame', { mode: 'quick', lake, month, tier: 'championship', seed: 5, start: false }); await page.waitForTimeout(500); await shot(`briefing-${lake}`); },
  async catchcard(sp = 'largemouth', w = 6.2) { await quick({ hour: 10, weather: { sky: 'clear' } }); await ready(); await fish('h-docks'); await ready(); await G('act', 'cast', 0.5, 0.3, 1); await G('act', 'finishAnim'); await G('act', 'forceBite', sp, w); await G('act', 'setHook'); await G('act', 'land'); await page.waitForTimeout(1200); await shot(`catch-${sp}`); },
  async weighin() { await quick({ hour: 10, weather: { sky: 'clear' } }); await ready(); for (const w of [3.2, 4.1, 2.8]) { await G('act', 'keepFish', { sp: 'largemouth', w, lure: 'craw', color: 'green pumpkin', t: 600 }); } await G('act', 'endDay'); await G('act', 'finishAnim'); await page.waitForTimeout(800); await shot('weighin'); },
  async underwater(id = 'o-geo') { await quick({ lake: 'ouachita', month: 6, hour: 11, weather: { sky: 'clear' } }); await ready(); await fish(id); await ready(); await G('act', 'cast', 0.5, 0.35, 1); await G('act', 'finishAnim'); await G('act', 'lure', 'crankS'); await G('act', 'reel', true); await page.waitForTimeout(900); await shot(`underwater-${id}`); },
  async jump(id = 'h-docks') { await quick({ hour: 10, weather: { sky: 'clear' } }); await ready(); await fish(id); await ready(); await G('act', 'cast', 0.45, 0.32, 1); await G('act', 'finishAnim'); await G('act', 'forceBite', 'largemouth', 5.2); await G('act', 'setHook'); await G('pause'); await G('setState', { fish: { fight: { jump: 0.36, jumpT: 9, x: 0.45, y: 0.4 } } }); await page.waitForTimeout(400); await shot(`jump-${id}`); await G('resume'); },
};
for (const sc of scen.length ? scen : ['map']) {
  const [name, ...a] = sc.split(':'); console.log(name, a.join(' '));
  await S[name](...a.map((x) => (/^\d+$/.test(x) ? +x : x)));
}
const st = await G('getState'); console.log('  gfx', JSON.stringify(st.gfx));
if (errs.length) console.log('CONSOLE:\n  ' + [...new Set(errs)].slice(0, 20).join('\n  '));
await browser.close(); server.close();
