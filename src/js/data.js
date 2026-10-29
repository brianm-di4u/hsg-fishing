// Game data. Facts come from research/ (see research/town-content.md); everything marked "game" is design.

// Hot Springs ASOS monthly normals: hi/lo °F, precip in (geography-lakes-mountains.md → Climate).
export const CLIMATE = [
  { m: 'Jan', hi: 53.4, lo: 32.2, p: 2.9 }, { m: 'Feb', hi: 56.4, lo: 35.3, p: 4.3 }, { m: 'Mar', hi: 66.7, lo: 44.3, p: 5.0 },
  { m: 'Apr', hi: 74.4, lo: 51.8, p: 5.9 }, { m: 'May', hi: 81.5, lo: 61.0, p: 6.3 }, { m: 'Jun', hi: 90.6, lo: 69.9, p: 4.0 },
  { m: 'Jul', hi: 93.3, lo: 72.6, p: 4.0 }, { m: 'Aug', hi: 92.8, lo: 71.7, p: 3.7 }, { m: 'Sep', hi: 86.7, lo: 64.8, p: 4.0 },
  { m: 'Oct', hi: 75.4, lo: 52.5, p: 4.3 }, { m: 'Nov', hi: 64.1, lo: 41.9, p: 3.6 }, { m: 'Dec', hi: 55.4, lo: 35.3, p: 4.8 },
];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Spot types: shore = drawn with a shoreline in spot view; hab = habitat key used by the fish model.
export const SPOT_TYPES = {
  ramp: { label: 'Launch ramp', shore: true, hab: 'shallow', cover: ['rock'] },
  cove: { label: 'Cove', shore: true, hab: 'shallow', cover: ['laydown'] },
  flat: { label: 'Flat', shore: true, hab: 'shallow', cover: ['stumps'] },
  docks: { label: 'Boat docks', shore: true, hab: 'docks', cover: ['dock'] },
  point: { label: 'Main-lake point', shore: true, hab: 'point', cover: ['rock'] },
  brush: { label: 'Brush pile', shore: false, hab: 'brush', cover: ['brush'] },
  grass: { label: 'Grass bed', shore: true, hab: 'grass', cover: ['grass'] },
  channel: { label: 'Channel ledge', shore: false, hab: 'channel', cover: ['ledge'] },
  riprap: { label: 'Dam riprap', shore: true, hab: 'riprap', cover: ['rock'] },
  tailrace: { label: 'Tailrace', shore: true, hab: 'tailrace', cover: ['current', 'rock'] },
  creek: { label: 'Creek mouth', shore: true, hab: 'creek', cover: ['current', 'laydown'] },
  island: { label: 'Island point', shore: true, hab: 'island', cover: ['rock', 'brush'] },
  open: { label: 'Open-water hump', shore: false, hab: 'open', cover: [] },
};

