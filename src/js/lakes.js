// Lake geometry: water mask from spines and islands, chamfer depth, spot snapping, routing, map rendering.
import { LAKES, SPOT_TYPES } from './data.js';
import { makeNoise, chamfer, segDist, clamp, lerp, makeRng, dist } from './util.js';

export const LW = 1000, LH = 625;
const GW = 400, GH = 250, CELL = LW / GW; // 2.5 lake units per cell
const built = {};

export function getLake(id) { return built[id] || (built[id] = buildLake(LAKES[id])); }

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
  const L = { def, id: def.id, field, mask, depth, sd, islands, rng, grid: { w: GW, h: GH, cell: CELL } };
  L.water = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < GW && j < GH && mask[j * GW + i] === 1; };
  L.depthAt = (x, y) => { const i = clamp(Math.floor(x / CELL), 0, GW - 1), j = clamp(Math.floor(y / CELL), 0, GH - 1); return depth[j * GW + i]; };
  L.shoreDist = (x, y) => { const i = clamp(Math.floor(x / CELL), 0, GW - 1), j = clamp(Math.floor(y / CELL), 0, GH - 1); return sd[j * GW + i] * CELL; };
  // snap spots and ramp to water
  const snap = (p, minShore) => {
    if (L.water(p.x, p.y) && L.shoreDist(p.x, p.y) >= minShore) return p;
    let best = null, bd = 1e9;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i; if (!mask[k] || sd[k] * CELL < minShore) continue;
      const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, d = dist(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best ? { ...p, x: best.x, y: best.y } : p;
  };
  L.spots = def.spots.map((s) => {
    const shore = SPOT_TYPES[s.type].shore;
    const sp = snap({ ...s }, shore ? 4 : 14);
    if (shore && L.shoreDist(sp.x, sp.y) > 40) { /* keep near shore */ }
    return sp;
  });
  L.ramp = { id: 'ramp', type: 'ramp', depth: 6, ...snap({ ...def.ramp }, 4) };
  L.markers = [];
  if (def.markers) {
    const used = new Set();
    for (const s of def.spots) if (s.marker) { L.markers.push({ n: s.marker, x: s.x + 22, y: s.y - 18 }); used.add(s.marker); }
    const rest = islands.filter((i) => i[2] >= 7 && !def.spots.some((s) => s.marker && dist(s.x + 22, s.y - 18, i[0], i[1]) < 4)).sort((a, b) => a[0] - b[0]);
    const nums = []; for (let n = def.markers.from; n <= def.markers.to; n++) if (!used.has(n)) nums.push(n);
    // spread remaining numbers left-to-right so they read in order with the brush-pile markers
    const low = nums.filter((n) => n < 28), mid = nums.filter((n) => n > 28 && n < 36), high = nums.filter((n) => n > 36);
    const left = rest.filter((i) => i[0] < 450), middle = rest.filter((i) => i[0] >= 470 && i[0] <= 720), right = rest.filter((i) => i[0] > 740);
    const place = (ns, isl) => ns.forEach((n, k) => { const i = isl[Math.round((k + 0.5) * isl.length / ns.length - 0.5)]; if (i) L.markers.push({ n, x: i[0], y: i[1] }); });
    place(low, left); place(mid, middle); place(high, right);
  }
  L.allPoints = () => [L.ramp, ...L.spots];
  L.spot = (id) => (id === 'ramp' ? L.ramp : L.spots.find((s) => s.id === id));
  L.paths = new Map();
  return L;
}

