// Small shared helpers: seeded RNG, math, easing, noise, distance transform, formatting.

// mulberry32 PRNG — adapted from bryc/code jshash/PRNGs.md (public domain), see SAMPLES.md #5.
// The whole generator state is one uint32 so it serializes into the game state.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    // Box–Muller normal
    normal: () => { const u = Math.max(1e-9, next()); const v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    poisson: (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= next(); } while (p > L && k < 60); return k - 1; },
    get state() { return a >>> 0; },
    set state(v) { a = v >>> 0; },
  };
  return rng;
}

export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Distance from point to segment, plus the segment parameter t.
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

// 2D value noise (seeded), smooth-interpolated lattice.
export function makeNoise(seed) {
  const h = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  };
  return (x, y) => v(x, y) * 0.65 + v(x * 2.1 + 17, y * 2.1 + 9) * 0.35; // 0..1
}

// Two-pass chamfer distance transform (3-4 mask, Borgefors 1986). mask[i] = 1 for "inside" cells;
// returns the distance (in cells) from each inside cell to the nearest outside cell.
export function chamfer(mask, w, h) {
  const INF = 1e9; const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue; let m = d[i];
    if (x > 0) m = Math.min(m, d[i - 1] + 3); else m = Math.min(m, 3);
    if (y > 0) { m = Math.min(m, d[i - w] + 3); if (x > 0) m = Math.min(m, d[i - w - 1] + 4); if (x < w - 1) m = Math.min(m, d[i - w + 1] + 4); } else m = Math.min(m, 3);
    d[i] = m;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue; let m = d[i];
    if (x < w - 1) m = Math.min(m, d[i + 1] + 3); else m = Math.min(m, 3);
    if (y < h - 1) { m = Math.min(m, d[i + w] + 3); if (x < w - 1) m = Math.min(m, d[i + w + 1] + 4); if (x > 0) m = Math.min(m, d[i + w - 1] + 4); } else m = Math.min(m, 3);
    d[i] = m;
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

// Weight formatting: 3.75 → "3 lb 12 oz" / "3-12".
export function lbOz(w) { const oz = Math.round(w * 16); return { lb: Math.floor(oz / 16), oz: oz % 16 }; }
export function fmtW(w, units = 'lb-oz') {
  if (units === 'lb') return (Math.round(w * 100) / 100).toFixed(2) + ' lb';
  const { lb, oz } = lbOz(w); return `${lb} lb ${oz} oz`;
}
export function fmtWShort(w) { const { lb, oz } = lbOz(w); return `${lb}-${String(oz).padStart(2, '0')}`; }
export function fmtClock(min) {
  min = Math.round(min); const h = Math.floor(min / 60) % 24, m = min % 60;
  const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

export function deepMerge(target, src) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}

export const clone = (o) => JSON.parse(JSON.stringify(o));
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