// Lakes: geometry in a 1000×625 lake space (stylized spines and islands, not traced outlines).
// w = half-width at each spine vertex. Spot names, ramps and events are fictional (town-content §7).
export const LAKES = {
  catherine: {
    id: 'catherine', name: 'Lake Catherine', short: 'Catherine', miles: 7, depthScale: 70, maxDepth: 40, order: 1,
    acres: '1,940 acres', dam: 'Remmel Dam', damYear: 1924, river: 'Ouachita River', seed: 11, amp: 14, clarity: 'stained',
    ramp: { name: 'Redbud Landing', x: 590, y: 318 },
    spines: [
      { pts: [[30, 330], [150, 304], [260, 330], [360, 292], [470, 318], [560, 284], [660, 318], [760, 300], [860, 338], [948, 322]], w: [12, 22, 38, 50, 62, 70, 76, 80, 72, 54] },
      { pts: [[470, 318], [500, 226], [540, 150]], w: [40, 28, 16] },
      { pts: [[700, 318], [722, 420], [700, 506]], w: [48, 34, 18] },
      { pts: [[300, 304], [282, 232]], w: [26, 15] },
      { pts: [[860, 338], [884, 442]], w: [38, 20] },
    ],
    islands: [[612, 330, 12], [790, 290, 9]],
    damPos: [962, 322], damSide: 'e', upstream: { label: 'Carpenter Dam', x: 12, y: 330 },
    landmarks: [
      { id: 'carpenter', label: 'Carpenter Dam', x: 22, y: 336, kind: 'dam', text: 'Carpenter Dam (1931) holds back Lake Hamilton. Its tailrace is the head of Lake Catherine and a winter rainbow trout fishery. Check the generation board before fishing it.' },
      { id: 'remmel', label: 'Remmel Dam', x: 958, y: 470, kind: 'dam', text: 'Remmel Dam, built in 1924 by Ford, Bacon & Davis with Ambursen Construction, is a concrete-and-steel Ambursen flat-slab buttress dam.' },
      { id: 'lcsp', label: 'Lake Catherine State Park', x: 792, y: 385, kind: 'park', text: 'Established in 1935 and built by the Civilian Conservation Corps, with CCC stone-and-wood cabins, trails and a marina.' },
      { id: 'couchwood', label: 'Couchwood', x: 815, y: 297, kind: 'house', text: 'Couchwood, the lakeshore estate of Harvey Couch, the power-company founder whose daughter Catherine gave the lake its name.' },
    ],
    spots: [
      { id: 'c-tail', name: 'Carpenter Dam Tailrace', type: 'tailrace', x: 40, y: 345, depth: 8 },
      { id: 'c-gravel', name: 'Gravel Bar Run', type: 'flat', x: 150, y: 343, depth: 6 },
      { id: 'c-laydown', name: 'Laydown Pocket', type: 'cove', x: 330, y: 445, depth: 5 },
      { id: 'c-bluff', name: 'Bluff Bank Bend', type: 'point', x: 300, y: 352, depth: 14 },
      { id: 'c-docks', name: 'Couch Cove Docks', type: 'docks', x: 842, y: 300, depth: 9 },
      { id: 'c-channel', name: 'Mid-Lake Channel Swing', type: 'channel', x: 620, y: 302, depth: 26 },
      { id: 'c-ccc', name: 'Cabin Cove Brush', type: 'cove', x: 822, y: 402, depth: 7 },
      { id: 'c-stump', name: 'Stump Flat', type: 'flat', x: 902, y: 440, depth: 4 },
      { id: 'c-riprap', name: 'Remmel Riprap', type: 'riprap', x: 944, y: 478, depth: 22 },
    ],
    facts: [
      'About 1,940 acres, impounded by Remmel Dam (1924) on the Ouachita River.',
      'Named for Catherine, daughter of power-company founder Harvey Couch.',
      'Its head is the Carpenter Dam tailrace, stocked with rainbow trout in winter.',
      'Species beyond the trout follow the Ouachita River list (black bass, white bass, bream, drum, gar): the lake itself has no species survey in our sources.',
    ],
  },
  hamilton: {
    id: 'hamilton', name: 'Lake Hamilton', short: 'Hamilton', miles: 12, depthScale: 110, maxDepth: 60, order: 2,
    acres: 'about 7,200 acres', dam: 'Carpenter Dam', damYear: 1931, river: 'Ouachita River', seed: 23, amp: 16, clarity: 'stained',
    ramp: { name: 'Dogwood Cove Ramp', x: 700, y: 392 },
    spines: [
      { pts: [[30, 182], [140, 218], [232, 190], [330, 250], [420, 232], [500, 300], [600, 282], [700, 330], [800, 300], [900, 340], [952, 330]], w: [14, 28, 42, 50, 56, 64, 70, 74, 70, 64, 46] },
      { pts: [[420, 232], [442, 140], [470, 56]], w: [42, 28, 12] },
      { pts: [[700, 330], [688, 440], [622, 524]], w: [50, 40, 26] },
      { pts: [[800, 300], [850, 420], [830, 530]], w: [50, 38, 22] },
      { pts: [[330, 250], [318, 362], [262, 440]], w: [42, 32, 18] },
      { pts: [[600, 282], [622, 180]], w: [32, 16] },
      { pts: [[232, 190], [204, 100]], w: [28, 13] },
      { pts: [[900, 340], [928, 232]], w: [32, 16] },
    ],
    islands: [[560, 300, 10], [150, 222, 7]],
    damPos: [966, 330], damSide: 'e', upstream: { label: 'Blakely Mountain Dam', x: 10, y: 182 },
    landmarks: [
      { id: 'carpenter', label: 'Carpenter Dam', x: 958, y: 385, kind: 'dam', text: 'Carpenter Dam, begun by Arkansas Power & Light in 1929 and completed in 1931, is a concrete gravity dam about 100 ft high. It is named for Flavius Josephus Carpenter; the lake is named for Hamilton Moses of AP&L.' },
      { id: 'garvan', label: 'Garvan Woodland Gardens', x: 864, y: 438, kind: 'garden', text: 'A 210-acre garden on a peninsula with 4.5 miles of Lake Hamilton shoreline, owned by the University of Arkansas. Its Holiday Lights run from mid-November through December.' },
      { id: 'hatchery', label: 'Andrew Hulsey Hatchery', x: 430, y: 470, kind: 'hatchery', text: 'The AGFC Andrew Hulsey State Fish Hatchery is on Lake Hamilton. It stocked 662 surplus Florida-strain largemouth from its broodstock ponds into the lake. (Map position is approximate.)' },
      { id: 'hotsprings', label: 'Hot Springs', x: 816, y: 22, kind: 'town', text: 'Hot Springs, home of Bathhouse Row and Hot Springs National Park, sits just north of the lake. Hot Springs Creek runs from downtown under Bathhouse Row and empties into Lake Hamilton.' },
      { id: 'creek', label: 'Hot Springs Creek', x: 870, y: 268, kind: 'creek', text: 'Hot Springs Creek flows under Bathhouse Row and empties into Lake Hamilton.' },
    ],
    spots: [
      { id: 'h-upper', name: 'Upper River Bend', type: 'flat', x: 270, y: 148, depth: 7 },
      { id: 'h-hatch', name: 'Hatchery Cove Brush', type: 'brush', x: 455, y: 445, depth: 16 },
      { id: 'h-creek', name: 'Hot Springs Creek Mouth', type: 'creek', x: 866, y: 292, depth: 6 },
      { id: 'h-docks', name: 'Boathouse Row Docks', type: 'docks', x: 612, y: 455, depth: 10 },
      { id: 'h-hump', name: 'Sunken Brush Hump', type: 'brush', x: 800, y: 415, depth: 22 },
      { id: 'h-seawall', name: 'Seawall Pocket Docks', type: 'docks', x: 548, y: 300, depth: 8 },
      { id: 'h-garvan', name: 'Garvan Point', type: 'point', x: 850, y: 452, depth: 18 },
      { id: 'h-channel', name: 'Channel Ledge', type: 'channel', x: 900, y: 400, depth: 34 },
      { id: 'h-pine', name: 'Pine Shade Cove', type: 'cove', x: 750, y: 560, depth: 6 },
      { id: 'h-riprap', name: 'Carpenter Riprap', type: 'riprap', x: 948, y: 393, depth: 30 },
    ],
    facts: [
      'About 7,200 acres behind Carpenter Dam, completed in 1931; the lake formed in 1932.',
      'A docks-and-brush-pile largemouth lake with Florida-strain stocking from the Andrew Hulsey Hatchery.',
      'In May, big post-spawn females slide onto brush piles; an 11-lb club-tournament fish fell to a Texas-rigged craw in a green-pumpkin color in May 2024.',
      'Hot Springs Creek, the creek under Bathhouse Row, empties into the lake.',
    ],
  },
  ouachita: {
    id: 'ouachita', name: 'Lake Ouachita', short: 'Ouachita', miles: 22, depthScale: 260, maxDepth: 120, order: 3,
    acres: 'about 40,000 acres', dam: 'Blakely Mountain Dam', damYear: 1953, river: 'Ouachita River', seed: 37, amp: 22, clarity: 'clear',
    ramp: { name: 'Whetstone Point Ramp', x: 880, y: 410 },
    spines: [
      { pts: [[24, 300], [140, 282], [260, 318], [380, 292], [500, 310], [620, 292], [740, 320], [850, 302], [950, 330]], w: [26, 64, 92, 112, 128, 128, 112, 92, 56] },
      { pts: [[260, 318], [240, 170], [200, 64]], w: [64, 42, 20] },
      { pts: [[620, 292], [650, 150], [700, 56]], w: [64, 38, 18] },
      { pts: [[380, 292], [360, 460], [300, 560]], w: [74, 46, 22] },
      { pts: [[740, 320], [762, 470], [830, 560]], w: [64, 42, 18] },
      { pts: [[140, 282], [110, 420]], w: [42, 20] },
      { pts: [[850, 302], [880, 180]], w: [42, 20] },
    ],
    islandField: { n: 70, x0: 120, x1: 900, seed: 5 },
    islands: [[560, 232, 16], [500, 300, 14], [596, 300, 12], [650, 316, 13], [704, 296, 11], [540, 340, 10]],
    markers: { from: 20, to: 40 },
    damPos: [964, 330], damSide: 'e', upstream: { label: 'Ouachita River', x: 8, y: 300 },
    landmarks: [
      { id: 'blakely', label: 'Blakely Mountain Dam', x: 915, y: 443, kind: 'dam', text: 'The Army Corps of Engineers built the 231-ft Blakely Mountain Dam from 1948 to 1953. In the 1950s the lake flooded the communities of Buckville and Cedar Glades.' },
      { id: 'losp', label: 'Lake Ouachita State Park', x: 960, y: 306, kind: 'park', text: 'Established in 1953 and opened in 1955 on the east side of the lake, the park preserves the historic Three Sisters Springs.' },
      { id: 'pine', label: 'Mountain Pine', x: 972, y: 451, kind: 'town', text: 'Mountain Pine lies just southeast of the lake, below Blakely Mountain Dam.' },
      { id: 'geofloat', label: 'Geo-Float Trail', x: 560, y: 340, kind: 'crystal', text: 'Boaters follow the marked Geo-Float Trail. Wikipedia says the lake holds "one of the largest crystal veins in the world."' },
    ],
    spots: [
      { id: 'o-upper', name: 'Upper River Laydowns', type: 'cove', x: 90, y: 280, depth: 9 },
      { id: 'o-milfoil', name: 'Milfoil Flat', type: 'grass', x: 200, y: 275, depth: 8 },
      { id: 'o-long', name: 'Long Point', type: 'point', x: 380, y: 330, depth: 18 },
      { id: 'o-shad', name: 'Shad Flat', type: 'flat', x: 200, y: 470, depth: 10 },
      { id: 'o-main', name: 'Main Lake Channel', type: 'channel', x: 450, y: 370, depth: 68 },
      { id: 'o-geo', name: 'Geo-Float Island', type: 'island', x: 520, y: 360, depth: 12 },
      { id: 'o-p28', name: 'Marker 28 Saddle', type: 'brush', x: 480, y: 330, depth: 22, hidden: true, marker: 28 },
      { id: 'o-p30', name: 'Marker 30 Point', type: 'brush', x: 530, y: 345, depth: 24, hidden: true, marker: 30 },
      { id: 'o-p31', name: 'Marker 31 Saddle', type: 'brush', x: 580, y: 320, depth: 21, hidden: true, marker: 31 },
      { id: 'o-p33', name: 'Marker 33 Point', type: 'brush', x: 620, y: 350, depth: 23, hidden: true, marker: 33 },
      { id: 'o-p34', name: 'Marker 34 Hump', type: 'brush', x: 660, y: 330, depth: 25, hidden: true, marker: 34 },
      { id: 'o-p36', name: 'Marker 36 Saddle', type: 'brush', x: 700, y: 345, depth: 20, hidden: true, marker: 36 },
      { id: 'o-creek', name: 'Irons Fork Channel', type: 'channel', x: 470, y: 160, depth: 30 },
      { id: 'o-hydrilla', name: 'Hydrilla Cove', type: 'grass', x: 500, y: 500, depth: 7 },
      { id: 'o-dam', name: 'Dam Wall Deep', type: 'riprap', x: 905, y: 440, depth: 60 },
    ],
    facts: [
      'About 40,000 acres behind Blakely Mountain Dam (built 1948–1953), with about 200 islands. (One source says over 66,000 acres; we use the conservation-pool figure.)',
      'Deep, clear and low in nutrients. Stripers are stocked every year because they do not reproduce here; walleye now sustain themselves.',
      'AGFC and the Corps sank cedar brush piles at 20–25 ft, mostly between Island Markers 28 and 36, on main-lake points and saddles.',
      'Hydrilla and Eurasian watermilfoil cover about 10% of the lake. Harmless, non-stinging freshwater jellyfish live here too.',
    ],
  },
  degray: {
    id: 'degray', name: 'DeGray Lake', short: 'DeGray', miles: 14, depthScale: 240, maxDepth: 200, order: 4,
    acres: 'about 13,800 acres', dam: 'DeGray Dam', damYear: 1972, river: 'Caddo River', seed: 53, amp: 18, clarity: 'clear',
    ramp: { name: 'Caddo Bend Ramp', x: 560, y: 300 },
    spines: [
      { pts: [[30, 76], [150, 140], [260, 200], [360, 260], [480, 300], [600, 340], [720, 392], [840, 460], [944, 540]], w: [12, 28, 50, 70, 84, 94, 94, 80, 52] },
      { pts: [[360, 260], [420, 140], [470, 56]], w: [56, 32, 14] },
      { pts: [[600, 340], [560, 470], [480, 560]], w: [60, 38, 18] },
      { pts: [[720, 392], [800, 280], [870, 196]], w: [56, 38, 18] },
      { pts: [[480, 300], [380, 420]], w: [42, 20] },
    ],
    islands: [[700, 430, 14], [540, 360, 10], [430, 300, 8], [820, 480, 9]],
    damPos: [960, 556], damSide: 'se', upstream: { label: 'Caddo River', x: 10, y: 70 },
    landmarks: [
      { id: 'degraydam', label: 'DeGray Dam', x: 958, y: 492, kind: 'dam', text: 'The Corps of Engineers built DeGray Dam on the Caddo River from 1962 to 1972. Wikipedia calls DeGray the first "pump back capable" Corps impoundment; a 400-acre Lower Lake sits below the dam.' },
      { id: 'lodge', label: 'DeGray Lake Resort State Park', x: 827, y: 367, kind: 'park', text: 'Established in 1974 with a 94-room lodge and an 18-hole golf course. Its eagle tours run in January (Jan. 24, 2026: $14 adults, $8 ages 6–12), tied to the late-January Eagles Et Cetera festival.' },
      { id: 'caddo', label: 'Caddo River', x: 40, y: 225, kind: 'creek', text: 'The Caddo River feeds DeGray Lake, about eight miles above its confluence with the Ouachita.' },
    ],
    spots: [
      { id: 'd-caddo', name: 'Caddo River Mouth', type: 'creek', x: 60, y: 240, depth: 8 },
      { id: 'd-timber', name: 'Timber Cove', type: 'cove', x: 440, y: 175, depth: 8 },
      { id: 'd-brushy', name: 'Brushy Creek Hump', type: 'brush', x: 480, y: 410, depth: 20 },
      { id: 'd-flats', name: 'Hybrid Flats', type: 'open', x: 720, y: 380, depth: 18 },
      { id: 'd-stump', name: 'Stump Edge Cove', type: 'cove', x: 690, y: 440, depth: 9 },
      { id: 'd-channel', name: 'Channel Bend', type: 'channel', x: 620, y: 320, depth: 60 },
      { id: 'd-island', name: 'Island Point', type: 'island', x: 800, y: 380, depth: 14 },
      { id: 'd-lodge', name: 'Lodge Point', type: 'point', x: 830, y: 360, depth: 25 },
      { id: 'd-dam', name: 'Deep Dam Face', type: 'riprap', x: 958, y: 480, depth: 80 },
    ],
    facts: [
      'About 13,800 acres on the Caddo River, up to about 200 ft deep.',
      'Known for hybrid striped bass, plus crappie, largemouth and catfish. Northern pike and muskellunge were stocked as exotic species.',
      'Bald eagles winter here; the state park runs eagle tours in January.',
      'Wikipedia calls it the first "pump back capable" Corps of Engineers impoundment.',
    ],
  },
};
export const LAKE_IDS = ['catherine', 'hamilton', 'ouachita', 'degray'];

