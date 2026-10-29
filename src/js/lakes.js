// Lake geometry: water mask from spines and islands, chamfer depth, spot snapping, routing, map rendering.
import { LAKES, SPOT_TYPES } from './data.js';
import { makeNoise, chamfer, segDist, clamp, lerp, makeRng, dist } from './util.js';

export const LW = 1000; // the inliner exports one name per declaration
export const LH = 625;
// The generated (fallback) lakes use a 400 x 250 grid; real lakes use the baked grid (800 x 500).
const GW = 400, GH = 250, CELL = LW / GW; // 2.5 lake units per cell
const built = {};
// Real lake geometry baked from USGS data by tools/geo/bake.mjs and inlined as GEO_<LAKE> (absent in Node tools).
/* global GEO_CATHERINE, GEO_HAMILTON, GEO_OUACHITA, GEO_DEGRAY */
const GEO = {
  catherine: typeof GEO_CATHERINE !== 'undefined' ? GEO_CATHERINE : null, hamilton: typeof GEO_HAMILTON !== 'undefined' ? GEO_HAMILTON : null,
  ouachita: typeof GEO_OUACHITA !== 'undefined' ? GEO_OUACHITA : null, degray: typeof GEO_DEGRAY !== 'undefined' ? GEO_DEGRAY : null,
};
export const geoFor = (id) => GEO[id];

export function getLake(id) { return built[id] || (built[id] = GEO[id] ? buildGeoLake(LAKES[id], GEO[id]) : buildLake(LAKES[id])); }

// Run-length decode (alternating 0/1 runs, varint bytes, base64) from bake.mjs.
export function unrle(b64, n) {
  const s = atob(b64); const m = new Uint8Array(n); let k = 0, v = 0, i = 0;
  while (i < s.length) { let r = 0, sh = 0, c; do { c = s.charCodeAt(i++); r |= (c & 127) << sh; sh += 7; } while (c & 128); if (v) m.fill(1, k, k + r); k += r; v ^= 1; }
  return m;
}

function buildGeoLake(def, geo) {
  const [gw, gh] = geo.grid, cell = LW / gw, mpu = geo.frame.mPerUnit;
  const mask = unrle(geo.mask, gw * gh), other = unrle(geo.other, gw * gh);
  const sd = chamfer(mask, gw, gh);
  const inv = new Uint8Array(gw * gh); for (let k = 0; k < inv.length; k++) inv[k] = mask[k] ? 0 : 1;
  const ld = chamfer(inv, gw, gh);
  const field = new Float32Array(gw * gh); // signed distance in lake units, water < 0
  for (let k = 0; k < field.length; k++) field[k] = mask[k] ? -(sd[k] - 0.5) * cell : (ld[k] - 0.5) * cell;
  // distance along the water from the dam (4-neighbour BFS), graded 1 at the dam to 0 at the far end
  const gd = new Int32Array(gw * gh).fill(-1); const q = new Int32Array(gw * gh); let qh = 0, qt = 0;
  const di = Math.floor(geo.dam[0] / cell), dj = Math.floor(geo.dam[1] / cell);
  let best = -1, bd = 1e9;
  for (let j = Math.max(0, dj - 40); j < Math.min(gh, dj + 40); j++) for (let i = Math.max(0, di - 40); i < Math.min(gw, di + 40); i++) {
    const k = j * gw + i; if (!mask[k]) continue; const d = (i - di) ** 2 + (j - dj) ** 2; if (d < bd) { bd = d; best = k; }
  }
  if (best >= 0) { gd[best] = 0; q[qt++] = best; }
  let gmax = 1;
  while (qh < qt) {
    const k = q[qh++], i = k % gw, j = (k / gw) | 0;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || b < 0 || a >= gw || b >= gh) continue; const n = b * gw + a;
      if (!mask[n] || gd[n] >= 0) continue; gd[n] = gd[k] + 1; if (gd[n] > gmax) gmax = gd[n]; q[qt++] = n;
    }
  }
  const depth = new Float32Array(gw * gh); const scaleM = def.depthScale || 150;
  for (let k = 0; k < depth.length; k++) {
    if (!mask[k]) continue;
    const along = gd[k] >= 0 ? 1 - gd[k] / gmax : 0.3;
    const sM = sd[k] * cell * mpu;
    depth[k] = Math.max(1, def.maxDepth * (1 - Math.exp(-sM / scaleM)) * (0.4 + 0.6 * along));
  }
  const islands = geo.islands.map((i) => i.slice());
  const L = { def, id: def.id, geo, field, mask, other, depth, sd, islands, rng: makeRng(def.seed * 101), grid: { w: gw, h: gh, cell }, mPerUnit: mpu, miles: geo.frame.miles };
  return finishLake(L, def, islands);
}

