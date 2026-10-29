# Ouachita Bass Classic: product requirements

## 1. Vision

A fishing-tournament game on the real lakes around Hot Springs, Arkansas. You read the lake (structure, depth,
cover, weather, season), pick a spot and a lure, then cast, work the bait and fight the fish with a skill-based
tension mechanic. At the end of the day the weigh-in reveals your bag on a Deco scoreboard against a field of
fictional anglers. A campaign climbs the Ouachita River's dam chain from Lake Catherine to Lake Hamilton to the
championship on Lake Ouachita, with a side trip to DeGray Lake.

**Pillars**
1. **Read the water.** Every bite has a reason players can learn: season, water temperature (labeled as a game
   estimate), depth, cover, light, clarity, lure and speed.
2. **Hands on the rod.** Casting accuracy, hook-set timing and the tension fight are skill, with mouse, touch and
   keyboard all first class.
3. **The weigh-in matters.** Five fish, the clock, the run home and the culling decisions build to one reveal.
4. **Real lakes, honest facts.** Only sourced facts appear as facts; everything else is labeled game logic or
   fiction.

## 2. Target players

Casual players who like fishing or Arkansas lakes (5–15 minute sessions, one tournament day), and players who
enjoy a systems puzzle (which spot, which bait, when to run home). Ages 10+. Mouse, touch phone, keyboard only.

## 3. Modes

| Mode | Description |
|---|---|
| **Follow the River (campaign)** | Ch. 1 Lake Catherine, March, weeknight club (pairs, 5 fish, 24 teams, 4:30–8:00 PM): top 5 opens Carpenter Dam. Ch. 2 Lake Hamilton, May, regional one-day (40 boats, 6:30 AM–2:30 PM): top 10 qualifies. Ch. 3 Lake Hamilton, September, two-day finale (10 fish): top 5 opens Blakely Mountain Dam. Ch. 4 Lake Ouachita, October, two-day championship (30 boats). Side trip (after Ch. 1): DeGray Lake, January, Eagle Weekend Derby (heaviest single fish, any species) |
| **Quick Tournament** | Any lake, any month, tier club / regional / championship; one day |
| **Free Fish** | Any lake and month, no field; statewide limits and a warden check; fills the journal |

Money from payouts buys upgrades between campaign events: novaculite whetstone (hook-set window), smooth-drag
reel (snap threshold), sonar (fish marks, reveal radius), bigger motor (run time), and lure unlocks. After Ch. 3 a
choice: chip into the Lake Ouachita striper stocking fund (stripers are stocked yearly) or keep the money.

## 4. Complete rules

1. **Day.** Game clock from launch to check-in. Actions cost game minutes (MECHANICS §6). Reading cards,
   choosing lures and pausing cost nothing.
2. **Map.** Spots are markers on a code-drawn lake: points, coves, docks, brush piles, grass beds, creek channel,
   dam riprap, islands, flats, the tailrace. Each card shows structure, depth, cover and run time. Running moves the
   boat and costs time. On Ouachita, brush piles between Island Markers 28 and 36 are hidden until sonar reveals them
   (scan, or pass within the reveal radius).
3. **Fishing.** Choose lure and color, retrieve speed. Cast (accuracy ring), retrieve (hold), set the hook in the
   window after a bite, fight with the tension band and rod side pressure. Snags and grass fouling cost time.
4. **Fish.** Species and sizes follow the lake, season phase, depth, cover, light, clarity, lure, color, speed,
   events and spot pressure (MECHANICS §4). Only species the corpus lists for each water appear.
5. **Livewell.** Tournament: 5 black bass, culling allowed; pairs share a livewell and the partner adds fish.
   Free Fish: 10 black bass (≤ 4 smallmouth), 30 crappie; others released.
6. **Check-in.** Late = 1 lb per minute; over 15 minutes late = disqualified (fictional rules, labeled).
7. **Weigh-in.** Bag weight (lb-oz), big fish; field ranked by total weight, ties broken by big fish; two-day events
   total both days. Payouts are fictional round numbers.
8. **Hazards and events.** Carpenter Dam generation closes the tailrace and scatters trout; snow days close ramps;
   eagles (Dec–Feb, Ouachita/DeGray) mark baitfish; May storms muddy Hamilton and Catherine; summer heat pushes fish
   deep; Hamilton May post-spawn kicker bonus; jellyfish sightings (Ouachita, summer, rare); Garvan Holiday Lights
   seen from Hamilton after dark (mid-Nov–Dec, Free Fish).
