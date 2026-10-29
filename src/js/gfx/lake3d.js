// GPU resources for one real lake, shared by the lake (map) scene and the spot scene:
//   heightTex  R16F, metres relative to the pool: land from the 3DEP DEM, water = minus the estimated depth
//   maskTex    RGBA8: R main lake, G other water, B shore distance (0–255 m), A estimated depth / 200 ft
// and the terrain and water materials. Both meshes live in "terrain space": x, z in [0, 1] across the
// lake frame; the mesh's scale turns that into world units, and `vScale` turns metres into world units vertically.
/* global THREE */
import { getLake, demHeights, loadDem, landcover, unrle } from '../lakes.js';
import { clamp, lerp } from '../util.js';

const cache = {};
export function lakeRes(id) {
  if (cache[id]) return cache[id];
  const L = getLake(id); if (!L.geo || !demHeights(id)) return null;
  const { w, h, cell } = L.grid, dem = demHeights(id), g = L.geo.dem, mpu = L.mPerUnit;
  const H = new Float32Array(w * h), M = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    // bilinear DEM sample at this cell centre
    const u = (i + 0.5) / w * g.w - 0.5, v = (j + 0.5) / h * g.h - 0.5;
    const i0 = clamp(Math.floor(u), 0, g.w - 2), j0 = clamp(Math.floor(v), 0, g.h - 2), fu = clamp(u - i0, 0, 1), fv = clamp(v - j0, 0, 1);
    const d = (a, b) => dem[b * g.w + a];
    let e = lerp(lerp(d(i0, j0), d(i0 + 1, j0), fu), lerp(d(i0, j0 + 1), d(i0 + 1, j0 + 1), fu), fv);
    if (L.mask[k]) e = -L.depth[k] * 0.3048;
    else if (L.other[k]) e = Math.max(e, 0.3);
    else e = Math.max(e, 0.6 + Math.min(4, (L.field[k] / cell) * 0.6)); // keep banks above the waterline
    H[k] = e;
    M[k * 4] = L.mask[k] ? 255 : 0; M[k * 4 + 1] = L.other[k] ? 255 : 0;
    M[k * 4 + 2] = clamp(Math.round(L.sd[k] * cell * mpu), 0, 255); M[k * 4 + 3] = clamp(Math.round(L.depth[k] / 200 * 255), 0, 255);
  }
  // roads (National Transportation Dataset), filtered so they draw as soft lines
  const RD = L.geo.roads ? unrle(L.geo.roads, w * h) : new Uint8Array(w * h); for (let k = 0; k < RD.length; k++) RD[k] *= 255;
  const roadTex = new THREE.DataTexture(RD, w, h, THREE.RedFormat, THREE.UnsignedByteType); roadTex.magFilter = THREE.LinearFilter; roadTex.minFilter = THREE.LinearFilter; roadTex.needsUpdate = true;
  // half floats are filterable everywhere in WebGL2 (float32 linear filtering is an extension)
  const H16 = new Uint16Array(w * h); for (let k = 0; k < H16.length; k++) H16[k] = THREE.DataUtils.toHalfFloat(H[k]);
  const heightTex = new THREE.DataTexture(H16, w, h, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = THREE.LinearFilter; heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  const maskTex = new THREE.DataTexture(M, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter; maskTex.needsUpdate = true;
  // CPU height lookup in metres at lake coords (for placing objects and labels)
  const heightAt = (x, y) => {
    const fi = clamp(x / cell - 0.5, 0, w - 1.001), fj = clamp(y / cell - 0.5, 0, h - 1.001); const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
    const s = (p, q) => H[Math.min(h - 1, q) * w + Math.min(w - 1, p)];
    return lerp(lerp(s(i, j), s(i + 1, j), a), lerp(s(i, j + 1), s(i + 1, j + 1), a), b);
  };
  // land cover (NLCD classes 0–10; 2 = mixed forest when missing)
  const lcd = landcover(id), lg = L.geo.landcover; let lcTex;
  if (lcd && lg) { lcTex = new THREE.DataTexture(lcd, lg.w, lg.h, THREE.RedFormat, THREE.UnsignedByteType); }
  else { lcTex = new THREE.DataTexture(new Uint8Array([2]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType); }
  lcTex.magFilter = THREE.NearestFilter; lcTex.minFilter = THREE.NearestFilter; lcTex.needsUpdate = true;
  let sum = 0, n = 0; for (let k = 0; k < H.length; k += 7) if (H[k] > 0) { sum += H[k]; n++; }
  return (cache[id] = { id, L, heightTex, maskTex, lcTex, roadTex, heightAt, W: w, H: h, mpu, Wm: 1000 * mpu, Hm: 625 * mpu, avgH: n ? sum / n : 20 });
}
export const lakeResReady = (id) => !!demHeights(id);
export const prepLake = (id) => loadDem(id);

// season palette (sRGB): forest canopy low/high, accent flecks, pine
export function seasonColors(month) {
  if (month === 10) return { a: [0.28, 0.40, 0.17], b: [0.52, 0.52, 0.22], c: [0.80, 0.45, 0.16], pine: [0.15, 0.29, 0.16], fleck: 0.35 };
  if (month === 11) return { a: [0.46, 0.40, 0.22], b: [0.72, 0.50, 0.22], c: [0.76, 0.32, 0.14], pine: [0.17, 0.30, 0.17], fleck: 0.5 };
  if (month === 12 || month <= 2) return { a: [0.42, 0.38, 0.31], b: [0.56, 0.50, 0.41], c: [0.62, 0.58, 0.52], pine: [0.18, 0.30, 0.19], fleck: 0.0 };
  if (month === 3 || month === 4) return { a: [0.30, 0.46, 0.20], b: [0.52, 0.64, 0.30], c: [0.88, 0.62, 0.78], pine: [0.16, 0.31, 0.18], fleck: 0.18 };
  return { a: [0.22, 0.38, 0.15], b: [0.36, 0.52, 0.21], c: [0.40, 0.55, 0.24], pine: [0.14, 0.28, 0.15], fleck: 0.0 };
}

const NOISE = `
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*n2(p); p = p*2.07 + vec2(3.1,7.7); a *= 0.5; } return s; }
  // cellular: distance to nearest jittered point (tree crowns)
  vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
  vec2 cell2(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, id = 0.0;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g = vec2(x,y); vec2 o = vec2(h2(i+g), h2(i+g+19.1)); float d = length(g + o - f); if (d < d1) { d1 = d; id = h2(i+g+5.3); } }
    return vec2(d1, id); }
`;
const LIGHT_UNIFORMS = () => ({
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, sunI: { value: 1 },
  ambCol: { value: new THREE.Color(0.4, 0.45, 0.5) }, ambI: { value: 1 }, fogCol: { value: new THREE.Color(0.7, 0.8, 0.9) }, fogD: { value: 0.0002 },
  zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, time: { value: 0 },
});

// Terrain: displaced from heightTex in the vertex shader, normals from neighbouring texels, canopy and rock in the fragment.
export function terrainMaterial(res, o) {
  const uniforms = {
    ...LIGHT_UNIFORMS(), heightTex: { value: res.heightTex }, maskTex: { value: res.maskTex }, lcTex: { value: res.lcTex }, roadTex: { value: res.roadTex }, roadK: { value: o.roadK ?? 0 }, winter: { value: o.winter ? 1 : 0 }, lcK: { value: o.lcK ?? 1 },
    texel: { value: new THREE.Vector2(1 / res.W, 1 / res.H) }, world: { value: new THREE.Vector2(o.worldW, o.worldH) },
    metres: { value: new THREE.Vector2(res.Wm, res.Hm) }, vScale: { value: o.vScale }, detail: { value: o.detail ?? 0 },
    cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, cC: { value: new THREE.Color() }, cPine: { value: new THREE.Color() }, fleck: { value: 0 },
    hole: { value: new THREE.Vector4(0, 0, 0, 0) }, // spot scene: x, y (uv), radius (uv), sink depth (m)
    avgH: { value: res.avgH }, hillK: { value: o.hillK ?? 0 }, hillL: { value: new THREE.Vector3(-0.55, 0.7, -0.45).normalize() }, sat: { value: o.sat ?? 1 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform sampler2D heightTex; uniform vec2 texel, world; uniform float vScale, avgH; uniform vec4 hole;
      varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vH;
      float hAt(vec2 uv){ float h = texture2D(heightTex, clamp(uv, vec2(0.0), vec2(1.0))).r;
        if (hole.z > 0.0) { float d = length((uv - hole.xy) * vec2(world.x / world.y, 1.0)); h = mix(min(h, -hole.w), h, smoothstep(hole.z * 0.55, hole.z, d)); }
        return h; }
      void main(){
        vUv = position.xz;
        float out_ = max(max(-vUv.x, vUv.x - 1.0), max(-vUv.y, vUv.y - 1.0));
        float h = hAt(vUv); if (out_ > 0.0) h = mix(max(h, 2.0), avgH, smoothstep(0.0, 0.035, out_)); vH = h;
        float hx = (hAt(vUv + vec2(texel.x, 0.0)) - hAt(vUv - vec2(texel.x, 0.0))) * vScale / (2.0 * texel.x * world.x);
        float hz = (hAt(vUv + vec2(0.0, texel.y)) - hAt(vUv - vec2(0.0, texel.y))) * vScale / (2.0 * texel.y * world.y);
        vN = normalize(vec3(-hx, 1.0, -hz));
        vec4 wp = modelMatrix * vec4(position.x, h * vScale, position.z, 1.0); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D maskTex, lcTex, roadTex; uniform vec2 metres; uniform float detail, fleck, sunI, ambI, fogD, time, hillK, sat, winter, lcK, roadK;
      uniform vec3 sunDir, sunCol, ambCol, fogCol, cA, cB, cC, cPine, hillL;
      varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vH;
      ${NOISE}
      void main(){
        vec3 N = normalize(vN); float slope = 1.0 - N.y;
        vec2 m = vUv * metres;
        float big = fbm(m / 420.0);
        vec2 cr = cell2(m / 9.0);                    // ~9 m tree crowns
        float px = length(fwidth(m));                // metres per pixel
        float crownVis = clamp(1.0 - px / 14.0, 0.0, 1.0) * detail;
        float pineMix = clamp(0.42 + (fbm(m / 300.0 + 11.0) - 0.5) * 1.4, 0.0, 0.85);
        vec3 hard = mix(cA, cB, clamp(0.5 + (big - 0.5) * 1.1 + (cr.y - 0.5) * 0.25 * crownVis, 0.0, 1.0));
        hard = mix(hard, cC, step(1.0 - fleck * 0.6, cr.y) * fleck);
        // NLCD land cover, with the cell edges dithered so they don't read as squares
        vec2 lj = clamp(vUv + (vec2(n2(m / 37.0), n2(m / 41.0 + 7.0)) - 0.5) * 0.006, 0.0, 1.0);
        float lc = floor(texture2D(lcTex, lj).r * 255.0 + 0.5);
        if (vUv.x < 0.0 || vUv.y < 0.0 || vUv.x > 1.0 || vUv.y > 1.0) lc = 2.0; // beyond the frame: mixed forest
        float pineK = lc < 0.5 ? pineMix * 0.25 : lc < 1.5 ? 0.85 : pineMix * 0.85;
        vec3 forestCol = mix(hard, cPine, pineMix * 0.85);
        vec3 col = mix(hard, cPine, pineK);
        float forest = step(lc, 2.5);
        float crown = smoothstep(0.75, 0.15, cr.x);
        col *= mix(1.0, 0.62 + 0.5 * crown, crownVis * forest);
        vec3 grassC = lin(mix(vec3(0.56, 0.62, 0.40), vec3(0.66, 0.62, 0.48), winter));
        if (lc > 2.5 && lc < 3.5) col = mix(col, grassC * (0.85 + 0.25 * n2(m / 30.0)), 0.8);
        if (lc > 3.5 && lc < 4.5) col = lin(mix(vec3(0.60, 0.66, 0.40), vec3(0.68, 0.64, 0.50), winter)) * (0.9 + 0.15 * n2(m / 80.0));
        if (lc > 4.5 && lc < 5.5) col = mix(col, grassC, 0.45);
        if (lc > 5.5 && lc < 7.5) { // houses, lots and streets: small roof cells over a grey-green base
          vec2 rc = cell2(m / 14.0); float roof = smoothstep(0.42, 0.3, rc.x);
          vec3 roofC = lin(mix(vec3(0.48, 0.46, 0.46), mix(vec3(0.60, 0.36, 0.30), vec3(0.74, 0.72, 0.68), rc.y), step(0.5, rc.y)));
          vec3 base = mix(mix(col, lin(vec3(0.56, 0.60, 0.50)), 0.5), lin(vec3(0.64, 0.64, 0.60)), lc > 6.5 ? 0.8 : 0.25);
          col = mix(base, roofC * 0.9, roof * (lc > 6.5 ? 0.85 : 0.55));
        }
        if (lc > 7.5 && lc < 8.5) col = lin(vec3(0.70, 0.66, 0.58));
        if (lc > 8.5 && lc < 9.5) col = mix(col, lin(vec3(0.42, 0.52, 0.42)), 0.6);
        float edgeD = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        col = mix(forestCol * mix(1.0, 0.62 + 0.5 * crown, crownVis), col, lcK * smoothstep(0.0, 0.07, edgeD)); // fade to forest at the frame edge
        col *= 0.94 + 0.12 * n2(m / 60.0);
        // rock on steep slopes (shale and novaculite greys), bare banks near the waterline
        vec3 rock = lin(mix(vec3(0.46, 0.44, 0.40), vec3(0.66, 0.64, 0.60), n2(m / 25.0)));
        col = mix(col, rock, smoothstep(0.42, 0.62, slope));
        float bank = smoothstep(2.2, 0.4, vH) * step(0.0, vH);
        col = mix(col, lin(mix(vec3(0.58, 0.46, 0.36), vec3(0.62, 0.60, 0.55), n2(m / 6.0))), bank * 0.85);
        // lake bed (seen through the water)
        if (vH < 0.0) col = lin(mix(vec3(0.50, 0.44, 0.34), vec3(0.28, 0.30, 0.28), clamp(-vH / 12.0, 0.0, 1.0)));
        float otherW = smoothstep(0.35, 0.65, texture2D(maskTex, clamp(vUv, vec2(0.0), vec2(1.0))).g);
        col = mix(col, lin(vec3(0.44, 0.62, 0.70)), otherW * 0.9);
        vec3 L = normalize(sunDir);
        float dif = max(dot(N, L), 0.0);
        if (roadK > 0.0 && vUv.x >= 0.0 && vUv.y >= 0.0 && vUv.x <= 1.0 && vUv.y <= 1.0) { float rd = smoothstep(0.25, 0.6, texture2D(roadTex, vUv).r); col = mix(col, lin(vec3(0.93, 0.90, 0.80)), rd * roadK); }
        float lum = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(vec3(lum), col, sat);
        vec3 lit = col * (sunCol * dif * sunI + ambCol * ambI * (0.55 + 0.45 * N.y));
        // cartographic relief: a fixed north-west light blended in so ridges read at any hour or weather
        float hs = max(dot(N, hillL), 0.0);
        lit = mix(lit, col * (0.32 + 1.2 * hs) * mix(vec3(1.0), sunCol, 0.25) * (0.7 + 0.3 * ambI), hillK);
        float out_ = max(max(-vUv.x, vUv.x - 1.0), max(-vUv.y, vUv.y - 1.0));
        lit *= 1.0 - smoothstep(0.0, 0.25, out_) * 0.45;
        float dist = length(vW - cameraPosition);
        float f = 1.0 - exp(-dist * fogD);
        gl_FragColor = vec4(mix(lit, fogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Water: flat at the pool, masked to lake and other water; depth tint, chart contours, procedural waves,
// sky reflection with Fresnel, sun glint and shoreline foam.
export function waterMaterial(res, o) {
  const uniforms = {
    ...LIGHT_UNIFORMS(), maskTex: { value: res.maskTex }, metres: { value: new THREE.Vector2(res.Wm, res.Hm) },
    shallow: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, contours: { value: o.contours ? 1 : 0 },
    maxDepth: { value: 200 }, waveScale: { value: o.waveScale ?? 1 }, wind: { value: 0.4 }, gloss: { value: o.gloss ?? 1 },
  };
  return new THREE.ShaderMaterial({
    uniforms, transparent: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = position.xz; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform sampler2D maskTex; uniform vec2 metres; uniform float contours, maxDepth, waveScale, wind, gloss, sunI, ambI, fogD, time;
      uniform vec3 sunDir, sunCol, ambCol, fogCol, zen, hor, shallow, deep;
      varying vec2 vUv; varying vec3 vW;
      ${NOISE}
      vec2 grad(vec2 p){ float e = 0.6; return vec2(n2(p + vec2(e,0.0)) - n2(p - vec2(e,0.0)), n2(p + vec2(0.0,e)) - n2(p - vec2(0.0,e))) / (2.0*e); }
      void main(){
        if (vUv.x < 0.0 || vUv.y < 0.0 || vUv.x > 1.0 || vUv.y > 1.0) discard;
        vec4 mk = texture2D(maskTex, vUv);
        if (mk.r < 0.5) discard;
        vec2 m = vUv * metres;
        float depthFt = mk.a * maxDepth;
        float shoreM = mk.b * 255.0;
        // waves: two scrolling gradient-noise octaves, faded with pixel footprint
        float px = length(fwidth(m));
        vec2 g = grad(m / (7.0 * waveScale) + vec2(time * 0.35, time * 0.2)) * 0.9 + grad(m / (2.6 * waveScale) - vec2(time * 0.5, -time * 0.31)) * 0.5;
        g *= wind * clamp(1.6 - px / (6.0 * waveScale), 0.15, 1.0);
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 skyc = mix(hor, zen, pow(clamp(R.y, 0.0, 1.0), 0.5));
        float dk = clamp(depthFt / 60.0, 0.0, 1.0);
        vec3 body = mix(shallow, deep, pow(dk, 0.7)) * (0.82 + 0.15 * ambI + 0.12 * sunI * max(sunDir.y, 0.0));
        vec3 col = mix(body, skyc, fres * gloss);
        vec3 H = normalize(normalize(sunDir) + V);
        col += sunCol * sunI * pow(max(dot(N, H), 0.0), 220.0) * 1.6 * gloss;
        // chart contours every 10 ft (20 ft past 40), anti-aliased
        if (contours > 0.5 && mk.r > 0.5) {
          float q = depthFt / 20.0;
          float w = fwidth(q); float line = (1.0 - smoothstep(0.0, w * 1.1, abs(fract(q + 0.5) - 0.5))) * smoothstep(0.45, 0.15, w);
          col = mix(col, vec3(0.80, 0.90, 0.95), line * 0.22);
        }
        // shoreline foam and the bright wet edge
        float foam = smoothstep(px * 1.5 + 2.0, 0.0, shoreM) * (0.55 + 0.45 * n2(m / 3.0 + time * 0.6));
        col = mix(col, vec3(0.86, 0.88, 0.86), foam * 0.55);
        float dist = length(vW - cameraPosition);
        float f = 1.0 - exp(-dist * fogD);
        gl_FragColor = vec4(mix(col, fogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Push the moment's light into a material's uniforms.
export function applyLight(mat, lt, time) {
  const u = mat.uniforms; const S = THREE.SRGBColorSpace;
  u.sunDir.value.set(...lt.sun.v); u.sunCol.value.setRGB(...lt.sunCol, S); u.sunI.value = lt.sunI + lt.moon * 0.12;
  if (lt.moon > 0) { u.sunDir.value.set(-0.3, 0.6, 0.4); u.sunCol.value.setRGB(0.55, 0.62, 0.8, S); }
  u.ambCol.value.setRGB(...lt.amb, S); u.ambI.value = lt.ambI; u.fogCol.value.setRGB(...lt.fog, S);
  u.zen.value.setRGB(...lt.zen, S); u.hor.value.setRGB(...lt.hor, S); u.time.value = time;
}
