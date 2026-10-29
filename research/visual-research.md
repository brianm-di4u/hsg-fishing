# Visual research: Ouachita Bass Classic 3D pass

What the 3D scenes model, and where each choice comes from. Geodata sources are in `research/geo/SOURCES.md`.
Facts marked *(corpus)* come from the shared `research/` files via `research/town-content.md`; *(Wikipedia)* facts were
read from the article or its infobox in October 2026. Anything marked **game** is an artistic or design choice.

## Dams (modelled at the riprap and tailrace spots, and on the 3D maps)

| Dam | Lake | Type modelled | Size used | Source |
|---|---|---|---|---|
| Carpenter Dam (1929–1931) | Hamilton | concrete gravity dam with a gated spillway crest and a powerhouse; turbine outlets on the tailrace side | about 100 ft high *(corpus)*; crest about 330 m from the NHD dam line | *(corpus)*, NHD Line FType 343 |
| Remmel Dam (1924) | Catherine | Ambursen flat-slab buttress dam: a sloping concrete deck on a row of buttresses | crest 230 m from the NHD dam line; height **game** (about 21 m, not sourced) | *(corpus)* "concrete-and-steel Ambursen flat-slab buttress dam"; NHD |
| Blakely Mountain Dam (1948–1953) | Ouachita | earth and rock embankment with a riprap upstream face and a crest road | 231 ft (70 m) tall, 1,100 ft (340 m) crest | *(Wikipedia, Lake Ouachita)*; *(corpus)* 231 ft |
| DeGray Dam (1962–1972) | DeGray | earth embankment with a riprap face and a crest road | height **game** (about 74 m), not sourced | *(corpus)* dates; type from aerial imagery is not used — **game** |

Map heights are exaggerated ×3 like the terrain, so dams read from the air.

## Forest and shore

- **Shortleaf pine–oak forest.** The Ouachita Mountains' forest is a mix of shortleaf pine (*Pinus echinata*) with oaks
  and hickories; eastern redcedar is common on dry sites and is what AGFC sinks for brush piles *(corpus: "cedar brush
  piles")*. The spot scenes mix pines (tall bare trunks, high clumped crowns), round-crowned hardwoods, cedars and
  understory bushes. Pine share and density are **game** values.
- **Seasons.** Spring (Mar–Apr) adds white and pink flecks for dogwood and redbud, both widespread Ouachita understory
  trees; October shows early color among green pines; November peaks gold and rust; December–February leaves the
  hardwoods grey-brown with the pines green. Exact timing is **game**.
- **Rock.** The Ouachitas' signature rock is novaculite (a hard, pale chert) with shale and sandstone *(corpus,
  style guide "novaculite-white rock edges")*. Banks use red clay near the waterline, pale novaculite and grey shale
  on points and dams.
- **Lake Hamilton's developed shore.** Hamilton is lined with private docks and covered boathouses *(corpus: "a
  docks-and-brush-pile largemouth lake")*; dock spots show covered boathouses on pilings with walkways to the bank.
  Roof colors and lifts are **game**.
- **Water clarity.** The sim's clarity drives how far you see into the water: clear (Ouachita, DeGray) about 4 m,
  stained (Catherine, Hamilton) about 1.6 m, muddy after spring storms about 0.5 m *(corpus: Ouachita "deep, clear and
  low in nutrients"; muddy water after May storms [inferred])*. The visibility distances are **game**.

## Light and weather

- **Sun position** is computed for 34.5° N from the game's own sunrise and sunset times (the sim already uses this
  latitude) and the day of year, so a January sun stays low in the south and a June noon sun is nearly overhead.
- **Weather** comes from the sim (clear, partly, overcast, rain, storm, snow). Cold-month mornings add mist on the water;
  rain adds streaks and rings; storms darken the sky.
- **Garvan Holiday Lights** (Hamilton, mid-November through December) *(corpus)* glow on the map after dark.

## Fish plates

Twenty species plates were painted with OpenAI image generation (Codex) as field-guide-style side views, each prompt
naming the species' identifying marks (for example, the largemouth's upper jaw extending past the eye, the bluegill's
solid black ear flap, the redear's red-orange rim, the walleye's white lower tail tip, the rainbow trout's pink band
and spotted tail). The plates are original images; the marks were checked by eye against the prompts. The "gar" plate
shows a spotted gar.
