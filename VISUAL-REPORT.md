# VISUAL-REPORT: Ouachita Bass Classic (`games/fishing`)

The visual enhancement campaign, following `VISUAL-PLAN.md`. Nothing is committed. Rebuild with
`node shared/tools/inline.mjs games/fishing`.

## 1. What changed

**Direction: full 3D (three.js r180) for the lake and the fishing spot; painted 2D for cards and menus; the old 2D
renderer kept as the fallback.** Mechanics, tests and saves are unchanged. The 3D layer reads the same sim state
(spot space 0–1, lake space 1000 × 625) and draws it in the world.

### Real lakes (USGS data, public domain)
- **Shorelines, islands and creek arms** come from USGS NHD high-resolution waterbody polygons, rasterized to an
  800 × 500 grid (13–38 m per cell). Lake Ouachita shows 142 real islands. Routing, depth, snapping and island markers
  all run on the real masks. The 2D fallback map uses them too.
- **Terrain** is the 3DEP DEM, stored as height above each lake's pool. The 3D map exaggerates it ×3, so the Ouachita
  ridges read from above. The spot scenes use it unexaggerated for the real ridgeline behind each spot.
- **Land cover** comes from NLCD 2021. It produces forest, pasture and developed land on the map, and houses on
  developed shores in the spot scenes. **Roads and bridges** come from the National Transportation Dataset: bridges are
  wherever a road crosses the lake.
- **Creek mouths** are named from NHD flowlines (Hot Springs Creek, Gulpha Creek, Mazarn Creek, Irons Fork…). **Dam
  lines** come from NHD (Carpenter, Remmel), or from the narrowest crossing at the dam point (Blakely Mountain, DeGray).
- **Every spot, ramp and landmark** was re-placed on a real feature of the matching type: points, coves, dam faces, the
  Brushy Creek arm, the Hot Springs Creek mouth, and so on. **Landmarks sit at their real coordinates**: Carpenter Dam,
  Remmel Dam, Blakely Mountain Dam, Garvan Woodland Gardens, the three state parks, Couchwood, Mountain Pine and
  Hot Springs. A test holds each to within 600 m.
- **Pipeline:** `tools/geo/fetch.mjs` → `research/geo/raw/` (git-ignored) → `tools/geo/bake.mjs` → `data/geo/*.json`
  (about 445 KB for all four, inlined). `tools/geo/place.mjs` checks placements with the game's own code and renders
  `research/geo/preview-<lake>.png`.

### The 3D lake (map)
- **Terrain shader:** seasonal forest canopy (spring dogwood and redbud flecks, October color, November gold, winter
  greys with green pines), with tree-crown cells up close. NLCD land cover adds pasture and roof-dotted developed land.
  Rock on steep slopes. A cartographic relief light blends with the sun, so the ridges read at any hour.
- **Water shader:** a depth tint from the estimated depths, faint 20 ft chart contours, Fresnel sky reflection, sun
  glint, procedural waves and a shore edge.
- **On the map:** concrete dams with gate bays or earth embankments by type, bridges, and the Blender bass boat with a
  foam wake. During a run the camera eases toward the boat. A boat icon marks your position, since a real-size boat is
  a pixel at map scale.
- **Overlay** (2D canvas, projected from the 3D camera every frame):
  - cover-type pictogram pins (docks, brush, point, grass, riprap, channel, cove, creek…) instead of duplicate letters;
  - greedy label placement, so labels never overlap;
  - a compass whose "N" stays upright on the rotated portrait map.

### The 3D spot (fishing view)
- **Camera:** over the bow of the Blender bass boat, which has a carpeted casting deck, a graph unit and a stowed
  trolling motor. Aiming raycasts onto the water plane.
- **The real place:** the scene sits at the spot's true position, facing the nearest real shore. The DEM terrain rises
  behind a bank built from the sim's own shoreline curve.
- **Vegetation:** Blender shortleaf pines, oaks (bare in winter), redcedars and novaculite rocks, instanced and swaying
  in the wind. Seasonal colors, an understory, canopy shadows on the bank, and houses where NLCD says the shore is built.
- **Cover from the sim:**
  - Hamilton-style covered boathouses on pilings over the water, with a concrete seawall and more slips along the shore;
  - laydowns, stumps, cedar brush piles on the bottom and grass beds;
  - dam faces by type at the riprap and tailrace spots: weathered concrete with spillway gates (Carpenter), an
    Ambursen slab deck (Remmel), and earth embankments with a riprap face, crest road and spillway (Blakely, DeGray).
