// The fishing spot in 3D (metres, x right, y up, z toward the camera). Spot space (0–1, 0–1) is a 100 ft
// (30.48 m) square: x → X = (x − 0.5)·P, y → Z = (y − 1)·P, so the boat sits at the origin facing −Z.
// The scene is placed in the real lake, facing the nearest shore: the real terrain (USGS 3DEP) rises behind a
// procedural bank built from the sim's own shoreline curve, and the water reflects both.
/* global THREE */
import { GFX } from './gl.js';
import { lakeRes, terrainMaterial, seasonColors, applyLight } from './lake3d.js';
import { lightFor, makeSky, setC } from './sky.js';
import { makeBoat } from './models.js';
import { foliageMaterial, pineGeo, hardwoodGeo, cedarGeo, rockGeo, bushGeo, houseGeo, makePrecip, scatter, boathouse, laydown, makeRod, makeLine, makeLure, makeSpray, fishGeo, fishMaterial } from './props.js';
import { fishTexture } from './fishtex.js';
import { disposeTree, geoFromScene } from './util3d.js';
import { MODELS } from './modelpack.js';
import { getLake, landcover } from '../lakes.js';
import { LAKES, LURES, SPECIES } from '../data.js';
import { sceneFor, ROD, BOAT, ringAt } from '../fishing.js';
import { clamp, lerp, makeRng, hash32 } from '../util.js';

export const P = 30.48;
const toW = (x, y) => [(x - 0.5) * P, (y - 1) * P];
let S3 = null; let V = null; // current scene; scratch vectors (created once three.js has loaded)
const LURE_HEX = { 'green pumpkin': 0x5c6b2e, shad: 0xc3d3df, 'red craw': 0xb5452b, chartreuse: 0xd7e84a, 'black/blue': 0x1e2a5a, natural: 0xc88a6a };

// direction (lake radians, x east / y south) from a point to the nearest land, and the distance (lake units)
function facing(L, x, y) {
  let best = null;
  for (let a = 0; a < 360; a += 4) {
    const r = a * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r); let t = 0;
    while (t < 400 && L.water(x + dx * t, y + dy * t)) t += L.grid.cell * 0.5;
    if (!best || t < best.t) best = { t, ang: r };
  }
  return best;
}

