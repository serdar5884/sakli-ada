import * as THREE from 'three';
import { terrainH, mulberry, DOCK, ISL, smooth } from './world.js';
import { buildCabin, box, cyl } from './props.js';

/* ============ İSKELE EVİ (seviyeli) ============ */
export const DOCK_LAYOUTS = [
  null,
  { x0: -1.7, x1: 4.7, hz: 2.2, px1: 13.9, hw: 0.9, cab: { Lx: 3.4, W: 3.8, wallH: 2.35, rise: 1.4, x: 0.0 } },
  { x0: -2.5, x1: 5.7, hz: 2.8, px1: 17.7, hw: 1.0, cab: { Lx: 4.4, W: 4.4, wallH: 2.45, rise: 1.6, x: -0.3, porch: 1.4 } },
  { x0: -3.5, x1: 6.9, hz: 3.6, px1: 22.1, hw: 1.15, cab: { Lx: 5.6, W: 5.2, wallH: 2.45, floors: 2, rise: 1.8, x: -0.9, porch: 1.6, dormer: true, chimney2: true } },
];
export function buildDockHouse(M, level) {
  const g = DOCK.group; while (g.children.length) g.remove(g.children[0]);
  const Ly = DOCK_LAYOUTS[level]; const { x0, x1, hz, px1, hw } = Ly; const DECK_Y = 0.72, DOCK_Y = 0.6;
  const rnd = mulberry(77 + level); const mx = new THREE.Matrix4();
  // platform tahtaları
  const nz = Math.round((2 * hz) / 0.2); const plank = new THREE.InstancedMesh(new THREE.BoxGeometry(x1 - x0, 0.08, 0.2), M.deck, nz);
  for (let i = 0; i < nz; i++) { mx.makeTranslation((x0 + x1) / 2, DECK_Y, -hz + 0.1 + i * 0.2); plank.setMatrixAt(i, mx); plank.setColorAt(i, new THREE.Color().setScalar(0.85 + rnd() * 0.3)); }
  plank.castShadow = plank.receiveShadow = true; g.add(plank);
  const nD = Math.round((px1 - x1 - 0.05) / 0.2); const dk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.07, hw * 2), M.deck, nD);
  for (let i = 0; i < nD; i++) { mx.makeTranslation(x1 + 0.05 + 0.1 + i * 0.2, DOCK_Y + (rnd() - 0.5) * 0.012, 0); mx.multiply(new THREE.Matrix4().makeRotationY((rnd() - 0.5) * 0.02)); dk.setMatrixAt(i, mx); dk.setColorAt(i, new THREE.Color().setScalar(0.8 + rnd() * 0.35)); }
  dk.castShadow = dk.receiveShadow = true; g.add(dk);
  // kirişler
  for (const z of [-hz + 0.2, hz - 0.2, 0]) g.add(box(x1 - x0, 0.16, 0.14, M.pile, (x0 + x1) / 2, DECK_Y - 0.12, z));
  for (const z of [-hw + 0.12, hw - 0.12]) g.add(box(px1 - x1, 0.14, 0.12, M.pile, (px1 + x1) / 2, DOCK_Y - 0.1, z));
  // kazıklar
  const pilePos = [];
  const nx = Math.max(3, Math.round((x1 - x0) / 3.1) + 1); for (let i = 0; i < nx; i++) for (const z of [-hz + 0.2, hz - 0.2]) pilePos.push([x0 + 0.3 + (x1 - x0 - 0.6) * i / (nx - 1), z, DECK_Y]);
  for (let x = x1 + 1.7; x <= px1 - 0.2; x += 2.4) for (const z of [-hw + 0.12, hw - 0.12]) pilePos.push([x, z, DOCK_Y]);
  for (const z of [-hw + 0.12, hw - 0.12]) pilePos.push([px1 - 0.3, z, DOCK_Y]);
  for (const [x, z, top] of pilePos) {
    const v = new THREE.Vector3(x, 0, z); g.localToWorld(v); const gy = terrainH(v.x, v.z) - 0.15; const h = top + 0.15 - gy;
    const geo = new THREE.CylinderGeometry(0.13, 0.15, h, 8); geo.translate(0, h / 2, 0); const n = geo.attributes.position.count; const c = new Float32Array(n * 3); const dkc = new THREE.Color('#2d3b26'), br = new THREE.Color('#5a4630'), tmp = new THREE.Color();
    for (let i = 0; i < n; i++) { const yy = gy + geo.attributes.position.getY(i); tmp.copy(dkc).lerp(br, smooth(-0.15, 0.35, yy)); c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); const p = new THREE.Mesh(geo, M.pile); p.position.set(x, gy, z); p.castShadow = true; g.add(p);
  }
  // ev
  const C = Ly.cab; const cabin = buildCabin(M, { Lx: C.Lx, W: C.W, wallH: C.wallH, floors: C.floors, rise: C.rise, old: false, porch: C.porch, dormer: C.dormer, chimney2: C.chimney2, open: true }); cabin.position.set(C.x, DECK_Y + 0.04, 0); g.add(cabin);
  const front = C.x + C.Lx / 2 + (C.porch || 0); // ön teras başlangıcı
  // korkuluk
  const rail = (xa, za, xb, zb) => { const len = Math.hypot(xb - xa, zb - za); const r = box(len, 0.06, 0.06, M.trim, (xa + xb) / 2, DECK_Y + 0.95, (za + zb) / 2); r.rotation.y = -Math.atan2(zb - za, xb - xa); g.add(r); const r2 = r.clone(); r2.position.y = DECK_Y + 0.5; g.add(r2); };
  const rz = hz - 0.15; const xr0 = Math.max(front - 0.1, x1 - 4.2);
  for (const s of [-1, 1]) {
    const xg = x1 - 2.0;
    rail(xr0, s * rz, xg - 0.65, s * rz); rail(xg + 0.65, s * rz, x1 - 0.1, s * rz); rail(x1 - 0.1, s * rz, x1 - 0.1, s * (hw + 0.15));
    const n = Math.max(2, Math.round((x1 - 0.1 - xr0) / 1.4)); for (let i = 0; i <= n; i++) { const px = xr0 + (x1 - 0.1 - xr0) * i / n; if (Math.abs(px - xg) < 0.75) continue; g.add(box(0.09, 1.0, 0.09, M.trim, px, DECK_Y + 0.5, s * rz)); }
    for (const ox of [-0.65, 0.65]) g.add(box(0.09, 1.0, 0.09, M.trim, xg + ox, DECK_Y + 0.5, s * rz));
    // karaya/suya iniş merdiveni
    for (let i = 0; i < 4; i++) { const top = DECK_Y + 0.04 - 0.19 * (i + 1); const zc = s * (hz + 0.05 + 0.3 * i + 0.15); g.add(box(1.2, 0.07, 0.34, M.deck, xg, top - 0.035, zc)); g.add(box(1.1, top + 0.4, 0.05, M.pile, xg, (top - 0.4) / 2 + 0.0, zc + s * 0.1)); }
    for (const ox of [-0.62, 0.62]) { const st = box(0.07, 0.07, 1.55, M.pile, xg + ox, DECK_Y - 0.28, s * (hz + 0.62)); st.rotation.x = s * 0.43; g.add(st); const rl = box(0.05, 0.05, 1.5, M.trim, xg + ox, DECK_Y + 0.55 - 0.28, s * (hz + 0.62)); rl.rotation.x = s * 0.43; g.add(rl); g.add(box(0.06, 0.8, 0.06, M.trim, xg + ox, DECK_Y + 0.15, s * (hz + 1.2))); }
    g.add(box(0.09, 1.0, 0.09, M.trim, x1 - 0.1, DECK_Y + 0.5, s * (hw + 0.15)));
    // arka kenar korkuluğu (kara tarafı yan duvarlar)
    rail(x0 + 0.1, s * rz, C.x - C.Lx / 2, s * rz); g.add(box(0.09, 1.0, 0.09, M.trim, x0 + 0.1, DECK_Y + 0.5, s * rz));
  }
  // iskele merdiveni (suya iniş)
  { const lx = px1 - 3.2; const lz = hw + 0.05; for (const sd of [-0.28, 0.28]) { g.add(box(0.05, 1.9, 0.05, M.trim, lx + sd, DOCK_Y - 0.35, lz + 0.06)); g.add(box(0.05, 0.5, 0.05, M.trim, lx + sd, DOCK_Y + 0.35, lz - 0.04)); }
    for (let i = 0; i < 6; i++) g.add(box(0.6, 0.04, 0.05, M.trim, lx, DOCK_Y - 1.1 + i * 0.27, lz + 0.06)); g.add(box(0.6, 0.04, 0.05, M.trim, lx, DOCK_Y + 0.52, lz - 0.04)); }
  // iskele sonu: fener
  const lampPost = box(0.12, 1.7, 0.12, M.pile, px1 - 0.45, DOCK_Y + 0.85, -hw + 0.12); g.add(lampPost);
  g.add(box(0.24, 0.3, 0.24, M.lantern, px1 - 0.45, DOCK_Y + 1.85, -hw + 0.12, false)); g.add(box(0.32, 0.06, 0.32, M.dark, px1 - 0.45, DOCK_Y + 2.03, -hw + 0.12));
  const lampLight = new THREE.PointLight(0xffb866, 0, 16, 1.6); lampLight.position.set(px1 - 0.45, DOCK_Y + 1.85, -hw + 0.12); g.add(lampLight);
  const doorLight = new THREE.PointLight(0xffa850, 0, 10, 1.8); doorLight.position.set(front + 0.2, DECK_Y + 1.8, 0); g.add(doorLight);
  const terraceLight = new THREE.PointLight(0xffa850, 0, 9, 1.8); terraceLight.position.set((front + x1) / 2, DECK_Y + 2.2, 0); g.add(terraceLight);
  if (!cabin.userData.porchLantern) g.add(box(0.2, 0.26, 0.2, M.lantern, C.x + C.Lx / 2 + 0.25, DECK_Y + 2.1, 0.0, false));
  // eşyalar
  const barrel = cyl(0.3, 0.27, 0.8, M.wall, 12); barrel.position.set(x0 + 0.9, DECK_Y + 0.44, -hz + 0.7); g.add(barrel);
  g.add(box(0.7, 0.45, 0.5, M.wall, x0 + 0.9, DECK_Y + 0.26, hz - 0.7)); g.add(box(0.5, 0.35, 0.45, M.wallOld, x0 + 1.0, DECK_Y + 0.7, hz - 0.65));
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), M.rope); coil.rotation.x = Math.PI / 2; coil.position.set(px1 - 0.9, DOCK_Y + 0.08, 0.5); g.add(coil);
  for (let x = x1 + 1.5; x < px1 - 1; x += 5) g.add(box(0.12, 0.28, 0.12, M.dark, x, DOCK_Y + 0.18, hw - 0.2));
  // toptancı sandığı (balıkları yarı fiyata)
  const chestL = new THREE.Vector3(x1 - 1.2, DECK_Y, -(hz - 0.8)); const chest = new THREE.Group(); chest.position.copy(chestL); g.add(chest);
  { const cm = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }), bm = new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.5, metalness: 0.4 });
    chest.add(box(0.95, 0.5, 0.6, cm, 0, 0.29, 0)); const lid = box(0.97, 0.12, 0.62, cm, 0, 0.62, 0); chest.add(lid); for (const x of [-0.3, 0.3]) chest.add(box(0.06, 0.64, 0.64, bm, x, 0.34, 0)); chest.add(box(0.1, 0.12, 0.04, bm, 0, 0.55, 0.31));
    const coinM = new THREE.MeshStandardMaterial({ color: '#e7b43a', roughness: 0.3, metalness: 0.7, emissive: new THREE.Color('#6b4a00'), emissiveIntensity: 0.3 }); for (let i = 0; i < 4; i++) { const c = cyl(0.08, 0.08, 0.02, coinM, 10); c.position.set(-0.2 + i * 0.12, 0.7 + (i % 2) * 0.02, 0.05 * (i % 2)); chest.add(c); } }
  // seviyeye özel
  if (level >= 2) { // balık kurutma askısı + bank
    const rack = new THREE.Group(); rack.position.set(x1 - 0.8, DECK_Y, hz - 0.5); g.add(rack);
    for (const x of [-0.8, 0.8]) rack.add(box(0.07, 1.5, 0.07, M.pile, x, 0.75, 0)); rack.add(box(1.8, 0.05, 0.05, M.pile, 0, 1.45, 0));
    const fm = new THREE.MeshStandardMaterial({ color: '#b7a58a', roughness: 0.8, flatShading: true }); for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), fm); f.scale.set(0.45, 1.5, 0.3); f.position.set(-0.7 + i * 0.35, 1.2, 0); rack.add(f); }
    g.add(box(1.2, 0.08, 0.4, M.wall, front + 0.9, DECK_Y + 0.42, -hz + 0.6)); for (const x of [-0.5, 0.5]) g.add(box(0.07, 0.4, 0.34, M.wall, front + 0.9 + x, DECK_Y + 0.2, -hz + 0.6));
  }
  if (level >= 3) { // masa + sandalyeler + saksılar
    const t = new THREE.Group(); t.position.set((front + x1) / 2 - 0.2, DECK_Y, 0.4); g.add(t);
    t.add(box(1.3, 0.07, 0.8, M.wall, 0, 0.78, 0)); for (const [x, z] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) t.add(box(0.07, 0.78, 0.07, M.wall, x, 0.39, z));
    for (const z of [-0.7, 0.7]) { t.add(box(0.45, 0.06, 0.45, M.wall, 0, 0.45, z)); t.add(box(0.45, 0.5, 0.06, M.wall, 0, 0.72, z + Math.sign(z) * 0.2)); for (const [x, zz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) t.add(box(0.05, 0.45, 0.05, M.wall, x, 0.22, z + zz)); }
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), M.lantern); lantern.position.set(0, 0.92, 0); t.add(lantern);
    const rm = mulberry(5); for (const z of [-hz + 0.4, hz - 0.4]) { const pot = cyl(0.2, 0.15, 0.3, new THREE.MeshStandardMaterial({ color: '#a8603a', roughness: 0.9 }), 8); pot.position.set(front + 0.3, DECK_Y + 0.17, z); g.add(pot); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + rm() * 0.05, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? '#3f7a2a' : '#e0646a', flatShading: true })); b.position.set(front + 0.3 + (rm() - 0.5) * 0.25, DECK_Y + 0.4 + rm() * 0.15, z + (rm() - 0.5) * 0.25); g.add(b); } }
    // tekne kulübesi çatısı (iskelenin ilk bölümü)
    const bx = x1 + 3.2; for (const s of [-1, 1]) for (const dx of [0, 3.6]) g.add(box(0.14, 2.6, 0.14, M.pile, bx + dx, DOCK_Y + 1.3, s * (hw + 0.0)));
    const rf = box(4.0, 0.12, hw * 2 + 0.7, M.roof, bx + 1.8, DOCK_Y + 2.62, 0); g.add(rf); const rf2 = rf.clone(); rf2.scale.set(1, 1, 0.9); rf2.position.y += 0.18; rf2.rotation.x = 0; g.add(rf2);
  }
  g.userData.lights = { lampLight, doorLight, terraceLight, lantern: M.lantern };
  g.userData.cabin = cabin; g.userData.DECK_Y = DECK_Y; g.userData.DOCK_Y = DOCK_Y;
  const lay = { x0, x1, hz, px1, hw, cabX: C.x, Lx: C.Lx, W: C.W, DECK_Y, DOCK_Y, front, chest: { x: chestL.x, z: chestL.z } };
  DOCK.zone.x0 = x0 - 1.8; DOCK.zone.x1 = px1 + 1.1; DOCK.zone.hz = hz + 2.4; DOCK.layout = lay;
  g.userData.layout = lay;
  g.userData.chimneyTops = cabin.userData.chimneys; g.userData.smoke = level >= 2;
  return { group: g, lights: g.userData.lights, cabin, layout: lay };
}
/** dock-yerel konumda yürünebilir zemin yüksekliği (yoksa null) */
export function dockGroundY(lx, lz) {
  const L = DOCK.layout; if (!L) return null;
  if (lx > L.x0 && lx < L.x1 && Math.abs(lz) < L.hz) return L.DECK_Y;
  if (lx >= L.x1 && lx < L.px1 && Math.abs(lz) < L.hw) return L.DOCK_Y;
  const xg = L.x1 - 2.0; const az = Math.abs(lz); if (Math.abs(lx - xg) < 0.6 && az >= L.hz && az < L.hz + 1.25) { const i = Math.floor((az - L.hz - 0.05) / 0.3); return L.DECK_Y + 0.04 - 0.19 * (Math.max(0, i) + 1) + 0.0; }
  return null;
}
/** dock-yerel dikdörtgen çarpışma kutuları (kulübe) */
export function dockBlockers() { const L = DOCK.layout; return [{ cx: L.cabX, cz: 0, hx: L.Lx / 2 + 0.15, hz: L.W / 2 + 0.15 }]; }