- **Water:**
  - a planar reflection on the high tier (oblique-clipped mirror camera);
  - a bed depth texture, and clarity from the sim (clear Ouachita and DeGray show the bottom; muddy water after storms
    hides it);
  - waves, current lines in the tailrace, splash and jump rings, rain rings, and a wet edge.
- **Rod and line:** a tapered rod whose bend follows the line, raised in a fight so the load reads, plus a reel. The
  line is a constant-width ribbon with sag on slack; it turns coral in DANGER.
- **Fish:** each species' painted plate is mapped onto a bulged card with a vertex-shader body wave. Jumps throw spray
  and rings, and the camera punches in (skipped under reduced motion). The landed fish is lifted into view. A following
  fish trails the lure in clear water.
- **Underwater camera inset:** shows the lure or the hooked fish, with murk by clarity and sun shafts.
- **Light and weather:**
  - sun position computed for 34.5° N from the game clock and month;
  - a sky dome with clouds by cover, stars at night and fog;
  - rain streaks and snow, morning mist in cold months, and an exposure floor so rain at 11 AM reads as overcast, not
    night.
- **HUD:**
  - a radial tension gauge (hatched SLACK, GOOD, striped DANGER, the line out in the centre, a stamina ring);
  - a fish-finder sonar (banded bottom returns, fish arches);
  - dark-glass panels and a locked Map button;
  - a chevron pill showing which way the fish runs (it replaced the bare triangle);
  - action button labels instead of "…".

### Painted art (Codex, OpenAI image generation)
- **20 species plates** in a field-guide style, with the identifying marks named in each prompt: the largemouth's jaw
  past the eye, the smallmouth's bars and red eye, the bluegill's ear flap, the redear's rim, the walleye's white tail
  tip, the trout's band and so on. They replace the vector fish everywhere (catch card, bag, journal, weigh-in, 3D).
- **Title key art** (wide and tall crops), the **weigh-in stage**, and **four dam illustrations** of the correct type:
  Remmel's buttress bays, Carpenter's gated gravity dam and powerhouse, and the Blakely and DeGray embankments. These
  appear on the River Chain and as the briefing banner.

### Cards, menus and type
- **Catch card:** a hero card over a blurred view of the spot. The fish is scaled by weight within the species' range,
  with a length estimate, Kicker and Big-fish-of-the-day ribbons, and the cull math.
- **Weigh-in:** true seven-segment LED digits (unlit segments faintly visible), bag thumbnails sized by weight, and a
  dark scoreboard standings table.
- **Typography:** a condensed display face (Bahnschrift / DIN from the system stack, no web fonts) for titles, the
  wordmark and numbers, with tabular numerals.
- **One message region:** toasts clear on scene changes and modals, and sit below the coaching prompt.

### Kept as is
The 2D renderer, now with the real lakes and hillshade, is the fallback for no WebGL2, `?gl=0` or Settings "2D", and
for any WebGL failure or lost context. `?art=0` keeps the vector fish.

## 2. Review scores (independent adversarial reviewer, against The Angler, Fishing Planet, Bassmaster 2022, UFS2 and Fishing Clash)

| Category | Before (review 1) | Mid (review 2) | Final (review 3) | Benchmark |
|---|---|---|---|---|
| Art and rendering | 3 | 5 | 5 | 8–9 |
| Lighting and atmosphere | 2 | 4 | 5 | 9 |
| Animation and game feel | 3 | 4 | 4 | 8 |
| UI design | 5 | 6 | 7 | 8 |
| Typography | 4 | 5 | 6 | 8 |
| Readability | 6 | 6 | 6 | 8 |
| Mobile / portrait | 6 | 5 | 6 | 8 |
| Authenticity of the setting | 4 | 6 | **7** (at benchmark) | 7 |
| **Overall** | **4** | **5** | **5.5** | |

The reviews are in `benchmarks/review-1-before.md`, `review-2-m3.md` and `review-3-final.md` (git-ignored, with the
benchmark screenshots).

**After review 3** I fixed the issues it named that I could fix in this pass:
- The pale "sand" band on every bank turned out to be a colour-space bug: sRGB constants were used as linear values.
  It is fixed in the bank, terrain and map shaders.
- Rod bend now reads (the rod rises in a fight), and the jump no longer doubles in the reflection.
- Dam faces now stand at the riprap spots, with a concrete texture.
- The "…" button labels are replaced, toasts no longer collide with the coaching prompt, and bridges are visible on
  the map.
- Phone framing shows less deck, and the two spot shots that had captured a finished day were re-captured.

These came after the last review, so they are not scored.

## 3. Tests

