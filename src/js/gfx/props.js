// Procedural props for the spot scene (metres): trees, rocks, docks/boathouses, laydowns, stumps, brush, grass,
// the rod, a screen-space fishing line, lures, a painted-plate fish and splash particles.
/* global THREE */
import { mergeGeo } from './util3d.js';

const rnd = (r, a, b) => a + r() * (b - a);
// colour each vertex of a geometry
function tint(geo, c) { const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; }
const C = (h) => new THREE.Color(h);
// a foliage blob with soft spherical normals and darker undersides (reads as a mass of leaves, not facets)
function blob(r, x, y, z, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position, n = g.attributes.normal; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const l = Math.hypot(vx, vy, vz) || 1; n.setXYZ(i, vx / l, vy / l, vz / l); const ao = 0.55 + 0.45 * (vy / l + 1) / 2; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.translate(x, y, z); return g;
}

// Wind-swayed instanced foliage material (vertex colours × instance colour, sway grows with height).
export function foliageMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.time = { value: 0 }; sh.uniforms.wind = { value: 0.5 }; m.userData.sh = sh;
    sh.vertexShader = 'uniform float time; uniform float wind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float sway = (sin(time * 1.3 + ip.x * 0.37 + ip.z * 0.21) + 0.5 * sin(time * 2.7 + ip.z)) * wind * 0.02 * max(position.y, 0.0);
        transformed.x += sway; transformed.z += sway * 0.6;
      #endif`);
  };
  return m;
}
// Shortleaf pine (the Ouachitas' native pine): tall bare trunk, a high irregular crown.
export function pineGeo() {
  const parts = [tint(new THREE.CylinderGeometry(0.12, 0.22, 9, 5).translate(0, 4.5, 0), C(0x4a3626))];
  // clumped needle masses on a high crown
  const cl = [[0, 10.2, 0, 1.9], [1.2, 9.4, 0.5, 1.3], [-1.1, 9.6, -0.4, 1.4], [0.4, 11.6, -0.3, 1.4], [-0.5, 12.6, 0.3, 1.0], [0.9, 8.6, -0.8, 1.0]];
  for (const [x, y, z, r] of cl) { const g = blob(r, x, y, z, 1); const c = g.attributes.color; for (let i = 0; i < c.count; i++) { const a = c.getX(i); c.setXYZ(i, a * 0.17, a * 0.29, a * 0.17); } parts.push(g); }
  return mergeGeo(parts);
}
// Oak / hickory: a rounded crown of a few blobs.
export function hardwoodGeo() {
  const parts = [tint(new THREE.CylinderGeometry(0.16, 0.3, 5, 5).translate(0, 2.5, 0), C(0x4d3b2b))];
  const blobs = [[0, 6.2, 0, 2.6], [1.3, 5.4, 0.4, 1.9], [-1.2, 5.6, -0.3, 2.0], [0.3, 7.2, -0.8, 1.7], [-0.4, 5.0, 1.2, 1.6]];
  for (const [x, y, z, r] of blobs) parts.push(blob(r, x, y, z));
  return mergeGeo(parts);
}
// Eastern redcedar (also the brush-pile cedar).
export function cedarGeo() {
  return mergeGeo([tint(new THREE.CylinderGeometry(0.1, 0.16, 2, 5).translate(0, 1, 0), C(0x5a4030)), tint(new THREE.ConeGeometry(1.4, 5.5, 8).translate(0, 4.2, 0), C(0x2c4a30))]);
}
// Understory bush: a squashed cluster of blobs.
export function bushGeo() { return mergeGeo([blob(0.9, 0, 0.6, 0), blob(0.6, 0.6, 0.45, 0.2), blob(0.55, -0.5, 0.4, -0.2)]); }
// A lake house: walls, a gable roof (vertex colours: walls white for instance tint, roof dark), facing +z.
export function houseGeo() {
  const walls = tint(new THREE.BoxGeometry(9, 4.5, 7).translate(0, 2.25, 0), C(0xffffff));
  const roof = new THREE.CylinderGeometry(0.01, 6.2, 3, 4, 1).rotateY(Math.PI / 4).scale(1.05, 1, 0.82).translate(0, 5.9, 0); tint(roof, C(0x5a4a42));
  const deck = tint(new THREE.BoxGeometry(7, 0.3, 3).translate(0, 1.2, 4.8), C(0x8a6a48));
  return mergeGeo([walls, roof, deck]);
}
// Novaculite and sandstone rocks.
export function rockGeo(seed = 1) {
  let s = seed * 9301; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  g.computeVertexNormals(); return tint(g, C(0xffffff));
}

