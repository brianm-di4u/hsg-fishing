// Map frames for the four lakes. Each frame is the lon/lat box that becomes the game's 1000 × 625 lake space
// (equirectangular, x east, y south). Frames keep the 1.6 aspect, so the lake keeps its true shape.
// inflow = where the river enters (lon, lat); dam = the dam crest midpoint. Used to grade estimated depths.
export const ASPECT = 1000 / 625;
const KX = Math.cos(34.45 * Math.PI / 180) * 111320, KY = 110950; // metres per degree at the lakes' latitude

// width in degrees of longitude; height follows from the aspect
function frame(cx, cy, wDeg) { const hDeg = (wDeg * KX) / ASPECT / KY; return [cx - wDeg / 2, cy - hDeg / 2, cx + wDeg / 2, cy + hDeg / 2]; }

export const LAKE_GEO = {
  catherine: { name: 'Lake Catherine', gnis: 'Lake Catherine', bbox: frame(-92.9595, 34.4465, 0.142), demSize: [512, 320],
    inflow: [-93.0262, 34.4425], dam: [-92.8941, 34.4270], pool: 305 },
  hamilton: { name: 'Lake Hamilton', gnis: 'Lake Hamilton', bbox: frame(-93.1185, 34.4555, 0.2), demSize: [512, 320],
    inflow: [-93.185, 34.5195], dam: [-93.0266, 34.4425], pool: 400 },
  ouachita: { name: 'Lake Ouachita', gnis: 'Lake Ouachita', bbox: frame(-93.366, 34.6165, 0.41), demSize: [512, 320],
    inflow: [-93.562, 34.5480], dam: [-93.1942, 34.5725], pool: 578 },
  degray: { name: 'DeGray Lake', gnis: 'De Gray Lake', bbox: frame(-93.2493, 34.2596, 0.31), demSize: [512, 320],
    inflow: [-93.398, 34.2990], dam: [-93.1070, 34.2140], pool: 408 },
};
export { KX, KY };
