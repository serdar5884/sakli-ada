import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/* ---------- yardımcılar ---------- */
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
export function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s / 0.9375; }

/* ---------- göl geometrisi ---------- */
export const ISLAND = { x: 5, z: -6 };
export function lakeD(x, z) {
  const px = x / 1.12, pz = z / 0.92; const th = Math.atan2(pz, px); const r = Math.hypot(px, pz);
  const R = 46.5 + 7.5 * Math.sin(2 * th + 0.6) + 4.8 * Math.sin(3 * th + 2.1) + 2.7 * Math.sin(5 * th + 0.3);
  return R - r;
}
export function islandD(x, z) {
  const dx = x - ISLAND.x, dz = z - ISLAND.z; const th = Math.atan2(dz, dx);
  const R = 12.5 + 1.8 * Math.sin(3 * th + 0.5) + 1.1 * Math.sin(5 * th + 1.2);
  return R - Math.hypot(dx, dz);
}
export function terrainH(x, z) { const h = terrainBase(x, z); return STREAM ? carveStream(x, z, h) : h; }
function terrainBase(x, z) {
  const ld = lakeD(x, z); let h;
  if (ld > 0) h = -9.0 * smooth(0, 17, ld) + (fbm(x * 0.075 + 21, z * 0.075 - 13) - 0.5) * 2.3 * smooth(2, 11, ld);   // derin göl + dip tepecikleri
  else {
    const t = -ld; const n = (fbm(x * 0.05 + 11, z * 0.05 + 7) - 0.5) * 2;
    h = t * 0.06 + Math.pow(t / 28, 1.6) * 4.6 + n * smooth(1, 14, t) * 1.7 * (1 - 0.92 * beachDamp(x, z));
    h += smooth(95, 165, Math.hypot(x, z)) * 10;
    h = townFlatten(x, z, h, ld);
  }
  const id = islandD(x, z); let ih;
  if (id < 0) ih = -9.0 * smooth(0, 12, -id) + (fbm(x * 0.075 + 21, z * 0.075 - 13) - 0.5) * 2.3 * smooth(2, 9, -id);
  else ih = 0.35 * smooth(0, 4, id) + 0.9 * smooth(3, 11, id) + 0.5 * smooth(8, 16, id) + (fbm(x * 0.2, z * 0.2) - 0.5) * 0.45 * Math.min(1, id / 3);
  return Math.max(h, ih);
}
/** gölün su olduğu ve yeterince derin olduğu nokta mı */
export function isWater(x, z, minDepth = 0.6) { return -terrainH(x, z) > minDepth; }
export function gradOf(fn, x, z) { const e = 0.5; return [(fn(x + e, z) - fn(x - e, z)) / (2 * e), (fn(x, z + e) - fn(x, z - e)) / (2 * e)]; }

/* ---------- iskele konumu (güney-batı kıyı) ---------- */
export const DOCK = (() => {
  const th = 1.95; const dx0 = Math.cos(th), dz0 = Math.sin(th);
  let lo = 5, hi = 120;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (lakeD(dx0 * m, dz0 * m) > -1.6) lo = m; else hi = m; }
  const r = (lo + hi) / 2; const pos = new THREE.Vector3(dx0 * r, 0, dz0 * r);
  const phi = 0.45; const dir = new THREE.Vector2(-dx0 * Math.cos(phi) + dz0 * Math.sin(phi), -dx0 * Math.sin(phi) - dz0 * Math.cos(phi)).normalize(); // göle doğru (yarıçaptan biraz sapmış)
  const rotY = Math.atan2(-dir.y, dir.x);
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = rotY; g.updateMatrixWorld(true);
  return { pos, dir, rotY, group: g, angle: Math.atan2(dir.y, dir.x), zone: { x0: -3.5, x1: 15, hz: 4.6 } };
})();
export function toDockLocal(x, z) { const v = new THREE.Vector3(x, 0, z); DOCK.group.worldToLocal(v); return v; }
export function nearDockZone(x, z, margin = 0) { const v = toDockLocal(x, z); const Z = DOCK.zone; return v.x > Z.x0 - margin && v.x < Z.x1 + margin && Math.abs(v.z) < Z.hz + margin; }

export function nearDockMax(x, z, margin = 0) { const v = toDockLocal(x, z); return (v.x > -5.3 - margin && v.x < 23.2 + margin && Math.abs(v.z) < 6.0 + margin) || inTown(x, z, margin) || inBeach(x, z, margin) || streamNear(x, z, margin); }