/* ============ ADA EVİ (seviyeli) ============ */
export function buildIslandHouse(M, level) {
  const root = new THREE.Group(); const cfg = [null, { Lx: 3.0, W: 2.9, wallH: 2.1, rise: 1.15, old: true }, { Lx: 4.0, W: 3.6, wallH: 2.3, rise: 1.4, old: false, porch: 1.3 }, { Lx: 5.6, W: 4.4, wallH: 2.5, rise: 1.7, old: false, porch: 1.6, dormer: true, chimney2: true }][level];
  const cabin = buildCabin(M, { ...cfg, flowers: level === 2, open: true }); root.add(cabin);
  const base = ISL.cabin; root.position.set(base.x, 0, base.z); root.rotation.y = ISL.cabinRot;
  // zemin: ayak izi köşelerinin en yükseği
  let top = -9; const c = Math.cos(ISL.cabinRot), s = Math.sin(ISL.cabinRot);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const px = lx * cfg.Lx / 2, pz = lz * cfg.W / 2; const wx = base.x + px * c + pz * s, wz = base.z - px * s + pz * c; top = Math.max(top, terrainH(wx, wz)); }
  cabin.position.y = top + 0.14; root.position.y = 0;
  const fnd = box(cfg.Lx + 0.3, 1.6, cfg.W + 0.3, M.stone, 0, top + 0.14 - 0.8, 0); root.add(fnd);
  if (level === 1) {
    const r2 = mulberry(21); const mg = new THREE.IcosahedronGeometry(0.28, 0); const im = new THREE.InstancedMesh(mg, M.moss, 70); const m = new THREE.Matrix4(); const info = cabin.userData;
    for (let i = 0; i < 70; i++) { const side = r2() < 0.5 ? 1 : -1; const zz = side * r2() * (info.W / 2 + 0.2); const xx = (r2() - 0.5) * (info.Lx + 0.4); const y = info.wallH + info.rise - (info.rise / (info.W / 2)) * Math.abs(zz) + 0.12; const sc = 0.5 + r2() * 1.2; m.compose(new THREE.Vector3(xx, y, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(r2(), r2() * 6, r2())), new THREE.Vector3(sc * 1.4, sc * 0.4, sc * 1.2)); im.setMatrixAt(i, m); im.setColorAt(i, new THREE.Color().setHSL(0.25 + r2() * 0.06, 0.45, 0.22 + r2() * 0.12)); }
    im.castShadow = true; cabin.add(im);
    for (let i = 0; i < 16; i++) { const side = r2() < 0.5 ? 1 : -1; const len = 0.6 + r2() * 1.4; cabin.add(box(0.05, len, 0.18, M.moss, (r2() - 0.5) * info.Lx, info.wallH - len / 2, side * (info.W / 2 + 0.04), false)); }
    for (let i = 0; i < 24; i++) { const a = r2() * 6.28, d = 1.7 + r2() * 1.2; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + r2() * 0.3, 0), M.moss); b.position.set(Math.cos(a) * d * 1.2, 0.15, Math.sin(a) * d); b.scale.y = 0.7; cabin.add(b); }
    cabin.rotation.z = 0.02;
  }
  if (level >= 2) {
    // odun yığını
    const wp = new THREE.Group(); wp.position.set(-cfg.Lx / 2 + 0.2, cabin.position.y, cfg.W / 2 + 0.55); cabin.add(wp);
    const lm = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 1 }); const lc = new THREE.MeshStandardMaterial({ color: '#d8bf94', roughness: 1 });
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6 - r; i++) { const l = cyl(0.09, 0.09, 0.9, lm, 7); l.rotation.z = Math.PI / 2; l.position.set(0, 0.1 + r * 0.17, -0.45 + i * 0.19 + r * 0.09); wp.add(l); }
    wp.rotation.y = 0; wp.position.set(-cfg.Lx / 4, 0, cfg.W / 2 + 0.55); wp.position.y = 0;
    // bahçe taş yolu
    const stoneM = new THREE.MeshStandardMaterial({ color: '#9a978c', roughness: 1, flatShading: true });
    const dirL = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.12, 7), stoneM); const lx = cfg.Lx / 2 + (cfg.porch || 0) + 0.5 + i * 0.85, lz = Math.sin(i * 1.7) * 0.25; st.position.set(lx, 0, lz); const wx = base.x + lx * c + lz * s, wz = base.z - lx * s + lz * c; st.position.y = terrainH(wx, wz) - cabin.position.y + 0.04; st.receiveShadow = true; cabin.add(st); }
  }
  if (level >= 3) {
    const bar = cyl(0.3, 0.27, 0.8, M.wall, 12); bar.position.set(cfg.Lx / 2 - 0.4, 0.4, -cfg.W / 2 - 0.5); cabin.add(bar);
    for (const sgn of [-1, 1]) { const pl = box(1.4, 0.3, 0.45, M.wall, -cfg.Lx / 4, 0.22, -cfg.W / 2 - 1.0 * (sgn > 0 ? 1 : 0) - 0.4 * (sgn < 0 ? 0 : 1) ); if (sgn > 0) { pl.position.set(0.5, 0.2, -cfg.W / 2 - 1.2); cabin.add(pl); } }
  }
  root.userData = { cabin, cfg, level, chimneys: cabin.userData.chimneys, col: { cx: base.x, cz: base.z, rot: ISL.cabinRot, hx: cfg.Lx / 2 + 0.2, hz: cfg.W / 2 + 0.2 }, smoke: level >= 2, porchLantern: cabin.userData.porchLantern };
  return root;
}

