// Spot view simulation: local scene, aim/cast/flight, retrieve and lure depth, bites, hook-set, fight (MECHANICS §5).
import { G } from './state.js';
import { LURES, SPECIES, SPEEDS, SPOT_TYPES } from './data.js';
import { makeRng, hash32, clamp, lerp, dist, makeNoise } from './util.js';
import { biteTable, sampleWeight, BASE_TICK, airTemp, genAt, pickW } from './sim.js';
import { getLake } from './lakes.js';
import { spend, bus, logCatch, keepFish, keepInfo, timeUp, lureList } from './game.js';

export const FT = 100;            // local unit = 100 ft
export const BOAT = { x: 0.5, y: 1.0 };
export const ROD = { x: 0.5, y: 0.94 };
export const RING_PERIOD = 1.1;

// ---------- local scene for a spot (deterministic per spot) ----------
const scenes = new Map();
export function sceneFor(spot) {
  if (scenes.has(spot.id)) return scenes.get(spot.id);
  const r = makeRng(hash32(spot.id));
  const n = makeNoise(hash32(spot.id) & 0xffff);
  const T = SPOT_TYPES[spot.type];
  const sc = { id: spot.id, type: spot.type, shore: T.shore, depth: spot.depth, cover: [], current: 0 };
  const s0 = spot.type === 'point' || spot.type === 'island' ? 0.1 : spot.type === 'riprap' || spot.type === 'tailrace' ? 0.14 : spot.type === 'cove' ? 0.2 : 0.16;
  sc.shoreY = (x) => {
    if (!sc.shore) return -1;
    let y = s0 + (n(x * 6, 1) - 0.5) * 0.05;
    if (spot.type === 'point' || spot.type === 'island') y += 0.24 * Math.max(0, 1 - Math.abs(x - 0.5) / 0.28);
    if (spot.type === 'cove') y -= 0.08 * Math.max(0, 1 - Math.abs(x - 0.5) / 0.4);
    return y;
  };
  if (spot.type === 'docks') for (let i = 0; i < 3; i++) { const x = 0.18 + i * 0.3 + r.range(-0.05, 0.05); sc.cover.push({ k: 'dock', x, y0: 0, y1: 0.36 + r.range(0, 0.12), w: r.range(0.06, 0.09) }); }
  if (spot.type === 'brush' || spot.type === 'island' || (spot.type === 'cove' && spot.id.includes('ccc'))) {
    const nb = spot.type === 'brush' ? 2 : 1;
    for (let i = 0; i < nb; i++) sc.cover.push({ k: 'brush', x: nb === 1 ? r.range(0.35, 0.65) : 0.32 + i * 0.36 + r.range(-0.05, 0.05), y: r.range(0.38, 0.55), r: r.range(0.08, 0.11) });
  }
  if (spot.type === 'grass') for (let i = 0; i < 4; i++) sc.cover.push({ k: 'grass', x: r.range(0.12, 0.88), y: r.range(0.28, 0.62), r: r.range(0.09, 0.15) });
  if (spot.type === 'cove' || spot.type === 'creek') for (let i = 0; i < 2; i++) { const x = r.range(0.15, 0.85); sc.cover.push({ k: 'laydown', x, y: 0.2, ang: r.range(0.6, 2.5), len: r.range(0.22, 0.32) }); }
  if (spot.type === 'flat') for (let i = 0; i < 7; i++) sc.cover.push({ k: 'stump', x: r.range(0.1, 0.9), y: r.range(0.3, 0.75), r: 0.025 });
  if (spot.type === 'riprap' || spot.type === 'point' || spot.type === 'tailrace') sc.cover.push({ k: 'rock' });
  if (spot.type === 'channel') sc.ledgeY = 0.45 + r.range(-0.05, 0.05);
  if (spot.type === 'tailrace' || spot.type === 'creek') sc.current = spot.type === 'tailrace' ? 0.06 : 0.025;
  if (spot.type === 'open') sc.school = true;
  sc.bottom = (x, y) => {
    let d;
    if (sc.shore) {
      const sy = sc.shoreY(x); const u = clamp((y - sy) / (1.02 - sy), 0, 1);
      d = 0.5 + (spot.depth * 1.25 - 0.5) * Math.pow(u, 0.85);
      if (spot.type === 'riprap' || spot.type === 'tailrace') d = 1 + (spot.depth * 1.15 - 1) * Math.pow(u, 0.6);
    } else if (sc.ledgeY != null) d = y < sc.ledgeY ? spot.depth * 0.55 : spot.depth * 1.35;
    else d = spot.depth + (y - 0.5) * 4;
    for (const c of sc.cover) if (c.k === 'brush') { const q = dist(x, y, c.x, c.y) / (c.r * 1.6); if (q < 1) d -= 2.5 * (1 - q); }
    return Math.max(0.5, d);
  };
  // which cover is the lure in / near
  sc.coverAt = (x, y, depth) => {
    let inC = null, near = false;
    const sy = sc.shoreY(x);
    for (const c of sc.cover) {
      if (c.k === 'dock') { if (Math.abs(x - c.x) < c.w / 2 && y < c.y1) inC = inC || 'dock'; if (Math.abs(x - c.x) < c.w / 2 + 0.07 && y < c.y1 + 0.07) near = true; }
      else if (c.k === 'brush' || c.k === 'grass' || c.k === 'stump') { const d = dist(x, y, c.x, c.y); if (d < c.r && (c.k !== 'brush' || depth > sc.bottom(x, y) - 6)) inC = inC || c.k; if (d < c.r + 0.08) near = true; }
      else if (c.k === 'laydown') { const ex = c.x + Math.cos(c.ang) * c.len, ey = sy + Math.sin(c.ang) * c.len; const t = clamp(((x - c.x) * (ex - c.x) + (y - sy) * (ey - sy)) / ((ex - c.x) ** 2 + (ey - sy) ** 2), 0, 1); const d = dist(x, y, c.x + t * (ex - c.x), sy + t * (ey - sy)); if (d < 0.03 && depth > 1) inC = inC || 'laydown'; if (d < 0.1) near = true; }
      else if (c.k === 'rock') { if (y - sy < 0.06 && depth > sc.bottom(x, y) - 1.5) inC = inC || 'rock'; if (y - sy < 0.16) near = true; }
    }
    if (sc.ledgeY != null && Math.abs(y - sc.ledgeY) < 0.07) near = true;
    return { inC, near };
  };
  scenes.set(spot.id, sc);
  return sc;
}

