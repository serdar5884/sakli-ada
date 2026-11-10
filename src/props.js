import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainH, lakeD, islandD, ISLAND, ISL, DOCK, mulberry, smooth, fbm, vnoise, nearDockZone, nearDockMax, clamp, WATER_OBS } from './world.js';
import { COL } from './collide.js';

/* ---------- canvas dokuları ---------- */
export function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function boards(g, w, h, o) {
  const rnd = mulberry(o.seed || 1); const [r, gg, b] = o.base; const n = o.n;
  g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (rnd() - 0.5) * (o.vary || 30); g.fillStyle = `rgb(${clamp(r + v, 0, 255) | 0},${clamp(gg + v * 0.85, 0, 255) | 0},${clamp(b + v * 0.7, 0, 255) | 0})`;
    if (o.vertical) { g.fillRect(i * w / n, 0, w / n, h); } else { g.fillRect(0, i * h / n, w, h / n); }
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.07})`; g.lineWidth = 1; g.beginPath(); if (o.vertical) { const x = i * w / n + rnd() * w / n; g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 4, h); } else { const y = i * h / n + rnd() * h / n; g.moveTo(0, y); g.lineTo(w, y + (rnd() - 0.5) * 4); } g.stroke(); }
    if (rnd() < 0.5) { const kx = rnd() * w, ky = rnd() * h; g.fillStyle = 'rgba(40,25,10,0.35)'; g.beginPath(); g.ellipse(kx, ky, 4 + rnd() * 3, 7 + rnd() * 5, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.55)'; if (o.vertical) g.fillRect(i * w / n - 1, 0, 2, h); else g.fillRect(0, i * h / n - 1, w, 2);
  }
  if (o.moss) { for (let i = 0; i < o.moss; i++) { const x = rnd() * w, y = (rnd() < 0.6 ? rnd() * 0.3 + 0.7 : rnd()) * h; const rad = 8 + rnd() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(70,110,40,0.85)'); gr.addColorStop(1, 'rgba(70,110,40,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } }
}
export function shingles(g, w, h, o) {
  const rnd = mulberry(o.seed || 2); g.fillStyle = `rgb(${o.base.join(',')})`; g.fillRect(0, 0, w, h);
  const rows = 12, cols = 8; const rh = h / rows, cw = w / cols;
  for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) {
    const off = (j % 2) * cw / 2; const v = (rnd() - 0.5) * 36;
    g.fillStyle = `rgb(${clamp(o.base[0] + v, 0, 255) | 0},${clamp(o.base[1] + v * 0.8, 0, 255) | 0},${clamp(o.base[2] + v * 0.7, 0, 255) | 0})`;
    g.fillRect(i * cw + off, j * rh, cw - 2, rh - 1); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i * cw + off, j * rh + rh - 3, cw - 2, 3);
  }
  if (o.moss) for (let i = 0; i < o.moss; i++) { const x = rnd() * w, y = rnd() * h, rad = 14 + rnd() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(85,130,45,0.95)'); gr.addColorStop(1, 'rgba(85,130,45,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
}
function stoneTex(g, w, h) { const rnd = mulberry(9); g.fillStyle = '#7d7a72'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { const v = 90 + rnd() * 70; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(rnd() * w, rnd() * h, 18 + rnd() * 24, 10 + rnd() * 12); } }

/* ---------- malzemeler ---------- */
export function makeMaterials() {
  const wallTex = canvasTex(256, 256, (g, w, h) => boards(g, w, h, { base: [158, 112, 72], n: 8, vertical: true, seed: 3 }));
  const wallTexOld = canvasTex(256, 256, (g, w, h) => boards(g, w, h, { base: [118, 108, 94], n: 8, vertical: true, seed: 4, vary: 38, moss: 26 }));
  const deckTex = canvasTex(256, 64, (g, w, h) => boards(g, w, h, { base: [140, 104, 70], n: 1, vertical: true, seed: 5, vary: 10 }));
  const roofTex = canvasTex(256, 256, (g, w, h) => shingles(g, w, h, { base: [116, 66, 48], seed: 6 }), [2, 2]);
  const roofTexOld = canvasTex(256, 256, (g, w, h) => shingles(g, w, h, { base: [86, 80, 66], seed: 7, moss: 34 }), [2, 2]);
  const stone = canvasTex(128, 128, stoneTex);
  const gableTex = wallTex.clone(); gableTex.repeat.set(0.7, 0.7); gableTex.needsUpdate = true;
  const gableTexOld = wallTexOld.clone(); gableTexOld.repeat.set(0.7, 0.7); gableTexOld.needsUpdate = true;
  const m = {
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), gable: new THREE.MeshStandardMaterial({ map: gableTex, roughness: 0.9 }),
    wallOld: new THREE.MeshStandardMaterial({ map: wallTexOld, roughness: 1 }), gableOld: new THREE.MeshStandardMaterial({ map: gableTexOld, roughness: 1 }),
    deck: new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.95 }), roof: new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.85 }), roofOld: new THREE.MeshStandardMaterial({ map: roofTexOld, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.8 }), trimOld: new THREE.MeshStandardMaterial({ color: '#8c8574', roughness: 1 }), door: new THREE.MeshStandardMaterial({ color: '#3f6b66', roughness: 0.8 }), doorOld: new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 }),
    pile: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), stone: new THREE.MeshStandardMaterial({ map: stone, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#a9d6e0', roughness: 0.1, metalness: 0.1, emissive: new THREE.Color('#ffb55a'), emissiveIntensity: 0, transparent: true, opacity: 0.8 }),
    glassOld: new THREE.MeshStandardMaterial({ color: '#2a3a36', roughness: 0.2, transparent: true, opacity: 0.9 }),
    moss: new THREE.MeshStandardMaterial({ color: '#4d7a2a', roughness: 1, flatShading: true }), dark: new THREE.MeshStandardMaterial({ color: '#2d2a25', roughness: 1 }),
    rope: new THREE.MeshStandardMaterial({ color: '#c9b28a', roughness: 1 }), lantern: new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: new THREE.Color('#ffb04a'), emissiveIntensity: 0.4, roughness: 0.4 }),
  };
  return m;
}

const box = (w, h, d, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; };
function cyl(r1, r2, h, mat, seg = 10) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }

/* ---------- kulübe (ridge x ekseni boyunca, kapı +x yüzünde) ---------- */
export { box, cyl };
const _shut = {}; const shutMat = (c) => _shut[c] || (_shut[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
let _timber = null; const timberMat = () => _timber || (_timber = new THREE.MeshStandardMaterial({ color: '#4b3324', roughness: 0.9 }));
const _fl = { geo: null, mats: [] };
function flowerBits(g, w, x, y) { // pencere çiçekliğindeki çiçekler (paylaşılan geometri/malzeme)
  if (!_fl.geo) { _fl.geo = new THREE.IcosahedronGeometry(0.075, 0); _fl.mats = ['#e65a78', '#f2c230', '#f4f0e6', '#e8503a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, flatShading: true })); _fl.leaf = new THREE.MeshStandardMaterial({ color: '#4f8a34', roughness: 1, flatShading: true }); }
  const n = Math.max(3, Math.round(w / 0.2)); for (let i = 0; i < n; i++) { const z = -w / 2 + 0.08 + (w - 0.16) * i / (n - 1); const lf = new THREE.Mesh(_fl.geo, _fl.leaf); lf.scale.set(1.1, 0.8, 1.1); lf.position.set(x, y, z); g.add(lf); const f = new THREE.Mesh(_fl.geo, _fl.mats[i % 4]); f.scale.setScalar(0.8); f.position.set(x, y + 0.08, z); g.add(f); }
}
let _roundGeo = null;
export function buildCabin(M, o) {
  const { Lx, W, rise, old } = o; const floors = o.floors || 1; const wallH = o.wallH * floors; const fh = o.wallH; const g = new THREE.Group();
  const mm = o.mats || {}; const wall = mm.wall || (old ? M.wallOld : M.wall), gable = mm.gable || (old ? M.gableOld : M.gable), roofM = mm.roof || (old ? M.roofOld : M.roof), trim = old ? M.trimOld : M.trim, glass = old ? M.glassOld : M.glass, doorM = mm.door || (old ? M.doorOld : M.door);
  g.add(box(Lx, wallH, W, wall, 0, wallH / 2, 0));
  const m = rise / (W / 2), alpha = Math.atan(m), ov = 0.38;
  const ridgeY = wallH + rise, eaveY = ridgeY - m * (W / 2 + ov), slabLen = (W / 2 + ov) / Math.cos(alpha);
  for (const s of [1, -1]) {
    const slab = box(Lx + 0.8, 0.12, slabLen, roofM, 0, (ridgeY + eaveY) / 2 + 0.06, s * (W / 2 + ov) / 2); slab.rotation.x = s * alpha; g.add(slab);
    if (old) slab.rotation.z = s * 0.015;
  }
  g.add(box(Lx + 0.9, 0.12, 0.18, trim, 0, ridgeY + 0.1, 0));
  const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(0, rise); sh.closePath();
  for (const s of [1, -1]) { const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false }), gable); gm.rotation.y = Math.PI / 2; gm.position.set(s * (Lx / 2) - 0.07, wallH, 0); gm.castShadow = true; g.add(gm); }
  if (floors > 1) g.add(box(Lx + 0.06, 0.1, W + 0.06, trim, 0, fh, 0, false)); // kat kuşağı
  // kapı (zemin kat)
  const dh = 1.75;
  if (o.open) { g.add(box(0.06, dh, 0.95, M.dark, Lx / 2 + 0.03, dh / 2, 0, false)); const lf = box(0.08, dh, 0.9, doorM, Lx / 2 + 0.1, dh / 2, -1.0); g.add(lf); }
  else g.add(box(0.08, dh, 0.95, doorM, Lx / 2 + 0.02, dh / 2, 0));
  g.add(box(0.1, dh + 0.15, 0.08, trim, Lx / 2 + 0.03, (dh + 0.15) / 2, 0.52)); g.add(box(0.1, dh + 0.15, 0.08, trim, Lx / 2 + 0.03, (dh + 0.15) / 2, -0.52)); g.add(box(0.1, 0.08, 1.12, trim, Lx / 2 + 0.03, dh + 0.08, 0));
  g.add(box(0.1, 0.08, 0.08, M.dark, Lx / 2 + 0.07, 0.95, 0.32));
  const win = (x, y, z, rotY, w = 0.8, h = 0.8) => {
    const wg = new THREE.Group(); wg.position.set(x, y, z); wg.rotation.y = rotY;
    wg.add(box(0.06, h, w, glass, 0, 0, 0, false));
    wg.add(box(0.1, 0.07, w + 0.14, trim, 0, h / 2 + 0.03, 0)); wg.add(box(0.1, 0.07, w + 0.14, trim, 0, -h / 2 - 0.03, 0));
    wg.add(box(0.1, h + 0.1, 0.07, trim, 0, 0, w / 2 + 0.03)); wg.add(box(0.1, h + 0.1, 0.07, trim, 0, 0, -w / 2 - 0.03));
    wg.add(box(0.09, h, 0.04, trim, 0, 0, 0)); wg.add(box(0.09, 0.04, w, trim, 0, 0, 0));
    if (o.shutter) { const sm = shutMat(o.shutter); for (const sd of [-1, 1]) wg.add(box(0.05, h + 0.12, w * 0.46, sm, 0.08, 0, sd * (w / 2 + 0.1 + w * 0.23)));
      wg.add(box(0.2, 0.15, w + 0.16, sm, 0.12, -h / 2 - 0.16, 0)); flowerBits(wg, w, 0.13, -h / 2 - 0.05); }
    return wg;
  };
  const wz = Math.min(1.2, W / 2 - 0.55);
  g.add(win(Lx / 2 + 0.02, 1.25, wz, 0)); g.add(win(Lx / 2 + 0.02, 1.25, -wz, 0));
  const nSide = Lx > 4.6 ? 3 : 2; const sideX = nSide === 3 ? [-Lx * 0.3, 0, Lx * 0.3] : [-Lx * 0.18, Lx * 0.2];
  for (let f = 0; f < floors; f++) for (const s of [1, -1]) for (const x of sideX) g.add(win(x, fh * f + 1.25, s * (W / 2 + 0.02), Math.PI / 2));
  if (floors > 1) { g.add(win(Lx / 2 + 0.02, fh + 1.25, wz + 0.2, 0)); g.add(win(Lx / 2 + 0.02, fh + 1.25, -wz - 0.2, 0)); g.add(win(-Lx / 2 - 0.02, fh + 1.25, 0.9, 0)); g.add(win(-Lx / 2 - 0.02, fh + 1.25, -0.9, 0)); }
  if (!old && o.flowers !== false) {
    for (const s of [1, -1]) { const fb = box(0.3, 0.2, 0.9, M.wall, Lx / 2 + 0.2, 0.7, s * wz); g.add(fb); const rnd = mulberry(40 + s); for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + rnd() * 0.04, 0), new THREE.MeshStandardMaterial({ color: ['#e04a4a', '#f2c23a', '#f4f4f4', '#d86ab0'][i % 4], roughness: 0.8, flatShading: true })); f.position.set(Lx / 2 + 0.2 + (rnd() - 0.5) * 0.15, 0.86 + rnd() * 0.1, s * wz + (rnd() - 0.5) * 0.8); g.add(f); } }
  }
  // ahşap iskelet (yarı ahşap ev) + yuvarlak çatı penceresi
  if (o.timber) {
    const tm = timberMat(); const tk = 0.1, pr = 0.1;
    const bm = (len, ax, x, y, z, ang) => { const bb = ax === 'x' ? box(len, tk, tk, tm, x, y, z) : box(tk, len, tk, tm, x, y, z); if (ang) { if (ax === 'x') bb.rotation.z = ang; else bb.rotation.x = ang; } g.add(bb); return bb; };
    const mids = []; for (let i = 0; i + 1 < sideX.length; i++) mids.push((sideX[i] + sideX[i + 1]) / 2);
    const px = [-Lx / 2 + 0.03, ...mids, Lx / 2 - 0.03];
    for (let f = 0; f < floors; f++) {
      const y0 = (f === 0 ? 0.32 : fh * f), y1 = fh * (f + 1) - 0.05, hh = y1 - y0;
      for (const s of [1, -1]) {
        const zz = s * (W / 2 + pr);
        bm(Lx + 0.06, 'x', 0, y0, zz); bm(Lx + 0.06, 'x', 0, y1, zz); if (f > 0) bm(Lx + 0.06, 'x', 0, fh * f + 0.02, zz);
        for (const x of px) bm(hh, 'y', x, (y0 + y1) / 2, zz);
        // köşe payandaları
        const x0 = px[0], x1 = (px[0] + (sideX[0] - 0.55)) / 2 * 0 + (sideX[0] - 0.55); const bw = x1 - x0, bh = hh * 0.62; if (bw > 0.3) { const len = Math.hypot(bw, bh); bm(len, 'x', (x0 + x1) / 2, y1 - bh / 2 - 0.05, zz, Math.atan2(bh, bw)); }
        const xe = px[px.length - 1], xs = sideX[sideX.length - 1] + 0.55; const bw2 = xe - xs; if (bw2 > 0.3) { const len = Math.hypot(bw2, bh); bm(len, 'x', (xe + xs) / 2, y1 - bh / 2 - 0.05, zz, -Math.atan2(bh, bw2)); }
      }
      for (const sx of [1, -1]) { const xx = sx * (Lx / 2 + 0.1); const zb = (len, z, y, ang) => { const bb = box(tk, len, tk, tm, xx, y, z); if (ang) bb.rotation.x = ang; g.add(bb); };
        const hz2 = W / 2 - 0.03; zb(hh, hz2, (y0 + y1) / 2); zb(hh, -hz2, (y0 + y1) / 2);
        const hb = box(tk, tk, W + 0.06, tm, xx, y1, 0); g.add(hb); if (f > 0) g.add(box(tk, tk, W + 0.06, tm, xx, fh * f + 0.02, 0)); }
    }
    // üçgen alınlık kirişleri
    for (const sx of [1, -1]) { const xx = sx * (Lx / 2 + 0.1); const yb = wallH + 0.03;
      const bz = (dy, dz, cy, cz) => { const len = Math.hypot(dy, dz); const bb = box(tk, len, tk, tm, xx, cy, cz); bb.rotation.x = Math.atan2(dz, dy); g.add(bb); };
      g.add(box(tk, tk, W - 0.1, tm, xx, yb, 0)); g.add(box(tk, rise - 0.1, tk, tm, xx, yb + (rise - 0.1) / 2, 0));
      const k0 = rise * 0.5; bz(k0, W / 2 * 0.62, yb + k0 / 2, W / 4 * 0.62); bz(k0, -W / 2 * 0.62, yb + k0 / 2, -W / 4 * 0.62);
    }
  }
  if (o.roundWin) {
    if (!_roundGeo) { _roundGeo = { disc: new THREE.CylinderGeometry(0.3, 0.3, 0.05, 18).rotateZ(Math.PI / 2), ring: new THREE.TorusGeometry(0.32, 0.045, 6, 18).rotateY(Math.PI / 2) }; }
    for (const sx of [1, -1]) { const yy = wallH + rise * 0.36; const d = new THREE.Mesh(_roundGeo.disc, glass); d.position.set(sx * (Lx / 2 + 0.1), yy, 0); g.add(d); const r = new THREE.Mesh(_roundGeo.ring, trim); r.position.set(sx * (Lx / 2 + 0.12), yy, 0); g.add(r); g.add(box(0.07, 0.05, 0.64, trim, sx * (Lx / 2 + 0.12), yy, 0)); g.add(box(0.07, 0.64, 0.05, trim, sx * (Lx / 2 + 0.12), yy, 0)); }
  }
  // sundurma
  if (o.porch) {
    const d = o.porch; const px = Lx / 2 + d / 2; const pw = Math.min(W + 0.6, 3.6);
    g.add(box(d, 0.14, pw, M.deck, px, 0.07, 0, false));
    for (const s of [1, -1]) { const post = box(0.12, 2.1, 0.12, M.trim, Lx / 2 + d - 0.1, 1.05 + 0.14, s * (pw / 2 - 0.1)); g.add(post); g.add(box(0.12, 0.7, 0.12, M.pile, Lx / 2 + d - 0.1, -0.35, s * (pw / 2 - 0.1))); }
    const lt = box(d + 0.3, 0.1, pw + 0.3, roofM, Lx / 2 + d / 2 + 0.1, 2.2 + 0.14, 0); lt.rotation.z = -0.12; g.add(lt);
    g.add(box(d + 0.2, 0.08, 0.08, trim, Lx / 2 + d / 2 + 0.1, 2.24, pw / 2)); g.add(box(d + 0.2, 0.08, 0.08, trim, Lx / 2 + d / 2 + 0.1, 2.24, -pw / 2));
    for (const s of [1, -1]) { const r = box(0.06, 0.06, pw / 2 - 0.35, trim, Lx / 2 + d - 0.1, 0.72, s * (pw / 4 + 0.15)); g.add(r); }
    const lanternOn = box(0.18, 0.24, 0.18, M.lantern, Lx / 2 + d - 0.1, 1.85, 0.0, false); g.add(lanternOn); g.userData.porchLantern = new THREE.Vector3(Lx / 2 + d - 0.1, 1.85, 0);
    g.add(box(0.7, 0.4, 0.45, M.wallOld, Lx / 2 + 0.35, 0.34, pw / 2 - 0.3)); // bank
  }
  // balkon (üst kat)
  if (floors > 1) {
    const bd = 1.2; g.add(box(bd, 0.1, 2.6, M.deck, Lx / 2 + bd / 2, fh + 0.04, 0, false));
    for (const z of [-1.25, -0.4, 0.4, 1.25]) g.add(box(0.06, 0.95, 0.06, trim, Lx / 2 + bd - 0.04, fh + 0.52, z));
    g.add(box(0.06, 0.06, 2.6, trim, Lx / 2 + bd - 0.04, fh + 1.0, 0)); for (const s of [1, -1]) g.add(box(bd, 0.06, 0.06, trim, Lx / 2 + bd / 2, fh + 1.0, s * 1.3));
    g.add(box(0.1, 1.9, 0.95, doorM, Lx / 2 + 0.02, fh + 1.0, 0)); g.add(box(0.1, 0.08, 1.1, trim, Lx / 2 + 0.03, fh + 2.0, 0));
    for (const s of [1, -1]) g.add(box(0.12, 0.28, 0.12, M.pile, Lx / 2 + bd - 0.06, fh - 0.18, s * 1.22));
  }
  // çatı penceresi
  if (o.dormer) {
    const dz = W / 4 + 0.15, dx = -Lx * 0.18; const y0 = ridgeY - m * dz; const dh2 = 1.0;
    g.add(box(1.1, dh2, 0.9, wall, dx, y0 + dh2 / 2 - 0.15, dz)); g.add(win(dx, y0 + dh2 / 2 - 0.1, dz + 0.46, Math.PI / 2, 0.6, 0.55));
    for (const s of [1, -1]) { const dr = box(0.9 + 0.5, 0.08, 0.78, roofM, dx + s * 0.32, y0 + dh2 + 0.12, dz); dr.rotation.z = -s * 0.55; g.add(dr); }
  }
  // baca(lar)
  const chz = -W / 4; const roofYat = ridgeY - m * Math.abs(chz);
  const chs = [[-Lx / 4, chz]]; if (o.chimney2) chs.push([Lx / 4, -chz]);
  const tops = [];
  chs.forEach(([cx, cz], i) => { const ry = ridgeY - m * Math.abs(cz); const ch = box(0.6, 1.5, 0.6, M.stone, cx, ry + 0.3, cz); g.add(ch); g.add(box(0.75, 0.12, 0.75, M.stone, cx, ry + 1.1, cz)); if (old) { ch.rotation.z = 0.12; ch.rotation.x = -0.05; } tops.push(new THREE.Vector3(cx, ry + 1.25, cz)); });
  g.userData = Object.assign(g.userData || {}, { ridgeY, W, Lx, wallH, rise, glassMats: [glass], chimneyTop: tops[0], chimneys: tops });
  return g;
}

/* ---------- ağaçlar, çalılar ---------- */
function part(geo, color, mtx) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.deleteAttribute('uv'); if (mtx) g.applyMatrix4(mtx);
  const n = g.attributes.position.count; const c = new Float32Array(n * 3); const col = new THREE.Color(color); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
export function swayMat(base, timeU, amp = 0.05, vertexSway = true, duck = false) {
  const m = base; m.customProgramCacheKey = () => `sway${duck}${vertexSway}${amp}`; m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.);
      #endif
      float sw = ${vertexSway ? 'position.y' : '1.0'} * ${amp.toFixed(3)};
      transformed.x += sin(uTime*1.3 + ip.x*0.37 + ip.z*0.21 + position.y*0.4)*sw*0.35;
      transformed.z += cos(uTime*1.1 + ip.z*0.33 + ip.x*0.17 + position.y*0.3)*sw*0.25;
      ${duck ? 'transformed.y *= mix(0.2, 1.0, smoothstep(2.5, 9.0, distance(ip, cameraPosition)));' : ''}`);
  }; return m;
}

