import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry, smooth, clamp, lerp, fbm } from './world.js';
import { V3, Q4, C3, TAU, tint, bare, piece, beamGeo, patchDiveMaterial } from './diveutil.js';

/**
 *  BATIK GEMİLER — 4 tür: rowboat (kürek teknesi), dinghy (küçük sandal), schooner (büyük yelkenli), trawler (balıkçı trolü)
 *  createWreck(type, { x, z, bedY, rotY, seed })  → group (userData: holes, radius, type, length)
 *  findWreckSpots(specs, ctx)                      → derin ve düz yerleri seçip her gemiye yer verir
 */
export const WRECK_TYPES = {
  rowboat: { L: 5.6, radius: 4.2 },
  dinghy: { L: 3.4, radius: 2.6 },
  schooner: { L: 15, radius: 10.5 },
  trawler: { L: 10.5, radius: 7.6 },
};

const WOOD = ['#6e5a42', '#5f4d38', '#7b6a52', '#54442f'];
const RUST = ['#6b4430', '#7a4a2e', '#5c5a4c', '#3f5a5e', '#85553a'];
const tri = (arr, a, b, c) => { arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
const quad = (arr, a, b, c, d) => { tri(arr, a, b, c); tri(arr, a, c, d); };
const UP = new V3(0, 1, 0);

/* ---------- gövde ---------- */
function makeHull(cfg, rnd) {
  const { L, Wm, Hm, NU, NV, T, pal, holes, taper = 0.55, sternW = 0.62, skip, mossK = 1, mossCol = '#4b7230', algaCol = '#2f5a2a', siltCol = '#6f6c5c', ribStep = 2, ribW = 0.07, plankJit = 1 } = cfg;
  const Hh = (u) => Hm * (0.74 + 0.38 * u * u + 0.06 * (1 - u));
  const Wd = (u) => { let w = Wm; if (u < 0.18) w *= lerp(sternW, 1, smooth(0, 0.18, u)); if (u > taper) w *= Math.max(0.04, Math.cos((u - taper) / (1 - taper) * Math.PI / 2 * 0.97)); return w; };
  const sect = (u, v, side) => { const w = Wd(u), h = Hh(u), a = v * Math.PI / 2; return new V3((u - 0.5) * L, h * (1 - Math.cos(a)) * 0.98, side * w * Math.pow(Math.sin(a), 0.85)); };
  /** y yüksekliğinde gövde yarı genişliği */
  const halfW = (u, y) => { const r = clamp(y / (Hh(u) * 0.98), 0, 1); return Wd(u) * Math.pow(Math.sin(Math.acos(1 - r)), 0.85); };
  const moss = new C3(mossCol), alga = new C3(algaCol), silt = new C3(siltCol); const col = new C3();
  const pos = [], cols = [], blobs = [], parts = []; const solids = [];
  for (const side of [1, -1]) for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const u0 = i / NU, u1 = (i + 1) / NU, v0 = j / NV, v1 = (j + 1) / NV, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    let edge = 0, sk = false;
    for (const h of holes) if (h.s === side) { const d = ((uc - h.u) / h.ru) ** 2 + ((vc - h.v) / h.rv) ** 2; if (d < 0.85 + (rnd() - 0.5) * 0.45) sk = true; else if (d < 1.9) edge = Math.max(edge, 1.9 - d); }
    if (!sk && skip && skip(side, uc, vc, rnd)) sk = true;
    if (sk) continue;
    const jit = (k) => (rnd() - 0.5) * k;
    const p00 = sect(u0, v0, side), p10 = sect(u1, v0, side), p11 = sect(u1, v1, side), p01 = sect(u0, v1, side);
    const n = new V3().crossVectors(new V3().subVectors(p10, p00), new V3().subVectors(p01, p00)).normalize(); const cen = new V3((p00.x + p11.x) / 2, Hh(uc) * 0.4, 0); if (n.dot(cen.sub(p00)) < 0) n.negate();
    const t = T * (1 + rnd() * 0.3), jj = (0.012 + edge * 0.035) * plankJit * (T / 0.05); for (const p of [p00, p10, p11, p01]) { p.x += jit(jj); p.y += jit(jj); p.z += jit(jj); }
    solids.push([(p00.x + p11.x) / 2, (p00.y + p11.y) / 2, (p00.z + p11.z) / 2, Math.max(0.1, 0.46 * Math.max(p00.distanceTo(p10), p00.distanceTo(p01)))]);
    const outer = [p00, p10, p11, p01], inner = outer.map((p) => p.clone().addScaledVector(n, t * (1 + (edge > 0 ? rnd() * 0.5 : 0))));
    quad(pos, outer[0], outer[1], outer[2], outer[3]); quad(pos, inner[3], inner[2], inner[1], inner[0]);
    for (let e = 0; e < 4; e++) { const a = outer[e], b = outer[(e + 1) % 4], a2 = inner[e], b2 = inner[(e + 1) % 4]; quad(pos, a, b, b2, a2); }
    col.set(pal[(j + (i % 2) + (side > 0 ? 0 : 1)) % pal.length]); const mv = smooth(0.42, 0.78, fbm(uc * 6 + side * 3.1 + L, vc * 5 + 2.7)) * (0.35 + 0.65 * (1 - vc * 0.6)) * mossK;
    col.lerp(moss, mv * 0.85).lerp(alga, mv * mv * 0.5).lerp(silt, (1 - vc) * (1 - vc) * 0.4); if (edge > 0) col.multiplyScalar(0.65); col.multiplyScalar(0.88 + rnd() * 0.24);
    for (let q = 0; q < 36; q++) cols.push(col.r, col.g, col.b);
    if (vc > 0.35 && mv > 0.28 && rnd() < 0.55) blobs.push({ p: p00.clone().lerp(p11, 0.5).addScaledVector(n, -0.03), n: n.clone().negate(), s: (0.1 + rnd() * 0.18) * Math.sqrt(L / 5.6) });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); parts.push(g);
  const dark = new C3(cfg.dark || '#3b2f22'); const beamC = (k) => dark.clone().lerp(moss, k);
  const addBeam = (a, b, w, h, c) => { parts.push(tint(bare(beamGeo(a, b, w, h)), c)); const r = 0.5 * Math.max(w, h); if (r >= 0.075) { const len = a.distanceTo(b); const n = Math.min(14, Math.max(1, Math.ceil(len / (r * 1.6)))); for (let i = 0; i <= n; i++) { const t = i / n; solids.push([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, Math.max(r, 0.09)]); } } };
  // omurga
  for (let i = 0; i < NU; i++) { const a = sect(i / NU, 0, 1), b = sect((i + 1) / NU, 0, 1); a.z = b.z = 0; addBeam(a, b, ribW * 1.7, ribW * 1.4, beamC(0.15 + rnd() * 0.2)); }
  // kaburgalar (bazıları kırık)
  for (const side of [1, -1]) for (let i = 1; i < NU; i += ribStep) {
    if (rnd() < 0.12) continue; let prev = null;
    for (let j = 1; j <= NV; j++) { const p = sect(i / NU, j / NV, side); p.addScaledVector(new V3(0, 0.02, -side * ribW * 0.9), 1); if (prev && !(j > NV * 0.6 && rnd() < 0.18 && i < NU * 0.35)) addBeam(prev, p, ribW, ribW, beamC(rnd() * 0.3)); prev = p; }
  }
  // küpeşte
  for (const side of [1, -1]) for (let i = 0; i < NU; i++) { if (rnd() < 0.2) continue; const a = sect(i / NU, 1, side), b = sect((i + 1) / NU, 1, side); a.y += 0.03; b.y += 0.03; addBeam(a, b, ribW * 1.3, ribW * 0.7, beamC(0.2 + rnd() * 0.3)); }
  return { parts, blobs, sect, Hh, Wd, halfW, moss, alga, beamC, addBeam, dark, solids };
}