// Species. Weights, fight and art values are game estimates; spawn windows for crappie are sourced
// (56°F start, white 60–65, black 62–68), the others follow the sourced ordering (fish-and-wildlife.md).
export const SPECIES = {
  largemouth: { name: 'Largemouth bass', group: 'bass', bass: true, spawn: [62, 70], med: 2.3, sd: 0.5, max: 12.5, fight: 1.0, jumps: true,
    art: { len: 1, h: 0.36, base: '#4F6B35', back: '#2E4220', belly: '#E6DDB0', mark: 'stripe', mouth: 'big', tail: 'square', fin: '#5B7240' } },
  spotted: { name: 'Spotted bass', group: 'bass', bass: true, spawn: [62, 70], med: 1.5, sd: 0.38, max: 5.5, fight: 1.1, jumps: true,
    art: { len: 1, h: 0.33, base: '#6E7A3E', back: '#3E4A24', belly: '#EDE6C4', mark: 'spots', mouth: 'mid', tail: 'square', fin: '#7A7E48' } },
  smallmouth: { name: 'Smallmouth bass', group: 'bass', bass: true, small: true, spawn: [60, 68], med: 1.9, sd: 0.4, max: 6.5, fight: 1.3, jumps: true,
    art: { len: 1, h: 0.34, base: '#8A6B3A', back: '#5A4422', belly: '#E9DEC0', mark: 'bars', mouth: 'mid', tail: 'square', fin: '#9A7A44', eye: '#C8452B' } },
  whiteCrappie: { name: 'White crappie', group: 'crappie', crappie: true, spawn: [60, 65], med: 0.75, sd: 0.35, max: 3.2, fight: 0.6,
    art: { len: 0.9, h: 0.44, base: '#C9CFC4', back: '#5E6E62', belly: '#F1F2EC', mark: 'bars', mouth: 'big', tail: 'round', fin: '#8C9A8E' } },
  blackCrappie: { name: 'Black crappie', group: 'crappie', crappie: true, spawn: [62, 68], med: 0.8, sd: 0.35, max: 3.4, fight: 0.6,
    art: { len: 0.9, h: 0.48, base: '#9CA696', back: '#2B3328', belly: '#E4E6DC', mark: 'speckle', mouth: 'big', tail: 'round', fin: '#4E584A' } },
  bluegill: { name: 'Bluegill (bream)', group: 'bream', spawn: [68, 80], med: 0.32, sd: 0.32, max: 1.6, fight: 0.6,
    art: { len: 0.75, h: 0.6, base: '#5E7A6A', back: '#2E4A50', belly: '#E8A24A', mark: 'bars', mouth: 'small', tail: 'round', fin: '#4A6460', ear: '#1E2A30' } },
  redear: { name: 'Redear sunfish', group: 'bream', spawn: [68, 80], med: 0.5, sd: 0.32, max: 2.4, fight: 0.65,
    art: { len: 0.8, h: 0.56, base: '#9A9A5A', back: '#5A5E34', belly: '#EFD9A0', mark: 'speckle', mouth: 'small', tail: 'round', fin: '#7C7A48', ear: '#C8452B' } },
  channelCat: { name: 'Channel catfish', group: 'cat', spawn: [78, 86], med: 2.8, sd: 0.55, max: 22, fight: 1.1,
    art: { len: 1.15, h: 0.24, base: '#7E8A94', back: '#4A5560', belly: '#E8E8E2', mark: 'dots', mouth: 'whisker', tail: 'fork', fin: '#5E6A74' } },
  blueCat: { name: 'Blue catfish', group: 'cat', spawn: [78, 86], med: 5, sd: 0.65, max: 45, fight: 1.2,
    art: { len: 1.2, h: 0.26, base: '#6A8AA8', back: '#3E5A78', belly: '#EEF0F2', mark: 'none', mouth: 'whisker', tail: 'fork', fin: '#4E6A88' } },
  flathead: { name: 'Flathead catfish', group: 'cat', spawn: [78, 86], med: 6.5, sd: 0.65, max: 48, fight: 1.15,
    art: { len: 1.15, h: 0.25, base: '#9A8248', back: '#5E4A24', belly: '#EADFB8', mark: 'mottle', mouth: 'whisker', tail: 'square', fin: '#7A6434', flat: true } },
  striper: { name: 'Striped bass', group: 'temperate', spawn: [58, 66], med: 7, sd: 0.55, max: 38, fight: 1.4,
    art: { len: 1.2, h: 0.3, base: '#C4CCD0', back: '#40566A', belly: '#F4F6F6', mark: 'stripes', mouth: 'mid', tail: 'fork', fin: '#7C8C98' } },
  hybrid: { name: 'Hybrid striped bass', group: 'temperate', spawn: [58, 66], med: 3.6, sd: 0.5, max: 16, fight: 1.4,
    art: { len: 1.05, h: 0.36, base: '#C8CED0', back: '#4A5E70', belly: '#F4F6F6', mark: 'broken', mouth: 'mid', tail: 'fork', fin: '#7C8C98' } },
  whiteBass: { name: 'White bass', group: 'temperate', spawn: [58, 66], med: 1.1, sd: 0.32, max: 4, fight: 1.0,
    art: { len: 0.95, h: 0.4, base: '#D2D6D6', back: '#6A7A86', belly: '#F6F6F4', mark: 'thin', mouth: 'mid', tail: 'fork', fin: '#9AA6AE' } },
  yellowBass: { name: 'Yellow bass', group: 'temperate', spawn: [58, 66], med: 0.5, sd: 0.3, max: 2, fight: 0.8,
    art: { len: 0.85, h: 0.4, base: '#D8C27A', back: '#7A6A34', belly: '#F2E6B4', mark: 'broken', mouth: 'mid', tail: 'fork', fin: '#B0A060' } },
  walleye: { name: 'Walleye', group: 'walleye', spawn: [44, 50], med: 2.6, sd: 0.45, max: 13, fight: 0.85,
    art: { len: 1.15, h: 0.24, base: '#A8964E', back: '#5A5028', belly: '#F0EAD0', mark: 'mottle', mouth: 'mid', tail: 'fork', fin: '#8A7A40', eye: '#E8E0B0', whiteTip: true } },
  trout: { name: 'Rainbow trout', group: 'trout', spawn: [0, 0], med: 0.9, sd: 0.3, max: 5, fight: 0.85, jumps: true,
    art: { len: 1, h: 0.27, base: '#B8C4B4', back: '#5A7060', belly: '#F2EEE6', mark: 'rainbow', mouth: 'mid', tail: 'square', fin: '#9AA694' } },
  pike: { name: 'Northern pike', group: 'pike', spawn: [40, 48], med: 5.5, sd: 0.5, max: 20, fight: 1.3,
    art: { len: 1.35, h: 0.2, base: '#5E7A44', back: '#36481E', belly: '#E8E2C0', mark: 'ovals', mouth: 'duck', tail: 'fork', fin: '#7A6A34' } },
  muskie: { name: 'Muskellunge', group: 'pike', spawn: [48, 56], med: 9, sd: 0.5, max: 34, fight: 1.5,
    art: { len: 1.4, h: 0.21, base: '#9A9A6A', back: '#5A5A34', belly: '#EEEAD0', mark: 'bars', mouth: 'duck', tail: 'fork', fin: '#8A6A3A' } },
  drum: { name: 'Freshwater drum', group: 'rough', spawn: [66, 74], med: 2.2, sd: 0.5, max: 14, fight: 0.95,
    art: { len: 1, h: 0.42, base: '#B8BCB4', back: '#6A7068', belly: '#F0F0EA', mark: 'none', mouth: 'under', tail: 'round', fin: '#8A9086', hump: true } },
  gar: { name: 'Gar', group: 'rough', spawn: [68, 76], med: 5, sd: 0.55, max: 22, fight: 1.0, jumps: true,
    art: { len: 1.45, h: 0.14, base: '#8A8A5A', back: '#4E5030', belly: '#E6E2C4', mark: 'dots', mouth: 'snout', tail: 'round', fin: '#6E6A40' } },
};

