// Small three.js helpers.
/* global THREE */

// Merge geometries that may differ in attributes: keeps position, normal and color (filling white), drops the rest.
export function mergeGeo(list) {
  const ps = [], ns = [], cs = [], uvs = [], idx = []; let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0; g.computeVertexNormals && !g.attributes.normal && g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      ps.push(p.getX(i), p.getY(i), p.getZ(i)); ns.push(n.getX(i), n.getY(i), n.getZ(i));
      if (c) cs.push(c.getX(i), c.getY(i), c.getZ(i)); else cs.push(1, 1, 1);
      if (uv) uvs.push(uv.getX(i), uv.getY(i)); else uvs.push(0, 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); out.setIndex(idx);
  return out;
}
export function disposeTree(root) {
  root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && m.map.userData && m.map.userData.own) m.map.dispose(); m.dispose(); }); });
}

// A glTF scene → one BufferGeometry (world transforms applied) with a colour attribute from each material's base
// colour (or its vertex colours), ready for instancing with a vertex-colour material.
export function geoFromScene(root, filter) {
  root.updateMatrixWorld(true); const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || (filter && !filter(o))) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = Array.isArray(o.material) ? o.material[0] : o.material; const c = (m && m.color) ? m.color : new THREE.Color(1, 1, 1);
    const n = g.attributes.position.count; const col = new Float32Array(n * 3); const vc = g.attributes.color;
    // vertex colours carry the shading when present (the Blender trees); otherwise the material's base colour
    for (let i = 0; i < n; i++) { col[i * 3] = vc ? vc.getX(i) : c.r; col[i * 3 + 1] = vc ? vc.getY(i) : c.g; col[i * 3 + 2] = vc ? vc.getZ(i) : c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g);
  });
  return parts.length ? mergeGeo(parts) : null;
}
