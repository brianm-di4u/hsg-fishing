# Ouachita Bass Classic: development plan

Sources in `games/fishing/src/`, built with `node shared/tools/inline.mjs games/fishing` into `index.html`.
Data in `games/fishing/data/` (`dock-notes.json` built by `tools/make-notes.mjs` from the audited trivia bank).
Calibration: `node games/fishing/tools/calibrate.mjs` evaluates the shared `sim.js` sampler in Node and prints
tier winner means (AC28). Tests in `tests/`, run with
`node shared/test-harness/run.mjs games/fishing --milestone <m>`.

## 1. Milestones and tasks

### M1 Foundation
- `src/index.html`, `styles/main.css` (tokens light/dark, layout landscape/portrait), `util.js` (rng, math),
  `data.js` (lakes, species, lures, climate, names), `lakes.js` (mask, chamfer depth, spots, map cache),
  `state.js` (state, save), `main.js` (loop, hooks), title scene, lake map render for all 4 lakes.
- Tests: `boot` (AC1, AC5, AC44).

### M2 Core loop
- Spot view (`fishview.js`): local scene, aim/cast/flight, retrieve, lure depth, sonar strip, Verlet line
  (`line.js`), bite/hook-set, fight with tension band and rod, snag/foul, catch card.
- `sim.js`: water temp, weather, phases, bite odds, weight sampler, AI field. Map running and clock costs, HUD.
- Tests: `fishing` (AC9–AC14), `map` (AC6, AC8).

### M3 Full rules and content
- Livewell, culling, pairs partner, Free Fish limits + warden, check-in penalty, weigh-in scoreboard,
  leaderboard, payouts, two-day events, campaign River Chain, gates, shop and upgrades, stocking choice, DeGray
  derby, end screen, journal, Dock Notes, events (generation, eagles, snow, mud, jellyfish, lights).
- Tests: `model` (AC15–AC23, AC30), `rules` (AC24–AC27, AC29), `campaign` (AC2–AC4, AC7, AC31–AC35), calibration (AC28).

### M4 Polish, audio, accessibility
- Juice (ripples, splash, jump, confetti, scoreboard count-up), WebAudio (`audio.js`), settings screen, help,
  reduced motion, text scale, assist, theme override, aria-live, keyboard focus order, touch audit.
- Tests: `screens` (AC1, AC36, AC37, AC46), `a11y` (AC38–AC43).

### M5 Optimization and release
- Render on demand (loop stops on menus), map cache, fish sprite cache, size check, fps/memory.
- Tests: `perf` (AC45); full matrix with `--milestone final`; REPORT.md.

## 2. Task notes
- Lake shapes are spines + islands, never traced outlines. Spots snap to water at load.
- Portrait rotation of the map is a view transform; hit-testing uses the same transform.
- Everything a test needs is reachable through `act`, but tests also drive real input (mouse, touch, keys).

## 3. `window.__game` hook spec

| Method | Behavior |
|---|---|
| `seed(n)` | set RNG state; returns n |
| `getState()` | JSON snapshot (MECHANICS §2) + `derived: {bag, bagOz, big, limits, runHome, biteTable?}` |
| `setState(p)` | deep-merge into state (settings/profile/day/fish/event), re-derive, redraw |
| `isIdle()` | false while a transition, boat run, cast flight, weigh-in reveal or modal fade runs; ignores ambient |
| `step(n)` / `pause()` / `resume()` | fixed-tick control |
| `scene(name)` | `title, campaign, setup, briefing, map, fish, weighin, results, shop, journal, help, settings` |
| `newGame(o)` | `{mode:'campaign'|'quick'|'free', lake, month, tier, chapter, seed, hour}` → starts at briefing (or `start:true` → map) |

`act(name, ...args)`:

| Name | Args | Effect / return |
|---|---|---|
| `start` | — | leave the briefing, launch at the ramp |
| `select` | spotId | open the spot card |
| `runTo` | spotId | run the boat there (animated; `finishAnim` completes) |
| `fishHere` | — | enter spot view |
| `leave` | — | back to map |
| `scan` | — | sonar scan (+10 min) |
| `lure` | id, color | change lure |
| `speed` | 'slow'|'med'|'fast' | retrieve speed |
| `aim` | x, y | set reticle (spot coords 0–1) |
| `cast` | x, y, acc=1 | cast immediately with accuracy 0–1 |
| `reel` | bool | hold/release reel |
| `forceBite` | species, weight | next tick produces that bite |
| `setHook` | — | hook-set press |
| `rod` | −1..1 | rod side |
| `land` | — | finish the current fight as landed |
| `keep` / `release` | — | catch-card choice (keep culls the smallest when full) |
| `endDay` | — | head in now (runs home, then weigh-in) |
| `finishAnim` | — | complete any running transition |
| `continue` | — | advance results / next day / next chapter |
| `buy` | upgradeId | shop purchase |
| `stock` | bool | striper stocking choice |
| `odds` | {lake, month, hour, spot, lure, color, speed, depth?} | bite odds table by species (model tests) |
| `phase` | species, lake, month | season phase and depth band |
| `simField` | {tier, lake, month, seeds} | AI winner statistics (AC28) |
| `layout` | — | viewport rects of markers, buttons and the water area for real-input tests |
| `animAt` | ms | freeze effect clock for deterministic mid-effect shots |
| `names` | — | the fictional angler list (AC29) |