/* ---------- sahil kasabası (iskele yerel koordinatları: +x göle doğru) ---------- */
const HA = { Lx: 4.6, W: 4.8 }, HB = { Lx: 4.6, W: 4.8 };
export const TOWN = {
  x0: -37, x1: -5.5, hz: 27,
  plaza: { x: -16.5, z: 0, r: 5.6 },
  houses: [
    { lx: -15.5, lz: -19.5, ...HA, k: 'timber', wall: 'cream', roof: 'terra', door: '#3f6f9a', shut: '#4d8a52' }, { lx: -15.5, lz: -12.5, ...HA, k: 'timber', wall: 'yellow', roof: 'blue', door: '#8a3a3a', shut: '#e07a9a', round: true },
    { lx: -15.5, lz: 12.5, ...HA, k: 'timber', wall: 'peach', roof: 'terra', door: '#3f6b66', shut: '#3f7f8a' }, { lx: -15.5, lz: 19.5, ...HA, k: 'timber', wall: 'blue', roof: 'terra', door: '#d2a63c', shut: '#d96a4a', round: true },
    { lx: -30, lz: -22, ...HB, k: 'timber', wall: 'mint', roof: 'blue', door: '#2f4a6b', shut: '#e8b838' }, { lx: -30, lz: -15, ...HB, k: 'timber', wall: 'cream', roof: 'terra', door: '#3f6b66', shut: '#4d8a52', floors: 2 },
    { lx: -30, lz: -8, ...HB, k: 'timber', wall: 'pink', roof: 'terra2', door: '#a8442f', shut: '#4c78b8', round: true }, { lx: -30, lz: 8, ...HB, k: 'timber', wall: 'yellow', roof: 'blue', door: '#2f4a6b', shut: '#e07a9a' },
    { lx: -30, lz: 15, ...HB, k: 'timber', wall: 'cream', roof: 'terra', door: '#3f6b66', shut: '#3f7f8a', floors: 2 }, { lx: -30, lz: 22, ...HB, k: 'timber', wall: 'peach', roof: 'blue', door: '#a8442f', shut: '#4d8a52', round: true },
    { lx: -31.7, lz: 0, Lx: 6, W: 7.2, k: 'timber', wall: 'cream', roof: 'terra', door: '#2f4a6b', shut: '#7a3a2a', floors: 2, inn: true },
  ],
};
// küçük plaj (iskele yerel koordinatları): kasabanın güney ucundaki alçak kıyı
export const BEACH = { x: -10.5, z: -46.5, rx: 11.5, rz: 10.5 };
// yollar: [x0,z0,x1,z1,genişlik]
export const ROADS = [[-9.5, -25, -9.5, 25, 3.2], [-3.2, 0, -28.4, 0, 3.4], [-24, -25, -24, 25, 2.8], [-9.5, -25, -9.9, -34, 2.6], [-9.9, -34, -11.4, -41.5, 2.3], [-5.3, -5.6, -5.3, 5.6, 2.4], [-5.3, 5.6, -0.6, 5.6, 1.5], [-5.3, -5.6, -0.6, -5.6, 1.5]];
for (const h of TOWN.houses) { if (h.inn) continue; const dx = h.lx + h.Lx / 2; ROADS.push(h.lx > -20 ? [dx + 0.4, h.lz, -11.0, h.lz, 1.4] : [dx + 0.4, h.lz, -25.3, h.lz, 1.4]); }
let _tc = 0, _ts = 0, _tcz = false;
let _lx = 0, _lz = 0;
function toLocalXZ(x, z) { if (!_tcz) { _tc = Math.cos(DOCK.rotY); _ts = Math.sin(DOCK.rotY); _tcz = true; } const dx = x - DOCK.pos.x, dz = z - DOCK.pos.z; _lx = dx * _tc - dz * _ts; _lz = dx * _ts + dz * _tc; }
export function townLocal(lx, lz, out) { toLocalXZ(0, 0); const c = Math.cos(DOCK.rotY), s = Math.sin(DOCK.rotY); out.x = DOCK.pos.x + lx * c + lz * s; out.z = DOCK.pos.z - lx * s + lz * c; return out; }
export function beachMask(x, z) { toLocalXZ(x, z); return 1 - smooth(0.55, 1.0, Math.hypot((_lx - BEACH.x) / BEACH.rx, (_lz - BEACH.z) / BEACH.rz)); }
export function inBeach(x, z, m = 0) { toLocalXZ(x, z); return Math.hypot((_lx - BEACH.x) / (BEACH.rx + m), (_lz - BEACH.z) / (BEACH.rz + m)) < 1 && _lx < -3; }
export function inTown(x, z, m = 0) { toLocalXZ(x, z); return _lx > TOWN.x0 - m && _lx < TOWN.x1 + m && Math.abs(_lz) < TOWN.hz + m && _lx < -3; }
function beachDamp(x, z) { const dx = x - DOCK.pos.x, dz = z - DOCK.pos.z; if (dx * dx + dz * dz > 5600) return 0; return beachMask(x, z); }
/* ---------- DERE: gölün doğu kıyısına akan, taş kemer tünelden çıkan dere ---------- */
export let STREAM = null;
const _sq = { d: 0, u: 0, i: 0, t: 0, side: 1 };
export function streamQ(x, z, o = _sq) {
  const P = STREAM.pts, n = P.length - 1; let bd = 1e9, bi = 0, bt = 0, bs = 1;
  for (let i = 0; i < n; i++) {
    const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1]; const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = ax + dx * t - x, pz = az + dz * t - z; const d2 = px * px + pz * pz;
    if (d2 < bd) { bd = d2; bi = i; bt = t; bs = (dx * (z - az) - dz * (x - ax)) >= 0 ? 1 : -1; }
  }
  o.d = Math.sqrt(bd); o.i = bi; o.t = bt; o.u = (bi + bt) / n; o.side = bs; return o;
}
const hwAt = (u) => 2.7 - 0.9 * u;
function Sat(u) { const S = STREAM.S, n = S.length - 1; const f = Math.min(n - 1e-6, Math.max(0, u * n)); const i = Math.floor(f); return S[i] + (S[i + 1] - S[i]) * (f - i); }
export const streamSurface = (u) => Sat(u); export const streamHalfW = hwAt;
function carveStream(x, z, h) {
  const B = STREAM.bb; if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return h; let out = h;
  const H = STREAM.house; const dh = Math.hypot(x - H.x, z - H.z); if (dh < 13) { const w = 1 - smooth(6.0, 13, dh); out = out * (1 - w) + H.h * w; }
  const q = streamQ(x, z); const hw = hwAt(q.u); const h1 = out;
  if (q.d < hw + 9) {
    const S = Sat(q.u);
    if (q.d < hw) { const r = q.d / hw; out = Math.min(h1, S - 0.85 * (1 - r * r)); }
    else { const bank = S + 0.3 * (q.d - hw); const w = smooth(hw + 0.4, hw + 8, q.d); out = Math.min(h1, bank * (1 - w) + h1 * w); }
  }
  return out;
}
export function streamNear(x, z, m = 0) {
  if (!STREAM) return false; const B = STREAM.bb; if (x < B.x0 - m || x > B.x1 + m || z < B.z0 - m || z > B.z1 + m) return false;
  const q = streamQ(x, z); if (q.d < hwAt(q.u) + 2.2 + m) return true; const H = STREAM.house; if (Math.hypot(x - H.x, z - H.z) < 8.5 + m) return true;
  const b = STREAM.bridge; const dx = x - b.x, dz = z - b.z; return Math.abs(dx * b.ax + dz * b.az) < b.L / 2 + m && Math.abs(dx * b.tx + dz * b.tz) < 1.8 + m;
}
/** köprü güvertesi yüksekliği (yRef: yürüyenin mevcut yüksekliği; altından geçeni yukarı almasın) */
export function bridgeY(x, z, yRef) {
  if (!STREAM) return null; const b = STREAM.bridge; const dx = x - b.x, dz = z - b.z; if (dx * dx + dz * dz > 100) return null;
  const u = dx * b.ax + dz * b.az, v = dx * b.tx + dz * b.tz; if (Math.abs(v) > 1.0 || Math.abs(u) > b.L / 2) return null;
  const q = 2 * u / b.L, qq = q * q; const y = b.Yc * (1 - qq) + (u > 0 ? b.yR : b.yL) * qq; return yRef > y - 1.1 ? y : null;
}
function initStream() {
  const PHI = -0.5, LEN = 40; const dx = Math.cos(PHI), dz = Math.sin(PHI); let r0 = 40; for (let r = 20; r < 130; r += 0.25) { if (lakeD(dx * r, dz * r) <= 0) { r0 = r; break; } }
  const px = -dz, pz = dx; const N = 56; const pts = [], U = [];
  for (let i = 0; i <= N; i++) { const u = i / N; const along = (LEN + 1.6) * u - 1.6; const off = (5.0 * Math.sin(u * 5.6 + 0.4) + 2.0 * Math.sin(u * 12.3 + 1.1)) * smooth(0.04, 0.28, u); pts.push([dx * (r0 + along) + px * off, dz * (r0 + along) + pz * off]); U.push(u); }
  const raw = pts.map((p, i) => { const u = U[i]; return terrainBase(p[0], p[1]) - 0.5 - 1.0 * smooth(0.86, 1.0, u); });
  for (let i = N - 1; i >= 0; i--) raw[i] = Math.min(raw[i], raw[i + 1] + 0.0);
  const S = raw.map((_, i) => { let a = 0, c = 0; for (let k = -3; k <= 3; k++) { const j = Math.min(N, Math.max(0, i + k)); a += raw[j]; c++; } return Math.max(0.04 + 0.12 * U[i], a / c); });
  const T = (i0, i1) => { const tx = pts[i1][0] - pts[i0][0], tz = pts[i1][1] - pts[i0][1]; const l = Math.hypot(tx, tz); return [tx / l, tz / l]; };
  const te = T(N - 3, N); const wall = { x: pts[N][0], z: pts[N][1], tx: te[0], tz: te[1] };
  const hx = wall.x + te[0] * 10.5 - te[1] * 1.6, hz = wall.z + te[1] * 10.5 + te[0] * 1.6; const house = { x: hx, z: hz, h: terrainBase(hx, hz) - 0.1, tx: te[0], tz: te[1] };
  const ib = Math.round(N * 0.4); const tb = T(ib - 2, ib + 2); const hwb = hwAt(U[ib]); const bridge = { x: pts[ib][0], z: pts[ib][1], tx: tb[0], tz: tb[1], ax: -tb[1], az: tb[0], L: 2 * (hwb + 3.5), Sb: S[ib], hw: hwb, Yc: S[ib] + 2.0, yL: 0, yR: 0 };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  x0 = Math.min(x0, hx) - 16; x1 = Math.max(x1, hx) + 16; z0 = Math.min(z0, hz) - 16; z1 = Math.max(z1, hz) + 16;
  STREAM = { pts, S, N, bb: { x0, x1, z0, z1 }, wall, house, bridge, len: LEN };
  bridge.yL = terrainH(bridge.x - bridge.ax * bridge.L / 2, bridge.z - bridge.az * bridge.L / 2) + 0.05; bridge.yR = terrainH(bridge.x + bridge.ax * bridge.L / 2, bridge.z + bridge.az * bridge.L / 2) + 0.05;
  bridge.Yc = Math.max(bridge.Yc, Math.max(bridge.yL, bridge.yR) + 0.5);
}
initStream();
function townFlatten(x, z, h, ld) {
  const dx = x - DOCK.pos.x, dz = z - DOCK.pos.z; if (dx * dx + dz * dz > 4900 || ld > -0.8) return h;
  toLocalXZ(x, z); const ox = Math.max(TOWN.x0 - _lx, _lx - TOWN.x1, 0), oz = Math.max(Math.abs(_lz) - TOWN.hz, 0); const d = Math.hypot(ox, oz);
  let w = 1 - smooth(0, 11, d); if (w <= 0) return h; w *= 1 - smooth(-3.5, -0.8, ld);
  const T = 0.95 + clamp(-_lx - 5.5, 0, 45) * 0.055 + (fbm(x * 0.08, z * 0.08) - 0.5) * 0.18;
  return h + (T - h) * w;
}
/** yolun içinde pozitif (metre cinsinden kenara uzaklık) */
export function roadD(x, z) {
  toLocalXZ(x, z); const px = _lx, pz = _lz; if (px > -0.2 || px < -36 || pz > 26.5 || pz < -48) return -9; let best = TOWN.plaza.r - Math.hypot(px - TOWN.plaza.x, pz - TOWN.plaza.z);
  for (const [ax, az, bx, bz, w] of ROADS) { const vx = bx - ax, vz = bz - az; const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1); const d = Math.hypot(px - ax - vx * t, pz - az - vz * t); best = Math.max(best, w / 2 - d); }
  return best;
}

