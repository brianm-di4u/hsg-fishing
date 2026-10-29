// Campaign: River Chain, briefing, hidden brush piles, gates, shop, stocking, championship, derby (AC2–AC4, AC7, AC31–AC34).
import { quick, waitFor } from './helpers.mjs';

async function playChapter(t, ch, weights, { species = 'largemouth', seed = 5 } = {}) {
  await t.seed(seed);
  await t.game('newGame', { mode: 'campaign', chapter: ch, seed });
  let s = await t.state();
  if (s.scene === 'briefing') await t.game('act', 'start');
  for (let d = 0; d < (s.event.days || 1); d++) {
    for (const w of weights) await t.game('act', 'keepFish', { sp: species, w });
    await t.game('act', 'endDay'); await t.game('act', 'finishAnim');
    s = await t.state();
    if (s.event.day < s.event.days) { await t.page.locator('[data-act="nextDay"]').click(); await t.game('act', 'start'); }
  }
  await t.page.locator('[data-act="finish"]').click();
  return t.state();
}

export const tests = [
  {
    name: 'river chain',
    async run(t) {
      await t.game('scene', 'campaign');
      const txt = await t.page.locator('#scene-campaign').innerText();
      for (const k of ['Lake Catherine', 'Lake Hamilton', 'Lake Ouachita', 'DeGray Lake', 'Remmel Dam', '1924', 'Carpenter Dam', '1931', 'Blakely Mountain Dam', '1953']) t.expect(txt.includes(k), `chain shows ${k}`);
      t.expect(/Finish top 5 in Remmel Rally Weeknight Club to open Carpenter Dam/.test(txt), 'locked gate states the finish needed');
      t.equal(await t.page.locator('#scene-campaign [data-act="play"]').count(), 1, 'only chapter 1 open at first');
      await t.shot('02-river-chain');
      await t.checkLayout({ allowScrollY: true });
      await t.game('setState', { profile: { campaign: { unlocked: ['ch1', 'ch2', 'ch3', 'ch4', 'side'], passed: { ch1: 2, ch2: 6 } } } });
      await t.game('scene', 'campaign');
      t.equal(await t.page.locator('#scene-campaign [data-act="play"]').count(), 5, 'all open');
      await t.shot('02b-river-chain-unlocked');
    },
  },
  {
    name: 'briefing',
    async run(t) {
      await t.game('scene', 'campaign');
      await t.page.locator('[data-act="play"][data-ch="ch1"]').click();
      const s = await t.state();
      t.equal(s.scene, 'briefing', 'briefing scene');
      const txt = await t.page.locator('#scene-briefing').innerText();
      for (const re of [/4:30 PM launch/, /8:00 PM/, /5-bass limit/, /Pairs: you and/, /high \d+°F, low \d+°F/, /game estimate/, /1,940 acres/, /generation board/i]) t.expect(re.test(txt), `briefing shows ${re}`);
      await t.shot('04-briefing');
      await t.checkLayout({ allowScrollY: true });
      await t.page.locator('[data-act="launch"]').click();
      t.equal((await t.state()).scene, 'map', 'launch goes to the map');
    },
  },
  {
    name: 'hidden brush piles',
    async run(t) {
      await t.game('setState', { profile: { campaign: { unlocked: ['ch1', 'ch2', 'ch3', 'ch4'] } } });
      await t.seed(3);
      await t.game('newGame', { mode: 'campaign', chapter: 'ch4', seed: 3, start: true });
      let s = await t.state();
      const hidden = Object.keys(s.day.spots).filter((k) => !s.day.spots[k].revealed);
      t.equal(hidden.length, 6, 'six brush piles hidden at launch');
      let lay = await t.game('act', 'layout');
      t.equal(lay.points.filter((p) => hidden.includes(p.id)).length, 0, 'hidden piles not drawn');
      await t.shot('07-ouachita-hidden');
      await t.game('act', 'runTo', 'o-geo'); await t.game('act', 'finishAnim');
      await t.game('act', 'scan');
      s = await t.state();
      const now = Object.keys(s.day.spots).filter((k) => k.startsWith('o-p') && s.day.spots[k].revealed);
      t.expect(now.length >= 2, `sonar reveals piles near Island Markers 28–36 (${now.length})`);
      lay = await t.game('act', 'layout');
      t.expect(lay.points.some((p) => now.includes(p.id)), 'revealed piles drawn');
      await t.game('act', 'select', now[0]);
      t.expect(/Island Marker 3\d|Island Marker 28/.test(await t.page.locator('#card').innerText()), 'card names the island marker');
      await t.shot('07b-ouachita-revealed');
    },
  },
  {
    name: 'gate opens and retry',
    async run(t) {
      let s = await playChapter(t, 'ch1', [4, 4, 4, 4, 4]);
      t.equal(s.scene, 'results', 'results');
      t.expect(s.event.outcome.passed, `top 5 passes (rank ${s.event.outcome.rank})`);
      t.expect(s.profile.campaign.unlocked.includes('ch2') && s.profile.campaign.unlocked.includes('side'), 'Hamilton and the DeGray side trip unlock');
      t.expect(/Carpenter Dam is open/.test(await t.page.locator('#scene-results').innerText()), 'gate message');
      t.expect(s.profile.money > 300, 'payout banked');
      await t.shot('31-results-advance');
      s = await playChapter(t, 'ch1', [], { seed: 9 });
      t.equal(s.event.outcome.passed, false, 'an empty bag misses the cut');
      t.equal(await t.page.locator('#scene-results [data-act="play"][data-ch="ch1"]').count(), 1, 'retry offered');
      await t.shot('31b-results-retry');
    },
  },
  {
    name: 'shop and upgrades',
    async run(t) {
      await t.game('setState', { profile: { money: 3000 } });
      await t.game('scene', 'shop');
      await t.shot('32-shop');
      await t.checkLayout({ allowScrollY: true });
      await t.page.locator('[data-act="buy"][data-id="whetstone"]').click();
      let s = await t.state();
      t.equal(s.profile.upgrades.whetstone, true, 'whetstone owned');
      t.equal(s.profile.money, 2750, 'paid $250');
      t.equal(await t.game('act', 'buy', 'motor'), true, 'motor bought');
      t.equal(await t.game('act', 'buy', 'jerk'), true, 'jerkbait bought');
      s = await t.state();
      t.expect(s.profile.lures.includes('jerk'), 'lure added to the tackle box');
      t.equal(await t.game('act', 'buy', 'motor'), false, 'cannot buy twice');
      // effects: run time (long Ouachita run) and hook-set window
      await t.game('newGame', { mode: 'quick', lake: 'ouachita', month: 10, tier: 'regional', seed: 4, start: true });
      await t.game('act', 'select', 'o-upper');
      const fast = +(await t.page.locator('#card').innerText()).match(/(\d+) min/)[1];
      await t.game('setState', { profile: { upgrades: { motor: false } } });
      await t.game('act', 'select', 'o-shad'); await t.game('act', 'select', 'o-upper');
      const slow = +(await t.page.locator('#card').innerText()).match(/(\d+) min/)[1];
      t.expect(fast < slow, `bigger outboard shortens runs (${fast} vs ${slow} min)`);
      await t.game('newGame', { mode: 'campaign', chapter: 'ch1', seed: 4, start: true });
      await t.game('act', 'runTo', 'c-bluff'); await t.game('act', 'finishAnim'); await t.game('act', 'fishHere');
      await t.game('act', 'cast', 0.5, 0.4); await t.game('act', 'finishAnim'); await t.game('act', 'forceBite', 'largemouth', 2);
      s = await t.state();
      t.equal(s.fish.bite.win, 0.75, 'whetstone widens the hook-set window to 0.75 s');
    },
  },
  {
    name: 'stocking choice',
    async run(t) {
      await t.game('setState', { profile: { money: 4000, campaign: { unlocked: ['ch1', 'ch2', 'ch3'] } } });
      const s = await playChapter(t, 'ch3', [5, 5, 5, 5, 5]);
      t.expect(s.event.outcome.passed, 'finale passed');
      await waitFor(t, (q) => q.ui.modal === 'stock', 3000, 'stocking modal');
      t.expect(/stocked every year/.test(await t.page.locator('#modal').innerText()), 'explains why stripers are stocked');
      await t.shot('33-stocking');
      await t.page.locator('[data-act="stock"][data-v="yes"]').click();
      const s2 = await t.state();
      t.equal(s2.profile.stocking, true, 'stocking chosen');
      const ctx = { lake: 'ouachita', month: 10, Tw: 72, min: 600, sky: 'clear', clarity: 'clear', air: 75, spot: { type: 'channel', depth: 30 }, lure: 'swim', color: 'shad', speed: 'fast', lureDepth: 18, bottom: 30, nearCover: false, pressure: 0 };
      const a = (await t.game('act', 'table', { ...ctx, stocking: true })).rows.find((r) => r.sp === 'striper').v;
      const b = (await t.game('act', 'table', { ...ctx, stocking: false })).rows.find((r) => r.sp === 'striper').v;
      t.expect(a > b * 1.5, 'more stripers with the stocking fund');
    },
  },
  {
    name: 'championship and derby',
    async run(t) {
      await t.game('setState', { profile: { campaign: { unlocked: ['ch1', 'ch2', 'ch3', 'ch4', 'side'] } } });
      let s = await playChapter(t, 'ch4', [6, 6, 6, 6, 6]);
      t.equal(s.event.outcome.rank, 1, 'won the championship');
      t.equal(s.profile.campaign.champion, true, 'champion flag');
      t.expect(/Champion!/.test(await t.page.locator('#scene-results').innerText()), 'champion screen');
      await t.shot('34-champion');
      await t.game('scene', 'campaign');
      t.expect(/champion/i.test(await t.page.locator('#scene-campaign').innerText()), 'River Chain shows the title');
      s = await playChapter(t, 'side', [], {});
      await t.seed(2);
      await t.game('newGame', { mode: 'campaign', chapter: 'side', seed: 2, start: true });
      t.equal((await t.game('act', 'keepInfo', { sp: 'blueCat', w: 30 })).ok, false, 'derby: no catfish');
      await t.game('act', 'keepFish', { sp: 'hybrid', w: 9 });
      await t.game('act', 'keepFish', { sp: 'hybrid', w: 11.5 });
      s = await t.state();
      t.equal(s.day.livewell.length, 1, 'derby keeps one fish');
      t.equal(s.day.livewell[0].w, 11.5, 'the heavier one');
      await t.game('act', 'endDay'); await t.game('act', 'finishAnim');
      await t.shot('34b-derby');
    },
  },
];