function build(o) {
  V = V || { clear: new THREE.Color(), fog: new THREE.FogExp2(0, 1), c2: new THREE.Color(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v2: new THREE.Vector2() };
  const L = getLake(o.lakeId), spot = L.spot(o.spotId), sc = sceneFor(spot), def = LAKES[o.lakeId];
  const rng = makeRng(hash32(spot.id + '3d')); const r = () => rng.next();
  const high = GFX.tier === 'high';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 9000);
  const sky = makeSky(7000); scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a5a3a, 1.1), sun = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(hemi, sun, sun.target);
  const season = seasonColors(o.month);
  // ---- where we are in the real lake ----
  const f = facing(L, spot.x, spot.y); const th = f.ang; const dirx = Math.cos(th), diry = Math.sin(th);
  const localShore = sc.shore ? (1 - sc.shoreY(0.5)) * P : 0;
  const shiftU = sc.shore ? Math.max(0, f.t - localShore / L.mPerUnit) : 0; // slide toward the real bank so it lines up
  const ox = spot.x + dirx * shiftU, oy = spot.y + diry * shiftU;
  const mpu = L.mPerUnit; const rotY = Math.PI / 2 + th;
  // world (X, Z) → lake (x, y): inverse of the terrain group's transform
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  const toLake = (X, Z) => { const dx = X * cs - Z * sn, dy = X * sn + Z * cs; return [ox + dx / mpu, oy + dy / mpu]; };
  const res = lakeRes(o.lakeId);
  const realH = (X, Z) => { if (!res) return 6; const [x, y] = toLake(X, Z); return res.heightAt(x, y); };
  let terrain = null;
  if (res) {
    const seg = high ? 360 : 140;
    const plane = new THREE.PlaneGeometry(1, 1, seg, Math.round(seg * 0.625)); plane.rotateX(-Math.PI / 2); plane.translate(0.5, 0, 0.5);
    const tmat = terrainMaterial(res, { worldW: 1000 * mpu, worldH: 625 * mpu, vScale: 1, detail: 1, sat: 1.05, winter: o.month === 12 || o.month <= 2 });
    setC(tmat.uniforms.cA.value, season.a); setC(tmat.uniforms.cB.value, season.b); setC(tmat.uniforms.cC.value, season.c); setC(tmat.uniforms.cPine.value, season.pine); tmat.uniforms.fleck.value = season.fleck;
    // sink the real terrain under the procedural bank (aspect-corrected uv radius)
    if (sc.shore) tmat.uniforms.hole.value.set(ox / 1000, oy / 625, 150 / (625 * mpu), 4);
    terrain = new THREE.Mesh(plane, tmat); terrain.scale.set(1000 * mpu, 1, 625 * mpu); terrain.position.set(-ox * mpu, 0, -oy * mpu); terrain.frustumCulled = false;
    const grp = new THREE.Group(); grp.rotation.y = rotY; grp.add(terrain); scene.add(grp);
  }
  // ---- bank and lake bed: one heightfield in local metres ----
  const shoreZ = (X) => { if (!sc.shore) return -1e4; const x01 = X / P + 0.5; const xc = clamp(x01, 0, 1); return (sc.shoreY(xc) - 1) * P - (x01 < 0 ? -x01 : x01 > 1 ? x01 - 1 : 0) * P * 0.15 * (sc.type === 'cove' ? -1 : 1); };
  const steep = { riprap: 0.62, tailrace: 0.62, point: 0.38, island: 0.36, docks: 0.22, cove: 0.17, flat: 0.12, grass: 0.12, creek: 0.14, ramp: 0.2 }[sc.type] ?? 0.25;
  const bedDepth = (X, Z) => { const x = X / P + 0.5, y = Z / P + 1; return sc.bottom(clamp(x, 0, 1), clamp(y, sc.shore ? -1 : 0, 1.05)) * 0.3048 + Math.max(0, Z) * 0.08 + Math.max(0, Math.abs(X) - P * 0.6) * 0.03; };
  const H = (X, Z) => {
    const sz = shoreZ(X), back = sz - Z; // metres behind the waterline (negative = in the water)
    if (back <= 0) return -Math.min(bedDepth(X, Z), sc.shore ? 0.25 - back * steep * 1.4 + 0.2 : 99);
    const rise = 0.25 + Math.pow(back, 0.85) * steep;
    const target = Math.max(2.5, realH(X, Z)); const k = clamp((back - 40) / 70, 0, 1);
    return lerp(Math.min(rise, target + 3), target, k * k);
  };
  const GX = high ? 120 : 70, GZ = high ? 90 : 52, X0 = -150, X1 = 150, Z0 = sc.shore ? -150 : -60, Z1 = 14;
  const bg = new THREE.PlaneGeometry(1, 1, GX, GZ); bg.rotateX(-Math.PI / 2);
  { const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const X = lerp(X0, X1, p.getX(i) + 0.5), Z = lerp(Z0, Z1, p.getZ(i) + 0.5); p.setXYZ(i, X, H(X, Z), Z); } bg.computeVertexNormals(); }
  const bankMat = new THREE.ShaderMaterial({
    uniforms: { ...terrainUniforms(), cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, rockK: { value: sc.type === 'riprap' || sc.type === 'tailrace' ? 1.6 : sc.type === 'point' || sc.type === 'island' ? 0.55 : 0.15 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 sunDir, sunCol, ambCol, fogCol, cA, cB; uniform float sunI, ambI, fogD, rockK; uniform sampler2D shadowTex; varying vec3 vN; varying vec3 vW;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){ vec3 N = normalize(vN); float y = vW.y;
        float n = n2(vW.xz * 0.35) * 0.6 + n2(vW.xz * 1.7) * 0.4;
        vec3 ground = mix(cA, cB, n) * (0.7 + 0.3 * n2(vW.xz * 4.0));                       // leaf litter and grass
        vec3 clay = lin(mix(vec3(0.46, 0.33, 0.24), vec3(0.58, 0.44, 0.32), n));               // red Ouachita clay
        vec3 rock = lin(mix(vec3(0.40, 0.39, 0.37), vec3(0.66, 0.64, 0.60), n2(vW.xz * 2.3))); // shale and novaculite
        vec3 col = mix(ground, clay, smoothstep(0.9, 0.2, y));
        col = mix(col, rock, clamp(rockK * smoothstep(3.5, 0.0, y) + smoothstep(0.55, 0.8, 1.0 - N.y), 0.0, 1.0));
        if (y < 0.0) col = lin(mix(vec3(0.52, 0.45, 0.34), vec3(0.30, 0.30, 0.26), clamp(-y / 5.0, 0.0, 1.0))) * (0.8 + 0.4 * n);
        col *= mix(0.55, 1.0, smoothstep(-0.05, 0.25, y)); // wet band at the waterline
        float dif = max(dot(N, normalize(sunDir)), 0.0);
        // canopy shade: crowns sit ~9 m up, so their shadow falls away from the sun
        vec3 L = normalize(sunDir); vec2 off = L.xz / max(L.y, 0.25) * 9.0;
        vec2 su = vec2((vW.x + off.x + 150.0) / 300.0, (vW.z + off.y + 170.0) / 190.0);
        float shade = texture2D(shadowTex, clamp(su, 0.0, 1.0)).r * step(0.0, y);
        float ao = texture2D(shadowTex, clamp(vec2((vW.x + 150.0) / 300.0, (vW.z + 170.0) / 190.0), 0.0, 1.0)).r * step(0.0, y);
        vec3 lit = col * (sunCol * min(sunI, 1.6) * 0.55 * dif * (1.0 - shade * 0.85) + ambCol * ambI * (0.55 + 0.45 * N.y) * (1.0 - ao * 0.35));
        float f = 1.0 - exp(-length(vW - cameraPosition) * fogD);
        gl_FragColor = vec4(mix(lit, fogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  setC(bankMat.uniforms.cA.value, [season.a[0] * 0.62, season.a[1] * 0.6, season.a[2] * 0.5]); setC(bankMat.uniforms.cB.value, [0.30, 0.24, 0.16]);
  const bank = new THREE.Mesh(bg, bankMat); scene.add(bank);
  // ---- vegetation ----
  const fol = foliageMaterial(); const pines = [], hards = [], cedars = [], rocks = [], bushes = [];
  const pineCol = () => new THREE.Color().setRGB(0.95 + r() * 0.25, 1.0 + r() * 0.25, 0.9 + r() * 0.2, THREE.SRGBColorSpace);
  const autumn = season.fleck > 0.3, winter = o.month === 12 || o.month <= 2;
  const hardCol = () => { const c = new THREE.Color(); const base = winter ? [0.42, 0.36, 0.30] : autumn ? [[0.78, 0.42, 0.12], [0.85, 0.62, 0.18], [0.55, 0.30, 0.14], [0.36, 0.44, 0.18]][Math.floor(r() * 4)] : o.month <= 4 ? [0.42, 0.58, 0.22] : [0.26, 0.42, 0.17]; c.setRGB(base[0] * (0.85 + r() * 0.3), base[1] * (0.85 + r() * 0.3), base[2] * (0.85 + r() * 0.3), THREE.SRGBColorSpace); return c; };
  if (sc.shore) {
    const n = high ? 520 : 240;
    for (let i = 0; i < n; i++) {
      const X = rnd(r, X0 + 5, X1 - 5), Z = rnd(r, Z0 + 5, 0); const back = shoreZ(X) - Z; if (back < 6 + r() * 6) continue;
      if ((sc.type === 'riprap' || sc.type === 'tailrace') && back < 75) continue; // the dam face, not forest
      const y = H(X, Z); const it = { x: X, y: y - 0.3, z: Z, s: 0.8 + r() * 0.6, ry: r() * 6.28 };
      const pick = r() * (winter ? 0.75 : 1); if (pick < 0.5) pines.push({ ...it, c: pineCol() }); else if (pick < 0.9) hards.push({ ...it, c: hardCol() }); else cedars.push({ ...it, s: it.s * 0.8, c: pineCol() });
    }
    // understory along the bank: dogwood, sumac and young pines
    for (let i = 0; i < (sc.type === 'riprap' || sc.type === 'tailrace' ? 0 : high ? 260 : 120); i++) { const X = rnd(r, -120, 120); const back = 1.2 + Math.pow(r(), 1.5) * 14; const Z = shoreZ(X) - back; bushes.push({ x: X, y: H(X, Z) - 0.1, z: Z, s: 0.5 + r() * 0.7, sy: 0.7 + r() * 0.5, ry: r() * 6.28, c: o.month <= 4 && o.month >= 3 && back > 6 && r() < 0.2 ? new THREE.Color().setRGB(0.80, 0.72, 0.76, THREE.SRGBColorSpace) : hardCol() }); }
    // rocks along the waterline: dense riprap on dams, scattered elsewhere
    const nr = sc.type === 'riprap' || sc.type === 'tailrace' ? (high ? 420 : 220) : sc.type === 'point' || sc.type === 'island' ? 120 : 40;
    for (let i = 0; i < nr; i++) { const X = rnd(r, -80, 80); const back = rnd(r, -1.5, sc.type === 'riprap' || sc.type === 'tailrace' ? 9 : 3); const Z = shoreZ(X) - back; const y = H(X, Z); const g = 0.2 + r() * 0.2, w = r() * 0.05; rocks.push({ x: X, y: y + 0.05, z: Z, s: 0.35 + r() * 0.6, ry: r() * 6, rx: r(), c: new THREE.Color().setRGB(g + w, g, g - w * 0.5, THREE.SRGBColorSpace) }); }
  }
  // trees (and, on developed land, houses) on the real terrain in front, out to ~800 m, by NLCD land cover
  const lcData = landcover(o.lakeId), lcG = L.geo && L.geo.landcover; const houses = [];
  const lcAt = (lx, ly) => (lcData && lcG ? lcData[Math.min(lcG.h - 1, Math.max(0, Math.floor(ly / 625 * lcG.h))) * lcG.w + Math.min(lcG.w - 1, Math.max(0, Math.floor(lx / 1000 * lcG.w)))] : 2);
  if (res) {
    const n = high ? 900 : 300;
    for (let i = 0; i < n; i++) {
      const a = (r() - 0.5) * 2.4, d = 60 + Math.pow(r(), 0.7) * 760; const X = Math.sin(a) * d, Z = -Math.cos(a) * d; const [lx, ly] = toLake(X, Z);
      if (L.water(lx, ly)) continue; const y = realH(X, Z); if (y < 1.5) continue; if (sc.shore && Z > shoreZ(X) - 6 && Math.abs(X) < 150) continue;
      const lc = lcAt(lx, ly);
      if (lc === 3 || lc === 4 || lc === 8) continue;                                   // pasture, grass, bare ground
      if (lc >= 5 && lc <= 7) { if (r() < (lc === 5 ? 0.25 : 0.6)) houses.push({ x: X, y: y - 0.2, z: Z, s: 0.8 + r() * 0.5, ry: rnd(r, -0.4, 0.4) + Math.atan2(X, -Z), c: new THREE.Color().setRGB(...[[0.86, 0.84, 0.78], [0.72, 0.66, 0.55], [0.55, 0.62, 0.68], [0.80, 0.74, 0.62]][Math.floor(r() * 4)], THREE.SRGBColorSpace) }); if (r() < 0.6) continue; }
      const it = { x: X, y: Math.max(y, sc.shore && Math.abs(X) < 150 && Z > -150 ? H(X, Z) : y) - 0.5, z: Z, s: 1.1 + r() * 0.8, ry: r() * 6.28 };
      if (r() < 0.55) pines.push({ ...it, c: pineCol() }); else hards.push({ ...it, c: hardCol() });
    }
  }
  // canopy shadow map: tree crowns painted top-down (X −150…150, Z −170…20); the bank shader offsets it by the sun
  const shCv = document.createElement('canvas'); shCv.width = 512; shCv.height = 320; const shx = shCv.getContext('2d');
  shx.fillStyle = '#000'; shx.fillRect(0, 0, 512, 320);
  const sxy = (x, z) => [(x + 150) / 300 * 512, (z + 170) / 190 * 320];
  for (const t of [...pines, ...hards, ...cedars]) { if (t.x < -160 || t.x > 160 || t.z < -180 || t.z > 25) continue; const [px, py] = sxy(t.x, t.z); const rr = (pines.includes(t) ? 2.4 : 3.4) * t.s / 300 * 512;
    const g = shx.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); shx.fillStyle = g; shx.beginPath(); shx.arc(px, py, rr, 0, 7); shx.fill(); }
  for (const b of bushes) { const [px, py] = sxy(b.x, b.z); shx.fillStyle = 'rgba(255,255,255,0.25)'; shx.beginPath(); shx.arc(px, py, b.s * 1.2 / 300 * 512, 0, 7); shx.fill(); }
  const shTex = new THREE.CanvasTexture(shCv); shTex.userData.own = true;
  bankMat.uniforms.shadowTex = { value: shTex };
  const trees = new THREE.Group();
  // Blender trees are modelled at full height (pine 18 m, oak 14 m); the stand-ins are smaller, so scale to match
  const pg = MODELS.pine || pineGeo(), hg = (winter && MODELS.oak_bare) || MODELS.oak || hardwoodGeo(), cg = MODELS.cedar || cedarGeo();
  const ks = MODELS.pine ? 0.62 : 1;
  if (pines.length) trees.add(scatter(pg, fol, ks === 1 ? pines : pines.map((t) => ({ ...t, s: t.s * ks }))));
  if (hards.length) trees.add(scatter(hg, fol, MODELS.oak ? hards.map((t) => ({ ...t, s: t.s * 0.62 })) : hards));
  if (cedars.length) trees.add(scatter(cg, fol, cedars));
  if (bushes.length) trees.add(scatter(bushGeo(), fol, bushes));
  if (houses.length) trees.add(scatter(houseGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), houses));
  if (rocks.length) { const rg = MODELS.rocks && MODELS.rocks.length ? MODELS.rocks : [rockGeo(3)]; const rm = new THREE.MeshLambertMaterial({ vertexColors: true }); rg.forEach((g, i) => trees.add(scatter(g, rm, rocks.filter((_, k) => k % rg.length === i)))); }
  scene.add(trees);
  // ---- cover from the sim's scene ----
  const cover = new THREE.Group();
  const bark = new THREE.MeshLambertMaterial({ color: 0x5b4632 });
  for (const k of sc.cover) {
    if (k.k === 'dock') { const [X] = toW(k.x, 0); const z0 = shoreZ(X) - 0.6; const len = (k.y1 - (sc.shoreY(k.x))) * P + 1.5; const bh = boathouse(Math.max(6, len), Math.max(4, k.w * P * 1.2), r); bh.position.set(X, 0, z0); cover.add(bh); }
    else if (k.k === 'laydown') { const X = (k.x - 0.5) * P, Z = shoreZ(X) + 0.3; const ld = laydown(k.len * P, r); ld.position.set(X, 0.05, Z); ld.rotation.y = -(k.ang - Math.PI / 2); ld.rotation.x = -0.08; cover.add(ld); }
    else if (k.k === 'stump') { const [X, Z] = toW(k.x, k.y); const d = bedDepth(X, Z); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, d + 0.35, 7), bark); s.position.set(X, -d + (d + 0.35) / 2, Z); cover.add(s); }
    else if (k.k === 'brush') { const [X, Z] = toW(k.x, k.y); const d = bedDepth(X, Z); const pile = new THREE.Group(); const ks = clamp((d - 1) / 3.2, 0.15, 1); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(cedarGeo(), new THREE.MeshLambertMaterial({ color: 0x7a6e58 })); c.scale.setScalar((0.4 + r() * 0.35) * ks); c.rotation.set(rnd(r, 1.2, 1.9), r() * 6.28, rnd(r, -0.4, 0.4)); c.position.set(rnd(r, -2, 2), 0.4, rnd(r, -2, 2)); pile.add(c); } pile.position.set(X, -d, Z); cover.add(pile); }
    else if (k.k === 'grass') { const [X, Z] = toW(k.x, k.y); const items = []; const R = k.r * P; for (let i = 0; i < (high ? 160 : 80); i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * R; const x = X + Math.cos(a) * rr, z = Z + Math.sin(a) * rr * 0.8; const d = bedDepth(x, z); items.push({ x, y: -d, z, s: 1, sy: d * (0.75 + r() * 0.3), ry: r() * 6, c: new THREE.Color(0.25 + r() * 0.1, 0.42 + r() * 0.12, 0.18) }); } const blade = new THREE.CylinderGeometry(0.02, 0.06, 1, 4).translate(0, 0.5, 0); cover.add(scatter(blade, fol, items)); }
  }
  if (sc.type === 'tailrace' || sc.type === 'riprap') cover.add(damFace(o.lakeId, sc, shoreZ));
  if (sc.type === 'docks') {
    // a developed shore: concrete seawall and more covered slips beyond the fishing water
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xb8b2a6 });
    for (let X = -140; X < 140; X += 4) { const z = shoreZ(X); const seg = new THREE.Mesh(new THREE.BoxGeometry(4.1, 1.6, 0.5), wallMat); seg.position.set(X + 2, 0.35, z - 0.2); seg.rotation.y = -Math.atan2(shoreZ(X + 4) - z, 4); cover.add(seg); }
    for (const X of [-70, -52, -36, 34, 50, 68, 90, -95]) { const bh = boathouse(9 + r() * 4, 5 + r() * 1.5, r); bh.position.set(X + rnd(r, -3, 3), 0, shoreZ(X) - 0.6); cover.add(bh); }
  }
  // merge the static cover (boathouses, seawall, dams, laydowns, stumps, brush) into one vertex-coloured mesh:
  // hundreds of draw calls become one, which matters most on phones. Textured parts stay separate.
  { const keep = []; cover.traverse((o) => { if (o.isMesh && o.material && o.material.map) keep.push(o); if (o.isInstancedMesh) keep.push(o); });
    keep.forEach((o) => { o.updateMatrixWorld(true); const m = o.matrixWorld.clone(); o.parent.remove(o); m.decompose(o.position, o.quaternion, o.scale); });
    const merged = geoFromScene(cover, (o) => !o.isInstancedMesh);
    const out = new THREE.Group(); if (merged) out.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true })));
    keep.forEach((o) => out.add(o)); disposeTree(cover); scene.add(out); }
  // ---- boat, rod, line, lure, spray ----
  const boat = makeBoat({ paint: 0x1f3f8a, trim: 0xe8e6df }); boat.rotation.y = Math.PI / 2; boat.position.set(0.15, 0, 2.2); scene.add(boat);
  const rod = makeRod(); scene.add(rod);
  const line = makeLine(40); scene.add(line);
  const spray = makeSpray(500); scene.add(spray);
  const precip = makePrecip(high ? 1800 : 900); scene.add(precip);
  const lures = {}; const lureFor = (type, color) => { const k = type + '|' + color; if (!lures[k]) { lures[k] = makeLure(type, LURE_HEX[color] || 0xf2a541); scene.add(lures[k]); } return lures[k]; };
  // aim ring on the water
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xf6f3ec, transparent: true, opacity: 0.85, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 4; scene.add(ring);
  const cross = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xf6f3ec, transparent: true, opacity: 0.9, depthWrite: false })); cross.rotation.x = -Math.PI / 2; cross.renderOrder = 4; scene.add(cross);
  scene.userData.noRefl = [line, spray, precip, ring, cross]; // the fish mesh joins this list when it is created
  // ---- water ----
  const water = makeSpotWater(o, sc, L, res, toLake, bedDepth, shoreZ, high);
  scene.add(water.mesh);
  return { key: o.key, lakeId: o.lakeId, spotId: o.spotId, month: o.month, scene, camera, sky, hemi, sun, terrain, bank, trees, fol, cover, boat, rod, line, spray, precip, lureFor, lures, ring, cross, water, sc, shoreZ, bedDepth, time: 0, fishMesh: null, fishSp: null, fitKey: '', toLake };
}
const rnd = (r, a, b) => a + r() * (b - a);
function terrainUniforms() {
  return { sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, sunI: { value: 1 }, ambCol: { value: new THREE.Color(0.4, 0.45, 0.5) }, ambI: { value: 1 }, fogCol: { value: new THREE.Color(0.7, 0.8, 0.9) }, fogD: { value: 0.0002 }, zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, time: { value: 0 } };
}

