// The fishing loop: cast (mouse, touch, keys), retrieve and depth, bite and hook-set, fight, snags, catch card (AC9–AC14).
import { quick, fishAt, castTo, hookFish, waitFor } from './helpers.mjs';

// spot space → screen through the game (a 3D projection when WebGL is up, the flat water rect in 2D)
const toScreen = (t, x, y) => t.game('act', 'toScreen', x, y);

// The cast scatters by (1 − accuracy) (fishing.js: σ = (1 − acc)·0.18·distance·0.7 per axis), so the tolerance is
// 3σ plus a margin: an input test checks that the lure goes where it was aimed, not how well the ring was timed.
async function landedNear(t, x, y) {
  const s = await waitFor(t, (q) => q.fish && q.fish.phase === 'retrieve', 4000, 'lure in the water');
  const d = Math.hypot(s.fish.lureP.x - x, s.fish.lureP.y - y);
  const reach = Math.min(0.95, Math.hypot(x - 0.5, y - 0.94)), acc = s.fish.lastAcc ?? 1;
  const tol = 0.04 + (1 - acc) * 0.18 * reach * 0.7 * 3 * Math.SQRT2;
  t.expect(d < tol, `lure landed near the aim (off by ${d.toFixed(3)}, allowed ${tol.toFixed(3)} at accuracy ${acc})`);
  return s;
}
// Bring the hold to just before the ring's tightest point (0.55 s), so the real release lands near it even with the
// input latency of a software-rendered headless run (the harness drives SwiftShader at a few frames a second).
async function holdToTight(t) {
  await t.game('act', 'chargeAt', 0.44);
}