function buildLake(def) {
  const noise = makeNoise(def.seed);
  const rng = makeRng(def.seed * 101);
  const islands = def.islands.map((i) => i.slice());
  for (const s of def.spots) if (s.marker) islands.push([s.x + 22, s.y - 18, 8]);
  // segments with half-widths and main-spine "along" parameter
  const segs = [];
  def.spines.forEach((sp, k) => {
    for (let i = 0; i < sp.pts.length - 1; i++) {
      segs.push({ a: sp.pts[i], b: sp.pts[i + 1], wa: sp.w[i], wb: sp.w[i + 1], main: k === 0, i, n: sp.pts.length - 1 });
    }
  });
  const field = new Float32Array(GW * GH);
  const along = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL;
    let f = 1e9, al = 0, bestMain = 1e9;
    for (const s of segs) {
      const r = segDist(x, y, s.a[0], s.a[1], s.b[0], s.b[1]);
      let v = r.d - lerp(s.wa, s.wb, r.t);
      if (s.main && s.i === s.n - 1 && r.t >= 1) {
        // the dam closes the main channel: no rounded cap past the last vertex
        const ex = s.b[0] - s.a[0], ey = s.b[1] - s.a[1];
        if (((x - s.b[0]) * ex + (y - s.b[1]) * ey) > 0) v = 1e9;
      }
      if (v < f) f = v;
      if (s.main && r.d < bestMain) { bestMain = r.d; al = (s.i + r.t) / s.n; }
    }
    f += (noise(x / 38, y / 38) - 0.5) * def.amp;
    // keep a land border except where the river leaves the map
    const edge = Math.min(x, y, LW - x, LH - y);
    if (edge < 6 && f < 0 && !(x < 8)) f = Math.max(f, 6 - edge);
    field[j * GW + i] = f;
    along[j * GW + i] = al;
  }
  // islands carved from the water after the base field, so generated ones only land in open water
  if (def.islandField) {
    const f = def.islandField; const ir = makeRng(f.seed);
    let tries = 0;
    while (islands.length < f.n + def.islands.length && tries++ < 3000) {
      const x = ir.range(f.x0, f.x1), y = ir.range(60, 580), r = ir.range(4, 14);
      const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
      if (field[cj * GW + ci] > -(r + 12)) continue;
      if (def.spots.some((s) => dist(s.x, s.y, x, y) < r + 22) || dist(def.ramp.x, def.ramp.y, x, y) < r + 30) continue;
      if (islands.some((o) => dist(o[0], o[1], x, y) < o[2] + r + 10)) continue;
      islands.push([x, y, r]);
    }
  }
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL; let f = field[j * GW + i];
    for (const [ix, iy, ir] of islands) {
      if (Math.abs(x - ix) > ir * 1.4 || Math.abs(y - iy) > ir * 1.4) continue;
      const g = ir * (0.8 + 0.5 * noise(x / 14 + ix, y / 14 + iy)) - dist(x, y, ix, iy);
      if (g > 0) f = Math.max(f, g);
    }
    field[j * GW + i] = f;
  }
  const mask = new Uint8Array(GW * GH);
  for (let k = 0; k < mask.length; k++) mask[k] = field[k] < 0 ? 1 : 0;
  const sd = chamfer(mask, GW, GH);
  const depth = new Float32Array(GW * GH);
  for (let k = 0; k < depth.length; k++) {
    if (!mask[k]) continue;
    const s = sd[k] * CELL;
    depth[k] = Math.max(1, def.maxDepth * (1 - Math.exp(-s / 42)) * (0.45 + 0.55 * along[k]));
  }
  const L = { def, id: def.id, field, mask, depth, sd, islands, rng, grid: { w: GW, h: GH, cell: CELL }, mPerUnit: def.miles * 1609.34 / LW, miles: def.miles };
  return finishLake(L, def, islands);
}

