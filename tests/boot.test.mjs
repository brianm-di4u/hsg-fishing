// Boot, title, the four lake maps (AC1, AC5, AC44).
import { quick } from './helpers.mjs';

export const tests = [
  {
    name: 'boots to the title',
    async run(t) {
      t.log(`loadMs ${t.loadMs}`);
      const s = await t.state();
      t.equal(s.scene, 'title', 'title scene');
      t.expect(await t.page.locator('#scene-title h1').isVisible(), 'title heading visible');
      t.expect(await t.page.locator('#scene-title .note .src').count() === 1, 'a Dock Note with its source');
      for (const label of ['Follow the River', 'Quick Tournament', 'Free Fish', 'Journal', 'How to Play', 'Settings']) {
        t.expect(await t.page.locator('#scene-title button', { hasText: label }).count() >= 1, `title has ${label}`);
      }
      await t.shot('01-title');
      await t.checkLayout();
    },
  },
  {
    name: 'four lake maps',
    async run(t) {
      for (const lake of ['catherine', 'hamilton', 'ouachita', 'degray']) {
        await quick(t, { lake, month: lake === 'degray' ? 1 : 5, tier: 'regional', start: true });
        const s = await t.state();
        t.equal(s.scene, 'map', `${lake}: map scene`);
        const lay = await t.game('act', 'layout');
        t.expect(lay.points.some((p) => p.id === 'ramp'), `${lake}: ramp drawn`);
        t.expect(lay.points.filter((p) => !p.id.startsWith('lm:') && p.id !== 'ramp').length >= 6, `${lake}: named spots`);
        t.expect(lay.points.some((p) => p.id.startsWith('lm:')), `${lake}: landmarks`);
        for (const p of lay.points) t.expect(p.x >= 0 && p.x <= t.vp.width && p.y >= 0 && p.y <= t.vp.height, `${lake}: ${p.id} on screen`);
        await t.shot('05-map-' + lake);
        await t.checkLayout();
      }
    },
  },
];
