// Spot view rendering: top-down water with cover, boat bow, cast, line, fish, tension gauge, sonar strip.
import { G } from './state.js';
import { LURES, SPECIES } from './data.js';
import { sceneFor, ringAt, ROD, BOAT, oddsHere } from './fishing.js';
import { getLake, hex } from './lakes.js';
import { makeRng, clamp, lerp, hash32 } from './util.js';
import { makeLine, updateLine, drawLine } from './line.js';
import { drawFish } from './art.js';
import { genAt, isNight } from './sim.js';

export const FX = { ripples: [], drops: [], line: makeLine(), lastPhase: null, time: 0 };
const bgCache = { key: '', cv: null };

const depthCol = (d) => {
  const stops = [[0, [120, 190, 206]], [6, [84, 156, 182]], [15, [62, 128, 166]], [30, [46, 102, 148]], [60, [34, 82, 128]], [140, [24, 60, 100]]];
  for (let i = 1; i < stops.length; i++) if (d <= stops[i][0]) { const [a, c0] = stops[i - 1], [b, c1] = stops[i]; const t = (d - a) / (b - a); return `rgb(${lerp(c0[0], c1[0], t) | 0},${lerp(c0[1], c1[1], t) | 0},${lerp(c0[2], c1[2], t) | 0})`; }
  return 'rgb(22,56,92)';
};

export function addRipple(x, y, big) { FX.ripples.push({ x, y, t: 0, big: !!big }); }
export function fxBusy() { return FX.ripples.length > 0 || FX.drops.length > 0; }