/* ---------- derinlik dokusu (su gölgelendiricisi için) ---------- */
export const DEPTH_RECT = { min: -115, size: 230, maxD: 10 };
export const WATER_OBS = { rocks: [] }; // kıyı kayaları [x, z, yarıçap] — köpük halkası için
const DN = 640;
export function makeDepthTexture() {
  const data = new Uint8Array(DN * DN * 4);
  for (let j = 0; j < DN; j++) for (let i = 0; i < DN; i++) {
    const x = DEPTH_RECT.min + (i + 0.5) / DN * DEPTH_RECT.size, z = DEPTH_RECT.min + (j + 0.5) / DN * DEPTH_RECT.size;
    const d = Math.max(0, -terrainH(x, z)); const v = Math.round(clamp(d / DEPTH_RECT.maxD, 0, 1) * 255);
    const k = (j * DN + i) * 4; data[k] = v; data[k + 1] = 0; data[k + 2] = 0; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, DN, DN, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
}
/** G kanalı: sudaki sabit cisimlere (iskele, kayalar) yakınlık 0..1 — suyun temas köpüğü bunu kullanır */
export function bakeWaterObstacles(t) {
  const data = t.image.data; const cell = DEPTH_RECT.size / DN; const F = 0.6; // köpük genişliği (m)
  const ti = (x) => Math.floor((x - DEPTH_RECT.min) / cell);
  const stamp = (cx, cz, ext, fn) => { const i0 = Math.max(0, ti(cx - ext)), i1 = Math.min(DN - 1, ti(cx + ext)), j0 = Math.max(0, ti(cz - ext)), j1 = Math.min(DN - 1, ti(cz + ext));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = DEPTH_RECT.min + (i + 0.5) * cell, z = DEPTH_RECT.min + (j + 0.5) * cell; const d = fn(x, z); if (d >= F) continue; const k = (j * DN + i) * 4; if (data[k] < 4) continue; const v = Math.round((1 - Math.max(0, d) / F) * 255); if (v > data[k + 1]) data[k + 1] = v; } };
  for (let k = 1; k < data.length; k += 4) data[k] = 0;
  for (const [x, z, r] of WATER_OBS.rocks) stamp(x, z, r + F + 0.5, (px, pz) => Math.hypot(px - x, pz - z) - r);
  const L = DOCK.layout;
  if (L) {
    const rects = [[L.x0, L.x1, L.hz], [L.x1, L.px1, L.hw]]; const c = Math.cos(DOCK.rotY), sn = Math.sin(DOCK.rotY);
    for (const [xa, xb, hz] of rects) { const cxl = (xa + xb) / 2, hx = (xb - xa) / 2; const cw = DOCK.pos.x + cxl * c, cz = DOCK.pos.z - cxl * sn; const ext = Math.hypot(hx, hz) + F + 0.5;
      stamp(cw, cz, ext, (px, pz) => { const dx = px - DOCK.pos.x, dz = pz - DOCK.pos.z; const lx = dx * c - dz * sn, lz = dx * sn + dz * c; const qx = Math.abs(lx - cxl) - hx, qz = Math.abs(lz) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0); }); }
  }
  t.needsUpdate = true;
}
/** zemin kostikleri (terrain malzemesine eklenir) */
export const CAUSTIC = { uCT: { value: 0 }, uCI: { value: 1 }, uCC: { value: new THREE.Color('#fff0d2') } };

