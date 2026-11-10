import * as THREE from 'three';
import { mulberry } from './world.js';
import { box, cyl } from './props.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
let MT = null;
function mats(M) {
  if (MT) return MT;
  MT = {
    wood: std({ color: '#8a6440', roughness: 0.9 }), dwood: std({ color: '#5d4129', roughness: 0.95 }), pine: std({ color: '#c49a64', roughness: 0.9 }),
    plaster: std({ color: '#d8ccb0', roughness: 1 }), panel: std({ color: '#8f6d47', roughness: 0.95 }), iron: std({ color: '#2b2d30', roughness: 0.6, metalness: 0.5 }),
    cloth: ['#e9e2d0', '#c8503f', '#3f6f8f', '#6f8f4a', '#d6a63a'].map((c) => std({ color: c, roughness: 1 })), rug: ['#a0443a', '#3f5f7a', '#6a7f3f'].map((c) => std({ color: c, roughness: 1 })),
    stone: M.stone, glassJar: std({ color: '#9fcfb6', roughness: 0.25, transparent: true, opacity: 0.7 }), jam: std({ color: '#b03a3a', roughness: 0.5 }), fishG: std({ color: '#9fb4ba', roughness: 0.35, metalness: 0.3 }),
    plate: std({ color: '#efe9da', roughness: 0.6 }), plasterIn: std({ color: '#eadcb9', roughness: 1, emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 0.32 }), ceil: std({ color: '#c0925c', roughness: 0.95, emissive: new THREE.Color('#ffd49a'), emissiveIntensity: 0.22 }), fire: new THREE.MeshBasicMaterial({ color: '#ff8a2a' }), lamp: M.lantern, floor: M.deck, trim: M.trim,
  };
  MT.ceil.userData.ceil = true;
  return MT;
}

/**
 * İç mekân: kulübe yerel çerçevesinde (kapı +x yüzünde, zemin yüksekliği fy).
 * Duvarlar 1.2 m'lik lambri (çatı gizlenince oda "maket evi" gibi görünür). cols: yerel çarpışma kutuları.
 */
