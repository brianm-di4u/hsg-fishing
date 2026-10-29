// Loads the painted species plates (asset pack "fish") after first paint and registers them for drawFish.
import { PLATES, SCENES } from '../art.js';
import { SPECIES } from '../data.js';
import { loadPack, image } from './assets.js';

export const PLATE_STATE = { loading: false, ready: false };
export function loadPlates() {
  if (PLATE_STATE.loading || PLATE_STATE.ready) return PLATE_STATE.p || Promise.resolve();
  if (new URLSearchParams(location.search).get('art') === '0') { PLATE_STATE.ready = true; return Promise.resolve(); }
  PLATE_STATE.loading = true;
  const scenes = loadPack('scenes').then(() => Promise.all(['title-wide', 'title-tall', 'weighin', 'dam-remmel', 'dam-carpenter', 'dam-blakely', 'dam-degray'].map((n) => image('scene-' + n).then((img) => { if (img) SCENES[n] = img; }))));
  PLATE_STATE.p = Promise.all([scenes, loadPack('fish').then(() => Promise.all(Object.keys(SPECIES).map((sp) => image('fish-' + sp).then((img) => { if (img) PLATES[sp] = img; }))))])
    .then(() => { PLATE_STATE.loading = false; PLATE_STATE.ready = true; });
  return PLATE_STATE.p;
}
