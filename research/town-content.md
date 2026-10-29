# Ouachita Bass Classic: town content

Every place, fact, name, color and story the game uses, with its source in the shared corpus
(`research/`). No new research. Paths are relative to the repo root. Where the corpus records a
conflict, the game uses the hedged value given here. Anything marked **game logic** is a design value,
not a fact, and the game labels it that way on screen.

## 1. How Hot Springs shows up in the game

| Game element | Hot Springs content | Source |
|---|---|---|
| Campaign "Follow the River" | Climb the Ouachita River dam chain: Lake Catherine (Remmel Dam) → Lake Hamilton (Carpenter Dam) → Lake Ouachita (Blakely Mountain Dam), with a DeGray Lake side trip on the Caddo River. Each dam is a gate opened by a tournament finish | `geography-lakes-mountains.md` → Lakes (master table; "the three Ouachita River lakes form a chain"); `game-hooks.md` §5 idea 1 |
| Lake maps | Four code-drawn lakes, stylized (not traced): long river-lake Catherine, winding docked Hamilton with the Garvan peninsula, island-studded Ouachita, deep DeGray | Lakes master table, per-lake notes; style guide → Per-game hooks → Ouachita Bass Classic |
| Species per lake | Only species the corpus lists for each water (table §3) | `fish-and-wildlife.md` → Species table by lake |
| Seasons | Spawn ladder by water temperature, air from monthly normals | `fish-and-wildlife.md` → Seasonal behavior by month; `geography-lakes-mountains.md` → Climate |
| Rules | Statewide limits (10 black bass, ≤ 4 smallmouth, 30 crappie, possession 3× daily) in Free Fish; tournament 5-fish limits | `fish-and-wildlife.md` → Regulations; → Tournaments and formats |
| Tournament tiers | Weeknight club (pairs, 5 fish), regional one-day and two-day finale, championship on Ouachita | `fish-and-wildlife.md` → Tournaments and formats ([inferred] tiers) |
| Dock Notes | 30 lake and fish facts from the audited trivia bank, each with its source line | `games/trivia/data/questions.json` (ids in §8) |
| Art | `lake-life` palette, depth gradient `#1E4E79` → `#4C8FA8`, dock wood `#9C7A55`, pine islands with novaculite-white rock edges, bass/bobber/pontoon icons, Deco bronze-grille scoreboard with neon digits | `research/visual-style-guide.md` → P8, icon catalog #37–39, Motif D8/#17 bronze grille, per-game hooks |

## 2. The lakes