// Shared: lookups, spot and ramp snapping, island markers.
function finishLake(L, def, islands) {
  const { w: gw, h: gh, cell } = L.grid; const { mask, depth, sd } = L;
  L.water = (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell); return i >= 0 && j >= 0 && i < gw && j < gh && mask[j * gw + i] === 1; };
  L.depthAt = (x, y) => { const i = clamp(Math.floor(x / cell), 0, gw - 1), j = clamp(Math.floor(y / cell), 0, gh - 1); return depth[j * gw + i]; };
  L.shoreDist = (x, y) => { const i = clamp(Math.floor(x / cell), 0, gw - 1), j = clamp(Math.floor(y / cell), 0, gh - 1); return sd[j * gw + i] * cell; };
  const m2u = (m) => m / L.mPerUnit;
  // snap to the nearest water cell at least minShore lake units from shore (else the most open cell within maxR)
  const snap = (p, minShore, maxR = 60, maxShore = 1e9) => {
    const sdp = L.shoreDist(p.x, p.y);
    if (L.water(p.x, p.y) && sdp >= minShore && sdp <= maxShore) return p;
    let best = null, bd = 1e9, open = null, od = -1e9;
    const ci = Math.floor(p.x / cell), cj = Math.floor(p.y / cell), R = Math.min(Math.max(gw, gh), Math.ceil(maxR / cell));
    for (let j = Math.max(0, cj - R); j < Math.min(gh, cj + R); j++) for (let i = Math.max(0, ci - R); i < Math.min(gw, ci + R); i++) {
      const k = j * gw + i; if (!mask[k]) continue;
      const x = (i + 0.5) * cell, y = (j + 0.5) * cell, d = dist(x, y, p.x, p.y);
      if (d > maxR) continue;
      if (sd[k] * cell >= minShore && sd[k] * cell <= maxShore && d < bd) { bd = d; best = { x, y }; }
      if (sd[k] * cell - d * 0.25 > od) { od = sd[k] * cell - d * 0.25; open = { x, y }; }
    }
    const b = best || open;
    return b ? { ...p, x: b.x, y: b.y } : p;
  };
  const geoMode = !!L.geo;
  L.spots = def.spots.map((s) => {
    const shore = SPOT_TYPES[s.type].shore;
    // shore spots sit 30–90 m off the bank (the spot view shows that bank); open-water spots at least 110 m out
    return geoMode ? (shore ? snap({ ...s }, m2u(30), 60, m2u(90)) : snap({ ...s }, m2u(110))) : snap({ ...s }, shore ? 4 : 14, 1e9);
  });
  L.ramp = { id: 'ramp', type: 'ramp', depth: 6, ...(geoMode ? snap({ ...def.ramp }, m2u(25)) : snap({ ...def.ramp }, 4, 1e9)) };
  L.markers = [];
  if (def.markers) {
    const used = new Set();
    const nums = () => { const o = []; for (let n = def.markers.from; n <= def.markers.to; n++) if (!used.has(n)) o.push(n); return o; };
    const place = (ns, isl) => ns.forEach((n, k) => { const i = isl[Math.round((k + 0.5) * isl.length / ns.length - 0.5)]; if (i) L.markers.push({ n, x: i[0], y: i[1] }); });
    if (geoMode) {
      // marker spots sit beside a real island: that island takes the number
      const isl = islands.filter((i) => i[2] * L.mPerUnit >= 25);
      for (const s of def.spots) if (s.marker) {
        let b = null, bd = 1e9; for (const i of isl) { const d = dist(i[0], i[1], s.x, s.y); if (!i.used && d < bd) { bd = d; b = i; } }
        if (b) { L.markers.push({ n: s.marker, x: b[0], y: b[1] }); used.add(s.marker); b.used = true; }
      }
      const rest = isl.filter((i) => !i.used && i[2] * L.mPerUnit >= 40).sort((a, b) => a[0] - b[0]);
      const mx = L.markers.map((m) => m.x); const lo = Math.min(...mx), hi = Math.max(...mx); const ns = nums();
      place(ns.filter((n) => n < 28), rest.filter((i) => i[0] < lo - 10)); place(ns.filter((n) => n > 28 && n < 36), rest.filter((i) => i[0] > lo && i[0] < hi)); place(ns.filter((n) => n > 36), rest.filter((i) => i[0] > hi + 10));
    } else {
      for (const s of def.spots) if (s.marker) { L.markers.push({ n: s.marker, x: s.x + 22, y: s.y - 18 }); used.add(s.marker); }
      const rest = islands.filter((i) => i[2] >= 7 && !def.spots.some((s) => s.marker && dist(s.x + 22, s.y - 18, i[0], i[1]) < 4)).sort((a, b) => a[0] - b[0]);
      // spread remaining numbers left-to-right so they read in order with the brush-pile markers
      const ns = nums();
      place(ns.filter((n) => n < 28), rest.filter((i) => i[0] < 450)); place(ns.filter((n) => n > 28 && n < 36), rest.filter((i) => i[0] >= 470 && i[0] <= 720)); place(ns.filter((n) => n > 36), rest.filter((i) => i[0] > 740));
    }
  }
  L.allPoints = () => [L.ramp, ...L.spots];
  L.spot = (id) => (id === 'ramp' ? L.ramp : L.spots.find((s) => s.id === id));
  L.paths = new Map();
  return L;
}