export const tests = [
  {
    name: 'cast with the mouse',
    viewports: ['desktop'],
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-garvan');
      const lay = await t.game('act', 'layout');
      const [x, y] = await toScreen(t, 0.4, 0.4);
      await t.page.mouse.move(x - 60, y + 40);
      await t.page.mouse.down();
      await t.page.mouse.move(x, y, { steps: 6 });
      await t.page.waitForTimeout(200);
      await t.game('pause'); await t.shot('09-aim', { wait: false }); await t.game('resume'); // the shot's own time doesn't count
      await holdToTight(t);
      await t.page.mouse.up();
      let s = await t.state();
      t.equal(s.fish.phase, 'flight', 'releasing casts');
      t.expect(s.fish.lastAcc > 0.7, `release near the tight ring is accurate (${s.fish.lastAcc})`);
      await t.page.waitForTimeout(150);
      await t.shot('09b-flight', { wait: false });
      await landedNear(t, 0.4, 0.4);
    },
  },
  {
    name: 'cast with touch',
    viewports: ['mobile'],
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-garvan');
      const lay = await t.game('act', 'layout');
      const [x, y] = await toScreen(t, 0.6, 0.4);
      await t.touchDrag([x - 30, y + 30], [x, y], { steps: 5, holdMs: 520 });
      let s = await waitFor(t, (q) => q.fish.phase !== 'aim', 2000, 'cast started');
      t.expect(['flight', 'retrieve'].includes(s.fish.phase), 'touch press-drag-release casts');
      await t.shot('09-aim');
      await landedNear(t, 0.6, 0.4);
      // the big action button reels on touch
      const b = lay.action;
      t.expect(b && b.w >= 64 && b.h >= 64, `action button is large (${b && b.w}×${b && b.h})`);
    },
  },
  {
    name: 'cast with the keyboard',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-garvan');
      await t.page.focus('#cv');
      for (let i = 0; i < 3; i++) await t.page.keyboard.press('ArrowLeft');
      for (let i = 0; i < 2; i++) await t.page.keyboard.press('ArrowUp');
      let s = await t.state();
      t.expect(Math.abs(s.fish.aim.x - 0.41) < 0.005 && Math.abs(s.fish.aim.y - 0.39) < 0.005, 'arrows move the aim');
      await t.page.keyboard.down(' ');
      await holdToTight(t);
      await t.page.keyboard.up(' ');
      s = await t.state();
      t.expect(['flight', 'retrieve'].includes(s.fish.phase), 'Space hold/release casts');
      await landedNear(t, 0.41, 0.39);
      await t.page.keyboard.down(' ');
      await t.page.waitForTimeout(300);
      s = await t.state();
      t.equal(s.fish.reel, true, 'holding Space reels');
      await t.page.keyboard.up(' ');
      s = await t.state();
      t.equal(s.fish.reel, false, 'releasing Space pauses the retrieve');
    },
  },
  {
    name: 'retrieve and lure depth',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-channel');
      await t.game('act', 'lure', 'crankD', 'shad');
      await t.game('pause');
      await castTo(t, 0.5, 0.15);
      await t.game('act', 'reel', true);
      await t.game('step', 150);
      let s = await t.state();
      t.expect(s.fish.lureP.depth > 9, `deep crank dives on a steady retrieve (${s.fish.lureP.depth.toFixed(1)} ft)`);
      t.expect(s.fish.lureP.y > 0.2, 'lure moves toward the boat');
      await t.game('act', 'reel', false);
      const d0 = s.fish.lureP.depth;
      await t.game('step', 60);
      s = await t.state();
      t.expect(s.fish.lureP.depth < d0, 'crankbait floats up when paused');
      await t.shot('10-retrieve-sonar');
      // topwater stays on the surface, bottom baits sink to the bottom
      await t.game('setState', { fish: { phase: 'aim', lureP: null } });
      await t.game('act', 'lure', 'popper', 'shad');
      await castTo(t, 0.5, 0.3);
      await t.game('act', 'reel', true); await t.game('step', 60);
      s = await t.state(); t.equal(s.fish.lureP.depth, 0, 'popper stays on top');
      await t.game('setState', { fish: { phase: 'aim', lureP: null } });
      await t.game('act', 'lure', 'craw', 'green pumpkin');
      await castTo(t, 0.5, 0.3);
      await t.game('act', 'reel', false); await t.game('step', 900);
      s = await t.state();
      const sc = await t.game('act', 'spotScene');
      t.expect(s.fish.lureP.depth > 15, `craw worm sinks to the bottom (${s.fish.lureP.depth.toFixed(1)} ft; scene ${JSON.stringify(sc.bottom)})`);
      await t.game('resume');
    },
  },
  {
    name: 'bite and hook-set',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      await t.game('pause');
      await castTo(t, 0.5, 0.3);
      await t.game('act', 'forceBite', 'largemouth', 3.25);
      let s = await t.state();
      t.equal(s.fish.phase, 'bite', 'bite phase');
      t.expect(/BITE/.test(s.derived.status), 'status says bite');
      const live = await t.page.locator('#live').textContent();
      await t.page.waitForTimeout(60);
      t.expect(/Bite!/.test(await t.page.locator('#live').textContent()) || /Bite/.test(live), 'live region announces the bite');
      await t.shot('11-bite');
      // missed: let the window pass
      await t.game('step', 40);
      s = await t.state();
      t.equal(s.fish.phase, 'retrieve', 'missed bite returns to the retrieve');
      t.expect(/Missed/.test(s.derived.status), 'missed message');
      // hooked by a real click on the water
      await t.game('act', 'forceBite', 'largemouth', 3.25);
      const lay = await t.game('act', 'layout');
      const p = await toScreen(t, 0.5, 0.5); if (t.viewport === 'mobile') await t.tap(p); else await t.page.mouse.click(...p);
      s = await t.state();
      t.equal(s.fish.phase, 'fight', 'tap/click during the bite sets the hook');
      await t.game('resume');
    },
  },
  {
    name: 'fight: snap, slack, jump, land',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      await t.game('pause');
      await hookFish(t, 'largemouth', 6);
      await t.game('act', 'reel', true);
      await t.game('step', 20);
      await t.shot('12-fight');
      // a surge while reeling hard snaps the line
      await t.game('setState', { fish: { fight: { surge: 0.8, surgeMul: 1.8, surgeT: 5, jumpT: 99 } } });
      await t.game('step', 45);
      let s = await t.state();
      t.equal(s.fish.phase, 'lost', 'reeling through a surge snaps the line');
      t.equal(s.fish.lost.why, 'snap', 'snap reason');
      await t.shot('12b-snap');
      await t.game('step', 100);
      // slack: a tired fish with no reeling throws the hook
      await hookFish(t, 'largemouth', 2);
      await t.game('setState', { fish: { fight: { stamina: 0.02, surgeT: 99, jumpT: 99 } } });
      await t.game('act', 'reel', false);
      await t.game('step', 140);
      s = await t.state();
      t.equal(s.fish.phase, 'lost', 'slack throws the hook');
      t.equal(s.fish.lost && s.fish.lost.why, 'thrown', 'thrown reason');
      await t.game('step', 100);
      // jump with heavy tension pulls the hook (seeded chance) or tension holds; jump with slack throws it
      await hookFish(t, 'largemouth', 2);
      await t.game('setState', { fish: { fight: { jump: 0.7, jumpFrom: 0.05, jumpT: 99, surgeT: 99, stamina: 0.03, tension: 0.05 } } });
      await t.game('act', 'reel', false);
      await t.game('step', 24);
      s = await t.state();
      t.equal(s.fish.phase, 'lost', 'a slack jump throws the hook');
      await t.game('step', 100);
      // side pressure: rod against the fish's heading tires it faster than rod with it
      const tire = async (rod) => {
        await hookFish(t, 'largemouth', 3);
        await t.game('setState', { fish: { fight: { heading: 1, surgeT: 99, jumpT: 99, dist: 80 } } });
        await t.game('act', 'reel', false); await t.game('act', 'rod', rod);
        await t.game('step', 90);
        const q = await t.state(); const st = q.fish.fight.stamina;
        await t.game('setState', { fish: { phase: 'aim', fight: null, lureP: null } });
        return st;
      };
      const against = await tire(-1), along = await tire(1);
      t.expect(against < along, `pulling against the fish tires it faster (${against.toFixed(3)} vs ${along.toFixed(3)})`);
      // a controlled fight lands the fish: ease off on surges and jumps, pull against the fish
      await hookFish(t, 'largemouth', 3);
      let landed = false;
      for (let i = 0; i < 400 && !landed; i++) {
        s = await t.state(); const f = s.fish.fight;
        if (s.fish.phase !== 'fight') { landed = s.fish.phase === 'landed'; break; }
        await t.game('act', 'reel', f.tension < 0.62 && f.surge <= 0 && f.jump <= 0);
        await t.game('act', 'rod', f.heading >= 0 ? -1 : 1);
        await t.game('step', 6);
      }
      s = await t.state();
      t.equal(s.fish.phase, 'landed', `careful play lands the fish${s.fish.lost ? ' (lost: ' + s.fish.lost.why + ')' : ''}`);
      await t.game('resume');
      await t.shot('12c-landed');
    },
  },
  {
    name: 'snag and foul',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hatch');
      await t.game('pause');
      const sc = await t.game('act', 'spotScene');
      const b = sc.cover.find((c) => c.k === 'brush');
      await t.game('act', 'lure', 'crankD', 'shad');
      let snagged = false;
      for (let k = 0; k < 6 && !snagged; k++) {
        await castTo(t, b.x, b.y - b.r * 0.6);
        await t.game('act', 'reel', true);
        for (let i = 0; i < 30 && !snagged; i++) { await t.game('step', 10); const s = await t.state(); if (s.fish.phase === 'snag') snagged = true; if (['bite'].includes(s.fish.phase)) await t.game('step', 60); if (s.fish.phase === 'aim' || s.fish.phase === 'back') break; }
        if (!snagged) { await t.game('setState', { fish: { phase: 'aim', lureP: null, bite: null } }); }
      }
      t.expect(snagged, 'deep crankbait snags in brush');
      const s = await t.state();
      t.expect(/Snagged/.test(s.derived.status), 'snag message');
      await t.shot('13-snag');
      await t.game('step', 80);
      // weedless craw comes through the same brush without snagging (no snag phase over 3 passes)
      await t.game('setState', { fish: { phase: 'aim', lureP: null } });
      await t.game('act', 'lure', 'craw', 'green pumpkin');
      let craw = false;
      for (let k = 0; k < 3; k++) { await castTo(t, b.x, b.y - b.r * 0.6); await t.game('act', 'reel', true); for (let i = 0; i < 25; i++) { await t.game('step', 10); const q = await t.state(); if (q.fish.phase === 'snag') craw = true; if (q.fish.phase !== 'retrieve') break; } await t.game('setState', { fish: { phase: 'aim', lureP: null, bite: null, fight: null } }); }
      t.expect(!craw, 'weedless craw does not snag');
      await t.game('resume');
    },
  },
  {
    name: 'grass fouls treble hooks',
    async run(t) {
      await quick(t, { lake: 'ouachita', month: 10, tier: 'championship' });
      await fishAt(t, 'o-milfoil');
      await t.game('pause');
      const sc = await t.game('act', 'spotScene');
      const g = sc.cover.filter((c) => c.k === 'grass').sort((a, b) => b.r - a.r)[0];
      await t.game('act', 'lure', 'crankS', 'shad');
      await castTo(t, g.x, g.y - g.r * 0.5);
      await t.game('act', 'reel', true);
      let fouled = false;
      for (let i = 0; i < 40 && !fouled; i++) { await t.game('step', 6); const s = await t.state(); if (s.fish.fouled) fouled = true; if (s.fish.phase === 'bite') await t.game('step', 60); }
      t.expect(fouled, 'shallow crank fouls in grass');
      await t.game('resume');
    },
  },
  {
    name: 'catch card',
    async run(t) {
      await quick(t, { lake: 'hamilton', month: 5 });
      await fishAt(t, 'h-hump');
      await hookFish(t, 'largemouth', 4.5);
      await t.game('act', 'land');
      await waitFor(t, (s) => s.ui.modal === 'catch', 3000, 'catch card');
      const txt = await t.page.locator('#modal').innerText();
      t.expect(/Largemouth bass/.test(txt), 'species name');
      t.expect(/4 lb 8 oz/.test(txt), 'weight in lb-oz');
      t.expect(/Keep/.test(txt) && /Release/.test(txt), 'keep and release');
      await t.shot('14-catch-card');
      await t.page.locator('#modal [data-act="keep"]').click();
      const s = await t.state();
      t.equal(s.day.livewell.length, 1, 'kept fish in the livewell');
      t.equal(s.ui.modal, null, 'card closed');
    },
  },
];