## 4. Test matrix

Screenshots are written at both viewports unless marked (D) desktop-only.

| AC | Test (file › name) | Screenshot(s) |
|---|---|---|
| AC1 | screens › title | `01-title`, `01b-title-dark` |
| AC2 | campaign › river chain | `02-river-chain`, `02b-river-chain-unlocked` |
| AC3 | screens › setup | `03-setup` |
| AC4 | campaign › briefing | `04-briefing` |
| AC5 | boot › four lakes | `05-map-catherine`, `05-map-hamilton`, `05-map-ouachita`, `05-map-degray` |
| AC6 | map › select and run (real click/tap) | `06-spot-card`, `06b-boat-running` |
| AC7 | campaign › hidden brush piles | `07-ouachita-hidden`, `07b-ouachita-revealed` |
| AC8 | map › hud | `08-hud` |
| AC9 | fishing › cast mouse (D), cast touch (mobile), cast keyboard | `09-aim`, `09b-flight` |
| AC10 | fishing › retrieve and depth | `10-retrieve-sonar` |
| AC11 | fishing › bite and hook-set, missed set | `11-bite` |
| AC12 | fishing › fight snap, slack, jump, land | `12-fight`, `12b-snap`, `12c-landed` |
| AC13 | fishing › snag and foul | `13-snag` |
| AC14 | fishing › catch card | `14-catch-card` |
| AC15 | model › species by lake | — |
| AC16 | model › spawn ladder | — |
| AC17 | model › summer heat and low light | — |
| AC18 | model › Hamilton May kicker | — |
| AC19 | model › clarity colors | — |
| AC20 | model › pressure | — |
| AC21 | model › trout and generation | `21-generation-board` |
| AC22 | model › eagles | `22-eagle` |
| AC23 | model › grass and brush | — |
| AC24 | rules › livewell, cull, partner | `24-cull` |
| AC25 | rules › free fish limits and warden | `25-warden` |
| AC26 | rules › late check-in | `26-late` |
| AC27 | rules › weigh-in, tie, two-day | `27-weighin-reveal`, `27b-leaderboard`, `27c-tie` |
| AC28 | rules › calibration (D) | — |
| AC29 | rules › names (D) | — |
| AC30 | model › weather normals and snow | `30-snow-day` |
| AC31 | campaign › gate opens / retry | `31-results-advance`, `31b-results-retry` |
| AC32 | campaign › shop | `32-shop` |
| AC33 | campaign › stocking choice | `33-stocking` |
| AC34 | campaign › championship end, derby | `34-champion`, `34b-derby` |
| AC35 | screens › journal | `35-journal` |
| AC36 | screens › help | `36-help` |
| AC37 | screens › settings persist | `37-settings` |
| AC38 | a11y › keyboard day (D) | `38-keyboard` |
| AC39 | a11y › contrast light/dark | `39-dark-map`, `39b-dark-fish` |
| AC40 | a11y › reduced motion | `40-reduced` |
| AC41 | a11y › large text | `41-text-large`, `41b-text-large-fish` |
| AC42 | a11y › touch targets (mobile) | `42-touch` |
| AC43 | a11y › no storage, save/resume | `43-no-storage` |
| AC44 | boot (every test fails on errors/requests) | — |
| AC45 | perf › fps, memory, size (D) | — |
| AC46 | screens › juice frames | `46-splash`, `46b-jump`, `46c-confetti` |

## 5. Defect log