// ---------- routing (A* on the water grid: full resolution for real lakes, half for generated ones) ----------
export function route(L, from, to) {
  const key = `${Math.round(from.x)},${Math.round(from.y)}>${Math.round(to.x)},${Math.round(to.y)}`;
  if (L.paths.has(key)) return L.paths.get(key);
  const f = L.geo ? 1 : 2, gw = L.grid.w, W = gw / f, H = L.grid.h / f, C = L.grid.cell * f;
  if (!L.coarse) {
    L.coarse = new Uint8Array(W * H); L.open = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let ok = 0, sd = 0; for (let dj = 0; dj < f; dj++) for (let di = 0; di < f; di++) { const k = (j * f + dj) * gw + i * f + di; ok += L.mask[k]; sd += L.sd[k]; }
      L.coarse[j * W + i] = ok >= (f === 1 ? 1 : 3) ? 1 : 0;
      L.open[j * W + i] = 1 + 0.8 / (1 + sd / (f * f)); // a little extra cost hugging the bank, so runs follow the channel
    }
  }
  const cg = L.coarse, open = L.open;
  const near = (p) => {
    let i = clamp(Math.floor(p.x / C), 0, W - 1), j = clamp(Math.floor(p.y / C), 0, H - 1);
    if (cg[j * W + i]) return j * W + i;
    let best = -1, bd = 1e9;
    for (let r = 1; r < 30 && best < 0; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H || !cg[b * W + a]) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = b * W + a; }
    }
    return best < 0 ? j * W + i : best;
  };
  const s = near(from), g = near(to);
  const gx = g % W, gy = (g / W) | 0;
  const h = (k) => { const dx = Math.abs((k % W) - gx), dy = Math.abs(((k / W) | 0) - gy); return dx + dy - 0.586 * Math.min(dx, dy); };
  const cost = new Float32Array(W * H).fill(1e9); const prev = new Int32Array(W * H).fill(-1);
  // binary heap of (f, node) in typed arrays
  let hk = new Int32Array(1024), hf = new Float32Array(1024), hn = 0;
  const push = (k, fv) => {
    if (hn === hk.length) { const k2 = new Int32Array(hn * 2); k2.set(hk); hk = k2; const f2 = new Float32Array(hn * 2); f2.set(hf); hf = f2; }
    let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= fv) break; hk[i] = hk[p]; hf[i] = hf[p]; i = p; } hk[i] = k; hf[i] = fv;
  };
  const pop = () => {
    const top = hk[0]; hn--; if (hn > 0) { const lk = hk[hn], lf = hf[hn]; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i, mf = lf; if (l < hn && hf[l] < mf) { m = l; mf = hf[l]; } if (r < hn && hf[r] < mf) m = r; if (m === i) break; hk[i] = hk[m]; hf[i] = hf[m]; i = m; }
      hk[i] = lk; hf[i] = lf; }
    return top;
  };
  cost[s] = 0; push(s, h(s));
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
  const closed = new Uint8Array(W * H);
  while (hn) {
    const k = pop(); if (k === g) break; if (closed[k]) continue; closed[k] = 1;
    const x = k % W, y = (k / W) | 0;
    for (let d = 0; d < 8; d++) {
      const a = x + DX[d], b = y + DY[d]; if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const n = b * W + a; if (!cg[n] || closed[n]) continue;
      if (d >= 4 && (!cg[y * W + a] || !cg[b * W + x])) continue; // no corner cutting across land
      const nc = cost[k] + DC[d] * open[n]; if (nc < cost[n]) { cost[n] = nc; prev[n] = k; push(n, nc + h(n)); }
    }
  }
  let pts = [];
  if (prev[g] >= 0 || g === s) { for (let k = g; k >= 0; k = prev[k]) { pts.push([(k % W + 0.5) * C, (((k / W) | 0) + 0.5) * C]); if (k === s) break; } pts.reverse(); }
  pts = simplify(L, [[from.x, from.y], ...pts, [to.x, to.y]]);
  let len = 0; for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  const r = { pts, len, miles: len / LW * L.miles };
  L.paths.set(key, r);
  return r;
}
// drop points while the straight line between survivors stays on water
function simplify(L, pts) {
  const step = L.grid.cell * 0.7;
  const clear = (a, b) => { const n = Math.ceil(dist(a[0], a[1], b[0], b[1]) / step); for (let i = 1; i < n; i++) { const t = i / n; if (!L.water(lerp(a[0], b[0], t), lerp(a[1], b[1], t))) return false; } return true; };
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) {
    // binary-ish search from the far end keeps this fast on long full-resolution paths
    let j = pts.length - 1; let lo = i + 1;
    while (j > lo && !clear(pts[i], pts[j])) j = Math.max(lo, j - Math.max(1, (j - lo) >> 3));
    out.push(pts[j]); i = j;
  }
  return out;
}
export function pathPoint(r, t) {
  let target = r.len * clamp(t, 0, 1), acc = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], l = dist(a[0], a[1], b[0], b[1]);
    if (acc + l >= target || i === r.pts.length - 1) { const u = l ? (target - acc) / l : 0; return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }
    acc += l;
  }
  return { x: r.pts[0][0], y: r.pts[0][1], ang: 0 };
}

