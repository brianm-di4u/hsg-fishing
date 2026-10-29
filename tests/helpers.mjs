// Shared helpers for the fishing tests (imported by *.test.mjs; not a test file itself).

export async function waitFor(t, pred, ms = 8000, label = 'condition') {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await t.state();
    if (pred(s)) return s;
    await t.page.waitForTimeout(50);
  }
  t.fail(`timed out waiting for ${label}`);
  return t.state();
}

// Wait until the 3D layer and the painted plates have finished loading (or fell back to 2D).
export async function assetsReady(t) {
  return waitFor(t, (q) => !q.gfx || ((q.gfx.ready || q.gfx.mode === '2d') && !q.gfx.loading && q.gfx.plates), 30000, '3D layer and plates loaded');
}

// Start a seeded quick tournament / free day; start:true launches straight to the map.
export async function quick(t, o = {}) {
  await assetsReady(t);
  await t.seed(o.seed ?? 7);
  if (o.settings) await t.game('setState', { settings: o.settings });
  await t.game('newGame', { mode: o.mode || 'quick', lake: o.lake || 'hamilton', month: o.month || 5, tier: o.tier || 'regional', seed: o.seed ?? 7, start: o.start ?? true, weather: o.weather, hour: o.hour, chapter: o.chapter });
  return t.state();
}

// Run to a spot (finishing the animation) and enter the spot view.
export async function fishAt(t, spotId) {
  await t.game('act', 'runTo', spotId);
  await t.game('act', 'finishAnim');
  await t.game('act', 'fishHere');
  return waitFor(t, (s) => s.scene === 'fish', 3000, 'fish scene');
}

// Cast to (x, y) and finish the flight.
export async function castTo(t, x = 0.5, y = 0.35, acc = 1) {
  await t.game('act', 'cast', x, y, acc);
  await t.game('act', 'finishAnim');
  return t.state();
}

// Force a hooked fish of a species/weight and return the fight state.
export async function hookFish(t, sp = 'largemouth', w = 3.5) {
  await castTo(t);
  await t.game('act', 'forceBite', sp, w);
  await t.game('act', 'setHook');
  return t.state();
}

// Land a fish through the hooks and resolve the catch card.
export async function catchFish(t, sp, w, keep = true) {
  await hookFish(t, sp, w);
  await t.game('act', 'land');
  await t.game('act', keep ? 'keep' : 'release');
  return t.state();
}