// The dam at a riprap or tailrace spot: concrete gravity (Carpenter), Ambursen buttresses (Remmel), or a grassy
// earth embankment with a riprap face (Blakely Mountain, DeGray).
function damFace(lakeId, sc, shoreZ) {
  const g = new THREE.Group(); const conc = new THREE.MeshLambertMaterial({ color: 0xd9d4c8 }), dark = new THREE.MeshLambertMaterial({ color: 0x6b675e });
  const z = shoreZ(0);
  const kind = sc.type === 'tailrace' ? 'gravity' : { catherine: 'buttress', hamilton: 'gravity', ouachita: 'earth', degray: 'earth' }[lakeId];
  if (kind === 'earth') {
    // riprap face: a stone texture painted on a canvas (tiles), the crest road with guard rail, a gated spillway
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = '#6f6a62'; x.fillRect(0, 0, 256, 256);
    let sd = 7; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 420; i++) { const g0 = 120 + rr() * 90; x.fillStyle = `rgb(${g0 + 6},${g0},${g0 - 8})`; x.beginPath(); x.ellipse(rr() * 256, rr() * 256, 6 + rr() * 9, 4 + rr() * 6, rr() * 3, 0, 7); x.fill(); x.strokeStyle = 'rgba(40,36,32,0.6)'; x.lineWidth = 1.2; x.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(60, 6); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.own = true;
    const slope = new THREE.Mesh(new THREE.BoxGeometry(600, 0.6, 64), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x1e1c19 })); slope.rotation.x = -0.46; slope.position.set(0, 13, z - 30); g.add(slope);
    const top = new THREE.Mesh(new THREE.BoxGeometry(600, 2, 12), new THREE.MeshLambertMaterial({ color: 0x7d8c52, emissive: 0x1a1f10 })); top.position.set(0, 27, z - 62); g.add(top);
    const road = new THREE.Mesh(new THREE.BoxGeometry(600, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0x4e5054 })); road.position.set(0, 28.1, z - 62); g.add(road);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(600, 0.25, 0.2), new THREE.MeshLambertMaterial({ color: 0xd8d4cc, emissive: 0x303030 })); rail.position.set(0, 29, z - 59.2); g.add(rail);
    for (let i = -40; i <= 40; i++) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), rail.material); post.position.set(i * 7, 28.6, z - 59.2); g.add(post); }
    const spill = new THREE.Group(); const conc = new THREE.MeshLambertMaterial({ color: 0xd9d4c8, emissive: 0x2a2a28 });
    const sw = new THREE.Mesh(new THREE.BoxGeometry(46, 30, 14), conc); sw.position.set(0, 15, 0); spill.add(sw);
    for (let k = -2; k <= 2; k++) { const gate = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 0.8), new THREE.MeshLambertMaterial({ color: 0x5c5a55 })); gate.position.set(k * 9, 24, 7.2); spill.add(gate); }
    const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 10), conc); tower.position.set(30, 32, 0); spill.add(tower);
    spill.position.set(95, 0, z - 40); g.add(spill);
  } else {
    // the dam face is the shore at a riprap spot: it rises straight out of the water
    const tail = sc.type === 'tailrace'; const h = tail ? 30 : kind === 'buttress' ? 14 : 20; const zw = z - (tail ? 6 : 16);
    // weathered concrete: form-board pour lines, vertical streaks, a dark wet band at the bottom
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 256; const cx = cc.getContext('2d');
    cx.fillStyle = '#a49e92'; cx.fillRect(0, 0, 256, 256); let sd2 = 11; const rr2 = () => ((sd2 = (sd2 * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 60; i++) { cx.fillStyle = `rgba(${rr2() < 0.5 ? '60,55,48' : '200,196,186'},${0.05 + rr2() * 0.12})`; cx.fillRect(rr2() * 256, 0, 2 + rr2() * 10, 256); }
    cx.fillStyle = 'rgba(40,36,30,0.35)'; for (let y = 0; y < 256; y += 32) cx.fillRect(0, y, 256, 2);
    const ctex = new THREE.CanvasTexture(cc); ctex.wrapS = ctex.wrapT = THREE.RepeatWrapping; ctex.repeat.set(16, 2); ctex.colorSpace = THREE.SRGBColorSpace; ctex.userData.own = true;
    const concM = new THREE.MeshLambertMaterial({ map: ctex, color: 0xd8d2c6 });
    if (kind === 'buttress' && !tail) { // Ambursen flat-slab deck: a concrete slab sloping up and away from the water
      const deck = new THREE.Mesh(new THREE.BoxGeometry(260, 0.8, h * 1.6), concM); deck.rotation.x = -0.62; deck.position.set(0, h / 2 - 1, zw - h * 0.62); g.add(deck);
      const walk = new THREE.Mesh(new THREE.BoxGeometry(260, 1.2, 3), concM); walk.position.set(0, h - 0.6, zw - h * 1.28); g.add(walk);
      for (let i = -13; i <= 13; i++) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), dark); post.position.set(i * 10, h + 0.5, zw - h * 1.28 + 1.2); g.add(post); }
    } else {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(240, h, 6), concM); wall.position.set(0, h / 2 - 2, zw); g.add(wall);
      for (let i = -6; i <= 6; i++) { const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6, 6), concM); pier.position.set(i * 9, h + 1, zw); g.add(pier); const gate = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.2, 0.6), dark); gate.position.set(i * 9 + 4.5, h - 0.8, zw + 3.1); g.add(gate); }
      const wall2 = wall; void wall2;
    }
    const wall = { position: { z: zw } };
    if (sc.type === 'tailrace') for (let i = 0; i < 5; i++) { const ot = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 1), dark); ot.position.set(-24 + i * 12, 0.6, wall.position.z + 3.2); g.add(ot); }
  }
  return g;
}

