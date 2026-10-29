// Downloads the public-domain geodata the lake maps are built from into research/geo/raw/ (git-ignored).
//   node tools/geo/fetch.mjs [--force]
// Sources (all U.S. federal works, public domain):
//   USGS National Hydrography Dataset (NHD), Waterbody - Large Scale (layer 12) and Line (layer 2, FType 343 dams)
//     https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer
//   USGS 3D Elevation Program (3DEP) seamless DEM, exportImage as uncompressed float32 TIFF
//     https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer
//   USGS/MRLC National Land Cover Database 2021 (NLCD), WMS GetMap PNG in the standard class colours
//     https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wms
//   USGS National Transportation Dataset roads (The National Map, from U.S. Census TIGER and others)
//     https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAKE_GEO } from './lakes-geo.mjs';

const RAW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../research/geo/raw');
fs.mkdirSync(RAW, { recursive: true });
const force = process.argv.includes('--force');

async function get(url, file, binary = false) {
  const out = path.join(RAW, file);
  if (!force && fs.existsSync(out) && fs.statSync(out).size > 100) { console.log('have', file); return; }
  for (let tryN = 0; tryN < 3; tryN++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!binary && buf.toString('utf8', 0, 40).includes('"error"')) throw new Error(buf.toString('utf8', 0, 300));
      fs.writeFileSync(out, buf); console.log('got', file, (buf.length / 1024).toFixed(0) + ' KB'); return;
    } catch (e) { console.warn('retry', file, e.message); await new Promise((r) => setTimeout(r, 2000)); }
  }
  throw new Error('failed ' + file);
}
const q = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

for (const [id, g] of Object.entries(LAKE_GEO)) {
  const [w, s, e, n] = g.bbox; // frame bbox (lon/lat) with margin
  await get('https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query?' + q({
    geometry: `${w},${s},${e},${n}`, geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects',
    where: 'AREASQKM>0.004', outFields: 'GNIS_NAME,AREASQKM,FTYPE,FCODE,PERMANENT_IDENTIFIER', returnGeometry: true, outSR: 4326, f: 'geojson' }), `nhd_wb_${id}.geojson`);
  await get('https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query?' + q({
    geometry: `${w},${s},${e},${n}`, geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects',
    where: 'GNIS_NAME IS NOT NULL', outFields: 'GNIS_NAME,FTYPE,LENGTHKM', returnGeometry: true, outSR: 4326, f: 'geojson' }), `nhd_flow_${id}.geojson`);
  const [W, H] = g.demSize;
  await get('https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?' + q({
    bbox: `${w},${s},${e},${n}`, bboxSR: 4326, imageSR: 4326, size: `${W},${H}`, format: 'tiff', pixelType: 'F32', noData: '',
    compression: 'None', interpolation: 'RSP_BilinearInterpolation', f: 'image' }), `dem_${id}.tif`, true);
  await get('https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wms?' + q({
    service: 'WMS', version: '1.1.1', request: 'GetMap', layers: 'NLCD_2021_Land_Cover_L48', styles: '', srs: 'EPSG:4326',
    bbox: `${w},${s},${e},${n}`, width: 800, height: 500, format: 'image/png' }), `nlcd_${id}.png`, true);
  for (const layer of [29, 30, 31]) {
    await get(`https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/${layer}/query?` + q({
      geometry: `${w},${s},${e},${n}`, geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects',
      where: '1=1', outFields: '*', returnGeometry: true, outSR: 4326, f: 'geojson' }), `roads${layer}_${id}.geojson`);
  }
}
await get('https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/2/query?' + q({
  geometry: '-93.6,34.15,-92.85,34.75', geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects',
  where: 'FTYPE=343', outFields: '*', returnGeometry: true, outSR: 4326, f: 'geojson' }), 'nhd_dams.geojson');
console.log('done');