// A scatter of instances: items [{x, y, z, s, ry, c}] → InstancedMesh with per-instance colour.
export function scatter(geo, mat, items) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)); const o = new THREE.Object3D();
  items.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); o.scale.setScalar(it.s || 1); if (it.sy) o.scale.y *= it.sy; o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, it.c || C(0xffffff)); });
  m.count = items.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  return m;
}

// Hamilton-style covered boathouse on pilings with a walkway from the bank. Built along −z, then turned to face
// the water (+z) so it stands out over the lake.
export function boathouse(len, w, rng) {
  const out = new THREE.Group(); const g0 = boathouseInner(len, w, rng); g0.rotation.y = Math.PI; out.add(g0); return out;
}
function boathouseInner(len, w, rng) {
  const g = new THREE.Group(); const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a48 }), dark = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });
  const roofCol = [0x7a8a94, 0x3f5a46, 0x8c3b2e, 0xb8b2a6][Math.floor(rng() * 4)];
  const roof = new THREE.MeshLambertMaterial({ color: roofCol });
  const deckL = Math.min(len * 0.55, 9), walkL = len - deckL;
  const walk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, walkL), wood); walk.position.set(0, 0.7, -walkL / 2); g.add(walk);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, deckL), wood); deck.position.set(0, 0.7, -walkL - deckL / 2); g.add(deck);
  for (let z = 0; z <= len; z += 2.6) for (const x of z < walkL ? [-0.6, 0.6] : [-w / 2, w / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.5, 5), dark); p.position.set(x, -1, -z); g.add(p); }
  const posts = [[-w / 2, -walkL - 0.3], [w / 2, -walkL - 0.3], [-w / 2, -len + 0.3], [w / 2, -len + 0.3]];
  for (const [x, z] of posts) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), wood); p.position.set(x, 2.0, z); g.add(p); }
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.08, deckL + 0.6), roof); r1.position.set(-w * 0.24, 3.55, -walkL - deckL / 2); r1.rotation.z = 0.32; g.add(r1);
  const r2 = r1.clone(); r2.position.x = w * 0.24; r2.rotation.z = -0.32; g.add(r2);
  if (rng() < 0.6) { const lift = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.1, deckL * 0.7), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })); lift.position.set(0, 1.1, -walkL - deckL / 2); g.add(lift); }
  return g;
}

// Fallen tree reaching from the bank into the water.
export function laydown(len, rng) {
  const g = new THREE.Group(); const bark = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, len, 6), bark); trunk.rotation.x = Math.PI / 2; trunk.position.z = -len / 2; g.add(trunk);
  for (let i = 0; i < 7; i++) { const t = 0.25 + i * 0.1, bl = rnd(rng, 1, 2.4); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, bl, 4), bark); b.position.set((i % 2 ? 1 : -1) * bl * 0.4, rnd(rng, -0.2, 0.5), -len * t); b.rotation.z = (i % 2 ? -1 : 1) * rnd(rng, 0.7, 1.2); g.add(b); }
  return g;
}

// ---------- rod: a tapered tube whose bend follows the line ----------
export function makeRod() {
  const seg = 18, rad = 6; const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((seg + 1) * rad * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const idx = []; for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b = i * rad + (j + 1) % rad; idx.push(a, a + rad, b, b, a + rad, b + rad); } geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.2, roughness: 0.35 });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const reel = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 })); body.rotation.z = Math.PI / 2; reel.add(body);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x222222 })); handle.position.set(0.06, 0, 0); reel.add(handle);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.28, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }));
  const g = new THREE.Group(); g.add(mesh, reel, grip); g.userData = { mesh, reel, grip, handle };
  const P = [], tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= seg; i++) P.push(new THREE.Vector3());
  // butt, rest direction (unit), length, bend vector (world offset of the tip), reel spin
  g.pose = (butt, dir, len, bend, spin) => {
    for (let i = 0; i <= seg; i++) { const t = i / seg; P[i].copy(butt).addScaledVector(dir, len * t).addScaledVector(bend, t * t * (1.6 - 0.6 * t)); }
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; const r = 0.012 * (1 - t) + 0.0022 * t; const a = P[Math.max(0, i - 1)], b = P[Math.min(seg, i + 1)];
      tmp.subVectors(b, a).normalize(); const n1 = new THREE.Vector3().crossVectors(tmp, up).normalize(); const n2 = new THREE.Vector3().crossVectors(n1, tmp);
      for (let j = 0; j < rad; j++) { const th = j / rad * Math.PI * 2; const o = (i * rad + j) * 3; pos[o] = P[i].x + (n1.x * Math.cos(th) + n2.x * Math.sin(th)) * r; pos[o + 1] = P[i].y + (n1.y * Math.cos(th) + n2.y * Math.sin(th)) * r; pos[o + 2] = P[i].z + (n1.z * Math.cos(th) + n2.z * Math.sin(th)) * r; }
    }
    geo.attributes.position.needsUpdate = true; if (!g.userData.normalsT || performance.now() - g.userData.normalsT > 120) { geo.computeVertexNormals(); g.userData.normalsT = performance.now(); }
    reel.position.copy(butt).addScaledVector(dir, 0.18).add(new THREE.Vector3(0, -0.05, 0)); reel.lookAt(P[4]); handle.rotation.x = spin;
    grip.position.copy(butt).addScaledVector(dir, 0.05); grip.quaternion.setFromUnitVectors(up, dir);
    return P[seg];
  };
  return g;
}