// ---------- entering and leaving ----------
export function enterSpot(spot) {
  const S = G.S;
  const prev = S.fish;
  const lures = lureList();
  const lure = prev && lures.includes(prev.lure) ? prev.lure : lures[0];
  S.fish = {
    spot: spot.id, phase: 'aim', lure, color: prev ? prev.color : LURES[lure].colors[0], speed: prev ? prev.speed : 'med',
    aim: { x: 0.5, y: 0.45 }, charge: null, lureP: null, flight: null, reel: false, rod: 0, wet: 0, grassT: 0, fouled: false,
    bite: null, fight: null, catch: null, msg: null, msgT: 0, follow: null, forced: null, t: 0, lastAcc: null,
  };
  S.scene = 'fish';
  bus.emit('enter', spot);
}
export function setLure(id, color) {
  const F = G.S.fish; if (!F || !LURES[id]) return;
  F.lure = id; F.color = color && LURES[id].colors.includes(color) ? color : LURES[id].colors[0];
}

const ctxFor = (F, x, y, depth, speed, nearCover) => {
  const S = G.S, D = S.day, L = getLake(D.lake), spot = L.spot(F.spot);
  return {
    lake: D.lake, month: D.month, Tw: D.weather.water + (spot.depth < 10 && D.clock > 13 * 60 ? 1 : 0), min: D.clock, sky: D.weather.sky,
    clarity: D.weather.clarity, air: airTemp(D.weather, D.clock), spot, lure: F.lure, color: F.color, speed,
    lureDepth: depth, bottom: sceneFor(spot).bottom(x, y), nearCover, eagle: D.eagle && D.eagle.spot === spot.id,
    gen: genAt(D.gen, D.clock), pressure: D.spots[spot.id] ? D.spots[spot.id].pressure : 0, stocking: !!S.profile.stocking,
  };
};
export function oddsHere(over = {}) {
  const F = G.S.fish; const x = over.x ?? 0.5, y = over.y ?? 0.5;
  const sc = sceneFor(getLake(G.S.day.lake).spot(F.spot));
  const depth = over.depth ?? sc.bottom(x, y) * 0.9;
  return biteTable({ ...ctxFor(F, x, y, depth, over.speed || F.speed, over.nearCover ?? sc.coverAt(x, y, depth).near), ...over.ctx });
}