/** Büyük InstancedMesh'leri 28 m'lik hücrelere böler: kamera/gölge/yansıma kırpması (frustum culling) gerçekten çalışsın. Görüntü aynı kalır. */
function chunkify(out, cell = 28) {
  const list = out.children.filter((o) => o.isInstancedMesh); const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), col = new THREE.Color();
  for (const im of list) {
    const buckets = new Map();
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); pos.setFromMatrixPosition(m4); const key = Math.floor(pos.x / cell) + ',' + Math.floor(pos.z / cell); let b = buckets.get(key); if (!b) buckets.set(key, b = []); b.push(i); }
    const g = new THREE.Group();
    for (const idx of buckets.values()) {
      const c = new THREE.InstancedMesh(im.geometry, im.material, idx.length);
      idx.forEach((si, k) => { im.getMatrixAt(si, m4); c.setMatrixAt(k, m4); if (im.instanceColor) { im.getColorAt(si, col); c.setColorAt(k, col); } });
      c.castShadow = im.castShadow; c.receiveShadow = im.receiveShadow; c.instanceMatrix.needsUpdate = true; if (c.instanceColor) c.instanceColor.needsUpdate = true;
      c.computeBoundingSphere(); c.boundingSphere.radius += 2.5; // rüzgâr salınımı payı
      g.add(c);
    }
    out.remove(im); out.add(g); im.dispose && im.dispose();
    if (out.userData.grass === im) out.userData.grass = g;
  }
}
export function buildVegetation(scene, M, timeU, quality = 1) {
  const rnd = mulberry(1234); const out = new THREE.Group(); scene.add(out);
  const foliageMat = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), timeU, 0.008);
  const grassMat = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), timeU, 0.5);
  const treeTypes = {};
  // çam
  { const gs = [part(new THREE.CylinderGeometry(0.14, 0.26, 2.6, 6), '#4a3626', M4(0, 1.3, 0))]; const cols = ['#1f4d2a', '#25582f', '#2c6334', '#336d3a']; for (let i = 0; i < 5; i++) { const r = 1.9 - i * 0.32, h = 2.3 - i * 0.12; gs.push(part(new THREE.ConeGeometry(r, h, 7), cols[i % 4], M4(0, 2.2 + i * 1.05, 0, 1, 1, 1, i))); } treeTypes.pine = mergeGeometries(gs); }
  // geniş yapraklı
  { const gs = [part(new THREE.CylinderGeometry(0.16, 0.3, 3.0, 6), '#5a4230', M4(0, 1.5, 0))]; const cols = ['#3f7d2c', '#4e8f32', '#5c9b38', '#386f28']; const r2 = mulberry(5); for (let i = 0; i < 6; i++) { const a = r2() * 6.28, d = i === 0 ? 0 : 0.9 + r2() * 0.8; gs.push(part(new THREE.IcosahedronGeometry(1.3 + r2() * 0.5, 0), cols[i % 4], M4(Math.cos(a) * d, 3.6 + r2() * 1.6, Math.sin(a) * d, 1, 0.85, 1, r2() * 3))); } treeTypes.broad = mergeGeometries(gs); }
  // huş
  { const gs = [part(new THREE.CylinderGeometry(0.1, 0.17, 4.0, 6), '#e8e6dc', M4(0, 2.0, 0))]; for (let i = 0; i < 6; i++) gs.push(part(new THREE.BoxGeometry(0.22, 0.05, 0.22), '#2a2a28', M4(0, 0.5 + i * 0.6, 0, 1, 1, 1, i))); const cols = ['#7fae3a', '#8fbf44', '#6a9a30']; const r2 = mulberry(8); for (let i = 0; i < 5; i++) { const a = r2() * 6.28, d = 0.5 + r2() * 0.6; gs.push(part(new THREE.IcosahedronGeometry(0.95 + r2() * 0.3, 0), cols[i % 3], M4(Math.cos(a) * d, 3.8 + r2() * 1.8, Math.sin(a) * d, 1, 1.0, 1, r2() * 3))); } treeTypes.birch = mergeGeometries(gs); }
  // sarkık söğüt
  { const gs = [part(new THREE.CylinderGeometry(0.2, 0.42, 3.4, 7), '#4b3b2b', M4(0, 1.7, 0))]; const r2 = mulberry(11); const cols = ['#7fa83a', '#8ab842', '#6f9a34'];
    for (let i = 0; i < 5; i++) { const a = r2() * 6.28, d = i === 0 ? 0 : 1.1 + r2() * 0.6; gs.push(part(new THREE.IcosahedronGeometry(1.5 + r2() * 0.4, 0), cols[i % 3], M4(Math.cos(a) * d, 4.2 + r2() * 0.8, Math.sin(a) * d, 1, 0.7, 1, r2()))); }
    for (let i = 0; i < 46; i++) { const a = (i / 46) * 6.28 + r2() * 0.2, d = 1.7 + r2() * 1.4; const len = 2.6 + r2() * 2.2; const sg = new THREE.BoxGeometry(0.1, len, 0.1); sg.translate(0, -len / 2, 0); gs.push(part(sg, cols[i % 3], M4(Math.cos(a) * d, 4.6 - r2() * 0.5, Math.sin(a) * d, 1, 1, 1, r2()))); }
    treeTypes.willow = mergeGeometries(gs); }
  const tree = (type, count) => { const im = new THREE.InstancedMesh(treeTypes[type], foliageMat, count); im.castShadow = true; im.receiveShadow = true; im.count = 0; out.add(im); return im; };
  const meshes = { pine: tree('pine', Math.round(1250 * quality)), broad: tree('broad', Math.round(1050 * quality)), birch: tree('birch', 230), willow: tree('willow', 40) };
  const TR = { pine: 0.34, broad: 0.4, birch: 0.24, willow: 0.5 };
  const treeList = [];
  const addTree = (type, x, z, s) => {
    const im = meshes[type]; if (im.count >= im.instanceMatrix.count) return false; const y = terrainH(x, z) - 0.1;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.06, rnd() * 6.28, (rnd() - 0.5) * 0.06)), new THREE.Vector3(s * (0.9 + rnd() * 0.2), s * (0.85 + rnd() * 0.35), s * (0.9 + rnd() * 0.2)));
    im.setMatrixAt(im.count, m); const tint = 0.82 + rnd() * 0.36; im.setColorAt(im.count, new THREE.Color(tint, tint * (0.95 + rnd() * 0.1), tint * 0.95)); im.count++;
    const r = TR[type] * Math.min(1.5, s); COL.addTree(x, z, r); treeList.push([x, z, r]); return true;
  };
  // yoğunluk için mekânsal karma
  const hash = new Map(); const hk = (i, j) => i * 7919 + j; const CS = 6;
  const near = (x, z, d) => { const i = Math.floor(x / CS), j = Math.floor(z / CS), k = Math.ceil(d / CS); for (let a = -k; a <= k; a++) for (let b = -k; b <= k; b++) { const l = hash.get(hk(i + a, j + b)); if (l) for (let n = 0; n < l.length; n += 2) if (Math.hypot(l[n] - x, l[n + 1] - z) < d) return true; } return false; };
  const reg = (x, z) => { const k = hk(Math.floor(x / CS), Math.floor(z / CS)); let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(x, z); };
  const landOK = (x, z, d) => { const ld = lakeD(x, z), id = islandD(x, z); return ld < -d && id < -d; };
  // orman: kıyıdan uzak
  for (let tries = 0; tries < 120000; tries++) {
    const x = (rnd() - 0.5) * 340, z = (rnd() - 0.5) * 340; const ld = lakeD(x, z); const r = Math.hypot(x, z);
    if (!landOK(x, z, 4.5) || nearDockMax(x, z, 5)) continue;
    { const hh = terrainH(x, z); if (hh > 82 || (hh > 48 && rnd() < smooth(48, 82, hh))) continue; } // yüksek yamaçlarda ağaç seyrelir, zirve çıplak
    const dens = smooth(-4, -16, ld) * 0.8 + 0.5 * fbm(x * 0.03, z * 0.03) + (r > 85 ? 0.4 : 0); if (rnd() > dens) continue;
    const u = rnd(); const t = u < 0.46 ? 'pine' : u < 0.84 ? 'broad' : 'birch';
    if (near(x, z, 2.6) && rnd() < 0.85) continue;
    if (addTree(t, x, z, (r > 110 ? 1.5 : r > 80 ? 1.2 : 1) * (0.8 + rnd() * 0.7))) reg(x, z);
  }
  // kıyıda söğütler
  for (let tries = 0, c = 0; tries < 9000 && c < 34; tries++) {
    const x = (rnd() - 0.5) * 170, z = (rnd() - 0.5) * 170; const ld = lakeD(x, z); if (ld > -2.2 || ld < -6.5 || nearDockMax(x, z, 7) || islandD(x, z) > -3) continue;
    if (near(x, z, 6)) continue; if (addTree('willow', x, z, 0.95 + rnd() * 0.4)) { reg(x, z); c++; }
  }
  // kıyıda huş/geniş ağaçlar
  for (let tries = 0, c = 0; tries < 8000 && c < 80; tries++) {
    const x = (rnd() - 0.5) * 170, z = (rnd() - 0.5) * 170; const ld = lakeD(x, z); if (ld > -3 || ld < -9 || nearDockMax(x, z, 5)) continue; if (islandD(x, z) > -3) continue;
    if (near(x, z, 3.5)) continue; if (addTree(rnd() < 0.5 ? 'broad' : 'birch', x, z, 0.8 + rnd() * 0.5)) { reg(x, z); c++; }
  }
  // ada: evin, tezgahın, ateşin çevresi açık; kıyıda ağaçlar
  const clear = (x, z) => {
    const dc = Math.hypot(x - ISL.cabin.x, z - ISL.cabin.z); if (dc < 7.4) return true;
    if (Math.hypot(x - ISL.stall.x, z - ISL.stall.z) < 4.2) return true; if (Math.hypot(x - ISL.fire.x, z - ISL.fire.z) < 4.2) return true;
    // iniş koridoru
    const rx = x - ISLAND.x, rz = z - ISLAND.z; const along = rx * ISL.dir.x + rz * ISL.dir.y, side = -rx * ISL.dir.y + rz * ISL.dir.x; if (along > -3 && Math.abs(side - 3.2) < 5.8) return true; return false;
  };
  for (let tries = 0, c = 0; tries < 6000 && c < 95; tries++) {
    const a = rnd() * 6.28, d = rnd() * 14; const x = ISLAND.x + Math.cos(a) * d, z = ISLAND.z + Math.sin(a) * d; if (islandD(x, z) < 1.2 || clear(x, z)) continue;
    if (near(x, z, 2.6)) continue;
    const u = rnd(); if (addTree(u < 0.4 ? 'pine' : u < 0.8 ? 'broad' : 'birch', x, z, 0.8 + rnd() * 0.5)) { reg(x, z); c++; }
  }
  out.userData.trees = treeList;
  for (const k in meshes) { meshes[k].instanceMatrix.needsUpdate = true; if (meshes[k].instanceColor) meshes[k].instanceColor.needsUpdate = true; }

  // çalılar + kayalar
  { const bush = mergeGeometries([part(new THREE.IcosahedronGeometry(0.8, 0), '#3f7a2a', M4(0, 0.55, 0, 1, 0.8, 1)), part(new THREE.IcosahedronGeometry(0.6, 0), '#4f8c30', M4(0.6, 0.4, 0.2)), part(new THREE.IcosahedronGeometry(0.55, 0), '#366d26', M4(-0.5, 0.4, -0.3))]);
    const im = new THREE.InstancedMesh(bush, foliageMat, 560); let n = 0; const m = new THREE.Matrix4();
    for (let t = 0; t < 12000 && n < 560; t++) { const x = (rnd() - 0.5) * 300, z = (rnd() - 0.5) * 300; const ld = lakeD(x, z), id = islandD(x, z); if (!((ld < -2.5) || id > 1.5) || nearDockMax(x, z, 2.5) || (id > 0 && clear(x, z))) continue; if (ld > 0 && id < 1.5) continue; const y = terrainH(x, z); if (y < 0.2) continue; const s = 0.7 + rnd() * 1.0; m.compose(new THREE.Vector3(x, y - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(s, s, s)); im.setMatrixAt(n, m); const tt = 0.8 + rnd() * 0.4; im.setColorAt(n, new THREE.Color(tt, tt, tt)); n++; }
    im.count = n; im.castShadow = true; im.receiveShadow = true; out.add(im); }
  { const rg = new THREE.DodecahedronGeometry(0.7, 0); const rm = new THREE.MeshStandardMaterial({ color: '#8a877d', roughness: 1, flatShading: true }); const im = new THREE.InstancedMesh(rg, rm, 180); let n = 0; const m = new THREE.Matrix4();
    for (let t = 0; t < 12000 && n < 180; t++) { const x = (rnd() - 0.5) * 170, z = (rnd() - 0.5) * 170; const ld = lakeD(x, z), id = islandD(x, z); const nearShore = (ld > -3.5 && ld < 2.4) || (id > -1.8 && id < 3); if (!nearShore || nearDockMax(x, z, 2.5) || (islandD(x, z) > -3 && clear(x, z))) continue; const y = terrainH(x, z); const s = 0.3 + rnd() * 0.9; if (y < 0.9) WATER_OBS.rocks.push([x, z, s * 0.85]); m.compose(new THREE.Vector3(x, y + s * 0.12, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), new THREE.Vector3(s * 1.3, s * 0.75, s)); im.setMatrixAt(n, m); const tt = 0.7 + rnd() * 0.4; im.setColorAt(n, new THREE.Color(tt, tt, tt * 0.97)); n++; }
    im.count = n; im.castShadow = true; im.receiveShadow = true; out.add(im); }

  // çimen püskülleri
  { const gg = []; const tuft = (cols) => { const parts = []; const r2 = mulberry(3); for (let b = 0; b < 4; b++) { const a = (b / 4) * 6.28 + r2(), h = 0.45 + r2() * 0.45, lean = 0.2 + r2() * 0.25; const geo = new THREE.BufferGeometry(); const bx = Math.cos(a) * 0.07, bz = Math.sin(a) * 0.07; const w = 0.07; const nx = -Math.sin(a), nz = Math.cos(a);
        geo.setAttribute('position', new THREE.Float32BufferAttribute([bx - nx * w, 0, bz - nz * w, bx + nx * w, 0, bz + nz * w, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean], 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute([...cols[0], ...cols[0], ...cols[1]], 3)); geo.computeVertexNormals(); geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); parts.push(geo); } return mergeGeometries(parts); };
    const c0 = new THREE.Color('#2f5f1f'), c1 = new THREE.Color('#8cc23c'); const geo = tuft([[c0.r, c0.g, c0.b], [c1.r, c1.g, c1.b]]);
    const N = Math.round(36000 * quality); const im = new THREE.InstancedMesh(geo, grassMat, N); let n = 0; const m = new THREE.Matrix4();
    for (let t = 0; t < N * 5 && n < N; t++) { const x = (rnd() - 0.5) * 280, z = (rnd() - 0.5) * 280; const ld = lakeD(x, z), id = islandD(x, z); if (ld > -0.9 && id < 0.9) continue; if (ld > 0 && id < 0.9) continue; const y = terrainH(x, z); if (y < 0.12) continue; if (nearDockMax(x, z, 0.5)) continue; if (rnd() > 0.55 + 0.45 * fbm(x * 0.12, z * 0.12)) continue; const s = 0.8 + rnd() * 1.4; m.compose(new THREE.Vector3(x, y - 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)), new THREE.Vector3(s, s * (0.7 + rnd() * 0.8), s)); im.setMatrixAt(n, m); n++; }
    im.count = n; im.receiveShadow = true; out.add(im); out.userData.grass = im; }

  // sazlık + gölde su kenarında kamış (cattail)
  const reeds = (() => {
    const blade = (h, lean, a, col0, col1) => { const geo = new THREE.BufferGeometry(); const w = 0.05; const nx = -Math.sin(a), nz = Math.cos(a); const tx = Math.cos(a) * lean, tz = Math.sin(a) * lean;
      geo.setAttribute('position', new THREE.Float32BufferAttribute([-nx * w, 0, -nz * w, nx * w, 0, nz * w, tx * 0.5 - nx * w * 0.8, h * 0.55, tz * 0.5 - nz * w * 0.8, tx * 0.5 + nx * w * 0.8, h * 0.55, tz * 0.5 + nz * w * 0.8, tx, h, tz], 3));
      geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); const cc = [col0, col0, col0.clone().lerp(col1, 0.55), col0.clone().lerp(col1, 0.55), col1]; geo.setAttribute('color', new THREE.Float32BufferAttribute(cc.flatMap(c => [c.r, c.g, c.b]), 3)); geo.computeVertexNormals(); return geo; };
    const r2 = mulberry(31); const gs = []; const c0 = new THREE.Color('#2f6a22'), c1 = new THREE.Color('#9fcf4a');
    for (let i = 0; i < 9; i++) gs.push(blade(1.7 + r2() * 1.5, 0.2 + r2() * 0.5, r2() * 6.28, c0, c1).toNonIndexed());
    const geo = mergeGeometries(gs); return geo; })();
  { const mat = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), timeU, 0.07, true, true); const N = Math.round(2200 * quality); const im = new THREE.InstancedMesh(reeds, mat, N); let n = 0; const m = new THREE.Matrix4(); const cat = [];
    for (let t = 0; t < 120000 && n < N; t++) { const x = (rnd() - 0.5) * 170, z = (rnd() - 0.5) * 170; const ld = lakeD(x, z), id = islandD(x, z); const inShore = (ld > -1.4 && ld < 2.5 && id < -1.2) || (id > -1.5 && id < 0.9 && ld > 0); if (!inShore) continue; if (nearDockMax(x, z, 1.5) || (id > -3 && clear(x, z))) continue; const nz = fbm(x * 0.14 + 5, z * 0.14); if (nz < 0.46) continue; if (-terrainH(x, z) > 1.1) continue; const s = 0.7 + rnd() * 0.8; m.compose(new THREE.Vector3(x, Math.max(terrainH(x, z) - 0.05, -0.8), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)), new THREE.Vector3(s, s * (0.8 + rnd() * 0.5), s)); im.setMatrixAt(n, m); const tt = 0.75 + rnd() * 0.5; im.setColorAt(n, new THREE.Color(tt, tt, tt * 0.9)); if (rnd() < 0.3) cat.push([x, z, s]); n++; }
    im.count = n; im.castShadow = false; out.add(im);
    // cattail
    const cg = mergeGeometries([part(new THREE.CylinderGeometry(0.014, 0.02, 2.0, 5), '#5b7a2a', M4(0, 1.0, 0)), part(new THREE.CapsuleGeometry(0.055, 0.34, 3, 7), '#6b3a20', M4(0, 2.0, 0))]);
    const cm = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), timeU, 0.03, true, true); const ci = new THREE.InstancedMesh(cg, cm, cat.length * 3); let k = 0;
    for (const [x, z, s] of cat) for (let j = 0; j < 3; j++) { const ox = x + (rnd() - 0.5) * 0.6, oz = z + (rnd() - 0.5) * 0.6; const ss = s * (0.75 + rnd() * 0.5); m.compose(new THREE.Vector3(ox, Math.max(terrainH(ox, oz) - 0.05, -0.8), oz), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.15, rnd() * 6, (rnd() - 0.5) * 0.15)), new THREE.Vector3(ss, ss, ss)); ci.setMatrixAt(k++, m); }
    ci.count = k; ci.castShadow = true; out.add(ci);
  }

  // nilüfer yaprakları + beyaz çiçekler
  { const padGeo = new THREE.CircleGeometry(0.4, 16, 0.25, Math.PI * 2 - 0.5); padGeo.rotateX(-Math.PI / 2); const pc = new Float32Array(padGeo.attributes.position.count * 3); for (let i = 0; i < pc.length / 3; i++) { const r = Math.hypot(padGeo.attributes.position.getX(i), padGeo.attributes.position.getZ(i)) / 0.4; const c = new THREE.Color('#2e7a2e').lerp(new THREE.Color('#6fb53c'), 1 - r * 0.6); pc[i * 3] = c.r; pc[i * 3 + 1] = c.g; pc[i * 3 + 2] = c.b; }
    padGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    const padMat = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), timeU, 0, false);
    padMat.onBeforeCompile = ((orig) => (sh) => { sh.uniforms.uTime = timeU; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      transformed.y += sin(uTime*1.1 + ip.x*1.7 + ip.z*1.3)*0.012;`); })();
    const N = Math.round(1300 * quality); const im = new THREE.InstancedMesh(padGeo, padMat, N); let n = 0; const m = new THREE.Matrix4(); const flowers = [];
    for (let t = 0; t < 120000 && n < N; t++) { const x = (rnd() - 0.5) * 140, z = (rnd() - 0.5) * 124; const ld = lakeD(x, z), id = islandD(x, z); if (ld < 0.6 || ld > 18 || id > -2.2 || nearDockMax(x, z, 2.5)) continue; const nz = fbm(x * 0.11 + 9, z * 0.11 - 4); if (nz < 0.5) continue; if (rnd() > (nz - 0.45) * 2.4) continue; const s = 0.7 + rnd() * 0.9; m.compose(new THREE.Vector3(x, 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)), new THREE.Vector3(s, 1, s)); im.setMatrixAt(n, m); const tt = 0.75 + rnd() * 0.5; im.setColorAt(n, new THREE.Color(tt * 0.9, tt, tt * 0.85)); if (rnd() < 0.22) flowers.push([x, z, s]); n++; }
    im.count = n; im.receiveShadow = true; out.add(im);
    // çiçek: 7 beyaz taç yaprağı + sarı merkez
    const fg = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; const pg = new THREE.ConeGeometry(0.05, 0.2, 4); pg.translate(0, 0.1, 0); pg.rotateZ(-1.1); pg.rotateY(a); pg.scale(1, 1, 0.55); fg.push(part(pg, '#ffffff', M4(Math.cos(a) * 0.04, 0.03, Math.sin(a) * 0.04))); }
    fg.push(part(new THREE.SphereGeometry(0.045, 6, 4), '#f6c93a', M4(0, 0.08, 0)));
    const flGeo = mergeGeometries(fg); const fim = new THREE.InstancedMesh(flGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.12 }), flowers.length); let k = 0;
    for (const [x, z, s] of flowers) { const ox = x + (rnd() - 0.5) * 0.2, oz = z + (rnd() - 0.5) * 0.2; const ss = 0.9 + rnd() * 0.7; m.compose(new THREE.Vector3(ox, 0.06, oz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(ss, ss, ss)); fim.setMatrixAt(k++, m); }
    fim.count = k; out.add(fim); }

  chunkify(out);
  return out;
}
