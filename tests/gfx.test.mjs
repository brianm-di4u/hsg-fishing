// The 3D layer: lake, boat run, spot, cast, fight, jump, weather and dusk render with WebGL (headless runs use
// SwiftShader), the 2D fallback still works, and the painted plates load.
import { quick, fishAt, castTo, waitFor } from './helpers.mjs';

async function ready3d(t) {
  const s = await waitFor(t, (q) => q.gfx && (q.gfx.ready || q.gfx.mode === '2d') && !q.gfx.loading, 20000, '3D ready');
  return s.gfx;
}
const varied = (t, shot, label) => t.expect(shot && shot.stats && shot.stats.stddev > 12, `${label}: the frame has detail (stddev ${shot && shot.stats && Math.round(shot.stats.stddev)})`);

export const tests = [
  {
    name: '3D lake and boat run',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5, hour: 10 * 60, weather: { sky: 'clear' } });
      const g = await ready3d(t);
      t.equal(g.mode, '3d', 'WebGL scene is up'); t.log(`gpu: ${g.gpu} · tier ${g.tier}`);
      let s = await t.state(); t.expect(s.gfx.map3d, 'the lake map is drawn in 3D');
      varied(t, await t.shot('50-map3d'), 'map');
      const lay = await t.game('act', 'layout');
      t.expect(lay.points.length >= 10, 'pins are projected from the 3D camera');
      t.expect(lay.points.every((p) => p.x > 0 && p.y > 0 && p.x < t.vp.width && p.y < t.vp.height), 'every pin is on screen');
      await t.game('act', 'runTo', 'h-garvan');
      await t.page.waitForTimeout(700);
      await t.shot('50b-run3d', { wait: false });
      await t.game('act', 'finishAnim');
      await quick(t, { lake: 'ouachita', month: 10, hour: 9 * 60, weather: { sky: 'partly' } }); await ready3d(t);
      varied(t, await t.shot('50c-map3d-ouachita'), 'Ouachita map');
    },
  },
  {
    name: '3D spot: cast, fight, jump',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5, hour: 10 * 60, weather: { sky: 'clear' } }); await ready3d(t);
      await fishAt(t, 'h-docks');
      varied(t, await t.shot('51-spot3d'), 'spot');
      // the projection round-trips: a point on the water maps to the screen and back
      const p = await t.game('act', 'toScreen', 0.45, 0.4);
      t.expect(p && p[0] > 0 && p[1] > 0 && p[0] < t.vp.width && p[1] < t.vp.height, `spot (0.45, 0.4) is on screen at ${p && p.map(Math.round)}`);
      await castTo(t, 0.45, 0.32);
      await t.game('act', 'reel', true); await t.page.waitForTimeout(400);
      await t.shot('51b-retrieve3d', { wait: false });
      await t.game('act', 'forceBite', 'largemouth', 5.2); await t.game('act', 'setHook');
      await t.game('pause');
      await t.game('setState', { fish: { fight: { tension: 0.6, dist: 40, x: 0.4, y: 0.45 } } }); await t.game('step', 1);
      varied(t, await t.shot('52-fight3d', { wait: false }), 'fight');
      await t.game('setState', { fish: { fight: { jump: 0.36, jumpT: 9, x: 0.45, y: 0.4 } } }); await t.game('step', 0);
      await t.waitFrames(3);
      await t.shot('52b-jump3d', { wait: false });
      await t.game('resume');
    },
  },
  {
    name: '3D weather and light',
    async run(t) {
      await quick(t, { lake: 'ouachita', month: 1, hour: 11 * 60, weather: { sky: 'rain' } }); await ready3d(t);
      await fishAt(t, 'o-dam');
      varied(t, await t.shot('53-rain-dam'), 'rain at Blakely Mountain Dam');
      await quick(t, { lake: 'catherine', month: 3, tier: 'club', hour: 19 * 60 + 25, weather: { sky: 'clear' } }); await ready3d(t);
      await fishAt(t, 'c-tail');
      varied(t, await t.shot('53b-dusk-tailrace'), 'dusk at the Carpenter Dam tailrace');
    },
  },
  {
    name: '2D fallback',
    url: 'index.html?gl=0',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      const s = await t.state(); t.equal(s.gfx.mode, '2d', '?gl=0 keeps the 2D renderer');
      t.expect(!s.gfx.map3d, 'map is 2D');
      varied(t, await t.shot('54-fallback-map'), 'fallback map');
      await fishAt(t, 'h-garvan');
      varied(t, await t.shot('54b-fallback-spot'), 'fallback spot');
    },
  },
  {
    name: 'painted species plates',
    async run(t) {
      await t.game('scene', 'journal');
      const ok = await t.page.evaluate(() => new Promise((res) => { const end = Date.now() + 8000; const f = () => { if (window.__game.isIdle()) res(true); else if (Date.now() > end) res(false); else setTimeout(f, 100); }; f(); }));
      t.expect(ok, 'plates finish loading');
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-garvan');
      await castTo(t); await t.game('act', 'forceBite', 'bluegill', 0.6); await t.game('act', 'setHook'); await t.game('act', 'land');
      await waitFor(t, (q) => q.ui.modal === 'catch', 4000, 'catch card');
      await t.shot('55-catch-painted');
    },
  },
];