// ---------- routing (A* on a half-resolution water grid) ----------
export function route(L, from, to) {
  const key = `${Math.round(from.x)},${Math.round(from.y)}>${Math.round(to.x)},${Math.round(to.y)}`;
  if (L.paths.has(key)) return L.paths.get(key);
  const W = GW / 2, H = GH / 2, C = CELL * 2;
  if (!L.coarse) {
    L.coarse = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let ok = 0; for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) ok += L.mask[(j * 2 + dj) * GW + i * 2 + di];
      L.coarse[j * W + i] = ok >= 3 ? 1 : 0;
    }
  }
  const cg = L.coarse;
  const near = (p) => {
    let i = clamp(Math.floor(p.x / C), 0, W - 1), j = clamp(Math.floor(p.y / C), 0, H - 1);
    if (cg[j * W + i]) return j * W + i;
    let best = -1, bd = 1e9;
    for (let r = 1; r < 20 && best < 0; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H || !cg[b * W + a]) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = b * W + a; }
    }
    return best < 0 ? j * W + i : best;
  };
  const s = near(from), g = near(to);
  const gx = g % W, gy = (g / W) | 0;
  const h = (k) => Math.hypot((k % W) - gx, ((k / W) | 0) - gy);
  const cost = new Float32Array(W * H).fill(1e9); const prev = new Int32Array(W * H).fill(-1);
  const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  cost[s] = 0; push(s, h(s));
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, k] = pop(); if (k === g) break;
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy, c] of N8) {
      const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const n = b * W + a; if (!cg[n]) continue;
      const nc = cost[k] + c; if (nc < cost[n]) { cost[n] = nc; prev[n] = k; push(n, nc + h(n)); }
    }
  }
  let pts = [];
  if (prev[g] >= 0 || g === s) { for (let k = g; k >= 0; k = prev[k]) { pts.push([(k % W + 0.5) * C, (((k / W) | 0) + 0.5) * C]); if (k === s) break; } pts.reverse(); }
  pts = simplify(L, [[from.x, from.y], ...pts, [to.x, to.y]]);
  let len = 0; for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  const r = { pts, len, miles: len / LW * L.def.miles };
  L.paths.set(key, r);
  return r;
}
// drop points while the straight line between survivors stays on water
function simplify(L, pts) {
  const clear = (a, b) => { const n = Math.ceil(dist(a[0], a[1], b[0], b[1]) / 3); for (let i = 1; i < n; i++) { const t = i / n; if (!L.water(lerp(a[0], b[0], t), lerp(a[1], b[1], t))) return false; } return true; };
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
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

export function renderMap(L, view, dpr, month, cssW, cssH) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(cssW * dpr); cv.height = Math.ceil(cssH * dpr);
  const ctx = cv.getContext('2d');
  const pal = landPalette(month);
  const M = view.m;
  const setLake = () => ctx.setTransform(M[0] * dpr, M[1] * dpr, M[2] * dpr, M[3] * dpr, M[4] * dpr, M[5] * dpr);
  // backdrop beyond the map frame
  ctx.fillStyle = '#16301F'; ctx.fillRect(0, 0, cv.width, cv.height);
  setLake();
  // land with mottled light
  ctx.fillStyle = pal.base; ctx.fillRect(0, 0, LW, LH);
  const noise = makeNoise(L.def.seed + 7);
  const lw = 125, lh = 78, img = new ImageData(lw, lh);
  const lc = hex(pal.light);
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const n = noise(i / 9, j / 9); const k = (j * lw + i) * 4;
    img.data[k] = lc[0]; img.data[k + 1] = lc[1]; img.data[k + 2] = lc[2]; img.data[k + 3] = Math.max(0, (n - 0.45)) * 230;
  }
  const tmp = document.createElement('canvas'); tmp.width = lw; tmp.height = lh; tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, LW, LH);
  // pines (seeded stipple) on land
  const r = makeRng(L.def.seed * 31 + month);
  for (let n = 0; n < 2600; n++) {
    const x = r.range(0, LW), y = r.range(0, LH);
    const f = L.field[Math.floor(y / CELL) * GW + Math.floor(x / CELL)];
    if (f < 6) continue;
    const s = r.range(3.2, 6.2);
    ctx.fillStyle = r.chance(0.12) ? r.pick(pal.accent) : (r.chance(0.5) ? pal.tree : '#26402A');
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.62, y + s * 0.5); ctx.lineTo(x - s * 0.62, y + s * 0.5); ctx.closePath(); ctx.fill();
  }
  // water depth image with antialiased edge
  const wi = new ImageData(GW, GH);
  for (let k = 0; k < GW * GH; k++) {
    const f = L.field[k]; if (f > CELL) continue;
    const c = depthRGB(L.depth[k] || 1); const o = k * 4;
    wi.data[o] = c[0]; wi.data[o + 1] = c[1]; wi.data[o + 2] = c[2]; wi.data[o + 3] = clamp(0.5 - f / CELL, 0, 1) * 255;
  }
  const wt = document.createElement('canvas'); wt.width = GW; wt.height = GH; wt.getContext('2d').putImageData(wi, 0, 0);
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
  ctx.strokeStyle = '#8C877C'; ctx.lineWidth = 2.6 * lineW; ctx.beginPath();
  for (let i = 0; i < shore.length; i += 4) { ctx.moveTo(shore[i], shore[i + 1]); ctx.lineTo(shore[i + 2], shore[i + 3]); } ctx.stroke();
  ctx.strokeStyle = 'rgba(237,234,226,0.55)'; ctx.lineWidth = 1 * lineW; ctx.stroke();
  // grass beds
  for (const s of L.spots.filter((p) => p.type === 'grass')) {
    const g = makeRng(s.x * 13 + s.y);
    for (let n = 0; n < 140; n++) {
      const a = g.range(0, Math.PI * 2), d = Math.sqrt(g.next()) * 30, x = s.x + Math.cos(a) * d * 1.4, y = s.y + Math.sin(a) * d;
      if (!L.water(x, y)) continue;
      ctx.fillStyle = g.chance(0.5) ? 'rgba(92,122,58,0.75)' : 'rgba(47,74,44,0.7)';
      ctx.fillRect(x, y, 2.2, 2.2);
    }
  }
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return cv;
}

export function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