/* ============ BALIK TEZGAHI ============ */
function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#2f5d7a'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#efe4c8'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 140);
  g.fillStyle = '#f4ead0'; g.font = 'italic 700 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Taze Balık', 256, 66); g.font = '600 28px system-ui, sans-serif'; g.fillStyle = '#e7b43a'; g.fillText('~ gölün en tazesi ~', 256, 120);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function awningTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f1ead8' : '#b2402e'; g.fillRect(i * 32, 0, 32, 128); }
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 128, 18, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
export function buildStall(M) {
  const g = new THREE.Group(); const wood = M.wall, trim = M.trim, dark = M.dark;
  // tezgah (uzun kenar z ekseni, müşteri +x tarafında)
  g.add(box(0.9, 0.9, 2.9, wood, 0, 0.45, 0));
  g.add(box(1.1, 0.07, 3.1, M.deck, 0.05, 0.93, 0));
  g.add(box(0.06, 0.5, 2.9, M.wallOld, 0.46, 0.42, 0, false));
  // buz tablaları + balıklar
  const iceM = new THREE.MeshStandardMaterial({ color: '#dff0f4', roughness: 0.3, transparent: true, opacity: 0.9 });
  const tray = new THREE.Group(); tray.position.set(0.15, 0.98, 0); g.add(tray);
  for (const z of [-0.95, 0, 0.95]) { tray.add(box(0.7, 0.1, 0.8, wood, 0, 0.03, z)); tray.add(box(0.6, 0.04, 0.7, iceM, 0, 0.1, z, false)); }
  const fishM = [new THREE.MeshStandardMaterial({ color: '#9fb4ba', roughness: 0.3, metalness: 0.3, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#b6865a', roughness: 0.4, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#7d8f5c', roughness: 0.4, flatShading: true })];
  const rnd = mulberry(8);
  // terazi
  const sc = new THREE.Group(); sc.position.set(-0.2, 0.97, 1.15); g.add(sc); sc.add(box(0.3, 0.05, 0.22, dark, 0, 0.03, 0)); sc.add(box(0.04, 0.35, 0.04, dark, 0, 0.2, 0)); sc.add(box(0.5, 0.025, 0.04, dark, 0, 0.37, 0)); for (const s of [-1, 1]) { const pan = cyl(0.12, 0.12, 0.015, new THREE.MeshStandardMaterial({ color: '#b8b9bc', metalness: 0.5, roughness: 0.4 }), 10); pan.position.set(0, 0.2, s * 0.25); sc.add(pan); }
  // direkler + tente
  for (const z of [-1.5, 1.5]) { g.add(box(0.12, 2.3, 0.12, M.pile, 0.55, 1.15, z)); g.add(box(0.12, 2.75, 0.12, M.pile, -0.5, 1.37, z)); }
  const awnM = new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.9, side: THREE.DoubleSide });
  const ag = new THREE.PlaneGeometry(3.5, 1.35, 20, 1); ag.rotateX(-Math.PI / 2); ag.rotateY(Math.PI / 2);
  { const p = ag.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), x = p.getX(i); p.setY(i, Math.sin(z * 4.2) * 0.05 * (x > 0 ? 1 : 0.3)); } ag.computeVertexNormals(); }
  const awn = new THREE.Mesh(ag, awnM); awn.castShadow = true; awn.receiveShadow = true; const awnG = new THREE.Group(); awnG.add(awn); awnG.position.set(0.02, 2.52, 0); awnG.rotation.z = -0.3; g.add(awnG);
  for (const s of [-1, 1]) { const vl = box(0.02, 0.16, 3.5, awnM, 0.62, 2.4, 0, false); }
  // arka panel + raf
  g.add(box(0.08, 1.6, 3.0, wood, -0.5, 1.1, 0)); g.add(box(0.4, 0.06, 2.8, M.deck, -0.7, 1.35, 0)); g.add(box(0.4, 0.06, 2.8, M.deck, -0.7, 0.9, 0));
  for (const z of [-0.9, 0.2, 1.0]) { const jar = cyl(0.09, 0.09, 0.22, new THREE.MeshStandardMaterial({ color: '#8fb8a6', transparent: true, opacity: 0.7, roughness: 0.2 }), 8); jar.position.set(-0.7, 1.49, z); g.add(jar); }
  // tabela
  { const sg = new THREE.PlaneGeometry(1.9, 0.62); const sm = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.85 })); sm.rotation.y = Math.PI / 2; sm.position.set(0.75, 2.55, 0); g.add(sm); const back = box(0.08, 0.66, 1.94, wood, 0.7, 2.55, 0); g.add(back); for (const z of [-0.8, 0.8]) g.add(box(0.03, 0.4, 0.03, dark, 0.7, 2.9, z)); }
  // asılı balıklar
  const hang = new THREE.Group(); hang.position.set(-0.5, 2.55, 0); g.add(hang); hang.add(box(0.05, 0.05, 2.8, M.pile, 0, 0, 0));
  // sandık + kova + fener
  g.add(box(0.7, 0.4, 0.5, M.wallOld, 0.75, 0.2, -2.0)); g.add(box(0.5, 0.3, 0.4, wood, 0.75, 0.55, -2.0));
  const bucket = cyl(0.2, 0.16, 0.38, new THREE.MeshStandardMaterial({ color: '#6b7a82', metalness: 0.4, roughness: 0.5 }), 10); bucket.position.set(0.85, 0.19, 2.0); g.add(bucket);
  const lan = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), M.lantern); lan.position.set(0.58, 1.9, -1.5); g.add(lan);
  const light = new THREE.PointLight(0xffb060, 0, 9, 1.8); light.position.set(0.7, 1.9, -1.2); g.add(light);
  g.userData = { tray, hang, light, stands: { customer: new THREE.Vector3(1.8, 0, 0.6), customer2: new THREE.Vector3(1.8, 0, -0.9) }, col: { hx: 0.65, hz: 1.55 } };
  return g;
}