// Static layer: water, shore, cover. Cached per spot/size/DPR/state that changes it.
function background(sc, R, dpr, month, gen, clarity) {
  const key = `${sc.id}|${R.w}x${R.h}|${dpr}|${month}|${gen}|${clarity}`;
  if (bgCache.key === key) return bgCache.cv;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(R.w * dpr); cv.height = Math.ceil(R.h * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const X = (x) => x * R.w, Y = (y) => y * R.h;
  // water rows
  const rows = 48;
  for (let i = 0; i < rows; i++) {
    const y = i / rows;
    c.fillStyle = depthCol(sc.bottom(0.5, y + 0.5 / rows));
    c.fillRect(0, Y(y), R.w, R.h / rows + 1);
  }
  if (clarity === 'muddy') { c.fillStyle = 'rgba(156,122,85,0.2)'; c.fillRect(0, 0, R.w, R.h); }
  else if (clarity === 'stained') { c.fillStyle = 'rgba(92,122,58,0.12)'; c.fillRect(0, 0, R.w, R.h); }
  const r = makeRng(hash32(sc.id + 'bg'));
  // ledge
  if (sc.ledgeY != null) {
    const g = c.createLinearGradient(0, Y(sc.ledgeY - 0.05), 0, Y(sc.ledgeY + 0.08));
    g.addColorStop(0, 'rgba(14,34,51,0)'); g.addColorStop(0.5, 'rgba(14,34,51,0.45)'); g.addColorStop(1, 'rgba(14,34,51,0.15)');
    c.fillStyle = g; c.fillRect(0, Y(sc.ledgeY - 0.05), R.w, Y(0.13));
    c.strokeStyle = 'rgba(246,243,236,0.25)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(0, Y(sc.ledgeY)); c.lineTo(R.w, Y(sc.ledgeY)); c.stroke(); c.setLineDash([]);
  }
  // submerged cover first
  for (const k of sc.cover) {
    if (k.k === 'brush') {
      c.save(); c.translate(X(k.x), Y(k.y)); c.globalAlpha = 0.55;
      c.strokeStyle = '#1F3324'; c.lineCap = 'round';
      for (let i = 0; i < 22; i++) { const a = r.range(0, Math.PI * 2), l = r.range(0.4, 1) * k.r; c.lineWidth = r.range(1.5, 3.5); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * X(l), Math.sin(a) * Y(l)); c.stroke();
        c.lineWidth = 1; for (let j = 0; j < 3; j++) { const t = r.range(0.4, 0.95); const bx = Math.cos(a) * X(l) * t, by = Math.sin(a) * Y(l) * t; const b = a + r.range(-0.9, 0.9); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(b) * 10, by + Math.sin(b) * 10); c.stroke(); } }
      c.restore();
    } else if (k.k === 'grass') {
      for (let i = 0; i < 260; i++) { const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * k.r; const x = X(k.x + Math.cos(a) * d), y = Y(k.y + Math.sin(a) * d * 0.8); c.fillStyle = r.chance(0.5) ? 'rgba(92,122,58,0.8)' : 'rgba(47,74,44,0.75)'; c.fillRect(x, y, 2.5, 4); }
    } else if (k.k === 'stump') {
      c.fillStyle = 'rgba(62,53,40,0.7)'; c.beginPath(); c.ellipse(X(k.x), Y(k.y), X(k.r), Y(k.r), 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(156,122,85,0.6)'; c.lineWidth = 1; c.stroke();
    }
  }
  // shore
  if (sc.shore) {
    c.beginPath(); c.moveTo(0, 0);
    for (let i = 0; i <= 60; i++) { const x = i / 60; c.lineTo(X(x), Y(sc.shoreY(x))); }
    c.lineTo(R.w, 0); c.closePath();
    c.fillStyle = month === 10 || month === 11 ? '#3A4A2A' : '#2F4A2C'; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 160; i++) { const x = r.next(), y = r.next() * 0.4; if (y > sc.shoreY(x) - 0.02) continue; const s = r.range(6, 14); c.fillStyle = (month === 10 || month === 11) && r.chance(0.3) ? r.pick(['#C8501F', '#B5654A', '#D9A23A']) : r.chance(0.5) ? '#1F3324' : '#26402A'; c.beginPath(); c.moveTo(X(x), Y(y) - s); c.lineTo(X(x) + s * 0.6, Y(y) + s * 0.5); c.lineTo(X(x) - s * 0.6, Y(y) + s * 0.5); c.closePath(); c.fill(); }
    c.restore();
    // rock / bank edge (novaculite white highlights)
    c.lineWidth = sc.type === 'riprap' || sc.type === 'tailrace' ? 10 : 5; c.strokeStyle = '#8C877C';
    c.beginPath(); for (let i = 0; i <= 60; i++) { const x = i / 60; const y = Y(sc.shoreY(x)); i ? c.lineTo(X(x), y) : c.moveTo(X(x), y); } c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(237,234,226,0.7)'; c.stroke();
    if (sc.type === 'riprap' || sc.type === 'tailrace' || sc.type === 'point') {
      for (let i = 0; i < 70; i++) { const x = r.next(); const y = sc.shoreY(x) + r.range(-0.01, 0.05); c.fillStyle = r.chance(0.5) ? '#8C877C' : '#A8A296'; c.beginPath(); c.ellipse(X(x), Y(y), r.range(3, 7), r.range(2, 5), r.range(0, 3), 0, 7); c.fill(); }
    }
    if (sc.type === 'tailrace') {
      // dam wall and turbine outlets
      c.fillStyle = '#D9D4CA'; c.fillRect(0, 0, R.w, Y(0.07)); c.fillStyle = '#8C877C'; for (let i = 0; i < 5; i++) c.fillRect(X(0.12 + i * 0.18), Y(0.045), X(0.06), Y(0.03));
      if (gen) { c.fillStyle = 'rgba(246,243,236,0.55)'; for (let i = 0; i < 90; i++) { const x = r.range(0.05, 0.95), y = r.range(0.08, 0.32); c.beginPath(); c.ellipse(X(x), Y(y), r.range(3, 10), r.range(2, 4), 0, 0, 7); c.fill(); } }
    }
  }
  // docks and laydowns above water
  for (const k of sc.cover) {
    if (k.k === 'dock') {
      const x0 = X(k.x - k.w / 2), w = X(k.w), y1 = Y(k.y1);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + 5, 0, w, y1 + 6);
      c.fillStyle = '#9C7A55'; c.fillRect(x0, 0, w, y1);
      c.strokeStyle = 'rgba(62,53,40,0.7)'; c.lineWidth = 1; for (let y = 4; y < y1; y += 7) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y); c.stroke(); }
      c.fillStyle = '#5B4632'; for (const px of [x0 - 2, x0 + w - 3]) for (let y = 14; y < y1; y += 26) c.fillRect(px, y, 5, 5);
      c.fillStyle = '#F6F3EC'; c.fillRect(x0 + w * 0.3, y1 - 12, w * 0.4, 8);
    } else if (k.k === 'laydown') {
      const sy = sc.shoreY(k.x); const ex = k.x + Math.cos(k.ang) * k.len, ey = sy + Math.sin(k.ang) * k.len;
      c.strokeStyle = '#5B4632'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(X(k.x), Y(sy)); c.lineTo(X(ex), Y(ey)); c.stroke();
      c.lineWidth = 2.5; for (let i = 0; i < 6; i++) { const t = 0.3 + i * 0.12; const bx = lerp(k.x, ex, t), by = lerp(sy, ey, t); const a = k.ang + (i % 2 ? 0.9 : -0.9); c.beginPath(); c.moveTo(X(bx), Y(by)); c.lineTo(X(bx) + Math.cos(a) * 16, Y(by) + Math.sin(a) * 16); c.stroke(); }
    }
  }
  bgCache.key = key; bgCache.cv = cv;
  return cv;
}

