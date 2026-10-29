// Keyboard-only day, contrast, reduced motion, large text, touch targets, storage (AC38–AC43).
import { quick, fishAt, castTo, catchFish, waitFor } from './helpers.mjs';

// Solitaire's contrastReport (games/solitaire/tests/screens.test.mjs), adapted.
async function contrastReport(t, selectors) {
  return t.page.evaluate((sels) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.75) return c; } return { r: 14, g: 34, b: 51, a: 1 }; };
    const out = [];
    for (const s of sels) for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]') || !el.textContent.trim() || el.disabled) continue;
      const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
      const a = lum(fg), b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      out.push({ s, text: el.textContent.trim().slice(0, 24), ratio: +ratio.toFixed(2) });
    }
    return out;
  }, selectors);
}
const TEXT = ['.btn', '.chip', '.seg', 'p', 'h2', 'h3', 'li', 'td', 'th', 'small', 'b', '.hud-item b', '.hud-item small', '#status', '#card p', 'legend', '.money', '.lakename', 'caption', '.neon', '.neon-sub'];

async function touchTargets(t) {
  return t.page.evaluate(() => [...document.querySelectorAll('button, input, [role=tab]')].filter((el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && r.bottom > 0 && r.top < innerHeight;
  }).map((el) => { const r = el.getBoundingClientRect(); return { id: el.id || el.dataset.act || el.className, w: Math.round(r.width), h: Math.round(r.height) }; }).filter((b) => b.w < 44 || b.h < 44));
}

