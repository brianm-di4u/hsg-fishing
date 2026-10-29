// Checks spot placement on the real lakes with the game's own code (src/js/lakes.js in Node):
// snapped position, distance to shore, estimated map depth, run minutes from the ramp, and spots
// that moved far when snapped. Then renders research/geo/preview-<lake>.png with the snapped spots.
//   node games/fishing/tools/geo/place.mjs [lake ...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['catherine', 'hamilton', 'ouachita', 'degray'];
for (const id of ['catherine', 'hamilton', 'ouachita', 'degray']) globalThis['GEO_' + id.toUpperCase()] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geo', id + '.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fish-place-'));
for (const f of fs.readdirSync(path.join(ROOT, 'src/js'))) fs.writeFileSync(path.join(tmp, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(ROOT, 'src/js', f), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'"));
const { getLake, route } = await import(pathToFileURL(path.join(tmp, 'lakes.mjs')).href);
const { LAKES } = await import(pathToFileURL(path.join(tmp, 'data.mjs')).href);
const placed = {};
for (const id of ids) {
  const L = getLake(id), def = LAKES[id], m = L.mPerUnit;
  console.log(`\n${def.name}: ${L.miles} mi map, ${m} m/unit`);
  const show = (p, src) => {
    const moved = Math.hypot(p.x - src.x, p.y - src.y) * m; const r = p.id === 'ramp' ? null : route(L, L.ramp, p);
    console.log(`  ${(p.id || 'ramp').padEnd(10)} ${p.type.padEnd(8)} (${p.x.toFixed(0)},${p.y.toFixed(0)}) shore ${(L.shoreDist(p.x, p.y) * m).toFixed(0).padStart(4)} m · map depth ${L.depthAt(p.x, p.y).toFixed(0).padStart(3)} ft (spot ${p.depth} ft)` +
      (r ? ` · ${r.miles.toFixed(1)} mi from ramp` : '') + (moved > 60 ? `  ** moved ${moved.toFixed(0)} m` : '') + (r && r.pts.length < 2 ? '  ** NO ROUTE' : ''));
  };
  show(L.ramp, def.ramp); for (const s of L.spots) show(s, def.spots.find((q) => q.id === s.id));
  placed[id] = { ramp: L.ramp, spots: L.spots, markers: L.markers, landmarks: def.landmarks };
}
const out = path.join(tmp, 'placed.json'); fs.writeFileSync(out, JSON.stringify(placed));
execFileSync(process.execPath, [path.join(HERE, 'preview.mjs'), '--placed', out, ...ids], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
