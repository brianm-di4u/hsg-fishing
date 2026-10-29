// Procedural art: fish by species parameters, boats, title and weigh-in backdrops. No images.
import { SPECIES } from './data.js';
import { makeRng, lerp } from './util.js';

const fishCache = new Map();

// Draw a fish centered at (x, y), length `len` px, facing right (dir 1) or left (-1). Cached per size/DPR.
export function drawFish(ctx, spId, x, y, len, opts = {}) {
  const dir = opts.dir ?? 1, dpr = opts.dpr || 1, rot = opts.rot || 0;
  const key = `${spId}|${Math.round(len)}|${dpr}`;
  let spr = fishCache.get(key);
  if (!spr) { spr = renderFish(spId, Math.round(len), dpr); fishCache.set(key, spr); }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(dir, 1);
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  ctx.drawImage(spr, -spr.width / dpr / 2, -spr.height / dpr / 2, spr.width / dpr, spr.height / dpr);
  ctx.restore();
}

function renderFish(spId, len, dpr) {
  const a = SPECIES[spId].art;
  const L = len * a.len, H = L * a.h;
  const pad = L * 0.12;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((L * 1.25 + pad * 2) * dpr); cv.height = Math.ceil((H * 1.7 + pad * 2) * dpr);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr); c.translate(cv.width / dpr / 2, cv.height / dpr / 2);
  const rng = makeRng(spId.length * 977 + len);
  const X = (u) => u * L, Y = (v) => v * H;
  const body = new Path2D();
  const nose = a.mouth === 'snout' ? 0.62 : a.mouth === 'duck' ? 0.56 : 0.5;
  body.moveTo(X(nose), Y(a.flat ? 0.08 : 0.03));
  const hump = a.hump ? 0.62 : 0.5;
  body.bezierCurveTo(X(0.42), Y(-0.46), X(0.08), Y(-hump - 0.04), X(-0.36), Y(-0.13));
  body.lineTo(X(-0.36), Y(0.13));
  body.bezierCurveTo(X(0.05), Y(0.52), X(0.42), Y(0.42), X(nose), Y(a.flat ? 0.08 : 0.03));
  body.closePath();
  // tail
  const tail = new Path2D();
  if (a.tail === 'fork') { tail.moveTo(X(-0.34), Y(-0.1)); tail.lineTo(X(-0.58), Y(-0.62)); tail.quadraticCurveTo(X(-0.5), Y(0), X(-0.58), Y(0.62)); tail.lineTo(X(-0.34), Y(0.1)); }
  else if (a.tail === 'round') { tail.moveTo(X(-0.34), Y(-0.12)); tail.bezierCurveTo(X(-0.62), Y(-0.55), X(-0.66), Y(0.55), X(-0.34), Y(0.12)); }
  else { tail.moveTo(X(-0.34), Y(-0.12)); tail.lineTo(X(-0.56), Y(-0.48)); tail.quadraticCurveTo(X(-0.52), Y(0), X(-0.56), Y(0.48)); tail.lineTo(X(-0.34), Y(0.12)); }
  tail.closePath();
  c.fillStyle = a.fin; c.fill(tail);
  if (a.whiteTip) { c.save(); c.clip(tail); c.fillStyle = '#F6F3EC'; c.fillRect(X(-0.62), Y(0.32), X(0.12), Y(0.4)); c.restore(); }
  if (a.mark === 'rainbow') { c.save(); c.clip(tail); c.fillStyle = '#1F2A24'; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(X(rng.range(-0.58, -0.38)), Y(rng.range(-0.45, 0.45)), L * 0.01, 0, 7); c.fill(); } c.restore(); }
  // fins (dorsal, anal, pelvic)
  c.fillStyle = a.fin;
  const dorsal = new Path2D();
  if (a.group === 'cat' || a.mouth === 'whisker') { dorsal.moveTo(X(0.12), Y(-0.44)); dorsal.lineTo(X(0.04), Y(-0.82)); dorsal.lineTo(X(-0.04), Y(-0.44)); }
  else if (a.len > 1.3) { dorsal.moveTo(X(-0.12), Y(-0.36)); dorsal.lineTo(X(-0.22), Y(-0.75)); dorsal.lineTo(X(-0.3), Y(-0.22)); }
  else {
    dorsal.moveTo(X(0.18), Y(-0.44));
    for (let i = 0; i <= 6; i++) { const u = lerp(0.18, -0.28, i / 6); dorsal.lineTo(X(u + 0.03), Y(-0.66 + (i % 2) * 0.08 + (i > 3 ? 0.04 : 0))); dorsal.lineTo(X(u - 0.02), Y(-0.48)); }
    dorsal.lineTo(X(-0.3), Y(-0.2));
  }
  dorsal.closePath(); c.globalAlpha = 0.9; c.fill(dorsal);
  c.beginPath(); c.moveTo(X(-0.1), Y(0.42)); c.lineTo(X(-0.2), Y(0.72)); c.lineTo(X(-0.3), Y(0.2)); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(X(0.14), Y(0.46)); c.lineTo(X(0.06), Y(0.72)); c.lineTo(X(0.0), Y(0.46)); c.closePath(); c.fill();
  c.globalAlpha = 1;
  // body gradient
  const g = c.createLinearGradient(0, Y(-0.55), 0, Y(0.5));
  g.addColorStop(0, a.back); g.addColorStop(0.45, a.base); g.addColorStop(0.75, a.belly); g.addColorStop(1, a.belly);
  c.fillStyle = g; c.fill(body);
  c.save(); c.clip(body);
  const dark = 'rgba(28,36,26,0.62)';
  switch (a.mark) {
    case 'stripe': c.fillStyle = dark; for (let u = 0.32; u > -0.4; u -= 0.045) { c.beginPath(); c.ellipse(X(u), Y(0.02 + Math.sin(u * 20) * 0.03), L * 0.03, H * 0.09, 0, 0, 7); c.fill(); } break;
    case 'spots': c.fillStyle = dark; for (let r = 0; r < 4; r++) for (let u = 0.26; u > -0.34; u -= 0.05) { c.beginPath(); c.arc(X(u + r * 0.01), Y(0.08 + r * 0.08), L * 0.008, 0, 7); c.fill(); }
      for (let u = 0.3; u > -0.36; u -= 0.06) { c.beginPath(); c.ellipse(X(u), Y(0), L * 0.022, H * 0.07, 0, 0, 7); c.fill(); } break;
    case 'bars': c.fillStyle = 'rgba(40,36,22,0.42)'; for (let i = 0; i < 8; i++) { const u = 0.26 - i * 0.08; c.fillRect(X(u), Y(-0.6), L * 0.03, H * 0.75); } break;
    case 'speckle': c.fillStyle = 'rgba(24,30,22,0.6)'; for (let i = 0; i < 70; i++) { c.beginPath(); c.arc(X(rng.range(-0.36, 0.34)), Y(rng.range(-0.45, 0.3)), L * rng.range(0.006, 0.016), 0, 7); c.fill(); } break;
    case 'stripes': c.strokeStyle = 'rgba(30,40,48,0.8)'; c.lineWidth = Math.max(1, H * 0.035); for (let i = 0; i < 7; i++) { const v = -0.34 + i * 0.1; c.beginPath(); c.moveTo(X(0.34), Y(v)); c.lineTo(X(-0.38), Y(v * 0.6)); c.stroke(); } break;
    case 'broken': c.strokeStyle = 'rgba(30,40,48,0.75)'; c.lineWidth = Math.max(1, H * 0.035); c.setLineDash([L * 0.06, L * 0.035]); for (let i = 0; i < 6; i++) { const v = -0.32 + i * 0.11; c.beginPath(); c.moveTo(X(0.34), Y(v)); c.lineTo(X(-0.38), Y(v * 0.6)); c.stroke(); } c.setLineDash([]); break;
    case 'thin': c.strokeStyle = 'rgba(60,70,80,0.45)'; c.lineWidth = Math.max(0.8, H * 0.025); for (let i = 0; i < 6; i++) { const v = -0.3 + i * 0.1; c.beginPath(); c.moveTo(X(0.32), Y(v)); c.lineTo(X(-0.38), Y(v * 0.6)); c.stroke(); } break;
    case 'rainbow': c.fillStyle = 'rgba(214,92,120,0.55)'; c.fillRect(X(-0.4), Y(-0.08), L * 0.8, H * 0.2); c.fillStyle = 'rgba(24,30,22,0.7)'; for (let i = 0; i < 60; i++) { c.beginPath(); c.arc(X(rng.range(-0.36, 0.3)), Y(rng.range(-0.5, 0.05)), L * 0.007, 0, 7); c.fill(); } break;
    case 'dots': c.fillStyle = 'rgba(24,30,30,0.7)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(X(rng.range(-0.3, 0.25)), Y(rng.range(-0.3, 0.15)), L * 0.011, 0, 7); c.fill(); } break;
    case 'mottle': c.fillStyle = 'rgba(40,34,18,0.45)'; for (let i = 0; i < 16; i++) { c.beginPath(); c.ellipse(X(rng.range(-0.34, 0.3)), Y(rng.range(-0.45, 0.1)), L * rng.range(0.03, 0.06), H * rng.range(0.08, 0.16), rng.range(0, 3), 0, 7); c.fill(); } break;
    case 'ovals': c.fillStyle = 'rgba(232,226,192,0.65)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(X(rng.range(-0.36, 0.32)), Y(rng.range(-0.4, 0.2)), L * 0.02, H * 0.06, 0, 0, 7); c.fill(); } break;
    default: break;
  }
  // gill line and sheen
  c.strokeStyle = 'rgba(20,28,20,0.45)'; c.lineWidth = Math.max(1, L * 0.008);
  c.beginPath(); c.arc(X(0.36), Y(0.02), H * 0.42, Math.PI * 0.62, Math.PI * 1.38); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.ellipse(X(0.05), Y(-0.2), L * 0.3, H * 0.08, -0.05, 0, 7); c.fill();
  if (a.ear) { c.fillStyle = a.ear; c.beginPath(); c.ellipse(X(0.24), Y(-0.02), L * 0.035, H * 0.08, 0, 0, 7); c.fill(); }
  c.restore();
  c.strokeStyle = 'rgba(18,24,18,0.55)'; c.lineWidth = Math.max(1, L * 0.006); c.stroke(body);
  // pectoral fin
  c.fillStyle = a.fin; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(X(0.22), Y(0.16), L * 0.06, H * 0.08, 0.5, 0, 7); c.fill(); c.globalAlpha = 1;
  // mouth
  c.strokeStyle = 'rgba(20,20,16,0.8)'; c.lineWidth = Math.max(1, L * 0.01);
  c.beginPath();
  if (a.mouth === 'big') { c.moveTo(X(nose), Y(0.06)); c.lineTo(X(0.3), Y(0.1)); }
  else if (a.mouth === 'small') { c.moveTo(X(nose), Y(0.04)); c.lineTo(X(0.45), Y(0.06)); }
  else if (a.mouth === 'under') { c.moveTo(X(0.46), Y(0.2)); c.lineTo(X(0.38), Y(0.22)); }
  else if (a.mouth === 'snout') { c.moveTo(X(0.62), Y(0.03)); c.lineTo(X(0.4), Y(0.05)); }
  else if (a.mouth === 'duck') { c.moveTo(X(0.56), Y(0.06)); c.lineTo(X(0.38), Y(0.1)); }
  else { c.moveTo(X(nose), Y(0.05)); c.lineTo(X(0.38), Y(0.08)); }
  c.stroke();
  if (a.mouth === 'whisker') { c.lineWidth = Math.max(0.8, L * 0.005); for (const [dx, dy] of [[0.2, -0.25], [0.24, 0.35], [0.14, 0.42], [0.18, -0.12]]) { c.beginPath(); c.moveTo(X(0.48), Y(0.05)); c.quadraticCurveTo(X(0.55 + dx * 0.4), Y(dy * 0.6), X(0.5 + dx * 0.5), Y(dy)); c.stroke(); } }
  // eye
  c.fillStyle = a.eye || '#E6C24A'; c.beginPath(); c.arc(X(nose - 0.12), Y(-0.08), Math.max(1.5, L * 0.03), 0, 7); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(X(nose - 0.115), Y(-0.08), Math.max(1, L * 0.017), 0, 7); c.fill();
  return cv;
}