// Lake abundance 0–1 (0 / missing = not sourced for that water). game: the values; sourced: which species.
export const ABUNDANCE = {
  catherine: { largemouth: 1, spotted: 0.7, whiteBass: 0.4, bluegill: 0.6, drum: 0.25, gar: 0.18, trout: 1 },
  hamilton: { largemouth: 1, spotted: 0.7, striper: 0.25, hybrid: 0.45, whiteBass: 0.6, yellowBass: 0.4, whiteCrappie: 0.7, blackCrappie: 0.6, bluegill: 0.9, channelCat: 0.7, blueCat: 0.45 },
  ouachita: { largemouth: 0.6, smallmouth: 0.4, spotted: 0.55, striper: 0.45, walleye: 0.6, whiteCrappie: 0.7, bluegill: 0.8, channelCat: 0.6 },
  degray: { largemouth: 0.9, hybrid: 0.9, whiteBass: 0.7, walleye: 0.5, whiteCrappie: 0.8, bluegill: 0.75, redear: 0.5, channelCat: 0.7, blueCat: 0.45, flathead: 0.4, pike: 0.12, muskie: 0.07 },
};

// Habitat fit by group → phase → { d: [lo, hi] depth band ft, h: habitat weights }. game logic.
const BASS_H = {
  winter: { d: [18, 34], h: { channel: 1, riprap: 0.9, point: 0.8, brush: 0.9, island: 0.6, open: 0.3, grass: 0.4, creek: 0.3, docks: 0.35, shallow: 0.25 } },
  prespawn: { d: [6, 15], h: { point: 1, brush: 0.7, channel: 0.6, riprap: 0.7, island: 0.85, creek: 0.75, grass: 0.8, docks: 0.7, shallow: 0.6, open: 0.3 } },
  spawn: { d: [1, 6], h: { shallow: 1, docks: 0.95, grass: 0.9, creek: 0.8, island: 0.6, point: 0.5, brush: 0.3, riprap: 0.3, channel: 0.1, open: 0.1 } },
  postspawn: { d: [8, 22], h: { brush: 1, docks: 0.9, point: 0.9, island: 0.75, grass: 0.7, riprap: 0.6, channel: 0.5, shallow: 0.45, creek: 0.5, open: 0.4 } },
  summer: { d: [16, 30], h: { brush: 1, channel: 0.9, point: 0.9, riprap: 0.8, island: 0.75, grass: 0.7, docks: 0.6, open: 0.5, creek: 0.4, shallow: 0.3 } },
  fall: { d: [4, 15], h: { point: 1, creek: 0.9, shallow: 0.8, grass: 0.85, island: 0.85, riprap: 0.7, brush: 0.6, docks: 0.6, channel: 0.4, open: 0.4 } },
};
export const HABITAT = {
  bass: BASS_H,
  crappie: {
    winter: { d: [18, 30], h: { brush: 1, channel: 0.6, docks: 0.5, point: 0.4, island: 0.4 } },
    prespawn: { d: [8, 16], h: { brush: 1, docks: 0.8, creek: 0.6, point: 0.5, shallow: 0.4 } },
    spawn: { d: [1, 6], h: { shallow: 1, docks: 0.9, creek: 0.8, grass: 0.6, brush: 0.5 } },
    postspawn: { d: [12, 24], h: { brush: 1, docks: 0.7, channel: 0.5, point: 0.4 } },
    summer: { d: [15, 25], h: { brush: 1, docks: 0.6, channel: 0.5, point: 0.3 } },
    fall: { d: [10, 20], h: { brush: 1, docks: 0.8, creek: 0.5, point: 0.4 } },
  },
  bream: {
    spawn: { d: [1, 5], h: { shallow: 1, grass: 0.9, docks: 0.8, creek: 0.6 } },
    other: { d: [5, 14], h: { docks: 0.9, grass: 0.9, brush: 0.8, shallow: 0.7, point: 0.4, creek: 0.5 } },
  },
  cat: {
    spawn: { d: [3, 10], h: { riprap: 1, shallow: 0.7, docks: 0.5, creek: 0.6, tailrace: 0.5 } },
    other: { d: [15, 35], h: { channel: 1, brush: 0.8, riprap: 0.7, creek: 0.6, point: 0.5, tailrace: 0.4 } },
  },
  temperate: {
    summer: { d: [25, 45], h: { channel: 1, open: 1, riprap: 0.9, point: 0.6 } },
    other: { d: [8, 28], h: { point: 1, channel: 1, open: 1, riprap: 0.8, creek: 0.7, island: 0.7, tailrace: 0.3 } },
  },
  walleye: { other: { d: [15, 30], h: { brush: 1, point: 0.8, channel: 0.7, riprap: 0.7, island: 0.6 } } },
  trout: { other: { d: [2, 10], h: { tailrace: 1 } } },
  pike: { other: { d: [4, 14], h: { grass: 1, shallow: 0.9, creek: 0.7, point: 0.6, island: 0.5 } } },
  rough: { other: { d: [6, 20], h: { channel: 0.8, shallow: 0.8, creek: 1, flat: 0.8, riprap: 0.5, tailrace: 0.6 } } },
};
// Speed preference per phase or group (slow, med, fast). game logic.
export const SPEED_PREF = {
  winter: [1.3, 0.8, 0.4], prespawn: [1.1, 1, 0.7], spawn: [1.3, 0.85, 0.5], postspawn: [1.1, 1, 0.8],
  summer: [0.9, 1.1, 1], fall: [0.7, 1.1, 1.3], crappie: [1.3, 0.9, 0.4], trout: [1.3, 0.8, 0.4],
  temperate: [0.6, 1, 1.35], bait: [1.2, 0.7, 0.3],
};
export const SPEEDS = { slow: 3, med: 5, fast: 8 }; // ft/s while reeling