/* ---------- ortak: birleştir, malzeme, çamur yığını ---------- */
function finishWreck(name, L, parts, blobs, rnd, { tiltRot, sink, moundK = 1, algae = true, pal = WOOD, extra = null, solids = [] } = {}) {
  const root = new THREE.Group(); root.name = name; const tilt = new THREE.Group(); root.add(tilt);
  if (algae) for (const b of blobs) { const q = new Q4().setFromUnitVectors(UP, b.n); const e = new THREE.Euler().setFromQuaternion(q); parts.push(piece(new THREE.IcosahedronGeometry(1, 0), rnd() < 0.5 ? '#3f7a2c' : '#2f5a2a', [b.p.x, b.p.y, b.p.z], [e.x, e.y, e.z], [b.s * 1.4, b.s * 0.35, b.s], 0.9 + rnd() * 0.3)); }
  const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))); parts.forEach((p) => p.dispose());
  const mat = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }), { sway: 0 });
  const hull = new THREE.Mesh(geo, mat); hull.castShadow = true; hull.receiveShadow = true; tilt.add(hull);
  tilt.rotation.set(tiltRot[0], tiltRot[1], tiltRot[2]); tilt.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(tilt); tilt.position.y -= bb.min.y + sink;
  const sg = new THREE.IcosahedronGeometry(1, 1); sg.scale(L * 0.48 + 0.3, 0.2 + L * 0.012, L * 0.24 + 0.5); const mound = new THREE.Mesh(sg, patchDiveMaterial(new THREE.MeshStandardMaterial({ color: '#6c6955', roughness: 1, flatShading: true }), {})); mound.position.y = -0.04 + (moundK - 1) * 0.1; root.add(mound);
  root.userData.tilt = tilt; root.userData.hull = hull; root.userData.solidsLocal = solids; return root;
}

