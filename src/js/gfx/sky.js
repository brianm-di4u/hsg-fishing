// Sun, sky and light for a game moment: clock (minutes), month and weather. Shared by the lake and spot scenes.
// Coordinates: x east, y up, z south.
/* global THREE */
import { sunTimes } from '../sim.js';
import { clamp, lerp } from '../util.js';

const DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hexv = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// Sun direction from the solar position at 34.5° N (hour angle from the game's sunrise/sunset).
export function sunDir(min, month) {
  const st = sunTimes(month), noon = (st.rise + st.set) / 2, half = (st.set - st.rise) / 2;
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + DOY[month - 1])) / 365) * Math.PI / 180, phi = 34.5 * Math.PI / 180;
  const H0 = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1));
  const H = ((min - noon) / half) * H0; // radians, negative before noon
  const el = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)); // from south, west positive
  // to world: south = +z, west = -x
  const ce = Math.cos(el);
  return { el, az, v: [-Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce] };
}

// Everything the shaders need for a moment. weather.sky: clear | partly | overcast | rain | storm | snow
export function lightFor(min, month, weather, opts = {}) {
  const s = sunDir(min, month); const elDeg = s.el * 180 / Math.PI;
  const sky = (weather && weather.sky) || 'clear';
  const cloud = { clear: 0.05, partly: 0.35, overcast: 0.85, rain: 0.92, storm: 1, snow: 0.9 }[sky] ?? 0.2;
  const day = clamp((elDeg + 6) / 16, 0, 1);            // 0 night → 1 day (civil twilight ramp)
  const golden = clamp(1 - Math.abs(elDeg - 3) / 9, 0, 1) * (1 - cloud * 0.7); // warm low sun
  // sky colours
  let zen = mix3(hexv(0x0a1530), hexv(0x3d79c7), day), hor = mix3(hexv(0x1b2440), hexv(0xa9cbe6), day);
  hor = mix3(hor, hexv(0xf2a35e), golden * 0.85); zen = mix3(zen, hexv(0x5a5fa0), golden * 0.35);
  const grey = mix3(hexv(0x2a2f38), hexv(0x9aa3ad), day);
  zen = mix3(zen, mix3(grey, hexv(0x7e8892), 0.3), cloud * 0.85); hor = mix3(hor, grey, cloud * 0.8);
  if (sky === 'storm') { zen = mix3(zen, hexv(0x262b33), 0.5); hor = mix3(hor, hexv(0x3a4048), 0.45); }
  // sun light
  let sunCol = mix3(hexv(0xffd9a8), hexv(0xfff6e8), clamp(elDeg / 35, 0, 1)); sunCol = mix3(sunCol, hexv(0xff9a55), golden * 0.6);
  const sunI = clamp(Math.sin(Math.max(0, s.el)) * 2.2, 0, 1) * (1 - cloud * 0.75) * 2.6;
  const moon = day < 0.3 ? (0.3 - day) / 0.3 : 0;
  const amb = mix3(hexv(0x101828), mix3(zen, hor, 0.5), day);
  const ambI = 0.35 + day * 0.65;
  const fog = mix3(hor, grey, 0.2 + cloud * 0.3);
  const fogDensity = (sky === 'rain' ? 2.2 : sky === 'storm' ? 3 : sky === 'snow' ? 2.6 : sky === 'overcast' ? 1.3 : 1) * (opts.mist ? 1.8 : 1);
  return { sun: s, elDeg, day, golden, cloud, sky, zen, hor, sunCol, sunI, moon, amb, ambI, fog, fogDensity, stars: clamp(1 - day * 1.6, 0, 1) * (1 - cloud) };
}

// Our palette values are sRGB; three works in linear.
export const setC = (c, a) => c.setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace);

// Sky dome shader: gradient, sun disk and glow, procedural clouds by cover, stars at night.
export function makeSky(radius = 5000) {
  const geo = new THREE.SphereGeometry(radius, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) },
      cloud: { value: 0.2 }, time: { value: 0 }, stars: { value: 0 }, day: { value: 1 }, ground: { value: new THREE.Color(0.1, 0.12, 0.1) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 zen, hor, sunDir, sunCol, ground; uniform float cloud, time, stars, day; varying vec3 vDir;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*n2(p); p = p*2.03 + vec2(1.7,9.2); a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        float t = pow(clamp(y, 0.0, 1.0), 0.55);
        vec3 col = mix(hor, zen, t);
        col = mix(col, ground, smoothstep(0.0, -0.08, y));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 64.0) * 0.35) * (1.0 - cloud*0.8) * step(-0.05, sunDir.y);
        col += sunCol * smoothstep(0.9993, 0.9997, sd) * 3.0 * (1.0 - cloud);
        // clouds on a plane above
        if (y > 0.0) {
          vec2 uv = d.xz / (y + 0.12) * 1.4 + vec2(time*0.004, time*0.0015);
          float c = fbm(uv);
          float cov = smoothstep(1.0 - cloud - 0.05, 1.0 - cloud + 0.35, c) * smoothstep(0.0, 0.25, y);
          vec3 cc = mix(hor * 0.95 + 0.06, vec3(1.0), 0.35 * day) * (0.55 + 0.45 * day);
          cc += sunCol * pow(sd, 8.0) * 0.4 * day;
          col = mix(col, cc, cov * 0.9);
          // stars
          float st = step(0.9975, h2(floor(d.xz / (y+0.3) * 220.0))) * stars * (1.0 - cov);
          col += vec3(st);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = -10;
  mesh.update = (lt, time) => {
    const u = mat.uniforms; setC(u.zen.value, lt.zen); setC(u.hor.value, lt.hor); u.sunDir.value.set(...lt.sun.v);
    setC(u.sunCol.value, lt.sunCol); u.cloud.value = lt.cloud; u.time.value = time; u.stars.value = lt.stars; u.day.value = lt.day;
    setC(u.ground.value, [lt.fog[0] * 0.5, lt.fog[1] * 0.55, lt.fog[2] * 0.5]);
  };
  return mesh;
}