`node shared/test-harness/run.mjs games/fishing --milestone visual-final` (desktop and mobile run as two processes):
**97/97 passed**: desktop 54/54 and mobile 43/43. That is 55 tests in 12 files; the two-viewport tests run at both
sizes. The run saved 127 screenshots (64 desktop, 63 mobile), 19 contact sheets and 44 before/after sheets.
The mobile half was rerun after one map-tap test raced the asynchronous terrain decode. That test now waits for the
3D map before reading pin positions, and the rerun was 43/43. The balance bot (`balance.test.mjs`) is unchanged and
runs only at `final`/`balance`; no gameplay numbers changed, so it was not rerun here.

| File | Tests | New or changed for the visual pass |
|---|---|---|
| `geo.test.mjs` | 1 (desktop) | **new**: NHD acreage per frame within range; every spot and ramp on navigable water and routable from the ramp; open-water spots ≥ 100 m from shore; landmarks within 600 m of their real coordinates; Hot Springs Creek, Hamilton bridges, Ouachita's islands and markers |
| `gfx.test.mjs` | 5 × 2 viewports | **new**: 3D lake and run (pins projected and on screen), 3D spot with cast, fight and jump, rain at Blakely Mountain Dam, dusk at the Carpenter tailrace, `?gl=0` 2D fallback, painted plates on the catch card. Each frame has to show detail (stddev > 12) |
| `fishing.test.mjs` | 9 | pointer tests aim through `act('toScreen')`, a 3D projection; landing tolerance follows the cast's accuracy; the hold is timed from input-event timestamps |
| `perf.test.mjs` | 1 | logs the lazy download sizes (three.js and the packs) and checks a 5 MB total; frame-rate budgets apply on real GPUs; SwiftShader numbers are logged |
| `helpers.mjs` | — | `assetsReady()`: tests start once the 3D layer and the plates have loaded or fallen back |
| the other 9 files | as before | unchanged assertions; the keyboard-only day, contrast, touch targets, large text, reduced motion and no-storage tests all pass with the 3D layer on |

Every run has zero console errors and zero external requests (the harness fails on either). The harness renders
WebGL with SwiftShader (CPU) on the low tier, so its screenshots show the low tier. Real-GPU shots for review were
taken with `tools/shot.mjs` and are in `screenshots/review-final/`. `screenshots/visual-final/before-after/` pairs
each before shot with its after shot (harness), plus the real-GPU shot where one exists.

**Screenshots inspected:** every visual-final contact sheet at both viewports, the before/after sheets, and all 34
real-GPU review shots, opened at full size.

## 4. Performance

`tools/perf.mjs` drives the real GPU (RTX 5060, headless Chromium with D3D11). The phone pass uses a 390 × 844, 2×
viewport with **4× CPU throttling** as a stand-in for a mid-range phone. The machine was shared with 10+ other
sessions at 80–90% CPU, so treat the phone numbers as a lower bound.

| Scene | Desktop 1280 × 800, high tier: fps (p95 frame) | Phone emulation, low tier, 4× CPU: fps (p95 frame) |
|---|---|---|
| Ouachita map | 58–60 (16.8 ms) | 27–53 (33–150 ms) |
| Boat run | 53–60 (16.7 ms) | 20–54 |
| Hamilton docks spot | 60 (16.7 ms) | 35–37 (100–117 ms) |
| Fight (with underwater inset) | 60 (16.7 ms) | 24–27 (133–217 ms) |
| Rain at Blakely Mountain Dam | 60 (16.8 ms) | 41–48 (50–67 ms) |

| Load and memory | Value |
|---|---|
| First paint (title, 2D) | immediate; three.js and the packs load after first paint |
| Hooks ready (harness) | 0.1–0.2 s (`loadMs`) |
| 3D ready on desktop GPU | 0.7 s when the machine was quiet, 2.2 s under load |
| JS heap | 48–82 MB on a GPU, 40 MB on SwiftShader |
| Download | `index.html` 862 KB (game, real lake data, CSS); `vendor/three-0.180.0.min.js` 733 KB; `assets/pack-fish.js` 1,380 KB; `pack-scenes.js` 1,040 KB; `pack-models.js` 312 KB. **Total 4.2 MB**, of which 3.4 MB is lazy |

**Low-end and no-WebGL fallback.**
- **Tiers:** auto picks High on desktop GPUs and Low on phones and software renderers. Low means DPR ≤ 1.25, no
  planar reflection, coarser terrain and fewer trees. Settings or `?q=` can override it.
- **Watchdog:** a frame-time watchdog drops High to Low after sustained 38 ms frames.
- **2D fallback:** used for no WebGL2, `?gl=0`, a lost context or a failed load.
- **Draw calls:** static cover is merged into one draw call.
- **Reduced motion:** freezes water, sway, the camera punch-in and precipitation.

