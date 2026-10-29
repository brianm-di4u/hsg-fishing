// Bakes research/geo/raw/ (see fetch.mjs) into data/geo/<lake>.json, the real lake geometry the game uses.
//   node tools/geo/bake.mjs [--preview]
// Output per lake, all in the game's 1000 × 625 lake space (x east, y south):
//   frame     lon/lat box, metres per lake unit, map width in miles
//   mask      main-lake water at GW × GH cells, run-length coded (navigable water)
//   other     other water bodies in the frame (ponds, the neighbouring lake), run-length coded, drawn but not fishable
//   dem       land height above the lake's pool, 8-bit PNG data URI (dem.max metres at 255), DW × DH samples
//   bridges   road crossings over water, from the National Transportation Dataset roads
//   creeks    named NHD creeks where they enter the lake
//   dams      dam crest lines
//   islands   island polygons' centroids and sizes (holes in the lake polygon)
// --preview also writes research/geo/preview-<lake>.png for review.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { LAKE_GEO, KX, KY } from './lakes-geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const RAW = path.join(ROOT, 'research/geo/raw');
const OUT = path.join(ROOT, 'data/geo');
fs.mkdirSync(OUT, { recursive: true });
const LW = 1000, LH = 625, GW = 800, GH = 500, CELL = LW / GW;
const DW = 400, DH = 250;
const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const r1 = (v) => Math.round(v * 10) / 10;

// ---------- TIFF (uncompressed float32, strips) ----------
function readTiff(file) {
  const b = fs.readFileSync(path.join(RAW, file));
  const le = b[0] === 0x49; const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o)); const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd = u32(4); const n = u16(ifd); const tags = {};
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12, tag = u16(o), type = u16(o + 2), cnt = u32(o + 4);
    const size = { 3: 2, 4: 4 }[type] || 4; const at = cnt * size > 4 ? u32(o + 8) : o + 8;
    const vals = []; for (let k = 0; k < cnt; k++) vals.push(type === 3 ? u16(at + k * 2) : u32(at + k * 4));
    tags[tag] = vals;
  }
  const w = tags[256][0], h = tags[257][0]; if (tags[259] && tags[259][0] !== 1) throw new Error('compressed TIFF');
  const out = new Float32Array(w * h); let k = 0;
  const rd = (o) => (le ? b.readFloatLE(o) : b.readFloatBE(o));
  if (tags[273]) tags[273].forEach((off, i) => { const len = tags[279][i]; for (let p = 0; p < len; p += 4) out[k++] = rd(off + p); });
  else { // tiled
    const tw = tags[322][0], th = tags[323][0], across = Math.ceil(w / tw);
    tags[324].forEach((off, t) => { const tx = (t % across) * tw, ty = Math.floor(t / across) * th;
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const X = tx + x, Y = ty + y; if (X < w && Y < h) out[Y * w + X] = rd(off + (y * tw + x) * 4); } });
  }
  return { w, h, data: out };
}

// ---------- PNG (8-bit grayscale, Sub filter) ----------
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
function png(w, h, gray, channels = 1) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = channels === 1 ? 0 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * channels; const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 1; for (let x = 0; x < stride; x++) { const v = gray[y * stride + x], l = x >= channels ? gray[y * stride + x - channels] : 0; raw[y * (stride + 1) + 1 + x] = (v - l) & 255; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- PNG decode (8-bit palette or RGB/RGBA, as the NLCD WMS returns) ----------
function readPng(file) {
  const b = fs.readFileSync(path.join(RAW, file)); let o = 8, W = 0, H = 0, ct = 0, pal = null; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8) throw new Error('bit depth ' + d[8]); }
    else if (type === 'PLTE') pal = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; o += 12 + len; }
  const bpp = ct === 3 ? 1 : ct === 2 ? 3 : ct === 6 ? 4 : ct === 0 ? 1 : 2; const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = W * bpp;
  const px = Buffer.alloc(W * H * bpp); let prev = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) { const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? out[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1; else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[x] = v & 255; } prev = out; }
  const rgb = (i) => (ct === 3 ? [pal[px[i] * 3], pal[px[i] * 3 + 1], pal[px[i] * 3 + 2]] : ct === 0 ? [px[i], px[i], px[i]] : [px[i * bpp], px[i * bpp + 1], px[i * bpp + 2]]);
  return { W, H, rgb };
}
// NLCD 2021 legend colours → the game's land classes (index × 23 is stored in the PNG)
const NLCD = [[0x466b9f, 10], [0xdec5c5, 5], [0xd99282, 6], [0xeb0000, 6], [0xab0000, 7], [0xb3ac9f, 8], [0x68ab5f, 0], [0x1c5f2c, 1], [0xb5c58f, 2],
  [0xccb879, 3], [0xdfdfc2, 3], [0xdcd939, 4], [0xab6c28, 4], [0xb8d9eb, 9], [0x6c9fb8, 9]].map(([h, c]) => [[(h >> 16) & 255, (h >> 8) & 255, h & 255], c]);
