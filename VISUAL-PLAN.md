# VISUAL-PLAN: Ouachita Bass Classic

The visual enhancement campaign for `games/fishing`. Baseline: 86/86 tests passing, 103 screenshots in
`screenshots/visual-before/`. The independent baseline review (`benchmarks/review-1-before.md`, not in git) scored the
game **4/10** against Call of the Wild: The Angler, Fishing Planet, Bassmaster Fishing 2022, Ultimate Fishing Simulator 2 and
Fishing Clash:

| Category | Ours | Benchmarks |
|---|---|---|
| Art and rendering | 3 | 8–9 |
| Lighting and atmosphere | 2 | 9 |
| Animation and game feel | 3 | 8 |
| UI design | 5 | 8 |
| Typography | 4 | 8 |
| Readability | 6 | 8 |
| Mobile / portrait | 6 | 8 |
| Authenticity of the setting | 4 | 7 |

Its top gaps: no rod, angler or real boat in the fishing view; the same flat light at every hour and in every weather; a
fight with no drama; the catch card is a form; fish art misses defining marks; lake maps are blobs, not the real lakes;
no Ouachita ridges, roads or towns; dams are glyphs; cover is drawn in the wrong plane; a weigh-in with no event energy;
menus are text walls; typography without identity.

## 1. Direction: full 3D for the lake and the spot, painted 2D for cards

**Three.js (r180, vendored) renders both play scenes in 3D; HTML stays the UI; painted images carry the cards.**

- **Why 3D.** Every benchmark gets its atmosphere from the same three things: a lit water surface that reflects the shore,
  a real horizon (hills, trees, sky) and a rod and boat in the foreground. All three are natural in 3D and nearly impossible
  to fake convincingly in the current top-down 2D. 3D also lets the real terrain (USGS 3DEP) show the Ouachita Mountains
  around each lake, which is the setting's strongest visual identity.
- **Why not 3D everywhere.** Catch cards, the journal, the weigh-in board and menus read better as crisp painted art and
  HTML. Painted species plates (Codex) double as the 3D fish textures.
- **The 2D renderer stays** as the fallback for no WebGL, `?gl=0`, the "2D" graphics setting, and devices that can't hold
  30 fps on the low 3D tier. It also gains the real lake geometry, so the fallback improves too.
- **Mechanics are untouched.** The sim (bites, fight, tension, sonar, tournament) keeps its local 0–1 spot space and its
  lake space; the 3D layer maps them to the world. Gameplay tests keep passing through the same hooks.

## 2. Scenes

### 2.1 The lake (map) in 3D
- **Real lakes.** USGS NHD high-resolution shorelines rasterized to an 800 × 500 grid in the game's 1000 × 625 lake space
  (13–38 m per cell), with real islands (Ouachita: 142 in frame), real coves and creek arms. Spots, ramps and landmarks are
  re-placed on real features of the right type. Depths stay estimated (no public bathymetry) and labeled so.
- **Terrain** from the 3DEP DEM (400 × 250 samples per lake, height above the pool, ×2.5 vertical exaggeration), with a
  canopy shader (shortleaf pine–oak forest, seasonal: spring dogwood/redbud flecks, summer green, October color, winter
  browns with green pines), novaculite-grey rock on steep slopes, a red-clay/rock waterline band, and baked sun shadows.
- **Water shader**: depth tint from the estimated depth field, Fresnel sky reflection, sun glint, two scrolling procedural
  normal maps, shoreline foam, faint depth contours (the chart look players need for reading structure).
- **Real structures**: dam lines from NHD (Carpenter, Remmel) or the polygon ends (Blakely Mountain, DeGray), modeled by
  type: Carpenter Dam a concrete gravity dam with spillway gates and powerhouse; Remmel Dam an Ambursen flat-slab buttress
  dam; Blakely Mountain and DeGray earth embankments with spillways. Bridges where national road data crosses the lake
  (AR 7 Central Ave and Airport Rd on Hamilton, US 270 on Ouachita, Carpenter Dam Rd on Catherine). Named creek mouths
  from NHD flowlines (Hot Springs Creek, Gulpha Creek, Mazarn Creek…). Garvan Woodland Gardens, the state parks,
  Couchwood, Mountain Pine and Hot Springs at their real coordinates.