/* ---------- küçük sahne malzemeleri (varil, sandık, amfora …) ---------- */
export function barrelGeo(rnd = Math.random) {
  const pr = [[0.01, 0], [0.2, 0], [0.26, 0.12], [0.285, 0.27], [0.26, 0.42], [0.2, 0.54], [0.01, 0.54]].map((p) => new THREE.Vector2(p[0], p[1]));
  const body = tint(bare(new THREE.LatheGeometry(pr, 9)), '#7c5a38', 0.9 + rnd() * 0.2);
  const b1 = piece(new THREE.TorusGeometry(0.272, 0.014, 4, 12), '#3a3a38', [0, 0.14, 0], [Math.PI / 2, 0, 0], 1); const b2 = piece(new THREE.TorusGeometry(0.272, 0.014, 4, 12), '#3a3a38', [0, 0.4, 0], [Math.PI / 2, 0, 0], 1);
  return mergeGeometries([body, b1, b2]);
}
export function crateGeo(rnd = Math.random) {
  const box = piece(new THREE.BoxGeometry(0.55, 0.38, 0.42), '#7a6140', null, null, 1, 0.9 + rnd() * 0.2);
  const s1 = piece(new THREE.BoxGeometry(0.57, 0.05, 0.44), '#4d3c28', [0, 0.1, 0], null, 1); const s2 = piece(new THREE.BoxGeometry(0.57, 0.05, 0.44), '#4d3c28', [0, -0.1, 0], null, 1);
  return mergeGeometries([box, s1, s2]);
}
export function amphoraGeo(rnd = Math.random) {
  const pr = [[0.001, 0], [0.07, 0.02], [0.19, 0.18], [0.235, 0.38], [0.18, 0.6], [0.09, 0.76], [0.075, 0.88], [0.105, 0.94], [0.09, 0.97]].map((p) => new THREE.Vector2(p[0], p[1]));
  const body = tint(bare(new THREE.LatheGeometry(pr, 9)), '#a65e3a', 0.85 + rnd() * 0.25);
  const h1 = piece(new THREE.TorusGeometry(0.11, 0.018, 4, 8, Math.PI), '#8d4f30', [0, 0.82, 0.07], [0, 0, 0], 1); h1.applyMatrix4(new THREE.Matrix4().makeRotationX(0));
  const h2 = piece(new THREE.TorusGeometry(0.11, 0.018, 4, 8, Math.PI), '#8d4f30', [0, 0.82, -0.07], [0, 0, 0], 1);
  const hh1 = piece(new THREE.TorusGeometry(0.1, 0.018, 4, 8, Math.PI), '#8d4f30', [0.09, 0.8, 0], [0, Math.PI / 2, 0], 1); const hh2 = piece(new THREE.TorusGeometry(0.1, 0.018, 4, 8, Math.PI), '#8d4f30', [-0.09, 0.8, 0], [0, Math.PI / 2, 0], 1);
  return mergeGeometries([body, hh1, hh2]);
}
/** batığın çevresine varil/sandık/amfora/tahta serpiştirir (yarı gömülü) */
function scatterDebris(root, rnd, { n, r0, r1, kinds }) {
  const parts = []; const mk = { barrel: () => barrelGeo(rnd), crate: () => crateGeo(rnd), amphora: () => amphoraGeo(rnd) };
  for (let k = 0; k < n; k++) {
    const kind = kinds[(rnd() * kinds.length) | 0]; const a = rnd() * TAU, d = r0 + rnd() * (r1 - r0); const g = mk[kind](); const s = 0.9 + rnd() * 0.35;
    const lying = rnd() < 0.6; const q = new Q4().setFromEuler(new THREE.Euler(lying ? Math.PI / 2 + (rnd() - 0.5) * 0.3 : (rnd() - 0.5) * 0.3, rnd() * TAU, (rnd() - 0.5) * 0.3));
    const half = kind === 'barrel' ? 0.27 : kind === 'amphora' ? 0.2 : 0.17;
    g.applyMatrix4(new THREE.Matrix4().compose(new V3(Math.cos(a) * d, lying ? half * 0.7 : kind === 'crate' ? 0.15 : 0.0, Math.sin(a) * d * 0.75), q, new V3(s, s, s)));
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  if (!parts.length) return; const m = new THREE.Mesh(mergeGeometries(parts), patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), {})); m.castShadow = true; root.add(m);
}
function scatterBoards(root, rnd, n, r0, r1, pal = WOOD) {
  for (let k = 0; k < n; k++) { const a = rnd() * TAU, d = r0 + rnd() * (r1 - r0); const g = new THREE.Mesh(new THREE.BoxGeometry(0.9 + rnd() * 1.1, 0.05, 0.2), patchDiveMaterial(new THREE.MeshStandardMaterial({ color: pal[k % pal.length], roughness: 1, flatShading: true }), {})); g.position.set(Math.cos(a) * d, 0.06, Math.sin(a) * d * 0.7); g.rotation.set((rnd() - 0.5) * 0.2, rnd() * 3, (rnd() - 0.5) * 0.2); g.castShadow = true; root.add(g); }
}
function ropeSag(addBeam, a, b, sag, w, c, segs = 4) { let prev = a.clone(); for (let i = 1; i <= segs; i++) { const t = i / segs; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; addBeam(prev, p, w, w, c); prev = p; } }
/** yırtık yelken: ızgara, bazı üçgenler eksik */
function tornSail(p0, p1, hang, rnd, cfg = {}) {
  const NX = cfg.nx || 8, NY = cfg.ny || 6; const pts = []; const pos = [], cols = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY; const base = p0.clone().lerp(p1, u); const w = Math.sin(u * 5 + v * 3 + (cfg.ph || 0)) * 0.12 * v + (rnd() - 0.5) * 0.03;
    pts.push(new V3(base.x, base.y - hang * v * (1 - 0.25 * Math.sin(u * 3.1)) + (rnd() - 0.5) * 0.04, base.z + w + v * (cfg.drop || 0.5)));
  }
  const c0 = new C3('#d4c9a6'), c1 = new C3('#8e9a74'); const cc = new C3();
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = pts[j * (NX + 1) + i], b = pts[j * (NX + 1) + i + 1], c = pts[(j + 1) * (NX + 1) + i + 1], d = pts[(j + 1) * (NX + 1) + i]; const tearN = fbm(i * 0.9 + (cfg.ph || 0) * 3, j * 0.9 + 4); const torn = j > 1 && tearN > 0.64 + (0.5 - j / NY) * 0.1;
    if (torn && rnd() < 0.9) continue;
    cc.copy(c0).lerp(c1, smooth(0.2, 1, j / NY) * (0.4 + 0.6 * rnd())).multiplyScalar(0.85 + rnd() * 0.2);
    quad(pos, a, b, c, d); for (let q = 0; q < 6; q++) cols.push(cc.r, cc.g, cc.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
/** yüzeye dik (normal doğrultusunda) bir halka / disk yerleştir */
function orient(geo, color, p, n, scl = 1, k = 1) {
  const g = bare(geo.clone()); const q = new Q4().setFromUnitVectors(new V3(0, 0, 1), n); g.applyMatrix4(new THREE.Matrix4().compose(p, q, new V3(scl, scl, scl))); g.computeVertexNormals(); return tint(g, color, k);
}

/* ============================================================
 *  KÜREK TEKNESİ (orijinal batık) ve küçük sandal
 * ============================================================ */
function buildRowboat(rnd, small) {
  const L = small ? 3.4 : 5.6, Wm = small ? 0.58 : 0.9, Hm = small ? 0.58 : 1.0, NU = small ? 9 : 14, NV = small ? 5 : 7;
  const holes = small ? [{ u: 0.45, v: 0.4, s: 1, ru: 0.14, rv: 0.34 }] : [{ u: 0.4, v: 0.45, s: 1, ru: 0.12, rv: 0.34 }, { u: 0.73, v: 0.6, s: -1, ru: 0.1, rv: 0.3 }, { u: 0.2, v: 0.28, s: -1, ru: 0.09, rv: 0.27 }, { u: 0.6, v: 0.12, s: 1, ru: 0.1, rv: 0.2 }];
  const H = makeHull({ L, Wm, Hm, NU, NV, T: small ? 0.036 : 0.055, pal: WOOD, holes, ribW: small ? 0.05 : 0.07, skip: (side, uc, vc, r) => (side < 0 && vc > 0.78 && uc < 0.22 && r() < 0.7) || (side > 0 && vc > 0.84 && uc > 0.45 && uc < 0.62 && r() < 0.8) }, rnd);
  const { parts, blobs, sect, Hh, Wd, addBeam } = H; const dark = '#3b2f22', k = L / 5.6;
  addBeam(new V3(L / 2 - 0.02, 0, 0), new V3(L / 2 + 0.06, Hh(1) * 0.98, 0), 0.12 * k + 0.03, 0.1 * k + 0.03, dark);
  for (let r = 0; r < 4; r++) { const yy = (r + 0.5) * Hh(0) / 4, w2 = Wd(0) * Math.sin(Math.acos(1 - clamp(yy / Hh(0), 0, 1))) * 1.0 + 0.1; if (r === 3 && rnd() < 0.6) continue; addBeam(new V3(-L / 2, yy, -w2), new V3(-L / 2, yy + (r === 2 ? 0.04 : 0), w2), 0.05, Hh(0) / 4 * 0.9, WOOD[r % 4]); }
  for (const [u, broken] of [[0.3, false], [0.52, true], [0.7, false]]) { const w = Wd(u) * 0.93, y = Hh(u) * 0.55, x = (u - 0.5) * L; if (small && u === 0.52) continue; if (broken) addBeam(new V3(x, y, -w), new V3(x, y + 0.2, 0.1), 0.28 * k + 0.05, 0.05, WOOD[1]); else addBeam(new V3(x, y, -w), new V3(x, y, w), 0.28 * k + 0.05, 0.05, WOOD[2]); }
  if (!small) {
    addBeam(new V3(0.35, 0.1, 0), new V3(0.45, 0.95, 0.03), 0.1, 0.1, dark); addBeam(new V3(0.45, 0.95, 0.03), new V3(0.7, 1.15, 0.2), 0.07, 0.07, dark);
    addBeam(new V3(-1.2, 0.12, -0.55), new V3(0.4, 0.55, 0.7), 0.1, 0.1, '#4d3d2b');
    for (let q = 0; q < 5; q++) { if (rnd() < 0.3) continue; const x = -1.8 + q * 0.75; addBeam(new V3(x, 0.05, -0.4), new V3(x + 0.55, 0.05, 0.4), 0.2, 0.035, WOOD[q % 4]); }
    parts.push(piece(new THREE.TorusGeometry(0.22, 0.045, 5, 14), '#8a7a55', [-1.5, 0.12, 0.35], [Math.PI / 2, 0, 0.2], 1, 0.9));
    parts.push(piece(new THREE.IcosahedronGeometry(1, 1), '#3f5f45', [0.9, 0.18, -0.25], [0, 0.4, 0], [0.55, 0.2, 0.42], 1));
    parts.push(piece(new THREE.BoxGeometry(0.4, 0.28, 0.3), '#5a4733', [-0.4, 0.2, -0.42], [0, 0.4, 0.15], 1, 0.9));
  } else {
    addBeam(new V3(-0.9, 0.35, -0.6), new V3(0.9, 0.12, 0.62), 0.045, 0.04, '#6b573a');      // kürek
    parts.push(piece(new THREE.BoxGeometry(0.34, 0.03, 0.12), '#6b573a', [0.95, 0.1, 0.65], [0, 0.3, 0.1], 1));
    parts.push(piece(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 7), '#5c6a70', [-0.5, 0.15, 0.1], [0.2, 0, 0.3], 1));  // kova
  }
  const root = finishWreck(small ? 'dinghyWreck' : 'rowboatWreck', L, parts, blobs, rnd, { tiltRot: small ? [0.5, 0, -0.15] : [0.42, 0, 0.1], sink: small ? 0.2 : 0.28, solids: H.solids });
  scatterBoards(root, rnd, small ? 3 : 6, small ? 1.6 : 2.6, small ? 2.6 : 4.8);
  root.userData.holeFn = () => holes.map((h) => root.userData.tilt.localToWorld(sect(h.u, h.v, h.s)));
  return { root, sect };
}