// ---------- aim and cast ----------
export const ringAt = (t) => (1 + Math.cos((2 * Math.PI * t) / RING_PERIOD)) / 2; // 1 = widest (worst), 0 = tightest
export function aimAt(x, y) { const F = G.S.fish; if (!F || F.phase !== 'aim') return; F.aim.x = clamp(x, 0.02, 0.98); F.aim.y = clamp(y, 0.02, 0.9); }
// A real press measures the hold in wall-clock time (fair on slow frames); main.js shifts the start across pauses.
export const CHARGE = { start: null };
// `at` is the input event's timestamp, so a busy frame between the event and its handler doesn't shorten the hold.
export function beginCharge(real = false, at = performance.now()) { const F = G.S.fish; if (!F || F.phase !== 'aim' || F.charge != null) return false; F.charge = 0; CHARGE.start = real ? at : null; return true; }
export function releaseCharge(at = performance.now()) {
  const F = G.S.fish; if (!F || F.charge == null) return false;
  if (CHARGE.start != null) { F.charge = Math.max(0, (at - CHARGE.start) / 1000); CHARGE.start = null; }
  const acc = 1 - ringAt(F.charge); F.charge = null;
  return cast(F.aim.x, F.aim.y, acc);
}
export function cast(x, y, acc = 1) {
  const S = G.S, F = S.fish; if (!F || F.phase !== 'aim') return false;
  if (timeUp()) { bus.emit('timeup'); return false; }
  const sc = sceneFor(getLake(S.day.lake).spot(F.spot));
  const rng = G.rng;
  let dx = x - ROD.x, dy = y - ROD.y; let d = Math.hypot(dx, dy) || 0.01;
  const maxD = 0.95; if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  const scatter = (1 - clamp(acc, 0, 1)) * 0.18 * d;
  const wind = (S.day.weather.wind || 0) * 0.0012;
  let lx = ROD.x + dx + rng.normal() * scatter * 0.7 + wind, ly = ROD.y + dy + rng.normal() * scatter * 0.7;
  lx = clamp(lx, 0.03, 0.97);
  let bank = false;
  const sy = sc.shoreY(lx);
  if (ly < sy + 0.015) { ly = sy + 0.015; bank = true; }
  ly = clamp(ly, 0.03, 0.9);
  F.lastAcc = Math.round(acc * 100) / 100;
  F.flight = { x0: ROD.x, y0: ROD.y, x1: lx, y1: ly, t: 0, dur: 0.45 + 0.45 * d / maxD, bank };
  F.phase = 'flight'; F.wet = 0; F.grassT = 0; F.fouled = false; F.follow = null; F.reel = false;
  S.day.casts++;
  bus.emit('cast', F.flight);
  return true;
}

