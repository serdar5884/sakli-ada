import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TOWN, ROADS, BEACH, roadD, townLocal, DOCK, terrainH, nearDockZone, mulberry, clamp } from './world.js';
import { buildFire, updateFire } from './houses.js';
import { buildBoat } from './boats.js';
import { COL } from './collide.js';
import { buildCabin, box, cyl, canvasTex, boards, shingles } from './props.js';
import { buildCustomer, animateCustomer } from './npc.js';
import { buildInterior } from './interior.js';

const V3 = THREE.Vector3;
const std = (o) => new THREE.MeshStandardMaterial(o);

/* ---------- dokular ---------- */
function ashlar(g, w, h, o) {
  const rnd = mulberry(o.seed); g.fillStyle = o.mortar; g.fillRect(0, 0, w, h); const rh = h / o.rows;
  for (let j = 0; j < o.rows; j++) { let x = -rnd() * 50; while (x < w) { const sw = 46 + rnd() * 60; const v = (rnd() - 0.5) * o.vary; const c = o.base.map((b, i) => clamp(b + v * (1 - i * 0.12) + (rnd() - 0.5) * 8, 0, 255) | 0); g.fillStyle = `rgb(${c})`; g.fillRect(x + 1.5, j * rh + 1.5, sw - 3, rh - 3); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 1.5, j * rh + 1.5, sw - 3, 2); g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x + 1.5, (j + 1) * rh - 4, sw - 3, 2.5); x += sw; } }
}
export function townMats(M) {
  const paint = (base, seed) => canvasTex(256, 256, (g, w, h) => boards(g, w, h, { base, n: 8, vertical: true, seed, vary: 14 }));
  const stoneT = (base, seed) => canvasTex(512, 256, (g, w, h) => ashlar(g, w, h, { base, mortar: '#6e695f', rows: 11, vary: 34, seed }));
  const pair = (map, rep = 0.6) => { const gm = map.clone(); gm.repeat.set(rep, rep); gm.needsUpdate = true; return { wall: std({ map, roughness: 0.92 }), gable: std({ map: gm, roughness: 0.92 }) }; };
  const noise = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const r = mulberry(5); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + r() * 0.05})`; const sz = 1 + r() * 3; g.fillRect(r() * w, r() * h, sz, sz); } });
  const plast = (hex) => { const m = std({ color: hex, map: noise, roughness: 1 }); return { wall: m, gable: m }; };
  const walls = { cream: plast('#f1e5c4'), yellow: plast('#f3dc8c'), peach: plast('#f4cba6'), blue: plast('#bcd6e8'), mint: plast('#c9e3c4'), pink: plast('#f1c6cf'), wood: { wall: M.wall, gable: M.gable }, stoneA: pair(stoneT([182, 168, 142], 31), 0.5), stoneB: pair(stoneT([146, 144, 138], 32), 0.5) };
  const roofT = (base, seed) => std({ map: canvasTex(256, 256, (g, w, h) => shingles(g, w, h, { base, seed }), [2, 2]), roughness: 0.85 });
  const roofs = { terra: roofT([200, 78, 52], 41), terra2: roofT([164, 70, 48], 44), blue: roofT([66, 112, 170], 45), slate: roofT([84, 94, 112], 42), ochre: roofT([192, 144, 74], 43), brown: M.roof };
  const cobble = std({ roughness: 0.95 });
  return { walls, roofs, doors: {}, cobble };
}

/* ---------- birleştirme: aynı malzemeli parçaları tek mesh yapar (çizim çağrısı azalır) ---------- */
export function bake(g) {
  g.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(); const buckets = new Map(); const mt = new THREE.Matrix4();
  g.traverse((o) => {
    if (!o.isMesh) return; let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); const mat = o.material;
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && !(k === 'color' && mat.vertexColors)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (mat.vertexColors && !geo.attributes.color) { const n = geo.attributes.position.count; const c = new Float32Array(n * 3).fill(0.3); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    geo.applyMatrix4(mt.multiplyMatrices(inv, o.matrixWorld));
    const key = mat.uuid + (o.castShadow ? 'c' : 'n'); let b = buckets.get(key); if (!b) buckets.set(key, b = { mat, cast: o.castShadow, list: [] }); b.list.push(geo);
  });
  const out = new THREE.Group(); out.position.copy(g.position); out.rotation.copy(g.rotation); out.userData = g.userData;
  for (const b of buckets.values()) { const m = new THREE.Mesh(mergeGeometries(b.list), b.mat); m.castShadow = b.cast; m.receiveShadow = true; out.add(m); }
  return out;
}

const woodMat = std({ color: '#6b4a2e', roughness: 0.95 }), ironMat = std({ color: '#2c2f33', roughness: 0.6, metalness: 0.5 }), ropeMat = std({ color: '#b9a276', roughness: 1 });

function signTexture(text, sub) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#5a3d25'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#7a5434'; for (let i = 0; i < 5; i++) g.fillRect(0, i * 32 + 2, 512, 28);
  g.strokeStyle = '#2e1f12'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 150); g.fillStyle = '#f4e6c2'; g.textAlign = 'center'; g.font = 'bold 66px Georgia,serif'; g.fillText(text, 256, sub ? 82 : 100); if (sub) { g.font = 'italic 34px Georgia,serif'; g.fillText(sub, 256, 130); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function awningTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2ead8' : '#c0513f'; g.fillRect(i * 16, 0, 16, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- parçalar ---------- */
function buildWell(M) {
  const g = new THREE.Group();
  const ring = cyl(1.0, 1.06, 0.95, M.stone, 14); ring.position.y = 0.475; g.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 5, 16), M.stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.97; rim.castShadow = true; g.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.9, 14), std({ color: '#0e2a3a', roughness: 0.1, metalness: 0.3 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.72; g.add(water);
  for (const s of [-1, 1]) g.add(box(0.14, 2.1, 0.14, woodMat, 0, 1.55, s * 1.0));
  const crossbar = cyl(0.07, 0.07, 2.2, woodMat, 6); crossbar.rotation.x = Math.PI / 2; crossbar.position.y = 1.85; g.add(crossbar);
  const crank = box(0.05, 0.05, 0.5, woodMat, 0.0, 1.85, 1.2); g.add(crank); g.add(box(0.05, 0.3, 0.05, woodMat, 0.0, 1.7, 1.42));
  for (const s of [-1, 1]) { const sl = box(1.6, 0.09, 1.55, M.roof, 0.0, 2.52, s * 0.62); sl.rotation.x = s * 0.6; sl.position.x = 0; g.add(sl); }
  g.add(box(1.7, 0.1, 0.12, woodMat, 0, 2.86, 0));
  const rope = cyl(0.012, 0.012, 0.95, ropeMat, 4); rope.position.set(0, 1.35, 0); g.add(rope); const bucket = cyl(0.14, 0.11, 0.24, woodMat, 8); bucket.position.set(0, 0.85, 0); g.add(bucket);
  return g;
}
function buildLamp(M) {
  const g = new THREE.Group(); const post = cyl(0.045, 0.07, 2.9, ironMat, 6); post.position.y = 1.45; g.add(post); g.add(box(0.22, 0.12, 0.22, ironMat, 0, 0.06, 0));
  g.add(box(0.36, 0.06, 0.36, ironMat, 0, 3.0, 0)); const lan = box(0.24, 0.34, 0.24, M.lantern, 0, 3.2, 0, false); g.add(lan); g.add(box(0.34, 0.06, 0.34, ironMat, 0, 3.42, 0)); const cap = cyl(0.0, 0.2, 0.16, ironMat, 4); cap.position.y = 3.53; g.add(cap);
  return g;
}
function buildBench() {
  const g = new THREE.Group(); g.add(box(1.6, 0.07, 0.45, woodMat, 0, 0.4, 0)); g.add(box(1.6, 0.36, 0.06, woodMat, 0, 0.66, -0.22)); for (const s of [-1, 1]) { g.add(box(0.07, 0.4, 0.45, ironMat, s * 0.7, 0.2, 0)); }
  return g;
}
function buildBarrel() { const g = new THREE.Group(); const b = cyl(0.3, 0.3, 0.72, woodMat, 10); b.position.y = 0.36; b.scale.set(1.08, 1, 1.08); g.add(b); for (const y of [0.18, 0.54]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 4, 12), ironMat); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); } return g; }
function buildCrate(M, fruitCol) { const g = new THREE.Group(); g.add(box(0.7, 0.34, 0.5, M.wallOld, 0, 0.17, 0)); if (fruitCol) { const gm = new THREE.IcosahedronGeometry(0.1, 0); for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(gm, std({ color: fruitCol, roughness: 0.6 })); f.position.set(-0.22 + (i % 3) * 0.22, 0.38, -0.12 + Math.floor(i / 3) * 0.12); g.add(f); } } return g; }
function buildMarketStall(M, tex) {
  const g = new THREE.Group(); g.add(box(0.8, 0.85, 2.4, M.wall, 0, 0.425, 0)); g.add(box(1.0, 0.07, 2.6, M.deck, 0.02, 0.88, 0));
  for (const z of [-1.2, 1.2]) { g.add(box(0.1, 2.2, 0.1, woodMat, 0.48, 1.1, z)); g.add(box(0.1, 2.5, 0.1, woodMat, -0.42, 1.25, z)); }
  const ag = new THREE.PlaneGeometry(2.8, 1.5, 1, 1); ag.rotateX(-Math.PI / 2); ag.rotateY(Math.PI / 2); const awn = new THREE.Mesh(ag, std({ map: tex, roughness: 0.9, side: THREE.DoubleSide })); awn.castShadow = true; const ag2 = new THREE.Group(); ag2.add(awn); ag2.position.set(0.02, 2.36, 0); ag2.rotation.z = -0.22; g.add(ag2);
  const cols = ['#d8362f', '#c3cf4a', '#f2a15a'];
  [-0.7, 0, 0.7].forEach((z, i) => { const c = buildCrate(M, cols[i]); c.position.set(0.12, 0.915, z); c.scale.setScalar(0.8); g.add(c); });
  g.add(box(0.5, 0.4, 0.5, M.wallOld, 0.4, 0.2, -1.5)); return g;
}
function buildNet() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g2 = c.getContext('2d'); g2.strokeStyle = '#d8cfa8'; g2.lineWidth = 3; for (let i = 0; i <= 64; i += 16) { g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i, 64); g2.stroke(); g2.beginPath(); g2.moveTo(0, i); g2.lineTo(64, i); g2.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 2.5); const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(box(0.1, 2.6, 0.1, woodMat, 0, 1.3, s * 1.6)); g.add(box(0.07, 0.07, 3.3, woodMat, 0, 2.5, 0));
  const net = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.5, 12, 3), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: '#e9dfb8' })); net.rotation.y = Math.PI / 2; net.position.set(0, 1.75, 0);
  const p = net.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.6) * 0.1 + (1.5 - Math.abs(p.getY(i) + 0.75)) * 0.0); net.geometry.computeVertexNormals(); g.add(net);
  for (let i = 0; i < 5; i++) { const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), std({ color: '#d8553a' })); fl.position.set(0.03, 1.1 + (i % 2) * 0.1, -1.3 + i * 0.65); g.add(fl); }
  return g;
}
function buildSign(text, sub) {
  const g = new THREE.Group(); for (const s of [-1, 1]) g.add(box(0.12, 2.3, 0.12, woodMat, 0, 1.15, s * 1.0));
  const sm = std({ map: signTexture(text, sub), roughness: 0.9 }); const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), sm); pl.rotation.y = Math.PI / 2; pl.position.set(0.075, 1.85, 0); g.add(pl); const pl2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), sm); pl2.rotation.y = -Math.PI / 2; pl2.position.set(-0.075, 1.85, 0); g.add(pl2); const back = box(0.06, 0.64, 1.94, woodMat, 0, 1.85, 0); g.add(back);
  return g;
}

/* ---------- kasaba ---------- */
export function buildTown(M, scene) {
  const TM = townMats(M); const rnd = mulberry(2026); const tmp = {};
  const group = new THREE.Group(); const props = new THREE.Group(); const houses = []; const rects = []; // rects: yerel dikdörtgenler [lx,lz,hx,hz]
  const W2 = (lx, lz) => townLocal(lx, lz, { x: 0, z: 0 });
  const place = (obj, lx, lz, rot = 0, yOff = 0, dest = props) => { const w = W2(lx, lz); obj.position.set(w.x, terrainH(w.x, w.z) + yOff, w.z); obj.rotation.y = DOCK.rotY + rot; dest.add(obj); return obj; };
  const colRect = (lx, lz, hx, hz, tag = 'town') => { const w = W2(lx, lz); COL.addRect(tag, w.x, w.z, DOCK.rotY, hx, hz); rects.push([lx, lz, hx, hz]); };
  const colTree = (lx, lz, r) => { const w = W2(lx, lz); COL.addTree(w.x, w.z, r); };

  /* ---------- girilebilir evler ---------- */
  const enterables = [];
  const GAPC = 0.78;
  const wallRects = (Lx, W) => { const hx = Lx / 2, hz = W / 2, t = 0.14; const seg = (hz + t - GAPC) / 2; return [{ x: -hx - 0.02, z: 0, hx: t, hz: hz + t }, { x: 0, z: -hz - 0.02, hx: hx + t, hz: t }, { x: 0, z: hz + 0.02, hx: hx + t, hz: t }, { x: hx + 0.02, z: -(GAPC + seg), hx: t, hz: seg }, { x: hx + 0.02, z: GAPC + seg, hx: t, hz: seg }]; };
  /** rec: {id, wx, wz, rot, floorY, Lx, W, shell, interior, cols: yerel kutular} */
  function addEnterable(rec) {
    const i = enterables.findIndex((r) => r.id === rec.id); if (i >= 0) { COL.clearRects('ent:' + rec.id); enterables.splice(i, 1); }
    rec.c = Math.cos(rec.rot); rec.s = Math.sin(rec.rot); rec.hx = rec.Lx / 2; rec.hz = rec.W / 2; rec.inside = false;
    const put = (x, z, hx, hz) => { COL.addRect('ent:' + rec.id, rec.wx + x * rec.c + z * rec.s, rec.wz - x * rec.s + z * rec.c, rec.rot, hx, hz); };
    for (const r of wallRects(rec.Lx, rec.W)) put(r.x, r.z, r.hx, r.hz); for (const r of rec.cols || []) put(r.x, r.z, r.hx, r.hz);
    if (rec.interior) rec.interior.traverse((o) => { if (o.isMesh) o.castShadow = !!(o.material.userData && o.material.userData.ceil); });
    enterables.push(rec); return rec;
  }
  const locOf = (rec, x, z) => { const dx = x - rec.wx, dz = z - rec.wz; return [dx * rec.c - dz * rec.s, dx * rec.s + dz * rec.c]; };
  /** yürürken zemin yüksekliği: içeride kat döşemesi, kapı önünde rampa */
  function floorAt(x, z) {
    for (const r of enterables) { const dx = x - r.wx, dz = z - r.wz; if (dx * dx + dz * dz > 100) continue; const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
      if (Math.abs(lx) <= r.hx + 0.1 && Math.abs(lz) <= r.hz) return r.floorY;
      if (lx > r.hx && lx < r.hx + 1.15 && Math.abs(lz) < 0.95) { const t = (lx - r.hx) / 1.15; const th = terrainH(x, z); return r.floorY + (th - r.floorY) * t; } }
    return null;
  }
  /** oyuncu içeride mi? çatı/duvar kabuğunu gizler; döndürür: içerideki kayıt */
  function updateEnter(px, pz) {
    let cur = null;
    for (const r of enterables) { const dx = px - r.wx, dz = pz - r.wz; const near = dx * dx + dz * dz < 100; let ins = false; if (near) { const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c; ins = (Math.abs(lx) < r.hx + 0.05 && Math.abs(lz) < r.hz + 0.05) || (lx >= r.hx && lx < r.hx + 0.9 && Math.abs(lz) < 0.9); }
      if (r.interior) r.interior.visible = dx * dx + dz * dz < 1100;
      if (ins !== r.inside) { r.inside = ins; if (r.shell) r.shell.visible = !ins; } if (ins) cur = r; }
    return cur;
  }
  const glowSpots = []; // iç mekân ışıltıları (gece)

  // evler
  const doorMat = (c) => TM.doors[c] || (TM.doors[c] = std({ color: c, roughness: 0.8 }));
  let idx = 0;
  for (const h of TOWN.houses) {
    const wl = TM.walls[h.wall], rf = TM.roofs[h.roof]; const wallH = 2.4;
    const cab = buildCabin(M, { Lx: h.Lx, W: h.W, wallH, floors: h.floors || 1, rise: h.inn ? 2.1 : 1.7, mats: { wall: wl.wall, gable: wl.gable, roof: rf, door: doorMat(h.door) }, timber: true, shutter: h.shut, roundWin: !!h.round, dormer: !!h.inn || (h.floors === 2 && rnd() < 0.5), chimney2: !!h.inn, flowers: true, open: true });
    // taş kaide + kapı basamağı
    cab.add(box(h.Lx + 0.36, 2.1, h.W + 0.36, M.stone, 0, 0.3 - 1.05, 0)); cab.add(box(0.7, 0.4, 1.5, M.stone, h.Lx / 2 + 0.38, 0.0, 0)); cab.add(box(0.5, 0.4, 1.3, M.stone, h.Lx / 2 + 0.78, -0.1, 0));
    const w = W2(h.lx, h.lz); const y0 = terrainH(w.x, w.z) + 0.14; cab.position.set(w.x, y0, w.z); cab.rotation.y = DOCK.rotY; scene.add(cab);
    const baked = bake(cab); scene.remove(cab); baked.userData = { chimneys: cab.userData.chimneys, h }; scene.add(baked); houses.push(baked);
    rects.push([h.lx, h.lz, h.Lx / 2 + 0.3, h.W / 2 + 0.3]); h.top = y0;
    // iç mekân
    const kind = h.inn ? 'inn' : (idx % 2 ? 'fisher' : 'home'); const it = buildInterior(M, h.Lx, h.W, 0.3, kind, idx + 3, { wallH: cab.userData.wallH, rise: cab.userData.rise }); it.group.position.set(w.x, y0, w.z); it.group.rotation.y = DOCK.rotY; scene.add(it.group); const ib = bake(it.group); scene.remove(it.group); scene.add(ib);
    for (const l of it.lamps) { const a = W2(0, 0); glowSpots.push({ x: w.x + l[0] * Math.cos(DOCK.rotY) + l[2] * Math.sin(DOCK.rotY), z: w.z - l[0] * Math.sin(DOCK.rotY) + l[2] * Math.cos(DOCK.rotY), y: y0 + 0.36, big: h.inn }); }
    addEnterable({ id: 'h' + idx, wx: w.x, wz: w.z, rot: DOCK.rotY, floorY: y0 + 0.3, Lx: h.Lx, W: h.W, shell: baked, interior: ib, cols: it.cols });
    idx++;
  }

  // yürüme yolları: taş döşeme (instanced) + kenar çiçekleri
  const tileGeo = new THREE.BoxGeometry(1, 0.08, 1); const tiles = []; const step = 0.54;
  const inHouse = (lx, lz, m) => { for (const [cx, cz, hx, hz] of rects) if (Math.abs(lx - cx) < hx + m && Math.abs(lz - cz) < hz + m) return true; return false; };
  const tc = new THREE.Color();
  for (let lx = -36.5; lx < -0.4; lx += step) for (let lz = -47; lz < 26.5; lz += step) {
    const jx = lx + (rnd() - 0.5) * 0.18, jz = lz + (rnd() - 0.5) * 0.18; const w = W2(jx, jz); const rd = roadD(w.x, w.z); if (rd < 0.05 + rnd() * 0.12) continue; if (inHouse(jx, jz, 0.3) || nearDockZone(w.x, w.z, 0.2)) continue;
    const pr = Math.hypot(jx - TOWN.plaza.x, jz - TOWN.plaza.z); if (pr < 1.35) continue; // kuyunun altı
    tiles.push([w.x, w.z, DOCK.rotY + (rnd() - 0.5) * 0.4, 0.46 + rnd() * 0.07, 0.46 + rnd() * 0.07, pr, rd]);
  }
  const tileIM = new THREE.InstancedMesh(tileGeo, TM.cobble, tiles.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  tiles.forEach(([x, z, r, sx, sz, pr, rd], i) => {
    const y = terrainH(x, z) + 0.035; m4.compose(new V3(x, y, z), q.setFromEuler(e.set(0, r, 0)), new V3(sx, 1, sz)); tileIM.setMatrixAt(i, m4);
    const ring = pr < TOWN.plaza.r + 0.2 ? (Math.floor(pr * 1.15) % 2 ? 0.9 : 1.05) : 1; const v = (0.62 + rnd() * 0.22) * ring; tc.setRGB(v * 1.0, v * 0.97, v * 0.9); if (rd < 0.35) tc.multiplyScalar(0.82); if (rnd() < 0.08) tc.lerp(new THREE.Color('#9a6a4a'), 0.5); tileIM.setColorAt(i, tc);
  });
  tileIM.receiveShadow = true; tileIM.castShadow = false; group.add(tileIM);

  // kuyular
  const wells = [[TOWN.plaza.x, TOWN.plaza.z], [-20.6, -15.9]];
  for (const [lx, lz] of wells) { const wl = buildWell(M); place(wl, lx, lz, lx < -18 ? 0.6 : 0); colTree(lx, lz, 1.15); rects.push([lx, lz, 1.4, 1.4]); }
  // meydan çevresi: taş çiçeklik halkası
  const flowerSpots = []; // [lx,lz,scale]
  // fener direkleri
  const lamps = []; const lampSpots = [];
  for (const lz of [-22, -14, -6, 6, 14, 22]) lampSpots.push([-7.7, lz]);
  for (const lz of [-18, -10, 10, 18]) lampSpots.push([-22.3, lz]);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; lampSpots.push([TOWN.plaza.x + Math.cos(a) * 4.9, TOWN.plaza.z + Math.sin(a) * 4.9]); }
  lampSpots.push([-6.2, -2.3], [-6.2, 2.3]);
  for (const [lx, lz] of lampSpots) { const l = buildLamp(M); place(l, lx, lz); colTree(lx, lz, 0.2); const w = W2(lx, lz); lamps.push(new V3(w.x, terrainH(w.x, w.z) + 3.2, w.z)); }
  // banklar (oturulabilir) — ön yüz yönü hedefe bakar
  const seats = []; // {x,z,y(oturak üstü),a(bakış yönü),kind,occ,node}
  const shoreX = (lz) => { for (let lx = -1; lx > -26; lx -= 0.25) { const w = W2(lx, lz); if (terrainH(w.x, w.z) > 0.1) return lx; } return -8; };
  let benchId = 0;
  const addBench = (lx, lz, tx, tz, kind = 'bench') => {
    const bid = 'b' + (benchId++);
    const rot = Math.atan2(tx - lx, tz - lz); const b = buildBench(); place(b, lx, lz, rot); const w = W2(lx, lz); const th = DOCK.rotY + rot; COL.addRect('town', w.x, w.z, th, 0.85, 0.3);
    const gy = terrainH(w.x, w.z); const a = Math.PI / 2 - th;
    for (const k of [-0.4, 0.4]) seats.push({ x: w.x + Math.cos(th) * k, z: w.z - Math.sin(th) * k, y: gy + 0.4, a, kind, occ: null, node: null, gy, bid });
  };
  addBench(-7.6, -9.5, 20, -9.5); addBench(-7.6, 9.5, 20, 9.5);
  for (const [lx, lz] of [[-12.5, -4.2], [-12.5, 4.2], [-20.3, -4.4], [-20.3, 4.4]]) addBench(lx, lz, TOWN.plaza.x, TOWN.plaza.z);

  /* ---- küçük plaj ---- */
  const beachItems = [];
  const sxAt = (lz) => shoreX(lz);
  const stripeTex = (c1) => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe2' : c1; g.fillRect(i * 16, 0, 16, 32); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; };
  const umbMats = ['#d8453a', '#2f7fb8', '#e0a52c'].map((c) => std({ map: stripeTex(c), roughness: 0.85, side: THREE.DoubleSide }));
  const umbrella = (lx, lz, k) => { const g = new THREE.Group(); const pole = cyl(0.03, 0.035, 2.4, woodMat, 6); pole.position.y = 1.2; g.add(pole); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.55, 8, 1, true), umbMats[k % 3]); cone.position.y = 2.4; cone.castShadow = true; g.add(cone); const tip = cyl(0.0, 0.04, 0.12, woodMat, 4); tip.position.y = 2.72; g.add(tip); g.rotation.z = 0.06; place(g, lx, lz, k); colTree(lx, lz, 0.15); };
  const lounger = (lx, lz, k) => { const g = new THREE.Group(); const cloth = std({ map: stripeTex(['#2f7fb8', '#d8453a', '#e0a52c'][k % 3]), roughness: 1 }); g.add(box(1.0, 0.06, 0.62, cloth, 0.1, 0.34, 0)); const back = box(0.75, 0.06, 0.62, cloth, -0.62, 0.52, 0); back.rotation.z = 0.5; g.add(back); for (const sx of [-0.4, 0.55]) for (const sz of [-0.28, 0.28]) g.add(box(0.05, 0.32, 0.05, woodMat, sx, 0.16, sz)); place(g, lx, lz, 0); const w = W2(lx, lz); COL.addRect('town', w.x, w.z, DOCK.rotY, 0.75, 0.38); };
  const towel = (lx, lz, k, rot) => { const g = new THREE.Group(); g.add(box(0.7, 0.025, 1.5, std({ color: ['#e0607a', '#4aa3c8', '#f2c230', '#8fc65a'][k % 4], roughness: 1 }), 0, 0.015, 0, false)); place(g, lx, lz, rot, 0.0); };
  const beachRock = (lx, lz, sc) => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 * sc, 0), std({ color: '#8f8b80', roughness: 1, flatShading: true })); r.scale.set(1.3, 0.75, 1); r.castShadow = true; place(r, lx, lz, lz * 3, 0.12 * sc); colTree(lx, lz, 0.55 * sc); };
  const drift = (lx, lz, rot, len) => { const l = cyl(0.09, 0.07, len, std({ color: '#b7a07a', roughness: 1 }), 6); l.rotation.z = Math.PI / 2; const g = new THREE.Group(); l.position.y = 0.09; g.add(l); place(g, lx, lz, rot); };
  { const ss = [-39.5, -51.5, -55.2]; ss.forEach((lz, k) => { const sx = sxAt(lz) - 3.4 - k * 0.4; umbrella(sx, lz, k); lounger(sx - 0.2, lz + 0.9, k); towel(sx + 1.2, lz - 1.4, k + 1, 0.2); }); }
  towel(sxAt(-44) - 2.4, -44.2, 2, 1.3); towel(sxAt(-50.5) - 2.2, -50.5, 3, 0.4);
  { const bl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), std({ color: '#e8503a', roughness: 0.6 })); place(bl, sxAt(-44.8) - 1.5, -44.8, 0, 0.22); }
  beachRock(sxAt(-37.5) - 0.8, -37.5, 1.1); beachRock(sxAt(-37.0) - 1.6, -36.6, 0.7); beachRock(sxAt(-56) - 0.6, -55.5, 1.2); beachRock(sxAt(-55) - 1.5, -54.4, 0.8);
  drift(sxAt(-43) - 1.0, -42.4, 0.6, 1.6); drift(sxAt(-51.5) - 1.1, -51.6, -0.5, 1.3); drift(sxAt(-46) - 0.7, -46.5, 1.4, 1.0);
  { const lz = -52.5; const sx = sxAt(lz); const bt = buildBoat(0); bt.scale.setScalar(0.9); bt.rotation.z = 0.0; const w = W2(sx - 1.8, lz); const gy = terrainH(w.x, w.z); bt.position.set(w.x, gy + 0.37, w.z); bt.rotation.y = DOCK.rotY + 0.12; bt.children.forEach((c) => c); props.add(bt); COL.addRect('town', w.x, w.z, DOCK.rotY + 0.12, 1.5, 0.8); }
  addBench(-9.6, -39.8, 20, -39.8); addBench(-10.6, -51.2, 20, -51.2);
  { const sg = buildSign('ALTINKUM PLAJI', 'Küçük plaj · yüzmek serbest'); place(sg, -7.5, -36.4, -0.2); colRect(-7.5, -36.4, 0.15, 1.1); }

  // plaj ateşi: kütük oturaklarıyla
  const FIRE_L = { lx: sxAt(-45) - 6.9, lz: -45.5 }; const fireW = W2(FIRE_L.lx, FIRE_L.lz);
  const campfire = buildFire(M); campfire.position.set(fireW.x, terrainH(fireW.x, fireW.z) + 0.02, fireW.z);
  for (const ch of campfire.children.slice()) { if (ch.isGroup && ch !== campfire.userData.flame) campfire.remove(ch); else if (ch.isMesh && Math.hypot(ch.position.x, ch.position.z) > 1.4) campfire.remove(ch); }
  scene.add(campfire); colTree(FIRE_L.lx, FIRE_L.lz, 0.8);
  // ateşin etrafında 4 bank (resimdeki gibi), hepsi ateşe bakar
  const fireSeats = [];
  for (const a of [0.5, 2.1, 3.7, 5.3]) { const bx = FIRE_L.lx + Math.cos(a) * 2.35, bz = FIRE_L.lz + Math.sin(a) * 2.35; const n0 = seats.length; addBench(bx, bz, FIRE_L.lx, FIRE_L.lz, 'fire'); for (let k = n0; k < seats.length; k++) fireSeats.push(seats[k]); }
  // bu bölgede yer: kasaba kutusu dışında; plaj yolu fenerleri
  for (const [lx, lz] of [[-8.0, -30.0], [-11.7, -38.5]]) { const l = buildLamp(M); place(l, lx, lz); colTree(lx, lz, 0.2); const w = W2(lx, lz); lamps.push(new V3(w.x, terrainH(w.x, w.z) + 3.2, w.z)); }

  // pazar tezgahları
  const awT = awningTex(); for (const lz of [-17.5, 17.5]) { const s = buildMarketStall(M, awT); place(s, -7.0, lz, Math.PI); colRect(-7.0, lz, 0.6, 1.4); }
  // fıçı + sandık yığınları
  const clusters = [[-6.6, -11.8], [-6.7, 11.5], [-11.8, -25.4], [-11.8, 25.4], [-32.5, 4.2], [-32.5, -4.2]];
  for (const [lx, lz] of clusters) { const b = buildBarrel(); place(b, lx, lz); colTree(lx, lz, 0.38); const b2 = buildBarrel(); place(b2, lx - 0.7, lz + 0.35); colTree(lx - 0.7, lz + 0.35, 0.38); const c = buildCrate(M, rnd() < 0.5 ? '#d8362f' : null); place(c, lx - 0.1, lz - 0.7, rnd() * 3); colRect(lx - 0.1, lz - 0.7, 0.4, 0.3); }
  // ağ kurutma direği + tabela
  for (const [lx, lz] of [[-7.6, -27.5 + 3.5], [-7.6, 27.5 - 3.5]]) { const n = buildNet(); place(n, lx - 0.6, lz, 0); colRect(lx - 0.6, lz, 0.2, 1.7); }
  { const s = buildSign('SAKİN LİMAN', 'Balıkçı Kasabası'); place(s, -6.0, -2.9, 0); colRect(-6.0, -2.9, 0.15, 1.1); }
  // istinat duvarı (kasabanın arkası)
  { const w0 = W2(-36.8, 0); const wl = box(1.0, 1.7, 54.5, M.stone, 0, 0, 0); wl.material = M.stone; const cap = box(1.3, 0.16, 54.8, M.stone, 0, 0.93, 0); const g = new THREE.Group(); g.add(wl); g.add(cap); place(g, -36.8, 0, 0, 0.0); g.position.y = terrainH(w0.x, w0.z) + 0.05; colRect(-36.8, 0, 0.6, 27.5); }

  // çiçekler (yol kenarları, çiçeklikler, bahçeler)
  const palette = ['#e65a78', '#f2c230', '#f4f0e6', '#a05ad6', '#e8503a', '#f08a3a', '#5a8ae0'].map((c) => new THREE.Color(c));
  const addFlower = (lx, lz, sc = 1) => { if (inHouse(lx, lz, 0.45)) return; for (const [wx, wz] of wells) if (Math.hypot(lx - TOWN.plaza.x, lz - TOWN.plaza.z) < 1.5) return; flowerSpots.push([lx, lz, sc]); };
  const edgeStep = 0.5;
  for (let lx = -36; lx < -3.5; lx += edgeStep) for (let lz = -26.5; lz < 26.5; lz += edgeStep) {
    if (rnd() > 0.1) continue; const jx = lx + rnd() * edgeStep, jz = lz + rnd() * edgeStep; const w = W2(jx, jz); const rd = roadD(w.x, w.z); if (rd < -1.25 || rd > -0.12) continue; addFlower(jx, jz, 0.8 + rnd() * 0.5);
  }
  // çiçek tarhları: evlerin önü (taş kenarlı) + meydan halkası
  const beds = []; // [lx,lz,hx,hz]
  for (const h of TOWN.houses) { if (h.inn) continue; const fx = h.lx + h.Lx / 2 + 1.35; for (const s of [-1, 1]) beds.push([fx, h.lz + s * 2.0, 0.55, 0.95]); }
  beds.push([-7.2 + 0, -3.5 - 0.0, 0.5, 1.0]); // iskele girişi
  const inn = TOWN.houses.find((h) => h.inn); for (const s of [-1, 1]) beds.push([inn.lx + inn.Lx / 2 + 1.6, s * 3.0, 0.6, 1.2]);
  for (const [lx, lz, hx, hz] of beds) {
    const w = W2(lx, lz); const bg = new THREE.Group(); const bh = 0.28;
    bg.add(box(hx * 2 + 0.2, bh, 0.16, M.stone, 0, bh / 2, hz + 0.08)); bg.add(box(hx * 2 + 0.2, bh, 0.16, M.stone, 0, bh / 2, -hz - 0.08)); bg.add(box(0.16, bh, hz * 2, M.stone, hx + 0.08, bh / 2, 0)); bg.add(box(0.16, bh, hz * 2, M.stone, -hx - 0.08, bh / 2, 0));
    bg.add(box(hx * 2, bh - 0.05, hz * 2, std({ color: '#4a3524', roughness: 1 }), 0, (bh - 0.05) / 2, 0, false));
    place(bg, lx, lz, 0, 0); rects.push([lx, lz, hx + 0.1, hz + 0.1]); colRect(lx, lz, hx + 0.1, hz + 0.1);
    const n = Math.round(hx * hz * 24); for (let i = 0; i < n; i++) flowerSpots.push([lx + (rnd() * 2 - 1) * hx * 0.92, lz + (rnd() * 2 - 1) * hz * 0.92, 1.0 + rnd() * 0.5, bh - 0.04]);
  }
  // beyaz çit: ev bahçeleri (kapı yeri açık)
  { const fm = std({ color: '#f3ecda', roughness: 0.9 });
    const fence = (len) => { const g = new THREE.Group(); const n = Math.max(2, Math.round(len / 0.19)); for (let i = 0; i < n; i++) { const z = -len / 2 + 0.06 + (len - 0.12) * i / (n - 1); g.add(box(0.045, 0.82, 0.09, fm, 0, 0.41, z, false)); const tip = box(0.06, 0.06, 0.06, fm, 0, 0.84, z, false); tip.rotation.set(0.78, 0, 0); g.add(tip); }
      g.add(box(0.05, 0.07, len, fm, 0.03, 0.3, 0, false)); g.add(box(0.05, 0.07, len, fm, 0.03, 0.62, 0, false)); const np = Math.max(2, Math.round(len / 1.4) + 1); for (let i = 0; i < np; i++) g.add(box(0.1, 0.98, 0.1, fm, 0.01, 0.49, -len / 2 + 0.05 + (len - 0.1) * i / (np - 1), false)); return g; };
    for (const h of TOWN.houses) { if (h.inn) continue; const fx = h.lx + h.Lx / 2 + 2.25; const h0 = h.lx + h.Lx / 2 + 1.0;
      for (const sd of [-1, 1]) { const zc = h.lz + sd * 2.05; place(fence(2.5), fx, zc, 0); colRect(fx, zc, 0.1, 1.25); place(fence(fx - h0), (fx + h0) / 2, h.lz + sd * 3.3, Math.PI / 2); colRect((fx + h0) / 2, h.lz + sd * 3.3, (fx - h0) / 2, 0.1); }
      for (const sd of [-1, 1]) { const g = new THREE.Group(); g.add(box(0.12, 1.1, 0.12, fm, 0, 0.55, 0, false)); place(g, fx, h.lz + sd * 0.78, 0); } }
  }
  // meydan halkası: kuyu çevresi çiçek çemberi
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const b = box(0.5, 0.22, 0.28, M.stone, 0, 0.11, 0); const lx = TOWN.plaza.x + Math.cos(a) * 2.45, lz = TOWN.plaza.z + Math.sin(a) * 2.45; place(b, lx, lz, -a + Math.PI / 2); for (let k = 0; k < 3; k++) { const rr = 2.45 + (rnd() - 0.5) * 0.5, aa = a + (rnd() - 0.5) * 0.3; flowerSpots.push([TOWN.plaza.x + Math.cos(aa) * (rr - 0.5), TOWN.plaza.z + Math.sin(aa) * (rr - 0.5), 1.0 + rnd() * 0.4, 0.2]); } }
  rects.push([TOWN.plaza.x, TOWN.plaza.z, 0.1, 0.1]);

  // flowers instanced
  { const bush = new THREE.IcosahedronGeometry(0.2, 0); bush.scale(1, 0.7, 1); bush.translate(0, 0.1, 0); const bloom = new THREE.IcosahedronGeometry(0.075, 0);
    const N = flowerSpots.length; const bushIM = new THREE.InstancedMesh(bush, std({ color: '#4f8a34', roughness: 1, flatShading: true }), N); const bloomIM = new THREE.InstancedMesh(bloom, std({ roughness: 0.6, flatShading: true }), N * 3); let bi = 0;
    flowerSpots.forEach(([lx, lz, sc, yo], i) => {
      const w = W2(lx, lz); const y = (yo !== undefined ? terrainH(w.x, w.z) + yo : terrainH(w.x, w.z)) - 0.02; m4.compose(new V3(w.x, y, w.z), q.setFromEuler(e.set(0, rnd() * 6, 0)), new V3(sc, sc, sc)); bushIM.setMatrixAt(i, m4);
      const base = palette[(rnd() * palette.length) | 0]; for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, d = rnd() * 0.15 * sc; m4.compose(new V3(w.x + Math.cos(a) * d, y + (0.2 + rnd() * 0.1) * sc, w.z + Math.sin(a) * d), q.identity(), new V3(sc, sc, sc)); bloomIM.setMatrixAt(bi, m4); bloomIM.setColorAt(bi, tc.copy(base).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08)); bi++; }
    });
    bloomIM.count = bi; bushIM.castShadow = false; bushIM.receiveShadow = true; group.add(bushIM, bloomIM); }

  // yerel yüksek noktalardan birkaç ağaç yeri (meyve ağaçları için)
  const orchard = [[-21.2, 21.5], [-21.2, -22], [-35, 12], [-35, -12]].filter((p) => !inHouse(p[0], p[1], 1.2)).map(([lx, lz]) => { const w = W2(lx, lz); return { x: w.x, z: w.z, y: terrainH(w.x, w.z) }; }).slice(0, 4);

  const bakedProps = bake(props); group.add(bakedProps);
  scene.add(group);

  /* ---------- fener ışıltısı ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,210,140,1)'); gr.addColorStop(0.25, 'rgba(255,180,90,0.55)'); gr.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  const glows = lamps.map((p) => { const s = new THREE.Sprite(glowMat); s.position.copy(p); s.scale.setScalar(2.6); s.visible = false; group.add(s); return s; });

  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  const poolGeo = new THREE.PlaneGeometry(6.4, 6.4); poolGeo.rotateX(-Math.PI / 2); const pools = lamps.map((p) => { const m = new THREE.Mesh(poolGeo, poolMat); m.position.set(p.x, terrainH(p.x, p.z) + 0.12, p.z); m.visible = false; m.renderOrder = 2; group.add(m); return m; });
  const innerGeo = new THREE.PlaneGeometry(4.6, 4.6); innerGeo.rotateX(-Math.PI / 2);
  const addGlow = (x, y, z, k = 1) => { const m = new THREE.Mesh(innerGeo, poolMat); m.scale.setScalar(k); m.position.set(x, y, z); m.visible = false; m.renderOrder = 2; scene.add(m); pools.push(m); return m; };
  for (const gs of glowSpots) addGlow(gs.x, gs.y, gs.z, gs.big ? 1.5 : 1);
  /* ---------- köylüler ---------- */
  const N = { A: [-9.5, -22], B: [-9.5, 0], C: [-9.5, 22], D: [-24, -22], E: [-24, 0], F: [-24, 22], G: [-4.8, 0], H: [-27.3, 0], P1: [-13.2, 2.9], P2: [-19.8, 2.9], P3: [-13.2, -2.9], P4: [-19.8, -2.9], X1: [-9.5, -11], X2: [-9.5, 11], Y1: [-24, -11], Y2: [-24, 11], K1: [-9.9, -33], K2: [-11.2, -40.5] };
  const EDGES = [['A', 'X1'], ['X1', 'B'], ['B', 'X2'], ['X2', 'C'], ['D', 'Y1'], ['Y1', 'E'], ['E', 'Y2'], ['Y2', 'F'], ['B', 'G'], ['E', 'H'], ['B', 'P1'], ['P1', 'P2'], ['P2', 'E'], ['B', 'P3'], ['P3', 'P4'], ['P4', 'E'], ['A', 'K1'], ['K1', 'K2']];
  const adj = {}; for (const [a, b] of EDGES) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
  const toLoc = (x, z, o) => { const dx = x - DOCK.pos.x, dz = z - DOCK.pos.z, c = Math.cos(DOCK.rotY), s = Math.sin(DOCK.rotY); o.x = dx * c - dz * s; o.z = dx * s + dz * c; return o; };
  const _l = { x: 0, z: 0 };
  const nearestNode = (x, z) => { toLoc(x, z, _l); let bk = 'B', bd = 1e9; for (const k in N) { const d = Math.hypot(N[k][0] - _l.x, N[k][1] - _l.z); if (d < bd) { bd = d; bk = k; } } return bk; };
  const bfs = (from, to) => { if (from === to) return []; const prev = { [from]: null }; const q = [from]; while (q.length) { const c = q.shift(); if (c === to) break; for (const n of adj[c]) if (!(n in prev)) { prev[n] = c; q.push(n); } } const path = []; let c = to; while (c && c !== from) { path.unshift(c); c = prev[c]; } return path; };
  for (const s of seats) s.node = s.kind === 'fire' ? 'K2' : nearestNode(s.x, s.z);
  const names = ['Hasan Usta', 'Ayşe Hanım', 'Nuri Dede', 'Zeynep', 'Kaptan Ali', 'Fatma Teyze'];
  const LINES = ['Merhaba balıkçı!', 'Bugün balık var mı?', 'Göl bugün çok sakin.', 'Çiçekler harika açtı, değil mi?', 'Kuyunun suyu buz gibi!', 'Kolay gelsin!', 'Akşam fener yanınca çok güzel olur buralar.', 'Tezgahta taze balık bekliyoruz!', 'Bol şans, oltan hep dolsun!', 'Ne güzel bir gün…'];
  const DIALOGS = [
    ['Bugün göle çıktın mı?', 'Sabah erkenden, iki sazan tuttum.', 'Maşallah! Akşama közde pişiririz.', 'Ben ekmek getirdim, tuz da var.'],
    ['Bu ateş ne güzel ısıtıyor.', 'Gece olunca göl bir başka oluyor.', 'Yıldızlar suya düşüyor sanki.', 'Keşke hep böyle kalsa…'],
    ['Yarın hava nasıl olur dersin?', 'Rüzgâr dindi, sakin geçer.', 'O zaman sabah erkenden çıkarım.', 'Bana da bir sazan getir!'],
    ['Geçen yıl dev bir turna çıkarmıştım.', 'Yine mi o hikâye?', 'Bu sefer boyu bir metreydi!', 'Her anlatışında bir karış uzuyor!'],
    ['Çay demlemiş miydin?', 'Demledim, hemen getiriyorum.', 'Yanına simit de olsa fena olmaz.', 'Fırın yarın erkenden açılır.'],
    ['Şu ay yüzer gibi sıcak oldu.', 'Plajda çocuklar sabaha kadar oynasa.', 'Biz de gençken öyleydik.', 'Zaman nasıl da akıp gidiyor…'],
  ];
  const convo = {};
  const folks = [];
  for (let i = 0; i < 5; i++) {
    const npc = buildCustomer(200 + i * 7); scene.add(npc); const keys = Object.keys(N).filter((k) => k !== 'K2'); const k = keys[(i * 5 + 3) % keys.length]; const w = W2(N[k][0], N[k][1]);
    const f = { npc, name: names[i % names.length], pos: new V3(w.x, 0, w.z), at: k, to: k, wait: 1 + i, say: 0, nextSay: 0, hid: false, spd: 1.0 + rnd() * 0.35, mode: 'walk', route: [], seat: null, sitT: 0, go: 5 + rnd() * 50, talkT: 3 + rnd() * 4, bub: 0 }; folks.push(f);
  }
  const _w = { x: 0, z: 0 };
  function pickNext(f) { const nb = adj[f.at]; let n = nb[(rnd() * nb.length) | 0]; if (f.prev && nb.length > 1 && n === f.prev) n = nb[(rnd() * nb.length) | 0]; f.prev = f.at; f.to = n; }
  const turn = (npc, ty, dt, k) => { let da = ty - npc.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); npc.rotation.y += da * Math.min(1, dt * k); };
  function takeSeat(f, st) { st.occ = f; f.seat = st; f.route = bfs(f.to, st.node); f.wait = 0; f.mode = 'walk'; }
  function leaveSeat(f) { if (f.seat) { if (f.seat.occ === f) f.seat.occ = null; f.seat = null; } f.route = []; }
  function freeSeat(kind) { const l = seats.filter((s) => !s.occ && (kind === 'fire' ? s.kind === 'fire' : s.kind !== 'fire')); return l.length ? l[(rnd() * l.length) | 0] : null; }
  const clusterOf = (s) => (s.kind === 'fire' ? 'fire' : (s.bid || 'b' + Math.round(s.x) + ',' + Math.round(s.z)));
  let wasSleep = false;
  function update(dt, time, player, night, say, hour = 12) {
    glowMat.opacity += ((night > 0.25 ? night * 0.95 : 0) - glowMat.opacity) * Math.min(1, dt * 2); const on = glowMat.opacity > 0.02; for (const g of glows) g.visible = on; poolMat.opacity = glowMat.opacity * 0.42; for (const m of pools) m.visible = on;
    const sleep = hour >= 1 && hour < 6.5; const evening = !sleep && night > 0.35 && (hour > 12 || hour < 1);
    campfire.userData.lit = night > 0.3 && !(hour >= 1.5 && hour < 7); updateFire(campfire, dt, time, night);
    for (const f of folks) {
      const npc = f.npc;
      if (sleep !== f.hid) {
        f.hid = sleep; npc.visible = !sleep;
        if (sleep) leaveSeat(f); else { const ks = ['A', 'B', 'C', 'D', 'E', 'F']; const k = ks[(rnd() * ks.length) | 0]; const w = townLocal(N[k][0], N[k][1], _w); f.pos.set(w.x, 0, w.z); f.at = f.to = k; f.mode = 'walk'; f.go = 3 + rnd() * 50; pickNext(f); }
      }
      if (f.hid) continue;
      const d2p = Math.hypot(player.x - f.pos.x, player.z - f.pos.z);
      f.nextSay -= dt; f.bub -= dt;
      if (f.mode === 'sit') {
        f.sitT -= dt;
        // sohbet
        f.talkT -= dt;
        if (f.talkT <= 0) {
          let busy = false, mates = 0; for (const o of folks) { if (o === f || o.mode !== 'sit') continue; if (Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z) < 5) { mates++; if (o.bub > 0) busy = true; } }
          if (busy) f.talkT = 0.8 + rnd();
          else if (mates > 0 || d2p < 3) {
            f.talkT = 4.5 + rnd() * 4; const key = clusterOf(f.seat); let c = convo[key];
            if (!c || c.i >= DIALOGS[c.d].length) { c = convo[key] = { d: (rnd() * DIALOGS.length) | 0, i: 0, last: null }; }
            if (c.last === f) f.talkT = 1.2; else { const line = DIALOGS[c.d][c.i++]; c.last = f; f.bub = 4.6; if (d2p < 34) say(npc, 2.0, f.name + ': “' + line + '”', 4.4); }
          } else f.talkT = 3;
        }
        // oyuncu yaklaşırsa selam
        if (d2p < 4 && f.nextSay <= 0 && f.bub <= 0) { f.nextSay = 30 + rnd() * 20; f.bub = 3.4; say(npc, 2.0, f.name + ': “' + LINES[(rnd() * LINES.length) | 0] + '”', 3.4); }
        animateCustomer(npc, dt, 0, time, 'sit');
        if (f.sitT <= 0 || (f.seat.kind !== 'fire' && evening) || (f.seat.kind === 'fire' && !evening && !sleep && night < 0.2)) { const nd = f.seat.node; leaveSeat(f); f.mode = 'walk'; f.at = f.to = nd; f.wait = 0.5; pickNext(f); }
        continue;
      }
      if (f.mode === 'toSeat') {
        const st = f.seat; const dx = st.x - f.pos.x, dz = st.z - f.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.12) { f.mode = 'sit'; f.pos.x = st.x; f.pos.z = st.z; npc.rotation.y = -st.a; f.sitT = st.kind === 'fire' ? 1e9 : 16 + rnd() * 16; f.talkT = 2 + rnd() * 3; continue; }
        const stp = Math.min(d, f.spd * dt); f.pos.x += dx / d * stp; f.pos.z += dz / d * stp; turn(npc, -Math.atan2(dz, dx), dt, 7); animateCustomer(npc, dt, 1, time); continue;
      }
      // akşam: ateşin başına
      if (evening && !f.seat) { f.go -= dt; if (f.go <= 0) { const st = freeSeat('fire'); if (st) takeSeat(f, st); else f.go = 20; } }
      else if (!evening && !f.seat) f.go = Math.min(f.go, 60);
      if (f.nextSay <= 0 && d2p < 4.5) { f.nextSay = 26 + rnd() * 20; f.greet = 3.4; f.wait = Math.max(f.wait, 3.6); if (f.seat) { f.wait = 0; } else say(npc, 2.0, f.name + ': “' + LINES[(rnd() * LINES.length) | 0] + '”', 3.6); }
      if (f.wait > 0 && !f.seat) {
        f.wait -= dt; if (d2p < 6) turn(npc, -Math.atan2(player.z - f.pos.z, player.x - f.pos.x), dt, 3);
        animateCustomer(npc, dt, 0, time, f.greet > 0 ? 'wave' : 'wait'); f.greet = Math.max(0, (f.greet || 0) - dt); if (f.wait <= 0) pickNext(f); continue;
      }
      townLocal(N[f.to][0], N[f.to][1], _w); const dx = _w.x - f.pos.x, dz = _w.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) {
        f.at = f.to;
        if (f.seat) { if (f.route.length) f.to = f.route.shift(); else if (f.at === f.seat.node) f.mode = 'toSeat'; else f.route = bfs(f.at, f.seat.node); continue; }
        if (!evening && rnd() < 0.16) { const st = freeSeat('bench'); if (st) { takeSeat(f, st); continue; } }
        if (rnd() < 0.45) f.wait = 2 + rnd() * 6; pickNext(f); continue;
      }
      const stp = Math.min(d, f.spd * dt); f.pos.x += dx / d * stp; f.pos.z += dz / d * stp; turn(npc, -Math.atan2(dz, dx), dt, 6);
      animateCustomer(npc, dt, 1, time);
    }
    for (const f of folks) { if (f.hid) continue; if (f.mode === 'sit') { f.pos.y = f.seat.y - 0.795; f.npc.position.set(f.pos.x, f.pos.y, f.pos.z); continue; } f.pos.y = terrainH(f.pos.x, f.pos.z); f.npc.position.set(f.pos.x, f.pos.y + (f.wait > 0 ? 0 : Math.abs(Math.sin(f.npc.userData.ph)) * 0.03), f.pos.z); }
  }
  // bitiş: köylü başlangıç yönleri
  for (const f of folks) { pickNext(f); }

  return { group, houses, folks, update, seats, fire: campfire, addEnterable, floorAt, updateEnter, wallRects, addGlow, enterables, orchard, chimneys: houses.map((h) => h.userData.chimneys).filter(Boolean), houseObjs: houses };
}