// ---------- view transform (landscape, or rotated 90° for portrait screens) ----------
export function makeView(rect, portrait) {
  let s, m;
  if (!portrait) {
    s = Math.min(rect.w / LW, rect.h / LH);
    const ox = rect.x + (rect.w - LW * s) / 2, oy = rect.y + (rect.h - LH * s) / 2;
    m = [s, 0, 0, s, ox, oy];
  } else {
    s = Math.min(rect.w / LH, rect.h / LW);
    const ox = rect.x + (rect.w - LH * s) / 2, oy = rect.y + (rect.h - LW * s) / 2;
    m = [0, s, -s, 0, ox + LH * s, oy];
  }
  const v = { s, m, portrait, rect };
  v.toS = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  v.toL = (sx, sy) => { const det = m[0] * m[3] - m[1] * m[2]; const x = sx - m[4], y = sy - m[5]; return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det]; };
  v.ang = (a) => (portrait ? a + Math.PI / 2 : a);
  return v;
}

// ---------- map rendering (cached per lake/size/DPR/season) ----------
const depthStops = [[0, [104, 170, 196]], [6, [76, 143, 168]], [15, [58, 118, 152]], [30, [44, 96, 136]], [60, [34, 80, 121]], [120, [26, 66, 104]], [220, [20, 52, 86]]];
function depthRGB(d) {
  for (let i = 1; i < depthStops.length; i++) if (d <= depthStops[i][0]) {
    const [d0, c0] = depthStops[i - 1], [d1, c1] = depthStops[i]; const t = (d - d0) / (d1 - d0);
    return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
  }
  return depthStops[depthStops.length - 1][1];
}