// Lures (generic names). aff = affinity per group; kind drives depth physics.
export const LURES = {
  craw: { name: 'Craw worm, Texas rig', short: 'Craw worm', kind: 'bottom', weedless: true, size: 1.0, colors: ['green pumpkin', 'black/blue', 'red craw'],
    aff: { bass: 1, crappie: 0.1, bream: 0.15, cat: 0.3, temperate: 0.15, walleye: 0.3, pike: 0.3, rough: 0.3 }, tip: 'Weedless. Crawl it through brush and grass on the bottom.' },
  jig: { name: 'Jig and craw trailer', short: 'Jig', kind: 'bottom', weedless: true, size: 1.15, colors: ['green pumpkin', 'black/blue'],
    aff: { bass: 0.9, crappie: 0.2, cat: 0.3, temperate: 0.2, walleye: 0.4, pike: 0.4, rough: 0.2 }, tip: 'Weed guard. Fewer bites, bigger fish.' },
  crankS: { name: 'Shallow crankbait (4 ft)', short: 'Shallow crank', kind: 'crank', dive: 4, treble: true, size: 1.0, colors: ['shad', 'chartreuse', 'red craw'],
    aff: { bass: 0.85, crappie: 0.3, bream: 0.1, cat: 0.1, temperate: 0.6, walleye: 0.6, pike: 0.7, rough: 0.3 }, tip: 'Treble hooks: snags brush, fouls in grass. Dives to about 4 ft.' },
  crankD: { name: 'Deep crankbait (14 ft)', short: 'Deep crank', kind: 'crank', dive: 14, treble: true, size: 1.05, colors: ['shad', 'chartreuse', 'red craw'],
    aff: { bass: 0.8, crappie: 0.3, cat: 0.15, temperate: 0.6, walleye: 0.8, pike: 0.5, rough: 0.3 }, tip: 'Dives to about 14 ft on a long, steady retrieve.' },
  spinner: { name: 'Spinnerbait', short: 'Spinnerbait', kind: 'spinner', weedless: true, size: 1.0, colors: ['chartreuse', 'shad', 'black/blue'],
    aff: { bass: 0.85, crappie: 0.35, bream: 0.2, temperate: 0.6, walleye: 0.3, pike: 1, rough: 0.2 }, tip: 'Flash and thump for stained or muddy water. Slow runs deeper.' },
  popper: { name: 'Topwater popper', short: 'Popper', kind: 'top', treble: true, size: 0.95, colors: ['shad', 'chartreuse', 'black/blue'],
    aff: { bass: 0.8, bream: 0.5, temperate: 0.7, pike: 0.6, rough: 0.3 }, tip: 'Surface bait for low light, overcast skies and shallow fish.' },
  dropshot: { name: 'Drop-shot finesse worm', short: 'Drop-shot', kind: 'bottom', single: true, size: 0.9, colors: ['green pumpkin', 'shad'],
    aff: { bass: 0.95, crappie: 0.4, bream: 0.4, walleye: 0.6, temperate: 0.3, cat: 0.2 }, tip: 'Finesse for deep, clear water. More bites, smaller fish.' },
  jerk: { name: 'Suspending jerkbait', short: 'Jerkbait', kind: 'jerk', treble: true, size: 1.0, colors: ['shad', 'chartreuse'],
    aff: { bass: 0.75, temperate: 0.7, walleye: 0.6, pike: 0.8, crappie: 0.3 }, tip: 'Hangs at about 5 ft. Pause it, or twitch it with a quick tap (Enter on a keyboard).' },
  swim: { name: 'Swimbait', short: 'Swimbait', kind: 'swim', weedless: true, size: 1.25, colors: ['shad', 'chartreuse'],
    aff: { bass: 0.7, temperate: 1, pike: 0.85, walleye: 0.4, cat: 0.1 }, tip: 'Big profile for stripers, hybrids and big bass in open water.' },
  tube: { name: 'Crappie tube jig', short: 'Tube jig', kind: 'tube', single: true, size: 0.7, colors: ['chartreuse', 'shad', 'black/blue'],
    aff: { crappie: 1, bream: 0.6, bass: 0.35, temperate: 0.5, walleye: 0.3, trout: 0.3 }, tip: 'Small jig for crappie and bream around brush.' },
  crawler: { name: 'Nightcrawler rig', short: 'Nightcrawler', kind: 'bait', single: true, size: 0.85, colors: ['natural'],
    aff: { bass: 0.4, crappie: 0.3, bream: 1, cat: 1, temperate: 0.3, walleye: 0.8, trout: 0.9, rough: 1 }, tip: 'Live bait. Everything eats it; let it sit.' },
  dough: { name: 'Trout dough bait', short: 'Dough bait', kind: 'bait', single: true, size: 0.7, colors: ['natural'],
    aff: { trout: 1, cat: 0.8, bream: 0.2 }, tip: 'Floating dough for stocked rainbow trout below the dam.' },
  waxworm: { name: 'Waxworm', short: 'Waxworm', kind: 'bait', single: true, size: 0.6, colors: ['natural'],
    aff: { trout: 0.9, bream: 0.9, crappie: 0.5 }, tip: 'Small live bait for trout and bream.' },
  eggfly: { name: 'Egg-pattern fly', short: 'Egg fly', kind: 'bait', single: true, size: 0.6, colors: ['natural'],
    aff: { trout: 1 }, tip: 'Drift it in the tailrace current for trout.' },
};
export const LURE_IDS = Object.keys(LURES);
export const START_LURES = ['craw', 'jig', 'crankS', 'spinner', 'popper', 'tube', 'crawler'];
export const LURE_PRICES = { crankD: 150, dropshot: 120, jerk: 120, swim: 160, dough: 40, waxworm: 40, eggfly: 60 };
export const COLOR_CLASS = { 'green pumpkin': 'natural', shad: 'natural', 'red craw': 'natural', natural: 'natural', chartreuse: 'bright', 'black/blue': 'dark' };
export const CLARITY_COLOR = { clear: { natural: 1.2, bright: 0.8, dark: 1.0 }, stained: { natural: 1.0, bright: 1.1, dark: 1.05 }, muddy: { natural: 0.75, bright: 1.3, dark: 1.25 } };

