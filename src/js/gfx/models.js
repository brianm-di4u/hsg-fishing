// Models: GLB assets from the asset packs (Blender sources in art-src/blender/) with procedural stand-ins,
// so a scene can render before (or without) the packs. Units are metres; +x is forward for boats.
/* global THREE */
import { MODELS } from './modelpack.js';

// The bass boat: the Blender model when the models pack is loaded, else the procedural stand-in.
export function makeBoat(colors = {}) {
  if (MODELS.boat) { const b = MODELS.boat.clone(true); b.userData.length = 6.2; b.userData.motor = b.getObjectByName('motor'); return b; }
  return proceduralBoat(colors);
}
// A procedural bass boat: lofted hull, deck, console, outboard, trolling motor.
function proceduralBoat(colors = {}) {
  const g = new THREE.Group();
  const paint = new THREE.Color(colors.paint || 0x9c1f1a), trim = new THREE.Color(colors.trim || 0xe9e6de), dark = new THREE.Color(0x1d2024);
  const Lb = 6.2, B = 2.35;
  const halfW = (t) => (t < 0.72 ? B / 2 * (0.92 + 0.08 * Math.sin(t / 0.72 * Math.PI / 2)) : B / 2 * Math.cos((t - 0.72) / 0.28 * Math.PI / 2) ** 0.8);
  const keel = (t) => -0.42 + 0.3 * Math.max(0, (t - 0.75) / 0.25) ** 2;
  const N = 24, pos = [], col = [], idx = [];
  const ring = (t) => { const x = t * Lb - Lb * 0.45, w = halfW(t), k = keel(t); return [[x, 0.32, -w], [x, -0.05, -w * 0.96], [x, k, 0], [x, -0.05, w * 0.96], [x, 0.32, w]]; };
  for (let i = 0; i <= N; i++) { const t = i / N; for (const [j, p] of ring(t).entries()) { pos.push(...p); const c = j === 0 || j === 4 ? trim : paint; col.push(c.r, c.g, c.b); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const a = i * 5 + j, b = a + 5; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hull.setIndex(idx); hull.computeVertexNormals();
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.3, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(hull, hullMat));
  // deck: carpet grey
  const deckShape = new THREE.Shape(); for (let i = 0; i <= N; i++) { const t = i / N; i ? deckShape.lineTo(t * Lb - Lb * 0.45, halfW(t) * 0.97) : deckShape.moveTo(-Lb * 0.45, halfW(0) * 0.97); }
  for (let i = N; i >= 0; i--) { const t = i / N; deckShape.lineTo(t * Lb - Lb * 0.45, -halfW(t) * 0.97); }
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(deckShape), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.95 }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = 0.3; deck.scale.z = -1; g.add(deck);
  const box = (w, h, d, c, x, y, z, m = {}) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...m })); o.position.set(x, y, z); g.add(o); return o; };
  box(0.7, 0.55, 0.5, trim, 0.1, 0.58, 0.55);                 // console
  box(0.05, 0.3, 0.45, 0x2b3a44, 0.42, 0.95, 0.55, { metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.6 }); // windscreen
  box(0.55, 0.35, 0.6, dark, -0.6, 0.5, -0.45); box(0.55, 0.35, 0.6, dark, -0.6, 0.5, 0.45); // seats
  const motor = box(0.5, 0.9, 0.42, dark, -Lb * 0.45 - 0.25, 0.55, 0, { metalness: 0.4, roughness: 0.35 });
  box(0.18, 0.7, 0.12, dark, -Lb * 0.45 - 0.3, -0.15, 0);       // lower unit
  box(0.5, 0.08, 0.14, 0xb8b8b8, -Lb * 0.45 - 0.15, 0.92, 0, { metalness: 0.8, roughness: 0.3 }); // cowl stripe
  // trolling motor stowed on the port bow
  const tm = box(1.3, 0.07, 0.07, 0x222222, Lb * 0.43, 0.42, -0.62); tm.rotation.y = 0.12;
  box(0.32, 0.16, 0.18, 0x222222, Lb * 0.5, 0.48, -0.66);
  box(0.4, 0.12, 0.14, 0x2a2a2a, Lb * 0.33, 0.4, -0.55);
  g.userData.motor = motor; g.userData.length = Lb;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}

// Foam wake ribbon: a strip that follows a list of world points with widening, fading width.
export function makeWake(maxPts = 64) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(maxPts * 2 * 3), aux = new Float32Array(maxPts * 2 * 2);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aux', new THREE.BufferAttribute(aux, 2).setUsage(THREE.DynamicDrawUsage));
  const idx = []; for (let i = 0; i < maxPts - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); } geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: { value: 0 }, light: { value: 1 } },
    vertexShader: `attribute vec2 aux; varying vec2 vA; void main(){ vA = aux; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time, light; varying vec2 vA;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){ float age = vA.x, side = abs(vA.y * 2.0 - 1.0);
        float edge = smoothstep(1.0, 0.55, side) * (0.35 + 0.65 * smoothstep(0.2, 0.95, side));
        float n = h2(floor(vec2(vA.y * 18.0, age * 40.0 - time * 3.0)));
        float a = edge * (1.0 - age) * (0.55 + 0.45 * n);
        gl_FragColor = vec4(vec3(0.92, 0.95, 0.96) * light, a * 0.85); }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 2;
  const pts = [];
  mesh.reset = () => { pts.length = 0; geo.setDrawRange(0, 0); };
  // p: [x, z] world; dir: heading radians; w0/w1: start/end half-width; y: water height
  mesh.push = (x, z, t) => { pts.unshift({ x, z, t }); if (pts.length > maxPts) pts.pop(); };
  mesh.update = (now, life, w0, w1, y = 0.02) => {
    while (pts.length && now - pts[pts.length - 1].t > life) pts.pop();
    const n = pts.length; if (n < 2) { geo.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], r = pts[Math.max(0, i - 1)];
      let dx = r.x - q.x, dz = r.z - q.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const age = Math.min(1, (now - p.t) / life), w = w0 + (w1 - w0) * age;
      pos.set([p.x - dz * w, y, p.z + dx * w, p.x + dz * w, y, p.z - dx * w], i * 6); aux.set([age, 0, age, 1], i * 4);
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aux.needsUpdate = true; geo.setDrawRange(0, (n - 1) * 6);
    mat.uniforms.time.value = now;
  };
  return mesh;
}
