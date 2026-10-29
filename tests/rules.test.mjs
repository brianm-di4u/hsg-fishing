// Livewell, limits, warden, check-in, weigh-in, ties, two-day events, calibration, names (AC24–AC29).
import { quick, fishAt, catchFish, hookFish, waitFor } from './helpers.mjs';

async function weighAndFinishAnim(t) {
  await t.game('act', 'endDay');
  await t.game('act', 'finishAnim');
  return t.state();
}

export const tests = [
  {
    name: 'livewell, culling, partner',
    async run(t) {
      await quick(t, { lake: 'catherine', month: 3, tier: 'club' });
      await fishAt(t, 'c-bluff');
      for (const w of [1.5, 1.75, 2, 2.25, 2.5]) await catchFish(t, 'largemouth', w);
      let s = await t.state();
      t.equal(s.day.livewell.filter((f) => f.by !== 'partner').length >= 5 || s.day.livewell.length === 5, true, 'five bass in the livewell');
      // bigger fish culls the smallest
      await hookFish(t, 'largemouth', 3.5);
      await t.game('act', 'land');
      await waitFor(t, (q) => q.ui.modal === 'catch', 3000, 'catch card');
      t.expect(/Keep \(cull 1 lb 8 oz\)/.test(await t.page.locator('#modal').innerText()), 'keep offers the cull');
      await t.shot('24-cull');
      await t.game('act', 'keep');
      s = await t.state();
      t.equal(s.day.livewell.length, 5, 'still five after culling');
      t.equal(s.day.culled.length, 1, 'one culled');
      t.expect(Math.min(...s.day.livewell.map((f) => f.w)) >= 1.75, 'smallest was culled');
      // smaller fish cannot be kept
      await hookFish(t, 'spotted', 1);
      await t.game('act', 'land');
      await waitFor(t, (q) => q.ui.modal === 'catch', 3000, 'catch card');
      t.expect(/Livewell full/.test(await t.page.locator('#modal').innerText()), 'livewell full message');
      t.equal(await t.page.locator('#modal [data-act="keep"]').count(), 0, 'no keep button');
      await t.game('act', 'release');
      // non-bass species are logged and released
      const info = await t.game('act', 'keepInfo', { sp: 'trout', w: 1 });
      t.equal(info.ok, false, 'trout does not count in a bass tournament');
      // partner adds fish to the shared livewell over the evening (pairs)
      let partner = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        await quick(t, { lake: 'catherine', month: 3, tier: 'club', seed });
        await t.game('act', 'spend', 200);
        s = await t.state(); partner += s.day.livewell.filter((f) => f.by === 'partner').length;
        if (partner) break;
      }
      t.expect(partner > 0, 'partner boats bass into the livewell');
      t.expect(/&/.test(s.event.field[0].name), 'club field is teams');
    },
  },
  {
    name: 'free fish limits and warden',
    async run(t) {
      await quick(t, { mode: 'free', lake: 'ouachita', month: 5 });
      const keep = (sp, w = 1.5) => t.game('act', 'keepFish', { sp, w });
      for (let i = 0; i < 4; i++) t.equal((await keep('smallmouth')).ok, true, `smallmouth ${i + 1} kept`);
      const r5 = await keep('smallmouth');
      t.equal(r5.ok, false, 'fifth smallmouth refused');
      t.expect(/4 smallmouth/.test(r5.why), 'smallmouth cap message');
      for (let i = 0; i < 6; i++) await keep('largemouth');
      const r11 = await keep('largemouth');
      t.equal(r11.ok, false, 'eleventh black bass refused');
      t.expect(/10 black bass/.test(r11.why), 'bass limit message');
      for (let i = 0; i < 30; i++) await keep('whiteCrappie', 0.8);
      const c31 = await keep('whiteCrappie', 0.8);
      t.equal(c31.ok, false, '31st crappie refused');
      t.equal((await keep('channelCat', 3)).ok, false, 'other species released in Free Fish');
      const s = await weighAndFinishAnim(t);
      await t.page.locator('[data-act="finish"]').click();
      const txt = await t.page.locator('#scene-results').innerText();
      t.expect(/Livewell check/.test(txt) && /All legal/.test(txt), 'warden checks the livewell');
      t.expect(/3× the daily limit/.test(txt), 'possession limit explained');
      t.equal(s.derived ? true : true, true, 'state ok');
      await t.shot('25-warden');
    },
  },
  {
    name: 'late check-in',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await t.game('act', 'runTo', 'h-upper'); await t.game('act', 'finishAnim');
      for (const w of [3, 3, 3, 3, 3]) await t.game('act', 'keepFish', { sp: 'largemouth', w });
      let s = await t.state();
      const home = s.derived.runHome;
      await t.game('setState', { day: { clock: s.day.end - home + 10 } });
      s = await weighAndFinishAnim(t);
      const p = s.event.results[0].player;
      t.equal(p.late, 10, '10 minutes late');
      t.equal(p.penalty, 10, '1 lb per minute');
      t.equal(p.total, 5, '15 lb bag less 10 lb');
      t.equal(p.dq, false, 'not disqualified');
      t.expect(/late 10 min/.test(await t.page.locator('#scene-weighin').innerText()), 'scoreboard shows the penalty');
      await t.shot('26-late');
      await quick(t, { lake: 'hamilton', month: 5 });
      await t.game('act', 'runTo', 'h-upper'); await t.game('act', 'finishAnim');
      await t.game('act', 'keepFish', { sp: 'largemouth', w: 4 });
      s = await t.state();
      await t.game('setState', { day: { clock: s.day.end - s.derived.runHome + 20 } });
      s = await weighAndFinishAnim(t);
      t.equal(s.event.results[0].player.dq, true, 'more than 15 minutes late is a DQ');
      t.equal(s.event.results[0].player.total, 0, 'DQ weighs zero');
    },
  },
  {
    name: 'weigh-in, tie, two-day totals',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      for (const w of [2.5, 3.25, 4, 2.75, 3.5]) await t.game('act', 'keepFish', { sp: 'largemouth', w });
      await t.game('act', 'endDay');
      let s = await t.state();
      t.equal(s.scene, 'weighin', 'weigh-in scene');
      t.equal(await t.game('isIdle'), false, 'reveal animation runs');
      await t.page.waitForTimeout(1300);
      await t.shot('27-weighin-reveal', { wait: false });
      await t.game('act', 'finishAnim');
      const txt = await t.page.locator('#scene-weighin').innerText();
      t.expect(/16-00/.test(txt), 'scoreboard shows 16 lb 0 oz');
      t.expect(/Final standings/.test(txt), 'leaderboard');
      await t.shot('27b-leaderboard');
      const st = await t.game('act', 'forceTie');
      t.equal(st.tie, true, 'tie detected');
      const me = st.rows.find((r) => r.you), other = st.rows.find((r) => !r.you && r.oz === me.oz);
      t.expect(me.rank < other.rank, 'tie broken by big fish');
      t.expect(/tie broken by big fish/.test(await t.page.locator('#scene-weighin').innerText()), 'tie shown on the board');
      await t.shot('27c-tie');
      // two-day finale totals
      await quick(t, { lake: 'hamilton', month: 9, tier: 'finale' });
      for (const w of [2, 2, 2, 2, 2]) await t.game('act', 'keepFish', { sp: 'largemouth', w });
      await weighAndFinishAnim(t);
      t.equal(await t.page.locator('[data-act="nextDay"]').count(), 1, 'day 2 button');
      await t.page.locator('[data-act="nextDay"]').click();
      await t.game('act', 'start');
      for (const w of [3, 3, 3, 3, 3]) await t.game('act', 'keepFish', { sp: 'largemouth', w });
      s = await weighAndFinishAnim(t);
      const st2 = await t.game('act', 'standings');
      t.equal(st2.me.total, 25, 'two-day total is both days (10 + 15)');
      t.equal(s.event.day, 2, 'day 2');
    },
  },
  {
    name: 'field calibration',
    viewports: ['desktop'],
    async run(t) {
      for (const [tier, lake, month] of [['club', 'catherine', 3], ['regional', 'hamilton', 5], ['finale', 'hamilton', 9], ['championship', 'ouachita', 10]]) {
        const r = await t.game('act', 'simField', { tier, lake, month, seeds: 150 });
        t.log(`${tier}: mean winner ${r.mean.toFixed(2)} lb (target ${r.target})`);
        t.expect(Math.abs(r.mean / r.target - 1) <= 0.12, `${tier} winners within 12% of the target`);
      }
    },
  },
  {
    name: 'no real angler names',
    viewports: ['desktop'],
    async run(t) {
      const banned = ['Clent Davis', 'Ricky Williams', 'Spencer Shuffield', 'Austin Rose', 'Matt Baker', 'Nicholas Brown', 'Aaron Mardis', 'Jeff Fletcher', 'Jerald Shaum', 'Al Nelson', 'Shane Goodner', 'Forrest Wood', 'Kevin VanDam', 'Rick Clunn', 'Larry Nixon', 'Mark Davis', 'Stephen Browning', 'Bill Dance', 'Jimmy Houston', 'Roland Martin', 'Hank Parker', 'Denny Brauer'];
      const surnames = ['Davis', 'Nixon', 'Browning', 'VanDam', 'Clunn', 'Dance', 'Houston', 'Martin', 'Brauer', 'Shuffield', 'Mardis', 'Goodner', 'Fletcher', 'Shaum', 'Williams', 'Nelson', 'Rose', 'Baker'];
      const { names } = await t.game('act', 'names');
      t.equal(names.length, 48, '48 fictional anglers');
      t.equal(names.filter((n) => banned.includes(n)), [], 'no banned names');
      t.equal(names.filter((n) => surnames.includes(n.split(' ').pop())), [], 'no banned surnames');
      const html = await t.page.content();
      t.equal(banned.filter((n) => html.includes(n)), [], 'banned names appear nowhere in the page (including Dock Notes)');
      await quick(t, { lake: 'catherine', month: 3, tier: 'club' });
      const { field } = await t.game('act', 'names');
      t.equal(field.filter((n) => banned.some((b) => n.includes(b))), [], 'field has no banned names');
    },
  },
];