9. **Campaign gates.** Each dam opens on the stated finish; failing replays the event with a new day.

## 5. Hot Springs content map

See `research/town-content.md`. Lake facts on chapter and lake cards; dam names and years on the River Chain gates;
regulations in the livewell panel and help; state records and the certification rule in the journal; Dock Notes
(audited trivia, with sources) on the title, briefings and run transitions; fictional ramps, spots, events, shop
and anglers clearly game-made.

## 6. Screens and UX flow

Title → (Campaign → River Chain map → Briefing) | (Quick / Free → Setup → Briefing) → Lake map ⇄ Spot view
(catch card on each fish) → Weigh-in → Results (gate opens / retry / shop) → River Chain or Title.
Always available: How to Play, Settings, Journal, pause (Esc). The HUD shows clock, check-in, run time home,
livewell, weather and water temperature (est.).

## 7. Art direction

`lake-life` palette (deep `#1E4E79` → shallows `#4C8FA8`), `ouachita-forest` hillsides, `nps-rustic` shoreline rock
and routed-wood signs, sunset-gold sky bands, novaculite-white island rock edges, dock wood `#9C7A55`, fall shoreline
`#C8501F` in Oct–Nov. Icons: largemouth bass, red-over-white bobber, pontoon/bass boat. Weigh-in: bronze grille
scoreboard with neon digits. Night tint after sunset. All procedural Canvas; no images.

## 8. Audio direction

WebAudio synthesis only, quiet by default (volume 0.5), mutable (M): cast whoosh, lure plop, reel clicks, bite
thump, hook-set snap, drag buzz rising with tension, line snap, splash/jump, catch chime, outboard drone during runs,
weigh-in digit ticks, crowd cheer and a short fanfare.

## 9. Accessibility

Keyboard-only play for every screen and the whole fishing loop. Text contrast ≥ 4.5:1 (shared tokens). Colorblind-
safe cues: the tension band uses hatching and labels (SLACK / GOOD / DANGER) plus position, the bite uses a "!"
badge, line twitch, sound and an aria-live announcement. `prefers-reduced-motion` (and a setting) removes camera
shake, ripples and tweens. Text size 100/115/130%. Assist mode: automatic hook-set, wider tension band, longer slack
timer. Light and dark themes from the system with a manual override.

## 10. Mobile and touch

Portrait-first layout at 390 × 844: the lake map rotates to fill the screen; spot view with a large action button
(≥ 64 px) and all controls ≥ 44 px; no horizontal scroll. Landscape desktop at 1280 × 800.

## 11. Performance budgets

60 fps on a mid-range laptop while fishing (≥ 55 in the harness), idle loop stopped on menus, HTML ≤ 2 MB,
interactive (hooks present) in ≤ 2 s, heap < 40 MB.

## 12. Save / load

`localStorage` (try/catch): settings, money, upgrades, campaign progress, journal, records, and a resumable event.
Works with storage blocked (no crash, progress kept for the session).

## 13. Acceptance criteria

**Structure and modes**
- AC1 Title screen shows the game name, Campaign, Quick Tournament, Free Fish, Journal, How to Play, Settings, and a Dock Note with its source.
- AC2 Campaign River Chain shows Catherine, Hamilton, Ouachita and DeGray with dam names and years; locked gates state the finish needed.
- AC3 Quick Tournament and Free Fish setup let the player pick lake, month and (Quick) tier.
- AC4 The briefing shows format, hours, limit, weather, air temps from normals, water temp labeled "est." and the lake card facts.

**Map and day**
- AC5 Each lake renders as a distinct code-drawn map with depth bands, its dam, its fictional ramp and named spots.
- AC6 Selecting a spot (click, tap or keyboard) opens a card with structure, depth, cover and run time; running moves the boat and advances the clock by the run cost.
- AC7 On Ouachita, brush piles between Island Markers 28–36 are hidden until revealed by sonar or scanning.
- AC8 The HUD shows clock, check-in, run time home, livewell count/weight, weather and water temperature (est.).