export const UPGRADES = {
  whetstone: { name: 'Novaculite whetstone', price: 250, effect: 'Sharper hooks: hook-set window +0.2 s.', fact: 'Novaculite, "razor stone" in Latin, is sold as Washita and Arkansas whetstones. Whetstone mining near Hot Springs began as early as 1818.' },
  reel: { name: 'Smooth-drag reel', price: 400, effect: 'Line holds 8% more tension before it snaps, and slack lasts a bit longer.' },
  sonar: { name: 'Side-scan sonar', price: 500, effect: 'Shows fish marks on the sonar strip and doubles the brush-pile reveal radius.' },
  motor: { name: 'Bigger outboard', price: 600, effect: 'Runs at 60 mph instead of 50: less time on the water between spots.' },
};

// Tournament tiers (fictional rules and payouts; formats calibrated from the Tournaments table).
export const TIERS = {
  club: { name: 'Weeknight club', limit: 5, field: 24, pairs: true, start: 16 * 60 + 30, end: 20 * 60, target: 17, purse: [800, 500, 350, 250, 150], big: 200 },
  regional: { name: 'Regional', limit: 5, field: 40, start: 7 * 60, end: 14 * 60, target: 18.2, purse: [3000, 1800, 1300, 1000, 800, 700, 600, 500, 450, 400], big: 500 },
  finale: { name: 'Regional finale', limit: 5, field: 40, days: 2, start: 7 * 60, end: 14 * 60, target: 27.2, purse: [12000, 6000, 4000, 3000, 2500, 2000, 1500, 1200, 1000, 900], big: 800 },
  championship: { name: 'Championship', limit: 5, field: 30, days: 2, start: 7 * 60, end: 14 * 60, target: 26, purse: [50000, 20000, 12000, 9000, 7000, 6000, 5000, 4000, 3500, 3000], big: 1500 },
  derby: { name: 'Big-fish derby', limit: 1, field: 30, derby: true, start: 7 * 60 + 30, end: 13 * 60 + 30, target: 16, purse: [1500, 800, 500], big: 0 },
  free: { name: 'Free fishing', free: true, start: 0, end: 21 * 60 },
};

