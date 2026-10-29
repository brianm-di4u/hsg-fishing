// AI-field calibration (AC28). Evaluates the game's own src/js/sim.js in Node and prints the mean winning
// bag per campaign event over many seeds. Run: node tools/calibrate.mjs [seeds]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '../src/js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fishing-calib-'));
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.js'))) {
  fs.writeFileSync(path.join(tmp, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(src, f), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'"));
}
const { fieldBag } = await import(pathToFileURL(path.join(tmp, 'sim.mjs')));
const { makeRng } = await import(pathToFileURL(path.join(tmp, 'util.mjs')));
const { CHAPTERS, TIERS } = await import(pathToFileURL(path.join(tmp, 'data.mjs')));

const seeds = +process.argv[2] || 400;
const out = [];
for (const ch of CHAPTERS) {
  const T = TIERS[ch.tier]; const days = T.days || 1;
  let sum = 0;
  for (let s = 1; s <= seeds; s++) {
    const rng = makeRng(s * 7919);
    const skills = Array.from({ length: T.field }, () => rng.normal());
    let best = 0;
    const totals = skills.map(() => 0);
    for (let d = 0; d < days; d++) skills.forEach((k, i) => { const b = fieldBag(rng, ch.lake, ch.month, ch.tier, k); totals[i] = T.derby ? Math.max(totals[i], b.total) : totals[i] + b.total; });
    best = Math.max(...totals);
    sum += best;
  }
  const mean = sum / seeds;
  out.push({ event: ch.id, tier: ch.tier, lake: ch.lake, month: ch.month, target: T.target, mean: +mean.toFixed(2), err: +((mean / T.target - 1) * 100).toFixed(1) });
}
console.table(out);
fs.rmSync(tmp, { recursive: true, force: true });
