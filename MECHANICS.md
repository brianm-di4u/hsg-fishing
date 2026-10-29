# Ouachita Bass Classic: core mechanics

The technical foundation, synthesized from `SAMPLES.md` and the wave-1 lessons. Every number here is
**game logic** unless `research/town-content.md` gives it a source.

## 1. Game loop and timing

- One `requestAnimationFrame` loop with a fixed-step accumulator (sample #6): `TICK = 1/60 s`, at most 5 ticks
  per frame, then one render. The loop **stops** when nothing is animating (render on demand, wave-1 lesson) and
  restarts on input, scene change or a timer.
- Ambient animation (map water glints, eagle circling, spot-view ripples) runs at the same rAF but is **excluded
  from `isIdle()`**. Transitions (boat run, cast flight, weigh-in reveal, modal fades) are included.
- `pause()` stops ticking; `step(n)` runs `n` ticks synchronously while paused (tests). All simulation randomness
  is drawn inside ticks from the seeded RNG, so a run is reproducible given the same input ticks.
- Two clocks: **real time** (ticks) drives physics and the fight; **game time** (minutes since midnight) drives the
  tournament day. Game time advances by action costs (§6), never by wall time, so pausing or reading never costs
  fishing time.

## 2. State model (one serializable object)

```js
S = {
  v: 1, scene: 'title' | 'campaign' | 'setup' | 'briefing' | 'map' | 'fish' | 'weighin' | 'results'
             | 'shop' | 'journal' | 'help' | 'settings',
  rng: <uint32>,                      // mulberry32 state
  settings: { sound, volume, motion: 'auto'|'reduced'|'full', textScale, assist, units:'lb-oz'|'lb', theme },
  profile: { money, upgrades: {whetstone, reel, sonar, motor}, lures: [ids], stockingFund,
             campaign: { chapter, done: {...}, best: {...} }, journal: { species: {id: {n, best}}, events: [...], notes: [...] },
             history: [...] },
  event: null | { kind:'campaign'|'quick'|'free', id, lake, month, tier, days, day, format, field: [...anglers],
                  results: [...per-day bags], seed },
  day: null | { lake, month, date, clock, start, end, weather: {sky, hi, lo, wind, rainRecent},
                water: {temp, clarity}, boat: {x, y, at: spotId}, spots: {id: {pressure, revealed, piles}},
                livewell: [fish], partner, gen: [[startMin, endMin]...], eagle: {spot, until}, log: [...] },
  fish: null | { phase: 'aim'|'flight'|'retrieve'|'bite'|'fight'|'landed'|'lost'|'snag'|'foul',
                 lure: {id, color}, speed, aim: {x, y, charge}, lureP: {x, y, depth}, castT, reel, rod,
                 bite: {species, weight, t}, fight: {dist, stamina, tension, heading, surgeT, jumpT, slackT, overT},
                 spot: {...local scene}, ticks },
  ui: { modal, toast, focus, reduced, theme },
}
```

`getState()` returns a JSON clone plus derived fields tests need (`bag` weight, `limits`, `biteTable`). `setState(p)`
deep-merges and redraws. The save file is `S.settings` + `S.profile` + a resumable `S.event`/`S.day` snapshot.

## 3. Lakes (rendering and depth)

- Lake space is 1000 × 625 units. A lake is defined by **spines** (polylines with a half-width at each vertex:
  main river channel plus creek arms and coves), **islands** (circles), a dam, a ramp, landmarks and spots.
- Water mask on a 200 × 125 grid: a cell is water when `min over segments (dist − halfWidth(t)) + noise·amp < 0`
  and it is not inside an island (island radius also noised). Noise is 2-octave value noise seeded per lake.
- **Depth field:** a two-pass chamfer distance transform (3-4 mask) gives distance to shore; depth =
  `maxDepth · (1 − e^(−shoreDist/k)) · (0.45 + 0.55·along)` where `along` rises from the headwaters to the dam.
  Drawn as 6 contour bands from shallows `#4C8FA8` to deep `#1E4E79`, plus faint contour lines.
- The full map (land, forest stipple, rock edges, water bands, contour lines, labels' backing) is rendered once to
  an offscreen canvas per `(lake, css size, DPR, night)` and blitted; markers and the boat draw on top.
- **Portrait layout:** on a portrait viewport the lake is drawn rotated 90° (lake space x → screen y) so long
  river-lakes fill a phone screen; labels and markers are drawn unrotated at transformed positions.

## 4. Fish model (bite odds)

For each tick while the lure is in the water (not snagged or fouled):

```
p_tick = BASE · Σ_s  A_s · L(lure,s) · D(lureDepth, fishDepth_s) · V(speed,s,phase) · C(cover) · K(color, clarity)
                    · T(hour, weather, s) · E(events) · P(spot pressure)
BASE = 1/900
```

- **A_s (abundance × habitat):** lake abundance (0–1, from the species table; 0 where not sourced) × habitat fit of
  the spot type for the species' **phase** (table in `data.js`).
- **Phase** from the estimated water temperature `Tw` and whether the month is warming (Jan–Jul) or cooling
  (Aug–Dec), against each species' spawn window: crappie 56–68 (white 60–65, black 62–68, sourced), black bass
  62–70 and bream 68–80 ("a few degrees warmer", game logic), catfish 78–86 ("warmest"). Phases: winter, prespawn,
  spawn, postspawn, summer, fall. Each phase has a preferred depth band and structure weights. In-window fish are
  shallow (1–6 ft) on coves, flats and docks; otherwise deep or on brush.
- **D:** `exp(−((lureDepth − fishDepth)/σ)²)`, `σ = 3 + 0.15·fishDepth`. Fish depth is the phase band clamped to the
  bottom under the lure; a band deeper than the bottom also cuts A. Topwater draws fish up only when the band
  starts within 8 ft and light is low or the sky is overcast.
- **V:** phase speed preference (winter/spawn/trout/crappie like slow; summer/fall and stripers like fast).
  Pausing a bottom bait counts as slow. On Ouachita brush piles a slow retrieve gets ×1.4 ("really slow down").
- **C:** within a cover item's radius ×1.6 (brush, docks, laydowns, grass edges, rock); open-water species ignore it.
- **K:** clarity × color: clear water favors natural colors (green pumpkin, shad), muddy favors chartreuse and
  black/blue; spinnerbaits and crankbaits get ×1.2 in muddy water (vibration).
- **T:** low light (±75 min of sunrise/sunset) ×1.3, topwater ×1.8; summer midday heat (air > 88°F, 11:00–16:00)
  shallow ×0.5 and deep ×1.1; overcast/rain ×1.15.
- **E:** eagle-marked spot ×1.6 for bass, stripers, hybrids and white bass (Dec–Feb, Ouachita/DeGray);
  Hamilton May post-spawn largemouth on brush or docks ×1.25 bite; generation running at the tailrace: trout ×0.15
  and the spot is closed.
- **P:** `exp(−pressure)`; +0.18 per fish caught, +0.02 per cast, −0.1 per game hour away.
- The species that strikes is picked by its share of the sum. Weights: `median_s · e^(N(0, sd_s))`, clamped; lure
  size bias (jig/swimbait ×1.15, finesse ×0.9). **Trophy roll:** Hamilton largemouth 2% (Florida-strain) for a
  6.5–11.2 lb kicker; ×3 for the May post-spawn green-pumpkin Texas-rigged craw on brush or docks.
- **Snags and grass:** a non-weedless lure crossing brush, laydowns or rock snags at 0.3/s (deep crank in brush
  0.45/s); a treble lure in grass fouls after 0.8 s. Snag costs 4 min, foul 2 min.

## 5. Casting, retrieve and the fight

- **Aim:** press on the water (or move the reticle with the arrow keys). While held, an accuracy ring pulses
  (1.1 s period); releasing at the ring's smallest point lands within 1 ft, the worst release scatters up to 18% of
  cast distance. Wind adds drift. Max cast 95 ft (spot view is 100 ft across).
- **Flight:** the lure follows a parabola as a pure function of `castT` (0.45–0.9 s by distance): sample #3's idea.
- **Retrieve:** hold to reel (button, pointer anywhere on water, Space). Speed setting slow/med/fast = 3/5/8 ft/s.
  Lure depth per type: bottom baits sink 1.5 ft/s to the bottom and hop 0.5 ft when reeled; crankbaits approach their
  dive depth (4 or 14 ft) at a rate ∝ speed and float up when paused; spinnerbait runs 6/3.5/1.5 ft by speed;
  popper 0; jerkbait suspends at 5 ft; swimbait 8 ft; tube jig 1.2 ft/s sink.
- **Line:** a 14-point Verlet chain (sample #1) pinned at the rod tip and the lure; stiffness rises with tension.
- **Bite:** the line twitches, a "!" badge and a thump play; the hook-set window is 0.55 s (+0.2 s with the
  novaculite whetstone). Pressing set with no bite twitches the lure 3 ft forward; a twitch while a fish follows
  (jerkbait, popper) gives a reaction-strike chance. Assist mode sets the hook automatically.
- **Fight** (per tick): fish power `Pw = (0.4 + 0.2·ln(1+w)) · fight_s`; surges every 1.2–3 s change heading and
  multiply pull ×1.0–1.8 for 0.8 s; `pull = Pw · √stamina · (surge ? m : 0.6)`.
  - Tension approaches `pull·(reel ? 0.75 : 0.45) + (reel ? 0.3 : 0.05) ± side` with τ = 0.12 s.
  - **Side pressure:** the rod (pointer offset from center smoothed over 6 samples, sample #2; or Left/Right) held
    opposite the fish's heading drains stamina ×1.8 and lowers tension 0.1; with the heading, ×0.6 and +0.08.
  - Stamina drains `(0.05 + 0.14·inBand)/Pw` per second. Line: reeling gains `max(0.5, 6·(1 − 0.55·pull))` ft/s; not
    reeling, the drag gives `max(0, pull − 0.55)·4` ft/s.
  - **Band:** SLACK < 0.15, GOOD 0.15–0.85, DANGER 0.85–1.0. Above 1.0 for 0.45 s (or 1.15 instantly) the line
    snaps (reel upgrade +0.08). Below 0.15 for 1.8 s (not counted inside 6 ft) the fish throws the hook.
    **Surges** need at least 20% stamina, so a spent fish comes in quietly. **Jumps** (bass, smallmouth, trout,
    gar): while airborne, tension > 0.9 pulls the hook 50% of the time; a jump that starts on a slack line throws it.
    Easing off during a jump keeps a 0.25 floor (the leap bows the line), so "ease off but stay tight" works.
  - Landed at 4 ft. Assist mode: snap at 1.2, slack timer 3 s, jump pull-out 20%.

## 6. Tournament day and rules engine

- Costs in game minutes: cast `3 + 0.35·retrieveSeconds`, fight +2, land/handle +2, snag +4, foul +2, scan +10,
  run `4 + miles/mph·60` (50 mph; 60 with the motor upgrade). Map widths: Catherine 7 mi, Hamilton 12, Ouachita 22,
  DeGray 14.
- **Livewell:** tournament limit 5 black bass (largemouth, spotted, smallmouth). Full livewell → keep (culls the
  smallest) or release. Other species are logged and released. Pairs (club): the partner boats a bass by roll each
  45 minutes (40% chance) into the shared livewell.
- **Free Fish:** statewide limits enforce 10 black bass (≤ 4 smallmouth), 30 crappie; the warden NPC checks the
  livewell at the end of the day and explains possession (3× daily).
- **Check-in:** if the clock reaches check-in with the boat away, it runs back; late minutes cost 1 lb each, more than
  15 = disqualified (fictional rules, labeled). The HUD shows run time home and warns at 15 minutes of slack.
- **Weather:** daily from the month's normals: hi/lo ± up to 4°F, rain chance `precip_in · 0.07`, snow 1/60 on
  Dec–Feb days (ramps closed, event moves a day), wind 0–15 mph. Rain in Apr–May on Catherine/Hamilton → muddy;
  Ouachita and DeGray clear (stained after rain).
- **Water temperature (game estimate):** `Tw = 0.6·mean(m) + 0.4·mean(m−1) + 4`, mean = (hi+lo)/2, ±1.5 daily,
  +1 in shallow afternoons. Gives ≈ 48°F Jan, 56 Mar, 64 Apr, 72 May, 86 Aug.
- **Generation (Catherine tailrace):** 1–3 blocks per day from the seed (fictional times), shown on a board.
- **Sun:** sunrise/sunset from the standard declination formula at 34.5°N (computed).

## 7. AI field (weigh-in simulation)

- Fictional anglers (48 names) get a persistent skill `N(0,1)`. Per day each angler catches
  `Poisson(6.5·Q·(1+0.15·skill))` bass with weights from the lake's bass mix (same samplers as the player, including
  trophy rolls) × a per-tier scale, and keeps the best 5. `Q` = month bite quality; the tier scales are calibrated in `tools/calibrate.mjs` so
  that over 400 seeds the mean winner is: club ≈ 17 lb (24 teams), regional one-day ≈ 18 lb (40 boats),
  two-day finale ≈ 27 lb (40 boats), championship ≈ 26 lb (30 boats, game target). Ties break by big fish.

## 8. Input

- **Pointer Events** for mouse, touch and pen (one code path; `t.touchDrag` / `t.tap` in tests).
  `setPointerCapture` wrapped in try/catch (wave-1 lesson).
- Map: tap a marker → info card → "Run here". Keyboard: Tab/arrows cycle markers, Enter opens, Esc closes.
- Fishing: press-hold-release to cast; hold to reel; tap to set; hold + horizontal pointer for the rod.
  Keyboard: arrows move the reticle / rod, Space hold = charge or reel, Space/Enter tap = set, `L` lure,
  `1/2/3` speed, `Esc` leave spot / pause. A large on-screen action button mirrors Space for touch.

## 9. Rendering

- Layers: `#stage` canvas (title scene, map or spot view) → DOM HUD → DOM panels and modals.
- Spot view is top-down: shore band at the top for shore spots, depth shading toward the boat, cover items
  (docks with posts, cedar brush, grass stipple, laydowns, riprap, current lines), boat bow at the bottom.
  A **sonar strip** at the side draws the bottom profile from boat to lure, the lure depth and (with the sonar
  upgrade) fish marks for the top species.
- Fish art is parameterized: body length/height, mouth, tail shape, fins, base and belly colors, markings
  (lateral stripe, spots, bars, stripes, speckles, whiskers, snout).
- Sprites (fish per species, scoreboard digits, map) are cached per size and DPR.

## 10. RNG and save

- mulberry32 (sample #5). `seed(n)` sets the state; event seeds derive from it, so a seeded tournament gives the
  same lake weather, field and generation schedule.
- `localStorage['hsg.fishing.v1']` in try/catch; the game runs unchanged when storage throws. Saves on scene
  changes, after each landed fish and at weigh-in.

## 11. `window.__game` hooks

`seed, getState, setState, isIdle, step, pause, resume, scene, newGame, act` (spec and every `act` name in
`DEV-PLAN.md` §3).