| Lake | Facts used in game (chapter card and lake card) | Map landmarks drawn | Source |
|---|---|---|---|
| Lake Catherine | 1,940 acres. Remmel Dam, 1924, a concrete-and-steel Ambursen flat-slab buttress dam, built by Ford, Bacon & Davis with Ambursen Construction; named for Harvey Couch's daughter Catherine. Nearest town Jones Mill. Lake Catherine State Park (1935, built by the CCC, stone-and-wood cabins). Couchwood, Harvey Couch's estate. Its head is the Carpenter Dam tailrace, a winter rainbow trout fishery | Remmel Dam (east), Carpenter Dam tailrace (west), state park with CCC cabins, Couchwood | Lakes master table; "Lake Catherine" notes; `fish-and-wildlife.md` → Structure (tailrace) |
| Lake Hamilton | About 7,200 acres. Carpenter Dam, completed 1931 (begun 1929 by Arkansas Power & Light under Harvey Couch), concrete gravity, about 100 ft high; lake named for Hamilton Moses of AP&L, dam for Flavius Josephus Carpenter. Garvan Woodland Gardens (210 acres, 4.5 miles of shoreline) on a peninsula. AGFC Andrew Hulsey State Fish Hatchery on the lake. Hot Springs Creek empties into it. Docks and brush piles | Carpenter Dam (east), Garvan peninsula, hatchery on the south side (audited bank hs-0174 places it on the lake's south side; the exact spot is game placement, no coordinates are sourced), Hot Springs Creek inflow | Master table; "Lake Hamilton" notes; `fish-and-wildlife.md` → Structure, Hatcheries |
| Lake Ouachita | About 40,000 acres (conflict: "over 66,324" in Wikipedia text; the game uses 40,000 per the corpus guidance). About 200 islands with numbered island markers. Blakely Mountain Dam, built 1948–1953, 231 ft tall. Deep, clear, low-productivity. Hydrilla and Eurasian watermilfoil on about 10% of the lake. Cedar brush piles at 20–25 ft, mostly between Island Markers 28 and 36, on main-lake points and saddles. Geo-Float Trail; "one of the largest crystal veins in the world" (Wikipedia, shown as a quote). Lake Ouachita State Park (1953/1955) preserves Three Sisters Springs. Mountain Pine lies below the dam. In the 1950s the dam flooded Buckville and Cedar Glades. Non-stinging freshwater jellyfish | Blakely Mountain Dam (east), state park (east shore), island markers 20–40 (only 28–36 numbers are sourced as brush-pile markers; others are game numbering), Geo-Float marker, grass beds | "Lake Ouachita" notes; `fish-and-wildlife.md` → Structure and cover, Aquatic invertebrates |
| DeGray Lake | About 13,800 acres (conflict 13,400 / 13,420; game uses "about 13,800"). Max depth about 200 ft. Caddo River. DeGray Dam built 1962–1972. "First pump-back-capable Corps impoundment" (shown as "according to Wikipedia", claim). DeGray Lake Resort State Park (1974, lodge). Bald eagles winter here. Eagle tours: Jan 24, 2026, $14 adults, $8 ages 6–12, tied to the late-January Eagles Et Cetera festival | DeGray Dam (south-east), Caddo River inflow, resort lodge | "DeGray Lake" notes; `fish-and-wildlife.md` → Wildlife/Birds; `culture-events-food.md` → Events calendar |

Not used: Ouachita's 406-ft maximum depth (suspect), Hamilton's 80-mile shoreline and 57-ft depth (unverified;
the game's depths are game logic), Lake Winona, Hot Springs Village lakes.

## 3. Species by lake (only sourced waters)

| Species | Catherine | Hamilton | Ouachita | DeGray | Source / note |
|---|---|---|---|---|---|
| Largemouth bass | ✓* | ✓ (Florida-strain stocking) | ✓ | ✓ | Species table. *Catherine is n/s for largemouth; the game uses the Ouachita River species list (black bass, white bass, bream, drum, gar) for Lake Catherine, which impounds the river. Labeled in the lake card |
| Spotted bass | ✓* (black bass) | ✓ | ✓ | — | Species table |
| Smallmouth bass | — | — | ✓ | — | Species table (counts toward the 4-smallmouth cap) |
| Striped bass | — | ✓ | ✓ (stocked yearly, no natural reproduction) | — | Species table; Hatcheries |
| Hybrid striped bass | — | ✓ | — | ✓ (known for it) | Species table |
| White bass | ✓* | ✓ | — | ✓ | Species table |
| Walleye | — | — (angler reports only, low quality: not used) | ✓ (self-sustaining) | ✓ (stocked) | Species table; Hatcheries |
| White crappie | — | ✓ | ✓ | ✓ | Species table |
| Black crappie | — | ✓ | — | — | Species table |
| Bream (bluegill/redear) | ✓* | ✓ | ✓ | ✓ | Species table |
| Channel catfish | — | ✓ | ✓ (brush piles) | ✓ | Species table |
| Blue catfish | — | ✓ | — | ✓ | Species table |
| Flathead catfish | — | — | — | ✓ | Species table |
| Rainbow trout | ✓ tailrace below Carpenter Dam | — | — | — | Species table; trout season mid-November through April (the audited bank, hs-0173, says AGFC stocks "from November through April"; the corpus says resumes mid-November, larger fish in March) |
| Northern pike, muskellunge | — | — | — | ✓ (stocked exotics; rare in game) | Species table |
| Freshwater drum, gar | ✓* | — | — | — | Ouachita River list |

**Game logic (labeled "game estimate"):** every fish weight distribution. Calibration from the corpus: Hamilton
5-fish winning bags 17–18 lb (about 3.5 lb per fish for winners), kickers 7–11 lb, an 11-lb fish is a near-legendary
kicker (`fish-and-wildlife.md` → Species profiles [inferred]).

## 4. Seasons, weather and water

| Item | Value used | Source |
|---|---|---|
| Monthly air normals (hi/lo °F, precip in) | Jan 53.4/32.2/2.9 · Feb 56.4/35.3/4.3 · Mar 66.7/44.3/5.0 · Apr 74.4/51.8/5.9 · May 81.5/61.0/6.3 · Jun 90.6/69.9/4.0 · Jul 93.3/72.6/4.0 · Aug 92.8/71.7/3.7 · Sep 86.7/64.8/4.0 · Oct 75.4/52.5/4.3 · Nov 64.1/41.9/3.6 · Dec 55.4/35.3/4.8 | `geography-lakes-mountains.md` → Climate (climate-charts.com, NOAA data) |
| Snow | About 1.1 in a year; snow chance about 1 in 60 on a Dec–Feb day; a snow day closes the ramps | Climate (Wikipedia) and its [inferred] note |
| Wettest month | May | Climate; audited bank hs-0176 |
| Water temperature | **Game logic, labeled "game estimate":** lagged blend of this and last month's mean air temperature (§ MECHANICS). No water temperatures are sourced | Game-hooks §5 gaps |
| Spawn ladder | Crappie spawn starts about 56°F; white crappie 60–65°F, black crappie 62–68°F; bass and bream a few degrees warmer; catfish warmest. Fish shallow in their window, deep or on brush otherwise | `fish-and-wildlife.md` → Species profiles, Seasonal behavior ([inferred] month mapping) |
| Hamilton May post-spawn | Big females slide onto brush piles in May; an 11-lb fish came on a Texas-rigged craw in a green-pumpkin color (May 2024). In-game lure: "Craw worm, Texas rig" in "green pumpkin" (generic name) | `fish-and-wildlife.md` → Baits and techniques; Species profiles |
| Summer | July–August highs about 93°F push fish deep; dawn/dusk windows [inferred] | Seasonal table |
| Muddy water after May storms | [inferred] | Seasonal table |
| Eagles | Bald eagles winter on Ouachita and DeGray, Dec–Feb. Circling eagles marking baitfish is a game mechanic | `fish-and-wildlife.md` → Wildlife; game-hooks idea 16 |
| Garvan Holiday Lights | Mid-November to December; about 4 million bulbs on 18 acres (2014), later "4.5–5 million" (conflict): shown as "millions of lights" from the water after dark on Hamilton | `other-attractions.md` → Garvan (Holiday Lights row) |
| Freshwater jellyfish | Non-stinging, Lake Ouachita; summer timing is a game choice (seasonality unsourced) and rare | `fish-and-wildlife.md` → Aquatic invertebrates |

## 5. Rules and records

| Item | Value | Source |
|---|---|---|
| Statewide daily limits | Black bass 10, no more than 4 smallmouth (meanmouth count as smallmouth); crappie 30; possession 3× daily (AGFC code dated April 2026) | `fish-and-wildlife.md` → Regulations; audited bank hs-0135, hs-0136 |
| Lake-specific limits | **None used** (unconfirmed). The game says "statewide limits" and labels tournament rules as fictional | Regulations [UNCONFIRMED] |
| Tournament rules (fictional) | 5-fish limit, culling, late check-in penalty 1 lb per minute, 15 minutes late = disqualified, ties broken by big fish | Game logic (formats implied by Tournaments table) |
| State records (journal board) | Largemouth "about 16 lb" (16 lb 4 oz vs 16 lb 8 oz conflict; shown as "16 lb 4 oz or 16 lb 8 oz: AGFC pages differ"); striped bass 64 lb 8 oz; hybrid 27 lb 5 oz; walleye 22 lb 11 oz. Certification: certified legal-for-trade scale plus an AGFC or USFWS witness. Near miss: a verified 58 lb 3 oz Bull Shoals striper did not beat 64-8. No record-holder names shown | `fish-and-wildlife.md` → State records; Regulations |
| Pro pace on brush | "Really slow down", about 20 brush piles a day (paraphrased, no angler name) | `fish-and-wildlife.md` → Structure (MLF) |
| Generation hazard | Check the Carpenter Dam generation schedule before the tailrace; when turbines run, current spikes, wading is unsafe, trout scatter. In-game schedule times are fictional | `fish-and-wildlife.md` → Structure and cover; Regulations (safety) |
| Striper dependency | Ouachita stripers are stocked every year (no natural reproduction); walleye now self-sustaining | Hatcheries; audited bank hs-0138 |
| Florida-strain stocking | 662 surplus broodstock-pond Florida-strain largemouth from Andrew Hulsey Hatchery into Hamilton | Hatcheries |

## 6. Tournament calibration (tuning data only, no names)

| Real result used for tuning | Game use | Source |
|---|---|---|
| Club, Hamilton, 35 boats, winning 5-fish bag just over 17 lb, big fish 11 lb | Club tier: winners about 17 lb, big-bass side pot | Tournaments table (May 17, 2024) |
| Regional one-day, Hamilton, March 2026: 18 lb 3 oz tie for first, payouts $3,010/$2,510 | Regional one-day winners about 18 lb; tie scene broken by big fish | Tournaments table |
| Regional two-day finale, Sept 2025: 10 bass, 27 lb 3 oz, $12,177 | Finale winners about 27 lb over 2 days; winner purse "$12,000" (game value) | Tournaments table |
| Championship on Ouachita, won running brush | Championship tier on Ouachita; brush-pile mechanics | Tournaments table (Forrest Wood Cup; year n/s) |

All payouts and entry fees in game are fictional round numbers. **Private individuals named in the corpus are
never shown.** The test suite checks the angler name list against a banned list (tournament anglers, record holders
and the quoted guide from the corpus, plus well-known professional anglers).

## 7. Fictional content (clearly game-made)

- **Ramps:** Redbud Landing (Catherine), Dogwood Cove Ramp (Hamilton), Whetstone Point Ramp (Ouachita),
  Caddo Bend Ramp (DeGray). Fictional because no weigh-in ramp is sourced and marina coordinates are missing.
- **Fishing spots:** fictional names ("Sunken Cedar Saddle", "Pine Knot Point"…) attached to real structure types.
- **Events:** "Remmel Rally Weeknight Club", "Spa City Regional", "Ouachita Classic Championship", "DeGray Eagle
  Weekend Derby". The tackle shop "Razorstone Tackle" (from novaculite's Latin meaning "razor stone", hs-0143).
- **Anglers:** 48 invented names with hometowns from corpus places (Hot Springs, Mountain Pine, Royal, Jessieville,
  Mount Ida, Magnet Cove, Jones Mill, Hot Springs Village, Bear, Paron).
- **Lures:** generic names only (craw worm, jig, crankbait, spinnerbait, popper, drop-shot worm, jerkbait,
  swimbait, tube jig, nightcrawler, dough bait, waxworm, egg fly). No brands.
- **Upgrade "Novaculite whetstone":** sharper hooks. Fact on the card: novaculite whetstones, sold as "Washita" and
  "Arkansas" stones; whetstone mining began as early as 1818 (`geography-lakes-mountains.md` → Novaculite; hs-0144).

## 8. Dock Notes (audited trivia bank)

Shown on the title, briefings and run transitions, each with its `source` line:
hs-0121, hs-0122, hs-0123, hs-0124, hs-0126, hs-0127, hs-0128, hs-0130, hs-0131 (claim badge), hs-0132,
hs-0134, hs-0135, hs-0136, hs-0137, hs-0138, hs-0139, hs-0140, hs-0141, hs-0143, hs-0144, hs-0159, hs-0169,
hs-0173, hs-0174, hs-0175, hs-0176, hs-0177, hs-0178, hs-0179, hs-0170. Built by `tools/make-notes.mjs`
into `data/dock-notes.json` (question → statement form, answer, explanation, source).

## 9. Colors

| Use | Hex | Source |
|---|---|---|
| Deep water / shallows | `#1E4E79` / `#4C8FA8` | P8 lake-life |
| Dock wood | `#9C7A55` | P8 |
| Sunset gold sky band, highlights | `#F2A541` | P8 |
| Restored brick (primary buttons) | `#B5654A` (darkened `#8E3622` for text buttons) | P8; theme tokens |
| Pine islands / hillsides | `#1F3324`, `#2F4A2C`, `#5C7A3A` | P1 ouachita-forest |
| Shoreline rock / NPS rustic frames | `#8C877C`, `#5B4632` | P9 nps-rustic |
| Novaculite rock edge | `#EDEAE2` | P1 text/novaculite white |
| Fall shoreline | `#C8501F` | P8 fall |
| Bass | body `#4F6B35`, belly `#E6DDB0` | Icon #37 |
| Bobber | `#C8452B` over white | Icon #38 |
| Scoreboard bronze grille | `#7C5A2E`, neon `#FF3B3B`/`#4FC3FF` | P5 deco-neon; icon #17 |

All hex values are estimates (style guide).