// Top-down bass boat for the map. (x, y) center, ang heading (radians), size px length.
export function drawBoat(ctx, x, y, ang, size) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const l = size, w = size * 0.38;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(1.5, 2, l * 0.52, w * 0.55, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(l * 0.55, 0); ctx.quadraticCurveTo(l * 0.2, -w * 0.62, -l * 0.42, -w * 0.5); ctx.lineTo(-l * 0.42, w * 0.5); ctx.quadraticCurveTo(l * 0.2, w * 0.62, l * 0.55, 0); ctx.closePath();
  ctx.fillStyle = '#F6F3EC'; ctx.fill(); ctx.strokeStyle = '#14283A'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#C8452B'; ctx.fillRect(-l * 0.3, -w * 0.32, l * 0.42, w * 0.64);
  ctx.fillStyle = '#14283A'; ctx.fillRect(-l * 0.52, -w * 0.18, l * 0.12, w * 0.36);
  ctx.restore();
}

// Bobber icon (red over white with a stem).
export function drawBobber(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#F6F3EC'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#C8452B'; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#14283A'; ctx.lineWidth = Math.max(1, r * 0.15); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r * 1.6); ctx.stroke();
  ctx.restore();
}

// Title backdrop: sunrise over Ouachita ridges and a lake. t = seconds (ambient), reduced = no motion.
export function drawTitle(ctx, w, h, t, reduced) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#1E4E79'); sky.addColorStop(0.55, '#B5568F'); sky.addColorStop(0.85, '#F2A541'); sky.addColorStop(1, '#F6D9A0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.56);
  const sunX = w * 0.68, sunY = h * 0.5;
  ctx.fillStyle = 'rgba(246,243,236,0.85)'; ctx.beginPath(); ctx.arc(sunX, sunY, Math.min(w, h) * 0.07, 0, 7); ctx.fill();
  const ridge = (y0, amp, col, seed) => {
    const r = makeRng(seed); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h * 0.56);
    let y = y0; for (let x = 0; x <= w + 20; x += 20) { y += r.range(-1, 1) * amp; y = Math.max(y0 - amp * 3, Math.min(y0 + amp * 2, y)); ctx.lineTo(x, h * y); }
    ctx.lineTo(w, h * 0.56); ctx.closePath(); ctx.fill();
  };
  ridge(0.42, 0.012, '#5C7A3A', 3); ridge(0.47, 0.01, '#2F4A2C', 9); ridge(0.52, 0.008, '#1F3324', 17);
  const water = ctx.createLinearGradient(0, h * 0.56, 0, h);
  water.addColorStop(0, '#4C8FA8'); water.addColorStop(1, '#1E4E79');
  ctx.fillStyle = water; ctx.fillRect(0, h * 0.56, w, h * 0.44);
  // sun glitter
  const g = makeRng(4);
  for (let i = 0; i < 70; i++) {
    const y = h * 0.57 + Math.pow(g.next(), 1.6) * h * 0.4;
    const spread = (y - h * 0.56) * 0.5 + 10;
    const x = sunX + g.range(-1, 1) * spread + (reduced ? 0 : Math.sin(t * 1.3 + i) * 3);
    ctx.fillStyle = `rgba(246,217,160,${0.25 + g.next() * 0.4})`;
    ctx.fillRect(x, y, g.range(6, 22), 1.6);
  }
  // morning fog band
  ctx.fillStyle = 'rgba(246,243,236,0.16)';
  for (let i = 0; i < 5; i++) { const x = ((reduced ? 0 : t * 8) + i * w * 0.27) % (w * 1.3) - w * 0.15; ctx.beginPath(); ctx.ellipse(x, h * 0.555, w * 0.18, h * 0.02, 0, 0, 7); ctx.fill(); }
  // boat silhouette + angler
  const bx = w * 0.3, by = h * 0.7;
  ctx.fillStyle = '#14283A';
  ctx.beginPath(); ctx.moveTo(bx - 70, by); ctx.lineTo(bx + 80, by); ctx.lineTo(bx + 60, by + 14); ctx.lineTo(bx - 60, by + 14); ctx.closePath(); ctx.fill();
  ctx.fillRect(bx - 6, by - 36, 10, 36); ctx.beginPath(); ctx.arc(bx - 1, by - 42, 7, 0, 7); ctx.fill();
  ctx.strokeStyle = '#14283A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 2, by - 30); ctx.lineTo(bx + 90, by - 82); ctx.stroke();
  ctx.strokeStyle = 'rgba(246,243,236,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 90, by - 82); ctx.quadraticCurveTo(bx + 170, by - 60, bx + 210, by + 20); ctx.stroke();
  // leaping bass (slow loop)
  const ph = reduced ? 0.45 : ((t / 5) % 1);
  if (ph < 0.6) {
    const u = ph / 0.6; const fx = w * 0.78 + u * 80, fy = h * 0.66 - Math.sin(u * Math.PI) * h * 0.09;
    drawFish(ctx, 'largemouth', fx, fy, Math.min(120, w * 0.1), { rot: (u - 0.5) * 1.2 });
    if (u > 0.85 || u < 0.15) { ctx.strokeStyle = 'rgba(246,243,236,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w * 0.78 + (u < 0.5 ? 0 : 80), h * 0.665, 30, 6, 0, 0, 7); ctx.stroke(); }
  }
  ctx.strokeStyle = 'rgba(246,243,236,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) { const r = ((reduced ? 0.5 : (t * 0.4 + i / 3) % 1)); ctx.globalAlpha = 1 - r; ctx.beginPath(); ctx.ellipse(bx + 210, by + 20, 10 + r * 50, 3 + r * 10, 0, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// Weigh-in backdrop: dusk sky, lake, dock planks and string lights.
export function drawWeighIn(ctx, w, h, t, reduced) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, '#14121F'); sky.addColorStop(0.6, '#1E4E79'); sky.addColorStop(1, '#B5568F');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.5);
  ctx.fillStyle = '#1F3324'; ctx.beginPath(); ctx.moveTo(0, h * 0.5);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * (0.44 + 0.03 * Math.sin(x * 0.011) + 0.015 * Math.sin(x * 0.037))); ctx.lineTo(w, h * 0.5); ctx.fill();
  ctx.fillStyle = '#183F63'; ctx.fillRect(0, h * 0.5, w, h * 0.5);
  ctx.fillStyle = '#9C7A55'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.strokeStyle = 'rgba(62,53,40,0.7)'; ctx.lineWidth = 2;
  for (let y = h * 0.78; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // string lights
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * w, y = h * 0.1 + Math.sin((i / 24) * Math.PI) * h * 0.06;
    const on = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7);
    ctx.fillStyle = `rgba(242,165,65,${0.55 + 0.45 * on})`; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
  }
}