export const CHAPTERS = [
  { id: 'ch1', lake: 'catherine', month: 3, tier: 'club', event: 'Remmel Rally Weeknight Club', need: 5, gate: 'Carpenter Dam', gateYear: 1931,
    blurb: 'A Thursday-evening pairs event below Carpenter Dam. Five bass per team. Finish in the top 5 to run upriver through Carpenter Dam to Lake Hamilton.' },
  { id: 'ch2', lake: 'hamilton', month: 5, tier: 'regional', event: 'Spa City Regional, Event 1', need: 10, gate: null,
    blurb: 'A one-day individual event in May, when post-spawn females slide onto brush. Top 10 qualifies for the two-day finale.' },
  { id: 'ch3', lake: 'hamilton', month: 9, tier: 'finale', event: 'Spa City Regional Finale', need: 5, gate: 'Blakely Mountain Dam', gateYear: 1953,
    blurb: 'Two days, ten fish. Top 5 earns a berth above Blakely Mountain Dam on Lake Ouachita.' },
  { id: 'ch4', lake: 'ouachita', month: 10, tier: 'championship', event: 'Ouachita Classic Championship', need: 1, gate: null,
    blurb: 'Two days on deep, clear Lake Ouachita. Slow down, find the brush, and win it all.' },
  { id: 'side', lake: 'degray', month: 1, tier: 'derby', event: 'DeGray Eagle Weekend Derby', need: 3, gate: null, side: true,
    blurb: 'A side trip down the Caddo: one fish wins. Eagles circle the baitfish in January. Any game fish counts (no catfish, bream or rough fish).' },
];

