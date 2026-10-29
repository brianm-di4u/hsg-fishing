// WebGL layer: loads the vendored three.js after first paint, owns the renderer and the quality tier,
// and falls back to the 2D canvas renderer when WebGL is missing, too slow, or turned off (?gl=0 / Settings).
/* global THREE */
import { G } from '../state.js';
import { loadModels } from './modelpack.js';

// loading stays true until initGL settles (3D ready or 2D fallback)
export const GFX = { mode: '2d', want: '3d', ready: false, loading: true, tier: 'high', renderer: null, error: null, gpu: '', slow: 0, frames: 0, ms: 0 };
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
let canvas = null, loadP = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src)); document.head.appendChild(s); });
}
function webglOK() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}
// Which renderer the player asked for: Settings "graphics" (auto/high/low/2d), overridden by ?gl=0 or ?q=high|low.
export function wanted() {
  if (params.get('gl') === '0') return '2d';
  const g = (G.S && G.S.settings.graphics) || 'auto';
  return g === '2d' ? '2d' : '3d';
}
function pickTier(gpu) {
  const q = params.get('q'); if (q === 'high' || q === 'low') return q;
  const g = (G.S && G.S.settings.graphics) || 'auto'; if (g === 'high' || g === 'low') return g;
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return 'low';
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || /Mobi|Android/i.test(navigator.userAgent);
  return small ? 'low' : 'high';
}

// Start loading three.js and create the renderer. Resolves with the renderer or null (2D fallback).
export function initGL() {
  if (loadP) return loadP;
  GFX.want = wanted();
  if (GFX.want === '2d' || !webglOK()) { GFX.mode = '2d'; GFX.loading = false; GFX.error = GFX.want === '2d' ? null : 'no WebGL2'; return (loadP = Promise.resolve(null)); }
  GFX.loading = true;
  loadP = loadScript('vendor/three-0.180.0.min.js').then(() => {
    canvas = document.createElement('canvas'); canvas.id = 'gl'; canvas.setAttribute('aria-hidden', 'true');
    document.getElementById('stage').prepend(canvas);
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__TEST__ });
    const gl = r.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    GFX.gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    GFX.tier = pickTier(GFX.gpu);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.autoClear = true;
    GFX.renderer = r; GFX.mode = '3d';
    return loadModels().then(() => { GFX.ready = true; GFX.loading = false; return r; });
  }).then((r) => {
    if (!r) return null;
    resizeGL();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); GFX.mode = '2d'; GFX.error = 'context lost'; document.body.classList.remove('gl'); });
    document.body.classList.add('gl');
    return r;
  }).catch((e) => { GFX.mode = '2d'; GFX.loading = false; GFX.error = String(e && e.message || e); return null; });
  return loadP;
}

export function pixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, GFX.tier === 'high' ? 2 : 1.25);
}
export function resizeGL() {
  const r = GFX.renderer; if (!r) return;
  r.setPixelRatio(pixelRatio()); r.setSize(window.innerWidth, window.innerHeight, true);
}
export function setTier(t) { GFX.tier = t; resizeGL(); }
export const glActive = () => GFX.mode === '3d' && GFX.ready;
// Frame-time watchdog: on a sustained slow tier drop from high to low (the 2D fallback stays a Settings choice).
export function frameTiming(dtMs) {
  if (!glActive() || window.__TEST__) return;
  if (dtMs > 200 || dtMs <= 0) return; // one-off hitches (scene builds, shader compiles) don't count
  GFX.frames++; GFX.ms = GFX.ms * 0.98 + dtMs * 0.02;
  if (GFX.frames > 240 && GFX.ms > 38 && GFX.tier === 'high') { GFX.tier = 'low'; GFX.frames = 0; resizeGL(); GFX.dropped = true; }
}
