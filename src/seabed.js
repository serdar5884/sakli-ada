import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry, smooth, clamp, lerp, fbm, vnoise } from './world.js';
import { V3, M4, Q4, C3, TAU, tint, bare, piece, patchDiveMaterial, rockGeometry, bake2, tmpC } from './diveutil.js';
import { barrelGeo, crateGeo, amphoraGeo } from './wrecks.js';

/**
 *  GÖL DİBİ — mercan resifleri, kaya kemerleri/sütunları, dip ayrıntıları, hazine sandığı, denizanası, kerevit, kaplumbağa
 *  createSeabed({ terrainH, lakeD, islandD, avoid, wrecks, isMobile, seed }) → { group, zones, clear, chest, update(dt, t, diver) }
 */
const UP = new V3(0, 1, 0);
const E_ = new THREE.Euler(), Q_ = new Q4(), M_ = new M4(), P_ = new V3(), S_ = new V3();
const fin = (parts) => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
/** a→b arası konik silindir (kollar, dallar, bacaklar); k = renk çarpanı */
function seg(a, b, r0, r1, sides = 5, k = 1, color = '#ffffff') {
  const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true); const dir = new V3().subVectors(b, a).normalize();
  g.applyMatrix4(M_.compose(new V3().addScaledVector(a, 0.5).addScaledVector(b, 0.5), Q_.setFromUnitVectors(UP, dir), S_.set(1, 1, 1))); return tint(bare(g), color, k);
}
const ball = (p, r, k, det = 0, color = '#ffffff') => tint(bare((det ? new THREE.IcosahedronGeometry(r, det) : new THREE.OctahedronGeometry(r, 0)).translate(p.x, p.y, p.z)), color, k);

/* ============================ MERCAN GEOMETRİLERİ ============================ */
function branchCoral(seed) {
  const rnd = mulberry(seed); const parts = []; const shade = [0.5, 0.7, 0.88, 1.0];
  const rec = (p, d, len, r, depth) => {
    const end = p.clone().addScaledVector(d, len); parts.push(seg(p, end, r, r * 0.72, 4, shade[depth]));
    if (depth < 3) { const n = depth === 0 ? 3 : rnd() < 0.5 ? 2 : 3; for (let i = 0; i < n; i++) { const nd = d.clone().add(new V3((rnd() - 0.5) * 1.35, 0.08 + rnd() * 0.35, (rnd() - 0.5) * 1.35)).normalize(); rec(end, nd, len * 0.76, r * 0.7, depth + 1); } }
    else parts.push(ball(end, r * 1.5, 1.18));
  };
  for (let i = 0; i < 2; i++) rec(new V3((i - 0.5) * 0.1, 0, (rnd() - 0.5) * 0.1), new V3((rnd() - 0.5) * 0.5, 1, (rnd() - 0.5) * 0.5).normalize(), 0.3, 0.062, 0);
  return fin(parts);
}
function tableCoral(seed) {
  const rnd = mulberry(seed); const parts = [seg(new V3(0, -0.05, 0), new V3(0.02, 0.36, 0), 0.1, 0.07, 6, 0.55)];
  for (let l = 0; l < 3; l++) {
    const R = 0.62 - l * 0.14, y = 0.34 + l * 0.12; const g = new THREE.CylinderGeometry(R, R * 0.85, 0.055, 16, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.12 * Math.sin(a * 5 + seed + l) + 0.07 * Math.sin(a * 9 + l * 2); p.setXYZ(i, x * k, p.getY(i) + 0.05 * Math.sin(a * 3 + l) * (Math.hypot(x, z) / R), z * k); }
    g.translate(0, y, 0); g.rotateZ((rnd() - 0.5) * 0.12); parts.push(tint(bare(g), '#ffffff', 0.82 + l * 0.12));
  }
  return fin(parts);
}
function brainCoral(seed) {
  const g = new THREE.SphereGeometry(0.5, 20, 12); const p = g.attributes.position; const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const l = Math.hypot(x, y, z) || 1; const nx = x / l, ny = y / l, nz = z / l;
    const f = Math.sin(nx * 22 + Math.sin(nz * 9 + seed) * 2.3) * Math.sin(nz * 20 + Math.sin(ny * 8) * 1.6); const d = 1 + 0.05 * f; p.setXYZ(i, x * d, y * d * 0.7 + 0.08, z * d);
    const k = 0.78 + 0.22 * (f * 0.5 + 0.5) + 0.12 * ny; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g;
}
function fanCoral(seed) {
  const rnd = mulberry(seed); const parts = []; const N = 9; const tips = [];
  parts.push(seg(new V3(0, -0.05, 0), new V3(0, 0.2, 0), 0.05, 0.035, 5, 0.55));
  for (let i = 0; i < N; i++) {
    const a = lerp(-1.15, 1.15, i / (N - 1)) + (rnd() - 0.5) * 0.12; const L = 0.78 + rnd() * 0.22 - Math.abs(a) * 0.12; const d = new V3(Math.sin(a), Math.cos(a), 0); const o = new V3(0, 0.2, 0); const mid = o.clone().addScaledVector(d, L * 0.5);
    parts.push(seg(o, mid, 0.017, 0.013, 3, 0.7)); const row = [o.clone(), mid];
    for (const s of [-1, 1]) { const b = a + s * (0.2 + rnd() * 0.1); const d2 = new V3(Math.sin(b), Math.cos(b), 0); const e = mid.clone().addScaledVector(d2, L * 0.5); parts.push(seg(mid, e, 0.012, 0.008, 3, 1.05)); tips.push([a + s * 0.02, e]); }
  }
  // enine bağlar (ağ görünümü)
  for (const R of [0.38, 0.58, 0.8]) { let prev = null; for (let i = 0; i <= N * 2; i++) { const a = lerp(-1.15, 1.15, i / (N * 2)); const q = new V3(Math.sin(a) * R, 0.2 + Math.cos(a) * R, 0.0 + (rnd() - 0.5) * 0.015); if (prev && (rnd() < 0.78)) parts.push(seg(prev, q, 0.007, 0.007, 3, 0.9)); prev = q; } }
  return fin(parts);
}
function tubeCoral(seed) {
  const rnd = mulberry(seed); const parts = []; const n = 7 + ((rnd() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = rnd() * 0.2, h = 0.22 + rnd() * 0.42, r = 0.045 + rnd() * 0.03; const b = new V3(Math.cos(a) * d, -0.03, Math.sin(a) * d), lean = new V3((rnd() - 0.5) * 0.25, 1, (rnd() - 0.5) * 0.25).normalize(); const top = b.clone().addScaledVector(lean, h);
    parts.push(seg(b, top, r * 1.15, r, 7, 0.85)); const cap = new THREE.CircleGeometry(r * 0.82, 7); cap.rotateX(-Math.PI / 2); cap.translate(top.x, top.y + 0.004, top.z); parts.push(tint(bare(cap), '#1a0f12', 1)); parts.push(tint(bare(new THREE.TorusGeometry(r * 0.95, r * 0.18, 4, 7).rotateX(Math.PI / 2).translate(top.x, top.y, top.z)), '#ffffff', 1.15));
  }
  return fin(parts);
}
function anemone(seed) {
  const rnd = mulberry(seed); const parts = [tint(bare(new THREE.IcosahedronGeometry(0.13, 0).scale(1.2, 0.7, 1.2).translate(0, 0.05, 0)), '#ffffff', 0.6)];
  for (let i = 0; i < 28; i++) { const a = rnd() * TAU, lean = 0.25 + rnd() * 0.85, d = 0.04 + rnd() * 0.09; const dir = new V3(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean)); const b = new V3(Math.cos(a) * d, 0.08, Math.sin(a) * d), e = b.clone().addScaledVector(dir, 0.28 + rnd() * 0.22); parts.push(seg(b, e, 0.02, 0.008, 4, 0.7 + rnd() * 0.2)); parts.push(ball(e, 0.017, 1.25)); }
  return fin(parts);
}