// ---------- fishing line: a ribbon with constant screen-space width ----------
export function makeLine(n = 32) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3), nxt = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('nxt', new THREE.BufferAttribute(nxt, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { res: { value: new THREE.Vector2(1, 1) }, width: { value: 1.6 }, col: { value: new THREE.Color(0xf2f4f0) }, alpha: { value: 0.9 } },
    vertexShader: `attribute vec3 nxt; attribute float side; uniform vec2 res; uniform float width;
      void main(){ vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vec4 b = projectionMatrix * modelViewMatrix * vec4(nxt, 1.0);
        vec2 sa = a.xy / a.w, sb = b.xy / b.w; vec2 d = normalize((sb - sa) * res + 1e-6); vec2 nrm = vec2(-d.y, d.x) / res * width * 2.0;
        a.xy += nrm * side * a.w; gl_Position = a; }`,
    fragmentShader: `uniform vec3 col; uniform float alpha; void main(){ gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  const tmp = new THREE.Vector3();
  // from a to b with sag (metres, downward), optional water-entry point: below the surface the line straightens
  mesh.set = (a, b, sag) => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1); tmp.lerpVectors(a, b, t); tmp.y -= sag * 4 * t * (1 - t);
      pos.set([tmp.x, tmp.y, tmp.z, tmp.x, tmp.y, tmp.z], i * 6);
    }
    for (let i = 0; i < n; i++) { const j = Math.min(n - 1, i + 1), k = i === n - 1 ? n - 2 : i; const src = i === n - 1 ? k : j; const f = i === n - 1 ? -1 : 1; void f; nxt.set(pos.subarray(src * 6, src * 6 + 6), i * 6); }
    // last point's "next" is mirrored so its direction stays valid
    const L = (n - 1) * 6, P = (n - 2) * 6; for (let c = 0; c < 3; c++) { nxt[L + c] = 2 * pos[L + c] - pos[P + c]; nxt[L + 3 + c] = nxt[L + c]; }
    geo.attributes.position.needsUpdate = true; geo.attributes.nxt.needsUpdate = true;
  };
  return mesh;
}

// ---------- lures (by type), a few centimetres long, shown scaled up a little for readability ----------
export function makeLure(type, color) {
  const g = new THREE.Group(); const col = new THREE.Color(color);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.1 });
  if (/craw|worm|tube|jig|dropshot|crawler|waxworm|dough/.test(type)) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.07, 4, 8), mat); b.rotation.z = Math.PI / 2; g.add(b);
    if (/jig/.test(type)) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })); h.position.x = 0.045; g.add(h); }
  } else if (/popper/.test(type)) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.06, 10), mat); b.rotation.z = Math.PI / 2; g.add(b);
  } else if (/spinner|swim/.test(type)) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mat); b.scale.set(1.8, 1, 1); g.add(b);
    const blade = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), new THREE.MeshStandardMaterial({ color: 0xd8d0b0, metalness: 0.9, roughness: 0.15, side: THREE.DoubleSide })); blade.scale.set(1.6, 1, 1); blade.position.set(0.04, 0.02, 0); g.add(blade); g.userData.blade = blade;
  } else { // crankbaits, jerkbaits
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), mat); b.scale.set(2.2, 1.1, 0.8); g.add(b);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 0.016), new THREE.MeshStandardMaterial({ color: 0xdddddd, transparent: true, opacity: 0.7 })); lip.position.set(0.045, -0.008, 0); lip.rotation.z = -0.6; g.add(lip);
  }
  g.scale.setScalar(2.6);
  return g;
}

// ---------- fish: a painted species plate on a bulged card, alpha-cut to the silhouette, swimming by a body wave ----------
export function fishMaterial(tex) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: false,
    uniforms: { map: { value: tex }, time: { value: 0 }, swim: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, light: { value: 1 }, murk: { value: 0 }, murkCol: { value: new THREE.Color(0.2, 0.3, 0.3) } },
    vertexShader: `uniform float time, swim; varying vec2 vUv; varying vec3 vN;
      void main(){ vUv = uv; vec3 p = position; float u = uv.x; // 0 tail → 1 head
        float bend = sin(u * 5.0 - time * 9.0) * (1.0 - u) * (1.0 - u) * 0.12 * swim; p.z += bend;
        vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 tint, sunDir, murkCol; uniform float light, murk; varying vec2 vUv; varying vec3 vN;
      void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.5) discard;
        float d = 0.65 + 0.45 * max(dot(normalize(vN), normalize(sunDir)), 0.0);
        vec3 col = mix(c.rgb * tint * d * light, murkCol, murk);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
// card geometry over the plate's rectangle (aspect w/h), bulged in the middle for body thickness
export function fishGeo(aspect, thick = 0.18) {
  const g = new THREE.PlaneGeometry(1, 1 / aspect, 24, 8); const p = g.attributes.position, uv = g.attributes.uv;
  const front = g.clone(); void front;
  for (let i = 0; i < p.count; i++) { const u = uv.getX(i), v = uv.getY(i); const body = Math.sin(Math.PI * Math.min(1, Math.max(0, (v - 0.22) / 0.56))) * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.08) / 0.84))); p.setZ(i, body * thick / aspect); }
  g.computeVertexNormals();
  const back = g.clone(); const bp = back.attributes.position; for (let i = 0; i < bp.count; i++) bp.setZ(i, -bp.getZ(i)); back.computeVertexNormals();
  // flip winding of the back so both faces point outward
  const bi = back.index.array; for (let i = 0; i < bi.length; i += 3) { const t = bi[i]; bi[i] = bi[i + 2]; bi[i + 2] = t; }
  return mergeGeo([g, back]);
}

