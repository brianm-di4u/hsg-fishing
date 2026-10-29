// Balance: a scripted angler plays whole tournament days through the hooks (paused, stepped ticks) with
// sensible spot and lure choices and a careful fight. Logs bags against the field; asserts the game is
// winnable but not trivial. Desktop only (it is slow and viewport-independent).
import { quick, waitFor } from './helpers.mjs';

export async function botDay(t, { lake, month, tier, seed, spots, casts = 7, tag = '' }) {
  await quick(t, { lake, month, tier, seed });
  await t.game('pause');
  const lures = ['craw', 'jig', 'crankS', 'crankD', 'spinner', 'popper', 'dropshot', 'jerk', 'swim'];
  let fish = 0, bites = 0, lost = 0;
  for (const id of spots) {
    let s = await t.state();
    if (s.derived.timeUp || s.day.end - s.day.clock - s.derived.runHome < 25) break;
    await t.game('act', 'runTo', id); await t.game('act', 'finishAnim');
    s = await t.state(); if (s.scene !== 'map') break;
    await t.game('act', 'fishHere');
    s = await t.state(); if (s.scene !== 'fish') continue;
    const sc = await t.game('act', 'spotScene');
    const cov = sc.cover.find((c) => c.x != null && c.k !== 'grass' && c.k !== 'dock') || sc.cover.find((c) => c.k === 'dock');
    const target = cov ? (cov.k === 'dock' ? [cov.x + cov.w, cov.y1 * 0.9] : [cov.x, (cov.y ?? 0.3) + 0.05]) : [0.5, Math.max(0.3, sc.shoreMid + 0.12)];
    // choose the lure (and speed) with the best odds near the target
    let best = null;
    for (const l of lures) for (const sp of ['slow', 'med']) {
      await t.game('act', 'lure', l);
      const o = await t.game('act', 'odds', { x: target[0], y: target[1] + 0.15, speed: sp, nearCover: !!cov });
      if (!best || o.total > best.v) best = { l, sp, v: o.total };
    }
    await t.game('act', 'lure', best.l); await t.game('act', 'speed', best.sp);
    for (let c = 0; c < casts; c++) {
      s = await t.state();
      if (s.derived.timeUp || s.day.end - s.day.clock - s.derived.runHome < 20) break;
      await t.game('act', 'cast', target[0], target[1], 0.9); await t.game('act', 'finishAnim');
      await t.game('act', 'reel', true);
      for (let i = 0; i < 400; i++) {
        s = await t.state(); const F = s.fish; if (!F) break;
        if (F.phase === 'bite') { bites++; await t.game('act', 'setHook'); continue; }
        if (F.phase === 'fight') {
          const f = F.fight;
          await t.game('act', 'reel', f.tension < 0.6 && f.surge <= 0 && f.jump <= 0);
          await t.game('act', 'rod', f.heading >= 0 ? -1 : 1);
          await t.game('step', 15); continue; // about a human reaction time between decisions
        }
        if (F.phase === 'landed') { fish++; await t.game('act', 'keep'); break; }
        if (F.phase === 'lost') { lost++; await t.game('step', 90); break; }
        if (['aim', 'back', 'snag'].includes(F.phase)) { await t.game('step', 80); break; }
        if (F.phase === 'retrieve' && !F.reel) await t.game('act', 'reel', true);
        await t.game('step', 12);
      }
      s = await t.state(); if (s.scene !== 'fish') break;
      if (s.fish && s.fish.phase !== 'aim') await t.game('step', 90);
    }
    s = await t.state(); if (s.scene === 'fish') await t.game('act', 'leave');
  }
  let s = await t.state();
  if (s.scene === 'map' || s.scene === 'fish') await t.game('act', 'endDay');
  await t.game('act', 'finishAnim');
  s = await t.state();
  const st = await t.game('act', 'standings');
  const res = s.event.results[s.event.day - 1].player;
  t.log(`${tag} ${lake}/${month}/${tier} seed ${seed}: kept ${res.fish.length}, bag ${res.total.toFixed(2)} lb (big ${res.big.toFixed(2)}), caught ${s.day.caught}, bites ${bites}, lost ${lost}, rank ${st.me.rank}/${st.rows.length}, winner ${st.rows[0].total.toFixed(2)}`);
  await t.game('resume');
  return { res, st, caught: s.day.caught };
}

export const tests = [
  {
    name: 'balance: scripted angler days',
    viewports: ['desktop'],
    async run(t) {
      if (!['final', 'scratch', 'balance'].includes(t.milestone)) { t.log('balance runs only at --milestone final/scratch/balance'); return; }
      const plans = [
        { lake: 'catherine', month: 3, tier: 'club', spots: ['c-bluff', 'c-docks', 'c-channel', 'c-ccc', 'c-riprap'] },
        { lake: 'hamilton', month: 5, tier: 'regional', spots: ['h-hump', 'h-docks', 'h-hatch', 'h-garvan', 'h-seawall', 'h-channel', 'h-riprap'] },
        { lake: 'hamilton', month: 9, tier: 'finale', spots: ['h-hump', 'h-channel', 'h-garvan', 'h-hatch', 'h-riprap', 'h-docks'] },
        { lake: 'ouachita', month: 10, tier: 'championship', spots: ['o-long', 'o-geo', 'o-main', 'o-dam', 'o-creek', 'o-shad'] },
      ];
      const ranks = [];
      for (const p of plans) for (const seed of [3, 11]) {
        const r = await botDay(t, { ...p, seed, tag: 'bot' });
        ranks.push(r.st.me.rank);
        t.expect(r.caught >= 3, `${p.lake}: a sensible day catches fish (${r.caught})`);
      }
      t.log('ranks ' + ranks.join(','));
      t.expect(ranks.filter((r) => r <= 5).length >= 4, 'a skilled angler places top 5 on at least half the days');
      t.expect(ranks.some((r) => r > 1), 'not trivially winnable');
    },
  },
];
