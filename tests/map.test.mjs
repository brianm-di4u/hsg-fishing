// Lake map: real click/tap selection, spot card, running, HUD (AC6, AC8).
import { quick, waitFor } from './helpers.mjs';

export const tests = [
  {
    name: 'select a spot and run there',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await t.waitForStable(); // the lake's terrain decodes asynchronously; pins move once the 3D map takes over
      let lay = await t.game('act', 'layout');
      const p = lay.points.find((q) => q.id === 'h-garvan');
      t.expect(!!p, 'Garvan Point marker');
      if (t.viewport === 'mobile') await t.tap([p.x, p.y]); else await t.page.mouse.click(p.x, p.y);
      let s = await t.state();
      t.equal(s.ui.card, 'h-garvan', 'tapping the marker opens its card');
      const txt = await t.page.locator('#card').innerText();
      t.expect(/Main-lake point/.test(txt) && /18 ft/.test(txt), 'card shows structure and depth');
      const m = txt.match(/Run here\s*(\d+) min/);
      t.expect(!!m, 'card shows the run time');
      await t.shot('06-spot-card');
      const before = s.day.clock;
      await t.page.locator('#card .btn.primary').click();
      await t.page.waitForTimeout(250);
      s = await t.state();
      t.expect(!!s.day.run, 'boat is running');
      await t.shot('06b-boat-running', { wait: false });
      await t.game('act', 'finishAnim');
      s = await t.state();
      t.equal(s.day.boat.at, 'h-garvan', 'boat arrived');
      t.equal(s.day.clock - before, m ? +m[1] : -1, 'clock advanced by the run cost');
      t.expect(s.derived.runHome > 0, 'run home is now nonzero');
    },
  },
  {
    name: 'keyboard spot selection',
    viewports: ['desktop'],
    async run(t) {
      await quick(t, { lake: 'catherine', month: 3, tier: 'club' });
      await t.page.focus('#cv');
      await t.page.keyboard.press('ArrowRight');
      let s = await t.state();
      t.expect(!!s.ui.card, 'arrow key selects a point and opens its card');
      const first = s.ui.card;
      await t.page.keyboard.press('ArrowRight');
      s = await t.state();
      t.expect(s.ui.card !== first, 'next arrow moves the selection');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.ui.card, null, 'Esc closes the card');
    },
  },
  {
    name: 'hud',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await t.game('act', 'runTo', 'h-channel');
      await t.game('act', 'finishAnim');
      const hud = await t.page.locator('#hud').innerText();
      t.expect(/AM|PM/.test(hud), 'clock shown');
      t.expect(/in by 2:00 PM/.test(hud), 'check-in shown');
      t.expect(/\dm run/.test(hud), 'run time home shown');
      t.expect(/0 \/ 5 bass/.test(hud), 'livewell shown');
      t.expect(/water \d+° est\./.test(hud), 'water temperature labeled as an estimate');
      await t.shot('08-hud');
      await t.checkLayout();
    },
  },
];