// R = water rect, SR = sonar rect, t = real seconds, dt = frame seconds, opts {dpr, reduced, night}
// opts.overlay = { project(x, y, depthFt) → [sx, sy] }: the 3D scene draws the world; only the HUD layer is drawn here.
export function drawSpot(ctx, R, SR, dt, opts) {
  const S = G.S, F = S.fish, D = S.day; if (!F) return;
  const L = getLake(D.lake); const spot = L.spot(F.spot); const sc = sceneFor(spot);
  const gen = genAt(D.gen, D.clock) && spot.type === 'tailrace';
  FX.time += dt;
  if (opts.overlay) { drawSpotHud(ctx, R, SR, F, sc, opts); return; }
  const X = (x) => R.x + x * R.w, Y = (y) => R.y + y * R.h;
  ctx.drawImage(background(sc, R, opts.dpr, D.month, gen, D.weather.clarity), R.x, R.y, R.w, R.h);
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  // ambient surface glints
  if (!opts.reduced) {
    ctx.strokeStyle = 'rgba(246,243,236,0.10)'; ctx.lineWidth = 1.2;
    const gr = makeRng(7);
    for (let i = 0; i < 26; i++) { const x = gr.next(), y = gr.range(0.25, 1); if (y < sc.shoreY(x) + 0.03) continue; const ph = FX.time * 0.6 + i; const w = 10 + 8 * Math.sin(ph); ctx.beginPath(); ctx.moveTo(X(x) - w, Y(y)); ctx.quadraticCurveTo(X(x), Y(y) - 3 * Math.sin(ph * 1.3), X(x) + w, Y(y)); ctx.stroke(); }
  }
  // current lines
  if (sc.current) {
    ctx.strokeStyle = gen ? 'rgba(246,243,236,0.45)' : 'rgba(246,243,236,0.18)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const y = 0.15 + i * 0.06; const off = opts.reduced ? 0 : (FX.time * (gen ? 0.25 : 0.08) + i * 0.13) % 1; ctx.beginPath(); ctx.moveTo(X(off - 0.1), Y(y)); ctx.lineTo(X(off + 0.12), Y(y + 0.01)); ctx.stroke(); }
  }
  // schooling fish breaking (open water)
  if (sc.school && !opts.reduced) { const ph = (FX.time / 3) % 1; if (ph < 0.3) { ctx.fillStyle = 'rgba(246,243,236,0.5)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(X(0.3 + i * 0.05), Y(0.35 + (i % 2) * 0.03), 2 + ph * 8, 0, 7); ctx.fill(); } } }
  // follow shadow
  if (F.follow && F.lureP && F.phase === 'retrieve') {
    drawShadow(ctx, X(F.lureP.x + F.follow.ox), Y(F.lureP.y - 0.06), 30, Math.PI / 2);
  }
  // ripples
  for (const rp of FX.ripples) { rp.t += dt; }
  FX.ripples = FX.ripples.filter((rp) => rp.t < (rp.big ? 1.2 : 0.9));
  for (const rp of FX.ripples) {
    const k = rp.t / (rp.big ? 1.2 : 0.9); ctx.strokeStyle = `rgba(246,243,236,${0.7 * (1 - k)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(X(rp.x), Y(rp.y), 6 + k * (rp.big ? 48 : 26), 3 + k * (rp.big ? 20 : 12), 0, 0, 7); ctx.stroke();
  }
  for (const d of FX.drops) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 600 * dt; }
  FX.drops = FX.drops.filter((d) => d.t < 0.6);
  ctx.fillStyle = 'rgba(246,243,236,0.85)'; for (const d of FX.drops) { ctx.beginPath(); ctx.arc(d.x, d.y, 2.2, 0, 7); ctx.fill(); }
  // eagle
  if (D.eagle && D.eagle.spot === spot.id) drawEagle(ctx, X(0.5) + Math.cos(FX.time * (opts.reduced ? 0 : 0.5)) * R.w * 0.25, Y(0.22) + Math.sin(FX.time * (opts.reduced ? 0 : 0.5)) * R.h * 0.08, 34);
  // boat bow and rod
  const bw = Math.min(R.w * 0.32, 180), bh = Math.min(R.h * 0.18, 110);
  ctx.fillStyle = '#F6F3EC'; ctx.strokeStyle = '#14283A'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(0.5), Y(1.0) - bh); ctx.quadraticCurveTo(X(0.5) + bw * 0.5, Y(1.0) - bh * 0.5, X(0.5) + bw * 0.52, Y(1.0) + 4); ctx.lineTo(X(0.5) - bw * 0.52, Y(1.0) + 4); ctx.quadraticCurveTo(X(0.5) - bw * 0.5, Y(1.0) - bh * 0.5, X(0.5), Y(1.0) - bh); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#C8452B'; ctx.fillRect(X(0.5) - bw * 0.3, Y(1.0) - bh * 0.35, bw * 0.6, 6);
  ctx.fillStyle = '#5B4632'; ctx.fillRect(X(0.5) - bw * 0.22, Y(1.0) - bh * 0.25, bw * 0.44, bh * 0.25);
  const tip = { x: X(ROD.x) + (F.fight ? (F.fight.rodNow || 0) * 40 : 0), y: Y(ROD.y) - 8 };
  ctx.strokeStyle = '#14283A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(0.5), Y(1.0)); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  // aim
  if (F.phase === 'aim') {
    const ax = X(F.aim.x), ay = Y(F.aim.y);
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(246,243,236,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + ax) / 2, Math.min(tip.y, ay) - 60, ax, ay); ctx.stroke(); ctx.setLineDash([]);
    const ring = F.charge != null ? ringAt(F.charge) : 1;
    const rr = 10 + ring * Math.max(30, R.w * 0.07);
    ctx.strokeStyle = F.charge != null ? (ring < 0.15 ? '#F2A541' : '#F6F3EC') : 'rgba(246,243,236,0.8)'; ctx.lineWidth = F.charge != null ? 3 : 2;
    ctx.beginPath(); ctx.arc(ax, ay, rr, 0, 7); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#F6F3EC'; ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.lineTo(ax + 8, ay); ctx.moveTo(ax, ay - 8); ctx.lineTo(ax, ay + 8); ctx.stroke();
    if (F.charge != null && ring < 0.15) { ctx.fillStyle = '#F2A541'; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RELEASE', ax, ay - rr - 6); }
    FX.line.init = false;
  }
  // flight
  let lureS = null;
  if (F.phase === 'flight' && F.flight) {
    const f = F.flight, u = clamp(f.t / f.dur, 0, 1);
    const x = X(lerp(f.x0, f.x1, u)), yb = Y(lerp(f.y0, f.y1, u)), h = Math.sin(u * Math.PI) * Math.min(160, R.h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, yb, 5, 2.5, 0, 0, 7); ctx.fill();
    lureS = { x, y: yb - h };
    ctx.strokeStyle = 'rgba(246,243,236,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + x) / 2, Math.min(tip.y, yb - h) - 30, x, yb - h); ctx.stroke();
    drawLureDot(ctx, lureS.x, lureS.y, F, 0);
    FX.line.init = false;
  }
  // lure in water
  if ((F.phase === 'retrieve' || F.phase === 'bite' || F.phase === 'snag' || F.phase === 'back') && F.lureP) {
    let lx = X(F.lureP.x), ly = Y(F.lureP.y);
    if (F.phase === 'bite') { lx += Math.sin(FX.time * 60) * 3; ly += Math.cos(FX.time * 47) * 2; }
    lureS = { x: lx, y: ly };
    updateLine(FX.line, tip, lureS, F.reel ? 0.7 : 0.25, 0.3);
    drawLine(ctx, FX.line, 'rgba(246,243,236,0.85)', 1.3);
    drawLureDot(ctx, lx, ly, F, F.lureP.depth);
    if (F.fouled) { ctx.strokeStyle = '#5C7A3A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx - 8, ly - 4); ctx.lineTo(lx + 8, ly + 5); ctx.moveTo(lx - 6, ly + 6); ctx.lineTo(lx + 7, ly - 6); ctx.stroke(); }
    if (F.phase === 'bite') {
      ctx.fillStyle = '#F2A541'; ctx.strokeStyle = '#14283A'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lx, ly - 34, 17, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#14283A'; ctx.font = '900 24px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', lx, ly - 33); ctx.textBaseline = 'alphabetic';
      ctx.strokeStyle = 'rgba(242,165,65,0.8)'; ctx.lineWidth = 3; const k = (FX.time * 3) % 1; ctx.beginPath(); ctx.arc(lx, ly, 10 + k * 26, 0, 7); ctx.stroke();
    }
  }
  // fight
  if (F.phase === 'fight' && F.fight) {
    const f = F.fight; const fx = X(f.x), fy = Y(f.y);
    const len = clamp(34 + 16 * Math.sqrt(f.w), 34, 120) * Math.min(1, R.w / 700 + 0.3);
    if (f.jump > 0) {
      const u = 1 - f.jump / 0.7; const h = Math.sin(u * Math.PI) * 70;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(fx, fy, len * 0.4, len * 0.12, 0, 0, 7); ctx.fill();
      drawFish(ctx, f.sp, fx, fy - h, len * 1.5, { dir: f.heading >= 0 ? 1 : -1, rot: (u - 0.5) * 1.4 * (f.heading >= 0 ? 1 : -1), dpr: opts.dpr });
      lureS = { x: fx + (f.heading >= 0 ? 1 : -1) * len * 0.45, y: fy - h };
    } else {
      drawShadow(ctx, fx, fy, len, f.ang + Math.PI + f.heading * 0.6);
      lureS = { x: fx, y: fy };
      if (f.surge > 0 && !opts.reduced) { ctx.strokeStyle = 'rgba(246,243,236,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, len * 0.6, 0, 7); ctx.stroke(); }
    }
    updateLine(FX.line, tip, lureS, f.tension, 0.3);
    drawLine(ctx, FX.line, f.tension > 0.85 ? '#FF8A7A' : 'rgba(246,243,236,0.95)', 1.6);
    // heading arrow cue
    const dir = f.heading >= 0 ? 1 : -1;
    ctx.fillStyle = 'rgba(246,243,236,0.9)'; ctx.beginPath(); ctx.moveTo(fx + dir * (len * 0.55 + 18), fy); ctx.lineTo(fx + dir * (len * 0.55), fy - 9); ctx.lineTo(fx + dir * (len * 0.55), fy + 9); ctx.closePath(); ctx.fill();
  }
  if (F.phase === 'landed' && F.catch) {
    drawFish(ctx, F.catch.sp, X(0.5), Y(0.62), clamp(R.w * 0.28, 120, 300), { dpr: opts.dpr });
  }
  // weather overlay
  const sky = D.weather.sky;
  if ((sky === 'rain' || sky === 'storm') && !opts.reduced) { ctx.strokeStyle = 'rgba(214,224,232,0.35)'; ctx.lineWidth = 1; const rr = makeRng(Math.floor(FX.time * 12)); for (let i = 0; i < 60; i++) { const x = R.x + rr.next() * R.w, y = R.y + rr.next() * R.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke(); } }
  if (isNight(D.clock, D.month)) { ctx.fillStyle = 'rgba(10,16,40,0.45)'; ctx.fillRect(R.x, R.y, R.w, R.h); }
  else if (D.clock > D.sun.set - 40 || D.clock < D.sun.rise + 30) { ctx.fillStyle = 'rgba(181,86,143,0.16)'; ctx.fillRect(R.x, R.y, R.w, R.h); }
  ctx.restore();
  if (F.phase === 'fight' && F.fight) drawGauge(ctx, R, F.fight);
  if (SR) drawSonar(ctx, SR, F, sc);
}

function drawShadow(ctx, x, y, len, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(14,30,44,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 0, len * 0.5, len * 0.17, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-len * 0.45, 0); ctx.lineTo(-len * 0.68, -len * 0.16); ctx.lineTo(-len * 0.68, len * 0.16); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawEagle(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#2B2A27';
  ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.5, -s * 0.35, 0, -s * 0.05); ctx.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); ctx.quadraticCurveTo(s * 0.5, -s * 0.1, 0, s * 0.12); ctx.quadraticCurveTo(-s * 0.5, -s * 0.1, -s, 0); ctx.fill();
  ctx.fillStyle = '#F6F3EC'; ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.1, 0, 7); ctx.fill(); ctx.fillRect(-s * 0.08, s * 0.08, s * 0.16, s * 0.14);
  ctx.restore();
}
const LURE_COLOR = { 'green pumpkin': '#5C6B2E', shad: '#C3D3DF', 'red craw': '#B5452B', chartreuse: '#D7E84A', 'black/blue': '#1E2A5A', natural: '#C88A6A' };
function drawLureDot(ctx, x, y, F, depth) {
  const a = clamp(1 - depth / 30, 0.35, 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = LURE_COLOR[F.color] || '#F2A541'; ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, y, 6, 4, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
}

// The HUD layer over the 3D spot: aim hint, bite cue, fight arrow, gauge, sonar.
function drawSpotHud(ctx, R, SR, F, sc, opts) {
  const pr = opts.overlay.project;
  for (const rp of FX.ripples) rp.t += 1; FX.ripples = []; FX.drops = [];
  if (F.phase === 'aim' && F.charge != null && ringAt(F.charge) < 0.15) {
    const p = pr(F.aim.x, F.aim.y); if (p) { ctx.fillStyle = '#F2A541'; ctx.strokeStyle = 'rgba(14,34,51,0.8)'; ctx.lineWidth = 3; ctx.font = '800 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeText('RELEASE', p[0], p[1] - 42); ctx.fillText('RELEASE', p[0], p[1] - 42); }
  }
  if (F.phase === 'bite' && F.lureP) {
    const p = pr(F.lureP.x, F.lureP.y, 0); if (p) {
      const [lx, ly] = p;
      ctx.fillStyle = '#F2A541'; ctx.strokeStyle = '#14283A'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lx, ly - 46, 19, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#14283A'; ctx.font = '900 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', lx, ly - 45); ctx.textBaseline = 'alphabetic';
      ctx.strokeStyle = 'rgba(242,165,65,0.85)'; ctx.lineWidth = 3; const k = (FX.time * 3) % 1; ctx.beginPath(); ctx.ellipse(lx, ly, 12 + k * 30, (12 + k * 30) * 0.4, 0, 0, 7); ctx.stroke();
    }
  }
  if (F.phase === 'fight' && F.fight) {
    const f = F.fight; const p = pr(f.x, f.y, f.jump > 0 ? -2 : 1);
    if (p && f.jump <= 0) { // which way the fish is running: a chevron pill beside it (pull the rod the other way)
      const dir = f.heading >= 0 ? 1 : -1; const [fx, fy] = p; const cx = fx + dir * 48, w = 46, h = 22;
      ctx.fillStyle = 'rgba(14,34,51,0.78)'; roundRect(ctx, cx - w / 2, fy - h / 2, w, h, 11); ctx.fill();
      ctx.strokeStyle = f.surge > 0 ? '#F2A541' : '#F6F3EC'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const k of [-7, 5]) { const x0 = cx + dir * k; ctx.beginPath(); ctx.moveTo(x0 - dir * 5, fy - 6); ctx.lineTo(x0 + dir * 2, fy); ctx.lineTo(x0 - dir * 5, fy + 6); ctx.stroke(); }
      ctx.lineCap = 'butt'; }
    drawGaugeRadial(ctx, R, f, opts.reduced);
  }
  const uw = opts.overlay.underwater;
  if (uw) {
    // sun shafts through clear and stained water (a light overlay on the inset)
    const clar = G.S.day.weather.clarity; if (clar !== 'muddy' && !opts.reduced) { ctx.save(); roundRect(ctx, uw.x, uw.y, uw.w, uw.h, 8); ctx.clip(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) { const x0 = uw.x + uw.w * (0.1 + i * 0.2) + Math.sin(FX.time * 0.4 + i) * 10; const g = ctx.createLinearGradient(0, uw.y, 0, uw.y + uw.h); g.addColorStop(0, `rgba(190,230,230,${clar === 'clear' ? 0.16 : 0.08})`); g.addColorStop(1, 'rgba(190,230,230,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, uw.y); ctx.lineTo(x0 + 18, uw.y); ctx.lineTo(x0 + 46, uw.y + uw.h); ctx.lineTo(x0 + 22, uw.y + uw.h); ctx.closePath(); ctx.fill(); }
      ctx.restore(); }
    ctx.strokeStyle = 'rgba(246,243,236,0.85)'; ctx.lineWidth = 2; roundRect(ctx, uw.x, uw.y, uw.w, uw.h, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(14,34,51,0.8)'; ctx.fillRect(uw.x + 8, uw.y + 6, 92, 18); ctx.fillStyle = '#F6F3EC'; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('UNDERWATER', uw.x + 13, uw.y + 19); }
  if (SR) drawSonar(ctx, SR, F, sc);
}

// Radial tension gauge beside the reel (3D view): a 240° arc with hatched SLACK, solid GOOD and striped DANGER
// zones, each labelled, a marker for the tension, the fish's stamina as an inner ring and the line out in the centre.
function drawGaugeRadial(ctx, R, f, reduced) {
  const small = R.w < 600; const rad = small ? 56 : 74; const cx = R.x + R.w - rad - (small ? 18 : 30), cy = R.y + R.h - rad - (small ? 16 : 26);
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5; const ang = (v) => a0 + clamp(v / 1.1, 0, 1) * span;
  ctx.save();
  ctx.fillStyle = 'rgba(14,34,51,0.78)'; ctx.beginPath(); ctx.arc(cx, cy, rad + 14, 0, 7); ctx.fill();
  const band = (v0, v1, fill, pattern) => {
    ctx.beginPath(); ctx.arc(cx, cy, rad, ang(v0), ang(v1)); ctx.arc(cx, cy, rad - 16, ang(v1), ang(v0), true); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (pattern) { ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(246,243,236,0.45)'; ctx.lineWidth = pattern === 'stripe' ? 3 : 1.5;
      for (let i = -rad * 2; i < rad * 2; i += pattern === 'stripe' ? 9 : 6) { ctx.beginPath(); if (pattern === 'stripe') { ctx.moveTo(cx + i, cy - rad - 20); ctx.lineTo(cx + i + rad + 40, cy + rad + 20); } else { ctx.moveTo(cx - rad - 20, cy + i); ctx.lineTo(cx + rad + 20, cy + i); } ctx.stroke(); }
      ctx.restore(); }
  };
  band(0, 0.15, '#4A5675', 'hatch'); band(0.15, 0.85, '#2E6A3C', null); band(0.85, 1.1, '#9A2A1C', 'stripe');
  ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a0 + span); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, rad - 16, a0, a0 + span); ctx.stroke();
  // stamina ring
  ctx.strokeStyle = 'rgba(195,211,223,0.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, rad - 25, a0, a0 + span); ctx.stroke();
  ctx.strokeStyle = '#F2A541'; ctx.beginPath(); ctx.arc(cx, cy, rad - 25, a0, a0 + span * clamp(f.stamina, 0, 1)); ctx.stroke();
  // tension marker
  const shake = f.tension > 0.85 && !reduced ? Math.sin(FX.time * 70) * 0.025 : 0; const a = ang(f.tension) + shake;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#F2A541'; ctx.strokeStyle = '#14283A'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rad + 9, 0); ctx.lineTo(rad - 22, -7); ctx.lineTo(rad - 22, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  // labels
  ctx.font = `800 ${small ? 10 : 11}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#F6F3EC';
  const lab = (t, v, r2) => { const q = ang(v); ctx.fillText(t, cx + Math.cos(q) * r2, cy + Math.sin(q) * r2); };
  lab('SLACK', 0.03, rad + 4); lab('GOOD', 0.55, rad + 4); lab('DANGER', 1.05, rad + 4);
  ctx.font = `800 ${small ? 16 : 20}px system-ui, sans-serif`; ctx.fillText(`${Math.round(f.dist)} ft`, cx, cy - 4);
  ctx.font = `600 ${small ? 10 : 11}px system-ui, sans-serif`; ctx.fillStyle = '#C3D3DF'; ctx.fillText('line out', cx, cy + 13); ctx.fillText('TENSION', cx, cy + rad - 2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// Tension gauge: vertical bar with hatched SLACK, GOOD and striped DANGER zones, labels, stamina and distance.
function drawGauge(ctx, R, f) {
  const w = R.w < 600 ? 26 : 34, h = Math.min(300, R.h * (R.w < 600 ? 0.42 : 0.6)), x = R.x + 10, y = R.y + (R.h - h) / 2;
  ctx.fillStyle = 'rgba(14,34,51,0.82)'; roundRect(ctx, x - 8, y - 30, w + 92, h + 70, 10); ctx.fill();
  const zy = (v) => y + h - clamp(v / 1.1, 0, 1) * h;
  ctx.fillStyle = '#2E6A3C'; ctx.fillRect(x, zy(0.85), w, zy(0.15) - zy(0.85));
  // DANGER stripes
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, zy(0.85) - y); ctx.clip(); ctx.fillStyle = '#9A2A1C'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(246,243,236,0.45)'; ctx.lineWidth = 4; for (let i = -h; i < h; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke(); } ctx.restore();
  // SLACK hatching
  ctx.save(); ctx.beginPath(); ctx.rect(x, zy(0.15), w, y + h - zy(0.15)); ctx.clip(); ctx.fillStyle = '#4A5675'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(246,243,236,0.4)'; ctx.lineWidth = 2; for (let i = 0; i < h; i += 8) { ctx.beginPath(); ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); ctx.stroke(); } ctx.restore();
  ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  const my = zy(f.tension);
  ctx.fillStyle = '#F2A541'; ctx.strokeStyle = '#14283A'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 6, my - 8); ctx.lineTo(x + w + 6, my - 8); ctx.lineTo(x + w + 14, my); ctx.lineTo(x + w + 6, my + 8); ctx.lineTo(x - 6, my + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#F6F3EC';
  ctx.fillText('DANGER', x + w + 18, zy(0.97) + 4); ctx.fillText('GOOD', x + w + 18, zy(0.5) + 4); ctx.fillText('SLACK', x + w + 18, zy(0.06) + 4);
  ctx.textAlign = 'center'; ctx.fillText('TENSION', x + w / 2 + 30, y - 12);
  ctx.textAlign = 'left'; ctx.fillText(`${Math.round(f.dist)} ft`, x, y + h + 18);
  ctx.fillStyle = '#C3D3DF'; ctx.fillRect(x + 50, y + h + 9, 52, 8); ctx.fillStyle = '#F2A541'; ctx.fillRect(x + 50, y + h + 9, 52 * f.stamina, 8);
  ctx.fillStyle = '#F6F3EC'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText('fish', x + 50, y + h + 30);
}

// Sonar strip: cross-section from the boat to the lure with depth scale, lure and fish marks.
function drawSonar(ctx, SR, F, sc) {
  const S = G.S;
  ctx.fillStyle = '#0E2233'; roundRect(ctx, SR.x, SR.y, SR.w, SR.h, 10); ctx.fill();
  ctx.strokeStyle = '#2C5677'; ctx.lineWidth = 1.5; ctx.stroke();
  const pad = 10, ix = SR.x + pad + 38, iw = SR.w - pad * 2 - 42, iy = SR.y + 26, ih = SR.h - 40;
  ctx.fillStyle = '#F6F3EC'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('SONAR', SR.x + pad, SR.y + 17);
  const fighting = F.phase === 'fight' && F.fight;
  const target = fighting ? { x: F.fight.x, y: F.fight.y } : F.lureP || (F.phase === 'aim' ? F.aim : null) || { x: 0.5, y: 0.4 };
  let maxD = 0; const N = 40, prof = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const x = lerp(BOAT.x, target.x, t), y = lerp(BOAT.y, target.y, t); const d = sc.bottom(x, y); prof.push(d); maxD = Math.max(maxD, d); }
  const scaleD = Math.max(10, Math.ceil((maxD + 3) / 5) * 5);
  const DY = (d) => iy + (d / scaleD) * ih;
  // fish-finder look: deep-navy water column with faint clutter, bottom returns banded red → yellow → blue
  const wg = ctx.createLinearGradient(0, iy, 0, iy + ih); wg.addColorStop(0, '#0B2440'); wg.addColorStop(1, '#06182C');
  ctx.fillStyle = wg; ctx.fillRect(ix, iy, iw, ih);
  ctx.fillStyle = 'rgba(120,170,220,0.18)'; for (let k = 0; k < 40; k++) { const u = ((k * 0.618) % 1), v = ((k * 0.377) % 1) * 0.8; ctx.fillRect(ix + u * iw, iy + v * ih, 1.5, 1.5); }
  const bottomPath = () => { ctx.beginPath(); ctx.moveTo(ix, DY(prof[0])); prof.forEach((d, i) => ctx.lineTo(ix + (i / N) * iw, DY(d))); ctx.lineTo(ix + iw, iy + ih); ctx.lineTo(ix, iy + ih); ctx.closePath(); };
  ctx.save(); bottomPath(); ctx.clip(); ctx.fillStyle = '#14305A'; ctx.fillRect(ix, iy, iw, ih);
  // returns follow the bottom: a hard red edge, then yellow, then fading blue
  for (const [off, w, c] of [[16, 18, '#2A5FB0'], [8, 9, '#3C8CFF'], [4, 5, '#FFC23C'], [1.5, 3, '#FF5A3C']]) { ctx.beginPath(); prof.forEach((d, i) => { const x = ix + (i / N) * iw, y = DY(d) + off; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(ix, DY(prof[0])); prof.forEach((d, i) => ctx.lineTo(ix + (i / N) * iw, DY(d))); ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#C3D3DF'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'right';
  const marks = ih < 50 ? [0, scaleD] : [0, scaleD / 2, scaleD];
  for (const d of marks) ctx.fillText(d === scaleD ? `${d} ft` : `${d}`, ix - 4, clamp(DY(d) + 4, iy + 8, iy + ih));
  ctx.textAlign = 'left';
  ctx.textAlign = 'left'; ctx.fillText('boat', ix, iy + ih + 12); ctx.textAlign = 'right'; ctx.fillText(fighting ? 'fish' : F.lureP ? 'lure' : 'aim', ix + iw, iy + ih + 12);
  // brush/grass marks along the profile
  for (const c of sc.cover) if (c.k === 'brush' || c.k === 'grass') {
    for (let i = 0; i <= N; i++) { const t = i / N; const x = lerp(BOAT.x, target.x, t), y = lerp(BOAT.y, target.y, t); if (Math.hypot(x - c.x, y - c.y) < c.r) { ctx.fillStyle = c.k === 'brush' ? '#5C7A3A' : '#2F8F5B'; const d = prof[i]; ctx.fillRect(ix + t * iw - 2, DY(d) - (c.k === 'brush' ? 14 : 10), 4, c.k === 'brush' ? 14 : 10); } }
  }
  // fish marks (sonar upgrade)
  if (S.profile.upgrades.sonar && S.day) {
    const rows = cachedRows(F, target, sc);
    rows.slice(0, 3).forEach((r, k) => { if (r.v < 0.08) return; const t = 0.35 + k * 0.22; const d = Math.min(r.fishDepth, prof[Math.round(t * N)] - 1);
      // fish arches, coloured by return strength
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = r.v > 0.3 ? '#FF7A3C' : '#FFC23C'; ctx.beginPath(); ctx.arc(ix + t * iw, DY(d) + 5, 7, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); ctx.lineCap = 'butt'; });
  }
  if (fighting) {
    ctx.fillStyle = '#F6F3EC'; ctx.textAlign = 'right'; ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(`fish on · ${Math.round(F.fight.dist)} ft out`, SR.x + SR.w - pad, SR.y + 17);
  } else if (F.lureP) {
    const t = 1; const ly = DY(F.lureP.depth);
    ctx.fillStyle = LURE_COLOR[F.color] || '#F2A541'; ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ix + t * iw - 6, ly, 5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F6F3EC'; ctx.textAlign = 'right'; ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(`lure ${F.lureP.depth.toFixed(1)} ft · bottom ${prof[N].toFixed(0)} ft`, SR.x + SR.w - pad, SR.y + 17);
  } else {
    ctx.fillStyle = '#F6F3EC'; ctx.textAlign = 'right'; ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(`bottom ${prof[N].toFixed(0)} ft`, SR.x + SR.w - pad, SR.y + 17);
  }
}
let rowCache = { k: '', rows: [] };
function cachedRows(F, target, sc) {
  const k = `${F.spot}|${F.lure}|${F.color}|${F.speed}|${G.S.day.clock}|${Math.round(target.x * 5)}|${Math.round(target.y * 5)}`;
  if (rowCache.k !== k) { rowCache = { k, rows: oddsHere({ x: target.x, y: target.y }).rows }; }
  return rowCache.rows;
}

export function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export { hex };
