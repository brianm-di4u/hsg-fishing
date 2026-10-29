// The real lakes: USGS shorelines and terrain, spots on real water, routes, landmarks at their real coordinates.
const near = (a, b) => Math.hypot((a[0] - b[0]) * 91800, (a[1] - b[1]) * 110950); // metres between [lon, lat] pairs

export const tests = [
  {
    name: 'real lake geometry',
    viewports: ['desktop'],
    async run(t) {
      // NHD areas inside each frame vs. the sourced acreage (frames crop river ends, so allow a range)
      const want = { catherine: [1300, 2100], hamilton: [5800, 7600], ouachita: [34000, 42000], degray: [10500, 14200] };
      for (const lake of Object.keys(want)) {
        const g = await t.game('act', 'geo', lake);
        t.expect(!!g, `${lake}: real geometry is inlined`); if (!g) continue;
        t.expect(g.acres >= want[lake][0] && g.acres <= want[lake][1], `${lake}: ${g.acres} acres of water in the frame`);
        for (const s of g.spots) {
          t.expect(s.water, `${lake} ${s.id} is on navigable water`);
          if (s.id !== 'ramp') t.expect(s.routed, `${lake} ${s.id} is reachable from the ramp (${s.miles} mi)`);
          if (['brush', 'channel', 'open'].includes(s.type)) t.expect(s.shoreM >= 100, `${lake} ${s.id} open-water spot is ${s.shoreM} m from shore`);
        }
        t.log(`${lake}: ${g.acres} acres, ${g.miles} mi wide, ${g.islands} islands, ${g.bridges} bridges, ${g.dams} dam lines, creeks: ${g.creeks.join(', ')}`);
      }
      // landmarks at their real coordinates (Wikipedia / NHD), within 500 m
      const real = { hamilton: { carpenter: [-93.0258, 34.4422], garvan: [-93.0456, 34.4347] }, catherine: { remmel: [-92.8939, 34.4269], lcsp: [-92.9180, 34.4379], couchwood: [-92.9147, 34.4483] },
        ouachita: { blakely: [-93.1942, 34.5725], losp: [-93.1773, 34.6186], pine: [-93.1725, 34.5694] }, degray: { lodge: [-93.1479, 34.2457] } };
      for (const [lake, lm] of Object.entries(real)) {
        const g = await t.game('act', 'geo', lake);
        for (const [id, ll] of Object.entries(lm)) { const d = near(g.landmarks[id], ll); t.expect(d < 600, `${lake} ${id} is ${Math.round(d)} m from its real position`); }
      }
      const h = await t.game('act', 'geo', 'hamilton');
      t.expect(h.creeks.includes('Hot Springs Creek'), 'Hot Springs Creek enters Lake Hamilton');
      t.expect(h.bridges >= 2, 'Lake Hamilton bridges from road data');
      const o = await t.game('act', 'geo', 'ouachita');
      t.expect(o.islands > 100, `Lake Ouachita has its many islands (${o.islands})`);
      t.expect(o.markers >= 15, `island markers placed (${o.markers})`);
    },
  },
];