/* ============================================================
 *  BÜYÜK YELKENLİ (schooner)
 * ============================================================ */
function buildSchooner(rnd) {
  const L = 15, Wm = 2.1, Hm = 2.05, NU = 26, NV = 8;
  const holes = [{ u: 0.36, v: 0.5, s: 1, ru: 0.07, rv: 0.34 }, { u: 0.64, v: 0.62, s: -1, ru: 0.08, rv: 0.3 }, { u: 0.2, v: 0.32, s: -1, ru: 0.06, rv: 0.28 }, { u: 0.52, v: 0.14, s: 1, ru: 0.07, rv: 0.2 }, { u: 0.8, v: 0.5, s: 1, ru: 0.05, rv: 0.28 }];
  const H = makeHull({ L, Wm, Hm, NU, NV, T: 0.085, pal: WOOD, holes, taper: 0.62, ribStep: 2, ribW: 0.12, plankJit: 0.8,
    skip: (side, uc, vc, r) => (side < 0 && vc > 0.55 && uc < 0.26 && r() < 0.6) || (side > 0 && vc > 0.62 && uc > 0.78 && r() < 0.5) || (side < 0 && vc > 0.8 && uc > 0.4 && uc < 0.5 && r() < 0.8) }, rnd);
  const { parts, blobs, sect, Hh, Wd, halfW, addBeam, dark, beamC } = H; const yd = Hm * 0.72;
  const X = (u) => (u - 0.5) * L; const dk = '#3b2f22';
  // güverte tahtaları (enine; yarısı çürümüş)
  for (let x = -L / 2 + 0.5; x < L / 2 - 0.9; x += 0.34) { const u = x / L + 0.5; const hw = halfW(u, yd) * 0.94; if (hw < 0.1) continue; const dec = (x < -L / 2 + 3.8 && x > -L / 2 + 1.1) ? 0.05 : 0.0; const r = rnd();
    if (r < 0.26 + dec) continue; const z0 = r < 0.46 ? 0 : -hw, z1 = r > 0.84 ? 0 : hw; if (z1 - z0 < 0.1) continue; addBeam(new V3(x, yd + (rnd() - 0.5) * 0.04, z0), new V3(x, yd + (rnd() - 0.5) * 0.04, z1), 0.3, 0.05, WOOD[(rnd() * 4) | 0]); }
  // güverte kirişleri
  for (let x = -L / 2 + 0.7; x < L / 2 - 1; x += 1.4) { const hw = halfW(x / L + 0.5, yd - 0.1); addBeam(new V3(x, yd - 0.1, -hw), new V3(x, yd - 0.1, hw), 0.14, 0.12, beamC(0.2 + rnd() * 0.2)); }
  // boyuna kirişler
  for (const zz of [-0.7, 0.7]) addBeam(new V3(-L / 2 + 0.6, yd - 0.12, zz), new V3(L / 2 - 1.1, yd - 0.12, zz * 0.7), 0.12, 0.12, beamC(0.2));
  // kıç aynalığı & tekne başı sütunu
  addBeam(new V3(L / 2 - 0.02, 0, 0), new V3(L / 2 + 0.18, Hh(1) * 0.98, 0), 0.2, 0.16, dark);
  for (let r = 0; r < 6; r++) { const yy = (r + 0.5) * Hh(0) / 6, w2 = halfW(0, yy) + 0.1; if (r > 3 && rnd() < 0.5) continue; addBeam(new V3(-L / 2, yy, -w2), new V3(-L / 2, yy, w2), 0.08, Hh(0) / 6 * 0.9, WOOD[r % 4]); }
  // bukşpirit (baş direği)
  addBeam(new V3(L / 2 - 0.2, Hh(1) * 0.9, 0), new V3(L / 2 + 2.9, Hh(1) * 0.9 + 0.9, 0.05), 0.16, 0.16, '#5d4a34');
  // ana direk (ayakta, tepesi kırık)
  const m1 = X(0.58); addBeam(new V3(m1, yd - 0.2, 0), new V3(m1 + 0.12, yd + 5.4, 0.04), 0.3, 0.3, '#5a4731'); parts.push(piece(new THREE.ConeGeometry(0.17, 0.5, 5), '#6d5a3f', [m1 + 0.13, yd + 5.6, 0.04], [0.15, 0, 0.1], [1, 1, 1]));
  addBeam(new V3(m1 + 0.1, yd + 4.6, -1.0), new V3(m1 + 0.1, yd + 4.6, 1.0), 0.1, 0.1, '#5a4731');            // çapraz çıta
  addBeam(new V3(m1, yd + 1.7, 0.1), new V3(m1 - 4.2, yd + 1.25, 0.7), 0.17, 0.17, '#4d3d2b');                   // bom
  // yırtık ana yelken (bomdan sarkık)
  { const sg = tornSail(new V3(m1 - 0.15, yd + 1.6, 0.18), new V3(m1 - 4.1, yd + 1.2, 0.68), 1.55, rnd, { nx: 9, ny: 6, ph: 1.3, drop: 0.45 }); parts.push(sg); }
  // üst yelken artığı
  { const sg = tornSail(new V3(m1 + 0.25, yd + 4.5, 0.0), new V3(m1 + 0.25, yd + 4.5, 0.9), 1.6, rnd, { nx: 4, ny: 6, ph: 0.4, drop: 0.2 }); parts.push(sg); }
  // ikinci direk (devrilmiş, korkuluğa yaslanmış)
  const m2 = X(0.33); addBeam(new V3(m2, yd - 0.1, 0.1), new V3(m2 - 0.7, yd + 1.1, 1.45), 0.26, 0.26, '#5a4731'); addBeam(new V3(m2 - 0.7, yd + 1.1, 1.45), new V3(m2 - 1.5, yd - 0.8, 3.1), 0.22, 0.22, '#5a4731'); parts.push(piece(new THREE.ConeGeometry(0.15, 0.5, 5), '#6d5a3f', [m2 - 1.6, yd - 1.0, 3.35], [Math.PI / 2 + 0.3, 0, 0.5], [1, 1, 1]));
  // halatlar (donanım)
  const topM = new V3(m1 + 0.1, yd + 5.1, 0.04);
  for (const s of [-1, 1]) { ropeSag(addBeam, topM, new V3(m1 + 0.7, Hh(0.58) * 0.96, s * halfW(0.6, Hh(0.58) * 0.96)), 0.12, 0.03, '#7b6a45', 3); if (rnd() < 0.8) ropeSag(addBeam, new V3(m1 + 0.1, yd + 3.4, 0.04), new V3(m1 - 0.6, Hh(0.5) * 0.96, s * halfW(0.5, Hh(0.5) * 0.96)), 0.1, 0.03, '#7b6a45', 3); }
  ropeSag(addBeam, topM, new V3(L / 2 - 0.3, Hh(1) * 0.9, 0), 0.5, 0.035, '#8b7a50', 5);
  ropeSag(addBeam, new V3(m1 - 3.9, yd + 1.2, 0.68), new V3(-L / 2 + 0.7, yd + 0.4, 0.6), 0.6, 0.03, '#8b7a50', 4);
  addBeam(new V3(m1 + 0.15, yd + 5.0, 0.1), new V3(m1 + 0.9, yd + 2.0, 2.6), 0.03, 0.03, '#7b6a45');             // aşağı sarkan halat
  // kıç kamarası (pencereler boş, çatı yarı çökmüş)
  { const xf = -L / 2 + 3.9, xb = -L / 2 + 1.35, hw = halfW((xf / L + 0.5), yd) * 0.82, hh = 1.75;
    for (let z = -hw; z <= hw + 0.01; z += 0.62) { if (rnd() < 0.1) continue; addBeam(new V3(xf, yd, z), new V3(xf, yd + hh * (0.9 + rnd() * 0.12), z), 0.1, 0.1, beamC(0.25)); if (rnd() < 0.85) addBeam(new V3(xb, yd, z), new V3(xb, yd + hh * (0.8 + rnd() * 0.2), z), 0.1, 0.1, beamC(0.25)); }
    for (let x = xb; x <= xf + 0.01; x += 0.7) for (const s of [-1, 1]) { if (rnd() < 0.15) continue; addBeam(new V3(x, yd, s * hw), new V3(x, yd + hh * (0.85 + rnd() * 0.2), s * hw), 0.1, 0.1, beamC(0.25)); }
    for (const y of [0.2, 0.95, 1.7]) for (const s of [-1, 1]) { if (rnd() < 0.2) continue; addBeam(new V3(xb, yd + y, s * hw), new V3(xf, yd + y + (rnd() - 0.5) * 0.04, s * hw), 0.1, 0.07, beamC(0.2)); }
    for (const y of [0.2, 0.95, 1.7]) { if (rnd() < 0.25) continue; addBeam(new V3(xf, yd + y, -hw), new V3(xf, yd + y, hw), 0.1, 0.07, beamC(0.2)); }
    for (let y = 0.1; y < 0.9; y += 0.22) for (const s of [-1, 1]) { if (rnd() < 0.3) continue; addBeam(new V3(xb + 0.1, yd + y, s * hw), new V3(xf - 0.1, yd + y, s * hw), 0.04, 0.2, WOOD[(rnd() * 4) | 0]); }
    for (let x = xb; x < xf; x += 0.45) { if (rnd() < 0.5) continue; addBeam(new V3(x, yd + hh + 0.05 - (rnd() * 0.25), -hw - 0.05), new V3(x + 0.05, yd + hh + 0.05 - rnd() * 0.3, hw + 0.05), 0.4, 0.05, WOOD[(rnd() * 4) | 0]); }
    // dümen simidi
    const wx = xb - 0.6; addBeam(new V3(wx, yd, 0), new V3(wx, yd + 0.75, 0), 0.06, 0.06, dk); parts.push(piece(new THREE.TorusGeometry(0.34, 0.03, 4, 12), '#6b573a', [wx, yd + 0.95, 0], [0, Math.PI / 2, 0], 1)); for (let a = 0; a < 6; a++) { const an = a / 6 * Math.PI; addBeam(new V3(wx, yd + 0.95 + Math.cos(an) * 0.4, Math.sin(an) * 0.4), new V3(wx, yd + 0.95 - Math.cos(an) * 0.4, -Math.sin(an) * 0.4), 0.03, 0.03, '#6b573a'); }
  }
  // güverte yükü: varil, sandık, makara
  for (let k = 0; k < 4; k++) { const x = X(0.4 + k * 0.1), z = (rnd() - 0.5) * 1.8; const g = barrelGeo(rnd); g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, yd, z)); parts.push(g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g); }
  { const g = crateGeo(rnd); g.applyMatrix4(new THREE.Matrix4().compose(new V3(X(0.72), yd + 0.2, 0.4), new Q4().setFromEuler(new THREE.Euler(0, 0.4, 0)), new V3(1.5, 1.5, 1.5))); parts.push(g.index ? g.toNonIndexed() : g); }
  parts.push(piece(new THREE.TorusGeometry(0.4, 0.09, 5, 14), '#8a7a55', [X(0.85), yd + 0.1, -0.5], [Math.PI / 2, 0, 0.2], 1, 0.9));
  const root = finishWreck('schoonerWreck', L, parts, blobs, rnd, { tiltRot: [0.2, 0, 0.05], sink: 0.5, moundK: 1.5, solids: H.solids });
  // çapa + zincir (zemin üzerinde, baş tarafta)
  { const ax = L / 2 + 1.7, az = 1.2, ap = []; const add = (a, b, w, c) => ap.push(tint(bare(beamGeo(a, b, w, w)), c));
    add(new V3(ax, 0.15, az), new V3(ax + 1.3, 0.28, az + 0.5), 0.1, '#3d3a34'); add(new V3(ax + 0.1, 0.16, az - 0.35), new V3(ax + 0.2, 0.2, az + 0.55), 0.07, '#4a4034');
    add(new V3(ax, 0.15, az), new V3(ax - 0.35, 0.1, az + 0.45), 0.08, '#3d3a34'); add(new V3(ax, 0.15, az), new V3(ax + 0.2, 0.09, az - 0.5), 0.08, '#3d3a34');
    for (let i = 0; i < 12; i++) { const t = i / 12; ap.push(piece(new THREE.TorusGeometry(0.06, 0.016, 4, 6), '#4a4a44', [lerp(ax + 1.3, ax + 3.2, t), 0.06, lerp(az + 0.5, az - 0.6, t) + Math.sin(i) * 0.15], [i % 2 ? 0 : Math.PI / 2, i * 0.3, 0.4], 1)); }
    const am = new THREE.Mesh(mergeGeometries(ap.map((p) => (p.index ? p.toNonIndexed() : p))), patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2, flatShading: true }), {})); am.castShadow = true; root.add(am); }
  scatterDebris(root, rnd, { n: 14, r0: 3.5, r1: 8.5, kinds: ['barrel', 'crate', 'amphora', 'amphora'] }); scatterBoards(root, rnd, 12, 4.5, 9.5);
  root.userData.holeFn = () => holes.map((h) => root.userData.tilt.localToWorld(sect(h.u, h.v, h.s)));
  return { root, sect };
}

