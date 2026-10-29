// Entry: loop, layout, input, scene glue, map drawing and the window.__game hooks.
import { G, load, save, freshState } from './state.js';
import { LAKES, SPECIES, LURES, SPOT_TYPES, TIERS, CHAPTERS, ANGLERS, EVENT_TEXT } from './data.js';
import { getLake, makeView, renderMap, pathPoint, loadDem, demHeights, route } from './lakes.js';
import { clamp, deepMerge, clone, lerp, fmtW, fmtClock, makeRng } from './util.js';
import * as game from './game.js';
import * as fishing from './fishing.js';
import { drawSpot, FX, addRipple, fxBusy } from './fishview.js';
import { drawBoat, drawTitle, drawWeighIn } from './art.js';
import { sfx, setAudio, setDrag, stopDrag, startMotor, stopMotor } from './audio.js';
import { phaseOf, biteTable, fieldBag, isNight, waterTempBase, genAt, sunTimes, sampleWeight, makeWeather } from './sim.js';
import * as ui from './ui.js';
import { GFX, initGL, glActive, resizeGL, frameTiming } from './gfx/gl.js';
import { renderMap3D, projectMap, mapHeight, mapScalePx, mapReady, mapDebug } from './gfx/map3d.js';
import { renderSpot3D, spotToScreen, screenToSpot, splash3D, spotBusy, spotDebug, underwaterRect, fishDebug } from './gfx/spot3d.js';
import { loadPlates, PLATE_STATE } from './gfx/plates.js';

const TICK = 1 / 60;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const L = { W: 0, H: 0, dpr: 1, portrait: false, wide: true, hud: 56, view: null, map: null, mapKey: '', R: null, SR: null, pts: [] };
const st = { raf: 0, last: 0, acc: 0, paused: false, t: 0, sel: null, keys: {}, ptr: null, catchT: 0, frozen: null, lastHUD: '' };
G.paused = false;

// ---------- boot ----------
const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
load();
ui.setNotes((typeof DOCK_NOTES !== 'undefined' ? DOCK_NOTES.notes : [])); // eslint-disable-line no-undef
applySettings();
resize();
window.addEventListener('resize', () => { resize(); resizeGL(); ui.renderScene(); kick(); });
mq && mq.addEventListener && mq.addEventListener('change', () => { applySettings(); ui.renderScene(); kick(); });
mqDark && mqDark.addEventListener && mqDark.addEventListener('change', () => { applySettings(); ui.renderScene(); });
ui.renderScene();
kick();
// three.js and the 3D scenes load after first paint; the 2D renderer covers until (or unless) they're ready
setTimeout(() => { initGL().then(() => { resize(); kick(); }); loadPlates().then(() => { if (['journal', 'weighin', 'results', 'campaign'].includes(G.S.scene)) { ui.renderScene(); if (G.S.scene === 'journal') ui.paintJournal(); } kick(); }); }, 0);

function applySettings() {
  const s = G.S.settings;
  G.S.ui.reduced = s.motion === 'reduced' || (s.motion === 'auto' && !!(mq && mq.matches));
  G.S.ui.theme = s.theme === 'auto' ? (mqDark && mqDark.matches ? 'dark' : 'light') : s.theme;
  setAudio(s.sound, s.volume);
}

function resize() {
  L.W = window.innerWidth; L.H = window.innerHeight; L.dpr = Math.min(2, window.devicePixelRatio || 1);
  L.portrait = L.H > L.W * 1.05; L.wide = L.W >= 900;
  document.body.classList.toggle('portrait', L.portrait);
  cv.width = Math.round(L.W * L.dpr); cv.height = Math.round(L.H * L.dpr);
  cv.style.width = L.W + 'px'; cv.style.height = L.H + 'px';
  L.hud = 56;
  const mapBottom = L.wide ? 0 : 64;
  L.view = makeView({ x: 6, y: L.hud + 4, w: L.W - 12, h: L.H - L.hud - mapBottom - 10 }, L.portrait);
  if (L.wide) { L.R = { x: 0, y: L.hud, w: L.W - 330, h: L.H - L.hud }; L.SR = { x: L.W - 320, y: L.hud + 10, w: 310, h: 200 }; }
  else { const bottom = 220; L.R = { x: 0, y: L.hud, w: L.W, h: L.H - L.hud - bottom }; L.SR = { x: 8, y: L.H - bottom + 4, w: L.W - 16, h: 82 }; }
  L.mapKey = '';
}

// ---------- loop ----------
function kick() { if (!st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(frame); } }
function wantsFrames() {
  const S = G.S, sc = S.scene, red = S.ui.reduced;
  if (sc === 'fish') return true;
  if (sc === 'title') return !red;
  if (sc === 'map') return !!(S.day && (S.day.run || (!red && (S.day.eagle || st.sel || gl3d())) || st.demWait || GFX.loading));
  if (sc === 'weighin') return !!(ui.UI.wi && !ui.UI.wi.done) || !red;
  if (sc === 'results') return winning() && !red;
  return fxBusy();
}
function frame(now) {
  st.raf = 0;
  let dt = Math.max(0, Math.min(0.25, (now - st.last) / 1000)); st.last = now; // rAF stamps can precede the kick time
  if (st.frozen != null) dt = 0;
  if (!G.paused) {
    st.acc += dt; let n = 0;
    while (st.acc >= TICK && n < 15) { tick(TICK); st.acc -= TICK; n++; } // keeps wall-clock pace down to ~4 fps
    if (n === 15) st.acc = 0;
  }
  st.t += dt;
  frameTiming(dt * 1000);
  render(dt);
  if (wantsFrames()) st.raf = requestAnimationFrame(frame);
}

function tick(dt) {
  const S = G.S;
  if (S.scene === 'map' && S.day && S.day.run) {
    const r = S.day.run; r.t += dt / (S.ui.reduced ? 0.15 : r.dur);
    if (r.t >= 1) { r.t = 1; game.finishRun(); stopMotor(); afterAction(); }
  }
  if (S.scene === 'fish' && S.fish && !S.ui.modal) {
    const before = S.fish.phase;
    fishing.tickFish(dt);
    const F = S.fish;
    if (F) {
      if (F.phase === 'fight' && F.fight) setDrag(F.fight.tension, true); else stopDrag();
      if (F.reel && (F.phase === 'retrieve' || F.phase === 'fight') && Math.random() < 0.25) sfx.reel();
      if (before !== F.phase) { ui.renderFishbar(); statusHint(); }
    }
  }
  if (S.scene === 'weighin' && ui.UI.wi && !ui.UI.wi.done) {
    const wi = ui.UI.wi; wi.t += dt;
    if (wi.t >= 0.55) { wi.t = 0; advanceWeigh(); }
  }
}