function contours(L, values, level, sign = 1) {
  // marching squares → segments in lake units
  const segsOut = []; const { w, h, cell } = L.grid;
  const v = (i, j) => sign * (values[j * w + i] - level);
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
    const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
    const T = [x + cell * (a / (a - b)), y], R = [x + cell, y + cell * (b / (b - c))], B = [x + cell * (d / (d - c)), y + cell], Lf = [x, y + cell * (a / (a - d))];
    const add = (p, q) => segsOut.push(p[0], p[1], q[0], q[1]);
    switch (idx) {
      case 1: case 14: add(Lf, B); break; case 2: case 13: add(B, R); break; case 3: case 12: add(Lf, R); break;
      case 4: case 11: add(T, R); break; case 5: add(Lf, T); add(B, R); break; case 6: case 9: add(T, B); break;
      case 7: case 8: add(Lf, T); break; case 10: add(T, R); add(Lf, B); break;
    }
  }
  return segsOut;
}

export function landPalette(month) {
  if (month === 10 || month === 11) return { base: '#3A4A2A', light: '#56663A', tree: '#1F3324', accent: ['#C8501F', '#B5654A', '#D9A23A'] };
  if (month === 12 || month <= 2) return { base: '#47503A', light: '#5E6448', tree: '#1F3324', accent: ['#7B6248', '#8C877C'] };
  if (month === 3 || month === 4) return { base: '#2F4A2C', light: '#5C7A3A', tree: '#1F3324', accent: ['#B5568F', '#F6F3EC'] };
  return { base: '#2F4A2C', light: '#4E6E34', tree: '#1F3324', accent: ['#5C7A3A'] };
}

// ---------- real terrain (3DEP heights above the pool, decoded from the baked PNG) ----------
const demCache = {};
export function demHeights(id) { return demCache[id] ? demCache[id].h : null; }
export function loadDem(id) {
  const g = GEO[id]; if (!g || typeof Image === 'undefined') return Promise.resolve(null);
  if (demCache[id]) return demCache[id].p;
  const e = demCache[id] = { h: null };
  const img = new Image(); img.src = g.dem.png;
  e.p = img.decode().then(() => {
    const c = document.createElement('canvas'); c.width = g.dem.w; c.height = g.dem.h; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const h = new Float32Array(c.width * c.height); const span = g.dem.max - g.dem.min;
    for (let k = 0; k < h.length; k++) h[k] = d[k * 4] / 255 * span + g.dem.min;
    // NLCD land cover classes (value / 23), decoded alongside the terrain; heights publish once both are in
    if (!g.landcover) { e.h = h; return h; }
    const li = new Image(); li.src = g.landcover.png;
    return li.decode().then(() => { const c2 = document.createElement('canvas'); c2.width = g.landcover.w; c2.height = g.landcover.h; const x2 = c2.getContext('2d'); x2.drawImage(li, 0, 0);
      const dd = x2.getImageData(0, 0, c2.width, c2.height).data; const lc = new Uint8Array(c2.width * c2.height); for (let k = 0; k < lc.length; k++) lc[k] = Math.round(dd[k * 4] / 23); e.lc = lc; e.h = h; return h; });
  }).catch(() => null);
  return e.p;
}
export function landcover(id) { return demCache[id] ? demCache[id].lc || null : null; }

// The lake's own dam crest (lake units): an NHD dam line near the dam point, else the narrowest crossing there.
export function damLines(L) {
  if (!L.geo) return [];
  const g = L.geo, out = [];
  for (const d of g.dams) out.push({ pts: d.pts, own: dist(d.pts[0][0], d.pts[0][1], g.dam[0], g.dam[1]) < 25, name: d.name });
  if (!out.some((d) => d.own)) {
    const { w, h, cell } = L.grid; let c = null, bd = 1e9;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!L.mask[j * w + i]) continue; const x = (i + 0.5) * cell, y = (j + 0.5) * cell, d = dist(x, y, g.dam[0], g.dam[1]); if (d < bd) { bd = d; c = [x, y]; } }
    if (c) {
      let best = null;
      for (let a = 0; a < 180; a += 3) {
        const dx = Math.cos(a * Math.PI / 180), dy = Math.sin(a * Math.PI / 180); const ends = [];
        for (const sgn of [1, -1]) { let t = 0; while (t < 120 && L.water(c[0] + sgn * dx * t, c[1] + sgn * dy * t)) t += cell * 0.5; ends.push(t); }
        const len = ends[0] + ends[1]; if (!best || len < best.len) best = { len, dx, dy, ends };
      }
      const ext = best.len * 0.12 + 3;
      out.push({ own: true, pts: [[c[0] - best.dx * (best.ends[1] + ext), c[1] - best.dy * (best.ends[1] + ext)], [c[0] + best.dx * (best.ends[0] + ext), c[1] + best.dy * (best.ends[0] + ext)]] });
    }
  }
  return out;
}