**Fishing loop**
- AC9 Casting with mouse (press-drag-release), touch, and keyboard (arrows + Space) lands the lure near the aim, scaled by accuracy-ring timing.
- AC10 Holding reel retrieves the lure; lure depth follows its type and speed and is shown on the sonar strip.
- AC11 A bite shows a "!" badge, line twitch, sound and live-region text; setting within the window hooks the fish, otherwise it is missed.
- AC12 The fight uses the tension band: sustained DANGER snaps the line, sustained SLACK throws the hook, jumps punish too much and too little tension, side pressure tires the fish faster; reeling inside the band lands it.
- AC13 Non-weedless lures snag in brush/laydowns/rock and treble lures foul in grass, costing time.
- AC14 A catch card shows the drawn species, weight in lb-oz and keep/release/cull options.

**Fish model**
- AC15 Only corpus-listed species appear on each lake (e.g., no trout on Ouachita, pike/muskie only on DeGray, smallmouth only on Ouachita).
- AC16 Spawn ladder: in spring windows, crappie then bass then bream are shallow; outside their windows they are deep or on brush; catfish spawn warmest.
- AC17 Summer heat makes deep spots outfish shallow ones at midday; low light boosts topwater.
- AC18 Hamilton in May: post-spawn largemouth on brush/docks, and the green-pumpkin Texas-rigged craw raises kicker odds.
- AC19 Water clarity changes which colors work (natural in clear, bright/dark in muddy).
- AC20 Spot pressure lowers bite odds after repeated catches and recovers over time.
- AC21 Trout appear only in the Catherine tailrace in season (mid-Nov–Apr), and generation closes the tailrace and scatters trout.
- AC22 Eagles (Dec–Feb, Ouachita/DeGray) circle a spot and raise bite odds there.
- AC23 Ouachita grass beds and brush piles behave as in AC13 and the slow-retrieve brush bonus applies.

**Rules and weigh-in**
- AC24 Tournament livewell holds 5 bass with culling; pairs add partner fish.
- AC25 Free Fish enforces 10 black bass (≤ 4 smallmouth) and 30 crappie and runs a warden check.
- AC26 Late check-in costs 1 lb per minute and over 15 minutes disqualifies.
- AC27 The weigh-in animates the bag on a neon-digit scoreboard and ranks the field; ties break by big fish; two-day totals.
- AC28 The AI field is calibrated: mean winners ≈ 17 lb club, ≈ 18 lb regional, ≈ 27 lb two-day finale (± 12%).
- AC29 No real tournament angler, record holder or quoted private person appears; angler names pass the banned list.
- AC30 Weather follows the month's normals; snow days (Dec–Feb, rare) close the ramps and move the event.

**Campaign and progression**
- AC31 Meeting a gate's finish opens the next lake; missing it offers a retry.
- AC32 Payouts add money; the shop sells the four upgrades and lures; each upgrade has its stated effect.
- AC33 The striper stocking choice after Ch. 3 changes striper abundance on Ouachita.
- AC34 Finishing Ch. 4 shows a satisfying end screen (trophy for a win, placement otherwise) and the DeGray derby is playable after Ch. 1.
- AC35 The journal records species (count and best), events seen, the state-record board with the certification rule, and Dock Notes read.

**Presentation and access**
- AC36 Help explains the loop, controls for mouse/touch/keyboard, rules and which values are game estimates.
- AC37 Settings: sound on/off and volume, motion, text size, assist mode, theme, units; persisted.
- AC38 Keyboard-only: a full tournament day from title to weigh-in.
- AC39 Text contrast ≥ 4.5:1 in light and dark themes.
- AC40 Reduced motion removes ripples, shake and tweens without breaking play.
- AC41 Text size 130% keeps layouts without overflow at both viewports.
- AC42 Touch: all controls ≥ 44 px on mobile, big action button, map tap and spot-view touch play work.
- AC43 Works with storage blocked; progress saves and reloads when storage works; resume an interrupted event.
- AC44 Zero network requests, zero console errors.
- AC45 Performance: fishing ≥ 55 fps, menus idle (loop stopped), HTML ≤ 2 MB, hooks ≤ 2 s, heap < 40 MB.
- AC46 Juice: cast arc, splash ripples, line sag, jump splash, catch chime, weigh-in fanfare and confetti on a win.

## 14. Out of scope

Multiplayer and online leaderboards; real-time 3D; real marina names or real lake outlines traced from maps;
lake-specific length/slot limits (unsourced); per-lake records; trout limits; boat damage; fuel; licenses; live-bait
keeping; fly-casting physics; night tournaments; the hunting/foraging and Geo-Float crystal quest beyond a journal
entry; weed-management quest; striper/"Big Bass" events as real formats (the DeGray derby is fictional).
