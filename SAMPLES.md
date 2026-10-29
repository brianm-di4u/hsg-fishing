# Code-sample survey: Ouachita Bass Classic

Downloaded code lives in `reference-samples/` (gitignored), was read as data only, and was never run, built
or opened in a browser. Commit hashes are from the GitHub API on 2026-10-28.

| # | Sample | URL | License | Version | Verdict |
|---|---|---|---|---|---|
| 1 | Verlet.js (Anurag Hazra) | https://github.com/anuraghazra/verlet.js | MIT | `5d1ce9c` (2018-12-11) | **Adapt** the point update + stick relaxation for the fishing line |
| 2 | FishingGame canvas port (Greg MacWilliam) | https://github.com/gmac/fishinggame | BSD-2-Clause code; art © Lassie Games (not used) | `6fbd6c2` (2014-07-05) | **Adapt the idea** of a short pointer history for smoothing the rod and a "keep pulling or lose it" rule |
| 3 | skyzh/fishing | https://github.com/skyzh/fishing | MIT | `8178023` (2021-04-28) | **Idea only** (drop, hold, return timeline) |
| 4 | Bass Löver (Wesley Werner) | https://codeberg.org/wesbot/basslover | GPL-3.0-or-later | `5d1b0a6` (2023-05-27) | **Reference only** (GPL): structure ideas, no code read for reuse |
| 5 | mulberry32 PRNG (bryc/code, PRNGs.md) | https://github.com/bryc/code/blob/master/jshash/PRNGs.md | Public domain | master | **Adapt** (same as the wave-1 games) |
| 6 | MDN "Anatomy of a video game" + G. Fiedler "Fix Your Timestep!" | https://developer.mozilla.org/en-US/docs/Games/Anatomy · https://gafferongames.com/post/fix_your_timestep/ | MDN code samples CC0; article (no code copied) | 2026 | **Adapt** the rAF + fixed-step accumulator pattern |
| — | Chamfer distance transform (Borgefors 1986, two-pass 3-4 mask) | textbook algorithm | n/a | — | Implemented from the description for the depth field |

## 1. Verlet.js

- **What it does well:** a tiny, readable Verlet core. `updatePoints` derives velocity from `x - oldx`, applies
  friction and gravity; `bakePhysics` relaxes each stick by moving both ends half the length error, scaled by a
  stiffness. Easy to run a few iterations per frame and stable at fixed steps.
- **What it does badly:** one 2,500-line file that mixes the engine with a DOM "studio" UI, globals via `self`,
  a page reload on NaN positions, and bounds tied to the canvas size. No fixed timestep.
- **Reuse:** we adapt only the two loops (about 20 lines) into `src/js/line.js`: a 14-point line from the rod tip
  to the lure, pinned at both ends, with gravity toward the water and a stiffness that rises with tension so a
  tight line straightens and a slack line sags. Attribution comment at the top of `line.js`.

## 2. gmac/FishingGame (canvas)

- **Does well:** the hook follows the pointer through a 5-sample history average, so input jitter disappears and
  the hook's rotation follows the trend. A hooked object stays on only while the player keeps pulling upward
  ("must move upward 5+ pixels per frame to retain the payload"), which turns pointer motion into skill.
- **Does badly:** jQuery 1.6 and Flash sound fallback, magic sprite-sheet rectangles, a fixed 60-fps assumption,
  closure-heavy objects that are hard to serialize.
- **Reuse:** idea-level. Our fight smooths the pointer's horizontal offset over the last 6 samples to get the rod
  angle, and the slack rule (tension below the band too long throws the hook) is our version of "keep pulling".
  No code copied (BSD-2 would allow it; the shape just doesn't fit our state model).

## 3. skyzh/fishing

- **Does well:** a 112-line d3/SVG toy with a clean three-phase hook timeline (drop at a constant speed, stay,
  rise) computed from a frame counter: no state machine needed.
- **Does badly:** frame-count timing, collision by bounding boxes, lodash/jQuery/d3 dependencies for a toy.
- **Reuse:** idea only. Our cast flight is likewise a pure function of elapsed ticks (`castT`), which makes
  mid-flight screenshots deterministic.

## 4. Bass Löver (reference only, GPL)

- **Does well (from its README and manual index):** a turn-based three-day tournament that starts at a dam,
  navigation between spots, a fish finder as an information tool, and tips as a manual section. Confirms that a
  tournament fishing game reads well as "choose where, choose what, then execute".
- **Does badly:** desktop LÖVE build first; the web build does not keep tournament stats.
- **Reuse:** none. GPL, so no code was read for reuse. We take only the genre-level lesson: the fish finder
  (our sonar strip) should be a primary readout, not a bonus.

## 5. mulberry32

- 32-bit state, fast, good enough for gameplay; the whole RNG state is one integer, so it serializes into the
  game state. Same adaptation as `games/trivia/src/js/util.js`.

## 6. Fixed timestep

- MDN's main-loop anatomy (rAF with a timestamp, stop the loop by cancelling the request) plus Fiedler's
  accumulator: simulate in fixed 1/60 s ticks, render once per frame. `step(n)` in the test hooks runs the same
  tick function while paused, so tests are frame-rate independent.

## Side-by-side: what becomes the foundation

| Concern | Taken from |
|---|---|
| Main loop, render on demand, fixed ticks | #6 (and the wave-1 render-on-demand lesson) |
| Fishing line | #1 Verlet relaxation, tension-driven stiffness (our design) |
| Rod control and slack rule | #2 pointer smoothing + keep-pulling idea |
| Cast flight as a pure function of time | #3 |
| Tournament structure and fish finder emphasis | #4 (idea only) |
| RNG | #5 |
| Depth from shore distance | chamfer distance transform |

The tension band, bite model, seasonal fish model, weigh-in simulation and lake generation are original.
