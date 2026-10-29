// Entry: loop, layout, input, scene glue, map drawing and the window.__game hooks.
import { G, load, save, freshState } from './state.js';
import { LAKES, SPECIES, LURES, SPOT_TYPES, TIERS, CHAPTERS, ANGLERS, EVENT_TEXT } from './data.js';
import { getLake, makeView, renderMap, pathPoint } from './lakes.js';
import { clamp, deepMerge, clone, lerp, fmtW, fmtClock, makeRng } from './util.js';
import * as game from './game.js';
import * as fishing from './fishing.js';
import { drawSpot, FX, addRipple, fxBusy } from './fishview.js';
import { drawBoat, drawTitle, drawWeighIn } from './art.js';
import { sfx, setAudio, setDrag, stopDrag, startMotor, stopMotor } from './audio.js';
import { phaseOf, biteTable, fieldBag, isNight, waterTempBase, genAt, sunTimes, sampleWeight, makeWeather } from './sim.js';
import * as ui from './ui.js';

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
window.addEventListener('resize', () => { resize(); ui.renderScene(); kick(); });
mq && mq.addEventListener && mq.addEventListener('change', () => { applySettings(); ui.renderScene(); kick(); });
mqDark && mqDark.addEventListener && mqDark.addEventListener('change', () => { applySettings(); ui.renderScene(); });
ui.renderScene();
kick();

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
  if (sc === 'map') return !!(S.day && (S.day.run || (!red && (S.day.eagle || st.sel))));
  if (sc === 'weighin') return !!(ui.UI.wi && !ui.UI.wi.done) || !red;
  if (sc === 'results') return winning() && !red;
  return fxBusy();
}
function frame(now) {
  st.raf = 0;
  let dt = Math.min(0.1, (now - st.last) / 1000); st.last = now;
  if (st.frozen != null) dt = 0;
  if (!G.paused) {
    st.acc += dt; let n = 0;
    while (st.acc >= TICK && n < 5) { tick(TICK); st.acc -= TICK; n++; }
    if (n === 5) st.acc = 0;
  }
  st.t += dt;
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
function drawMapScene(dt) {
  const S = G.S, D = S.day, Lk = getLake(D.lake), v = L.view;
  const key = `${D.lake}|${L.W}x${L.H}|${L.dpr}|${D.month}|${L.portrait}`;
  if (L.mapKey !== key) { L.map = renderMap(Lk, v, L.dpr, D.month, L.W, L.H); L.mapKey = key; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.map, 0, 0); ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const night = isNight(D.clock, D.month);
  if (night) { ctx.fillStyle = 'rgba(10,16,40,0.42)'; ctx.fillRect(0, 0, L.W, L.H); }
  // Garvan Holiday Lights after dark (mid-Nov–Dec)
  if (D.lake === 'hamilton' && (D.month === 12 || D.month === 11) && D.clock > D.sun.set) {
    const lm = Lk.def.landmarks.find((x) => x.id === 'garvan'); const r = makeRng(9);
    for (let i = 0; i < 120; i++) { const [x, y] = v.toS(lm.x + r.range(-60, 60), lm.y - 50 + r.range(-40, 50)); ctx.fillStyle = r.pick(['#F2A541', '#FF5A5A', '#4FC3FF', '#F6F3EC', '#5FD38A']); ctx.globalAlpha = S.ui.reduced ? 0.9 : 0.5 + 0.5 * Math.sin(st.t * 3 + i); ctx.fillRect(x, y, 2.5, 2.5); }
    ctx.globalAlpha = 1;
  }
  const pts = [];
  const sp = (p) => v.toS(p.x, p.y);
  // island markers
  ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const m of Lk.markers) { const [x, y] = sp(m); ctx.fillStyle = '#F6F3EC'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#14283A'; ctx.fillText(String(m.n), x, y + 0.5); }
  // landmarks
  for (const lm of Lk.def.landmarks) {
    const [x, y] = v.toS(lm.x, lm.y);
    pts.push({ id: 'lm:' + lm.id, x, y, r: 20 });
    ctx.fillStyle = '#5B4632'; ctx.strokeStyle = '#EDE3C8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(x - 7, y - 7, 14, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EDE3C8'; ctx.font = '700 9px system-ui, sans-serif'; ctx.fillText({ dam: '≡', park: '▲', house: '⌂', garden: '✿', hatchery: 'H', creek: '~', town: '•', crystal: '◇' }[lm.kind] || 'i', x, y + 0.5);
    if (L.wide || st.sel === 'lm:' + lm.id) label(lm.label, x, y + 18, '#EDE3C8', 'rgba(62,53,40,0.85)');
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
    ctx.fillStyle = isRamp || p.hidden || closed ? '#F6F3EC' : '#14283A'; ctx.font = '800 12px system-ui, sans-serif'; ctx.fillText(GLYPH[p.type] || '?', x, y + 0.5);
    if (sel) { ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    if (L.wide || sel || isRamp) label(isRamp ? Lk.ramp.name : p.name, x, y + (L.portrait ? -24 : 24), '#F6F3EC', 'rgba(14,34,51,0.82)');
  }
  // selection route preview
  if (st.sel && !st.sel.startsWith('lm:') && !D.run && st.sel !== D.boat.at) {
    const to = Lk.spot(st.sel); if (to) { const r = game.runMinutes(D.boat, to); void r; }
  }
  // boat (running or parked)
  let bx = D.boat.x, by = D.boat.y, ang = D.boat.ang || 0;
  if (D.run) {
    const t = S.ui.reduced ? D.run.t : easeIO(D.run.t); const p = pathPoint(D.run.path, t); bx = p.x; by = p.y; ang = p.ang; D.boat.ang = ang;
    ctx.strokeStyle = 'rgba(246,243,236,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath();
    D.run.path.pts.forEach((q, i) => { const [x, y] = v.toS(q[0], q[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    const [wx, wy] = v.toS(bx, by); ctx.strokeStyle = 'rgba(246,243,236,0.6)'; ctx.lineWidth = 2; const sa = v.ang(ang);
    ctx.beginPath(); ctx.moveTo(wx - Math.cos(sa - 0.35) * 30, wy - Math.sin(sa - 0.35) * 30); ctx.lineTo(wx, wy); ctx.lineTo(wx - Math.cos(sa + 0.35) * 30, wy - Math.sin(sa + 0.35) * 30); ctx.stroke();
  }
  const [x, y] = v.toS(bx, by);
  drawBoat(ctx, x, y, v.ang(ang), L.wide ? 26 : 22);
  // compass and scale
  compass(L.W - 34, L.hud + 34, v.portrait);
  const mi = 1000 / Lk.def.miles * v.s; ctx.strokeStyle = '#F6F3EC'; ctx.lineWidth = 3; const sx = 16, sy = L.H - (L.wide ? 76 : 78);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + mi, sy); ctx.stroke(); ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'left'; label('1 mile', sx + mi / 2, sy - 10, '#F6F3EC', 'rgba(14,34,51,0.75)');
  ctx.textAlign = 'center';
  L.pts = pts;
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
function label(text, x, y, fg, bg) {
  ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 10; x = clamp(x, w / 2 + 2, L.W - w / 2 - 2);
  ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - 9, w, 18); ctx.fillStyle = fg; ctx.fillText(text, x, y + 0.5);
}
function compass(x, y, portrait) {
  ctx.save(); ctx.translate(x, y); if (portrait) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(14,34,51,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
  ctx.fillStyle = '#F2A541'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(6, 2); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F6F3EC'; ctx.font = '800 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 11);
  ctx.restore();
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
    case 'splash': sfx.plop(); addRipple(d.x, d.y); break;
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
    case 'fishHere': { const sp = getLake(S.day.lake).spot(S.day.boat.at); const c = game.canFish(sp.id); if (!c.ok) { ui.toast(c.why); break; } fishing.enterSpot(sp); FX.line.init = false; ui.UI.cardFor = null; st.sel = null; goScene('fish'); break; }
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
const toLocal = (px, py) => ({ x: (px - L.R.x) / L.R.w, y: (py - L.R.y) / L.R.h });
function pDown(px, py, fromButton) {
  const S = G.S, F = S.fish; if (!F || S.ui.modal) return;
  if (F.phase === 'aim') { if (!fromButton) { const p = toLocal(px, py); if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return; fishing.aimAt(p.x, p.y); } fishing.beginCharge(); }
  else if (F.phase === 'bite') fishing.setHook();
  else if (F.phase === 'retrieve' || F.phase === 'fight') { F.reel = true; st.downAt = performance.now(); if (F.phase === 'fight' && !fromButton) rodFrom(px); }
  ui.renderFishbar(); statusHint(); kick();
}
function pMove(px, py) {
  const S = G.S, F = S.fish; if (!F) return;
  if (F.phase === 'aim' && F.charge != null) { const p = toLocal(px, py); fishing.aimAt(p.x, p.y); }
  if (F.phase === 'fight' && F.reel) rodFrom(px);
}
function pUp() {
  const S = G.S, F = S.fish; if (!F) return;
  if (F.phase === 'aim' && F.charge != null) fishing.releaseCharge();
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
  if (S.scene === 'fish') { e.preventDefault(); st.ptr = e.pointerId; pDown(e.clientX, e.clientY, false); }
});
cv.addEventListener('pointermove', (e) => { if (G.S.scene === 'fish' && st.ptr === e.pointerId) pMove(e.clientX, e.clientY); });
const up = (e) => { if (G.S.scene === 'fish' && st.ptr === e.pointerId) { st.ptr = null; pUp(); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
// the big action button mirrors Space
const fishbar = document.getElementById('fishbar');
fishbar.addEventListener('pointerdown', (e) => { if (e.target.closest('#action')) { e.preventDefault(); st.btnPtr = e.pointerId; try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } pDown(0, 0, true); } });
fishbar.addEventListener('pointerup', (e) => { if (st.btnPtr === e.pointerId) { st.btnPtr = null; pUp(); } });
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
    if (k === ' ' || k === 'Spacebar') { if (tag === 'BUTTON' && document.activeElement.id !== 'action') return; e.preventDefault(); if (!e.repeat) pDown(0, 0, true); return; }
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
  if (e.key === ' ' || e.key === 'Spacebar') { const tag = document.activeElement && document.activeElement.tagName; if (tag === 'BUTTON' && document.activeElement.id !== 'action') return; e.preventDefault(); pUp(); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') fishing.setRod(0);
});

// ---------- test hooks ----------
function snapshot() {
  const S = G.S;
  const s = clone({ scene: S.scene, settings: S.settings, profile: S.profile, event: S.event, day: S.day, fish: S.fish, ui: S.ui, resume: !!S.resume });
  s.storage = G.storage; s.paused = G.paused; s.rng = G.rng.state; s.looping = !!st.raf;
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
  if (S.scene === 'weighin' && ui.UI.wi && !ui.UI.wi.done) return false;
  if (S.scene === 'fish' && S.fish && !G.paused) { const ph = S.fish.phase; if (['flight', 'bite', 'snag', 'lost', 'back'].includes(ph)) return false; if (ph === 'fight' || (ph === 'retrieve' && S.fish.reel)) return false; if (ph === 'landed' && !S.ui.modal) return false; }
  if (fxBusy() && !G.paused) return false;
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
  step(n = 1) { for (let i = 0; i < n; i++) tick(TICK); render(0); return snapshot().fish ? G.S.fish.phase : G.S.scene; },
  pause() { G.paused = true; return true; },
  resume() { G.paused = false; kick(); return true; },
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
      case 'layout': return rects();
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