// ---------- per-tick update ----------
export function tickFish(dt) {
  const S = G.S, F = S.fish; if (!F || S.scene !== 'fish') return;
  F.t += dt;
  if (F.msgT > 0) { F.msgT -= dt; if (F.msgT <= 0) F.msg = null; }
  if (F.charge != null) F.charge = CHARGE.start != null ? (performance.now() - CHARGE.start) / 1000 : F.charge + dt;
  switch (F.phase) {
    case 'flight': {
      F.flight.t += dt;
      if (F.flight.t >= F.flight.dur) {
        F.lureP = { x: F.flight.x1, y: F.flight.y1, depth: 0 };
        F.phase = 'retrieve'; F.flight.done = true;
        bus.emit('splash', F.lureP);
        const sc = sceneFor(getLake(S.day.lake).spot(F.spot));
        const lure = LURES[F.lure];
        const hit = sc.coverAt(F.lureP.x, F.lureP.y, 0.5).inC;
        if ((F.flight.bank || hit === 'dock') && !lure.weedless && G.rng.chance(0.35)) snag(F.flight.bank ? 'bank' : 'dock');
      }
      break;
    }
    case 'retrieve': retrieve(dt); break;
    case 'bite': {
      F.bite.t += dt;
      if (S.settings.assist && F.bite.t >= 0.15) setHook();
      else if (F.bite.t > F.bite.win) { F.phase = 'retrieve'; F.bite = null; say('Missed it! Set the hook faster.', 1.6); const sp = S.day.spots[F.spot]; if (sp) sp.pressure += 0.05; bus.emit('missed'); }
      break;
    }
    case 'fight': fight(dt); break;
    case 'snag': case 'lost': case 'back': {
      F.waitT -= dt;
      if (F.waitT <= 0) { F.phase = 'aim'; F.lureP = null; F.fight = null; F.bite = null; bus.emit('ready'); }
      break;
    }
    default: break;
  }
}

function say(text, sec = 1.4) { const F = G.S.fish; F.msg = text; F.msgT = sec; bus.emit('say', text); }

function endCast(extraMin, why) {
  const F = G.S.fish;
  const min = 3 + 0.35 * F.wet + (extraMin || 0) + (F.fouled ? 2 : 0);
  spend(min, why || 'cast');
  const sp = G.S.day.spots[F.spot]; if (sp) sp.pressure += 0.02;
}

function snag(where) {
  const F = G.S.fish;
  F.phase = 'snag'; F.waitT = 1.1; F.reel = false;
  say(where === 'grass' ? 'Fouled in the grass.' : `Snagged ${where === 'dock' ? 'on a dock post' : where === 'bank' ? 'on the bank' : 'in the ' + where}! Popping it free (4 min).`, 1.8);
  endCast(4, 'snag');
  bus.emit('snag', where);
}

function lureDepthStep(F, lure, bottom, dt) {
  const p = F.lureP; const reeling = F.reel; const v = SPEEDS[F.speed];
  switch (lure.kind) {
    case 'bottom': case 'bait': if (p.depth < bottom) p.depth = Math.min(bottom, p.depth + 1.5 * dt); if (reeling && lure.kind === 'bottom') p.depth = Math.max(Math.min(p.depth, bottom - 0.5), Math.min(p.depth, bottom - 0.5)); if (!reeling && p.depth >= bottom - 0.6) p.depth = bottom; break;
    case 'crank': { const tgt = Math.min(lure.dive, bottom - 0.3); if (reeling) p.depth += (tgt - p.depth) * Math.min(1, 0.22 * v * dt); else p.depth = Math.max(0, p.depth - 0.6 * dt); break; }
    case 'spinner': { const tgt = Math.min({ slow: 6, med: 3.5, fast: 1.5 }[F.speed], bottom - 0.3); if (reeling) p.depth += clamp(tgt - p.depth, -2 * dt, 2 * dt); else p.depth = Math.min(bottom, p.depth + 1.2 * dt); break; }
    case 'top': p.depth = 0; break;
    case 'jerk': { const tgt = Math.min(5, bottom - 0.3); if (reeling || p.depth < tgt * 0.5) p.depth += clamp(tgt - p.depth, -2.5 * dt, 2.5 * dt); break; }
    case 'swim': { const tgt = Math.min(8, bottom - 0.5); if (reeling) p.depth += clamp(tgt - p.depth, -2 * dt, 2 * dt); else p.depth = Math.min(bottom, p.depth + 0.8 * dt); break; }
    case 'tube': p.depth = reeling ? Math.max(0, p.depth - 0.25 * dt) : Math.min(bottom, p.depth + 1.2 * dt); break;
    default: break;
  }
  p.depth = clamp(p.depth, 0, bottom);
}