/* ---------- arazi ---------- */
export function buildTerrain() {
  const SIZE = 440, SEG = 400;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const n = pos.count;
  for (let i = 0; i < n; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const col = new Float32Array(n * 3); const nor = geo.attributes.normal;
  const C = (h) => new THREE.Color(h);
  const rockC = new THREE.Color('#8b8a80'), snowC = new THREE.Color('#f1f3f2');
  const pebble = new THREE.Color(), moss = new THREE.Color('#3f6f2a'); const bmask = (x, z) => ((x - DOCK.pos.x) ** 2 + (z - DOCK.pos.z) ** 2 > 5600 ? 0 : beachMask(x, z)), rdOK = true, gravel = C('#a99e86'), lawn = C('#6fa23a'), mud = C('#2b3a2c'), mud2 = C('#5d7a5a'), sand = C('#dccb96'), g1 = C('#5a8f2c'), g2 = C('#2f6020'), dk = C('#1f4217'), dirt = C('#6b5a3d'), tmp = new THREE.Color(), tmp2 = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nor.getY(i);
    const ld = lakeD(x, z), id = islandD(x, z);
    const nz = fbm(x * 0.18 + 3, z * 0.18 - 5);
    if (h < -0.04) { const k = smooth(-1.9, -0.05, h); tmp.copy(mud).lerp(mud2, k); tmp.lerp(sand, smooth(-0.5, -0.04, h) * 0.55); const nb = fbm(x * 0.11 + 8, z * 0.11 + 3); tmp.lerp(sand, smooth(0.5, 0.75, nb) * 0.55 * smooth(-7, -1, h)); tmp.lerp(gravel, smooth(0.62, 0.82, fbm(x * 0.2, z * 0.2 + 9)) * 0.45); tmp.multiplyScalar(1 - 0.35 * smooth(-3, -9, h)); }
    else {
      const sd = ld > 0 ? id : -ld;
      tmp.copy(g1).lerp(g2, nz);
      const sandAmt = (1 - smooth(0.2, 2.8, sd)) * (0.55 + 0.45 * fbm(x * 0.4, z * 0.4));
      tmp.lerp(sand, Math.max(sandAmt, bmask(x, z) * (1 - smooth(0.9, 1.45, h)) * 0.97));
      tmp.lerp(dk, smooth(16, 60, -ld) * 0.45);
      tmp.lerp(dirt, smooth(0.38, 0.7, 1 - ny) * 0.6);
      if (h > 28) { tmp.lerp(rockC, smooth(28, 62, h + (nz - 0.5) * 14) * 0.8); tmp.lerp(snowC, smooth(86, 106, h + (nz - 0.5) * 12) * smooth(0.1, 0.5, ny)); }
      if (STREAM && x > STREAM.bb.x0 && x < STREAM.bb.x1 && z > STREAM.bb.z0 && z < STREAM.bb.z1) { const q = streamQ(x, z); const hw = streamHalfW(q.u); if (q.d < hw + 3.4) { const kk = 1 - smooth(hw * 0.7, hw + 0.6, q.d); tmp.lerp(pebble.set(0.62 + nz * 0.12, 0.6 + nz * 0.1, 0.52 + nz * 0.08), kk * 0.92); tmp.lerp(moss, smooth(hw + 0.2, hw + 1.0, q.d) * (1 - smooth(hw + 1.0, hw + 3.4, q.d)) * 0.5); } }
      if (rdOK) { const rd = roadD(x, z); if (rd > -0.5) tmp.lerp(gravel, smooth(-0.5, 0.2, rd) * 0.95); else if (inTown(x, z, 0)) tmp.lerp(lawn, 0.55); }
    }
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const img = g.createImageData(256, 256); const rnd = mulberry(5);
  for (let i = 0; i < 256 * 256; i++) { const v = 205 + rnd() * 50; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(130, 130); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: tex });
  mat.customProgramCacheKey = () => 'terrainCaustic';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CAUSTIC);
    sh.vertexShader = 'varying vec3 vCW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vCW; uniform float uCT, uCI; uniform vec3 uCC;
      float caust(vec2 uv, float t){ vec2 p = mod(uv*6.2831853, 6.2831853) - 250.; vec2 i = p; float c = 1.; const float inten = .005;
        for(int n=0;n<4;n++){ float tt = t*(1.-(3.5/float(n+1))); i = p + vec2(cos(tt-i.x)+sin(tt+i.y), sin(tt-i.y)+cos(tt+i.x)); c += 1./length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten))); }
        c /= 4.; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.); }
      ` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float dd = -vCW.y; float cm = smoothstep(-0.05, 0.18, dd) * (1. - smoothstep(1.3, 5.6, dd));
          if (cm > 0.001) { float cs = caust(vCW.xz*0.17, uCT*0.75)*0.95 + caust(vCW.xz*0.26 + 7.3, -uCT*0.62)*0.65; totalEmissiveRadiance += uCC * uCI * cm * cs * 0.9; } }`);
  };
  // karo karo parçala: kamera dışında kalan araziler çizilmesin (aynı vertex verisi, ayrı indeks)
  const tiles = new THREE.Group(); const idx = geo.index.array; const NT = 10, per = SEG / NT; const vpr = SEG + 1;
  for (let ty = 0; ty < NT; ty++) for (let tx = 0; tx < NT; tx++) {
    const ids = new Uint32Array(per * per * 6); let k = 0;
    for (let qy = 0; qy < per; qy++) for (let qx = 0; qx < per; qx++) { const q = ((ty * per + qy) * SEG + (tx * per + qx)) * 6; for (let j = 0; j < 6; j++) ids[k++] = idx[q + j]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal); g.setAttribute('uv', geo.attributes.uv); g.setAttribute('color', geo.attributes.color); g.setIndex(new THREE.BufferAttribute(ids, 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; tiles.add(m);
  }
  return tiles;
}

/* ---------- gün döngüsü: güneş doğudan doğar, dağların ardından yükselir, batar; gece ay + yıldız ---------- */
export const ALT = { k: 0 }; // kamera yüksekliğine göre sis azaltma (0..1)
const col = (h) => new THREE.Color(h);
const KF = [ // güneşin yükseklik sinüsüne (e) göre anahtar kareler
  { e: -0.30, skyTop: '#03081a', skyHorizon: '#0a1430', sunColor: '#44507f', sunI: 0.0, hemiSky: '#3c5290', hemiGround: '#16241c', hemiI: 0.9, fog: '#0d1830', fogD: 0.0058, shallow: '#24566a', deep: '#04101a', exposure: 1.32 },
  { e: -0.12, skyTop: '#0b1735', skyHorizon: '#232a52', sunColor: '#6a5a86', sunI: 0.0, hemiSky: '#4a5a98', hemiGround: '#1b281f', hemiI: 0.78, fog: '#1d2a4a', fogD: 0.006, shallow: '#2b5a68', deep: '#07151f', exposure: 1.24 },
  { e: -0.025, skyTop: '#243872', skyHorizon: '#d0705a', sunColor: '#ff7d47', sunI: 0.5, hemiSky: '#8a82b4', hemiGround: '#3a4030', hemiI: 0.66, fog: '#b98390', fogD: 0.0068, shallow: '#5f9a98', deep: '#12283a', exposure: 1.08 },
  { e: 0.07, skyTop: '#33508f', skyHorizon: '#f4ad78', sunColor: '#ff9d5c', sunI: 2.2, hemiSky: '#b79cc8', hemiGround: '#4a5430', hemiI: 0.82, fog: '#e9ae86', fogD: 0.0066, shallow: '#78b8a2', deep: '#16313a', exposure: 1.0 },
  { e: 0.22, skyTop: '#3b68b0', skyHorizon: '#f6d4aa', sunColor: '#ffd8a0', sunI: 3.0, hemiSky: '#cdd9f0', hemiGround: '#566f3c', hemiI: 1.05, fog: '#e8dcc8', fogD: 0.0058, shallow: '#86d2d6', deep: '#2468ae', exposure: 0.97 },
  { e: 0.55, skyTop: '#3f84dc', skyHorizon: '#dcedf6', sunColor: '#fff0d2', sunI: 3.4, hemiSky: '#c4e0ff', hemiGround: '#6f8a4a', hemiI: 1.25, fog: '#d8ebf2', fogD: 0.0052, shallow: '#8adcdc', deep: '#2a78c4', exposure: 0.95 },
].map((k) => { const o = { e: k.e }; for (const key in k) if (key !== 'e') o[key] = typeof k[key] === 'string' ? col(k[key]) : k[key]; return o; });
const COLOR_KEYS = ['skyTop', 'skyHorizon', 'sunColor', 'hemiSky', 'hemiGround', 'fog', 'shallow', 'deep'], NUM_KEYS = ['sunI', 'hemiI', 'fogD', 'exposure'];
const MOON_COLOR = col('#a9bfff');
const _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sz = new THREE.Vector3(), _sf = new THREE.Vector3(), _sup = new THREE.Vector3(0, 1, 0);
const _A = new THREE.Vector3(0.67, 0, 0.74), _N = new THREE.Vector3(-0.74, 0, 0.67); // doğu-batı ekseni ve öğle yönü
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** saat (0-24) → güneşin yönü. 06:00 doğuş, 13:00 öğle, 20:00 batış. */
export function sunDirAt(hour, out) {
  const h = hour < 6 ? hour + 24 : hour; const th = h <= 20 ? ((h - 6) / 14) * Math.PI : Math.PI + ((h - 20) / 10) * Math.PI; const sn = Math.sin(th), cs = Math.cos(th);
  return out.set(_A.x * cs + _N.x * 0.55 * sn, 0.86 * sn, _A.z * cs + _N.z * 0.55 * sn).normalize();
}
export function buildSky(scene, renderer, isMobile) {
  const sunTrue = new THREE.Vector3(), moonV = new THREE.Vector3();
  const base = KF[KF.length - 1];
  const cur = { skyTop: base.skyTop.clone(), skyHorizon: base.skyHorizon.clone(), sunDir: new THREE.Vector3(0, 1, 0), sunColor: base.sunColor.clone(), sunI: base.sunI, hemiSky: base.hemiSky.clone(), hemiGround: base.hemiGround.clone(), hemiI: base.hemiI, fog: base.fog.clone(), fogD: base.fogD, shallow: base.shallow.clone(), deep: base.deep.clone(), night: 0, exposure: base.exposure };
  const tod = { hour: 9.0, speed: 24 / 840, paused: false, cur, sunTrue, moon: moonV, label: 'Gün' };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: cur.skyTop }, uHorizon: { value: cur.skyHorizon }, uSunDir: { value: sunTrue }, uMoonDir: { value: moonV }, uSunColor: { value: cur.sunColor }, uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop,uHorizon,uSunDir,uMoonDir,uSunColor; uniform float uTime,uNight; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5;} return s; }
      void main(){
        vec3 d = normalize(vDir); float t = clamp(d.y,0.,1.);
        vec3 c = mix(uHorizon, uTop, pow(t,0.5));
        c = mix(c, uHorizon, smoothstep(0.0,-0.2,d.y));
        float sd = max(dot(d,uSunDir),0.);
        float sunUp = smoothstep(-0.12, 0.0, uSunDir.y);
        c += uSunColor*(pow(sd,1200.)*6. + pow(sd,14.)*0.28 + pow(sd,3.)*0.10*uNight)*sunUp;
        // gece: yıldızlar + ay
        if(uNight>0.02 && d.y>-0.02){
          vec2 sp = vec2(atan(d.z,d.x)*46., asin(clamp(d.y,-1.,1.))*92.); vec2 ip=floor(sp); vec2 fp=fract(sp)-.5; float hh=h21(ip);
          vec2 off=(vec2(h21(ip+3.1),h21(ip+7.7))-.5)*.5; float st=step(0.972,hh)*smoothstep(.22,.0,length(fp-off));
          st*=0.55+0.45*sin(uTime*(1.5+hh*3.)+hh*60.); c += vec3(0.85,0.9,1.0)*st*uNight*smoothstep(0.0,0.2,d.y)*1.5;
          float md=dot(d,uMoonDir); c += vec3(1.0,0.97,0.88)*smoothstep(0.99935,0.99965,md)*1.6*uNight + vec3(0.45,0.55,0.85)*pow(max(md,0.),90.)*0.35*uNight;
        }
        if(d.y>0.01){
          vec2 p = d.xz/(d.y+0.3)*1.1 + vec2(uTime*0.006,uTime*0.002);
          float cl = fbm(p*1.6); cl = smoothstep(0.50,0.82,cl);
          float fade = smoothstep(0.01,0.3,d.y);
          vec3 cc = mix(vec3(1.0), uHorizon*1.12, 0.3); cc = mix(cc, uSunColor, uNight*0.4*sunUp);
          cc *= 1.0 - 0.18*smoothstep(0.5,1.0,cl); cc *= 1.0 - 0.86*uNight;
          c = mix(c, cc, cl*fade*0.92);
        }
        gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3.2); sun.castShadow = true;
  const sm = isMobile ? 2048 : 3072; sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06; scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.FogExp2(0xcfe7e6, 0.0052);
  const _c = new THREE.Color();
  const LABEL = (h) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10; const t = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; return (h < 5 || h >= 21 ? 'Gece ' : h < 9 ? 'Sabah ' : h < 17 ? 'Gün ' : 'Akşam ') + t; };

  const apply = (dt, time, focus) => {
    if (dt > 0 && !tod.paused) { const fast = sunTrue.y < -0.12 ? 2.2 : 1; tod.hour = (tod.hour + dt * tod.speed * fast) % 24; }
    sunDirAt(tod.hour, sunTrue); moonV.copy(sunTrue).negate(); moonV.x += 0.12; moonV.normalize(); // ay güneşin tersinde (hafif kayık)
    const e = sunTrue.y; const c = tod.cur;
    // anahtar kareler arası enterpolasyon
    let i = 0; while (i < KF.length - 2 && e > KF[i + 1].e) i++;
    const A = KF[i], B = KF[i + 1], k = Math.min(1, Math.max(0, (e - A.e) / (B.e - A.e)));
    for (const key of COLOR_KEYS) c[key].copy(A[key]).lerp(B[key], k);
    for (const key of NUM_KEYS) c[key] = A[key] + (B[key] - A[key]) * k;
    c.night = sstep(0.25, -0.05, e);
    // ışık: gündüz güneş, gece ay (geçişte ikisi de sönük olduğundan zıplama görünmez)
    const dayF = sstep(-0.05, 0.1, e), moonF = (1 - dayF) * sstep(-0.02, 0.2, moonV.y) * 0.62;
    const useSun = e > -0.04; c.sunDir.copy(useSun ? sunTrue : moonV);
    _c.copy(c.sunColor).multiplyScalar(c.sunI * dayF); const mI = moonF; _c.r += MOON_COLOR.r * mI; _c.g += MOON_COLOR.g * mI; _c.b += MOON_COLOR.b * mI;
    const li = Math.max(_c.r, _c.g, _c.b, 1e-4); sun.color.copy(_c).multiplyScalar(1 / li); sun.intensity = li;
    skyMat.uniforms.uTime.value = time; skyMat.uniforms.uNight.value = c.night;
    hemi.color.copy(c.hemiSky); hemi.groundColor.copy(c.hemiGround); hemi.intensity = c.hemiI;
    _sz.copy(c.sunDir).normalize(); _sx.crossVectors(_sup, _sz).normalize(); _sy.crossVectors(_sz, _sx);
    const ts = (sc.right - sc.left) / sun.shadow.mapSize.x, px = focus.dot(_sx), py = focus.dot(_sy);
    _sf.copy(focus).addScaledVector(_sx, Math.round(px / ts) * ts - px).addScaledVector(_sy, Math.round(py / ts) * ts - py); // gölge kamerası piksel adımına oturur: titreme yok
    sun.target.position.copy(_sf); sun.position.copy(_sf).addScaledVector(c.sunDir, 110); sun.target.updateMatrixWorld();
    scene.fog.color.copy(c.fog); scene.fog.density = c.fogD * (1 - 0.62 * ALT.k); renderer.toneMappingExposure = c.exposure;
    tod.label = LABEL(tod.hour);
  };
  return { tod, apply, sun, hemi };
}

