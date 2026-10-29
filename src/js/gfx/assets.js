// Asset packs: assets/pack-<name>.js files written by tools/pack-assets.mjs. Each pack is a classic script that
// pushes {name, mime, b64} records onto window.__FISH_ASSETS, so it loads under file:// as well as over HTTP, and
// images decode from data: URIs (WebGL refuses file:// images). Packs load lazily after first paint.
const map = new Map(); const loaded = {};
export const ASSETS = {
  get: (n) => map.get(n), has: (n) => map.has(n), names: () => [...map.keys()],
  url: (n) => { const a = map.get(n); return a ? `data:${a.mime};base64,${a.b64}` : null; },
};
function absorb() { const q = window.__FISH_ASSETS || []; while (q.length) { const a = q.shift(); map.set(a.name, a); } }
// PACKS lists the packs that exist (written by the pack tool), so the game never requests a missing file.
/* global FISH_PACKS */
export const PACKS = typeof FISH_PACKS !== 'undefined' ? FISH_PACKS : [];
export function loadPack(name) {
  if (loaded[name]) return loaded[name];
  if (!PACKS.includes(name)) return (loaded[name] = Promise.resolve(false));
  loaded[name] = new Promise((res) => {
    const s = document.createElement('script'); s.src = `assets/pack-${name}.js`;
    s.onload = () => { absorb(); res(true); }; s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  return loaded[name];
}
const imgCache = {};
// Decoded HTMLImageElement for an asset (or null), cached.
export function image(name) {
  if (imgCache[name]) return imgCache[name];
  const u = ASSETS.url(name); if (!u) return Promise.resolve(null);
  const img = new Image(); img.src = u;
  return (imgCache[name] = img.decode().then(() => img).catch(() => null));
}