function retrieve(dt) {
  const S = G.S, F = S.fish, D = S.day; const L = getLake(D.lake); const spot = L.spot(F.spot); const sc = sceneFor(spot);
  const lure = LURES[F.lure]; const p = F.lureP;
  F.wet += dt;
  if (F.reel) {
    const v = SPEEDS[F.speed] / FT;
    const dx = BOAT.x - p.x, dy = BOAT.y - p.y, d = Math.hypot(dx, dy) || 1;
    p.x += (dx / d) * v * dt; p.y += (dy / d) * v * dt;
  }
  if (sc.current) p.x = clamp(p.x + sc.current * dt * (genAt(D.gen, D.clock) ? 3 : 1), 0.02, 0.98);
  const bottom = sc.bottom(p.x, p.y);
  lureDepthStep(F, lure, bottom, dt);
  // done when the lure reaches the boat
  if (dist(p.x, p.y, BOAT.x, BOAT.y) < 0.08) { F.phase = 'back'; F.waitT = 0.25; endCast(0, 'cast'); bus.emit('back'); if (timeUp()) bus.emit('timeup'); return; }
  const cov = sc.coverAt(p.x, p.y, p.depth);
  if (cov.inC && cov.inC !== 'grass' && !lure.weedless) {
    const rate = lure.treble ? (lure.kind === 'crank' && lure.dive > 10 && cov.inC === 'brush' ? 0.45 : 0.3) : 0.12;
    if (G.rng.chance(rate * dt)) { snag(cov.inC); return; }
  }
  if (cov.inC === 'grass' && lure.treble && !F.fouled) { F.grassT += dt; if (F.grassT > 0.8) { F.fouled = true; say('Fouled with grass: reel in and clean it (2 min).', 2); bus.emit('foul'); } }
  if (F.fouled) return;
  // bites
  const speed = F.reel ? F.speed : 'pause';
  const tab = biteTable(ctxFor(F, p.x, p.y, p.depth, speed, cov.near));
  if (F.follow) { F.follow.t -= dt; if (F.follow.t <= 0) F.follow = null; }
  else if (tab.total > 0.35 && G.rng.chance(0.25 * dt)) F.follow = { sp: tab.rows[0].sp, t: 1.6, ox: G.rng.range(-0.04, 0.04) };
  let p1 = BASE_TICK * tab.total * (dt * 60) * (F.follow ? 1.5 : 1);
  if (F.forced) p1 = 1;
  if (G.rng.next() < p1 && (tab.rows.length || F.forced)) {
    const sp = F.forced ? F.forced.sp : pickW(G.rng, tab.rows.map((r) => [r.sp, r.v]));
    const w = F.forced && F.forced.w ? F.forced.w : sampleWeight(G.rng, sp, { lake: D.lake, month: D.month, lure: F.lure, color: F.color, hab: SPOT_TYPES[spot.type].hab });
    F.forced = null;
    strike(sp, w);
  }
}

function strike(sp, w) {
  const S = G.S, F = S.fish;
  F.bite = { sp, w, t: 0, win: 0.55 + (S.profile.upgrades.whetstone ? 0.2 : 0) };
  F.phase = 'bite'; F.follow = null;
  bus.emit('bite', F.bite);
}
export function forceBite(sp, w) { const F = G.S.fish; if (!F) return false; if (F.phase === 'retrieve') { strike(sp, w); return true; } F.forced = { sp, w }; return true; }