| # | Milestone | Found by | Defect | Fix | Status |
|---|---|---|---|---|---|
| 1 | M1 | boot test | `mq` (reduced-motion media query) used before it was declared: hooks never appeared | declare media queries before `applySettings()` | fixed |
| 2 | M1 | screenshot 05-map-ouachita | generated Ouachita islands (and their marker numbers) landed on the shore | carve islands after the base water field, only where water is ≥ r + 12 from shore | fixed |
| 3 | M1 | screenshot 01-title (mobile) | ghost buttons (Journal, How to Play, Settings) unreadable over the lake art | translucent dark backing with light text on the title | fixed |
| 4 | M1 | screenshots 05-* (mobile) | HUD text truncated at 390 px | shorter labels ("8m run", "73° est."), help button hidden on phones (in the pause menu) | fixed |
| 5 | M1 | screenshot 05-map-ouachita | scale bar label overlapped the lake name | scale bar moved above the map bar | fixed |
| 6 | M2 | fishing test | bite status hint missing when a bite began outside a tick | status refresh on bus events | fixed |
| 7 | M2 | screenshot 10-retrieve-sonar | disabled "Map" ghost button invisible on the dark fishing bar | panel background | fixed |
| 8 | M2 | screenshot 12-fight | sonar "ft" label overlapped the title; during a fight the sonar showed the stale lure depth | label moved; sonar tracks the hooked fish ("fish on · 32 ft out") | fixed |
| 9 | M2 | screenshot 10-retrieve-sonar | muddy-water tint made the spot view grey | lighter tint, richer depth gradient | fixed |
| 10 | M3 | names test | the banned-name list itself was inlined in the page | list lives only in the test | fixed |
| 11 | M3 | balance bot | first club event too hard (bot 8th–11th, top 5 needed), Ouachita too easy, 30–40% of hooked fish lost | Catherine bass abundance up / rough fish down, Ouachita abundance down ("low productivity"), snap after 0.45 s (was 0.3), slack 1.8 s (was 1.5); field re-calibrated to targets | fixed |
| 12 | M4 | keyboard test | scenes focused the first button in the DOM (Quit) instead of the autofocus/primary button | `pickFocus` tries `[autofocus]`, then `.btn.primary`, then any button | fixed |
| 13 | M4 | touch-target test | retrieve-speed buttons 40 px wide on phones | 44 px | fixed |
| 14 | M4 | keyboard test | Esc on the map closed a stale spot card; no focus after the weigh-in reveal | clear the card when fishing; focus the scene's primary button after the reveal | fixed |
| 15 | M4 | sheet mobile-03 | phone fishing bar overflowed: "Fast" hidden behind the action button, lure name cut off | two-row grid (lure + speed / action + map) | fixed |
| 16 | M4 | screenshot 41b (mobile) | HUD items overlapped at 130% text | HUD text capped at 108% (it is a compact readout; every other screen scales fully) | fixed |
| 17 | M4 | screenshot 12-fight (mobile) | tension panel covered a third of the water on phones | narrower, shorter gauge under 600 px | fixed |
| 18 | M4 | sheet mobile-03 | sonar depth labels overlapped on the 62 px phone strip | 82 px strip, unit on the bottom label only, two labels when short | fixed |
| 19 | M4 | screenshot 07b (mobile) | toast covered the spot card's Run button | toasts sit under the HUD | fixed |
| 20 | M4 | screenshot 26-late | "check-in soon" warning fired during the automatic run home, over the weigh-in | no warning for the run home | fixed |
| 21 | M4 | screenshot 30-snow-day | a forced snow day showed a 57°F high | snow caps the day at 38°F / 27°F | fixed |
| 22 | M4 | HUD screenshots | emoji weather glyphs rendered inconsistently (☀ as a star) | inline SVG weather icons | fixed |
| 23 | M4 | fight test + debug trace | an exhausted fish still surged; easing off then made slack and it threw the hook at the boat | no surges under 20% stamina; slack not counted within 6 ft; easing off during a jump keeps a 0.25 floor; slack jumps judged at the jump's start | fixed |
| 24 | M4 | screenshot 46-splash | splash frame showed no ripple (finishAnim clears effects) | test waits for the real splashdown | fixed |
| 25 | M5 | code review of the status hints | the "twitch" the status line promised had no mouse/touch/keyboard path | quick tap (< 170 ms) while reeling, or Enter, twitches the lure; help table row added | fixed |
| 26 | M5 | balance bot | after fix 23 the bot never lost a fish and won 6 of 8 days by a wide margin | player bites now follow the same month activity as the field, base bite rate −22%, trophy kickers rarer (Hamilton 1.2%, elsewhere 0.4%), field re-calibrated, bot given a 0.25 s reaction time | fixed |
| 27 | M5 | sheet final mobile-07 | win confetti hidden behind the opaque phone results page | results page is 88% opaque | fixed |
| 28 | M5 | sheet final mobile-03 | lure name and color sat on different baselines in the phone lure button | baseline alignment | fixed |