/* ============================================================
 *  BALIKÇI TROLÜ (trawler)
 * ============================================================ */
function buildTrawler(rnd) {
  const L = 10.5, Wm = 1.8, Hm = 2.35, NU = 21, NV = 7;
  const holes = [{ u: 0.3, v: 0.42, s: 1, ru: 0.09, rv: 0.34 }, { u: 0.58, v: 0.5, s: -1, ru: 0.1, rv: 0.36 }, { u: 0.78, v: 0.3, s: 1, ru: 0.06, rv: 0.24 }];
  const H = makeHull({ L, Wm, Hm, NU, NV, T: 0.06, pal: RUST, holes, taper: 0.66, sternW: 0.74, ribStep: 3, ribW: 0.1, mossK: 0.55, mossCol: '#5b7a3c', algaCol: '#35552c', siltCol: '#7a6a50', dark: '#2c2a26', plankJit: 0.5,
    skip: (side, uc, vc, r) => side < 0 && vc > 0.7 && uc > 0.2 && uc < 0.34 && r() < 0.75 }, rnd);
  const { parts, blobs, sect, Hh, Wd, halfW, addBeam } = H; const yd = Hm * 0.7, X = (u) => (u - 0.5) * L; const steel = '#5a5750', rustc = '#7a4a2e', cab = '#8c8f86';
  // güverte plakaları (çok çürümüş)
  for (let x = -L / 2 + 0.4; x < L / 2 - 0.8; x += 0.55) { const hw = halfW(x / L + 0.5, yd) * 0.96; if (hw < 0.1 || rnd() < 0.35) continue; const z0 = rnd() < 0.4 ? 0 : -hw, z1 = rnd() < 0.3 ? 0 : hw; if (z1 - z0 < 0.2) continue; addBeam(new V3(x, yd, z0), new V3(x, yd, z1), 0.5, 0.045, RUST[(rnd() * 5) | 0]); }
  for (let x = -L / 2 + 0.6; x < L / 2 - 1; x += 1.2) { const hw = halfW(x / L + 0.5, yd - 0.1); addBeam(new V3(x, yd - 0.1, -hw), new V3(x, yd - 0.1, hw), 0.12, 0.16, '#4a463e'); }
  // iskele/tekne başı
  addBeam(new V3(L / 2 - 0.02, 0, 0), new V3(L / 2 + 0.25, Hh(1) * 0.98, 0), 0.16, 0.14, '#2c2a26');
  // kaptan köşkü (ön-orta)
  { const xf = X(0.7), xb = X(0.5), hw = 0.98, hh = 2.0, ck = X(0.7);
    for (const [x, w] of [[xf, hw], [xb, hw]]) for (let z = -w; z <= w + 0.01; z += 0.65) { if (rnd() < 0.08) continue; addBeam(new V3(x, yd, z), new V3(x, yd + hh * (0.92 + rnd() * 0.1), z), 0.1, 0.1, '#7e8277'); }
    for (const s of [-1, 1]) for (let x = xb; x <= xf + 0.01; x += 0.62) addBeam(new V3(x, yd, s * hw), new V3(x, yd + hh * (0.92 + rnd() * 0.1), s * hw), 0.1, 0.1, '#7e8277');
    for (const s of [-1, 1]) { addBeam(new V3(xb, yd + 0.05, s * hw), new V3(xf, yd + 0.05, s * hw), 0.05, 0.9, cab); addBeam(new V3(xb, yd + 1.82, s * hw), new V3(xf, yd + 1.82, s * hw), 0.06, 0.26, cab); }
    addBeam(new V3(xf, yd + 0.05, -hw), new V3(xf, yd + 0.05, hw), 0.05, 0.9, cab); addBeam(new V3(xf, yd + 1.82, -hw), new V3(xf, yd + 1.82, hw), 0.06, 0.26, cab); addBeam(new V3(xb, yd + 1.82, -hw), new V3(xb, yd + 1.82, hw), 0.06, 0.26, cab);
    for (let x = xb; x < xf; x += 0.5) { if (rnd() < 0.45) continue; addBeam(new V3(x, yd + hh + 0.04, -hw - 0.05), new V3(x + 0.03, yd + hh + 0.04 - rnd() * 0.15, hw + 0.05), 0.5, 0.05, '#6d7168'); }
    // anten direği ve çapraz çubuk
    addBeam(new V3(X(0.6), yd + hh, 0), new V3(X(0.6) + 0.1, yd + hh + 2.5, 0.03), 0.06, 0.06, '#3a3834'); addBeam(new V3(X(0.6) + 0.05, yd + hh + 2.0, -0.7), new V3(X(0.6) + 0.05, yd + hh + 2.0, 0.7), 0.04, 0.04, '#3a3834');
    // dümen simidi
    parts.push(piece(new THREE.TorusGeometry(0.2, 0.025, 4, 10), '#6b573a', [xf - 0.3, yd + 0.9, 0.2], [0, Math.PI / 2, 0], 1));
  }
  // baca (turuncu şeritli, eğik)
  { const g = new THREE.CylinderGeometry(0.36, 0.44, 1.9, 9, 1, true); g.translate(0, 0.95, 0); const fnl = tint(bare(g), '#a58a52', 0.95); const band = tint(bare(new THREE.CylinderGeometry(0.4, 0.43, 0.35, 9, 1, true).translate(0, 1.4, 0)), '#a33a24', 1); const top = tint(bare(new THREE.CylinderGeometry(0.37, 0.37, 0.05, 9).translate(0, 1.88, 0)), '#1c1b19', 1);
    const m = mergeGeometries([fnl, band, top].map((p) => (p.index ? p.toNonIndexed() : p))); m.applyMatrix4(new THREE.Matrix4().compose(new V3(X(0.38), yd + 1.9, 0), new Q4().setFromEuler(new THREE.Euler(0.12, 0, -0.08)), new V3(1, 1, 1))); parts.push(m); }
  // ön direk ve vinç kolu
  addBeam(new V3(X(0.86), yd, 0), new V3(X(0.86) + 0.05, yd + 4.6, 0.05), 0.14, 0.14, '#4b4a42'); addBeam(new V3(X(0.86) + 0.05, yd + 4.1, 0.05), new V3(X(0.86) - 2.0, yd + 2.0, 1.2), 0.09, 0.09, '#4b4a42');
  ropeSag(addBeam, new V3(X(0.86) - 2.0, yd + 2.0, 1.2), new V3(X(0.86) - 1.8, yd - 0.3, 1.4), 0.1, 0.03, '#7b6a45', 3);
  // arka vinç, makara, yan çerçeve
  parts.push(piece(new THREE.CylinderGeometry(0.34, 0.34, 1.3, 9), '#6a5a42', [X(0.18), yd + 0.35, 0], [Math.PI / 2, 0, 0], 1)); parts.push(piece(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 9), '#3d3a34', [X(0.18), yd + 0.35, 0.67], [Math.PI / 2, 0, 0], 1)); parts.push(piece(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 9), '#3d3a34', [X(0.18), yd + 0.35, -0.67], [Math.PI / 2, 0, 0], 1));
  addBeam(new V3(X(0.06), yd, -halfW(0.06, yd) * 0.95), new V3(X(0.06), yd + 2.4, -0.7), 0.12, 0.12, '#4b4a42'); addBeam(new V3(X(0.06), yd, halfW(0.06, yd) * 0.95), new V3(X(0.06), yd + 2.4, 0.7), 0.12, 0.12, '#4b4a42'); addBeam(new V3(X(0.06), yd + 2.4, -0.7), new V3(X(0.06), yd + 2.4, 0.7), 0.12, 0.12, '#4b4a42');
  // ağ yığını + şamandıralar + can simidi
  for (let k = 0; k < 4; k++) parts.push(piece(new THREE.IcosahedronGeometry(1, 1), k % 2 ? '#3d5a3e' : '#5a6a48', [X(0.28) + k * 0.25, yd + 0.2 + k * 0.05, -0.6 + k * 0.3], [0.2, k, 0], [0.7, 0.28, 0.5], 0.95));
  for (let k = 0; k < 3; k++) parts.push(piece(new THREE.SphereGeometry(0.2, 7, 5), k === 1 ? '#e8e0cf' : '#e36a1e', [X(0.34) + k * 0.1, yd + 0.45, 0.4 + k * 0.25], null, 1));
  parts.push(piece(new THREE.TorusGeometry(0.28, 0.07, 5, 12), '#e8e0cf', [X(0.5), yd + 1.1, hwFix(halfW, 0.5, yd)], [0, 0.2, 0.2], 1));
  // gemi yanı yuvarlak lombozlar
  for (const s of [1, -1]) for (let i = 0; i < 5; i++) { const u = 0.28 + i * 0.12; if (holes.some((h) => h.s === s && Math.abs(h.u - u) < h.ru * 1.3)) continue; const p = sect(u, 0.8, s), p2 = sect(u, 0.82, s); const nrm = new V3(0, 0.15, s).normalize(); parts.push(orient(new THREE.TorusGeometry(0.15, 0.03, 5, 10), '#8a7440', p.clone().addScaledVector(nrm, 0.05), nrm, 1)); parts.push(orient(new THREE.CircleGeometry(0.13, 10), '#101a1c', p.clone().addScaledVector(nrm, 0.04), nrm, 1)); }
  const root = finishWreck('trawlerWreck', L, parts, blobs, rnd, { tiltRot: [0.64, 0, 0.04], sink: 0.4, moundK: 1.3, pal: RUST, solids: H.solids });
  scatterDebris(root, rnd, { n: 9, r0: 3.2, r1: 6.5, kinds: ['barrel', 'crate', 'barrel'] }); scatterBoards(root, rnd, 5, 3.5, 7.0, RUST);
  // zeminde ağ kalıntısı, şamandıralar
  for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), patchDiveMaterial(new THREE.MeshStandardMaterial({ color: k === 1 ? '#e8e0cf' : '#e36a1e', roughness: 0.6, flatShading: true }), {})); const a = rnd() * TAU, d = 3 + rnd() * 3; m.position.set(Math.cos(a) * d, 0.16, Math.sin(a) * d * 0.7); root.add(m); }
  root.userData.holeFn = () => holes.map((h) => root.userData.tilt.localToWorld(sect(h.u, h.v, h.s)));
  return { root, sect };
}
const hwFix = (halfW, u, yd) => halfW(u, yd) * 0.9;