/* ---------- su ---------- */
export function buildWater(width, height, tod, isMobile) {
  const depthTex = makeDepthTexture();
  const ripples = []; for (let i = 0; i < 10; i++) ripples.push(new THREE.Vector4(0, 0, -100, 0));
  const boatA = [], boatB = []; for (let i = 0; i < 4; i++) { boatA.push(new THREE.Vector4(0, 0, 1, 0)); boatB.push(new THREE.Vector4(1, 1, 0, 0)); }
  const shader = {
    name: 'LakeWater',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, tDepth: { value: depthTex },
      uTime: { value: 0 }, uSunDir: { value: tod.cur.sunDir }, uSunColor: { value: tod.cur.sunColor }, uShallow: { value: tod.cur.shallow }, uDeep: { value: tod.cur.deep }, uDay: { value: 1 },
      uHaze: { value: tod.cur.fog }, uHazeD: { value: 0.0052 }, uRipples: { value: ripples }, uRect: { value: new THREE.Vector4(DEPTH_RECT.min, DEPTH_RECT.min, DEPTH_RECT.size, DEPTH_RECT.maxD) },
      uBoatA: { value: boatA }, uBoatB: { value: boatB },
    },
    vertexShader: `
      uniform mat4 textureMatrix; uniform float uTime; varying vec4 vUv; varying vec3 vWorld; varying float vH;
      // dikey salınım: fragment'taki dalgaların aynı fazları (yükseklik = genlik * sin(faz))
      float waveH(vec2 p){
        return 0.035*sin(dot(p,normalize(vec2(1.,0.35)))*0.55 + uTime*0.9) + 0.022*sin(dot(p,normalize(vec2(-0.4,1.)))*0.9 + uTime*1.15) + 0.012*sin(dot(p,normalize(vec2(0.7,-0.8)))*1.7 + uTime*1.6);
      }
      void main(){
        vUv = textureMatrix * vec4(position,1.0); vec4 wp = modelMatrix * vec4(position,1.0);
        vH = waveH(wp.xz); wp.y += vH; vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uTime,uHazeD,uDay; uniform vec3 uSunDir,uSunColor,uShallow,uDeep,uHaze; uniform vec4 uRipples[10]; uniform vec4 uRect; uniform vec4 uBoatA[4]; uniform vec4 uBoatB[4];
      varying vec4 vUv; varying vec3 vWorld; varying float vH;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      vec2 wv(vec2 p, vec2 dir, float fr, float sp, float am){ float ph = dot(p,dir)*fr + uTime*sp; return dir*cos(ph)*am*fr; }
      // zıt yönlerde kayan iki gürültü-normal katmanı (normal haritası yerine prosedürel)
      vec2 sn(vec2 q){ float e=0.07; float a=vn(q); return vec2(vn(q+vec2(e,0.))-a, vn(q+vec2(0.,e))-a)/e; }
      void main(){
        vec2 p = vWorld.xz; vec2 g = vec2(0.);
        g += wv(p, normalize(vec2(1.,0.35)), 0.55, 0.9, 0.035);
        g += wv(p, normalize(vec2(-0.4,1.)), 0.9, 1.15, 0.022);
        g += wv(p, normalize(vec2(0.7,-0.8)), 1.7, 1.6, 0.012);
        g += wv(p, normalize(vec2(-1.,-0.3)), 3.1, 2.1, 0.006);
        g += (sn(p*0.9 + vec2(uTime*0.06, uTime*0.04)) - sn(p*1.35 - vec2(uTime*0.05, uTime*0.07))) * 0.02;
        g += (vec2(vn(p*1.3+uTime*0.15), vn(p*1.3+17.+uTime*0.12)) - 0.5) * 0.03;
        for(int i=0;i<10;i++){ vec4 r=uRipples[i]; float age=uTime-r.z; if(age>0.&&age<4.5){ vec2 d=p-r.xy; float dist=length(d)+1e-4; float fr=age*1.5; float ring=exp(-pow((dist-fr)*2.2,2.))+0.6*exp(-pow((dist-fr*0.62)*2.8,2.)); float env=(1.-age/4.5)*r.w; g += d/dist*sin((dist-fr)*8.)*ring*env*0.32; } }
        vec3 n = normalize(vec3(-g.x,1.,-g.y));
        vec2 duv = (vWorld.xz - uRect.xy)/uRect.z; vec4 dt = texture2D(tDepth,duv); float depth = dt.r*uRect.w; float obs = dt.g;
        if(duv.x<0.||duv.y<0.||duv.x>1.||duv.y>1.){ depth = 3.; obs = 0.; }
        depth += vH;
        vec3 V = normalize(cameraPosition - vWorld);
        float cosv = max(dot(n,V),0.);
        float fres = clamp(0.03 + 0.97*pow(1.-cosv,5.0) + 0.035, 0., 1.);
        vec2 ruv = vUv.xy/vUv.w + n.xz*0.05;
        vec3 refl = texture2D(tDiffuse, ruv).rgb;
        // derinlik gradyanı: kıyıda canlı turkuaz → açıkta derin mavi
        float dk = smoothstep(0.0,2.6,depth);
        vec3 body = mix(uShallow*vec3(0.92,1.1,1.08), uDeep*vec3(0.9,1.0,1.12), pow(dk,0.75)); body = mix(body, uDeep*vec3(0.5,0.62,0.9), smoothstep(2.6,9.0,depth));
        float shade = 0.85 + 0.15*dot(n,uSunDir);
        vec3 c = mix(body*shade, refl, fres);
        // güneş parıltısı: keskin yansıma + yüzeyde her yere dağılmış küçük ışıltılar (videodaki gibi)
        vec3 R = reflect(-uSunDir,n); float rv = max(dot(R,V),0.);
        c += uSunColor*pow(rv,500.)*2.4;
        float gl = pow(vn(p*16.+uTime*vec2(1.4,-1.1)),3.) + pow(vn(p*27.-uTime*vec2(0.9,1.3)),3.)*0.7;
        c += uSunColor*pow(rv,60.)*gl*0.9*uDay;
        float distC = length(cameraPosition - vWorld);
        float near = 1.-smoothstep(25.,95.,distC);
        vec2 m1 = sn(p*5.3 + uTime*vec2(0.9,0.6)), m2 = sn(p*9.1 - uTime*vec2(0.7,1.1));
        vec3 nm = normalize(vec3(-(g.x+(m1.x+m2.x)*0.11), 1., -(g.y+(m1.y+m2.y)*0.11)));
        float sp = pow(max(dot(reflect(-uSunDir,nm),V),0.), 260.);
        float tw = smoothstep(0.62,0.97, vn(p*24.+vec2(uTime*0.8,-uTime*0.6))) * smoothstep(0.6,0.97, vn(p*37.-vec2(uTime*0.7,uTime*0.9)+7.));
        c += uSunColor*(sp*6.0 + tw*0.4*(0.3+rv*0.9))*uDay*(0.35+0.65*near)*(1.-fres*0.6);
        // dip ışık ağları (caustics): sığ yerde parlayan ağ deseni
        vec2 cq = p*1.9; float cT = uTime*0.35;
        float cr = pow(1.-abs(vn(cq+vec2(cT,cT*0.7))*2.-1.), 7.) + pow(1.-abs(vn(cq*1.7-vec2(cT*0.8,-cT))*2.-1.), 7.);
        float caus = cr*(1.-smoothstep(0.2,3.6,depth))*smoothstep(0.05,0.5,depth)*uDay*(1.-fres);
        c += vec3(0.55,0.95,1.0)*caus*0.42;
        // temas köpüğü: kıyı çizgisi (hareketli bantlar) + iskele/kaya/tekne çevresi
        float nz = vn(p*3.5+uTime*0.35)*0.6 + vn(p*8.-uTime*0.5)*0.4;
        float lines = smoothstep(0.5,0.92, sin(depth*20. - uTime*1.7 + nz*4.)*0.5+0.5);
        float shoreF = (1.-smoothstep(0.0,0.8,depth))*lines*0.85 + (1.-smoothstep(0.0,0.15,depth))*0.9;
        float boatF = 0.;
        for(int i=0;i<4;i++){ vec4 a=uBoatA[i], b=uBoatB[i]; if(b.z>0.5){ vec2 d=p-a.xy; vec2 q=vec2(d.x*a.z+d.y*a.w, -d.x*a.w+d.y*a.z); float k=length(q/b.xy); float dd=(k-1.)*min(b.x,b.y); boatF=max(boatF, 1.-smoothstep(0.0,0.55,dd)); } }
        float nzm = nz + 0.12*sin(uTime*1.4+p.x*2.5+p.y*1.7);
        float objF = clamp((max(obs, boatF*0.9) - (1.-nzm)*0.8)*3.2, 0., 1.);
        float foam = clamp(max(shoreF*smoothstep(0.22,0.5,nz+0.12), objF), 0., 1.);
        vec3 foamCol = vec3(1.)*(0.42+0.58*uDay);
        c = mix(c, foamCol, foam*0.92);
        float alpha = mix(0.14,0.9,pow(clamp(depth/7.0,0.,1.),0.85));
        alpha = max(alpha, fres); alpha = max(alpha, foam*0.88); alpha = max(alpha, clamp(caus*0.5 + sp*0.8 + tw*0.25*uDay, 0., 0.85));
        float dist = length(cameraPosition - vWorld); float hz = 1.-exp(-dist*dist*uHazeD*uHazeD);
        c = mix(c, uHaze, hz);
        gl_FragColor = vec4(c, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const SEG = isMobile ? 170 : 250, SIZE = 340; const CELL = SIZE / SEG;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  const water = new Reflector(geo, { textureWidth: width, textureHeight: height, color: 0x888888, clipBias: 0.003, shader, multisample: isMobile ? 0 : 4 });
  water.rotation.x = -Math.PI / 2; water.material.transparent = true; water.renderOrder = -1;
  water.userData.ripples = ripples; water.userData.ri = 0;
  water.userData.addRipple = (x, z, time, s = 1) => { const r = ripples[water.userData.ri++ % ripples.length]; r.set(x, z, time, s); };
  water.userData.bakeObs = () => bakeWaterObstacles(depthTex);
  /** dalga ağı kameranın altında kalsın (ızgara hücresine yapışık → titreme yok) */
  water.userData.follow = (cx, cz) => { water.position.x = Math.round(cx / CELL) * CELL; water.position.z = Math.round(cz / CELL) * CELL; };
  /** hareketli tekneler için temas köpüğü: list = [{x,z,a,hl,hw}] (en çok 4) */
  water.userData.setBoats = (list) => { for (let i = 0; i < 4; i++) { const b = list[i]; if (b) { boatA[i].set(b.x, b.z, Math.cos(b.a), Math.sin(b.a)); boatB[i].set(b.hl, b.hw, 1, 0); } else boatB[i].z = 0; } };
  return water;
}

/* ---------- ada yerleşimi: kulübe, tezgah, ateş, iniş noktası ---------- */
export const ISL = (() => {
  const la = Math.atan2(DOCK.pos.z - ISLAND.z, DOCK.pos.x - ISLAND.x) - 0.25, dir = new THREE.Vector2(Math.cos(la), Math.sin(la));
  let shoreR = 8; for (let r = 4; r < 24; r += 0.1) { if (islandD(ISLAND.x + dir.x * r, ISLAND.z + dir.y * r) < 0.3) { shoreR = r; break; } }
  const perp = new THREE.Vector2(-dir.y, dir.x);
  const P = (r, off = 0) => { const v = new THREE.Vector3(ISLAND.x + dir.x * r + perp.x * off, 0, ISLAND.z + dir.y * r + perp.y * off); v.y = terrainH(v.x, v.z); return v; };
  const cabin = P(-3.2, -1.6), stall = P(shoreR - 4.2, 4.6), fire = P(-0.6, -6.6);
  const landLand = P(shoreR - 1.0, 4.6), landWater = P(shoreR + 3.4, 4.6);
  return { dir, la, shoreR, cabin, stall, fire, landLand, landWater, cabinRot: -la, stallRot: -(la + Math.PI / 2 * 0.0), P };
})();
