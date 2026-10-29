// The lake (map) scene in 3D: real terrain and water in lake units (x east 0–1000, z south 0–625), heights
// exaggerated ×EXAG so the Ouachita ridges read from above. The 2D canvas draws pins and labels on top,
// using project() each frame.
/* global THREE */
import { GFX } from './gl.js';
import { lakeRes, terrainMaterial, waterMaterial, seasonColors, applyLight } from './lake3d.js';
import { lightFor, makeSky, setC } from './sky.js';
import { makeBoat, makeWake } from './models.js';
import { getLake, damLines, pathPoint, LW, LH } from '../lakes.js';
import { LAKES } from '../data.js';
import { clamp, lerp } from '../util.js';

const EXAG = 3;
const DAM_INFO = { // crest height (m) and kind; sources in research/visual-research.md
  catherine: { h: 21, kind: 'buttress' }, hamilton: { h: 35, kind: 'gravity' }, ouachita: { h: 70, kind: 'earth' }, degray: { h: 74, kind: 'earth' },
};
let M = null; // current map scene
let tmpV = null; // created once three.js has loaded

function build(lakeId, month) {
  tmpV = tmpV || new THREE.Vector3();
  const res = lakeRes(lakeId); if (!res) return null;
  const L = getLake(lakeId), mpu = res.mpu, vScale = EXAG / mpu;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 5, 20000);
  // the terrain runs 40% past the frame on every side (edge heights clamp), so the tilted view never shows an edge
  const segW = GFX.tier === 'high' ? 560 : 220, segH = GFX.tier === 'high' ? 350 : 138;
  const plane = new THREE.PlaneGeometry(1.8, 1.8, segW, segH); plane.rotateX(-Math.PI / 2); plane.translate(0.5, 0, 0.5);
  const tmat = terrainMaterial(res, { worldW: LW, worldH: LH, vScale, detail: 0.6, hillK: 0.85, sat: 1.1, winter: month === 12 || month <= 2, lcK: 0.5, roadK: 0.75 });
  const sc = seasonColors(month); setC(tmat.uniforms.cA.value, sc.a); setC(tmat.uniforms.cB.value, sc.b); setC(tmat.uniforms.cC.value, sc.c); setC(tmat.uniforms.cPine.value, sc.pine); tmat.uniforms.fleck.value = sc.fleck;
  const terrain = new THREE.Mesh(plane, tmat); terrain.scale.set(LW, 1, LH); terrain.frustumCulled = false; scene.add(terrain);
  const wplane = new THREE.PlaneGeometry(1, 1, 1, 1); wplane.rotateX(-Math.PI / 2); wplane.translate(0.5, 0, 0.5);
  const wmat = waterMaterial(res, { contours: true, waveScale: 14, gloss: 0.8 });
  const clar = LAKES[lakeId].clarity;
  setC(wmat.uniforms.shallow.value, clar === 'clear' ? [0.38, 0.68, 0.72] : [0.42, 0.62, 0.56]); setC(wmat.uniforms.deep.value, [0.17, 0.44, 0.66]);
  const water = new THREE.Mesh(wplane, wmat); water.scale.set(LW, 1, LH); water.position.y = 0; scene.add(water);
  // land beyond the frame, so the tilted camera never sees the void
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshBasicMaterial({ color: 0x1a2c1c }));
  skirt.rotation.x = -Math.PI / 2; skirt.position.set(LW / 2, -2, LH / 2); scene.add(skirt);
  const sky = makeSky(9000); scene.add(sky);
  // dams: concrete walls (Carpenter, Remmel) or earth embankments (Blakely Mountain, DeGray) along the crest line
  const dams = new THREE.Group(); const info = DAM_INFO[lakeId];
  for (const d of damLines(L)) {
    const own = d.own; const h = (own ? info.h : 35) * vScale; const kind = own ? info.kind : 'gravity';
    for (let i = 0; i < d.pts.length - 1; i++) {
      const [ax, az] = d.pts[i], [bx, bz] = d.pts[i + 1]; const len = Math.hypot(bx - ax, bz - az);
      const earth = kind === 'earth';
      const shape = new THREE.Shape(); const wB = earth ? h * 2.2 : h * 0.35, wT = earth ? 2.2 : 1.1;
      shape.moveTo(-wB, -4); shape.lineTo(wB, -4); shape.lineTo(wT, h); shape.lineTo(-wT, h); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }); geo.translate(0, 0, -len / 2);
      const mat = new THREE.MeshLambertMaterial({ color: earth ? 0x7d8a5a : 0xd8d3c8 });
      const m = new THREE.Mesh(geo, mat); m.position.set((ax + bx) / 2, 0, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az); dams.add(m);
      if (!earth) { // dark gate bays along a concrete crest
        for (let k = 1; k < Math.floor(len / 3); k++) { const bay = new THREE.Mesh(new THREE.BoxGeometry(1.4, h * 0.45, 0.9), new THREE.MeshLambertMaterial({ color: 0x5c5a55 })); bay.position.set(wT + 0.1, h * 0.55, -len / 2 + k * 3); m.add(bay); }
      } else { // rock riprap band on the upstream face
        const rr = new THREE.Mesh(new THREE.BoxGeometry(wB * 0.7, 1.2, len), new THREE.MeshLambertMaterial({ color: 0x9d988c })); rr.position.set(-wB * 0.55, h * 0.2, 0); rr.rotation.z = Math.atan2(h, wB - wT); m.add(rr);
      }
    }
  }
  scene.add(dams);
  // bridges from the national road data
  const bridges = new THREE.Group();
  for (const b of (L.geo && L.geo.bridges) || []) {
    const len = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]); const hw = b.cls === 'highway' ? 3.2 : 2.4, y = 9 * vScale; // drawn wider than life so bridges read at map scale
    const deck = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.5, len + 2), new THREE.MeshLambertMaterial({ color: 0xcfcac0 }));
    const g = new THREE.Group(); g.position.set((b.a[0] + b.b[0]) / 2, 0, (b.a[1] + b.b[1]) / 2); g.rotation.y = Math.atan2(b.b[0] - b.a[0], b.b[1] - b.a[1]);
    deck.position.y = y; g.add(deck);
    const road = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.5, 0.52, len + 2), new THREE.MeshLambertMaterial({ color: 0xe6e1d4, emissive: 0x2a2824 })); road.position.y = y + 0.02; g.add(road);
    for (let k = -len / 2 + 3; k < len / 2 - 1; k += 5) { const p = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.4, y, 0.6), new THREE.MeshLambertMaterial({ color: 0xa9a499 })); p.position.set(0, y / 2, k); g.add(p); }
    bridges.add(g);
  }
  scene.add(bridges);
  const boat = makeBoat(); boat.scale.setScalar(4.5); scene.add(boat);
  const wake = makeWake(80); scene.add(wake);
  const lights = [new THREE.HemisphereLight(0xbfd6ff, 0x3a4a2a, 1.2), new THREE.DirectionalLight(0xffffff, 2)];
  lights.forEach((l) => scene.add(l));
  // the region worth framing: water bbox plus landmarks and the ramp
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; const { w, h, cell } = L.grid;
  for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) if (L.mask[j * w + i]) { const x = i * cell, z = j * cell; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (const p of [...L.allPoints(), ...LAKES[lakeId].landmarks]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.y); z1 = Math.max(z1, p.y); }
  const pad = 22; const box = [clamp(x0 - pad, 0, LW), clamp(z0 - pad, 0, LH), clamp(x1 + pad, 0, LW), clamp(z1 + pad, 0, LH)];
  return { lakeId, month, res, L, scene, camera, terrain, water, sky, dams, bridges, boat, wake, lights, vScale, box, fitKey: '', time: 0, follow: 0, lastRun: null };
}