// Spot water: planar reflection (high tier), clarity from the sim's weather, depth from the local bed, waves,
// ripples (cast splash, jumps), rain rings, a shoreline wet edge.
function makeSpotWater(o, sc, L, res, toLake, bedDepth, shoreZ, high) {
  const size = 8000; const geo = new THREE.PlaneGeometry(size, size, 1, 1); geo.rotateX(-Math.PI / 2);
  // local bed depth and shore distance over the near field (X −150…150, Z −160…40), 128²
  const N = 128, D = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const X = lerp(-150, 150, i / (N - 1)), Z = lerp(-160, 40, j / (N - 1)); const k = (j * N + i) * 4;
    const back = sc.shore ? shoreZ(X) - Z : -999; const d = back > 0 ? 0 : bedDepth(X, Z);
    D[k] = clamp(Math.round(d / 30 * 255), 0, 255); D[k + 1] = clamp(Math.round(-back * 3), 0, 255); D[k + 2] = back > 0 ? 255 : 0; D[k + 3] = 255;
  }
  const bedTex = new THREE.DataTexture(D, N, N, THREE.RGBAFormat); bedTex.magFilter = THREE.LinearFilter; bedTex.minFilter = THREE.LinearFilter; bedTex.needsUpdate = true;
  const rt = high ? new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType }) : null;
  const clarity = (o.weather && o.weather.clarity) || 'stained';
  const vis = { clear: 4.2, stained: 1.6, muddy: 0.55 }[clarity];
  const body = { clear: [0.08, 0.27, 0.32], stained: [0.12, 0.24, 0.19], muddy: [0.30, 0.26, 0.18] }[clarity];
  const uniforms = {
    ...terrainUniforms(), bedTex: { value: bedTex }, refl: { value: rt ? rt.texture : null }, useRefl: { value: rt ? 1 : 0 }, texMat: { value: new THREE.Matrix4() },
    vis: { value: vis }, body: { value: new THREE.Color().setRGB(...body, THREE.SRGBColorSpace) }, wind: { value: 0.5 }, rain: { value: 0 },
    rip: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -10, 0)) }, current: { value: sc.current ? 1 : 0 }, gen: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `uniform mat4 texMat; varying vec3 vW; varying vec4 vR; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vR = texMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform sampler2D bedTex, refl; uniform float useRefl, vis, wind, rain, time, sunI, ambI, fogD, current, gen; uniform vec3 body, sunDir, sunCol, ambCol, fogCol, zen, hor; uniform vec4 rip[8];
      varying vec3 vW; varying vec4 vR;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      vec2 gn(vec2 p){ float e = 0.35; return vec2(n2(p + vec2(e,0.0)) - n2(p - vec2(e,0.0)), n2(p + vec2(0.0,e)) - n2(p - vec2(0.0,e))) / (2.0*e); }
      void main(){
        vec2 bu = vec2((vW.x + 150.0) / 300.0, (vW.z + 160.0) / 200.0);
        vec4 bd = texture2D(bedTex, clamp(bu, 0.0, 1.0));
        float inside = step(0.0, bu.x) * step(bu.x, 1.0) * step(0.0, bu.y) * step(bu.y, 1.0);
        if (inside > 0.5 && bd.b > 0.6) discard; // under the bank
        float depth = mix(25.0, bd.r * 30.0, inside);
        float dist = length(vW - cameraPosition);
        float fade = clamp(1.0 - dist / 260.0, 0.0, 1.0);
        vec2 flow = vec2(0.0, current * (0.4 + gen * 1.6) * time);
        vec2 g = gn(vW.xz * 0.55 + vec2(time * 0.25, time * 0.17) - flow) * 0.6 + gn(vW.xz * 1.6 - vec2(time * 0.4, -time * 0.3) - flow * 2.0) * 0.35 + gn(vW.xz * 4.5 + time * 0.7) * 0.15 * fade;
        g *= (0.25 + wind) * (0.35 + 0.65 * fade);
        // expanding rings from splashes and jumps
        for (int i = 0; i < 8; i++) { vec4 r = rip[i]; float age = time - r.z; if (age < 0.0 || age > 3.0) continue;
          vec2 d = vW.xz - r.xy; float l = length(d); float wv = sin((l - age * 2.2) * 9.0) * exp(-abs(l - age * 2.2) * 2.5) * exp(-age * 1.2) * r.w;
          g += d / max(l, 0.01) * wv * 0.9; }
        // rain rings
        if (rain > 0.0) { vec2 c = floor(vW.xz * 1.6); vec2 f = fract(vW.xz * 1.6) - 0.5; float ph = fract(h2(c) + time * 1.3); float rr = length(f - (vec2(h2(c+3.1), h2(c+7.7)) - 0.5) * 0.6);
          g += normalize(f + 1e-4) * sin((rr - ph * 0.45) * 46.0) * (1.0 - ph) * (1.0 - ph) * smoothstep(0.3, 0.0, rr) * 0.09 * rain * fade * fade; }
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 skyc = mix(hor, zen, pow(clamp(R.y, 0.0, 1.0), 0.5));
        vec3 rc = skyc;
        if (useRefl > 0.5) { vec4 q = vR; q.xy += N.xz * 0.6 * q.w * 0.06; rc = mix(skyc, texture2DProj(refl, q).rgb, 0.9); }
        fres = clamp(fres * 1.25 + 0.05, 0.0, 1.0);
        vec3 lightCol = ambCol * ambI * 0.75 + sunCol * sunI * 0.35 * max(sunDir.y, 0.0);
        vec3 deepC = body * lightCol;
        float a = 1.0 - exp(-depth / vis);                       // how much of the bed the water hides
        a = max(a, fres);
        vec3 col = mix(deepC, rc, fres);
        vec3 H = normalize(normalize(sunDir) + V);
        col += sunCol * sunI * pow(max(dot(N, H), 0.0), 380.0) * 2.5;
        // wet edge and a little foam against the bank / rocks
        float shoreM = bd.g * 255.0 / 3.0; float edge = inside * smoothstep(0.7, 0.0, shoreM) * step(bd.b, 0.5);
        col = mix(col, vec3(0.45, 0.47, 0.43), edge * (0.2 + 0.25 * n2(vW.xz * 3.0 + time)));
        a = max(a, edge);
        float f = 1.0 - exp(-dist * fogD);
        gl_FragColor = vec4(mix(col, fogCol, f), mix(a, 1.0, f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 3; mesh.frustumCulled = false;
  // reflection camera (mirror across y = 0, Reflector-style with an oblique clip plane)
  const virt = new THREE.PerspectiveCamera(); const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const renderRefl = (renderer, scene, cam) => {
    if (!rt) return;
    virt.copy(cam); virt.position.set(cam.position.x, -cam.position.y, cam.position.z);
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); const tgt = cam.position.clone().add(look); tgt.y = -tgt.y;
    virt.up.set(0, 1, 0).applyQuaternion(cam.quaternion); virt.up.y = -virt.up.y; virt.lookAt(tgt); virt.updateMatrixWorld();
    virt.projectionMatrix.copy(cam.projectionMatrix);
    // oblique near plane at the water so nothing below the surface reflects
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0).applyMatrix4(virt.matrixWorldInverse);
    const cp = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant); const pm = virt.projectionMatrix; const q = new THREE.Vector4();
    q.x = (Math.sign(cp.x) + pm.elements[8]) / pm.elements[0]; q.y = (Math.sign(cp.y) + pm.elements[9]) / pm.elements[5]; q.z = -1; q.w = (1 + pm.elements[10]) / pm.elements[14];
    cp.multiplyScalar(2 / cp.dot(q)); pm.elements[2] = cp.x; pm.elements[6] = cp.y; pm.elements[10] = cp.z + 1; pm.elements[14] = cp.w;
    uniforms.texMat.value.copy(bias).multiply(virt.projectionMatrix).multiply(virt.matrixWorldInverse);
    const hide = scene.userData.noRefl || []; const was = hide.map((o) => o.visible); hide.forEach((o) => { o.visible = false; });
    mesh.visible = false; const old = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, virt); renderer.setRenderTarget(old); mesh.visible = true;
    hide.forEach((o, i) => { o.visible = was[i]; });
  };
  return { mesh, uniforms, renderRefl, rt, ripN: 0 };
}

// ---------- per-frame ----------
// o: { lakeId, spotId, month, clock, weather, R (view rect), W, H, portrait, dt, reduced, fish (S.fish), gen }
export function renderSpot3D(o) {
  const key = `${o.lakeId}|${o.spotId}|${o.month}|${o.weather && o.weather.clarity}|${GFX.tier}`;
  if (!S3 || S3.key !== key) { if (S3) disposeTree(S3.scene); o.key = key; S3 = build(o); }
  const s = S3, r = GFX.renderer, F = o.fish;
  if (!o.reduced) s.time += o.dt;
  // camera over the bow, composed into the view rect
  const fk = `${o.W}x${o.H}|${o.R.x},${o.R.y},${o.R.w},${o.R.h}`;
  if (s.fitKey !== fk) {
    s.fitKey = fk; const cam = s.camera; const portrait = o.R.h > o.R.w * 1.1;
    cam.aspect = o.W / o.H;
    const hfov = portrait ? 62 : 58; const rAsp = o.R.w / o.R.h; const vfov = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / rAsp) * 180 / Math.PI;
    cam.fov = clamp(vfov * (o.H / o.R.h), 30, 110); // the full-screen fov that gives this fov inside the rect
    cam.position.set(portrait ? 0.3 : 0.42, portrait ? 2.3 : 2.25, portrait ? 1.1 : 2.7);
    s.look0 = new THREE.Vector3(0, portrait ? -0.7 : 0.15, -15); s.look = s.look0.clone(); s.fov0 = cam.fov; s.zoom = 0;
    cam.lookAt(s.look0);
    cam.updateProjectionMatrix();
    const offX = (o.W / 2) - (o.R.x + o.R.w / 2), offY = (o.H / 2) - (o.R.y + o.R.h / 2);
    cam.setViewOffset(o.W, o.H, offX, offY, o.W, o.H); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    s.portrait = portrait;
  }
  // punch in on a jumping fish, ease back afterwards
  { const fi = F && F.phase === 'fight' && F.fight; const want = fi && fi.jump > 0 && !o.reduced ? 1 : 0; s.zoom += (want - s.zoom) * Math.min(1, o.dt * (want ? 6 : 2.5));
    const cam = s.camera; let tgt = s.look0;
    if (fi && s.zoom > 0.001) { const [X, Z] = toW(fi.x, fi.y); tgt = s.look0.clone().lerp(V.a.set(X, 0.8, Z), 0.75 * s.zoom); }
    cam.lookAt(tgt); const f = s.fov0 * (1 - 0.55 * s.zoom); if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); } cam.updateMatrixWorld(); }
  const lt = lightFor(o.clock, o.month, o.weather, { mist: (o.month <= 3 || o.month >= 10) && o.clock < 9 * 60 });
  if (s.terrain) { applyLight(s.terrain.material, lt, s.time); s.terrain.material.uniforms.fogD.value = 0.00045 * lt.fogDensity; }
  for (const m of [s.bank.material, s.water.mesh.material]) applyLight(m, lt, s.time);
  s.bank.material.uniforms.fogD.value = 0.00045 * lt.fogDensity; s.water.mesh.material.uniforms.fogD.value = 0.00045 * lt.fogDensity;
  s.sky.update(lt, s.time); s.sky.position.copy(s.camera.position);
  s.hemi.intensity = 0.6 + lt.ambI * 1.1; setC(s.hemi.color, lt.zen.map((v) => v * 0.6 + 0.35)); setC(s.hemi.groundColor, [0.25, 0.27, 0.18]);
  s.sun.position.set(lt.sun.v[0] * 200, Math.max(0.05, lt.sun.v[1]) * 200, lt.sun.v[2] * 200); setC(s.sun.color, lt.sunCol); s.sun.intensity = lt.sunI * 1.1 + lt.moon * 0.15;
  if (s.fol.userData.sh) { s.fol.userData.sh.uniforms.time.value = s.time; s.fol.userData.sh.uniforms.wind.value = 0.3 + ((o.weather && o.weather.wind) || 6) / 14; }
  const wu = s.water.uniforms; wu.wind.value = 0.25 + ((o.weather && o.weather.wind) || 6) / 22; wu.rain.value = /rain|storm/.test(lt.sky) ? 1 : 0; wu.gen.value = o.gen ? 1 : 0;
  r.setClearColor(V.clear.setRGB(...lt.fog, THREE.SRGBColorSpace));
  r.toneMappingExposure = 1.1 + (1 - lt.day) * 0.25 + lt.cloud * 0.12;
  // ---- the fishing state ----
  const cam = s.camera; const rodButt = V.a.set(0.36, -0.62, -0.75).applyMatrix4(cam.matrixWorld);
  s.rodUp = (s.rodUp || 0) + (((F && F.phase === 'fight') ? 1 : 0) - (s.rodUp || 0)) * Math.min(1, o.dt * 5);
  const rodDir = V.b.set(-0.16 - 0.18 * s.rodUp, 0.3 + 0.95 * s.rodUp, -1 + 0.25 * s.rodUp).normalize().transformDirection(cam.matrixWorld);
  let target = null, sag = 0.6, tension = 0;
  const lureType = F ? (LURES[F.lure] ? (LURES[F.lure].type || F.lure) : F.lure) : 'craw';
  for (const k in s.lures) s.lures[k].visible = false;
  s.ring.visible = s.cross.visible = false;
  if (F) {
    if (F.phase === 'aim') {
      const [X, Z] = toW(F.aim.x, F.aim.y); const ringK = F.charge != null ? ringAt(F.charge) : 1; const rad = 0.6 + ringK * 2.4;
      s.ring.visible = s.cross.visible = true; s.ring.position.set(X, 0.03, Z); s.ring.scale.setScalar(rad); s.cross.position.set(X, 0.035, Z);
      s.ring.material.color.set(F.charge != null && ringK < 0.15 ? 0xf2a541 : 0xf6f3ec);
    }
    if (F.phase === 'flight' && F.flight) {
      const fl = F.flight, u = clamp(fl.t / fl.dur, 0, 1); const [X0, Z0] = toW(fl.x0, fl.y0), [X1, Z1] = toW(fl.x1, fl.y1);
      const tip = s.rod.pose(rodButt, rodDir, 2.1, V.c.set(0, 0, 0), 0);
      const p = V.c.set(lerp(tip.x, X1, u), lerp(tip.y, 0.05, u) + Math.sin(u * Math.PI) * (2 + Math.hypot(X1 - X0, Z1 - Z0) * 0.12), lerp(tip.z, Z1, u));
      const lm = s.lureFor(lureType, F.color); lm.visible = true; lm.position.copy(p); target = p.clone(); sag = 0.15;
    }
    if ((F.phase === 'retrieve' || F.phase === 'bite' || F.phase === 'snag' || F.phase === 'back') && F.lureP) {
      const [X, Z] = toW(F.lureP.x, F.lureP.y); const dm = (F.lureP.depth || 0) * 0.3048;
      const lm = s.lureFor(lureType, F.color); lm.visible = true; lm.position.set(X, -dm + (dm < 0.05 ? 0.02 : 0), Z);
      if (F.phase === 'bite') { lm.position.x += Math.sin(s.time * 60) * 0.05; }
      lm.rotation.y = Math.atan2(-X, -Z) + Math.PI / 2; if (lm.userData.blade) lm.userData.blade.rotation.x = s.time * 30;
      target = V.c.set(X, Math.min(0, -dm), Z).clone(); sag = F.reel ? 0.08 : 0.45; tension = F.reel ? 0.3 : 0;
    }
    if (F.phase === 'fight' && F.fight) {
      const fi = F.fight; const [X, Z] = toW(fi.x, fi.y); tension = fi.tension;
      const fm = fishFor(s, fi.sp, fi.w); fm.visible = true;
      const jumping = fi.jump > 0; const u = jumping ? 1 - fi.jump / 0.7 : 0;
      const yy = jumping ? Math.sin(u * Math.PI) * (0.8 + Math.sqrt(fi.w) * 0.35) : -0.35 - (1 - fi.stamina) * 0.1;
      fm.position.set(X, yy, Z); if (jumping) fm.scale.multiplyScalar(1.35); fm.rotation.set(0, Math.atan2(fi.heading >= 0 ? 1 : -1, 0) * 0 + (fi.heading >= 0 ? 0 : Math.PI), jumping ? (u - 0.5) * 1.4 : 0);
      fm.material.uniforms.swim.value = jumping ? 2.5 : 1 + (fi.surge > 0 ? 1.5 : 0); fm.material.uniforms.murk.value = jumping ? 0 : 0.55;
      if (jumping && !s.wasJump) { s.spray.burst(X, 0.05, Z, 70, 2.2, 3.5, 0.09); addRipple(s, X, Z, 1.6); }
      if (!jumping && s.wasJump) { s.spray.burst(X, 0.05, Z, 90, 2.6, 2.8, 0.1); addRipple(s, X, Z, 2); }
      s.wasJump = jumping;
      if (!jumping && !o.reduced && Math.random() < 0.15) addRipple(s, X, Z, 0.5 + (fi.surge > 0 ? 0.7 : 0));
      target = V.c.set(X, yy + 0.2, Z).clone(); sag = clamp(0.5 - tension * 0.6, 0, 0.5);
    } else if (F.phase === 'retrieve' && F.follow && F.lureP) {
      // a fish trailing the lure (seen through clear water and in the underwater view)
      const [X, Z] = toW(F.lureP.x + F.follow.ox, F.lureP.y); const dm = (F.lureP.depth || 0) * 0.3048;
      const fm = fishFor(s, F.follow.sp, 2.5); fm.visible = true; fm.position.set(X, -dm - 0.15, Z - 0.9);
      fm.rotation.set(0, Math.atan2(-X, -Z) + Math.PI / 2 + Math.PI, 0); fm.material.uniforms.swim.value = 0.8; fm.material.uniforms.murk.value = 0.65;
    } else if (s.fishMesh) { s.fishMesh.visible = false; s.wasJump = false; }
    if (F.phase === 'landed' && F.catch) {
      const fm = fishFor(s, F.catch.sp, F.catch.w); fm.visible = true; fm.position.set(0.25, 1.6, -1.6); fm.rotation.set(0, Math.PI, 0.25); fm.material.uniforms.murk.value = 0; fm.material.uniforms.swim.value = 0.6;
      target = V.c.set(0.25, 1.9, -1.6).clone(); sag = 0;
    }
  }
  // rod bend follows the line: toward the target, harder with tension
  let bend = V.b.clone().multiplyScalar(0);
  if (target) {
    const tipRest = V.a.clone().addScaledVector(rodDir, 2.1); const pull = target.clone().sub(tipRest).normalize();
    pull.addScaledVector(rodDir, -pull.dot(rodDir)); // keep only the part across the rod: that's what loads it into a curve
    const surge = F && F.fight && F.fight.surge > 0 && !o.reduced ? Math.sin(s.time * 31) * 0.06 : 0;
    bend = pull.normalize().multiplyScalar(0.08 + tension * (0.85 + 0.35 * s.rodUp) + surge); bend.y -= tension * 0.35;
  }
  const tip = s.rod.pose(V.a.clone(), rodDir.clone(), 2.1, bend, F && F.reel ? s.time * 14 : 0);
  if (target) { s.line.visible = true; s.line.set(tip, target, sag); s.line.material.uniforms.res.value.set(o.W, o.H); s.line.material.uniforms.width.value = 1.5; s.line.material.uniforms.col.value.set(tension > 0.85 ? 0xff6a5a : 0xf5e9a8); }
  else s.line.visible = false;
  // ripples and spray
  const wet = /rain|storm/.test(lt.sky), snow = lt.sky === 'snow';
  s.precip.visible = (wet || snow) && !o.reduced; s.precip.position.set(cam.position.x, 0, cam.position.z);
  s.precip.material.uniforms.time.value = s.time; s.precip.material.uniforms.snow.value = snow ? 1 : 0; s.precip.material.uniforms.amount.value = lt.sky === 'storm' ? 1 : 0.7; s.precip.material.uniforms.light.value = 0.5 + lt.day * 0.5;
  s.spray.step(o.reduced ? 0 : o.dt); s.spray.material.uniforms.light.value = 0.45 + lt.day * 0.55; s.spray.material.uniforms.scale.value = o.H * 0.9;
  wu.time.value = s.time;
  // render: reflection pass, then the scene
  s.water.renderRefl(r, s.scene, cam);
  r.render(s.scene, cam);
  s.uw = null;
  if (o.underwater && F && ((F.phase === 'retrieve' && F.lureP) || (F.phase === 'fight' && F.fight && !(F.fight.jump > 0)))) s.uw = renderUnderwater(s, r, o, F, lt);
  return true;
}

// Underwater camera inset: looks at the lure (or the hooked fish) from beside it, below the surface, with murk from
// the water's clarity. Drawn into a scissored corner of the same canvas.
const UW_FOG = { clear: [0.10, 0.32, 0.38], stained: [0.16, 0.26, 0.18], muddy: [0.30, 0.25, 0.16] };
function renderUnderwater(s, r, o, F, lt) {
  const rect = o.underwater; const clarity = (o.weather && o.weather.clarity) || 'stained';
  const vis = { clear: 5.5, stained: 2.6, muddy: 1.1 }[clarity];
  let X, Y, Z;
  if (F.phase === 'fight') { [X, Z] = toW(F.fight.x, F.fight.y); Y = -0.35; } else { [X, Z] = toW(F.lureP.x, F.lureP.y); Y = -(F.lureP.depth || 0) * 0.3048; }
  Y = Math.min(-0.15, Y);
  if (!s.uwCam) s.uwCam = new THREE.PerspectiveCamera(55, 1.5, 0.05, 80);
  const c = s.uwCam; const bed = -s.bedDepth(X, Z);
  c.aspect = rect.w / rect.h; c.fov = 50; c.position.set(X + 0.75, Math.max(bed + 0.25, Math.min(-0.2, Y + 0.12)), Z + 0.95); c.lookAt(X, Y, Z); c.updateProjectionMatrix();
  const fogc = UW_FOG[clarity].map((v) => v * (0.35 + 0.65 * lt.day));
  const sky = s.sky.visible; s.sky.visible = false; s.water.mesh.visible = false; s.precip.visible = false; s.ring.visible = false; s.line.visible = false;
  const oldFog = s.scene.fog; V.fog.color.setRGB(...fogc, THREE.SRGBColorSpace); V.fog.density = 1.6 / vis; s.scene.fog = V.fog;
  const fogMats = s.fogMats || (s.fogMats = [s.bank.material, s.terrain && s.terrain.material].filter(Boolean)); const saved = s.fogSaved || (s.fogSaved = fogMats.map(() => [0, new THREE.Color()]));
  fogMats.forEach((m, i) => { saved[i][0] = m.uniforms.fogD.value; saved[i][1].copy(m.uniforms.fogCol.value); m.uniforms.fogD.value = 1.6 / vis; m.uniforms.fogCol.value.setRGB(...fogc, THREE.SRGBColorSpace); });
  if (s.fishMesh) { s.fishMurk = s.fishMesh.material.uniforms.murk.value; s.fishMesh.material.uniforms.murk.value = 0.12; s.fishMesh.material.uniforms.murkCol.value.setRGB(...fogc, THREE.SRGBColorSpace); }
  const H = o.H; const y = H - rect.y - rect.h;
  r.setScissorTest(true); r.setScissor(rect.x, y, rect.w, rect.h); r.setViewport(rect.x, y, rect.w, rect.h);
  r.setClearColor(V.c2.setRGB(...fogc, THREE.SRGBColorSpace)); r.clear();
  r.render(s.scene, c);
  r.setScissorTest(false); r.setViewport(0, 0, o.W, o.H);
  s.scene.fog = oldFog; fogMats.forEach((m, i) => { m.uniforms.fogD.value = saved[i][0]; m.uniforms.fogCol.value.copy(saved[i][1]); });
  if (s.fishMesh && s.fishMurk != null) s.fishMesh.material.uniforms.murk.value = s.fishMurk;
  s.sky.visible = sky; s.water.mesh.visible = true; s.line.visible = true;
  return rect;
}
export const underwaterRect = () => (S3 && S3.uw) || null;
function addRipple(s, X, Z, k = 1) { const u = s.water.uniforms.rip.value; u[s.water.ripN++ % 8].set(X, Z, s.time, k); }
export function splash3D(x, y, big) { if (!S3) return; const [X, Z] = toW(x, y); addRipple(S3, X, Z, big ? 1.6 : 0.8); S3.spray.burst(X, 0.05, Z, big ? 60 : 26, big ? 2 : 1.2, big ? 3 : 1.8, big ? 0.08 : 0.05); }
function fishFor(s, sp, w) {
  if (s.fishMesh && s.fishSp === sp) { const k = fishLen(sp, w); s.fishMesh.scale.setScalar(k); return s.fishMesh; }
  if (s.fishMesh) { s.scene.remove(s.fishMesh); s.fishMesh.geometry.dispose(); s.fishMesh.material.dispose(); }
  const t = fishTexture(sp); const m = new THREE.Mesh(fishGeo(t.aspect), fishMaterial(t.tex)); m.renderOrder = 1; s.scene.add(m); s.fishMesh = m; s.fishSp = sp;
  s.scene.userData.noRefl = s.scene.userData.noRefl.filter((o) => o.parent).concat([m]);
  m.scale.setScalar(fishLen(sp, w)); return m;
}
// body length (m) from weight: a rough length–weight fit, scaled up 1.6× so fish read at fishing distance
const fishLen = (sp, w) => clamp(0.24 * Math.cbrt(Math.max(0.2, w)) * (SPECIES[sp] ? SPECIES[sp].art.len : 1) * 1.6, 0.18, 1.8);

// screen ↔ spot space through the 3D camera (the water plane)
export function spotToScreen(x, y, depthFt = 0) {
  if (!S3) return null; const [X, Z] = toW(x, y); V.a.set(X, -depthFt * 0.3048, Z).project(S3.camera);
  return [(V.a.x + 1) / 2 * window.innerWidth, (1 - V.a.y) / 2 * window.innerHeight];
}
export function screenToSpot(px, py) {
  if (!S3) return null; V.v2.set(px / window.innerWidth * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  V.ray.setFromCamera(V.v2, S3.camera); const hit = V.ray.ray.intersectPlane(V.plane, V.b); if (!hit) return null;
  return { x: hit.x / P + 0.5, y: hit.z / P + 1 };
}
export const spot3DFor = (lakeId, spotId) => !!(S3 && S3.lakeId === lakeId && S3.spotId === spotId);
export function spotBusy() { return !!(S3 && S3.spray.busy()); }
export function dropSpot() { if (S3) { disposeTree(S3.scene); if (S3.water.rt) S3.water.rt.dispose(); S3 = null; } }
export function spotDebug() { if (!S3) return null; const p = S3.line.geometry.attributes.position.array; return { vis: S3.line.visible, a: [p[0], p[1], p[2]], b: [p[p.length - 3], p[p.length - 2], p[p.length - 1]], cam: S3.camera.position.toArray() }; }
export function fishDebug() { const m = S3 && S3.fishMesh; if (!m) return null; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; m.updateMatrixWorld();
  const pr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(m.matrixWorld).project(S3.camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; };
  return { vis: m.visible, pos: m.position.toArray().map((v) => Math.round(v * 100) / 100), scale: m.scale.x, rot: m.rotation.toArray().slice(0, 3), min: pr(bb.min.x, bb.min.y, 0), max: pr(bb.max.x, bb.max.y, 0), bb: [bb.min.toArray(), bb.max.toArray()] }; }