function render(dt) {
  const S = G.S, sc = S.scene;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  if (sc === 'map' && S.day) drawMapScene(dt);
  else if (sc === 'fish' && S.fish && gl3dSpot()) {
    const D = S.day;
    const uw = S.settings.uwcam === false ? null : L.wide ? { x: L.R.x + 14, y: L.R.y + L.R.h - 190, w: 270, h: 176 } : { x: L.R.x + 8, y: L.R.y + L.R.h - 122, w: 168, h: 112 };
    renderSpot3D({ lakeId: D.lake, spotId: S.fish.spot, month: D.month, clock: D.clock, weather: D.weather, R: L.R, W: L.W, H: L.H, dt, reduced: S.ui.reduced, fish: S.fish, gen: game.generating(), underwater: uw });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    drawSpot(ctx, L.R, L.SR, dt, { dpr: L.dpr, reduced: S.ui.reduced, overlay: { project: spotToScreen, underwater: underwaterRect() } });
  }
  else if (sc === 'fish' && S.fish) { ctx.fillStyle = '#0E2233'; ctx.fillRect(0, 0, L.W, L.H); drawSpot(ctx, L.R, L.SR, dt, { dpr: L.dpr, reduced: S.ui.reduced }); }
  else if (sc === 'weighin' || sc === 'results') { drawWeighIn(ctx, L.W, L.H, st.t, S.ui.reduced); if (sc === 'results' && winning()) confetti(); }
  else drawTitle(ctx, L.W, L.H, st.t, S.ui.reduced || sc !== 'title');
  if (sc === 'fish' && S.fish && S.fish.phase === 'fight') statusHint();
  if (sc === 'map' || sc === 'fish') {
    const h = JSON.stringify([S.day && S.day.clock, S.day && S.day.livewell.length, S.fish && S.fish.phase]);
    if (h !== st.lastHUD) { st.lastHUD = h; ui.renderHUD(); if (sc === 'map') ui.renderMapbar(); }
  }
}