// Fit the camera so the framing box fills the map rectangle (tilted perspective, north up; portrait: north right).
function fit(m, rect, portrait, W, H) {
  const cam = m.camera; const pitch = 58 * Math.PI / 180;
  const [bx0, bz0, bx1, bz1] = m.box; const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  cam.aspect = W / H; cam.clearViewOffset(); cam.updateProjectionMatrix();
  const yaw = portrait ? Math.PI / 2 : 0; // camera looks north (−z), or west (−x) on portrait screens
  const place = (d, tx, tz) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // forward on the ground
    cam.position.set(tx - fx * d * Math.cos(pitch), d * Math.sin(pitch), tz - fz * d * Math.cos(pitch));
    cam.up.set(0, 1, 0); cam.lookAt(tx, 0, tz); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  };
  const corners = [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]];
  const bbox = () => { let a = 1e9, b = 1e9, c = -1e9, e = -1e9; for (const [x, z] of corners) { tmpV.set(x, 0, z).project(cam); const sx = (tmpV.x + 1) / 2 * W, sy = (1 - tmpV.y) / 2 * H; a = Math.min(a, sx); b = Math.min(b, sy); c = Math.max(c, sx); e = Math.max(e, sy); } return [a, b, c, e]; };
  let lo = 50, hi = 20000;
  for (let it = 0; it < 30; it++) { const d = (lo + hi) / 2; place(d, cx, cz); const [a, b, c, e] = bbox(); if (c - a > rect.w || e - b > rect.h) lo = d; else hi = d; }
  place(hi, cx, cz);
  const [a, b, c, e] = bbox();
  // shift the principal point so the box centre lands on the rect centre
  const offX = (a + c) / 2 - (rect.x + rect.w / 2), offY = (b + e) / 2 - (rect.y + rect.h / 2);
  cam.setViewOffset(W, H, offX, offY, W, H); cam.updateProjectionMatrix();
  m.base = { pos: cam.position.clone(), target: new THREE.Vector3(cx, 0, cz), d: hi, offX, offY, pitch, yaw };
}

