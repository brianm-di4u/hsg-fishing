// Fish and weather model (MECHANICS §4, §6, §7). Pure functions over plain data; also imported by tools/calibrate.mjs.
import { CLIMATE, SPECIES, ABUNDANCE, HABITAT, SPEED_PREF, LURES, COLOR_CLASS, CLARITY_COLOR, SPOT_TYPES, TIERS } from './data.js';
import { clamp } from './util.js';

export const BASE_TICK = 1 / 1150;
const mean = (c) => (c.hi + c.lo) / 2;

// Water temperature: game estimate (no monthly water temperatures are sourced). month 1–12.
export function waterTempBase(month) {
  const c = CLIMATE[month - 1], p = CLIMATE[(month + 10) % 12];
  return 0.6 * mean(c) + 0.4 * mean(p) + 4;
}
export const warming = (month) => month >= 1 && month <= 7;
export const troutSeason = (month) => month >= 11 || month <= 4; // AGFC stocks Nov–Apr (audited bank hs-0173)

// Sunrise/sunset (minutes, local clock with DST) from the declination formula at 34.5°N, 93.05°W.
export function sunTimes(month) {
  const N = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + N)) / 365) * Math.PI / 180;
  const phi = 34.5 * Math.PI / 180;
  const H = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1)) * 180 / Math.PI;
  const half = (H / 15) * 60 + 4; // + refraction
  const dst = month >= 3 && month <= 10 ? 60 : 0;
  const noon = 12 * 60 + 12 + dst;
  return { rise: Math.round(noon - half), set: Math.round(noon + half) };
}

// Daily weather drawn from the month's normals.
export function makeWeather(rng, month, lake, force = {}) {
  const c = CLIMATE[month - 1];
  const hi = c.hi + rng.range(-4, 4), lo = c.lo + rng.range(-4, 4);
  const winter = month === 12 || month <= 2;
  const snow = force.sky ? force.sky === 'snow' : winter && rng.chance(1 / 60);
  const rain = !snow && rng.chance(c.p * 0.07);
  const cold = snow ? { hi: Math.min(hi, 38), lo: Math.min(lo, 27) } : { hi, lo };
  const rainRecent = force.rainRecent ?? (rain || rng.chance(c.p * 0.05));
  let sky = snow ? 'snow' : rain ? (rng.chance(0.3) ? 'storm' : 'rain') : rng.pick(['clear', 'clear', 'partly', 'overcast']);
  if (force.sky) sky = force.sky;
  const wind = Math.round(rng.range(0, 14));
  let clarity = lake.clarity;
  if (rainRecent) clarity = (lake.id === 'catherine' || lake.id === 'hamilton') && (month === 4 || month === 5) ? 'muddy' : clarity === 'clear' ? 'stained' : 'muddy';
  if (force.clarity) clarity = force.clarity;
  const water = Math.round((waterTempBase(month) + rng.range(-1.5, 1.5)) * 10) / 10;
  return { sky, hi: Math.round(cold.hi), lo: Math.round(cold.lo), wind, rainRecent: !!rainRecent, clarity, water: force.water ?? water };
}

export function airTemp(w, min) {
  const h = min / 60;
  // low near 6 AM, high near 3 PM
  if (h >= 6 && h <= 15) return w.lo + (w.hi - w.lo) * (0.5 - 0.5 * Math.cos(Math.PI * (h - 6) / 9));
  const t = h > 15 ? h - 15 : h + 9; // hours since 3 PM
  return w.hi - (w.hi - w.lo) * (0.5 - 0.5 * Math.cos(Math.PI * t / 15));
}

// Season phase for a species from estimated water temperature.
export function phaseOf(spId, Tw, month) {
  const sp = SPECIES[spId]; const g = sp.group; const warm = warming(month);
  if (g === 'bass' || g === 'crappie') {
    const lo = g === 'crappie' ? 56 : sp.spawn[0], hi = sp.spawn[1];
    if (Tw >= 79 || (month >= 6 && month <= 8 && Tw >= 76)) return 'summer';
    if (warm) {
      if (Tw < lo - 8) return 'winter';
      if (Tw < lo) return 'prespawn';
      if (Tw <= hi) return 'spawn';
      return 'postspawn';
    }
    return Tw < 52 ? 'winter' : 'fall';
  }
  if (g === 'bream' || g === 'cat') return Tw >= sp.spawn[0] && Tw <= sp.spawn[1] && (warm || month === 8) ? 'spawn' : 'other';
  if (g === 'temperate') return Tw >= 80 ? 'summer' : 'other';
  return 'other';
}

export function habitatFor(spId, phase) {
  const H = HABITAT[SPECIES[spId].group];
  return H[phase] || H.other;
}

