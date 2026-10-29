// Blender models (asset pack "models"): parsed once after three.js loads, then used by the scenes in place of the
// procedural stand-ins. Trees and rocks become merged, vertex-coloured geometries for instancing; the boat stays a scene.
/* global THREE */
import { loadPack, PACKS, ASSETS } from './assets.js';
import { geoFromScene } from './util3d.js';

const glbCache = {};
// Parse a GLB that an asset pack registered (base64) and resolve its scene.
export function glb(name) {
  if (glbCache[name]) return glbCache[name];
  const a = ASSETS.get(name); if (!a) return (glbCache[name] = Promise.resolve(null));
  const bin = Uint8Array.from(atob(a.b64), (c) => c.charCodeAt(0)).buffer;
  glbCache[name] = new Promise((res) => new THREE.GLTFLoader().parse(bin, '', (g) => res(g.scene), () => res(null)));
  return glbCache[name];
}

export const MODELS = { ready: false, loading: false };
export function loadModels() {
  if (MODELS.p) return MODELS.p;
  if (!PACKS.includes('models')) { MODELS.ready = true; return (MODELS.p = Promise.resolve()); }
  MODELS.loading = true;
  MODELS.p = loadPack('models').then(() => Promise.all(['boat', 'pine', 'oak', 'oak_bare', 'cedar', 'rock'].map((n) => glb(n).then((sc) => {
    if (!sc) return;
    if (n === 'boat') { MODELS.boat = sc; return; }
    if (n === 'rock') { MODELS.rocks = ['rock0', 'rock1', 'rock2'].map((k) => { const o = sc.getObjectByName(k); if (!o) return null; const c = o.clone(); c.position.set(0, 0, 0); return geoFromScene(c); }).filter(Boolean); return; }
    MODELS[n] = geoFromScene(sc);
  })))).catch(() => null).then(() => { MODELS.loading = false; MODELS.ready = true; });
  return MODELS.p;
}