/* ============================ KAYA GEOMETRİLERİ ============================ */
function archGeometry(seed) {
  const g = new THREE.TorusGeometry(1.0, 0.44, 8, 20, Math.PI); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (vnoise(x * 2.1 + seed, y * 2.1 + z * 3) - 0.5) * 0.7; p.setXYZ(i, x * k, Math.max(-0.4, y * k) - 0.02, z * (0.9 + (vnoise(x * 3, y * 3 + seed) - 0.5) * 0.9)); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); const base = bake2(g); return base;
}
function spireGeometry(seed) {
  const g = new THREE.CylinderGeometry(0.16, 0.72, 3.6, 7, 5); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (vnoise(x * 1.8 + seed, z * 1.8 + y * 0.9) - 0.5) * 0.7; p.setXYZ(i, x * k + Math.sin(y * 0.8 + seed) * 0.12, y + 1.8, z * k); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); const n = g.attributes.normal; const c = new Float32Array(p.count * 3); const st = new C3('#7b7a70'), st2 = new C3('#5b6058'), mo = new C3('#557a38');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); tmpC.copy(st).lerp(st2, vnoise(p.getX(i) * 2, p.getZ(i) * 2 + y) * 0.9); tmpC.lerp(mo, smooth(2.2, 0.0, y) * 0.55 * (0.5 + vnoise(p.getX(i) * 3, p.getZ(i) * 3 + y))); c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function driftwoodGeometry(seed) {
  const rnd = mulberry(seed); const parts = []; const L = 2.0 + rnd() * 1.2; const trunk = new THREE.CylinderGeometry(0.065, 0.1, L, 6, 4); trunk.rotateZ(Math.PI / 2); const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 1.6 + seed) * 0.09 + vnoise(p.getX(i) * 3, seed) * 0.03);
  parts.push(tint(bare(trunk), '#7a6850', 1)); for (let i = 0; i < 3; i++) { const x = (rnd() - 0.5) * L * 0.7; const a = new V3(x, 0.04, 0), b = new V3(x + (rnd() - 0.5) * 0.5, 0.35 + rnd() * 0.3, (rnd() - 0.5) * 0.8); parts.push(seg(a, b, 0.045, 0.02, 5, 0.9, '#6d5c46')); }
  return fin(parts);
}
function urchinGeometry(seed) {
  const rnd = mulberry(seed); const parts = [tint(bare(new THREE.IcosahedronGeometry(0.085, 0)), '#ffffff', 0.55)];
  for (let i = 0; i < 26; i++) { const d = new V3(rnd() - 0.5, rnd() * 0.9 - 0.2, rnd() - 0.5).normalize(); parts.push(seg(d.clone().multiplyScalar(0.07), d.clone().multiplyScalar(0.07 + 0.11 + rnd() * 0.06), 0.009, 0.002, 3, 1)); }
  return fin(parts);
}
function starGeometry() {
  const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = i % 2 ? 0.075 : 0.22; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(r, 0); } sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false }); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) + 0.04 * (1 - clamp(d / 0.2, 0, 1))); }
  return tint(bare(g), '#ffffff', 1);
}
function shellGeometry(seed) {
  const g = new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2); const p = g.attributes.position; const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const rid = Math.sin(a * 9 + seed); const k = 1 + 0.07 * rid * (1 - y); p.setXYZ(i, x * k, y * 0.34, z * k * 0.88); const sh = 0.82 + 0.18 * rid; c[i * 3] = sh; c[i * 3 + 1] = sh * 0.97; c[i * 3 + 2] = sh * 0.92; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g;
}