export function isLowLight(min, month) { const s = sunTimes(month); return Math.abs(min - s.rise) <= 75 || Math.abs(min - s.set) <= 75; }
export function isNight(min, month) { const s = sunTimes(month); return min > s.set + 30 || min < s.rise - 30; }

// Bite contribution table for one moment of a retrieve (MECHANICS §4).
// ctx: { lake, month, Tw, min, sky, clarity, air, spot:{type, depth}, lure, color, speed:'slow'|'med'|'fast'|'pause',
//        lureDepth, bottom, nearCover, eagle, gen, pressure, stocking }
export function biteTable(ctx) {
  const ab = ABUNDANCE[ctx.lake] || {};
  const lure = LURES[ctx.lure];
  const hab = SPOT_TYPES[ctx.spot.type].hab;
  const low = isLowLight(ctx.min, ctx.month);
  const night = isNight(ctx.min, ctx.month);
  const overcast = ['overcast', 'rain', 'storm'].includes(ctx.sky);
  const heat = (ctx.air ?? 0) > 88 && ctx.min >= 11 * 60 && ctx.min <= 16 * 60;
  const rows = [];
  let total = 0;
  for (const spId of Object.keys(ab)) {
    const sp = SPECIES[spId]; const g = sp.group;
    let A = ab[spId];
    if (spId === 'striper' && ctx.lake === 'ouachita' && ctx.stocking) A *= 1.8;
    if (g === 'trout') {
      if (ctx.spot.type !== 'tailrace' || !troutSeason(ctx.month)) A = 0;
      if (ctx.gen) A *= 0.15;
    }
    if (!A) continue;
    const phase = phaseOf(spId, ctx.Tw, ctx.month);
    const hb = habitatFor(spId, phase);
    let H = hb.h[hab] ?? (g === 'trout' ? 0 : 0.2);
    let [d0, d1] = hb.d;
    if (phase === 'summer' && g === 'bass' && (low || overcast)) { d0 = 3; d1 = 12; }
    const bottom = Math.max(1, ctx.bottom);
    const fishDepth = clamp((d0 + d1) / 2, 0.5, bottom);
    if (bottom < d0) H *= Math.exp(-(d0 - bottom) / 5);
    let D;
    if (lure.kind === 'top') {
      const up = ['bass', 'bream', 'temperate', 'pike', 'rough'].includes(g);
      D = up ? (d0 <= 8 ? ((low || overcast) ? 0.9 : 0.45) : (low ? 0.25 : 0.08)) : 0.03;
    } else {
      const s = 3 + 0.15 * fishDepth;
      D = Math.exp(-Math.pow((ctx.lureDepth - fishDepth) / s, 2));
    }
    const L = (g === 'trout' ? lure.aff.trout : lure.aff[g]) ?? 0.05;
    const prefKey = lure.kind === 'bait' ? 'bait' : g === 'trout' ? 'trout' : g === 'crappie' ? 'crappie' : g === 'temperate' ? 'temperate' : phase;
    const pref = SPEED_PREF[prefKey] || [1, 1, 1];
    let V;
    if (ctx.speed === 'pause') V = (lure.kind === 'bottom' || lure.kind === 'bait' || lure.kind === 'jerk') ? pref[0] * 1.05 : pref[0] * 0.6;
    else V = pref[{ slow: 0, med: 1, fast: 2 }[ctx.speed] ?? 1];
    if (ctx.lake === 'ouachita' && ctx.spot.type === 'brush' && (ctx.speed === 'slow' || ctx.speed === 'pause')) V *= 1.4;
    const C = ctx.nearCover && g !== 'temperate' ? 1.6 : 1;
    let K = CLARITY_COLOR[ctx.clarity][COLOR_CLASS[ctx.color] || 'natural'];
    if (ctx.clarity === 'muddy' && (lure.kind === 'crank' || lure.kind === 'spinner')) K *= 1.2;
    let T = 1;
    if (low) T *= lure.kind === 'top' ? 1.8 : 1.3;
    if (heat) T *= fishDepth < 12 ? 0.5 : 1.1;
    if (overcast) T *= 1.15;
    if (night) T *= g === 'cat' ? 1.3 : 0.4;
    let E = 1;
    if (ctx.eagle && (g === 'bass' || g === 'temperate')) E *= 1.6;
    if (kickerActive(ctx.lake, ctx.month) && spId === 'largemouth' && (hab === 'brush' || hab === 'docks')) E *= 1.25;
    if (g === 'crappie' && ctx.Tw >= sp.spawn[0] && ctx.Tw <= sp.spawn[1]) E *= 1.2;
    const P = Math.exp(-(ctx.pressure || 0));
    const M = MONTH_Q[ctx.month - 1]; // month activity (game logic), shared with the AI field
    const v = A * H * D * L * V * C * K * T * E * P * M;
    if (v > 0) { rows.push({ sp: spId, v, phase, fishDepth: Math.round(fishDepth) }); total += v; }
  }
  rows.sort((a, b) => b.v - a.v);
  return { total, rows };
}

