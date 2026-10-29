// Fish model and weather (AC15–AC23, AC30). Pure-model checks through act('table') / act('phase') plus a few
// in-game checks with screenshots.
import { quick, fishAt, waitFor } from './helpers.mjs';

const base = (o) => ({ lake: 'hamilton', month: 5, Tw: 72, min: 10 * 60, sky: 'clear', clarity: 'stained', air: 80, spot: { type: 'point', depth: 15 }, lure: 'craw', color: 'green pumpkin', speed: 'med', lureDepth: 12, bottom: 15, nearCover: true, eagle: false, gen: false, pressure: 0, stocking: false, ...o });
const v = (tab, sp) => (tab.rows.find((r) => r.sp === sp) || { v: 0 }).v;
const TYPES = ['cove', 'flat', 'docks', 'point', 'brush', 'grass', 'channel', 'riprap', 'tailrace', 'creek', 'island', 'open'];
const LURES = ['craw', 'crankS', 'crankD', 'spinner', 'popper', 'tube', 'crawler', 'dough', 'swim', 'jig'];

export const tests = [
  {
    name: 'species by lake',
    viewports: ['desktop'],
    async run(t) {
      const allowed = {
        catherine: ['largemouth', 'spotted', 'whiteBass', 'bluegill', 'drum', 'gar', 'trout'],
        hamilton: ['largemouth', 'spotted', 'striper', 'hybrid', 'whiteBass', 'yellowBass', 'whiteCrappie', 'blackCrappie', 'bluegill', 'channelCat', 'blueCat'],
        ouachita: ['largemouth', 'smallmouth', 'spotted', 'striper', 'walleye', 'whiteCrappie', 'bluegill', 'channelCat'],
        degray: ['largemouth', 'hybrid', 'whiteBass', 'walleye', 'whiteCrappie', 'bluegill', 'redear', 'channelCat', 'blueCat', 'flathead', 'pike', 'muskie'],
      };
      for (const lake of Object.keys(allowed)) {
        const seen = new Set();
        for (const month of [1, 3, 5, 7, 10, 12]) for (const type of TYPES) for (const lure of LURES) {
          const tab = await t.game('act', 'table', base({ lake, month, Tw: await t.game('act', 'waterTemp', month), spot: { type, depth: 14 }, lure, lureDepth: 8, bottom: 14 }));
          tab.rows.forEach((r) => seen.add(r.sp));
        }
        const extra = [...seen].filter((s) => !allowed[lake].includes(s));
        t.equal(extra, [], `${lake}: only corpus-listed species`);
        t.log(`${lake}: ${[...seen].join(', ')}`);
      }
      // trout only in the tailrace, in season
      const trout = async (o) => v(await t.game('act', 'table', base({ lake: 'catherine', lure: 'dough', spot: { type: 'tailrace', depth: 8 }, lureDepth: 6, bottom: 8, ...o })), 'trout');
      t.expect(await trout({ month: 3, Tw: 55 }) > 0, 'trout in the tailrace in March');
      t.equal(await trout({ month: 7, Tw: 85 }), 0, 'no trout in July (stocked November–April)');
      t.equal(await trout({ month: 3, Tw: 55, spot: { type: 'cove', depth: 8 } }), 0, 'no trout away from the tailrace');
    },
  },
  {
    name: 'spawn ladder',
    viewports: ['desktop'],
    async run(t) {
      const ph = (sp, m, Tw) => t.game('act', 'phase', sp, m, Tw);
      t.equal(await ph('whiteCrappie', 3, 57), 'spawn', 'crappie move up from about 56°F');
      t.equal(await ph('largemouth', 3, 57), 'prespawn', 'bass still staging at 57°F');
      t.equal(await ph('largemouth', 4, 65), 'spawn', 'bass spawn a few degrees warmer');
      t.equal(await ph('bluegill', 4, 65), 'other', 'bream not yet');
      t.equal(await ph('bluegill', 5, 72), 'spawn', 'bream spawn above the 60s');
      t.equal(await ph('channelCat', 5, 72), 'other', 'catfish not yet');
      t.equal(await ph('channelCat', 6, 81), 'spawn', 'catfish spawn warmest');
      t.equal(await ph('largemouth', 8, 86), 'summer', 'summer pattern in August');
      t.equal(await ph('largemouth', 1, 48), 'winter', 'winter pattern in January');
      // shallow in the window, deep or on brush otherwise
      const cove = (m, Tw, sp) => t.game('act', 'table', base({ month: m, Tw, spot: { type: 'cove', depth: 5 }, lure: sp === 'whiteCrappie' ? 'tube' : 'craw', lureDepth: 3, bottom: 5 }));
      const brush = (m, Tw, sp) => t.game('act', 'table', base({ month: m, Tw, spot: { type: 'brush', depth: 22 }, lure: sp === 'whiteCrappie' ? 'tube' : 'craw', lureDepth: 20, bottom: 22 }));
      const aprC = v(await cove(4, 62, 'whiteCrappie'), 'whiteCrappie'), augC = v(await cove(8, 86, 'whiteCrappie'), 'whiteCrappie');
      t.expect(aprC > augC * 3, `crappie shallow in April (${aprC.toFixed(3)}) vs August (${augC.toFixed(3)})`);
      const augB = v(await brush(8, 86, 'whiteCrappie'), 'whiteCrappie');
      t.expect(augB > augC * 3, 'crappie on brush in August');
      const aprBass = v(await cove(4, 65, 'largemouth'), 'largemouth'), janBass = v(await cove(1, 48, 'largemouth'), 'largemouth');
      t.expect(aprBass > janBass * 3, 'bass shallow in the spawn, not in winter');
    },
  },
  {
    name: 'summer heat and low light',
    viewports: ['desktop'],
    async run(t) {
      const hot = { lake: 'hamilton', month: 8, Tw: 86, air: 93, min: 13 * 60 };
      const deep = v(await t.game('act', 'table', base({ ...hot, spot: { type: 'channel', depth: 28 }, lureDepth: 22, bottom: 28 })), 'largemouth');
      const shallow = v(await t.game('act', 'table', base({ ...hot, spot: { type: 'cove', depth: 5 }, lureDepth: 3, bottom: 5 })), 'largemouth');
      t.expect(deep > shallow * 2, `midday August: deep (${deep.toFixed(3)}) beats shallow (${shallow.toFixed(3)})`);
      const sun = await t.game('act', 'sun', 8);
      const pop = async (min) => v(await t.game('act', 'table', base({ ...hot, min, air: 78, lure: 'popper', color: 'shad', spot: { type: 'cove', depth: 5 }, lureDepth: 0, bottom: 5 })), 'largemouth');
      const dawn = await pop(sun.rise + 20), noon = await pop(12 * 60);
      t.expect(dawn > noon * 2, `topwater at dawn (${dawn.toFixed(3)}) beats noon (${noon.toFixed(3)})`);
    },
  },
  {
    name: 'Hamilton May kicker',
    viewports: ['desktop'],
    async run(t) {
      const n = 4000;
      const kick = await t.game('act', 'weights', { sp: 'largemouth', n, opts: { lake: 'hamilton', month: 5, lure: 'craw', color: 'green pumpkin', hab: 'brush' } });
      const plain = await t.game('act', 'weights', { sp: 'largemouth', n, opts: { lake: 'hamilton', month: 5, lure: 'spinner', color: 'chartreuse', hab: 'brush' } });
      const other = await t.game('act', 'weights', { sp: 'largemouth', n, opts: { lake: 'ouachita', month: 5, lure: 'craw', color: 'green pumpkin', hab: 'brush' } });
      t.log(`kicker share ≥ 6.5 lb: green-pumpkin craw ${kick.bigShare.toFixed(3)}, spinnerbait ${plain.bigShare.toFixed(3)}, Ouachita ${other.bigShare.toFixed(3)}`);
      t.expect(kick.bigShare > plain.bigShare * 1.8, 'green-pumpkin Texas-rigged craw raises kicker odds');
      t.expect(plain.bigShare > other.bigShare, 'Florida-strain Hamilton has more kickers than Ouachita');
      const post = v(await t.game('act', 'table', base({ spot: { type: 'brush', depth: 16 }, lureDepth: 14, bottom: 16 })), 'largemouth');
      const sep = v(await t.game('act', 'table', base({ month: 4, Tw: 72, spot: { type: 'brush', depth: 16 }, lureDepth: 14, bottom: 16 })), 'largemouth');
      t.expect(post > sep, 'May post-spawn brush bonus');
    },
  },
  {
    name: 'clarity, pressure, eagles, brush pace',
    viewports: ['desktop'],
    async run(t) {
      const col = async (clarity, color) => (await t.game('act', 'table', base({ clarity, color }))).total;
      t.expect(await col('clear', 'green pumpkin') > await col('clear', 'chartreuse'), 'natural colors win in clear water');
      t.expect(await col('muddy', 'chartreuse') > await col('muddy', 'green pumpkin'), 'bright colors win in muddy water');
      t.expect(await col('muddy', 'black/blue') > await col('muddy', 'green pumpkin'), 'dark colors win in muddy water');
      const pr = async (pressure) => (await t.game('act', 'table', base({ pressure }))).total;
      t.expect(await pr(1) < (await pr(0)) * 0.5, 'pressure lowers bite odds');
      const eg = async (eagle) => v(await t.game('act', 'table', base({ lake: 'ouachita', month: 1, Tw: 48, eagle, spot: { type: 'point', depth: 25 }, lureDepth: 22, bottom: 25 })), 'striper');
      t.expect(await eg(true) > (await eg(false)) * 1.4, 'eagle-marked spot raises striper odds');
      const slowRatio = async (lake) => { const s = (await t.game('act', 'table', base({ lake, month: 10, Tw: 72, spot: { type: 'brush', depth: 22 }, lureDepth: 21, bottom: 22, speed: 'slow' }))).total; const m = (await t.game('act', 'table', base({ lake, month: 10, Tw: 72, spot: { type: 'brush', depth: 22 }, lureDepth: 21, bottom: 22, speed: 'med' }))).total; return s / m; };
      t.expect(await slowRatio('ouachita') > (await slowRatio('hamilton')) * 1.3, 'slowing down on Ouachita brush pays');
      // in game: pressure builds on a spot and decays while away
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      for (let i = 0; i < 3; i++) { await t.game('act', 'cast', 0.5, 0.3); await t.game('act', 'finishAnim'); await t.game('act', 'forceBite', 'largemouth', 2); await t.game('act', 'setHook'); await t.game('act', 'land'); await t.game('act', 'release'); }
      let s = await t.state(); const p0 = s.day.spots['h-hump'].pressure;
      t.expect(p0 > 0.5, `catches pressure the spot (${p0.toFixed(2)})`);
      await t.game('act', 'leave'); await t.game('act', 'runTo', 'h-channel'); await t.game('act', 'finishAnim'); await t.game('act', 'spend', 180);
      s = await t.state();
      t.expect(s.day.spots['h-hump'].pressure < p0 - 0.25, 'pressure recovers while you are away');
    },
  },
  {
    name: 'trout tailrace and generation',
    async run(t) {
      await quick(t, { lake: 'catherine', month: 3, tier: 'club' });
      let s = await t.state();
      t.expect(s.day.gen.length >= 1, 'a generation schedule');
      const [g0, g1] = s.day.gen[0];
      await t.game('act', 'runTo', 'c-tail'); await t.game('act', 'finishAnim');
      await t.game('act', 'select', 'c-tail');
      const card = await t.page.locator('#card').innerText();
      t.expect(/Generation board/.test(card), 'tailrace card shows the generation board');
      await t.shot('21-generation-board');
      await t.game('act', 'fishHere');
      s = await t.state();
      if (s.day.clock < g0) {
        t.equal(s.scene, 'fish', 'tailrace open before generation');
        await t.game('act', 'spend', g0 - s.day.clock + 1);
        s = await t.state();
        t.equal(s.scene, 'map', 'generation sends you out of the tailrace');
        t.expect(s.profile.journal.events.generation >= 1, 'journal records the generation');
      }
      s = await t.state();
      if (s.day.clock >= g0 && s.day.clock < g1) {
        await t.game('act', 'fishHere');
        s = await t.state();
        t.equal(s.scene, 'map', 'cannot fish the tailrace while generating');
      }
    },
  },
  {
    name: 'eagles',
    async run(t) {
      await quick(t, { lake: 'ouachita', month: 1, tier: 'regional' });
      let s = await t.state();
      t.expect(!!s.day.eagle, 'eagle season on Ouachita in January');
      await t.game('act', 'select', s.day.eagle.spot);
      t.expect(/eagle is circling/.test(await t.page.locator('#card').innerText()), 'spot card mentions the eagle');
      await t.shot('22-eagle');
      await quick(t, { lake: 'hamilton', month: 1, tier: 'regional' });
      s = await t.state();
      t.equal(s.day.eagle, null, 'no eagle mechanic on Hamilton (eagles are sourced for Ouachita and DeGray)');
    },
  },
  {
    name: 'weather from normals and snow days',
    async run(t) {
      if (t.viewport === 'desktop') {
        const normals = { 1: [53.4, 32.2], 5: [81.5, 61.0], 8: [92.8, 71.7] };
        for (const m of [1, 5, 8]) {
          let hi = 0, lo = 0, snow = 0; const n = 300;
          for (let i = 1; i <= n; i++) { const w = await t.game('act', 'weather', m, 'hamilton', i * 13); hi += w.hi; lo += w.lo; if (w.sky === 'snow') snow++; }
          t.expect(Math.abs(hi / n - normals[m][0]) < 1.5 && Math.abs(lo / n - normals[m][1]) < 1.5, `month ${m}: daily highs/lows average the normals (${(hi / n).toFixed(1)}/${(lo / n).toFixed(1)})`);
          if (m !== 1) t.equal(snow, 0, `no snow in month ${m}`);
          else t.expect(snow < 20, `snow is rare in January (${snow}/${n})`);
        }
        t.equal(await t.game('act', 'waterTemp', 3), 55.6, 'March water estimate ≈ 56°F');
      }
      await quick(t, { lake: 'degray', month: 1, tier: 'derby', start: false, weather: { sky: 'snow' } });
      let s = await t.state();
      t.equal(s.scene, 'briefing', 'snow day holds at the briefing');
      t.expect(/ramps are closed/.test(await t.page.locator('#scene-briefing').innerText()), 'snow banner');
      await t.shot('30-snow-day');
      await t.page.locator('[data-act="snowDelay"]').click();
      s = await t.state();
      t.equal(s.event.snowDelays, 1, 'the event moved a day');
      t.expect(s.day.weather.sky !== 'snow', 'next day is fishable');
    },
  },
];