// Fictional anglers. Hometowns are corpus places. Never real tournament anglers (tests check a banned list).
export const ANGLERS = [
  'Merle Haskett', 'Dottie Pruitt', 'Lonnie Vance', 'Ruby Tatum', 'Cecil Ashby', 'Wanda Pickens', 'Earl Dunaway', 'June Holloway',
  'Buck Easterling', 'Opal Grissom', 'Hollis Tate', 'Fern McAdoo', 'Virgil Stroud', 'Iris Lockhart', 'Ray Bledsoe', 'Lula Fincher',
  'Dewey Marchbanks', 'Nell Crowder', 'Otis Ladd', 'Pearl Yancey', 'Cletus Gentry', 'Mavis Overby', 'Arlo Pennington', 'Velma Rook',
  'Royce Abernathy', 'Hattie Coker', 'Wendell Sisk', 'Maxine Truitt', 'Lyle Burkhalter', 'Bernice Oakes', 'Homer Vickery', 'Thelma Dobbs',
  'Delbert Huckaby', 'Inez Waddell', 'Floyd Satterfield', 'Gladys Pomeroy', 'Norris Kimbrell', 'Edna Tillery', 'Vernon Quarles', 'Rosalee Ivey',
  'Jasper Beasley', 'Loretta Mabry', 'Amos Cantrell', 'Winnie Shoup', 'Elmer Garrity', 'Bettye Lusk', 'Harlan Petty', 'Nadine Spurlock',
];
export const HOMETOWNS = ['Hot Springs', 'Mountain Pine', 'Royal', 'Jessieville', 'Mount Ida', 'Magnet Cove', 'Jones Mill', 'Hot Springs Village', 'Bear', 'Paron'];
// Real tournament anglers, record holders and pros are never used; tests/rules.test.mjs checks a banned list.

export const STATE_RECORDS = [
  { sp: 'Largemouth bass', w: '16 lb 4 oz (one AGFC page says 16 lb 8 oz)', water: 'Mallard Lake', date: 'March 2, 1976' },
  { sp: 'Striped bass', w: '64 lb 8 oz', water: 'Beaver Lake tailwater', date: 'April 28, 2000' },
  { sp: 'Hybrid striped bass', w: '27 lb 5 oz (only AGFC-stocked fish count)', water: 'Greers Ferry Lake', date: 'April 24, 1997' },
  { sp: 'Walleye', w: '22 lb 11 oz', water: 'Greers Ferry Lake', date: 'March 12, 1982' },
];
export const RECORD_RULE = 'A state record counts only on a certified legal-for-trade scale with an AGFC or U.S. Fish and Wildlife Service employee as witness. A verified 58 lb 3 oz striper from Bull Shoals still fell short of the 64 lb 8 oz record.';
export const LIMITS_TEXT = 'Arkansas statewide daily limits (AGFC code dated April 2026): 10 black bass, no more than 4 of them smallmouth (meanmouth count as smallmouth); 30 crappie. Possession limit is 3× the daily limit. Lake-specific rules may differ; our sources confirm none for these lakes.';

export const EVENT_TEXT = {
  generation: 'Carpenter Dam is generating. The current is up, wading is unsafe and the trout have scattered. Generation times in the game are fictional; on the real river, check the posted schedule first.',
  snow: 'Snow day. Hot Springs averages only about 1.1 inches of snow a year, but today the ramps are closed. The event moves to tomorrow.',
  eagle: 'A bald eagle is circling here. Eagles winter on Lake Ouachita and DeGray Lake from December to February; in the game, a circling eagle marks baitfish below.',
  jelly: 'A freshwater jellyfish drifts past the boat. Lake Ouachita\'s jellyfish are harmless and do not sting.',
  lights: 'After dark, the Holiday Lights at Garvan Woodland Gardens glow across the water: millions of bulbs on the peninsula.',
  mud: 'May storms (May is Hot Springs\' wettest month) have muddied the water. Bright and dark colors and lures with thump show up better.',
  heat: 'Summer heat: highs near 93°F push fish deep at midday. Fish the low light at dawn and dusk shallow.',
  kicker: 'May post-spawn: big females are sliding onto brush and docks. A green-pumpkin craw on a Texas rig is a proven kicker bait here.',
  slow: 'On deep Ouachita brush, the winning approach was to really slow down: about 20 brush piles a day.',
};
