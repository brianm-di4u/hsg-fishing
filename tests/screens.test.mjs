// Title, setup, journal, help, settings, juice frames (AC1, AC3, AC35–AC37, AC46).
import { quick, fishAt, castTo, hookFish, catchFish, waitFor } from './helpers.mjs';

export const tests = [
  {
    name: 'title dark',
    colorScheme: 'dark',
    async run(t) {
      const s = await t.state();
      t.equal(s.ui.theme, 'dark', 'dark theme from the system');
      await t.shot('01b-title-dark');
    },
  },
  {
    name: 'setup',
    async run(t) {
      await t.page.locator('[data-act="setup"][data-mode="quick"]').click();
      t.equal((await t.state()).scene, 'setup', 'setup scene');
      await t.page.locator('[data-act="pick"][data-k="lake"][data-v="catherine"]').click();
      await t.page.locator('[data-act="pick"][data-k="month"][data-v="12"]').click();
      await t.page.locator('[data-act="pick"][data-k="tier"][data-v="club"]').click();
      const txt = await t.page.locator('#scene-setup').innerText();
      t.expect(/Normals: high 55.4°F/.test(txt), 'month hint shows the normals');
      t.expect(/trout are stocked/i.test(txt), 'trout season hint');
      await t.shot('03-setup');
      await t.checkLayout({ allowScrollY: true });
      await t.page.locator('[data-act="startSetup"]').click();
      const s = await t.state();
      t.equal([s.event.lake, s.event.month, s.event.tier], ['catherine', 12, 'club'], 'event built from the setup');
      // Free Fish setup
      await t.game('scene', 'title');
      await t.page.locator('[data-act="setup"][data-mode="free"]').click();
      t.expect(/Statewide limits apply/.test(await t.page.locator('#scene-setup').innerText()), 'free setup states the limits');
    },
  },
  {
    name: 'journal',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      await catchFish(t, 'largemouth', 3.5);
      await catchFish(t, 'whiteCrappie', 0.9, false);
      await t.game('scene', 'journal');
      let txt = await t.page.locator('#scene-journal').innerText();
      t.expect(/Largemouth bass/.test(txt) && /best 3 lb 8 oz/.test(txt), 'species with best weight');
      t.expect(/White crappie/.test(txt), 'released fish are logged too');
      t.expect(/\?\?\?/.test(txt), 'uncaught species hidden');
      await t.shot('35-journal');
      await t.page.locator('[data-act="jtab"][data-v="records"]').click();
      txt = await t.page.locator('#scene-journal').innerText();
      t.expect(/legal-for-trade scale/.test(txt) && /64 lb 8 oz/.test(txt), 'state-record board with the certification rule');
      t.expect(!/Mardis|Fletcher|Shaum|Nelson/.test(txt), 'record holders are not named');
      await t.page.locator('[data-act="jtab"][data-v="notes"]').click();
      t.expect(await t.page.locator('#scene-journal .note').count() >= 1, 'Dock Notes read are listed');
      await t.page.locator('[data-act="jtab"][data-v="events"]').click();
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'help',
    async run(t) {
      await t.page.locator('[data-act="go"][data-to="help"]').click();
      const txt = await t.page.locator('#scene-help').innerText();
      for (const re of [/Mouse \/ touch/, /Keyboard/, /Hold Space/, /GOOD/, /SLACK/, /DANGER/, /Game estimates/, /fictional/, /56°F/]) t.expect(re.test(txt), `help covers ${re}`);
      await t.shot('36-help');
      await t.checkLayout({ allowScrollY: true });
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).scene, 'title', 'Esc goes back');
    },
  },
  {
    name: 'settings persist',
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.locator('[data-act="set"][data-k="sound"]').click();
      await t.page.locator('[data-act="set"][data-k="textScale"][data-v="1.15"]').click();
      await t.page.locator('[data-act="set"][data-k="assist"]').click();
      await t.page.locator('[data-act="set"][data-k="units"][data-v="lb"]').click();
      await t.page.locator('[data-act="set"][data-k="motion"][data-v="reduced"]').click();
      let s = await t.state();
      t.equal([s.settings.sound, s.settings.textScale, s.settings.assist, s.settings.units, s.ui.reduced], [false, 1.15, true, 'lb', true], 'settings applied');
      await t.shot('37-settings');
      await t.reload();
      s = await t.state();
      t.equal([s.settings.sound, s.settings.textScale, s.settings.assist, s.settings.units], [false, 1.15, true, 'lb'], 'settings persist after reload');
      // assist mode sets the hook automatically
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      await t.game('pause');
      await castTo(t, 0.5, 0.3);
      await t.game('act', 'forceBite', 'largemouth', 2);
      await t.game('step', 12);
      t.equal((await t.state()).fish.phase, 'fight', 'assist mode auto hook-set');
      await t.game('resume');
    },
  },
  {
    name: 'juice frames',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5, weather: { sky: 'clear', clarity: 'stained', rainRecent: false } });
      await fishAt(t, 'h-docks');
      await t.game('act', 'cast', 0.45, 0.42);
      await waitFor(t, (q) => q.fish.phase === 'retrieve', 3000, 'splashdown');
      await t.page.waitForTimeout(90);
      await t.shot('46-splash', { wait: false });
      await t.game('pause');
      await hookFish(t, 'largemouth', 4);
      await t.game('setState', { fish: { fight: { jump: 0.4, jumpT: 99, surgeT: 99, tension: 0.5, dist: 30 } } });
      await t.game('step', 1);
      await t.shot('46b-jump');
      await t.game('resume');
      await t.game('setState', { profile: { campaign: { unlocked: ['ch1', 'ch2', 'ch3', 'ch4'] } } });
      await t.seed(5);
      await t.game('newGame', { mode: 'campaign', chapter: 'ch4', seed: 5, start: true });
      for (let d = 0; d < 2; d++) {
        for (const w of [7, 7, 7, 7, 7]) await t.game('act', 'keepFish', { sp: 'largemouth', w });
        await t.game('act', 'endDay'); await t.game('act', 'finishAnim');
        if (d === 0) { await t.page.locator('[data-act="nextDay"]').click(); await t.game('act', 'start'); }
      }
      await t.page.locator('[data-act="finish"]').click();
      await t.page.waitForTimeout(400);
      await t.shot('46c-confetti', { wait: false });
    },
  },
];