export function buildInterior(M, Lx, W, fy, kind = 'home', seed = 1, shell = null) {
  Lx -= 0.16; W -= 0.16; // kabuk duvarının 8 cm içinde: dış duvarla çakışıp titremesin (z-fighting)
  const m = mats(M); const rnd = mulberry(seed * 31 + 7); const g = new THREE.Group(); const cols = []; const lamps = [];
  const hx = Lx / 2, hz = W / 2; const T = 0.12;
  const add = (b, y) => { b.position.y += fy; g.add(b); return b; };
  const bx = (w, h, d, mat, x, y, z, cast = true) => add(box(w, h, d, mat, x, y, z, cast));
  const cy = (r1, r2, h, mat, x, y, z, seg = 10) => { const c = cyl(r1, r2, h, mat, seg); c.position.set(x, y + fy, z); g.add(c); return c; };
  const col = (x, z, w, d) => cols.push({ x, z, hx: w / 2, hz: d / 2 });
  // zemin + lambri
  bx(Lx - 0.04, 0.5, W - 0.04, m.floor, 0, -0.25 + 0.012, 0);
  const wain = kind === 'inn' ? m.dwood : m.panel; const wh = 1.25;
  bx(T, wh, W, wain, -hx + T / 2, wh / 2, 0); bx(Lx, wh, T, wain, 0, wh / 2, -hz + T / 2); bx(Lx, wh, T, wain, 0, wh / 2, hz - T / 2);
  const gap = 0.62; const segL = hz - gap; for (const s of [-1, 1]) bx(T, wh, segL, wain, hx - T / 2, wh / 2, s * (gap + segL / 2));
  for (const s of [-1, 1]) { bx(T + 0.06, 0.08, W, m.trim, -hx + T / 2, wh + 0.04, 0, false); }
  bx(Lx, 0.08, T + 0.06, m.trim, 0, wh + 0.04, -hz + T / 2, false); bx(Lx, 0.08, T + 0.06, m.trim, 0, wh + 0.04, hz - T / 2, false);
  for (const s of [-1, 1]) bx(T + 0.06, 0.08, segL, m.trim, hx - T / 2, wh + 0.04, s * (gap + segL / 2), false);
  // kapı pervazı (iç)
  for (const s of [-1, 1]) bx(0.1, 2.0, 0.08, m.trim, hx - 0.05, 1.0, s * gap);
  bx(0.1, 0.08, gap * 2 + 0.1, m.trim, hx - 0.05, 2.02, 0);
  const lamp = (x, y, z) => { bx(0.14, 0.22, 0.14, m.lamp, x, y + 0.11, z, false); lamps.push([x, y + 0.2 + fy, z]); };
  const rug = (x, z, w, d, k) => bx(w, 0.025, d, m.rug[k % 3], x, 0.03, z, false);
  const chair = (x, z, rot = 0) => { const c = new THREE.Group(); c.add(box(0.42, 0.05, 0.42, m.pine, 0, 0.45, 0)); c.add(box(0.05, 0.5, 0.42, m.pine, -0.2, 0.72, 0)); for (const a of [-1, 1]) for (const b of [-1, 1]) c.add(box(0.05, 0.45, 0.05, m.pine, a * 0.17, 0.22, b * 0.17)); c.position.set(x, fy, z); c.rotation.y = rot; g.add(c); };
  const table = (x, z, r = 0.55) => { cy(r, r, 0.06, m.pine, x, 0.78, z, 14); cy(0.07, 0.09, 0.78, m.dwood, x, 0.39, z, 8); cy(0.3, 0.3, 0.04, m.dwood, x, 0.02, z, 10); col(x, z, r * 2 - 0.1, r * 2 - 0.1); };
  const plateSet = (x, z) => { cy(0.13, 0.13, 0.02, m.plate, x, 0.82, z, 10); const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), m.fishG); f.scale.set(1.5, 0.4, 0.8); f.position.set(x, 0.86 + fy, z); g.add(f); };
  const barrel = (x, z, h = 0.78) => { cy(0.29, 0.29, h, m.wood, x, h / 2, z, 10); for (const y of [0.18, h - 0.18]) cy(0.31, 0.31, 0.03, m.iron, x, y, z, 10); col(x, z, 0.6, 0.6); };
  const crate = (x, z, s = 0.55, r = 0) => { const b = bx(s, s * 0.8, s, m.pine, x, s * 0.4, z); b.rotation.y = r; col(x, z, s, s); };
  const shelf = (x, y, z, len, vertical = false) => { bx(0.3, 0.05, len, m.dwood, x, y, z); bx(0.06, 0.18, 0.06, m.iron, x, y - 0.1, z - len / 2 + 0.1); bx(0.06, 0.18, 0.06, m.iron, x, y - 0.1, z + len / 2 - 0.1); };
  const jars = (x, y, z, n) => { for (let i = 0; i < n; i++) { cy(0.07, 0.07, 0.2, i % 2 ? m.glassJar : m.jam, x, y + 0.125, z - 0.45 * 0 + (i - (n - 1) / 2) * 0.22, 8); } };
  const stove = (x, z) => { bx(0.7, 0.85, 0.7, m.iron, x, 0.425, z); bx(0.76, 0.06, 0.76, m.iron, x, 0.88, z); cy(0.075, 0.075, 2.2, m.iron, x, 2.05, z, 8); cy(0.2, 0.17, 0.2, m.iron, x + 0.0, 1.0, z, 8); const fl = bx(0.3, 0.2, 0.02, m.fire, x + 0.36, 0.45, z, false); col(x, z, 0.75, 0.75); };
  const bed = (x, z, k) => { bx(2.1, 0.28, 1.15, m.dwood, x, 0.2, z); bx(2.0, 0.16, 1.05, m.cloth[0], x, 0.42, z, false); bx(1.25, 0.14, 1.1, m.cloth[1 + (k % 4)], x + 0.35, 0.5, z, false); bx(0.42, 0.14, 0.72, m.cloth[0], x - 0.75, 0.55, z, false); bx(0.08, 0.85, 1.25, m.dwood, x - 1.08, 0.5, z); col(x, z, 2.2, 1.2); };
  const hang = (x, z, n) => { for (let i = 0; i < n; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), m.fishG); f.scale.set(0.35, 1.2, 0.5); f.position.set(x, 1.85 + fy, z + (i - (n - 1) / 2) * 0.42); g.add(f); bx(0.012, 0.28, 0.012, m.iron, x, 2.12 - 0.14 + 0.1, z + (i - (n - 1) / 2) * 0.42, false); } bx(0.04, 0.04, n * 0.45, m.iron, x, 2.3, z, false); };
  const rods = (x, z) => { for (let i = 0; i < 3; i++) { const r = cyl(0.012, 0.02, 2.0, m.dwood, 5); r.position.set(x + 0.05 * i, 1.0 + fy, z + 0.08 * i); r.rotation.z = -0.12; g.add(r); } };
  const plant = (x, z) => { cy(0.16, 0.12, 0.28, std({ color: '#b5683a', roughness: 1 }), x, 0.14, z, 8); const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), std({ color: '#4f8f3a', roughness: 1, flatShading: true })); lf.position.set(x, 0.55 + fy, z); lf.scale.y = 1.3; g.add(lf); };
  const mirror = rnd() < 0.5 ? 1 : -1;

  if (kind === 'inn') {
    // tezgâh + raf, şömine, masalar, fıçılar
    bx(0.7, 1.05, W - 2.4, m.dwood, -hx + 1.7, 0.525, 0); bx(0.95, 0.08, W - 2.2, m.pine, -hx + 1.72, 1.08, 0); col(-hx + 1.7, 0, 0.95, W - 2.2);
    shelf(-hx + 0.3, 1.5, 0, W - 2.6); shelf(-hx + 0.3, 2.0, 0, W - 2.6);
    for (let i = 0; i < 8; i++) { cy(0.06, 0.06, 0.26, i % 3 ? m.glassJar : m.jam, -hx + 0.3, 1.66, (i - 3.5) * 0.4, 8); cy(0.045, 0.045, 0.12, m.plate, -hx + 0.3, 2.11, (i - 3.5) * 0.4, 8); }
    bx(0.5, 1.4, 1.8, m.stone, -hx + 0.35, 0.7, hz - 1.4); bx(0.12, 0.7, 1.1, m.fire, -hx + 0.62, 0.35, hz - 1.4, false); col(-hx + 0.4, hz - 1.4, 0.7, 1.9); lamp(-hx + 0.7, 1.43, hz - 1.4);
    for (const [x, z] of [[0.1, -hz + 1.3], [0.1, hz - 1.5], [1.7, 0.0]]) { table(x, z, 0.7); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; chair(x + Math.cos(a) * 1.05, z + Math.sin(a) * 1.05, -a + Math.PI); } lamp(x, 0.84, z); cy(0.07, 0.07, 0.13, m.plate, x + 0.3, 0.88, z + 0.2, 8); }
    barrel(-hx + 0.55, -hz + 0.6); barrel(-hx + 0.55, -hz + 1.3, 0.7); crate(hx - 0.7, -hz + 0.6, 0.6); plant(hx - 0.6, hz - 0.6); rug(0.4, 0.2, 3.2, 2.2, 0);
  } else if (kind === 'fisher') {
    bed(-hx + 1.2, mirror * (-hz + 0.8), 2); stove(-hx + 0.55, mirror * (hz - 0.6)); shelf(-hx + 0.2, 1.7, mirror * (hz - 1.6), 1.4); jars(-hx + 0.2, 1.72, mirror * (hz - 1.6), 5);
    barrel(hx - 0.6, mirror * (-hz + 0.6)); barrel(hx - 0.6, mirror * (-hz + 1.3), 0.7); crate(hx - 0.7, mirror * (hz - 0.6)); crate(hx - 0.55, mirror * (hz - 1.3), 0.45, 0.4);
    table(0.2, mirror * 0.1); chair(0.2, mirror * 0.1 + 0.9, Math.PI / 2 * mirror); chair(-0.7, mirror * 0.1, 0); plateSet(0.1, mirror * 0.1 + 0.15); lamp(0.35, 0.84, mirror * 0.1 - 0.2); hang(-0.2, 0, 4); rods(hx - 0.4, mirror * -hz * 0.15); rug(0.2, mirror * 0.1, 1.9, 1.4, 1); plant(-hx + 0.5, mirror * 0.1);
  } else if (kind === 'tiny') {
    bed(-hx + 1.1, mirror * (-hz + 0.72), 1 + (seed % 3)); stove(-hx + 0.45, mirror * (hz - 0.5)); shelf(-hx + 0.2, 1.65, mirror * (hz - 1.45), 1.1); jars(-hx + 0.2, 1.68, mirror * (hz - 1.45), 4);
    table(hx - 1.0, mirror * (hz - 0.85), 0.42); chair(hx - 1.0, mirror * (hz - 1.55), mirror * Math.PI / 2); lamp(hx - 0.85, 0.84, mirror * (hz - 0.85)); plateSet(hx - 1.15, mirror * (hz - 0.9));
    barrel(hx - 0.5, mirror * (-hz + 0.5)); rods(hx - 0.35, mirror * (-hz + 1.3)); rug(0.1, 0.0, 1.5, 1.1, seed);
  } else {
    bed(-hx + 1.15, mirror * (-hz + 0.75), 1 + (seed % 3)); stove(-hx + 0.5, mirror * (hz - 0.55));
    shelf(-hx + 0.2, 1.65, mirror * (hz - 1.7), 1.5); jars(-hx + 0.2, 1.68, mirror * (hz - 1.7), 5);
    bx(0.5, 1.55, 1.0, m.pine, hx - 0.35, 0.775, mirror * (-hz + 0.9)); bx(0.02, 1.4, 0.48, m.dwood, hx - 0.6, 0.77, mirror * (-hz + 0.66), false); col(hx - 0.35, mirror * (-hz + 0.9), 0.5, 1.0);
    table(0.15, mirror * 0.15, 0.6); chair(0.15, mirror * 0.15 + 0.95, mirror * Math.PI / 2); chair(0.15, mirror * 0.15 - 0.95, -mirror * Math.PI / 2); chair(-0.8, mirror * 0.15, 0); plateSet(0.15, mirror * 0.15 + 0.2); plateSet(0.15, mirror * 0.15 - 0.25); lamp(0.4, 0.84, mirror * 0.15);
    rug(0.1, mirror * 0.15, 2.0, 1.6, seed); plant(hx - 0.5, mirror * (hz - 0.55)); if (Lx > 3.8) rods(hx - 0.4, mirror * (hz - 1.3));
  }
  // iç çatı + üst duvarlar (kabuk gizlenince çatının altı görünür; tek yüzlü, içe bakar)
  if (shell) {
    const { wallH, rise } = shell; const ridgeY = wallH + rise; const mS = rise / (hz); const al = Math.atan(rise / hz); const dl = 0.1; const ix = hx - T, iz = hz - T; const wt = wh + 0.08;
    const tgt = [0, fy + 1.2, 0];
    const quad = (A, B, C, D, mat) => {
      const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]; const u = sub(B, A), v = sub(C, A); const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const cn = [(A[0] + B[0] + C[0] + D[0]) / 4, (A[1] + B[1] + C[1] + D[1]) / 4, (A[2] + B[2] + C[2] + D[2]) / 4]; const t = sub(tgt, cn); let P = [A, B, C, D]; if (n[0] * t[0] + n[1] * t[1] + n[2] * t[2] < 0) P = [A, D, C, B];
      const uv = [[0, 0], [1, 0], [1, 1], [0, 1]]; const pos = [], uvs = []; for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...P[k]); uvs.push(...uv[k]); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.computeVertexNormals();
      const me = new THREE.Mesh(geo, mat); me.receiveShadow = true; g.add(me); return me;
    };
    const wl = m.plasterIn;
    // yan/arka duvarlar
    quad([-ix, wt, -iz], [ix, wt, -iz], [ix, wallH, -iz], [-ix, wallH, -iz], wl); quad([-ix, wt, iz], [ix, wt, iz], [ix, wallH, iz], [-ix, wallH, iz], wl);
    quad([-ix, wt, -iz], [-ix, wt, iz], [-ix, wallH, iz], [-ix, wallH, -iz], wl);
    for (const s of [-1, 1]) quad([ix, wt, s * gap], [ix, wt, s * iz], [ix, wallH, s * iz], [ix, wallH, s * gap], wl);
    quad([ix, 2.05, -gap], [ix, 2.05, gap], [ix, wallH, gap], [ix, wallH, -gap], wl);
    // alınlıklar (üçgen)
    const yE = wallH, yR = ridgeY - dl;
    for (const sx of [-1, 1]) quad([sx * ix, yE, -iz], [sx * ix, yE, iz], [sx * ix, yR, 0], [sx * ix, yR, 0], wl);
    // çatı altı
    for (const s of [-1, 1]) quad([-ix, yR, 0], [ix, yR, 0], [ix, yE - 0.016, s * iz], [-ix, yE - 0.016, s * iz], m.ceil);
    // makaslar: kirişler, mertekler, mahya
    const sinA = Math.sin(al), cosA = Math.cos(al); const L = (iz) / cosA;
    const nR = Math.max(3, Math.round((2 * ix) / 0.95)); for (let i = 0; i < nR; i++) { const x = -ix + 0.1 + (2 * ix - 0.2) * i / (nR - 1);
      for (const s of [-1, 1]) { const r = box(0.08, 0.1, L, m.dwood, x, 0, 0, false); r.position.set(x, (yR + yE - 0.016) / 2 - 0.05 * cosA, s * iz / 2 - s * 0.05 * sinA); r.rotation.x = s * al; g.add(r); }
      if (i % 2 === 0) { const tb = box(0.12, 0.14, 2 * iz, m.dwood, x, yE - 0.08, 0, false); g.add(tb); } }
    g.add(box(2 * ix, 0.15, 0.15, m.dwood, 0, yR - 0.08, 0, false));
    for (const s of [-1, 1]) g.add(box(2 * ix, 0.1, 0.1, m.dwood, 0, yE - 0.06, s * (iz - 0.05), false));
  }
  return { group: g, cols, lamps };
}