// tap during retrieve = twitch; during a bite = hook-set
export function setHook() {
  const S = G.S, F = S.fish; if (!F) return false;
  if (F.phase === 'bite') { startFight(); return true; }
  if (F.phase === 'retrieve') {
    const p = F.lureP; const dx = BOAT.x - p.x, dy = BOAT.y - p.y, d = Math.hypot(dx, dy) || 1;
    p.x += dx / d * 0.03; p.y += dy / d * 0.03; p.depth = Math.max(0, p.depth - 0.8);
    const lure = LURES[F.lure];
    if (F.follow && ['jerk', 'top', 'crank'].includes(lure.kind) && G.rng.chance(0.35)) {
      const w = sampleWeight(G.rng, F.follow.sp, { lake: S.day.lake, month: S.day.month, lure: F.lure, color: F.color });
      strike(F.follow.sp, w);
    }
    bus.emit('twitch');
    return false;
  }
  return false;
}

function startFight() {
  const S = G.S, F = S.fish; const sp = SPECIES[F.bite.sp];
  const d = dist(F.lureP.x, F.lureP.y, BOAT.x, BOAT.y) * FT;
  const Pw = (0.4 + 0.2 * Math.log(1 + F.bite.w)) * sp.fight;
  F.fight = { sp: F.bite.sp, w: F.bite.w, Pw, dist: d, d0: d, stamina: 1, tension: 0.35, heading: G.rng.range(-1, 1), surge: 0, surgeT: G.rng.range(0.6, 1.6), surgeMul: 1,
    jumpT: sp.jumps ? G.rng.range(2.5, 5) : 1e9, jump: 0, slackT: 0, overT: 0, rodS: [0, 0, 0, 0, 0, 0], t: 0, x: F.lureP.x, y: F.lureP.y,
    ang: Math.atan2(F.lureP.y - BOAT.y, F.lureP.x - BOAT.x) };
  F.phase = 'fight'; F.bite = null;
  bus.emit('hooked', F.fight);
}

export function setRod(v) {
  const F = G.S.fish; if (!F) return;
  F.rod = clamp(v, -1, 1);
}