export function renderMap(L, view, dpr, month, cssW, cssH) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(cssW * dpr); cv.height = Math.ceil(cssH * dpr);
  const ctx = cv.getContext('2d');
  const pal = landPalette(month);
  const M = view.m; const { w: GWl, h: GHl, cell: CL } = L.grid;
  const setLake = () => ctx.setTransform(M[0] * dpr, M[1] * dpr, M[2] * dpr, M[3] * dpr, M[4] * dpr, M[5] * dpr);
  // backdrop beyond the map frame
  ctx.fillStyle = '#16301F'; ctx.fillRect(0, 0, cv.width, cv.height);
  setLake();
  const dem = demHeights(L.id);
  ctx.fillStyle = pal.base; ctx.fillRect(0, 0, LW, LH);
  if (dem) {
    // hillshade from the real terrain, lit from the north-west, tinted by the season's palette
    const g = L.geo.dem, dw = g.w, dh = g.h, cellM = LW / dw * L.mPerUnit; const base = hex(pal.base), lite = hex(pal.light);
    const img = new ImageData(dw, dh); const H = (i, j) => dem[clamp(j, 0, dh - 1) * dw + clamp(i, 0, dw - 1)];
    for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {
      const gx = (H(i + 1, j) - H(i - 1, j)) / (2 * cellM) * 2.5, gy = (H(i, j + 1) - H(i, j - 1)) / (2 * cellM) * 2.5;
      const nz = 1 / Math.sqrt(gx * gx + gy * gy + 1); const sh = clamp((-gx * -0.6 + -gy * -0.6 + 0.55) * nz * 1.15, 0, 1.25);
      const el = clamp(H(i, j) / g.max, 0, 1) * 0.18; const k = (j * dw + i) * 4;
      for (let c = 0; c < 3; c++) img.data[k + c] = clamp(lerp(base[c] * 0.55, lite[c] * 1.18, sh) + el * 60, 0, 255);
      img.data[k + 3] = 255;
    }
    const tmp = document.createElement('canvas'); tmp.width = dw; tmp.height = dh; tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, LW, LH);
  } else {
    // land with mottled light
    const noise = makeNoise(L.def.seed + 7);
    const lw = 125, lh = 78, img = new ImageData(lw, lh);
    const lc = hex(pal.light);
    for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
      const n = noise(i / 9, j / 9); const k = (j * lw + i) * 4;
      img.data[k] = lc[0]; img.data[k + 1] = lc[1]; img.data[k + 2] = lc[2]; img.data[k + 3] = Math.max(0, (n - 0.45)) * 230;
    }
    const tmp = document.createElement('canvas'); tmp.width = lw; tmp.height = lh; tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, LW, LH);
  }
  // pines (seeded stipple) on land
  const r = makeRng(L.def.seed * 31 + month);
  const field = (x, y) => L.field[clamp(Math.floor(y / CL), 0, GHl - 1) * GWl + clamp(Math.floor(x / CL), 0, GWl - 1)];
  const nPines = L.geo ? 4200 : 2600;
  for (let n = 0; n < nPines; n++) {
    const x = r.range(0, LW), y = r.range(0, LH);
    if (field(x, y) < 4 || (L.other && L.other[clamp(Math.floor(y / CL), 0, GHl - 1) * GWl + clamp(Math.floor(x / CL), 0, GWl - 1)])) continue;
    const s = r.range(2.6, 5.2);
    ctx.fillStyle = r.chance(0.12) ? r.pick(pal.accent) : (r.chance(0.5) ? pal.tree : '#26402A');
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.62, y + s * 0.5); ctx.lineTo(x - s * 0.62, y + s * 0.5); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // other water (ponds, the neighbouring lake below or above the dam): drawn, not fishable
  if (L.other) {
    const oi = new ImageData(GWl, GHl);
    for (let k = 0; k < GWl * GHl; k++) if (L.other[k]) { const o = k * 4; oi.data[o] = 88; oi.data[o + 1] = 140; oi.data[o + 2] = 168; oi.data[o + 3] = 235; }
    const ot = document.createElement('canvas'); ot.width = GWl; ot.height = GHl; ot.getContext('2d').putImageData(oi, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(ot, 0, 0, LW, LH);
  }
  // water depth image with antialiased edge
  const wi = new ImageData(GWl, GHl);
  for (let k = 0; k < GWl * GHl; k++) {
    const f = L.field[k]; if (f > CL) continue;
    const c = depthRGB(L.depth[k] || 1); const o = k * 4;
    wi.data[o] = c[0]; wi.data[o + 1] = c[1]; wi.data[o + 2] = c[2]; wi.data[o + 3] = clamp(0.5 - f / CL, 0, 1) * 255;
  }
  const wt = document.createElement('canvas'); wt.width = GWl; wt.height = GHl; wt.getContext('2d').putImageData(wi, 0, 0);
  ctx.drawImage(wt, 0, 0, LW, LH);
  // depth contour lines
  const lineW = 1 / view.s;
  ctx.lineWidth = lineW; ctx.strokeStyle = 'rgba(246,243,236,0.13)';
  for (const lv of [8, 18, 35, 70, 140]) {
    if (lv > L.def.maxDepth) continue;
    const segs = contours(L, L.depth, lv);
    ctx.beginPath(); for (let i = 0; i < segs.length; i += 4) { ctx.moveTo(segs[i], segs[i + 1]); ctx.lineTo(segs[i + 2], segs[i + 3]); } ctx.stroke();
  }
  // shoreline: rock edge plus novaculite-white highlight
  const shore = contours(L, L.field, 0, -1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8C877C'; ctx.lineWidth = 2.2 * lineW; ctx.beginPath();
  for (let i = 0; i < shore.length; i += 4) { ctx.moveTo(shore[i], shore[i + 1]); ctx.lineTo(shore[i + 2], shore[i + 3]); } ctx.stroke();
  ctx.strokeStyle = 'rgba(237,234,226,0.55)'; ctx.lineWidth = 0.9 * lineW; ctx.stroke();
  // grass beds
  for (const s of L.spots.filter((p) => p.type === 'grass')) {
    const g = makeRng(s.x * 13 + s.y);
    for (let n = 0; n < 140; n++) {
      const a = g.range(0, Math.PI * 2), d = Math.sqrt(g.next()) * 22, x = s.x + Math.cos(a) * d * 1.4, y = s.y + Math.sin(a) * d;
      if (!L.water(x, y)) continue;
      ctx.fillStyle = g.chance(0.5) ? 'rgba(92,122,58,0.75)' : 'rgba(47,74,44,0.7)';
      ctx.fillRect(x, y, 1.8, 1.8);
    }
  }
  if (L.geo) {
    // bridges from the national road data
    for (const b of L.geo.bridges) {
      ctx.lineCap = 'butt'; ctx.strokeStyle = '#3E3528'; ctx.lineWidth = 4.2 * lineW; ctx.beginPath(); ctx.moveTo(b.a[0], b.a[1]); ctx.lineTo(b.b[0], b.b[1]); ctx.stroke();
      ctx.strokeStyle = '#D9D4CA'; ctx.lineWidth = 2.6 * lineW; ctx.stroke();
    }
    // dams: concrete crest lines
    for (const d of damLines(L)) {
      ctx.lineCap = 'square'; ctx.strokeStyle = '#3E3528'; ctx.lineWidth = 7 * lineW; ctx.beginPath(); d.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      ctx.strokeStyle = '#E6E1D6'; ctx.lineWidth = 4.4 * lineW; ctx.stroke();
    }
  } else {
    // dam
    const [dx, dy] = L.def.damPos;
    const main = L.def.spines[0]; const last = main.pts[main.pts.length - 1], prev = main.pts[main.pts.length - 2];
    const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    const hw = main.w[main.w.length - 1] + 18;
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(ang);
    ctx.fillStyle = '#D9D4CA'; ctx.strokeStyle = '#3E3528'; ctx.lineWidth = 1.5 * lineW;
    ctx.fillRect(-5, -hw, 10, hw * 2); ctx.strokeRect(-5, -hw, 10, hw * 2);
    ctx.fillStyle = '#8C877C'; for (let k = -hw + 6; k < hw - 4; k += 9) ctx.fillRect(-3, k, 6, 4);
    ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return cv;
}

export function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