**Not met.** On the 4×-throttled phone emulation the fight runs 24–27 fps, below the 30 fps target; the machine was
under heavy load from other sessions. See the known gaps for the levers.

## 5. Known gaps (named, not fixed)

1. **The 3D fishing view is the weakest art** (reviewer: about 4/10 against the benchmarks' 8–9).
   - Foliage and props are untextured low-poly. There are no painted texture atlases and no colour grade tying the 3D
     to the painted key art.
   - There are no cast shadows beyond the baked canopy shade, and the sun is never in view.
   - The next step is painterly texture atlases (bark, foliage cards, rock, clay) sampled from the key art, plus a grade
     taken from the title painting.
2. **The fish are painted cards, not skinned meshes.** They bend and swim, but the side profile shows when they turn
   end-on. A skinned bass mesh projected with the plate is the next step.
3. **There is no in-world boat run.** The run is a map animation with a wake and a follow camera, not a third-person
   ride through the 3D spot scene.
4. **Dam spots are approximations:** a concrete wall with gates, a slab deck, or an embankment. They are not modelled
   from HABS/HAER drawings, and Garvan Point shows no gardens.
5. **Phone fight frame rate:** 24–27 fps under 4× CPU throttling with a loaded machine. Levers: drop the underwater
   inset on Low, halve the trees, or skip the reflection of the fish.
6. **Depths are estimated.** No public bathymetry was found, so depth grows with distance from shore and toward the
   dam. Sourced acreages describe full-pool lakes, while the map frames crop river ends.
7. **The tall title crop** keeps the angler only partly in view behind the Dock Note, and the phone weigh-in shows the
   painted sky but not the stage.
8. **Earlier gaps still stand:** nobody has listened to the audio or used a screen reader; fun is checked by the bot.

## 6. Research added (sources in the files)

- `research/geo/SOURCES.md`: which USGS datasets were used and how; what is real and what is estimated; every
  landmark coordinate.
- `research/visual-research.md`: dam types and sizes (Carpenter about 100 ft, concrete gravity with gates; Remmel an
  Ambursen flat-slab buttress dam; Blakely Mountain 231 ft and 1,100 ft crest, earth and rock), the shortleaf pine–oak
  forest and seasons, novaculite and shale banks, Hamilton's developed shore, clarity by lake, and the sun model.
- `tools/geo/placements.json`: where each spot sits on the real lake.

**Facts worth adding to the shared `research/`** (for the coordinator):
- Coordinates: Carpenter Dam 34°26′32″N 93°01′33″W; Remmel Dam 34°25′37″N 92°53′38″W; Blakely Mountain Dam
  34°34′21″N 93°11′39″W; Garvan Woodland Gardens 34.4347, −93.0456; Lake Catherine SP 34.4379, −92.9180; Lake Ouachita
  SP 34.6186, −93.1773; DeGray Lake Resort SP 34.2457, −93.1479; Couchwood 34.4483, −92.9147.
- Blakely Mountain Dam: 1,100 ft (340 m) crest, 75 MW (Wikipedia, Lake Ouachita).
- Measured NHD water areas inside the game frames: Catherine 1,527 acres, Hamilton 6,331, Ouachita 38,115 (142
  islands), DeGray 11,482. These are frames, not full-pool totals.
- The named creeks entering each lake (NHD), for example Hot Springs, Gulpha, Mazarn and Little Mazarn creeks, Stokes,
  White Oak and Rush Fork into Hamilton.

## 7. Requests for shared files and the harness

- **Harness:**
  1. A `--gpu` flag that launches Chromium with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`, so 3D games can
     shoot real-GPU screenshots and measure real frame rates in tests. The default SwiftShader is 5–20× slower and
     renders only the low tier.
  2. Per-test timeouts that scale for software-rendered WebGL.
  3. A shared before/after sheet tool; `games/fishing/tools/before-after.mjs` is a starting point.
- **Inliner:** `export const A = 1, B = 2;` exports only `A`. Either support multiple declarators or document it. It
  bit `LW, LH` here.
- **LESSONS** (added to the shared notes folder as `fishing-visual-notes.md`):
  - WebGL refuses file:// images, so use base64 asset packs loaded by `<script>`;
  - the esbuild IIFE vendoring of three.js;
  - an input-event-timestamp hold timer for press-and-release mechanics;
  - shader colour constants must be linear;
  - re-rendering scene DOM when an async asset arrives steals focus;
  - the USGS REST endpoints, which are reusable for any game that needs real terrain or shorelines.
