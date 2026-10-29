// Performance and size budgets (AC45).
import { quick, fishAt, castTo, hookFish } from './helpers.mjs';

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
      t.expect(retrieveFps >= 55, `retrieve fps ${retrieveFps} ≥ 55`);
      t.expect(fightFps >= 55, `fight fps ${fightFps} ≥ 55`);
      t.expect(runFps >= 50, `boat run fps ${runFps} ≥ 50`);
      t.expect(mem < 40, `heap ${mem} MB < 40`);
    },
  },
];