const nlcdClass = (c) => { let best = 2, bd = 1e9; for (const [r, k] of NLCD) { const d = (r[0] - c[0]) ** 2 + (r[1] - c[1]) ** 2 + (r[2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } } return bd > 9000 ? 2 : best; };

// ---------- rasterize polygons (even-odd, supersampled) ----------
function rasterize(rings, proj, w, h, ss = 3) {
  const cov = new Uint8Array(w * h); const sx = LW / w, sy = LH / h;
  const edges = [];
  for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) { const a = proj(ring[i]), b = proj(ring[i + 1]); if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]); }
  edges.sort((p, q) => p[1] - q[1]);
  const acc = new Uint16Array(w);
  for (let j = 0; j < h; j++) {
    acc.fill(0);
    for (let s = 0; s < ss; s++) {
      const y = (j + (s + 0.5) / ss) * sy; const xs = [];
      for (const e of edges) { if (e[1] > y) break; if (e[3] > y) xs.push(e[0] + (y - e[1]) / (e[3] - e[1]) * (e[2] - e[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let t = 0; t < ss; t++) {
          const off = (t + 0.5) / ss;
          const i0 = Math.max(0, Math.ceil(xs[k] / sx - off)), i1 = Math.min(w - 1, Math.floor(xs[k + 1] / sx - off));
          for (let i = i0; i <= i1; i++) acc[i]++;
        }
      }
    }
    for (let i = 0; i < w; i++) cov[j * w + i] = Math.round(acc[i] / (ss * ss) * 255);
  }
  return cov;
}
function rle(mask) { // alternating runs starting with 0, varint-coded, base64
  const out = []; let cur = 0, run = 0;
  const put = (n) => { while (n >= 128) { out.push((n & 127) | 128); n >>>= 7; } out.push(n); };
  for (let k = 0; k < mask.length; k++) { const v = mask[k] ? 1 : 0; if (v === cur) run++; else { put(run); cur = v; run = 1; } }
  put(run); return Buffer.from(out).toString('base64');
}
const ringsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

for (const [id, G] of Object.entries(LAKE_GEO)) {
  const [W, S, E, N] = G.bbox;
  const proj = (p) => [(p[0] - W) / (E - W) * LW, (N - p[1]) / (N - S) * LH];
  const mPerUnit = (E - W) * KX / LW;
  const wb = readJSON(`nhd_wb_${id}.geojson`).features;
  const mains = wb.filter((f) => (f.properties.GNIS_NAME || f.properties.gnis_name) === G.gnis);
  if (!mains.length) throw new Error('no main polygon for ' + id);
  const mainRings = mains.flatMap((f) => ringsOf(f.geometry)).flat(); // polygons → rings (even-odd works across all)
  const cov = rasterize(mainRings, proj, GW, GH);
  const mask = cov.map((c) => (c >= 128 ? 1 : 0));
  // other water drawn on the map: skip specks under ~3 acres (farm ponds, slivers that read as glitches at map scale)
  const others = wb.filter((f) => !mains.includes(f) && (f.properties.AREASQKM || f.properties.areasqkm || 0) >= 0.012);
  const ocov = rasterize(others.flatMap((f) => ringsOf(f.geometry)).flat(), proj, GW, GH);
  const other = ocov.map((c, k) => (c >= 128 && !mask[k] ? 1 : 0));
  const inMain = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < GW && j < GH && mask[j * GW + i] === 1; };
  const inAny = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < GW && j < GH && (mask[j * GW + i] || other[j * GW + i]); };
  let area = 0; for (const v of mask) area += v; const acres = area * (CELL * mPerUnit) ** 2 / 4046.86;

  // islands = interior rings of the main polygon(s), only ones inside the frame
  const islands = [];
  for (const f of mains) for (const poly of ringsOf(f.geometry)) for (const ring of poly.slice(1)) {
    const pts = ring.map(proj); let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length - 1; i++) { const c = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]; a += c; cx += (pts[i][0] + pts[i + 1][0]) * c; cy += (pts[i][1] + pts[i + 1][1]) * c; }
    a /= 2; if (Math.abs(a) < 2) continue; cx /= 6 * a; cy /= 6 * a;
    if (cx < 0 || cy < 0 || cx > LW || cy > LH) continue;
    islands.push([r1(cx), r1(cy), r1(Math.sqrt(Math.abs(a) / Math.PI))]);
  }

  // DEM → height above pool (m), resampled to DW × DH, 8-bit
  const dem = readTiff(`dem_${id}.tif`); const poolM = G.pool * 0.3048;
  const H = new Float32Array(DW * DH); let hmax = 1, hmin = 0;
  for (let j = 0; j < DH; j++) for (let i = 0; i < DW; i++) {
    const u = (i + 0.5) / DW * dem.w - 0.5, v = (j + 0.5) / DH * dem.h - 0.5;
    const i0 = Math.max(0, Math.min(dem.w - 2, Math.floor(u))), j0 = Math.max(0, Math.min(dem.h - 2, Math.floor(v))), fu = Math.min(1, Math.max(0, u - i0)), fv = Math.min(1, Math.max(0, v - j0));
    const g = (a, b) => dem.data[b * dem.w + a];
    let e = (g(i0, j0) * (1 - fu) + g(i0 + 1, j0) * fu) * (1 - fv) + (g(i0, j0 + 1) * (1 - fu) + g(i0 + 1, j0 + 1) * fu) * fv;
    if (!(e > -100 && e < 3000)) e = poolM;
    const h = e - poolM; H[j * DW + i] = h; hmax = Math.max(hmax, h); hmin = Math.min(hmin, h);
  }
  // land below the pool exists downstream of the dams (the coastal plain below DeGray, the valley below Blakely)
  hmax = Math.ceil(hmax); hmin = Math.floor(hmin);
  const H8 = new Uint8Array(DW * DH); for (let k = 0; k < H8.length; k++) H8[k] = Math.round((H[k] - hmin) / (hmax - hmin) * 255);
  const demPng = png(DW, DH, H8);

  // bridges: road runs over water longer than ~40 m
  const bridges = [];
  for (const layer of [29, 30, 31]) {
    const fn = `roads${layer}_${id}.geojson`; if (!fs.existsSync(path.join(RAW, fn))) continue;
    for (const f of readJSON(fn).features || []) {
      const p = f.properties; const name = p.name || [p.us_route_a && 'US ' + p.us_route_a, p.state_route_a && 'AR ' + p.state_route_a].filter(Boolean).join(' / ') || '';
      const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const line of lines) {
        let run = null;
        const flush = () => { if (run && Math.hypot(run[2] - run[0], run[3] - run[1]) * mPerUnit > 40) bridges.push({ a: [r1(run[0]), r1(run[1])], b: [r1(run[2]), r1(run[3])], name, main: run.main, cls: layer === 29 ? 'highway' : layer === 30 ? 'secondary' : 'local' }); run = null; };
        for (let i = 0; i < line.length - 1; i++) {
          const a = proj(line[i]), b = proj(line[i + 1]); const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.6));
          for (let k = 0; k <= n; k++) {
            const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
            if (inAny(x, y)) { if (!run) run = [x, y, x, y]; run[2] = x; run[3] = y; if (inMain(x, y)) run.main = true; } else flush();
          }
        }
        flush();
      }
    }
  }
  // road raster (800 × 500): highways 2 cells wide, other roads 1, for drawing on the 3D map
  const roads = new Uint8Array(GW * GH);
  const stamp = (x, y, r) => { const ci = x / CELL, cj = y / CELL; for (let j = Math.floor(cj - r); j <= Math.ceil(cj + r); j++) for (let i = Math.floor(ci - r); i <= Math.ceil(ci + r); i++) { if (i < 0 || j < 0 || i >= GW || j >= GH) continue; if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 <= r * r) roads[j * GW + i] = 1; } };
  for (const layer of [29, 30, 31]) {
    const fn = `roads${layer}_${id}.geojson`; if (!fs.existsSync(path.join(RAW, fn))) continue;
    for (const f of readJSON(fn).features || []) {
      const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates; const r = layer === 31 ? 0.55 : 0.95;
      for (const line of lines) for (let i = 0; i < line.length - 1; i++) { const a = proj(line[i]), b = proj(line[i + 1]); const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL * 0.4))); for (let k = 0; k <= n; k++) stamp(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, r); }
    }
  }
  for (let k = 0; k < roads.length; k++) if (mask[k]) roads[k] = 0; // bridges are drawn as decks
  // merge near-duplicate bridges (dual carriageways, split segments)
  const merged = [];
  for (const b of bridges) {
    const m = merged.find((q) => Math.hypot(q.a[0] - b.a[0], q.a[1] - b.a[1]) + Math.hypot(q.b[0] - b.b[0], q.b[1] - b.b[1]) < 6 || Math.hypot(q.a[0] - b.b[0], q.a[1] - b.b[1]) + Math.hypot(q.b[0] - b.a[0], q.b[1] - b.a[1]) < 6);
    if (m) { if (!m.name && b.name) m.name = b.name; continue; }
    merged.push(b);
  }

  // creek mouths: where a named creek's last land vertex meets the main lake
  const creeks = []; const flow = readJSON(`nhd_flow_${id}.geojson`).features || [];
  const byName = new Map();
  for (const f of flow) { const n = f.properties.gnis_name || f.properties.GNIS_NAME; if (!n || /River$/.test(n) && n !== 'Little Missouri River') continue; (byName.get(n) || byName.set(n, []).get(n)).push(f); }
  for (const [n, fs2] of byName) {
    let best = null;
    for (const f of fs2) {
      const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const line of lines) for (let i = 0; i < line.length - 1; i++) {
        const a = proj(line[i]), b = proj(line[i + 1]);
        if (inMain(a[0], a[1]) !== inMain(b[0], b[1])) { const p = inMain(a[0], a[1]) ? a : b; if (!best) best = p; }
      }
    }
    if (best && best[0] > 2 && best[1] > 2 && best[0] < LW - 2 && best[1] < LH - 2) creeks.push({ name: n, x: r1(best[0]), y: r1(best[1]) });
  }

  // dams: NHD dam lines inside the frame that touch the main lake, else a crossing at G.dam
  const dams = [];
  for (const f of readJSON('nhd_dams.geojson').features) {
    const c = f.geometry.coordinates.flat(f.geometry.type.startsWith('Multi') ? 1 : 0).map(proj);
    const near = c.some((p) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (inMain(p[0] + dx * CELL, p[1] + dy * CELL)) return true; return false; });
    const len = f.properties.LENGTHKM || f.properties.lengthkm || 0;
    if (near && len > 0.06 && c.every((p) => p[0] >= 0 && p[1] >= 0 && p[0] <= LW && p[1] <= LH)) dams.push({ name: f.properties.GNIS_NAME || f.properties.gnis_name || null, pts: c.map((p) => [r1(p[0]), r1(p[1])]) });
  }

  // land cover: majority class per 2×2 block of the 800×500 NLCD image → 400×250
  let lc = null;
  if (fs.existsSync(path.join(RAW, `nlcd_${id}.png`))) {
    const im = readPng(`nlcd_${id}.png`); const LWc = 400, LHc = 250; const cls = new Uint8Array(LWc * LHc);
    for (let j = 0; j < LHc; j++) for (let i = 0; i < LWc; i++) {
      const cnt = new Uint8Array(11);
      for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) { const x = Math.min(im.W - 1, Math.floor((i * 2 + di) * im.W / 800)), y = Math.min(im.H - 1, Math.floor((j * 2 + dj) * im.H / 500)); cnt[nlcdClass(im.rgb(y * im.W + x))]++; }
      let b = 0; for (let k = 1; k < 11; k++) if (cnt[k] > cnt[b]) b = k; cls[j * LWc + i] = b * 23;
    }
    lc = { w: LWc, h: LHc, png: 'data:image/png;base64,' + png(LWc, LHc, cls).toString('base64'), classes: 'deciduous, evergreen, mixed, shrub/grass, pasture/crops, developed open, developed low/medium, developed high, barren, wetland, water (value = class × 23)' };
  }
  const d = proj(G.dam), inflow = proj(G.inflow);
  const out = {
    id, name: G.name, source: 'USGS NHD (Waterbody, Flowline, Line), USGS 3DEP 1/3 arc-second DEM, USGS/MRLC NLCD 2021 land cover, USGS National Transportation Dataset roads; public domain. Baked by tools/geo/bake.mjs.',
    frame: { bbox: G.bbox.map((v) => Math.round(v * 1e5) / 1e5), mPerUnit: Math.round(mPerUnit * 100) / 100, miles: Math.round(LW * mPerUnit / 1609.34 * 100) / 100 },
    acres: Math.round(acres), pool: G.pool, grid: [GW, GH], mask: rle(mask), other: rle(other),
    dem: { w: DW, h: DH, min: hmin, max: hmax, png: 'data:image/png;base64,' + demPng.toString('base64') },
    landcover: lc, roads: rle(roads), dam: [r1(d[0]), r1(d[1])], inflow: [r1(inflow[0]), r1(inflow[1])], dams, bridges: merged, creeks, islands,
  };
  fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(out));
  console.log(`${id}: ${out.frame.miles} mi wide, ${mPerUnit.toFixed(1)} m/unit, ${out.acres} acres in frame, ${islands.length} islands, ${merged.length} bridges (${merged.filter((b) => b.main).length} over the lake), ${creeks.length} creeks, ${dams.length} dam lines, dem ${hmin}..${hmax} m, ${(fs.statSync(path.join(OUT, id + '.json')).size / 1024).toFixed(0)} KB`);
}