- **Camera**: tilted perspective, north up on landscape screens; portrait screens rotate the camera (north to the right)
  as the 2D map does, with a proper rotated compass. During a run the camera eases toward the boat and follows it.
- **Overlay**: spot pins, labels, island markers and the compass stay in the 2D canvas on top, projected from 3D every
  frame, so hit-testing, labels and keyboard selection keep working (and stay crisp).
- **Boat run**: the Blender bass boat on the route, planing attitude, a foam wake ribbon and spray.

### 2.2 The spot (fishing) in 3D
- **Camera** over the shoulder from the bow deck: the front deck, trolling motor and rod in the foreground, looking at the
  structure. Spot space x∈[0,1], y∈[0,1] maps to a 30.5 m × 30.5 m water patch (100 ft, as the sim already assumes).
  Pointer aiming raycasts onto the water plane, so aim and cast feel direct at any perspective.
- **Shore** built from the sim's own `shoreY` curve: banks, rocks (riprap on dams and points), shortleaf pines and
  hardwoods, Hamilton-style covered boathouses for dock spots, laydowns, stumps, emergent grass tips.
- **Real horizon**: the far ridgelines are ray-cast from the spot's true position through the DEM in the facing
  direction, so the hills behind each spot are the real ones.
- **Water**: planar reflection of shore and sky (half resolution), depth-based clarity (clear Ouachita/DeGray show the
  bottom and brush piles; stained Hamilton less; muddy after storms almost none), ripples, rain rings, splashes, a fish
  V-wake and boils.
- **Rod and line**: a procedural rod whose bend follows tension, a visible line (camera-facing ribbon) with sag on slack,
  the lure in the water with depth fade, the "!" bite cue.
- **Fish**: Blender base meshes per body type (bass, sunfish/crappie, catfish, temperate bass/trout/walleye, pike/gar),
  textured with the painted species plates (side projection), swimming by a vertex-shader body wave. Jumps are full 3D
  with spray; the landed fish is lifted into view before the catch card.
- **Underwater cam**: an inset view (desktop always, mobile toggle) of the lure, cover and following fish, with caustics
  and fog.
- **Time of day and weather**: a sky shader driven by the game clock and month (sun position from `sunTimes`), fog,
  rain, storm darkening, snow, night with moon and stars, morning mist in cold months, Garvan Holiday Lights at night
  on Hamilton in Nov–Dec.

### 2.3 Cards, menus and HUD (2D)
- **Painted species plates** (20, Codex) replace the procedural fish everywhere (catch card, bag, journal, weigh-in), with
  the vector fish as the fallback.
- **Catch card** becomes a hero moment: the fish scaled by weight, length estimate, cull comparison.
- **Title** key art (painted golden-hour Lake Hamilton with the Ouachita ridges), **dam illustrations** for the four River
  Chain nodes, **weigh-in** stage backdrop.
- **HUD**: a radial tension gauge near the reel; a fish-finder styled sonar; enabled/disabled states that read clearly.
- **Typography**: a condensed display face for titles and numbers (system stack first, no web fonts), tabular numerals,
  12 px minimum on mobile.

## 3. Assets