/* ============================================================ */
export function createWreck(type = 'rowboat', { x = 0, z = 0, bedY = -4, rotY = 0.8, roll = 0, pitch = 0, seed = 21 } = {}) {
  const rnd = mulberry(seed + type.length * 7); const def = WRECK_TYPES[type] || WRECK_TYPES.rowboat;
  const out = type === 'schooner' ? buildSchooner(rnd) : type === 'trawler' ? buildTrawler(rnd) : type === 'dinghy' ? buildRowboat(rnd, true) : buildRowboat(rnd, false);
  const root = out.root; root.position.set(x, bedY, z); root.rotation.order = 'YXZ'; root.rotation.set(roll, rotY, pitch); root.updateMatrixWorld(true);
  { const tl = root.userData.tilt, v = new V3(), arr = []; for (const q of root.userData.solidsLocal) { v.set(q[0], q[1], q[2]); tl.localToWorld(v); arr.push(v.x, v.y, v.z, q[3]); } root.userData.solids = arr; }
  root.userData.holes = root.userData.holeFn(); root.userData.radius = def.radius; root.userData.type = type; root.userData.length = def.L; return root;
}
/** eski ad: kürek teknesi */
export const createSunkenShipwreck = (o = {}) => createWreck('rowboat', o);

/**
 * specs: [{ type, depth:[min,max], prefer, rad }] — tek tek en uygun, düz ve derin yeri seçer.
 * ctx: { terrainH, lakeD, islandD, anchor, avoid(x,z)->bool }
 */