export const tests = [
  {
    name: 'keyboard-only day',
    viewports: ['desktop'],
    async run(t) {
      const tabTo = async (pred, label) => { for (let i = 0; i < 40; i++) { if (await t.page.evaluate(pred)) return true; await t.page.keyboard.press('Tab'); } t.fail('could not Tab to ' + label); return false; };
      await t.seed(12);
      await tabTo(() => document.activeElement && document.activeElement.dataset.mode === 'quick', 'Quick Tournament');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).scene, 'setup', 'setup by keyboard');
      await tabTo(() => document.activeElement && document.activeElement.dataset.act === 'startSetup', 'Go fishing');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).scene, 'briefing', 'briefing by keyboard');
      await t.page.keyboard.press('Enter'); // Launch has focus
      t.equal((await t.state()).scene, 'map', 'launched by keyboard');
      await t.page.focus('#cv');
      for (let i = 0; i < 25; i++) { const s = await t.state(); if (s.ui.card && !s.ui.card.startsWith('lm:') && s.ui.card !== 'ramp') break; await t.page.keyboard.press('ArrowRight'); }
      let s = await t.state();
      const target = s.ui.card;
      await t.page.locator('#card .btn.primary').focus();
      await t.page.keyboard.press('Enter');
      await t.game('act', 'finishAnim');
      s = await t.state();
      t.equal(s.day.boat.at, target, 'ran to the spot by keyboard');
      await t.page.focus('#cv');
      for (let i = 0; i < 25; i++) { s = await t.state(); if (s.ui.card === target) break; await t.page.keyboard.press('ArrowRight'); }
      await t.page.locator('#card [data-act="fishHere"]').focus();
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).scene, 'fish', 'fishing by keyboard');
      await t.page.focus('#cv');
      await t.page.keyboard.press('ArrowUp');
      await t.page.keyboard.down(' '); await t.page.waitForTimeout(540); await t.page.keyboard.up(' ');
      await waitFor(t, (q) => q.fish.phase === 'retrieve', 3000, 'lure down');
      await t.game('act', 'forceBite', 'largemouth', 2.5);
      await t.page.keyboard.press('Enter');
      s = await t.state();
      t.equal(s.fish.phase, 'fight', 'Enter sets the hook');
      await t.page.keyboard.down(' '); await t.page.keyboard.down('ArrowLeft'); await t.page.waitForTimeout(300); await t.page.keyboard.up('ArrowLeft'); await t.page.keyboard.up(' ');
      await t.game('act', 'land');
      await waitFor(t, (q) => q.ui.modal === 'catch', 3000, 'catch card');
      await t.shot('38-keyboard');
      await t.page.keyboard.press('Enter'); // Keep has focus
      s = await t.state();
      t.equal(s.day.livewell.length, 1, 'kept by keyboard');
      await t.page.keyboard.press('Escape'); // leave spot
      t.equal((await t.state()).scene, 'map', 'Esc returns to the map');
      await t.page.keyboard.press('Escape'); // pause menu
      t.equal((await t.state()).ui.modal, 'pause', 'Esc opens the pause menu');
      await tabTo(() => document.activeElement && document.activeElement.dataset.act === 'endDay', 'Head in');
      await t.page.keyboard.press('Enter');
      await t.game('act', 'finishAnim');
      t.equal((await t.state()).scene, 'weighin', 'weigh-in by keyboard');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).scene, 'results', 'results by keyboard');
    },
  },
  {
    name: 'contrast light and dark',
    async run(t) {
      for (const scheme of ['light', 'dark']) {
        await t.game('setState', { settings: { theme: scheme } });
        const check = async (label) => { const bad = (await contrastReport(t, TEXT)).filter((r) => r.ratio < 4.5); t.equal(bad, [], `${scheme} ${label}: text contrast ≥ 4.5`); };
        await t.game('scene', 'title'); await check('title');
        await t.game('scene', 'campaign'); await check('campaign');
        await quick(t, { lake: 'hamilton', month: 5, start: false, settings: { theme: scheme } }); await check('briefing');
        await t.game('act', 'start'); await t.game('act', 'select', 'h-garvan'); await check('map card');
        if (scheme === 'dark') await t.shot('39-dark-map');
        await fishAt(t, 'h-garvan'); await check('fishing');
        await castTo(t, 0.5, 0.4);
        if (scheme === 'dark') await t.shot('39b-dark-fish');
        await t.game('act', 'endDay'); await t.game('act', 'finishAnim'); await check('weigh-in');
        await t.page.locator('[data-act="finish"]').click(); await check('results');
        for (const sc of ['journal', 'help', 'settings', 'shop']) { await t.game('scene', sc); await check(sc); }
      }
    },
  },
  {
    name: 'reduced motion',
    reducedMotion: true,
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      let s = await t.state();
      t.equal(s.ui.reduced, true, 'reduced motion from the system');
      await t.game('act', 'runTo', 'h-channel');
      await waitFor(t, (q) => !q.day.run, 1500, 'reduced-motion run finishes fast');
      await fishAt(t, 'h-channel');
      await catchFish(t, 'largemouth', 2);
      await t.game('act', 'endDay');
      s = await t.state();
      t.equal(s.ui.wi.done, true, 'weigh-in reveal is instant');
      await t.game('act', 'runTo', 'x').catch(() => {});
      await t.shot('40-reduced');
    },
  },
  {
    name: 'large text',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5, start: false, settings: { textScale: 1.3 } });
      await t.shot('41-text-large');
      await t.checkLayout({ allowScrollY: true });
      await t.game('act', 'start');
      await fishAt(t, 'h-hump');
      await t.shot('41b-text-large-fish');
      await t.checkLayout();
      const bar = await t.page.evaluate(() => { const b = document.getElementById('fishbar').getBoundingClientRect(); return { r: b.right, w: innerWidth }; });
      t.expect(bar.r <= bar.w + 1, 'fishing bar fits at 130%');
    },
  },
  {
    name: 'touch targets',
    viewports: ['mobile'],
    async run(t) {
      const check = async (label) => t.equal(await touchTargets(t), [], `${label}: controls ≥ 44 px`);
      await check('title');
      await t.game('scene', 'campaign'); await check('campaign');
      await quick(t, { lake: 'hamilton', month: 5 }); await check('map');
      await t.game('act', 'select', 'h-garvan'); await check('spot card');
      await fishAt(t, 'h-garvan'); await check('fishing');
      await t.shot('42-touch');
      await t.game('scene', 'settings'); await check('settings');
      await t.game('scene', 'journal'); await check('journal');
    },
  },
  {
    name: 'no storage',
    initScript: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); },
    async run(t) {
      let s = await t.state();
      t.equal(s.storage, false, 'storage reported unavailable');
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      await catchFish(t, 'largemouth', 3);
      s = await t.state();
      t.equal(s.day.livewell.length, 1, 'game plays without storage');
      await t.game('scene', 'settings');
      t.expect(/Storage is unavailable/.test(await t.page.locator('#scene-settings').innerText()), 'settings explain storage is off');
      await t.shot('43-no-storage');
    },
  },
  {
    name: 'save and resume',
    async run(t) {
      await quick(t, { lake: 'ouachita', month: 10, tier: 'championship' });
      await t.game('act', 'runTo', 'o-long'); await t.game('act', 'finishAnim');
      await t.game('act', 'keepFish', { sp: 'smallmouth', w: 2.5 });
      await t.game('act', 'runTo', 'o-geo'); await t.game('act', 'finishAnim');
      let s = await t.state();
      const clock = s.day.clock;
      await t.reload();
      s = await t.state();
      t.equal(s.resume, true, 'title offers to resume');
      await t.page.locator('[data-act="resume"]').click();
      s = await t.state();
      t.equal([s.scene, s.day.clock, s.day.boat.at, s.day.livewell.length], ['map', clock, 'o-geo', 1], 'event resumes where it left off');
    },
  },
];