/* ============================ ANA OLUŞTURUCU ============================ */
export function createSeabed({ terrainH, lakeD, islandD, avoid = () => false, wrecks = [], isMobile = false, seed = 11, solids = null } = {}) {
  const rnd = mulberry(seed); const group = new THREE.Group(); group.name = 'seabed'; const lite = isMobile ? 0.55 : 1;
  const colr = new C3();
  const waterOk = (x, z, minD) => { if (lakeD(x, z) < 3 || islandD(x, z) > -2.5 || avoid(x, z)) return null; const b = terrainH(x, z); return b < -minD ? b : null; };
  const slopeAt = (x, z) => { const gx = terrainH(x + 0.6, z) - terrainH(x - 0.6, z), gz = terrainH(x, z + 0.6) - terrainH(x, z - 0.6); return Math.hypot(gx, gz) / 1.2; };
  const put = (im, i, x, y, z, sx, sy, sz, ry, tx = 0.1) => { E_.set((rnd() - 0.5) * tx, ry, (rnd() - 0.5) * tx); Q_.setFromEuler(E_); im.setMatrixAt(i, M_.compose(P_.set(x, y, z), Q_, S_.set(sx, sy, sz))); };
  const finish = (im, n, shadow = false) => { im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = shadow; im.receiveShadow = false; im.computeBoundingSphere(); im.boundingSphere.radius += 4; group.add(im); return im; };
  const area = (count, tries, minD, fn) => { let n = 0; for (let t = 0; t < tries && n < count; t++) { const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 108; const b = waterOk(x, z, minD); if (b === null) continue; if (fn(x, z, b, n)) n++; } return n; };
  const matOf = (sway = 0, extra = {}) => patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true, side: THREE.DoubleSide, ...extra }), { sway });

  /* ---------- 1) mercan resif bölgeleri ---------- */
  const zones = []; const themes = [
    ['#ff8a3d', '#ff5d8f', '#f2d04a', '#ff7a5a'], ['#a86bd6', '#6b8cff', '#3fc7b5', '#d27ae0'], ['#a8d94a', '#f2d04a', '#4fd08a', '#ffb04a'], ['#ff5d8f', '#ff9ec0', '#c79bff', '#f2d04a'], ['#3fc7b5', '#4f8fe0', '#a8d94a', '#ff8a3d']];
  for (let t = 0; t < 1500 && zones.length < 6; t++) {
    const x = (rnd() - 0.5) * 100, z = (rnd() - 0.5) * 90; const b = waterOk(x, z, 1.8); if (b === null || b < -6.8 || lakeD(x, z) < 5.5 || islandD(x, z) > -5 || slopeAt(x, z) > 0.8) continue;
    if (zones.some((q) => Math.hypot(q.x - x, q.z - z) < 15)) continue; if (wrecks.some((w) => Math.hypot(w.x - x, w.z - z) < w.r + 6)) continue;
    zones.push({ x, z, r: 6.5 + rnd() * 4.5, theme: themes[zones.length % themes.length], ring: false });
  }
  for (const w of wrecks) zones.push({ x: w.x, z: w.z, r: w.r + 3.8, theme: themes[(zones.length) % themes.length], ring: true, inner: w.r * 0.78 });
  const zoneW = zones.map((q) => q.r * q.r); const zoneSum = zoneW.reduce((a, b) => a + b, 0);
  const pickZone = () => { let r = rnd() * zoneSum; for (let i = 0; i < zones.length; i++) { r -= zoneW[i]; if (r <= 0) return zones[i]; } return zones[0]; };
  const reefPoint = (minD = 0.9) => {
    for (let t = 0; t < 12; t++) { const q = pickZone(); const a = rnd() * TAU, r = q.ring ? q.inner + rnd() * (q.r - q.inner) : q.r * Math.sqrt(rnd()); const x = q.x + Math.cos(a) * r, z = q.z + Math.sin(a) * r; const b = waterOk(x, z, minD); if (b === null) continue; if (slopeAt(x, z) > 0.85) continue; const d = r / q.r; if (rnd() < 0.15 + 0.85 * (1 - d * d) * (0.45 + 0.55 * vnoise(x * 0.5, z * 0.5))) return { x, z, b, q, d }; }
    return null;
  };
  const coralMat = matOf(0), fanMat = matOf(0.5), anMat = matOf(1.7);
  const mkCoral = (geo, mat, count, sMin, sMax, pal, tall = 1) => {
    const im = new THREE.InstancedMesh(geo, mat, count); let n = 0;
    for (let t = 0; t < count * 8 && n < count; t++) { const pt = reefPoint(); if (!pt) continue; const s = lerp(sMin, sMax, Math.pow(rnd(), 1.3)) * 1.3 * (1.0 - 0.3 * pt.d); put(im, n, pt.x, pt.b - 0.04, pt.z, s, s * tall * (0.85 + rnd() * 0.3), s, rnd() * TAU, 0.16);
      const base = rnd() < 0.62 ? pt.q.theme[(rnd() * 4) | 0] : pal[(rnd() * pal.length) | 0]; colr.set(base).offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.08); im.setColorAt(n, colr); n++; }
    return finish(im, n, false);
  };
  const cn = (k) => Math.round(k * lite * 1.45);
  mkCoral(branchCoral(41), coralMat, cn(120), 0.7, 1.5, ['#ff8a3d', '#ff5d8f', '#f2d04a', '#a8d94a', '#a86bd6', '#3fc7b5']);
  mkCoral(branchCoral(57), coralMat, cn(70), 0.55, 1.1, ['#f2d04a', '#ffb04a', '#ff7a5a', '#c79bff']);
  mkCoral(tableCoral(8), coralMat, cn(46), 0.8, 1.9, ['#d9b97a', '#7fb35a', '#9a7ac8', '#e88aa6', '#6fc0b0']);
  mkCoral(brainCoral(5), coralMat, cn(70), 0.45, 1.25, ['#c9a56a', '#8fb36a', '#d98a6a', '#b8a0d8', '#e2c15a']);
  mkCoral(fanCoral(13), fanMat, cn(46), 0.8, 1.45, ['#9b4fb8', '#d8434f', '#f0803c', '#cf5fa8']);
  mkCoral(tubeCoral(3), coralMat, cn(58), 0.7, 1.45, ['#d8434f', '#f0803c', '#f2d04a', '#4f8fe0', '#a86bd6']);
  mkCoral(anemone(9), anMat, cn(48), 0.8, 1.6, ['#ff9ec0', '#a7e36a', '#ffb04a', '#c79bff', '#7fe0e8']);
  // resif kaya tabanı
  { const rm = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), {}); const im = new THREE.InstancedMesh(rockGeometry(31, 0.25), rm, cn(90)); let n = 0;
    for (let t = 0; t < 900 && n < im.instanceMatrix.count; t++) { const pt = reefPoint(0.7); if (!pt) continue; const s = 0.18 + Math.pow(rnd(), 2) * 0.9; const ry = rnd() * TAU; put(im, n, pt.x, pt.b + s * 0.15, pt.z, s * 1.2, s, s * 1.1, ry, 0.3); if (solids && s > 0.3) solids.ellipsoid(pt.x, pt.b + s * 0.15, pt.z, 1.3 * s, 0.62 * s, 1.05 * s, ry); n++; } finish(im, n, true); }

  /* ---------- 2) kaya kemerleri, sütunlar ---------- */
  const clear = zones.map((q) => ({ x: q.x, z: q.z, r: q.ring ? q.r * 0.6 : q.r * 0.82 }));
  const arches = []; { const am = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), {}); const geos = [archGeometry(2), archGeometry(9)];
    for (let t = 0; t < 2500 && arches.length < 3; t++) {
      const x = (rnd() - 0.5) * 100, z = (rnd() - 0.5) * 90; const b = waterOk(x, z, 3.4); if (b === null || b < -8 || lakeD(x, z) < 8 || islandD(x, z) > -7 || slopeAt(x, z) > 0.5) continue;
      if (arches.some((q) => Math.hypot(q.x - x, q.z - z) < 20) || wrecks.some((w) => Math.hypot(w.x - x, w.z - z) < w.r + 8)) continue;
      const ry = rnd() * Math.PI, s = 1.55 + rnd() * 0.5; const gi = arches.length % 2; const im = new THREE.InstancedMesh(geos[gi], am, 1); put(im, 0, x, b - 0.08, z, s * 1.35, s * 1.6, s * 1.5, ry, 0); finish(im, 1, true); arches.push({ x, z, b, ry, s }); clear.push({ x, z, r: 4.5 * s });
      if (solids) { const c = Math.cos(ry), sn = Math.sin(ry); for (let k = 0; k <= 16; k++) { const th = k / 16 * Math.PI; const lx = Math.cos(th) * 1.0 * s * 1.35, ly = Math.sin(th) * 1.0 * s * 1.6 - 0.02; solids.sphere(x + lx * c, b - 0.08 + ly, z - lx * sn, 0.37 * s * (k === 0 || k === 16 ? 1.3 : 1.1)); } }
      // yan kaya yığınları
      const rm = new THREE.InstancedMesh(rockGeometry(40 + arches.length, 0.5), patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), {}), 7); let rn = 0;
      for (let k = 0; k < 7; k++) { const a = ry + (k % 2 ? 0 : Math.PI) + (rnd() - 0.5) * 0.9, d = 2.3 * s + rnd() * 1.6; const xx = x + Math.cos(-a + 0) * d, zz = z + Math.sin(-a) * d; const bb = terrainH(xx, zz); const sz = 0.5 + rnd() * 0.8; const rr0 = rnd() * TAU; put(rm, rn++, xx, bb + sz * 0.15, zz, sz * 1.2, sz, sz, rr0, 0.3); if (solids) solids.ellipsoid(xx, bb + sz * 0.15, zz, 1.3 * sz, 0.62 * sz, 0.95 * sz, rr0); } finish(rm, rn, true);
    } }
  { const sm = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), {}); const geos = [spireGeometry(3), spireGeometry(7), spireGeometry(12)];
    for (let gi = 0; gi < 3; gi++) { const im = new THREE.InstancedMesh(geos[gi], sm, cn(10)); let n = 0; const cen = [];
      for (let t = 0; t < 4000 && n < im.instanceMatrix.count; t++) { let x, z; if (cen.length && rnd() < 0.7) { const c = cen[(rnd() * cen.length) | 0]; const a = rnd() * TAU, d = 1.0 + rnd() * 3.2; x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d; } else { x = (rnd() - 0.5) * 100; z = (rnd() - 0.5) * 90; }
        const b = waterOk(x, z, 3.8); if (b === null || lakeD(x, z) < 10 || islandD(x, z) > -7) continue; if (zones.some((q) => !q.ring && Math.hypot(q.x - x, q.z - z) < q.r * 0.6) || wrecks.some((w) => Math.hypot(w.x - x, w.z - z) < w.r + 2)) continue; if (arches.some((q) => Math.hypot(q.x - x, q.z - z) < 5)) continue;
        if (!cen.length || rnd() < 0.25) cen.push({ x, z }); const s = 0.55 + Math.pow(rnd(), 1.5) * 0.95, sy = s * (0.55 + rnd() * 0.75); put(im, n++, x, b - 0.1, z, s, sy, s, rnd() * TAU, 0.14); if (solids) solids.column(x, b - 0.1, z, 0.66 * s, 0.2 * s, 3.4 * sy); if (n === 1 || rnd() < 0.12) clear.push({ x, z, r: 2.4 }); }
      finish(im, n, true); } }

  /* ---------- 3) dip ayrıntıları ---------- */
  { const pm = patchDiveMaterial(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), {}); const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.58, 0.85), pm, cn(620)); const g = ['#8a8578', '#6e6a5e', '#9b8f78', '#767d70', '#a49a86']; let n = area(cn(620), 6000, 0.7, (x, z, b, i) => { const s = 0.05 + Math.pow(rnd(), 2.2) * 0.17; put(im, i, x, b + s * 0.2, z, s * (0.9 + rnd() * 0.5), s, s * (0.9 + rnd() * 0.4), rnd() * TAU, 0.5); colr.set(g[(rnd() * 5) | 0]).multiplyScalar(0.85 + rnd() * 0.3); im.setColorAt(i, colr); return true; }); finish(im, n); }
  { const sm = matOf(0); for (let gi = 0; gi < 2; gi++) { const im = new THREE.InstancedMesh(shellGeometry(gi * 3 + 1), sm, cn(110)); const pal = gi ? ['#b99872', '#8c6d4f', '#a58a68'] : ['#f1e6d0', '#ecd9c0', '#f4c9b8', '#d9c9e8']; const n = area(cn(110), 5000, 0.9, (x, z, b, i) => { const s = 0.07 + rnd() * 0.09; put(im, i, x, b + 0.005, z, s, s * (1 + rnd()), s, rnd() * TAU, 0.5); colr.set(pal[(rnd() * pal.length) | 0]); im.setColorAt(i, colr); return true; }); finish(im, n); } }
  { const sm = matOf(0); const stars = new THREE.InstancedMesh(starGeometry(), sm, cn(50)); let n = 0; const sp = ['#ff7a3a', '#e8452e', '#f2a63a', '#c0407a', '#ffd25a']; for (let t = 0; t < 500 && n < cn(50); t++) { const pt = reefPoint(0.9); if (!pt) continue; const s = 0.6 + rnd() * 0.9; put(stars, n, pt.x, pt.b + 0.0, pt.z, s, s, s, rnd() * TAU, 0.18); colr.set(sp[(rnd() * sp.length) | 0]); stars.setColorAt(n++, colr); } finish(stars, n);
    const urch = new THREE.InstancedMesh(urchinGeometry(4), sm, cn(60)); n = 0; const up = ['#3b2a5a', '#5b2a46', '#2a2a40', '#6a3a7a']; for (let t = 0; t < 500 && n < cn(60); t++) { const pt = reefPoint(0.9); if (!pt) continue; const s = 0.7 + rnd() * 0.8; put(urch, n, pt.x, pt.b + 0.04, pt.z, s, s, s, rnd() * TAU, 0.2); colr.set(up[(rnd() * up.length) | 0]); urch.setColorAt(n++, colr); } finish(urch, n); }
  { const dm = matOf(0); const gs = [driftwoodGeometry(2), driftwoodGeometry(7)]; for (let gi = 0; gi < 2; gi++) { const im = new THREE.InstancedMesh(gs[gi], dm, cn(14)); const n = area(cn(14), 5000, 0.8, (x, z, b, i) => { put(im, i, x, b + 0.04, z, 1, 1, 1, rnd() * TAU, 0.18); colr.set('#ffffff').multiplyScalar(0.8 + rnd() * 0.4); im.setColorAt(i, colr); return slopeAt(x, z) < 0.6; }); finish(im, n, true); } }
  // kayıp kargo: varil, sandık, amfora yığınları
  const spills = []; { const mm = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), {}); const kinds = [barrelGeo(rnd), crateGeo(rnd), amphoraGeo(rnd), amphoraGeo(rnd)]; const ims = kinds.map((g) => new THREE.InstancedMesh(g, mm, cn(12))); const cnt = ims.map(() => 0);
    for (let t = 0; t < 1500 && spills.length < (isMobile ? 3 : 5); t++) { const x = (rnd() - 0.5) * 100, z = (rnd() - 0.5) * 90; const b = waterOk(x, z, 2.2); if (b === null || lakeD(x, z) < 8 || islandD(x, z) > -6 || slopeAt(x, z) > 0.4 || spills.some((q) => Math.hypot(q.x - x, q.z - z) < 15) || wrecks.some((w) => Math.hypot(w.x - x, w.z - z) < w.r + 4)) continue; spills.push({ x, z }); clear.push({ x, z, r: 3 }); }
    for (const sp of spills) for (let k = 0; k < 6; k++) { const ki = (rnd() * 4) | 0; if (cnt[ki] >= ims[ki].instanceMatrix.count) continue; const a = rnd() * TAU, d = rnd() * 2.2; const x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d; const b = terrainH(x, z); const lying = rnd() < 0.6; const s = 0.95 + rnd() * 0.3; E_.set(lying ? Math.PI / 2 + (rnd() - 0.5) * 0.3 : (rnd() - 0.5) * 0.3, rnd() * TAU, (rnd() - 0.5) * 0.3); Q_.setFromEuler(E_); ims[ki].setMatrixAt(cnt[ki]++, M_.compose(P_.set(x, b + (lying ? 0.1 : 0.0) - 0.02, z), Q_, S_.set(s, s, s))); if (solids) solids.sphere(x, b + 0.2, z, 0.3); }
    ims.forEach((im, i) => finish(im, cnt[i], true)); }

  /* ---------- 4) hazine sandığı (kemerin yanında) ---------- */
  const chest = (() => {
    const a = arches[0]; let cx, cz, cb; if (a) { cx = a.x + Math.sin(a.ry) * 1.7 * a.s * 0.5; cz = a.z + Math.cos(a.ry) * 1.7 * a.s * 0.5; cb = terrainH(cx, cz); } else { const w = wrecks[0]; cx = w ? w.x + 6 : 0; cz = w ? w.z : 30; cb = terrainH(cx, cz); }
    const root = new THREE.Group(); root.name = 'treasureChest'; root.position.set(cx, cb, cz); root.rotation.y = rnd() * TAU; clear.push({ x: cx, z: cz, r: 2.2 });
    const wood = '#6a4a2c', band = '#8a8f94'; const body = fin([piece(new THREE.BoxGeometry(0.82, 0.4, 0.52), wood, [0, 0.18, 0], null, 1), piece(new THREE.BoxGeometry(0.86, 0.06, 0.56), band, [0, 0.04, 0], null, 1), piece(new THREE.BoxGeometry(0.86, 0.06, 0.56), band, [0, 0.38, 0], null, 1), piece(new THREE.BoxGeometry(0.07, 0.4, 0.56), band, [0.26, 0.19, 0], null, 1), piece(new THREE.BoxGeometry(0.07, 0.4, 0.56), band, [-0.26, 0.19, 0], null, 1)]);
    const bm = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.15, flatShading: true }), {}); const bodyM = new THREE.Mesh(body, bm); bodyM.castShadow = true; root.add(bodyM);
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.4, -0.26); root.add(lidPivot);
    const lg = new THREE.CylinderGeometry(0.26, 0.26, 0.82, 10, 1, false, 0, Math.PI); lg.rotateZ(Math.PI / 2); lg.rotateY(Math.PI / 2); lg.translate(0, 0, 0.26);
    const lid = new THREE.Mesh(tint(bare(lg), wood, 1), bm); lid.castShadow = true; lidPivot.add(lid);
    for (const x of [-0.26, 0.26]) { const bg = new THREE.CylinderGeometry(0.27, 0.27, 0.07, 10, 1, false, 0, Math.PI); bg.rotateZ(Math.PI / 2); bg.rotateY(Math.PI / 2); bg.translate(x, 0, 0.26); lidPivot.add(new THREE.Mesh(tint(bare(bg), band, 1), bm)); }
    const clasp = new THREE.Mesh(tint(bare(new THREE.BoxGeometry(0.1, 0.11, 0.04)), '#e0b83a', 1), bm); clasp.position.set(0, -0.02, 0.54); lidPivot.add(clasp);
    // altınlar
    const coinParts = []; const cg = new THREE.CylinderGeometry(0.058, 0.058, 0.014, 8);
    for (let i = 0; i < 46; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.3; const x = Math.cos(a) * d * 1.25, z = Math.sin(a) * d * 0.75; const y = 0.34 + (1 - d / 0.3) * 0.1 + rnd() * 0.02; coinParts.push(piece(cg, rnd() < 0.8 ? '#ffc933' : '#ffe27a', [x, y, z], [(rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7], 1)); }
    for (let i = 0; i < 4; i++) coinParts.push(piece(new THREE.OctahedronGeometry(0.05, 0), ['#d8334f', '#3b86e8', '#2fcf7a', '#c04fe0'][i], [(rnd() - 0.5) * 0.4, 0.43 + rnd() * 0.04, (rnd() - 0.5) * 0.25], [rnd(), rnd(), rnd()], 1));
    const goldM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6, emissive: '#ffb21a', emissiveIntensity: 0.5, flatShading: true }); const coins = new THREE.Mesh(fin(coinParts), goldM); root.add(coins);
    // parıltılar
    const NG = 10; const gp = new Float32Array(NG * 3), gph = new Float32Array(NG); for (let i = 0; i < NG; i++) { gph[i] = rnd() * TAU; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); const gm = new THREE.PointsMaterial({ color: '#ffe9a0', size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }); const glints = new THREE.Points(gg, gm); glints.frustumCulled = false; root.add(glints);
    group.add(root); if (solids) { solids.sphere(cx, cb + 0.22, cz, 0.3); }
    const st = { root, x: cx, y: cb + 0.5, z: cz, open: 0, claimed: false, glints, lidPivot, coins, goldM };
    st.setClaimed = (v) => { st.claimed = v; coins.visible = !v; glints.visible = !v; };
    st.update = (dt, t, dv) => {
      const near = dv && Math.hypot(dv.x - st.x, dv.y - st.y, dv.z - st.z) < 4.2; const tgt = near && !st.claimed ? 1.05 : st.claimed ? 1.05 : 0.0; st.open += (tgt - st.open) * (1 - Math.exp(-dt * 3)); lidPivot.rotation.x = -st.open;
      if (glints.visible) { for (let i = 0; i < NG; i++) { const ph = gph[i] + t * 1.3; gp[i * 3] = Math.sin(ph * 1.7 + i) * 0.28; gp[i * 3 + 1] = 0.5 + ((ph * 0.35 + i * 0.37) % 1) * 0.55; gp[i * 3 + 2] = Math.cos(ph * 1.3 + i * 2) * 0.2; } gg.attributes.position.needsUpdate = true; gm.opacity = 0.55 + 0.4 * Math.sin(t * 5); }
      goldM.emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 3);
    };
    return st;
  })();

  /* ---------- 5) canlılar ---------- */
  const mat0 = (o = {}) => patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true, ...o }), {});
  // denizanası
  const jellies = []; {
    const bell = (() => { const g = new THREE.SphereGeometry(0.34, 14, 8, 0, TAU, 0, Math.PI * 0.55); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const f = 1 + 0.045 * Math.sin(a * 8); p.setXYZ(i, p.getX(i) * f, p.getY(i) * 0.82, p.getZ(i) * f); } g.deleteAttribute('uv'); return g; })();
    const tent = (() => { const parts = []; const r2 = mulberry(5); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = 0.2 + r2() * 0.08; const pos = [], l = 0.8 + r2() * 0.7; const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr; const g = new THREE.BufferGeometry(); const n = 5; for (let j = 0; j < n; j++) { const y0 = -j / n * l, y1 = -(j + 1) / n * l; const w0 = 0.012 * (1 - j / n), w1 = 0.012 * (1 - (j + 1) / n); const sx0 = Math.sin(j * 1.3 + i) * 0.04, sx1 = Math.sin((j + 1) * 1.3 + i) * 0.04; pos.push(ox + sx0 - w0, y0, oz, ox + sx0 + w0, y0, oz, ox + sx1 + w1, y1, oz, ox + sx0 - w0, y0, oz, ox + sx1 + w1, y1, oz, ox + sx1 - w1, y1, oz); } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); parts.push(g); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; const pos = [], l = 0.55; const ox = Math.cos(a) * 0.07, oz = Math.sin(a) * 0.07; const g = new THREE.BufferGeometry(); for (let j = 0; j < 4; j++) { const y0 = -0.02 - j / 4 * l, y1 = -0.02 - (j + 1) / 4 * l; const w0 = 0.05 * (1 - j / 5), w1 = 0.05 * (1 - (j + 1) / 5); const s0 = Math.sin(j * 1.1 + i) * 0.03, s1 = Math.sin((j + 1) * 1.1 + i) * 0.03; pos.push(ox + s0 - w0, y0, oz, ox + s0 + w0, y0, oz, ox + s1 + w1, y1, oz, ox + s0 - w0, y0, oz, ox + s1 + w1, y1, oz, ox + s1 - w1, y1, oz); } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); parts.push(g); }
      return mergeGeometries(parts); })();
    const cols = ['#bfe9ff', '#ffc2e6', '#d3c0ff', '#c8ffe3']; const mats = cols.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, transparent: true, opacity: 0.58, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    const tmats = cols.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.4, roughness: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    const nJ = isMobile ? 5 : 9;
    for (let i = 0; i < nJ; i++) {
      let x = 0, z = 30; for (let t = 0; t < 200; t++) { const xx = (rnd() - 0.5) * 90, zz = (rnd() - 0.5) * 80; if (terrainH(xx, zz) < -3.2 && lakeD(xx, zz) > 8 && islandD(xx, zz) < -6) { x = xx; z = zz; break; } }
      const g = new THREE.Group(); const b = new THREE.Mesh(bell, mats[i % 4]); const tn = new THREE.Mesh(tent, tmats[i % 4]); b.renderOrder = 2; tn.renderOrder = 2; g.add(b, tn); const sc = 0.8 + rnd() * 0.9; g.scale.setScalar(sc);
      const bed = terrainH(x, z); g.position.set(x, lerp(bed + 1.5, -1.4, rnd()), z); group.add(g); jellies.push({ g, b, tn, ph: rnd() * TAU, goal: new V3(x, g.position.y, z), t: 0, sc, vx: 0, vz: 0, vy: 0 });
    }
  }
  // kerevit (tatlı su istakozu)
  const crays = []; {
    const parts = []; const body = '#6a4630', claw = '#c4602a', belly = '#9c7550';
    parts.push(piece(new THREE.IcosahedronGeometry(0.1, 1), body, [0.04, 0.06, 0], null, [1.25, 0.62, 0.78], 1)); parts.push(piece(new THREE.IcosahedronGeometry(0.06, 0), body, [0.15, 0.065, 0], null, [1.1, 0.7, 0.8], 1.05));
    for (let i = 0; i < 4; i++) parts.push(piece(new THREE.BoxGeometry(0.075, 0.07 - i * 0.008, 0.14 - i * 0.022), i % 2 ? '#5d3c28' : body, [-0.1 - i * 0.07, 0.055, 0], [0, 0, 0], 1));
    parts.push(piece(new THREE.BoxGeometry(0.06, 0.012, 0.16), claw, [-0.4, 0.04, 0], [0, 0, 0], 1)); parts.push(piece(new THREE.ConeGeometry(0.035, 0.06, 4), claw, [-0.38, 0.045, 0.07], [0, 0, Math.PI / 2], 1));
    for (const s of [1, -1]) {
      parts.push(seg(new V3(0.13, 0.07, s * 0.07), new V3(0.26, 0.085, s * 0.14), 0.016, 0.014, 4, 1, body)); parts.push(seg(new V3(0.26, 0.085, s * 0.14), new V3(0.34, 0.07, s * 0.15), 0.014, 0.012, 4, 1, body));
      parts.push(piece(new THREE.IcosahedronGeometry(0.052, 0), claw, [0.4, 0.07, s * 0.15], null, [1.5, 0.55, 0.85], 1)); parts.push(piece(new THREE.ConeGeometry(0.022, 0.1, 4), claw, [0.47, 0.07, s * 0.185], [0, s * 0.3, -Math.PI / 2], 1)); parts.push(piece(new THREE.ConeGeometry(0.02, 0.09, 4), claw, [0.47, 0.07, s * 0.12], [0, -s * 0.3, -Math.PI / 2], 1));
      for (let l = 0; l < 4; l++) { const x = 0.1 - l * 0.045; parts.push(seg(new V3(x, 0.05, s * 0.06), new V3(x + 0.015, 0.0, s * (0.17 + l * 0.01)), 0.009, 0.006, 3, 0.9, belly)); }
      parts.push(seg(new V3(0.2, 0.08, s * 0.025), new V3(0.46, 0.14, s * 0.1), 0.005, 0.003, 3, 1.1, '#8a5a3a')); parts.push(piece(new THREE.SphereGeometry(0.012, 4, 3), '#000000', [0.2, 0.1, s * 0.035], null, 1));
    }
    const geo = fin(parts); const m = mat0({ roughness: 0.55 });
    const nC = isMobile ? 4 : 8;
    for (let i = 0; i < nC; i++) { const pt = reefPoint(1.0) || { x: (rnd() - 0.5) * 30, z: 30 + rnd() * 6, b: terrainH(0, 30) }; const mesh = new THREE.Mesh(geo, m); const s = 1.0 + rnd() * 0.7; mesh.scale.setScalar(s); mesh.castShadow = false; mesh.position.set(pt.x, pt.b, pt.z); group.add(mesh); crays.push({ m: mesh, a: rnd() * TAU, goal: new V3(pt.x, 0, pt.z), t: rnd() * 3, mode: 0, ph: rnd() * 6, s }); }
  }
  // kaplumbağa
  const turtles = []; {
    const shell = new THREE.SphereGeometry(0.5, 14, 9, 0, TAU, 0, Math.PI * 0.62); const p = shell.attributes.position; const c = new Float32Array(p.count * 3); const sc = new C3('#4d6a3a'), sd = new C3('#2f432a'), sy = new C3('#a88c4a');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const hx = Math.sin(x * 15) * Math.sin(z * 15 + x * 5); const bump = y > 0.1 ? 0.018 * hx : 0; p.setXYZ(i, x * 1.25 * (1 + bump), y * 0.62 + bump, z * 1.0 * (1 + bump)); tmpC.copy(sc).lerp(sd, smooth(0.2, 0.85, 0.5 + 0.5 * hx)).lerp(sy, smooth(0.28, 0.0, y) * 0.8).multiplyScalar(0.9 + 0.2 * vnoise(x * 6, z * 6)); c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b; }
    shell.setAttribute('color', new THREE.BufferAttribute(c, 3)); shell.deleteAttribute('uv'); shell.computeVertexNormals();
    const plast = tint(bare(new THREE.CircleGeometry(0.5, 14).rotateX(Math.PI / 2).scale(1.18, 1, 0.92).translate(0, -0.01, 0)), '#cdbf8e', 1);
    const skin = '#6f7f4a'; const bodyG = fin([shell, plast, piece(new THREE.IcosahedronGeometry(0.16, 1), skin, [0.74, 0.0, 0], null, [1.3, 0.85, 0.95], 1), piece(new THREE.SphereGeometry(0.02, 5, 4), '#0a0a0a', [0.86, 0.05, 0.075], null, 1), piece(new THREE.SphereGeometry(0.02, 5, 4), '#0a0a0a', [0.86, 0.05, -0.075], null, 1), seg(new V3(0.5, 0.0, 0), new V3(0.7, 0.0, 0), 0.07, 0.06, 6, 1, skin), piece(new THREE.ConeGeometry(0.06, 0.18, 5), skin, [-0.64, -0.04, 0], [0, 0, Math.PI / 2 + 0.1], 1)]);
    const flipG = (len, wd) => { const g = new THREE.IcosahedronGeometry(1, 1); g.scale(len, 0.05, wd); g.translate(len * 0.92, 0, 0); return tint(bare(g), skin, 1); };
    const fg = flipG(0.3, 0.12), rg = flipG(0.2, 0.09); const m = mat0({ roughness: 0.75 }); const nT = isMobile ? 1 : 2;
    for (let i = 0; i < nT; i++) {
      let x = 0, z = 28; for (let t = 0; t < 200; t++) { const xx = (rnd() - 0.5) * 80, zz = (rnd() - 0.5) * 70; if (terrainH(xx, zz) < -3.5 && lakeD(xx, zz) > 10 && islandD(xx, zz) < -7) { x = xx; z = zz; break; } }
      const g = new THREE.Group(); const body = new THREE.Mesh(bodyG, m); body.castShadow = false; g.add(body); const fl = [];
      for (const [px, pz, geo, sgn] of [[0.38, 0.38, fg, 1], [0.38, -0.38, fg, -1], [-0.36, 0.28, rg, 1], [-0.36, -0.28, rg, -1]]) { const pv = new THREE.Group(); pv.position.set(px, -0.03, pz); pv.rotation.y = sgn * (px > 0 ? -1.15 : -1.5) + (sgn < 0 ? Math.PI : 0); const f = new THREE.Mesh(geo, m); pv.add(f); g.add(pv); fl.push({ pv, sgn, front: px > 0 }); pv.userData.baseY = pv.rotation.y; }
      g.scale.setScalar(1.15 + rnd() * 0.35); const bed = terrainH(x, z); g.position.set(x, lerp(bed + 1.6, -2.2, 0.5), z); group.add(g); turtles.push({ g, fl, a: rnd() * TAU, speed: 0.55, goal: new V3(x, g.position.y, z), t: 0, ph: rnd() * 6 });
    }
  }
  const attractors = zones.map((q) => ({ x: q.x, z: q.z, y: terrainH(q.x, q.z) + 1.5 }));

  /* ---------- güncelleme ---------- */
  const dv = new V3();
  function update(dt, t, diver) {
    dt = Math.min(dt, 0.05);
    chest.update(dt, t, diver);
    for (const j of jellies) {
      j.t -= dt; const pos = j.g.position;
      if (j.t <= 0 || pos.distanceTo(j.goal) < 1.2) { j.t = 8 + rnd() * 8; for (let k = 0; k < 10; k++) { const nx = pos.x + (rnd() - 0.5) * 16, nz = pos.z + (rnd() - 0.5) * 16; const bd = terrainH(nx, nz); if (bd < -3 && lakeD(nx, nz) > 7 && islandD(nx, nz) < -5) { j.goal.set(nx, lerp(bd + 1.3, -1.3, rnd()), nz); break; } } }
      const pulse = Math.sin(t * 2.1 + j.ph); const push = Math.max(0, pulse) ** 2;
      const dx = j.goal.x - pos.x, dz = j.goal.z - pos.z, dl = Math.hypot(dx, dz) + 1e-3; j.vx += (dx / dl * 0.22 * (0.3 + push) - j.vx) * dt * 1.4; j.vz += (dz / dl * 0.22 * (0.3 + push) - j.vz) * dt * 1.4; j.vy += ((j.goal.y - pos.y) * 0.2 * (0.3 + push) - j.vy) * dt * 1.4;
      if (diver) { const ddx = pos.x - diver.x, ddy = pos.y - diver.y, ddz = pos.z - diver.z, dd = Math.hypot(ddx, ddy, ddz); if (dd < 2.2) { const f = (2.2 - dd) / 2.2 * 0.9; j.vx += ddx / dd * f * dt * 2; j.vz += ddz / dd * f * dt * 2; j.vy += ddy / dd * f * dt * 2; } }
      pos.x += j.vx * dt; pos.z += j.vz * dt; pos.y += j.vy * dt; const bd = terrainH(pos.x, pos.z); if (pos.y < bd + 0.8) pos.y += (bd + 0.8 - pos.y) * Math.min(1, dt * 3); if (pos.y > -0.9) pos.y -= (pos.y + 0.9) * Math.min(1, dt * 3);
      j.b.scale.set(1 - 0.12 * pulse, 1 + 0.2 * pulse, 1 - 0.12 * pulse); j.tn.scale.set(1 + 0.08 * pulse, 1 - 0.1 * pulse, 1 + 0.08 * pulse); j.tn.position.y = j.b.scale.y * 0.02; j.g.rotation.y += dt * 0.15; j.g.rotation.x = Math.sin(t * 0.7 + j.ph) * 0.06;
    }
    for (const c of crays) {
      const pos = c.m.position; c.t -= dt; let flee = false;
      if (diver) { const dx = pos.x - diver.x, dz = pos.z - diver.z, dy = (pos.y + 0.1) - diver.y; const d = Math.hypot(dx, dy, dz); if (d < 2.0) { flee = true; c.goal.set(pos.x + dx / (d + 1e-3) * 2, 0, pos.z + dz / (d + 1e-3) * 2); c.mode = 1; c.t = 0.6; } }
      if (c.t <= 0) { if (c.mode === 1 || rnd() < 0.5) { c.mode = 0; c.t = 1.5 + rnd() * 3; } else { c.mode = 2; c.t = 2 + rnd() * 3; const a = rnd() * TAU, d = 0.8 + rnd() * 2.2; const nx = pos.x + Math.cos(a) * d, nz = pos.z + Math.sin(a) * d; c.goal.set(nx, 0, nz); } }
      if (c.mode !== 0) { const dx = c.goal.x - pos.x, dz = c.goal.z - pos.z; const da = Math.atan2(dz, dx); let d2 = da - c.a; d2 = Math.atan2(Math.sin(d2), Math.cos(d2)); c.a += clamp(d2, -(flee ? 7 : 3) * dt, (flee ? 7 : 3) * dt); const sp = (flee ? 0.9 : 0.16) * c.s; const nx = pos.x + Math.cos(c.a) * sp * dt, nz = pos.z + Math.sin(c.a) * sp * dt; const nb = terrainH(nx, nz); if (nb < -0.9 && Math.abs(nb - pos.y) < 0.25 && islandD(nx, nz) < -2) { pos.x = nx; pos.z = nz; } else { c.mode = 0; c.t = 1; } c.ph += dt * (flee ? 22 : 8); } else c.ph += dt * 0.5;
      pos.y += (terrainH(pos.x, pos.z) + 0.005 - pos.y) * Math.min(1, dt * 8);
      c.m.rotation.y = -c.a; c.m.rotation.z = c.mode ? Math.sin(c.ph) * 0.05 : 0; c.m.rotation.x = c.mode ? Math.cos(c.ph * 0.5) * 0.04 : 0;
    }
    for (const u of turtles) {
      const pos = u.g.position; u.t -= dt;
      if (u.t <= 0 || Math.hypot(u.goal.x - pos.x, u.goal.z - pos.z) < 1.6) { u.t = 8 + rnd() * 8; for (let k = 0; k < 12; k++) { const a = u.a + (rnd() - 0.5) * 2.6, d = 6 + rnd() * 12; const nx = pos.x + Math.cos(a) * d, nz = pos.z + Math.sin(a) * d; const bd = terrainH(nx, nz); if (bd < -3.2 && lakeD(nx, nz) > 8 && islandD(nx, nz) < -6) { u.goal.set(nx, lerp(bd + 1.2, -1.8, rnd()), nz); break; } } }
      let spd = u.speed; let tx = u.goal.x, tz = u.goal.z;
      if (diver) { const dx = pos.x - diver.x, dz = pos.z - diver.z, dy = pos.y - diver.y; const d = Math.hypot(dx, dy, dz); if (d < 3.4) { tx = pos.x + dx * 3; tz = pos.z + dz * 3; spd = 1.5; } }
      let da = Math.atan2(tz - pos.z, tx - pos.x) - u.a; da = Math.atan2(Math.sin(da), Math.cos(da)); u.a += clamp(da, -0.9 * dt, 0.9 * dt);
      const nx = pos.x + Math.cos(u.a) * spd * dt, nz = pos.z + Math.sin(u.a) * spd * dt; if (terrainH(nx, nz) < -2.8 && islandD(nx, nz) < -4 && lakeD(nx, nz) > 5) { pos.x = nx; pos.z = nz; } else { u.t = 0; u.a += 0.8; }
      const bd = terrainH(pos.x, pos.z); const wy = clamp(u.goal.y, bd + 1.0, -1.2); pos.y += (wy - pos.y) * Math.min(1, dt * 0.8);
      u.ph += dt * (2.2 + spd * 1.6); u.g.rotation.y = -u.a; u.g.rotation.z = Math.sin(u.ph) * 0.06 + (wy - pos.y) * 0.15; u.g.rotation.x = Math.sin(u.ph + 1) * 0.05;
      for (const f of u.fl) { const stroke = Math.sin(u.ph + (f.sgn > 0 ? 0 : Math.PI * 0.0)); f.pv.rotation.z = f.sgn * stroke * (f.front ? 0.6 : 0.3); f.pv.rotation.y = f.pv.userData.baseY + stroke * (f.front ? 0.18 : 0.08) * f.sgn; }
    }
  }
  let shallow = null;
  /* ---------- 8) kıyı sığlığı: yosunlu, dipten görünen taşlar (suyun içinden seçilir, bir kısmı sudan çıkar) ---------- */
  { const shallowOk = (x, z) => { if (lakeD(x, z) < 0.8 || islandD(x, z) > -1.2 || avoid(x, z)) return null; const b = terrainH(x, z); return (b < -0.28 && b > -2.5) ? b : null; };
    const rm = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), {});
    const im = new THREE.InstancedMesh(rockGeometry(77, 0.95), rm, cn(190)); let n = 0; const cen = []; const col = new C3();
    for (let t = 0; t < 30000 && n < im.instanceMatrix.count; t++) {
      let x, z, c0 = null; if (cen.length && rnd() < 0.78) { c0 = cen[(rnd() * cen.length) | 0]; if (c0.k >= 9) continue; const a = rnd() * TAU, d = 0.3 + rnd() * 2.8; x = c0.x + Math.cos(a) * d; z = c0.z + Math.sin(a) * d; } else { x = (rnd() - 0.5) * 150; z = (rnd() - 0.5) * 140; }
      const b = shallowOk(x, z); if (b === null || slopeAt(x, z) > 1.1) continue;
      if (c0) c0.k++; else if (!cen.some((q) => Math.hypot(q.x - x, q.z - z) < 5)) cen.push({ x, z, k: 1 }); else continue;
      const s0 = 0.22 + Math.pow(rnd(), 2.2) * 1.05, ry = rnd() * TAU;
      put(im, n, x, b + s0 * 0.12, z, s0 * 1.25, s0 * (0.8 + rnd() * 0.4), s0 * 1.1, ry, 0.35);
      const g = 0.5 + rnd() * 0.3; col.setRGB(g * (1.0 + rnd() * 0.2), g * (0.9 + rnd() * 0.12), g * (0.5 + rnd() * 0.2)); im.setColorAt(n, col);
      if (solids && s0 > 0.55) solids.ellipsoid(x, b + s0 * 0.12, z, 1.3 * s0, 0.62 * s0, 1.05 * s0, ry);
      n++; }
    finish(im, n, !isMobile); shallow = im; group.remove(im); }

  return { group, shallow, zones, clear, chest, arches, spills, attractors, update, jellies, crays, turtles };
}