| Asset | Tool | Format | Budget |
|---|---|---|---|
| three.js r180 core + GLTFLoader + BufferGeometryUtils | npm, esbuild IIFE | `vendor/three-0.180.0.min.js` | ≤ 750 KB (trim later) |
| Real lake data ×4 (mask, DEM, bridges, creeks, dams, islands) | `tools/geo/fetch.mjs` + `bake.mjs` | `data/geo/*.json` (inlined) | ~290 KB |
| Bass boat (hull, console, outboard, trolling motor) | Blender 5.2 | GLB, base64 in an asset pack | ≤ 250 KB |
| Trees: shortleaf pine, oak/hickory, cedar; rocks; boathouse; laydown | Blender | GLB | ≤ 200 KB |
| Fish base meshes ×5 | Blender | GLB | ≤ 80 KB |
| Species plates ×20 | Codex | WebP (transparent), data URIs | ≤ 900 KB |
| Title key art, 4 dam illustrations, weigh-in backdrop | Codex | WebP | ≤ 600 KB |
| Water normals, foam, canopy, caustics | procedural at runtime (shaders / DataTextures) | — | 0 |

**file:// rule.** WebGL refuses textures from file:// images (tainted), so every image and model ships as a data URI or
base64 inside `.js` asset packs loaded with `<script src>` (works under file:// and from the harness server). Packs load
after first paint, core first.

## 4. Research additions
- USGS NHD, 3DEP and National Transportation Dataset extracts (public domain), recorded in `research/geo/SOURCES.md`.
- Coordinates of dams, parks and landmarks (Wikipedia/NHD), dam types and dimensions (Carpenter, Remmel, Blakely
  Mountain, DeGray), Ouachita forest composition (shortleaf pine–oak), novaculite outcrops, Lake Hamilton shoreline
  development (boathouses), in `research/visual-research.md`.

## 5. Performance plan
- **Targets**: 60 fps on a mid laptop at 1280 × 800, 30+ fps on phones, first paint before three.js loads (the title is
  2D), playable map within ~1 s on desktop.
- **Tiers** (auto, overridable in Settings: Auto / High / Low / 2D): High = DPR ≤ 2, planar reflections, 256 × 160 terrain,
  underwater inset; Low = DPR ≤ 1.25, no reflection (sky only), 128 × 80 terrain, fewer trees. SwiftShader (no GPU) starts
  on Low. A frame-time watchdog drops a tier after sustained slow frames and offers 2D below 24 fps.
- **Download**: index.html ≲ 600 KB (game + geo), three ≲ 750 KB, art packs ≲ 2 MB, all lazy.
- **Render on demand** stays for menus; 3D scenes run continuously only while visible; reduced motion freezes water
  animation and the camera.

## 6. Test plan
- Existing 86 tests keep passing; pointer tests use a new `act('toScreen', x, y)` hook (3D projection) instead of the
  flat water rectangle.
- New `geo.test.mjs`: real acreage within 15% of the sourced figure, every spot and ramp on navigable water, every spot
  routable from the ramp, landmarks at their real coordinates, bridges over water.
- New `gfx.test.mjs`: WebGL scenes render (map, run, spot, fight, jump, night, rain) at both viewports with zero console
  errors and no external requests; `?gl=0` falls back to 2D; asset manifest complete (no 404s); a tier switch works;
  pixel checks that the 3D canvas isn't blank.
- `perf.test.mjs`: headless SwiftShader gets software budgets (logged); a separate `tools/perf.mjs` measures real-GPU fps,
  GPU frame time, load time, heap and download size at both viewports.
- Every milestone: screenshots at both viewports inspected, then the adversarial reviewer re-scores against the benchmarks.

## 7. Milestones
1. **M1 Real lakes**: geo pipeline, real masks and terrain in the 2D map, spots re-placed, geo tests.
2. **M2 3D lake**: three.js loader, terrain, water, dams, bridges, overlay, boat run, tiers, fallback.
3. **M3 3D spot**: shore, horizon, water with reflections and clarity, rod and line, lure, fight, jump, weather and time.
4. **M4 Fish and cards**: Blender fish and boat, painted species plates, catch hero card, underwater cam.
5. **M5 Presentation**: title key art, dams art, weigh-in stage, HUD gauge and sonar, typography.
6. **M6 Performance and close-out**.