export const kickerActive = (lake, month) => lake === 'hamilton' && month === 5;

// Fish weight (lb), game estimate. opts: { lake, month, lure, color, hab }
export function sampleWeight(rng, spId, opts = {}) {
  const sp = SPECIES[spId];
  let med = sp.med;
  if (spId === 'trout' && opts.month === 3) med = 1.4; // larger fish stocked in March
  if (opts.lure && LURES[opts.lure]) med *= Math.pow(LURES[opts.lure].size, 0.7);
  let w = med * Math.exp(rng.normal() * sp.sd);
  if (spId === 'largemouth') {
    let pT = opts.lake === 'hamilton' ? 0.012 : 0.004;
    const kick = kickerActive(opts.lake, opts.month) && (opts.hab === 'brush' || opts.hab === 'docks') && opts.lure === 'craw' && opts.color === 'green pumpkin';
    if (kick) pT *= 3;
    if (rng.chance(pT)) w = opts.lake === 'hamilton' ? rng.range(6.5, 11.2) : rng.range(5.5, 9);
  }
  return Math.round(clamp(w, 0.18, sp.max) * 16) / 16;
}

// Monthly bite quality for the AI field (game logic).
export const MONTH_Q = [0.75, 0.8, 1.0, 1.15, 1.1, 0.95, 0.85, 0.8, 0.85, 0.95, 0.9, 0.8];
// Per-tier weight scale, calibrated by tools/calibrate.mjs so campaign events hit their targets.
export const TIER_SCALE = { club: 0.81, regional: 0.75, finale: 0.725, championship: 0.755, derby: 1 };

const BASS = ['largemouth', 'spotted', 'smallmouth'];
export function fieldBag(rng, lake, month, tier, skill) {
  const T = TIERS[tier];
  const ab = ABUNDANCE[lake];
  if (T.derby) {
    const ids = Object.keys(ab).filter((k) => DERBY_OK(k));
    const n = 2 + rng.poisson(5 * (1 + 0.15 * skill));
    let best = null;
    for (let i = 0; i < n; i++) {
      const id = pickW(rng, ids.map((k) => [k, ab[k]]));
      const w = sampleWeight(rng, id, { lake, month });
      if (!best || w > best.w) best = { sp: id, w };
    }
    return { fish: best ? [best] : [], total: best ? best.w : 0, big: best ? best.w : 0 };
  }
  const mix = BASS.filter((k) => ab[k]).map((k) => [k, ab[k]]);
  const q = MONTH_Q[month - 1];
  const n = rng.poisson(6.5 * q * (1 + 0.15 * skill));
  const fish = [];
  for (let i = 0; i < n; i++) {
    const id = pickW(rng, mix);
    let w = sampleWeight(rng, id, { lake, month }) * (TIER_SCALE[tier] || 1) * (1 + 0.04 * skill) * (0.85 + 0.15 * q);
    fish.push({ sp: id, w: Math.round(w * 16) / 16 });
  }
  fish.sort((a, b) => b.w - a.w);
  const kept = fish.slice(0, T.limit);
  const total = kept.reduce((s, f) => s + f.w, 0);
  return { fish: kept, total: Math.round(total * 16) / 16, big: kept[0] ? kept[0].w : 0 };
}

function pickW(rng, pairs) {
  let s = 0; for (const [, w] of pairs) s += w;
  let r = rng.next() * s;
  for (const [k, w] of pairs) { r -= w; if (r <= 0) return k; }
  return pairs[pairs.length - 1][0];
}
export { pickW };

// Carpenter Dam generation blocks for a day (fictional times). Returns [[start, end], ...] in minutes.
export function genSchedule(rng, start, end) {
  const blocks = [];
  const span = end - start;
  const n = span > 300 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const s0 = start + 30 + Math.round(rng.range(0, Math.max(30, span / n - 120))) + i * Math.round(span / n);
    blocks.push([s0, s0 + 60 + Math.round(rng.range(0, 40))]);
  }
  return blocks;
}
export const genAt = (blocks, min) => blocks.some(([a, b]) => min >= a && min < b);

// Derby rules (fictional): game fish only; no catfish, bream, trout or rough fish.
export const DERBY_OK = (id) => ['bass', 'temperate', 'walleye', 'crappie', 'pike'].includes(SPECIES[id].group);
