// Performance and size budgets (AC45).
import { quick, fishAt, castTo, hookFish, assetsReady } from './helpers.mjs';

export const tests = [
  {
    name: 'fps, idle loop, memory and size',
    viewports: ['desktop'],
    async run(t) {
      t.log(`loadMs ${t.loadMs}`);
      t.expect(t.loadMs <= 2000, `hooks within 2 s (${t.loadMs} ms)`);
      const size = await t.page.evaluate(async () => (await (await fetch(location.href)).text()).length);
      t.log(`index.html ${(size / 1024).toFixed(1)} KB`);
      t.expect(size <= 2 * 1024 * 1024, 'HTML ≤ 2 MB');
      // lazy downloads: three.js and the asset packs
      const lazy = await t.page.evaluate(async () => { const out = {}; for (const f of ['vendor/three-0.180.0.min.js', ...(typeof FISH_PACKS !== 'undefined' ? FISH_PACKS : []).map((p) => `assets/pack-${p}.js`)]) out[f] = (await (await fetch(f)).arrayBuffer()).byteLength; return out; });
      const total = Object.values(lazy).reduce((a, b) => a + b, 0) + size;
      t.log(`lazy: ${Object.entries(lazy).map(([f, b]) => `${f} ${(b / 1024).toFixed(0)} KB`).join(' · ')} · total ${(total / 1048576).toFixed(2)} MB`);
      t.expect(total <= 5 * 1048576, `total download ≤ 5 MB (${(total / 1048576).toFixed(2)} MB)`);
      await assetsReady(t);
      const gfx = (await t.state()).gfx; const soft = /swiftshader|llvmpipe|software/i.test(gfx.gpu || '');
      t.log(`renderer: ${gfx.mode} · ${gfx.gpu} · tier ${gfx.tier}`);
      await t.game('scene', 'campaign');
      await t.page.waitForTimeout(300);
      t.equal((await t.state()).looping, false, 'menu screens stop the render loop');
      await quick(t, { lake: 'ouachita', month: 1 });
      const mapFps = await t.fps(1500);
      await t.game('act', 'runTo', 'o-upper');
      const runFps = await t.fps(1200);
      await t.game('act', 'finishAnim');
      await fishAt(t, 'o-upper');
      await castTo(t, 0.5, 0.25);
      await t.game('act', 'reel', true);
      const retrieveFps = await t.fps(1500);
      await hookFish(t, 'largemouth', 4);
      await t.game('act', 'reel', true);
      const fightFps = await t.fps(1500);
      const mem = await t.memoryMB();
      t.log(`fps map ${mapFps} · run ${runFps} · retrieve ${retrieveFps} · fight ${fightFps} · heap ${mem} MB`);
      // headless runs render with SwiftShader (CPU): real-GPU frame rates are measured by tools/perf.mjs (VISUAL-REPORT)
      const min = soft ? 2 : 50;
      t.expect(retrieveFps >= min, `retrieve fps ${retrieveFps} ≥ ${min}`);
      t.expect(fightFps >= min, `fight fps ${fightFps} ≥ ${min}`);
      t.expect(runFps >= min, `boat run fps ${runFps} ≥ ${min}`);
      t.expect(mem < 120, `heap ${mem} MB < 120`);
    },
  },
];
