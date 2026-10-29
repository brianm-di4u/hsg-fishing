// Fish textures for the 3D scenes: the painted species plate when its asset is loaded, else the procedural
// vector fish, drawn into a 1024 × 512 canvas (head right) so every species shares one card aspect.
/* global THREE */
import { drawFish, PLATES } from '../art.js';
import { SPECIES } from '../data.js';

const cache = {};
export function fishTexture(sp) {
  const painted = !!PLATES[sp];
  const c = cache[sp]; if (c && c.painted === painted) return c;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const x = cv.getContext('2d');
  if (painted) { const im = PLATES[sp]; const k = Math.min(1000 / im.width, 500 / im.height); x.drawImage(im, 512 - im.width * k / 2, 256 - im.height * k / 2, im.width * k, im.height * k); }
  else drawFish(x, sp, 512, 256, 780 / (SPECIES[sp] ? SPECIES[sp].art.len : 1), { dpr: 1 });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.userData.own = true;
  return (cache[sp] = { tex, aspect: 2, painted });
}