/* ============ KAMP ATEŞİ ============ */
export function buildFire(M) {
  const g = new THREE.Group(); const stoneM = new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stoneM); s.scale.set(1.1, 0.8, 0.9); s.position.set(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62); s.rotation.set(i, i * 2, 0); s.castShadow = true; s.receiveShadow = true; g.add(s); }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.58, 12), new THREE.MeshStandardMaterial({ color: '#241f1c', roughness: 1 })); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.04; g.add(ash);
  const logM = new THREE.MeshStandardMaterial({ color: '#4a3626', roughness: 1 });
  for (let i = 0; i < 4; i++) { const l = cyl(0.07, 0.065, 0.85, logM, 6); l.rotation.z = Math.PI / 2 - 0.25; l.rotation.y = i * 1.57 + 0.4; l.position.set(0, 0.17, 0); g.add(l); }
  // flame
  const flame = new THREE.Group(); g.add(flame);
  const flM = [new THREE.MeshBasicMaterial({ color: '#ff5a1a', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })];
  const cones = [];
  for (let i = 0; i < 6; i++) { const lv = i % 3; const c = new THREE.Mesh(new THREE.ConeGeometry(0.2 - lv * 0.05, 0.75 - lv * 0.12, 6, 1, true), flM[lv]); const a = i * 2.1; c.position.set(Math.cos(a) * 0.12 * (lv === 2 ? 0 : 1), 0.3 + (0.75 - lv * 0.12) / 2 - 0.1, Math.sin(a) * 0.12 * (lv === 2 ? 0 : 1)); c.userData = { base: c.position.clone(), lv, ph: i * 1.3 }; flame.add(c); cones.push(c); }
  flame.visible = false;
  const light = new THREE.PointLight(0xff8a3a, 0, 20, 1.5); light.position.set(0, 0.7, 0); light.castShadow = false; g.add(light);
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), new THREE.MeshBasicMaterial({ color: '#ff5a1a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); embers.rotation.x = -Math.PI / 2; embers.position.y = 0.06; g.add(embers);
  // oturma kütükleri
  for (const [a, r] of [[0.9, 1.7], [2.9, 1.8], [4.6, 1.75]]) { const lg = cyl(0.2, 0.2, 0.95, new THREE.MeshStandardMaterial({ color: '#6a5036', roughness: 1 }), 8); lg.rotation.z = Math.PI / 2; lg.rotation.y = -a + Math.PI / 2; lg.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r); lg.rotation.order = 'YXZ'; lg.rotation.set(0, -a, Math.PI / 2); g.add(lg); }
  // şişler (3 yuva): yere saplı, ateşe eğik çubuklar; ucunda balık
  const slots = []; const stickM = new THREE.MeshStandardMaterial({ color: '#6b5236', roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const a = 3.9 + i * 0.75 + 0.1; const sg = new THREE.Group(); sg.position.set(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0); sg.rotation.y = -a + Math.PI; g.add(sg); // sg local +x ateşe doğru
    const st = cyl(0.015, 0.02, 1.25, stickM, 5); st.rotation.z = -1.12; st.position.set(0.3, 0.55, 0); sg.add(st);
    const fm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color: '#aab8bc', roughness: 0.4, flatShading: true })); fm.scale.set(0.95, 0.22, 0.32); fm.position.set(0.62, 0.72, 0); fm.rotation.z = 0.3; const tl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), fm.material); tl.rotation.z = Math.PI / 2; tl.position.set(-0.22, 0, 0); tl.scale.set(1, 1, 0.5); fm.add(tl); fm.visible = false; fm.castShadow = true; sg.add(fm);
    slots.push({ mesh: fm, st: null, t: 0, sp: null, base: new THREE.Color('#aab8bc') });
  }
  g.userData = { flame, cones, light, embers, slots, lit: false, litK: 0 };
  return g;
}
export function updateFire(fire, dt, t, night) {
  const u = fire.userData; u.litK += ((u.lit ? 1 : 0) - u.litK) * Math.min(1, dt * 2.5); const k = u.litK;
  u.flame.visible = k > 0.03;
  for (const c of u.cones) { const f = 0.8 + 0.35 * Math.sin(t * (7 + c.userData.lv * 3) + c.userData.ph) + 0.15 * Math.sin(t * 17 + c.userData.ph * 2); c.scale.set((0.8 + 0.25 * Math.sin(t * 9 + c.userData.ph)) * k, f * k, (0.8 + 0.25 * Math.cos(t * 8 + c.userData.ph)) * k); c.position.x = c.userData.base.x + 0.04 * Math.sin(t * 6 + c.userData.ph); c.position.z = c.userData.base.z + 0.04 * Math.cos(t * 5 + c.userData.ph); c.position.y = c.userData.base.y - (1 - k) * 0.2; }
  u.light.intensity = k * (5 + night * 16) * (0.85 + 0.15 * Math.sin(t * 11) + 0.08 * Math.sin(t * 23)); u.embers.material.opacity = k * 0.5;
}
