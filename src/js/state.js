// The one serializable state object, plus save/load (MECHANICS §2, §10).
import { makeRng, clone } from './util.js';
import { START_LURES } from './data.js';

export const SAVE_KEY = 'hsg.fishing.v1';

// Mutable container: modules import G and read/write G.S (never reassign exported bindings).
export const G = { S: null, rng: makeRng(1), storage: true, listeners: [] };

export function defaultSettings() {
  return { sound: true, volume: 0.5, motion: 'auto', textScale: 1, assist: false, units: 'lb-oz', theme: 'auto' };
}
export function defaultProfile() {
  return {
    money: 300, upgrades: { whetstone: false, reel: false, sonar: false, motor: false },
    lures: START_LURES.slice(), stocking: null,
    campaign: { unlocked: ['ch1'], passed: {}, best: {}, champion: false },
    journal: { species: {}, events: {}, notes: {} },
    history: [],
  };
}
export function freshState() {
  return { v: 1, scene: 'title', rng: 1, settings: defaultSettings(), profile: defaultProfile(), event: null, day: null, fish: null, ui: { modal: null, card: null, toast: null, reduced: false, theme: 'light', note: 0 } };
}

function store() { try { return window.localStorage; } catch (e) { return null; } }

export function load() {
  const S = freshState();
  const ls = store();
  G.storage = false;
  if (ls) {
    try {
      const raw = ls.getItem(SAVE_KEY);
      ls.setItem(SAVE_KEY + '.probe', '1'); ls.removeItem(SAVE_KEY + '.probe');
      G.storage = true;
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1) {
          Object.assign(S.settings, d.settings || {});
          Object.assign(S.profile, d.profile || {});
          S.profile.upgrades = { ...defaultProfile().upgrades, ...(d.profile && d.profile.upgrades) };
          S.profile.campaign = { ...defaultProfile().campaign, ...(d.profile && d.profile.campaign) };
          S.profile.journal = { ...defaultProfile().journal, ...(d.profile && d.profile.journal) };
          if (d.resume && d.resume.event && d.resume.day) S.resume = d.resume;
        }
      }
    } catch (e) { G.storage = false; }
  }
  G.S = S;
  return S;
}

export function save() {
  const S = G.S; if (!S) return false;
  const ls = store(); if (!ls) { G.storage = false; return false; }
  try {
    const resume = S.event && S.day && !S.event.over ? { event: clone(S.event), day: clone(S.day) } : null;
    ls.setItem(SAVE_KEY, JSON.stringify({ v: 1, settings: S.settings, profile: S.profile, resume }));
    G.storage = true; return true;
  } catch (e) { G.storage = false; return false; }
}