// ---------- map ----------
const GLYPH = { cove: 'V', flat: 'F', docks: 'D', point: 'P', brush: 'B', grass: 'G', channel: 'C', riprap: 'R', tailrace: 'T', creek: 'K', island: 'I', open: 'O', ramp: '⚓' };
// 3D is used for the lake when three.js is up and the lake's terrain is decoded
const gl3d = () => glActive() && G.S.day && mapReady(G.S.day.lake);
const gl3dSpot = () => glActive() && G.S.day && mapReady(G.S.day.lake);
function drawMapScene(dt) {
  const S = G.S, D = S.day, Lk = getLake(D.lake);
  if (!demHeights(D.lake) && !st.demWait) { st.demWait = true; loadDem(D.lake).then(() => { st.demWait = false; L.mapKey = ''; kick(); }); }
  let v = L.view;
  const three = gl3d();
  if (three) {
    let bx = D.boat.x, by = D.boat.y, ang = D.boat.ang || 0;
    if (D.run) { const t = S.ui.reduced ? D.run.t : easeIO(D.run.t); const p = pathPoint(D.run.path, t); bx = p.x; by = p.y; ang = p.ang; }
    renderMap3D({ lakeId: D.lake, month: D.month, clock: D.clock, weather: D.weather, rect: L.view.rect, portrait: L.portrait, W: L.W, H: L.H, dt, reduced: S.ui.reduced, boat: { x: bx, y: by, ang }, run: D.run });
    st.glDrawn = D.lake;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    // overlay positions come from the 3D camera; landmarks sit on the terrain
    v = { ...L.view, toS: (x, y) => projectMap(x, y), ang: (a) => (L.portrait ? a + Math.PI / 2 : a), s: mapScalePx() };
  } else {
    const key = `${D.lake}|${L.W}x${L.H}|${L.dpr}|${D.month}|${L.portrait}|${!!demHeights(D.lake)}`;
    if (L.mapKey !== key) { L.map = renderMap(Lk, v, L.dpr, D.month, L.W, L.H); L.mapKey = key; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.map, 0, 0); ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  }
  const night = isNight(D.clock, D.month);
  if (night) { ctx.fillStyle = 'rgba(10,16,40,0.42)'; ctx.fillRect(0, 0, L.W, L.H); }
  // Garvan Holiday Lights after dark (mid-Nov–Dec)
  if (D.lake === 'hamilton' && (D.month === 12 || D.month === 11) && D.clock > D.sun.set) {
    const lm = Lk.def.landmarks.find((x) => x.id === 'garvan'); const r = makeRng(9);
    for (let i = 0; i < 120; i++) { const [x, y] = v.toS(lm.x + r.range(-60, 60), lm.y - 50 + r.range(-40, 50)); ctx.fillStyle = r.pick(['#F2A541', '#FF5A5A', '#4FC3FF', '#F6F3EC', '#5FD38A']); ctx.globalAlpha = S.ui.reduced ? 0.9 : 0.5 + 0.5 * Math.sin(st.t * 3 + i); ctx.fillRect(x, y, 2.5, 2.5); }
    ctx.globalAlpha = 1;
  }
  const pts = []; const labels = [];
  const sp = (p) => v.toS(p.x, p.y);
  // island markers
  ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const m of Lk.markers) { const [x, y] = sp(m); ctx.fillStyle = '#F6F3EC'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#14283A'; ctx.fillText(String(m.n), x, y + 0.5); }
  // landmarks
  for (const lm of Lk.def.landmarks) {
    const [x, y] = three ? projectMap(lm.x, lm.y, mapHeight(lm.x, lm.y)) : v.toS(lm.x, lm.y);
    pts.push({ id: 'lm:' + lm.id, x, y, r: 20 });
    ctx.fillStyle = '#5B4632'; ctx.strokeStyle = '#EDE3C8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(x - 7, y - 7, 14, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EDE3C8'; ctx.font = '700 9px system-ui, sans-serif'; ctx.fillText({ dam: '≡', park: '▲', house: '⌂', garden: '✿', hatchery: 'H', creek: '~', town: '•', crystal: '◇' }[lm.kind] || 'i', x, y + 0.5);
    if (L.wide || st.sel === 'lm:' + lm.id) labels.push({ text: lm.label, x, y, dy: 18, fg: '#EDE3C8', bg: 'rgba(62,53,40,0.85)', pri: st.sel === 'lm:' + lm.id ? 9 : 1 });
  }
  // eagle
  if (D.eagle) { const e = Lk.spot(D.eagle.spot); const [x, y] = sp(e); const a = S.ui.reduced ? 0 : st.t * 0.8; eagleIcon(x + Math.cos(a) * 26, y - 20 + Math.sin(a) * 10); }
  // spots
  const visible = Lk.allPoints().filter((p) => p.id === 'ramp' || D.spots[p.id].revealed);
  for (const p of visible) {
    const [x, y] = sp(p); pts.push({ id: p.id, x, y, r: L.wide ? 22 : 26 });
    const sel = st.sel === p.id;
    const isRamp = p.id === 'ramp';
    const closed = p.type === 'tailrace' && game.generating();
    ctx.fillStyle = isRamp ? '#9C7A55' : closed ? '#9A2A1C' : p.hidden ? '#5C7A3A' : '#F2A541';
    ctx.strokeStyle = '#14283A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, sel ? 14 : 12, 0, 7); ctx.fill(); ctx.stroke();
    pinIcon(p.type, x, y, isRamp || p.hidden || closed ? '#F6F3EC' : '#14283A');
    if (sel) { ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    if (L.wide || sel || isRamp) labels.push({ text: isRamp ? Lk.ramp.name : p.name, x, y, dy: L.portrait ? -24 : 24, fg: '#F6F3EC', bg: 'rgba(14,34,51,0.82)', pri: sel ? 10 : isRamp ? 4 : 3 });
  }
  placeLabels(labels, pts);
  // selection route preview
  if (st.sel && !st.sel.startsWith('lm:') && !D.run && st.sel !== D.boat.at) {
    const to = Lk.spot(st.sel); if (to) { const r = game.runMinutes(D.boat, to); void r; }
  }
  // boat (running or parked)
  let bx = D.boat.x, by = D.boat.y, ang = D.boat.ang || 0;
  if (D.run) {
    const t = S.ui.reduced ? D.run.t : easeIO(D.run.t); const p = pathPoint(D.run.path, t); bx = p.x; by = p.y; ang = p.ang; D.boat.ang = ang;
    if (three) { // dashed route drawn through projected points, densified so it follows the water in perspective
      ctx.strokeStyle = 'rgba(246,243,236,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath();
      for (let k = 0; k <= 60; k++) { const q = pathPoint(D.run.path, k / 60); const [qx, qy] = v.toS(q.x, q.y); k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); }
      ctx.stroke(); ctx.setLineDash([]);
    } else {
    ctx.strokeStyle = 'rgba(246,243,236,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath();
    D.run.path.pts.forEach((q, i) => { const [x, y] = v.toS(q[0], q[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    }
    if (!three) { const [wx, wy] = v.toS(bx, by); ctx.strokeStyle = 'rgba(246,243,236,0.6)'; ctx.lineWidth = 2; const sa = v.ang(ang);
      ctx.beginPath(); ctx.moveTo(wx - Math.cos(sa - 0.35) * 30, wy - Math.sin(sa - 0.35) * 30); ctx.lineTo(wx, wy); ctx.lineTo(wx - Math.cos(sa + 0.35) * 30, wy - Math.sin(sa + 0.35) * 30); ctx.stroke(); }
  }
  const [x, y] = v.toS(bx, by);
  if (!three) drawBoat(ctx, x, y, v.ang(ang), L.wide ? 26 : 22);
  else { // at map scale a real-size boat is a pixel: mark it with the boat icon (heading from the projected route)
    const [hx, hy] = v.toS(bx + Math.cos(ang) * 4, by + Math.sin(ang) * 4); const sa = Math.atan2(hy - y, hx - x);
    if (!D.run) { ctx.fillStyle = 'rgba(14,34,51,0.55)'; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill(); }
    drawBoat(ctx, x, y, sa, L.wide ? 30 : 26);
  }
  // compass and scale
  compass(L.W - 34, L.hud + 34, v.portrait);
  const mi = 1000 / Lk.miles * v.s; ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 3; const sx = 16, sy = L.H - (L.wide ? 76 : 78);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + mi, sy); ctx.stroke(); ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'left'; label('1 mile', sx + mi / 2, sy - 10, '#F6F3EC', 'rgba(14,34,51,0.75)');
  ctx.textAlign = 'center';
  L.pts = pts;
}
// Cover-type pictograms inside the map pins (shape, not just colour or a letter).
function pinIcon(type, x, y, col) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const L = (pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke(); };
  switch (type) {
    case 'docks': L([[-6, -1], [0, -6], [6, -1]]); ctx.fillRect(-4.5, -1, 9, 1.8); L([[-3.5, 1], [-3.5, 5]]); L([[3.5, 1], [3.5, 5]]); break;
    case 'brush': L([[0, 5], [0, -5]]); L([[0, 1], [-5, -3]]); L([[0, 1], [5, -3]]); L([[0, -2], [-3, -6]]); L([[0, -2], [3, -6]]); break;
    case 'point': ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(0, -5); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill(); break;
    case 'grass': for (const dx of [-4, 0, 4]) L([[dx, 5], [dx + (dx ? dx * 0.4 : 0), -4]]); break;
    case 'riprap': case 'tailrace': for (const [a, b, r] of [[-3, 2, 2.6], [3, 2, 2.6], [0, -2.5, 2.6]]) { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); } if (type === 'tailrace') { ctx.strokeStyle = col; L([[-6, 6], [6, 6]]); } break;
    case 'channel': L([[-6, -3], [-1, -3], [-1, 3], [6, 3]]); break;
    case 'cove': ctx.beginPath(); ctx.arc(0, -1, 5, 0, Math.PI); ctx.stroke(); L([[-5, -1], [-5, -5]]); L([[5, -1], [5, -5]]); break;
    case 'flat': L([[-6, -2], [6, -2]]); L([[-6, 2], [6, 2]]); break;
    case 'creek': L([[-6, -4], [-2, -1], [2, -3], [6, 1]]); L([[-6, 2], [-2, 5], [2, 3], [6, 6]]); break;
    case 'island': ctx.beginPath(); ctx.ellipse(0, 3, 6, 2.2, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(0, -6); ctx.lineTo(3, 2); ctx.closePath(); ctx.fill(); break;
    case 'open': ctx.beginPath(); ctx.arc(0, 3, 5.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 6, 5.5, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); break;
    case 'ramp': ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚓', 0, 0.5); break;
    default: ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(GLYPH[type] || '?', 0, 0.5);
  }
  ctx.restore();
}
function winning() { const E = G.S.event; return !!(E && E.outcome && (E.outcome.champion || E.outcome.rank === 1)); }
const CONF = ['#F2A541', '#B5568F', '#4C8FA8', '#F6F3EC', '#5FD38A', '#C8452B'];
function confetti() {
  const red = G.S.ui.reduced, t = st.frozen != null ? st.frozen / 1000 : st.t;
  for (let i = 0; i < 110; i++) {
    const x = ((i * 97.3) % L.W) + (red ? 0 : Math.sin(t * 1.7 + i) * 18);
    const y = red ? ((i * 53.7) % L.H) : ((t * (60 + (i % 7) * 12) + i * 37) % (L.H + 40)) - 20;
    ctx.save(); ctx.translate(x, y); ctx.rotate(red ? i : t * 3 + i); ctx.fillStyle = CONF[i % CONF.length]; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
  }
}
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
// Greedy label placement: highest priority first; each label tries below, above, right and left of its pin and is
// dropped if every slot overlaps a placed label or another pin (the selected spot's label always draws).
function placeLabels(list, pins) {
  ctx.font = '600 12px system-ui, sans-serif';
  const boxes = pins.map((p) => ({ x0: p.x - 11, y0: p.y - 11, x1: p.x + 11, y1: p.y + 11, pin: p }));
  const hit = (b, own) => boxes.some((o) => (!own || o.pin !== own) && b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  list.sort((a, b) => b.pri - a.pri);
  for (const l of list) {
    const w = ctx.measureText(l.text).width + 10; const own = pins.find((p) => Math.abs(p.x - l.x) < 0.5 && Math.abs(p.y - l.y) < 0.5);
    const slots = [[0, l.dy], [0, -l.dy], [w / 2 + 16, 0], [-w / 2 - 16, 0]];
    let placed = false;
    for (const [dx, dy] of slots) {
      const cx = clamp(l.x + dx, w / 2 + 2, L.W - w / 2 - 2), cy = l.y + dy; const b = { x0: cx - w / 2, y0: cy - 9, x1: cx + w / 2, y1: cy + 9 };
      if (!hit(b, own) || l.pri >= 9) { boxes.push(b); label(l.text, cx, cy, l.fg, l.bg); placed = true; break; }
    }
    void placed;
  }
}
function label(text, x, y, fg, bg) {
  ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 10; x = clamp(x, w / 2 + 2, L.W - w / 2 - 2);
  ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - 9, w, 18); ctx.fillStyle = fg; ctx.fillText(text, x, y + 0.5);
}
function compass(x, y, portrait) {
  ctx.save(); ctx.translate(x, y); if (portrait) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(14,34,51,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
  ctx.fillStyle = '#F2A541'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(6, 2); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  // the letter stays upright, placed behind the arrow (so a rotated map doesn't turn "N" into "z")
  ctx.fillStyle = '#F6F3EC'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', x + (portrait ? -12 : 0), y + (portrait ? 0 : 11)); ctx.textBaseline = 'alphabetic';
}
function eagleIcon(x, y) { ctx.save(); ctx.translate(x, y); ctx.scale(1.6, 1.6); ctx.strokeStyle = 'rgba(246,243,236,0.85)'; ctx.lineWidth = 1.2; ctx.fillStyle = '#2B2A27'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-7, -6, 0, 0); ctx.quadraticCurveTo(7, -6, 14, 0); ctx.quadraticCurveTo(0, 3, -14, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#F6F3EC'; ctx.beginPath(); ctx.arc(0, -1.5, 2.2, 0, 7); ctx.fill(); ctx.restore(); }

function selectPoint(id, open = true) {
  st.sel = id; ui.UI.cardFor = open ? id : null; ui.renderCard(); kick();
  if (open) setTimeout(() => { const b = document.querySelector('#card .btn.primary, #card .btn'); if (b && document.activeElement !== cv) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
}
function mapPick(sx, sy) {
  let best = null, bd = 1e9;
  for (const p of L.pts) { const d = Math.hypot(p.x - sx, p.y - sy); if (d < p.r && d < bd) { bd = d; best = p; } }
  if (best) { sfx.click(); selectPoint(best.id); } else { selectPoint(null, false); }
}

// ---------- scene changes ----------
function goScene(name) {
  const S = G.S;
  ui.closeModal();
  if ((name === 'map' || name === 'fish' || name === 'briefing' || name === 'weighin' || name === 'results') && !S.event) name = 'title';
  if (name === 'fish' && !S.fish) name = 'map';
  if (['help', 'settings', 'journal'].includes(name) && !['help', 'settings', 'journal'].includes(S.scene)) st.back = S.scene;
  if (S.scene !== name && !['help', 'settings', 'journal'].includes(name)) ui.clearToast();
  S.scene = name;
  if (name !== 'fish') stopDrag();
  ui.renderScene(); if (name === 'journal') ui.paintJournal();
  statusHint(); kick();
}
function back() { goScene(st.back && st.back !== G.S.scene ? st.back : 'title'); }

function newGame(o = {}) {
  const S = G.S;
  if (o.seed != null) G.rng.state = o.seed;
  ui.closeModal(); S.fish = null; st.sel = null; ui.UI.cardFor = null; ui.UI.wi = null; S.resume = null;
  game.startEvent({ mode: o.mode, chapter: o.mode === 'campaign' ? (o.chapter || 'ch1') : o.chapter, lake: o.lake, month: o.month, tier: o.tier, seed: o.seed, weather: o.weather, hour: o.hour });
  if (o.start && !S.day.snow) launch(); else goScene('briefing');
  return S.event.name;
}
function launch() { const S = G.S; S.scene = 'map'; st.sel = null; ui.UI.cardFor = null; goScene('map'); save(); }

function afterAction() {
  const S = G.S;
  if (S.scene === 'map') { ui.renderCard(); ui.renderHUD(); ui.renderMapbar(); }
  if (game.timeUp() && S.day && !S.day.done && !TIERS[S.event.tier].free) { ui.toast('Check-in time! Running back to the ramp.'); doEndDay(); }
  else if (game.timeUp() && S.day && !S.day.done) { ui.toast('Dark: time to call it a day.'); doEndDay(); }
}

function doEndDay() {
  const S = G.S; if (!S.day || S.day.done) return;
  ui.closeModal(); S.fish = null; stopDrag();
  game.endDay();
  ui.UI.wi = { step: 0, t: 0, done: false };
  if (S.ui.reduced) finishWeigh();
  goScene('weighin');
}
function advanceWeigh() {
  const S = G.S, wi = ui.UI.wi, res = S.event.results[S.event.day - 1];
  wi.step++;
  if (wi.step <= res.player.fish.length) sfx.tick();
  else if (wi.step === res.player.fish.length + 1) sfx.fanfare();
  else { wi.done = true; wi.step = 99; const st2 = TIERS[S.event.tier].free ? null : game.standings(); if (st2 && st2.me.rank <= 3) sfx.cheer(); }
  ui.renderScene(); if (wi.done) ui.focusScene();
}
function finishWeigh() { if (ui.UI.wi) { ui.UI.wi.done = true; ui.UI.wi.step = 99; } ui.renderScene(); if (G.S.scene === 'weighin') ui.focusScene(); }

// ---------- bus: sounds, toasts, scene glue ----------
game.bus.on((type, d) => {
  const S = G.S;
  switch (type) {
    case 'cast': sfx.cast(); break;
    case 'splash': sfx.plop(); addRipple(d.x, d.y); splash3D(d.x, d.y, false); break;
    case 'bite': sfx.bite(); ui.announce('Bite! Set the hook.'); if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* ignore */ } break;
    case 'hooked': sfx.hook(); ui.announce(`Fish on! Keep the tension in the good zone.`); break;
    case 'jump': sfx.splash(); { const F = S.fish; if (F && F.fight) { addRipple(F.fight.x, F.fight.y, true); const [x, y] = [L.R.x + F.fight.x * L.R.w, L.R.y + F.fight.y * L.R.h]; if (!S.ui.reduced) for (let i = 0; i < 14; i++) FX.drops.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 260, t: 0 }); } ui.announce('It jumped! Ease off but stay tight.'); } break;
    case 'lost': sfx[d === 'snap' ? 'snap' : 'lost'](); break;
    case 'landed': sfx.catch(); st.catchT = setTimeout(() => { if (G.S.fish && G.S.fish.phase === 'landed') ui.catchCard(d); }, S.ui.reduced ? 0 : 450); ui.announce(`Landed a ${SPECIES[d.sp].name}, ${fmtW(d.w)}.`); break;
    case 'snag': sfx.lost(); break;
    case 'say': ui.status(d); break;
    case 'partner': ui.toast(`${S.event.partner.name} boated a ${fmtW(d.fish.w, S.settings.units)} ${SPECIES[d.fish.sp].name.toLowerCase()}${d.res.ok ? '' : ' (released: yours are bigger)'}.`); break;
    case 'reveal': ui.toast(`Sonar: ${d.length === 1 ? 'a brush pile' : d.length + ' brush piles'} marked on your map.`); break;
    case 'warn': sfx.warn(); ui.toast(`Check-in soon: ${Math.max(0, d)} minutes to spare after the run home.`, 3500); break;
    case 'generation': sfx.siren(); game.journalEvent('generation'); if (S.scene === 'fish') { S.fish = null; goScene('map'); } ui.toast('Siren! Carpenter Dam is generating: leave the tailrace.', 4000); ui.announce(EVENT_TEXT.generation); break;
    case 'jelly': ui.toast('A harmless freshwater jellyfish drifts past (journal).', 3500); break;
    case 'lights': ui.toast('Garvan Holiday Lights glow across the water (journal).', 3500); break;
    case 'timeup': if (S.scene === 'fish' && S.fish && ['aim', 'back', 'lost', 'snag'].includes(S.fish.phase) && !S.ui.modal) afterAction(); break;
    case 'arrived': if (S.day.eagle && S.day.eagle.spot === d.id) { game.journalEvent('eagle'); ui.toast('A bald eagle circles here: baitfish below.'); } break;
    default: break;
  }
  if (['bite', 'hooked', 'ready', 'cast', 'splash', 'back', 'resolved'].includes(type)) { statusHint(); ui.renderFishbar(); }
});

function statusHint() {
  const S = G.S, F = S.fish;
  if (S.scene !== 'fish' || !F) { ui.status(''); return; }
  if (F.msg) { ui.status(F.msg); return; }
  if (F.phase === 'fight' && F.fight) { const f = F.fight; ui.status(f.jump > 0 ? 'JUMP! Ease off but stay tight.' : f.surge > 0 ? "It's running! Ease off the reel." : f.tension > 0.85 ? 'Too much tension: let go of the reel!' : f.tension < 0.15 ? 'Slack line: reel!' : `Pull the rod ${f.heading >= 0 ? 'left' : 'right'}, against the fish.`); return; }
  const t = { aim: 'Press and hold on the water, release when the ring is tightest.', flight: '', retrieve: 'Hold to reel; let go to pause. A quick tap (or Enter) twitches the lure.', bite: 'BITE! Tap to set the hook!', fight: 'Keep the marker in GOOD. Pull the rod against the arrow.', landed: '', lost: '', snag: '', back: '' }[F.phase];
  ui.status(t || '');
}

// ---------- DOM actions ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act; sfx.click(); doAct(a, b.dataset);
});
document.addEventListener('input', (e) => {
  const el = e.target; if (el.dataset && el.dataset.set === 'volume') { G.S.settings.volume = +el.value; applySettings(); save(); }
});
function doAct(a, ds = {}) {
  const S = G.S;
  switch (a) {
    case 'go': goScene(ds.to); break;
    case 'back': back(); break;
    case 'setup': ui.UI.setup = { mode: ds.mode, lake: 'hamilton', month: 5, tier: 'regional', ...(ui.UI.setup && ui.UI.setup.mode === ds.mode ? ui.UI.setup : {}) }; ui.UI.setup.mode = ds.mode; goScene('setup'); break;
    case 'pick': ui.UI.setup[ds.k] = ds.k === 'month' ? +ds.v : ds.v; ui.renderScene(); break;
    case 'startSetup': { const o = ui.UI.setup; newGame({ mode: o.mode, lake: o.lake, month: o.month, tier: o.tier }); break; }
    case 'play': newGame({ mode: 'campaign', chapter: ds.ch }); break;
    case 'resume': S.event = S.resume.event; S.day = S.resume.day; S.day.run = null; S.resume = null; S.fish = null; launch(); break;
    case 'launch': launch(); break;
    case 'snowDelay': game.journalEvent('snow'); game.snowDelay(); goScene('briefing'); break;
    case 'quit': S.event = null; S.day = null; S.fish = null; save(); goScene('title'); break;
    case 'runTo': if (game.beginRun(ds.id)) { startMotor(); ui.UI.cardFor = null; ui.renderCard(); kick(); } break;
    case 'fishHere': { if (S.scene !== 'map' || !S.day || S.day.done) break; const sp = getLake(S.day.lake).spot(S.day.boat.at); const c = game.canFish(sp.id); if (!c.ok) { ui.toast(c.why); break; } fishing.enterSpot(sp); FX.line.init = false; ui.UI.cardFor = null; st.sel = null; goScene('fish'); break; }
    case 'closeCard': selectPoint(null, false); try { cv.focus({ preventScroll: true }); } catch (e) { /* ignore */ } break;
    case 'scan': { const f = game.scan(); if (!f.length) ui.toast('Sonar scan: nothing new here.'); afterAction(); break; }
    case 'endDay': ui.closeModal(); doEndDay(); break;
    case 'leave': if (S.fish && ['aim', 'back'].includes(S.fish.phase)) { S.fish = null; goScene('map'); afterAction(); } break;
    case 'speed': if (S.fish) { S.fish.speed = ds.v; ui.renderFishbar(); } break;
    case 'lureMenu': ui.lureMenu(); break;
    case 'pickLure': fishing.setLure(ds.id, ds.c); ui.lureMenu(); ui.renderFishbar(); break;
    case 'closeModal': ui.closeModal(); kick(); break;
    case 'keep': case 'release': { clearTimeout(st.catchT); const r = fishing.resolveCatch(a === 'keep'); ui.closeModal(); ui.renderFishbar(); statusHint(); if (r && r.cull) ui.toast(`Culled a ${fmtW(r.cull.w, S.settings.units)} fish.`); kick(); afterAction(); break; }
    case 'skipWeigh': finishWeigh(); break;
    case 'nextDay': game.nextDay(); ui.UI.wi = null; goScene('briefing'); break;
    case 'finish': { const o = game.finishEvent(); goScene('results'); if (o.champion || o.rank === 1) sfx.cheer(); if (o.stockChoice) stockModal(); break; }
    case 'again': { const E = S.event; newGame({ mode: E.kind, lake: E.lake, month: E.month, tier: E.tier }); break; }
    case 'buy': if (game.buy(ds.id)) ui.toast('Bought!'); ui.renderScene(); break;
    case 'stock': game.stock(ds.v === 'yes'); ui.closeModal(); ui.renderScene(); ui.toast(ds.v === 'yes' ? 'Thanks: more stripers for Lake Ouachita.' : 'You kept the money.'); break;
    case 'jtab': ui.UI.journalTab = ds.v; ui.renderScene(); ui.paintJournal(); break;
    case 'set': {
      const s = S.settings; const k = ds.k;
      if (ds.v == null) s[k] = !s[k]; else s[k] = k === 'textScale' ? +ds.v : ds.v;
      applySettings(); save(); ui.renderScene(); L.mapKey = ''; kick(); break;
    }
    case 'pause': ui.pauseMenu(); break;
    case 'mute': S.settings.sound = !S.settings.sound; applySettings(); save(); ui.toast(S.settings.sound ? 'Sound on' : 'Sound off'); updateSoundBtn(); break;
    default: break;
  }
}
function stockModal() {
  ui.showModal(`<h2>Lake Ouachita striper fund</h2><p>Lake Ouachita's striped bass don't reproduce there; they are stocked every year. Chip in $1,500 of your winnings to the stocking fund before the championship?</p><p class="sm">Game effect: about 80% more stripers on Ouachita for the rest of your campaign. Stripers don't count in a bass bag, but they're great fun.</p>
    <div class="row center"><button class="btn primary" data-act="stock" data-v="yes" ${G.S.profile.money < 1500 ? 'disabled' : ''}>Chip in $1,500</button><button class="btn" data-act="stock" data-v="no">Keep the money</button></div>`, 'stock');
}
function updateSoundBtn() { const b = document.getElementById('btn-sound'); if (b) { b.setAttribute('aria-label', G.S.settings.sound ? 'Mute sound (M)' : 'Unmute sound (M)'); b.classList.toggle('off', !G.S.settings.sound); } }
updateSoundBtn();
document.getElementById('btn-menu').addEventListener('click', () => doAct('pause'));
document.getElementById('btn-help').addEventListener('click', () => doAct('go', { to: 'help' }));
document.getElementById('btn-sound').addEventListener('click', () => doAct('mute'));

// ---------- pointer input ----------
const toLocal = (px, py) => (gl3dSpot() ? (screenToSpot(px, py) || { x: -1, y: -1 }) : { x: (px - L.R.x) / L.R.w, y: (py - L.R.y) / L.R.h });
function pDown(px, py, fromButton, at = performance.now()) {
  const S = G.S, F = S.fish; if (!F || S.ui.modal) return;
  if (F.phase === 'aim') { if (!fromButton) { const p = toLocal(px, py); if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return; fishing.aimAt(p.x, p.y); } fishing.beginCharge(true, at); }
  else if (F.phase === 'bite') fishing.setHook();
  else if (F.phase === 'retrieve' || F.phase === 'fight') { F.reel = true; st.downAt = performance.now(); if (F.phase === 'fight' && !fromButton) rodFrom(px); }
  ui.renderFishbar(); statusHint(); kick();
}
function pMove(px, py) {
  const S = G.S, F = S.fish; if (!F) return;
  if (F.phase === 'aim' && F.charge != null) { const p = toLocal(px, py); fishing.aimAt(p.x, p.y); }
  if (F.phase === 'fight' && F.reel) rodFrom(px);
}
function pUp(at = performance.now()) {
  const S = G.S, F = S.fish; if (!F) return;
  if (F.phase === 'aim' && F.charge != null) fishing.releaseCharge(at);
  const quick = F.phase === 'retrieve' && st.downAt && performance.now() - st.downAt < 170; st.downAt = 0;
  F.reel = false; if (F.phase === 'fight') fishing.setRod(0);
  if (quick) fishing.setHook(); // a quick tap twitches the lure
  ui.renderFishbar(); statusHint();
}
function rodFrom(px) { const c = L.R.x + L.R.w / 2; fishing.setRod((px - c) / (L.R.w * 0.3)); }

cv.addEventListener('pointerdown', (e) => {
  const S = G.S;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
  if (S.scene === 'map') { mapPick(e.clientX, e.clientY); return; }
  if (S.scene === 'fish') { e.preventDefault(); st.ptr = e.pointerId; pDown(e.clientX, e.clientY, false, e.timeStamp); }
});
cv.addEventListener('pointermove', (e) => { if (G.S.scene === 'fish' && st.ptr === e.pointerId) pMove(e.clientX, e.clientY); });
const up = (e) => { if (G.S.scene === 'fish' && st.ptr === e.pointerId) { st.ptr = null; pUp(e.timeStamp); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
// the big action button mirrors Space
const fishbar = document.getElementById('fishbar');
fishbar.addEventListener('pointerdown', (e) => { if (e.target.closest('#action')) { e.preventDefault(); st.btnPtr = e.pointerId; try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } pDown(0, 0, true, e.timeStamp); } });
fishbar.addEventListener('pointerup', (e) => { if (st.btnPtr === e.pointerId) { st.btnPtr = null; pUp(e.timeStamp); } });
fishbar.addEventListener('pointercancel', (e) => { if (st.btnPtr === e.pointerId) { st.btnPtr = null; pUp(); } });

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  const S = G.S; const k = e.key;
  if (k === 'Escape') {
    if (S.ui.modal) { if (S.ui.modal !== 'catch') { ui.closeModal(); kick(); } return; }
    if (S.scene === 'map' && ui.UI.cardFor) { selectPoint(null, false); return; }
    if (S.scene === 'fish' && S.fish && ['aim', 'back'].includes(S.fish.phase)) { doAct('leave'); return; }
    if (S.scene === 'map' || S.scene === 'fish') { ui.pauseMenu(); return; }
    if (['help', 'settings', 'journal'].includes(S.scene)) { back(); return; }
    return;
  }
  if (S.ui.modal) return;
  if ((k === 'm' || k === 'M') && !e.ctrlKey) { doAct('mute'); return; }
  if (k === '?' ) { doAct('go', { to: 'help' }); return; }
  if (S.scene === 'map') {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k) && (document.activeElement === cv || document.activeElement === document.body)) {
      e.preventDefault();
      const ids = L.pts.slice().sort((a, b) => a.x - b.x || a.y - b.y).map((p) => p.id);
      const i = ids.indexOf(st.sel); const n = (i + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1) + ids.length) % ids.length;
      st.sel = ids[n]; ui.UI.cardFor = ids[n]; ui.renderCard(); kick();
      return;
    }
    if (k === 'Enter' && document.activeElement === cv && st.sel) { selectPoint(st.sel); return; }
  }
  if (S.scene === 'fish' && S.fish) {
    const F = S.fish; const tag = document.activeElement && document.activeElement.tagName;
    if (k === ' ' || k === 'Spacebar') { if (tag === 'BUTTON' && document.activeElement.id !== 'action') return; e.preventDefault(); if (!e.repeat) pDown(0, 0, true, e.timeStamp); return; }
    if (k === 'Enter' && (F.phase === 'bite' || F.phase === 'retrieve')) { e.preventDefault(); fishing.setHook(); return; }
    if (k === 'l' || k === 'L') { ui.lureMenu(); return; }
    if (k === '1' || k === '2' || k === '3') { F.speed = ['slow', 'med', 'fast'][+k - 1]; ui.renderFishbar(); return; }
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (F.phase === 'aim') { const d = 0.03; fishing.aimAt(F.aim.x + (k === 'ArrowRight' ? d : k === 'ArrowLeft' ? -d : 0), F.aim.y + (k === 'ArrowDown' ? d : k === 'ArrowUp' ? -d : 0)); kick(); }
      else if (F.phase === 'fight') { if (k === 'ArrowLeft') fishing.setRod(-1); if (k === 'ArrowRight') fishing.setRod(1); }
    }
  }
});
window.addEventListener('keyup', (e) => {
  const S = G.S; if (S.scene !== 'fish' || !S.fish || S.ui.modal) return;
  if (e.key === ' ' || e.key === 'Spacebar') { const tag = document.activeElement && document.activeElement.tagName; if (tag === 'BUTTON' && document.activeElement.id !== 'action') return; e.preventDefault(); pUp(e.timeStamp); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') fishing.setRod(0);
});

// ---------- test hooks ----------
function snapshot() {
  const S = G.S;
  const s = clone({ scene: S.scene, settings: S.settings, profile: S.profile, event: S.event, day: S.day, fish: S.fish, ui: S.ui, resume: !!S.resume });
  s.storage = G.storage; s.paused = G.paused; s.rng = G.rng.state; s.looping = !!st.raf;
  s.gfx = { mode: GFX.mode, ready: GFX.ready, loading: GFX.loading, plates: PLATE_STATE.ready, tier: GFX.tier, gpu: GFX.gpu, error: GFX.error, map3d: !!(S.day && gl3d()), dbg: mapDebug(), spot: spotDebug(), fish3d: fishDebug() };
  s.ui.card = ui.UI.cardFor; s.ui.sel = st.sel; s.ui.wi = ui.UI.wi;
  if (S.day && S.event) {
    const bag = game.playerBag();
    s.derived = { bag: bag.total, raw: bag.raw, big: bag.big, limits: game.limits(), runHome: game.runHome(), generating: game.generating(), timeUp: game.timeUp(), status: document.getElementById('status').textContent };
  }
  return s;
}
function isIdle() {
  const S = G.S;
  if (st.frozen != null) return true;
  if (S.day && S.day.run) return false;
  if (S.scene === 'map' && st.demWait) return false;
  if ((S.scene === 'map' || S.scene === 'fish') && GFX.loading) return false;
  if (S.scene === 'map' && glActive() && S.day && st.glDrawn !== S.day.lake) return false;
  if (S.scene === 'weighin' && ui.UI.wi && !ui.UI.wi.done) return false;
  if (S.scene === 'fish' && S.fish && !G.paused) { const ph = S.fish.phase; if (['flight', 'bite', 'snag', 'lost', 'back'].includes(ph)) return false; if (ph === 'fight' || (ph === 'retrieve' && S.fish.reel)) return false; if (ph === 'landed' && !S.ui.modal) return false; }
  if (fxBusy() && !G.paused) return false;
  if (spotBusy() && !G.paused && S.scene === 'fish') return false;
  if (PLATE_STATE.loading) return false;
  if (S.scene === 'fish' && glActive() && S.day && !mapReady(S.day.lake)) return false;
  return true;
}
function rects() {
  const r = (sel) => { const el = document.querySelector(sel); if (!el || el.hidden) return null; const b = el.getBoundingClientRect(); return b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
  return { water: L.R, sonar: L.SR, points: L.pts.map((p) => ({ id: p.id, x: p.x, y: p.y })), action: r('#action'), card: r('#card'), mapbar: r('#mapbar'), portrait: L.portrait, wide: L.wide,
    toScreen: G.S.fish ? null : null };
}

window.__game = {
  seed(n) { G.rng.state = n >>> 0; return n; },
  getState: snapshot,
  setState(p) {
    const S = G.S;
    if (p.settings) { Object.assign(S.settings, p.settings); applySettings(); }
    if (p.profile) deepMerge(S.profile, p.profile);
    if (p.day && S.day) deepMerge(S.day, p.day);
    if (p.fish && S.fish) deepMerge(S.fish, p.fish);
    if (p.event && S.event) deepMerge(S.event, p.event);
    if (p.scene) S.scene = p.scene;
    L.mapKey = ''; ui.renderScene(); statusHint(); kick();
    return true;
  },
  isIdle,
  // the paused loop keeps drawing, so step() skips the (costly) 3D render and just advances the sim
  step(n = 1) { for (let i = 0; i < n; i++) tick(TICK); if (!glActive()) render(0); else kick(); return G.S.fish ? G.S.fish.phase : G.S.scene; },
  pause() { G.paused = true; st.pausedAt = performance.now(); return true; },
  resume() { if (G.paused && fishing.CHARGE.start != null && st.pausedAt) fishing.CHARGE.start += performance.now() - st.pausedAt; G.paused = false; kick(); return true; },
  scene(name) { goScene(name); return G.S.scene; },
  newGame,
  act(name, ...a) {
    const S = G.S;
    switch (name) {
      case 'start': launch(); return S.scene;
      case 'select': selectPoint(a[0]); return ui.UI.cardFor;
      case 'runTo': { const ok = game.beginRun(a[0]); kick(); return ok; }
      case 'fishHere': doAct('fishHere'); return S.scene;
      case 'leave': doAct('leave'); return S.scene;
      case 'scan': return game.scan();
      case 'lure': fishing.setLure(a[0], a[1]); ui.renderFishbar(); return S.fish && [S.fish.lure, S.fish.color];
      case 'speed': S.fish.speed = a[0]; ui.renderFishbar(); return a[0];
      case 'aim': fishing.aimAt(a[0], a[1]); kick(); return S.fish.aim;
      // hold time so far, for input tests on slow (software-rendered) machines: the real release event still decides
      case 'chargeAt': if (fishing.CHARGE.start != null) fishing.CHARGE.start = performance.now() - a[0] * 1000; return true;
      case 'charge': fishing.aimAt(a[0], a[1]); fishing.beginCharge(); S.fish.charge = a[2] ?? 0; kick(); return true;
      case 'cast': { const ok = fishing.cast(a[0], a[1], a[2] ?? 1); kick(); return ok; }
      case 'reel': if (S.fish) S.fish.reel = !!a[0]; ui.renderFishbar(); kick(); return true;
      case 'forceBite': return fishing.forceBite(a[0], a[1]);
      case 'setHook': return fishing.setHook();
      case 'rod': fishing.setRod(a[0]); return true;
      case 'land': fishing.land(); return S.fish && S.fish.catch;
      case 'keep': case 'release': doAct(name); return snapshot().day && G.S.day.livewell.length;
      case 'endDay': doEndDay(); return S.scene;
      case 'finishAnim': if (S.day && S.day.run) { S.day.run.t = 1; game.finishRun(); stopMotor(); afterAction(); } if (S.fish && S.fish.phase === 'flight') { S.fish.flight.t = S.fish.flight.dur; fishing.tickFish(0); } if (ui.UI.wi && !ui.UI.wi.done) finishWeigh(); FX.ripples = []; FX.drops = []; render(0); return true;
      case 'continue': if (S.scene === 'weighin') { if (S.event.day < S.event.days && !TIERS[S.event.tier].free) doAct('nextDay'); else doAct('finish'); } else if (S.scene === 'briefing') launch(); return S.scene;
      case 'buy': return game.buy(a[0]);
      case 'stock': doAct('stock', { v: a[0] ? 'yes' : 'no' }); return S.profile.stocking;
      case 'spend': game.spend(a[0], 'test'); afterAction(); return S.day.clock;
      case 'odds': return S.fish ? fishing.oddsHere(a[0] || {}) : null;
      case 'table': return biteTable(a[0]);
      case 'phase': return phaseOf(a[0], a[2] != null ? a[2] : waterTempBase(a[1]), a[1]);
      case 'waterTemp': return Math.round(waterTempBase(a[0]) * 10) / 10;
      case 'sun': return sunTimes(a[0]);
      case 'simField': {
        const o = a[0] || {}; const T = TIERS[o.tier]; const seeds = o.seeds || 100; let sum = 0;
        for (let s = 1; s <= seeds; s++) { const r = makeRng(s * 7919); const sk = Array.from({ length: T.field }, () => r.normal()); const tot = sk.map(() => 0); for (let d = 0; d < (T.days || 1); d++) sk.forEach((k, i) => { const b = fieldBag(r, o.lake, o.month, o.tier, k); tot[i] = T.derby ? Math.max(tot[i], b.total) : tot[i] + b.total; }); sum += Math.max(...tot); }
        return { mean: sum / seeds, target: T.target };
      }
      case 'layout': render(0); return rects(); // draw a frame first, so pins come from the current camera
      case 'geo': { // real-lake checks for tests: frame, water area, spots on water and routable, landmarks in lon/lat
        const Lk = getLake(a[0]); const g = Lk.geo; if (!g) return null; const [W, Sb, E, N] = g.frame.bbox;
        const ll = (p) => [W + p.x / 1000 * (E - W), N - p.y / 625 * (N - Sb)];
        let cells = 0; for (const v of Lk.mask) cells += v; const acres = cells * (Lk.grid.cell * Lk.mPerUnit) ** 2 / 4046.86;
        return { acres: Math.round(acres), mPerUnit: Lk.mPerUnit, miles: Lk.miles, bridges: g.bridges.length, creeks: g.creeks.map((c) => c.name), dams: g.dams.length, islands: g.islands.length,
          spots: Lk.allPoints().map((p) => { const r = p.id === 'ramp' ? null : route(Lk, Lk.ramp, p); return { id: p.id, type: p.type, water: Lk.water(p.x, p.y), shoreM: Math.round(Lk.shoreDist(p.x, p.y) * Lk.mPerUnit), routed: !!(r && r.pts.length >= 2 && r.miles > 0), miles: r ? Math.round(r.miles * 10) / 10 : 0 }; }),
          landmarks: Object.fromEntries(Lk.def.landmarks.map((l) => [l.id, ll(l)])), markers: Lk.markers.length };
      }
      case 'toScreen': if (S.scene === 'fish') render(0); return gl3dSpot() ? spotToScreen(a[0], a[1], a[2] || 0) : [L.R.x + a[0] * L.R.w, L.R.y + a[1] * L.R.h];
      case 'standings': return game.standings();
      case 'forceTie': { const E = S.event; const res = E.results[E.day - 1]; const a0 = E.field[0]; a0.days[E.day - 1] = { total: res.player.total, big: Math.max(0, res.player.big - 0.25), n: 5 }; ui.renderScene(); return game.standings(); }
      case 'animAt': st.frozen = a[0]; if (a[0] == null) { st.frozen = null; kick(); } return true;
      case 'names': return { names: ANGLERS.slice(), field: S.event ? S.event.field.map((f) => f.name) : [] };
      case 'species': return Object.keys(SPECIES);
      case 'keepInfo': return game.keepInfo(a[0]);
      case 'keepFish': return game.keepFish(a[0]);
      case 'weights': { const o = a[0]; const r = makeRng(o.seed || 5); let sum = 0, big = 0; for (let i = 0; i < o.n; i++) { const w = sampleWeight(r, o.sp, o.opts || {}); sum += w; if (w >= (o.big || 6.5)) big++; } return { mean: sum / o.n, bigShare: big / o.n }; }
      case 'weather': { const r = makeRng(a[2] || 1); return makeWeather(r, a[0], LAKES[a[1] || 'hamilton']); }
      case 'spotScene': { const sc = fishing.sceneFor(getLake(S.day.lake).spot(a[0] || S.fish.spot)); return { cover: sc.cover, shore: sc.shore, ledgeY: sc.ledgeY ?? null, shoreMid: sc.shoreY(0.5), bottom: [0.2, 0.4, 0.6, 0.8].map((y) => Math.round(sc.bottom(0.5, y) * 10) / 10) }; }
      case 'revealAll': for (const id in S.day.spots) S.day.spots[id].revealed = true; return true;
      case 'clear': try { localStorage.clear(); } catch (e) { /* ignore */ } G.S = freshState(); applySettings(); goScene('title'); return true;
      default: throw new Error('unknown act ' + name);
    }
  },
};
