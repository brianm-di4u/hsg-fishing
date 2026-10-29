# Geodata sources (real lake maps)

All four lake maps, the 3D terrain and the structures placed on them come from U.S. federal datasets, which are
public domain. `tools/geo/fetch.mjs` downloads them to `research/geo/raw/` (git-ignored, about 15 MB) and
`tools/geo/bake.mjs` turns them into `data/geo/<lake>.json` (about 290 KB for all four, inlined into the game).
Re-run both to refresh. Frames (the lon/lat box of each map) are in `tools/geo/lakes-geo.mjs`.

| Data | Dataset and service | Used for |
|---|---|---|
| Lake outlines and islands | USGS National Hydrography Dataset (NHD), Waterbody – Large Scale (layer 12), `hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer` | the navigable water mask (800 × 500 cells, 13–38 m each), island holes, other water drawn but not fishable |
| Named creeks | NHD Flowline – Large Scale (layer 6), features with a GNIS name | creek mouths (Hot Springs Creek, Gulpha Creek, Mazarn Creek, Irons Fork, Caddo River…) |
| Dam lines | NHD Line – Large Scale (layer 2), FType 343 (Dam/Weir) | Carpenter Dam and Remmel Dam crest lines; Blakely Mountain and DeGray dams fall back to the narrowest crossing at the polygon's end |
| Terrain | USGS 3D Elevation Program (3DEP) seamless DEM, `elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer` (exportImage, float32) | 3D terrain and hillshade, 400 × 250 samples per lake, stored as height above the lake's pool |
| Roads and bridges | USGS National Transportation Dataset (from U.S. Census TIGER and others), `carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer` layers 29–31 | bridges where a road crosses the lake (AR 7 Central Ave and Airport Rd on Hamilton, US 270 on Ouachita, Carpenter Dam Rd on Catherine) |
| Coordinates of dams and parks | Wikipedia infoboxes (facts), cross-checked against NHD | Carpenter Dam 34°26′32″N 93°01′33″W; Remmel Dam 34°25′37″N 92°53′38″W; Blakely Mountain Dam 34°34′21″N 93°11′39″W; Garvan Woodland Gardens 34.4347 N 93.0456 W; Lake Catherine State Park 34.4379 N 92.9180 W; Lake Ouachita State Park 34.6186 N 93.1773 W; DeGray Lake Resort State Park 34.2457 N 93.1479 W; Couchwood 34.4483 N 92.9147 W; Mountain Pine 34.5694 N 93.1725 W |

## What is real and what is estimated

- **Real:** shorelines, islands, coves and creek arms; terrain heights; dam positions; bridges; creek names; landmark
  positions. Areas from the NHD polygons (inside each map frame): Catherine 1,527 acres, Hamilton 6,331 acres
  (the frame crops the narrow upper river), Ouachita 38,115 acres, DeGray 11,482 acres. The sourced figures the game
  shows (1,940 / about 7,200 / about 40,000 / about 13,800 acres) are at full pool and include water outside the frames.
- **Estimated (game logic):** water depths. No public bathymetry was found for these lakes, so depth grows with
  distance from shore and toward the dam, scaled to each lake's maximum depth. The map and HUD label depths as estimates.
- **Placed by hand:** fishing spots, ramps and the hatchery are put on real features of the right type (a point, a cove,
  the dam face); their names stay fictional except where they name a real feature (Hot Springs Creek Mouth, Garvan
  Point, Brushy Creek Hump, Irons Fork Channel, the dam riprap spots). Placements are in `tools/geo/placements.json`;
  `tools/geo/place.mjs` checks them with the game's own code and renders `research/geo/preview-<lake>.png`.
- Ouachita's island marker numbers 28–36 are sourced as the brush-pile zone; which island carries which number is game
  numbering.