// ---------- splash and spray particles ----------
export function makeSpray(max = 400) {
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(max * 3), vel = new Float32Array(max * 3), life = new Float32Array(max), size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('life', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { scale: { value: 400 }, light: { value: 1 } },
    vertexShader: `attribute float life; attribute float size; uniform float scale; varying float vL; void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z * step(0.001, life); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float light; varying float vL; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)) * clamp(vL * 2.0, 0.0, 1.0); gl_FragColor = vec4(vec3(0.93, 0.96, 0.97) * light, a * 0.9); }` });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 6; let head = 0;
  pts.burst = (x, y, z, n, speed, up, sz = 0.06) => { for (let i = 0; i < n; i++) { const k = head++ % max; const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8); pos.set([x, y, z], k * 3); vel.set([Math.cos(a) * s, up * (0.5 + Math.random() * 0.8), Math.sin(a) * s], k * 3); life[k] = 0.6 + Math.random() * 0.6; size[k] = sz * (0.6 + Math.random()); } geo.attributes.size.needsUpdate = true; };
  pts.step = (dt) => { let any = false; for (let k = 0; k < max; k++) { if (life[k] <= 0) continue; any = true; life[k] -= dt; vel[k * 3 + 1] -= 9.8 * dt; pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt; if (pos[k * 3 + 1] < 0) life[k] = 0; } geo.attributes.position.needsUpdate = true; geo.attributes.life.needsUpdate = true; return any; };
  pts.busy = () => { for (let k = 0; k < max; k++) if (life[k] > 0) return true; return false; };
  pts.clear = () => { life.fill(0); geo.attributes.life.needsUpdate = true; };
  return pts;
}

// Rain streaks or snowflakes in a box that follows the camera, animated entirely in the vertex shader.
export function makePrecip(n = 1600) {
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 2 * 3), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 24, z = -Math.random() * 46 + 6; pos.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('endp', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, snow: { value: 0 }, amount: { value: 1 }, light: { value: 1 } },
    vertexShader: `attribute float endp; uniform float time, snow; varying float vA;
      void main(){ vec3 p = position; float sp = mix(14.0, 1.4, snow); float y = mod(p.y - time * sp, 24.0) - 4.0;
        vec3 q = vec3(p.x + sin(time * 0.7 + p.z) * snow * 0.8, y, p.z); q.y += endp * mix(0.45, 0.06, snow); q.x += endp * mix(0.06, 0.04, snow);
        vA = mix(0.35, 0.85, snow); gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0); }`,
    fragmentShader: `uniform float amount, light; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.86, 0.9, 0.95) * light, vA * amount); }` });
  const seg = new THREE.LineSegments(geo, mat); seg.frustumCulled = false; seg.renderOrder = 7; return seg;
}