function fight(dt) {
  const S = G.S, F = S.fish, f = F.fight, up = S.profile.upgrades, assist = S.settings.assist;
  f.t += dt;
  // rod: pointer/keys smoothed over the last 6 samples (sample #2's pointer history idea)
  f.rodS.push(F.rod); f.rodS.shift();
  const rod = f.rodS.reduce((a, b) => a + b, 0) / f.rodS.length;
  f.rodNow = rod;
  // surges change heading
  f.surgeT -= dt;
  if (f.surgeT <= 0 && f.stamina < 0.2) f.surgeT = 0.5; // a spent fish no longer runs
  if (f.surgeT <= 0) { f.heading = G.rng.range(-1, 1); f.surge = 0.8; f.surgeMul = G.rng.range(1, 1.8); f.surgeT = G.rng.range(1.2, 3); bus.emit('surge'); }
  if (f.surge > 0) f.surge -= dt;
  // jumps
  f.jumpT -= dt;
  if (f.jumpT <= 0 && f.jump <= 0 && f.dist < 60 && f.stamina > 0.25) { f.jump = 0.7; f.jumpT = G.rng.range(3, 6); f.jumpFrom = f.tension; bus.emit('jump', f); }
  const jumping = f.jump > 0; if (jumping) f.jump -= dt;
  const pull = f.Pw * Math.sqrt(Math.max(0.05, f.stamina)) * (f.surge > 0 ? f.surgeMul : 0.6);
  const opposite = Math.abs(rod) > 0.25 && Math.sign(rod) === -Math.sign(f.heading);
  const same = Math.abs(rod) > 0.25 && Math.sign(rod) === Math.sign(f.heading);
  const side = opposite ? -0.1 : same ? 0.08 : 0;
  let target = clamp(pull * (F.reel ? 0.75 : 0.45) + (F.reel ? 0.3 : 0.05) + side, 0, 1.4);
  if (jumping && !F.reel) target = Math.max(target, 0.25); // the leap itself keeps a slack-free bow in the line if you just ease off
  f.tension += (target - f.tension) * Math.min(1, dt / 0.12);
  const inBand = f.tension >= 0.15 && f.tension <= 0.85;
  f.stamina = Math.max(0, f.stamina - ((0.05 + 0.14 * (inBand ? 1 : 0)) / f.Pw) * (opposite ? 1.8 : same ? 0.6 : 1) * dt);
  if (F.reel) f.dist -= Math.max(0.5, 6 * (1 - 0.55 * pull)) * dt;
  else f.dist += Math.max(0, pull - 0.55) * 4 * dt;
  f.dist = clamp(f.dist, 0, 140);
  // fish position for drawing: an angle from the boat that the fish's heading swings
  f.ang = clamp(f.ang + f.heading * 0.45 * dt * (f.surge > 0 ? 1.8 : 1), -Math.PI + 0.35, -0.35);
  const r = f.dist / FT;
  f.x = BOAT.x + Math.cos(f.ang) * r; f.y = BOAT.y + Math.sin(f.ang) * r;
  // break-offs
  const snapAt = (assist ? 1.2 : 1.0) + (up.reel ? 0.08 : 0);
  if (f.tension > snapAt) f.overT += dt; else f.overT = Math.max(0, f.overT - dt);
  if (f.tension > snapAt + 0.15 || f.overT > 0.45) return lose('snap');
  if (f.tension < 0.15 && f.dist > 6) f.slackT += dt; else f.slackT = Math.max(0, f.slackT - dt * 0.5);
  if (f.slackT > (assist ? 3 : 1.8) + (up.reel ? 0.4 : 0)) return lose('thrown');
  if (jumping && f.jump < 0.35 && !f.jumpChecked) {
    f.jumpChecked = true;
    if (f.tension > 0.9 && G.rng.chance(assist ? 0.2 : 0.5)) return lose('pulled');
    if (f.tension < 0.15 || (f.jumpFrom != null && f.jumpFrom < 0.15)) return lose('thrown');
  }
  if (!jumping) f.jumpChecked = false;
  if (f.dist <= 4) land();
}

function lose(why) {
  const S = G.S, F = S.fish, f = F.fight;
  F.phase = 'lost'; F.waitT = 1.4; F.reel = false;
  const txt = { snap: 'Snap! Too much tension broke the line.', thrown: 'Slack line: it threw the hook.', pulled: 'It jumped and pulled the hook. Ease off when it jumps.' }[why];
  say(txt, 2);
  F.lost = { why, sp: f.sp };
  endCast(2, 'lost');
  const sp = S.day.spots[F.spot]; if (sp) sp.pressure += 0.08;
  bus.emit('lost', why);
}

export function land() {
  const S = G.S, F = S.fish, f = F.fight; if (!f) return;
  const fish = { sp: f.sp, w: f.w, lure: F.lure, color: F.color, spot: F.spot, t: S.day.clock, lake: S.day.lake };
  F.phase = 'landed'; F.catch = fish; F.reel = false;
  logCatch(fish);
  const sp = S.day.spots[F.spot]; if (sp) sp.pressure += 0.18;
  endCast(2 + 2, 'catch');
  fish.info = keepInfo(fish);
  bus.emit('landed', fish);
}

export function resolveCatch(keep) {
  const S = G.S, F = S.fish; if (!F || F.phase !== 'landed') return null;
  let res = { kept: false };
  if (keep) { const r = keepFish(F.catch); res = { kept: r.ok, ...r }; }
  F.catch = null; F.fight = null; F.phase = 'aim'; F.lureP = null;
  bus.emit('resolved', res);
  if (timeUp()) bus.emit('timeup');
  return res;
}