// opts: { lakeId, month, clock, weather, rect, portrait, W, H, dt, reduced, boat:{x,y,ang}, run }
export function renderMap3D(o) {
  if (!M || M.lakeId !== o.lakeId || M.month !== o.month) { if (M) dispose(M); M = build(o.lakeId, o.month); if (!M) return false; }
  const m = M, r = GFX.renderer;
  const key = `${o.W}x${o.H}|${o.portrait}|${o.rect.x},${o.rect.y},${o.rect.w},${o.rect.h}`;
  if (m.fitKey !== key) { fit(m, o.rect, o.portrait, o.W, o.H); m.fitKey = key; }
  if (!o.reduced) m.time += o.dt;
  const lt = lightFor(o.clock, o.month, o.weather);
  for (const mat of [m.terrain.material, m.water.material]) applyLight(mat, lt, m.time);
  // a map stays readable: weather and hour tint it, they don't hide it
  m.terrain.material.uniforms.fogD.value = 0.00006 * lt.fogDensity; m.water.material.uniforms.fogD.value = 0.00006 * lt.fogDensity;
  m.water.material.uniforms.wind.value = 0.25 + ((o.weather && o.weather.wind) || 6) / 30;
  m.sky.update(lt, m.time); m.sky.position.copy(m.camera.position);
  m.scene.fog = null; r.setClearColor(new THREE.Color().setRGB(...lt.fog, THREE.SRGBColorSpace));
  const [hemi, dir] = m.lights; dir.position.set(lt.sun.v[0] * 100, Math.max(0.15, lt.sun.v[1]) * 100, lt.sun.v[2] * 100);
  dir.color.setRGB(...lt.sunCol, THREE.SRGBColorSpace); dir.intensity = 0.4 + lt.sunI * 1.1; hemi.intensity = 0.5 + lt.ambI * 0.9;
  // boat and wake
  const b = o.boat; m.boat.position.set(b.x, 0.25, b.y); m.boat.rotation.set(0, -b.ang, 0);
  if (o.run) {
    if (m.lastRun !== o.run) { m.wake.reset(); m.lastRun = o.run; }
    m.boat.rotation.z = 0.08; m.boat.position.y = 0.6;
    m.wake.push(b.x - Math.cos(b.ang) * 12, b.y - Math.sin(b.ang) * 12, m.time);
  } else m.boat.rotation.z = 0;
  m.wake.update(m.time, 2.2, 2.5, 11, 0.3);
  m.wake.material.uniforms.light.value = 0.4 + lt.day * 0.6;
  // camera: ease toward the boat during a run, back to the framing afterwards
  const want = o.run && !o.reduced ? 1 : 0; m.follow += (want - m.follow) * Math.min(1, o.dt * 2.2);
  if (m.base) {
    const k = m.follow * 0.55, tgt = m.base.target.clone().lerp(new THREE.Vector3(b.x, 0, b.y), k);
    const d = m.base.d * (1 - 0.45 * m.follow);
    const fx = -Math.sin(m.base.yaw), fz = -Math.cos(m.base.yaw);
    m.camera.position.set(tgt.x - fx * d * Math.cos(m.base.pitch), d * Math.sin(m.base.pitch), tgt.z - fz * d * Math.cos(m.base.pitch));
    m.camera.lookAt(tgt); m.camera.setViewOffset(o.W, o.H, m.base.offX * (1 - m.follow), m.base.offY * (1 - m.follow), o.W, o.H); m.camera.updateProjectionMatrix();
  }
  r.toneMappingExposure = 1.0;
  r.render(m.scene, m.camera);
  return true;
}

// Lake coords (+ optional height in metres) → screen px, using the current map camera.
export function projectMap(x, y, hM = 0) {
  if (!M) return [x, y];
  tmpV.set(x, hM * M.vScale, y).project(M.camera);
  return [(tmpV.x + 1) / 2 * window.innerWidth, (1 - tmpV.y) / 2 * window.innerHeight];
}
export function mapHeight(x, y) { return M ? Math.max(0, M.res.heightAt(x, y)) : 0; }
export const mapFollowing = () => !!(M && M.follow > 0.02);
export function mapReady(lakeId) { return !!lakeRes(lakeId); }
// lake units per screen pixel near the centre of the view (for the scale bar)
export function mapScalePx() {
  if (!M || !M.base) return 1; const t = M.base.target;
  const a = projectMap(t.x, t.z), b = projectMap(t.x + 50, t.z); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 50;
}
function dispose(m) { m.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => x.dispose()); } }); }
export function dropMap() { if (M) { dispose(M); M = null; } }
export function mapDebug() { return M && { pos: M.camera.position.toArray().map(Math.round), base: M.base && { d: Math.round(M.base.d), off: [M.base.offX, M.base.offY] }, box: M.box, p: projectMap(500, 300) }; }