export function findWreckSpots(specs, { terrainH, lakeD, islandD, anchor, avoid = () => false, taken = [] }) {
  const out = []; const placed = taken.slice();
  for (const sp of specs) {
    const R = sp.rad || WRECK_TYPES[sp.type].radius; let best = null, bs = -1e9; const maxSlope = sp.maxSlope ?? 0.7, maxRes = sp.resid ?? (0.4 + R * 0.03);
    for (let x = -58; x <= 58; x += 2) for (let z = -52; z <= 54; z += 2) {
      if (lakeD(x, z) < (sp.edge ?? R + 5) || islandD(x, z) > -(R * 0.7 + 3.5) || avoid(x, z)) continue; const bed = terrainH(x, z); const dep = -bed; if (dep < sp.depth[0] || dep > sp.depth[1]) continue;
      let ok = true; for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < R + p.r + 6) { ok = false; break; } if (!ok) continue;
      const e = R * 0.5; const gx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), gz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e); const slope = Math.hypot(gx, gz); if (slope > maxSlope) continue;
      let res = 0; for (let a = 0; a < 8; a++) { const dx = Math.cos(a * 0.785) * R * 0.75, dz = Math.sin(a * 0.785) * R * 0.75; const hh = terrainH(x + dx, z + dz); if (hh > -0.7) { ok = false; break; } res = Math.max(res, Math.abs(hh - (bed + gx * dx + gz * dz))); } if (!ok || res > maxRes) continue;
      const d = Math.hypot(x - anchor.x, z - anchor.z); const sc = -res * 2.4 - slope * 1.2 - Math.abs(d - sp.prefer) * 0.035 - Math.abs(dep - (sp.depth[0] + sp.depth[1]) / 2) * 0.25;
      if (sc > bs) { bs = sc; best = { x, z, bed, gx, gz, slope }; }
    }
    if (!best) { if (typeof window !== 'undefined') console.log('wreck-miss', sp.type); continue; }
    // omurga eş-yükselti çizgisi boyunca, gövde yamaca oturur
    const a = best.slope > 0.02 ? Math.atan2(best.gz, best.gx) + Math.PI / 2 : 0.6; const zx = -Math.sin(a), zz = Math.cos(a); const sz = best.gx * zx + best.gz * zz, sx = best.gx * Math.cos(a) + best.gz * Math.sin(a);
    const spot = { type: sp.type, x: best.x, z: best.z, bed: best.bed - 0.06, rotY: -a + (sp.flip ? Math.PI : 0), roll: -Math.atan(sz), pitch: Math.atan(sx), r: R, slope: best.slope }; out.push(spot); placed.push({ x: spot.x, z: spot.z, r: R });
  }
  return out;
}
