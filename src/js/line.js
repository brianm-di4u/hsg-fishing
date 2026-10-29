// Fishing line as a short Verlet chain. The point update and stick relaxation are adapted from
// anuraghazra/verlet.js (MIT, © 2018 Anurag Hazra, commit 5d1ce9c): see SAMPLES.md #1.
// Visual only: it never feeds the simulation, so it is not part of the saved state.
export function makeLine(n = 14) {
  return { pts: Array.from({ length: n }, () => ({ x: 0, y: 0, ox: 0, oy: 0 })), init: false };
}

// a = rod tip, b = lure (screen px). sag = gravity in px/frame² (slack line sags more), tension 0–1.
export function updateLine(line, a, b, tension, sag = 0.35) {
  const P = line.pts, n = P.length;
  if (!line.init) {
    P.forEach((p, i) => { const t = i / (n - 1); p.x = p.ox = a.x + (b.x - a.x) * t; p.y = p.oy = a.y + (b.y - a.y) * t; });
    line.init = true;
  }
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  const seg = (span * (1.08 - 0.08 * tension)) / (n - 1);
  const friction = 0.94;
  for (let i = 1; i < n - 1; i++) { // updatePoints: velocity from the previous position
    const p = P[i]; const vx = (p.x - p.ox) * friction, vy = (p.y - p.oy) * friction;
    p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + sag * (1 - tension);
  }
  P[0].x = a.x; P[0].y = a.y; P[n - 1].x = b.x; P[n - 1].y = b.y; // pinned ends
  const stiff = 0.6 + 0.4 * tension;
  for (let k = 0; k < 4; k++) for (let i = 0; i < n - 1; i++) { // bakePhysics: move both ends half the error
    const p0 = P[i], p1 = P[i + 1];
    const dx = p1.x - p0.x, dy = p1.y - p0.y, d = Math.hypot(dx, dy) || 1e-6;
    const diff = (d - seg) / d, ax = dx * 0.5 * diff * stiff, ay = dy * 0.5 * diff * stiff;
    if (i > 0) { p0.x += ax; p0.y += ay; }
    if (i + 1 < n - 1) { p1.x -= ax; p1.y -= ay; }
  }
}

export function drawLine(ctx, line, color, width) {
  const P = line.pts; if (!line.init) return;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
  for (let i = 1; i < P.length - 1; i++) { const mx = (P[i].x + P[i + 1].x) / 2, my = (P[i].y + P[i + 1].y) / 2; ctx.quadraticCurveTo(P[i].x, P[i].y, mx, my); }
  ctx.lineTo(P[P.length - 1].x, P[P.length - 1].y); ctx.stroke();
}
