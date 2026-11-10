import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainH, lakeD, islandD, mulberry, clamp, smooth, nearDockZone } from './world.js';

/* h: gövde yüksekliği çarpanı, wd: kalınlık, fh: sırt yüzgeci, snout: burun, stripe: 0 yok,1 dikey şerit,2 benek,3 açık benek (turna),4 beyaz-turuncu yama,5 pembe yan bant,6 koyu yan bant,7 kalkan sırtlar
   dep: tercih edilen su derinliği [min,max], ngt: akşam/gece ağırlığı */
export const SPECIES = [
  { id: 'gumus', name: 'Gümüş Balığı', w: [0.03, 0.12], len: 0.5, rar: 0.30, power: 0.2, value: 5, top: '#6f8f96', belly: '#eef4f4', fin: '#c9d6d8', stripe: 0, dep: [0, 1.6], ngt: 0 },
  { id: 'kizilkanat', name: 'Kızılkanat', w: [0.1, 0.45], len: 0.62, rar: 0.22, power: 0.32, value: 12, top: '#8c7b3a', belly: '#f1e3a8', fin: '#d63c2a', stripe: 0, dep: [0, 2.2], ngt: 0 },
  { id: 'capak', name: 'Çapak', w: [0.3, 1.6], len: 0.75, rar: 0.16, power: 0.4, value: 16, top: '#8f8a68', belly: '#d9d2a8', fin: '#7d7a5a', stripe: 0, h: 1.45, wd: 0.7, dep: [0.8, 3.0], ngt: 0.3 },
  { id: 'kadife', name: 'Kadife Balığı', w: [0.4, 3.0], len: 0.85, rar: 0.11, power: 0.5, value: 30, top: '#4f6a3a', belly: '#b6b878', fin: '#3f5530', stripe: 0, h: 1.1, wd: 1.0, dep: [0.4, 1.8], ngt: 1.0 },
  { id: 'levrek', name: 'Tatlı Su Levreği', w: [0.2, 1.2], len: 0.85, rar: 0.16, power: 0.5, value: 25, top: '#4f6e3a', belly: '#e0e29a', fin: '#e8782a', stripe: 1, dep: [0.8, 3.2], ngt: 0 },
  { id: 'karalevrek', name: 'Kara Levrek', w: [0.8, 4.5], len: 0.95, rar: 0.09, power: 0.64, value: 48, top: '#3c4b2e', belly: '#d6d8a2', fin: '#5a6a3a', stripe: 6, h: 1.1, dep: [1.0, 3.4], ngt: 0.2 },
  { id: 'alabalik', name: 'Alabalık', w: [0.4, 2.0], len: 1.0, rar: 0.13, power: 0.62, value: 40, top: '#6b7f50', belly: '#f4c8a6', fin: '#c58a5a', stripe: 2, dep: [1.6, 4.0], ngt: 0 },
  { id: 'gokkusagi', name: 'Gökkuşağı Alabalığı', w: [0.6, 3.4], len: 1.05, rar: 0.08, power: 0.68, value: 62, top: '#74835a', belly: '#f6e3d8', fin: '#d9887a', stripe: 5, dep: [1.8, 4.2], ngt: 0 },
  { id: 'turna', name: 'Turna Balığı', w: [1.5, 12], len: 1.45, rar: 0.07, power: 0.82, value: 95, top: '#4d6b34', belly: '#d8d9a2', fin: '#7a8a46', stripe: 3, h: 0.78, wd: 0.75, snout: 1, fh: 0.7, dep: [0.6, 2.2], ngt: 0.4, near: 'reed' },
  { id: 'sazan', name: 'Sazan', w: [1.5, 9], len: 1.4, rar: 0.11, power: 0.8, value: 70, top: '#9a7a3c', belly: '#e8d58c', fin: '#b8863c', stripe: 0, h: 1.15, dep: [1.0, 3.6], ngt: 0.2 },
  { id: 'kizilsazan', name: 'Kızıl Sazan', w: [1.2, 6], len: 1.25, rar: 0.045, power: 0.76, value: 150, top: '#e0652a', belly: '#fff0d8', fin: '#f08a42', stripe: 4, h: 1.15, dep: [0.8, 3.2], ngt: 0 },
  { id: 'yilan', name: 'Yılan Balığı', w: [0.6, 4.5], len: 1.6, rar: 0.055, power: 0.72, value: 115, top: '#2f3a2e', belly: '#b8b27a', fin: '#2a3328', stripe: 0, h: 0.38, wd: 0.6, fh: 0.9, dep: [0.4, 2.4], ngt: 3.5 },
  { id: 'yayin', name: 'Yayın', w: [5, 28], len: 2.0, rar: 0.05, power: 1.0, value: 200, top: '#3b3e34', belly: '#aaa88c', fin: '#4a4d42', stripe: 0, h: 0.8, wd: 1.2, dep: [2.6, 5], ngt: 1.2 },
  { id: 'mersin', name: 'Mersin Balığı', w: [10, 55], len: 2.3, rar: 0.022, power: 0.95, value: 420, top: '#4a5560', belly: '#d8d4c4', fin: '#555f69', stripe: 7, h: 0.65, wd: 0.95, snout: 2, dep: [3.0, 5], ngt: 0 },
  { id: 'altin', name: 'Altın Sazan', w: [2, 6], len: 1.3, rar: 0.03, power: 0.88, value: 500, top: '#e3a424', belly: '#fff0a6', fin: '#ffcf4a', stripe: 0, h: 1.15, dep: [0.8, 3.6], ngt: 0 },
  { id: 'efendi', name: 'Göl Efendisi', w: [30, 70], len: 2.7, rar: 0.006, power: 1.0, value: 1800, top: '#5a4a3a', belly: '#d8c6a0', fin: '#8a5a32', stripe: 4, h: 1.0, wd: 1.2, dep: [3.2, 5], ngt: 1.5 },
];
const _bell = (d, [a, b]) => d < a ? Math.max(0.04, 1 - (a - d) / 1.2) : d > b ? Math.max(0.04, 1 - (d - b) / 1.2) : 1;
/** derinliğe ve gün/gece durumuna göre tür seç */
export function pickSpecies(rnd, depth = 1.8, night = 0) {
  const wts = SPECIES.map(s => s.rar * _bell(depth, s.dep) * (1 + s.ngt * night * 2.2) * (night < 0.4 ? 1 : 1)); let r = rnd() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SPECIES.length; i++) { r -= wts[i]; if (r <= 0) return SPECIES[i]; } return SPECIES[0];
}

const cache = {};
function fishGeo(sp) {
  if (cache[sp.id]) return cache[sp.id];
  const H = sp.h || 1, WD = sp.wd || 1, FH = sp.fh || 1; const c = (h) => new THREE.Color(h); const top = c(sp.top), bel = c(sp.belly), fin = c(sp.fin), tmp = new THREE.Color();
  // gövde
  const b = new THREE.SphereGeometry(0.5, 14, 9); const p = b.attributes.position; const n = p.count; const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const u = x + 0.5; const prof = Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.06, 0, 1)), 0.75);
    const tail = 0.55 + 0.45 * smooth(0, 0.45, u); y *= 0.62 * prof * (u < 0.3 ? tail : 1.0) * H; z *= 0.42 * prof * WD; p.setXYZ(i, x, y, z);
    const k = smooth(-0.07, 0.07, y); tmp.copy(bel).lerp(top, k);
    if (sp.stripe === 1 && Math.sin(x * 26) > 0.4 && y > -0.03) tmp.multiplyScalar(0.55);
    if (sp.stripe === 2 && y > 0.0 && Math.sin(x * 40 + z * 20) * Math.sin(z * 55) > 0.55) tmp.lerp(c('#c43d2e'), 0.7);
    const yn = y / (0.31 * H);
    if (sp.stripe === 3 && yn > -0.2 && Math.sin(x * 34 + z * 25) * Math.sin(z * 48 + x * 12) > 0.45) tmp.lerp(c('#e6e6a0'), 0.7);
    if (sp.stripe === 4 && yn > -0.1 && Math.sin(x * 11 + 1) * Math.sin(z * 17 + x * 4) > 0.3) tmp.lerp(c(sp.id === 'efendi' ? '#efe2c4' : '#fff4e8'), 0.85);
    if (sp.stripe === 5 && Math.abs(yn) < 0.22) tmp.lerp(c('#e0607a'), 0.85);
    if (sp.stripe === 6 && Math.abs(yn) < 0.3 && Math.sin(x * 11) > -0.3) tmp.multiplyScalar(0.5);
    if (sp.stripe === 7 && (yn > 0.55 || Math.abs(yn + 0.55) < 0.12) && Math.sin(x * 52) > 0.2) tmp.lerp(c('#e8e4d4'), 0.55);
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  b.setAttribute('color', new THREE.BufferAttribute(cols, 3)); b.deleteAttribute('uv'); b.computeVertexNormals();
  const parts = [b.toNonIndexed()];
  const tri = (pts, color, plane) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath(); const g = new THREE.ShapeGeometry(sh); if (plane === 'xz') g.rotateX(-Math.PI / 2); g.deleteAttribute('uv'); const ng = g.index ? g.toNonIndexed() : g; const cc = new Float32Array(ng.attributes.position.count * 3); for (let i = 0; i < cc.length / 3; i++) { cc[i * 3] = color.r; cc[i * 3 + 1] = color.g; cc[i * 3 + 2] = color.b; } ng.setAttribute('color', new THREE.BufferAttribute(cc, 3)); ng.computeVertexNormals(); return ng; };
  if (sp.id === 'yilan') parts.push(tri([[-0.44, 0.1], [0.24, 0.1], [0.12, 0.2], [-0.32, 0.2]], fin)); else parts.push(tri([[-0.12, 0.2 * H], [0.14, 0.2 * H], [-0.02, 0.2 * H + 0.2 * FH * (0.6 + 0.4 * H)]], fin));              // sırt yüzgeci
  parts.push(tri([[0.12, -0.02], [0.0, -0.02], [0.04, -0.2 * (0.5 + 0.5 * H)]], fin));            // karın
  const pf = tri([[0.2, 0.0], [0.06, 0.0], [0.04, 0.2]], fin, 'xz'); const pf2 = pf.clone(); pf.translate(0, -0.05, 0.1); pf2.scale(1, 1, -1); pf2.translate(0, -0.05, -0.1); parts.push(pf, pf2);
  for (const s of [1, -1]) { const e = new THREE.SphereGeometry(0.035, 6, 4); e.translate(0.36, 0.06 * H, s * 0.1 * WD); e.deleteAttribute('uv'); const ne = e.toNonIndexed(); const cc = new Float32Array(ne.attributes.position.count * 3).fill(0.02); ne.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(ne); }
  if (sp.snout) { const L2 = sp.snout === 2 ? 0.22 : 0.14, r = sp.snout === 2 ? 0.07 : 0.075; const sn = new THREE.ConeGeometry(r, L2, 6); sn.rotateZ(-Math.PI / 2); sn.scale(1, sp.snout === 2 ? 0.55 : 0.6, 1.1); sn.translate(0.49 + L2 / 2 - 0.04, -0.02 * H, 0); sn.deleteAttribute('uv'); const ns = sn.toNonIndexed(); const cc = new Float32Array(ns.attributes.position.count * 3); for (let i = 0; i < cc.length / 3; i++) { const y = ns.attributes.position.getY(i); const k = y > -0.02 ? top : bel; cc[i * 3] = k.r; cc[i * 3 + 1] = k.g; cc[i * 3 + 2] = k.b; } ns.setAttribute('color', new THREE.BufferAttribute(cc, 3)); ns.computeVertexNormals(); parts.push(ns); }
  const body = mergeGeometries(parts);
  const tail = tri([[0, 0], [-0.3, 0.26 * (0.5 + 0.5 * H)], [-0.22, 0.0], [-0.3, -0.26 * (0.5 + 0.5 * H)]], fin); tail.translate(-0.45, 0, 0);
  return cache[sp.id] = { body, tail };
}
const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.15, flatShading: false });
const finMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
bodyMat.side = THREE.DoubleSide;

const cookedBodyMat = bodyMat.clone(); cookedBodyMat.color.set('#d89a58'); const cookedFinMat = finMat.clone(); cookedFinMat.color.set('#b57a3c');
/** tezgah/vitrin için hareketsiz balık; weight (kg) boyutu belirler, uzunluk ≈ 1.3 * scale birim */
export function makeDisplayFish(sp, weight, cooked, maxLen = 0.62) {
  const t = Math.pow(clamp((weight - sp.w[0]) / Math.max(0.001, sp.w[1] - sp.w[0]), 0, 1), 1 / 1.6); const len = sp.len * (0.7 + 0.5 * t);
  const g = fishGeo(sp); const root = new THREE.Group(); const b = new THREE.Mesh(g.body, cooked ? cookedBodyMat : bodyMat), tl = new THREE.Mesh(g.tail, cooked ? cookedFinMat : finMat); b.castShadow = true; root.add(b, tl);
  root.scale.setScalar(clamp(len * 0.55, 0.3, maxLen / 1.3)); root.userData.len = 1.3 * root.scale.x; return root;
}
export class Fish {
  constructor(sp, sizeT) {
    this.root = new THREE.Group(); this.pitch = new THREE.Group(); this.root.add(this.pitch); this.setSpecies(sp, sizeT);
    this.pos = new THREE.Vector3(); this.a = 0; this.speed = 0.7; this.state = 'swim'; this.target = new THREE.Vector3(); this.phase = Math.random() * 6; this.y = -0.6; this.timer = 0; this.vel = new THREE.Vector3(); this.seed = Math.random() * 100;
  }
  setSpecies(sp, sizeT) {
    this.sp = sp; this.sizeT = sizeT; this.weight = +(sp.w[0] + (sp.w[1] - sp.w[0]) * Math.pow(sizeT, 1.6)).toFixed(2); this.scale = sp.len * (0.7 + 0.5 * sizeT);
    while (this.pitch.children.length) this.pitch.remove(this.pitch.children[0]);
    const g = fishGeo(sp); this.body = new THREE.Mesh(g.body, bodyMat); this.tailPivot = new THREE.Group(); this.tailPivot.position.x = -0.45; this.tail = new THREE.Mesh(g.tail, finMat); this.tail.position.x = 0.45;
    this.tailPivot.add(this.tail); this.body.castShadow = true; this.pitch.add(this.body, this.tailPivot); this.root.scale.setScalar(this.scale);
  }
  apply() { this.root.position.copy(this.pos); this.root.rotation.y = -this.a; }
}

export class FishSystem {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks; this.fish = []; this.rnd = mulberry(99); this.jumpT = 4; this.t = 0;
    this.night = 0; this.recT = 0; for (let i = 0; i < 34; i++) { const f = this.makeFish(); this.respawn(f, true); this.fish.push(f); scene.add(f.root); }
  }
  makeFish() { const sp = pickSpecies(Math.random); return new Fish(sp, Math.random()); }
  spawnPoint(near, minD = 9, maxD = 16) {
    for (let i = 0; i < 80; i++) {
      let x, z; if (near) { const a = Math.random() * 6.28, d = minD + Math.random() * (maxD - minD); x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d; } else { x = (Math.random() - 0.5) * 140; z = (Math.random() - 0.5) * 124; }
      if (lakeD(x, z) > 4 && islandD(x, z) < -3 && !nearDockZone(x, z, 1)) return new THREE.Vector3(x, 0, z);
    } return new THREE.Vector3(0, 0, 12);
  }
  respawn(f, initial, near, minD, maxD) { const pt = this.spawnPoint(near, minD, maxD); const sp = pickSpecies(Math.random, -terrainH(pt.x, pt.z), this.night); f.setSpecies(sp, Math.random()); f.pos.copy(pt); f.a = Math.random() * 6.28; f.state = 'swim'; f.speed = 0.5 + Math.random() * 0.7; this.newTarget(f); f.y = -0.7; f.pos.y = f.y; f.apply(); f.root.visible = true; }
  newTarget(f) { for (let i = 0; i < 30; i++) { const a = f.a + (Math.random() - 0.5) * 2.4, d = 4 + Math.random() * 10; const x = f.pos.x + Math.cos(a) * d, z = f.pos.z + Math.sin(a) * d; if (lakeD(x, z) > 3.5 && islandD(x, z) < -2.5 && !nearDockZone(x, z, 0.5)) { f.target.set(x, 0, z); return; } } f.target.set(0, 0, 14); f.a += 2.5; }
  steer(f, dt, tx, tz, turn = 2.2) { let da = Math.atan2(tz - f.pos.z, tx - f.pos.x) - f.a; da = Math.atan2(Math.sin(da), Math.cos(da)); f.a += clamp(da, -turn * dt, turn * dt); }
  free() { return this.fish.filter(f => f.state === 'swim'); }
  /** olta bekliyor: yakın bir balığı yemin yanına çağır */
  attract(bobber) {
    if (this.fish.some(f => ['approach', 'nibble', 'biting', 'hooked'].includes(f.state))) return;
    let best = null, bd = 1e9; for (const f of this.free()) { const d = Math.hypot(f.pos.x - bobber.x, f.pos.z - bobber.z); if (d < bd) { bd = d; best = f; } }
    if (best && bd < 20) { best.state = 'approach'; best.speed = 1.8; best.timer = 0; best.nibbles = 1; }
    else { const f = this.free()[0]; if (f) { const pt = this.spawnPoint(bobber, 9, 13); f.setSpecies(pickSpecies(Math.random, -terrainH(pt.x, pt.z), this.night), Math.random()); f.pos.copy(pt); f.a = Math.atan2(bobber.z - f.pos.z, bobber.x - f.pos.x); f.state = 'approach'; f.speed = 1.8; f.nibbles = 1; } }
  }
  /** dalgıcın yakınına balık topla (zıpkın için): want adet serbest balık minD..maxD içinde dursun */
  populate(dv, want = 5, minD = 7, maxD = 15, farOnly = 24) {
    const near = this.free().filter((f) => Math.hypot(f.pos.x - dv.x, f.pos.z - dv.z) < maxD + 3).length; if (near >= want) return 0;
    const far = this.free().filter((f) => Math.hypot(f.pos.x - dv.x, f.pos.z - dv.z) > farOnly).sort((a, b) => Math.hypot(b.pos.x - dv.x, b.pos.z - dv.z) - Math.hypot(a.pos.x - dv.x, a.pos.z - dv.z));
    let n = 0; for (const f of far) { if (near + n >= want) break; this.respawn(f, false, dv, minD, maxD); f.y = Math.max(dv.y - 1 + Math.random() * 2, -6); f.pos.y = f.y; n++; } return n;
  }
  release(bobberGone) { for (const f of this.fish) if (['approach', 'nibble', 'biting'].includes(f.state)) { f.state = 'swim'; f.speed = 1.0; this.newTarget(f); } }
  hookedFish() { return this.fish.find(f => f.state === 'hooked'); }
  tryHook() { const f = this.fish.find(f => f.state === 'biting'); if (f) { f.state = 'hooked'; return f; } return null; }
  jump(f) { f.state = 'jump'; f.vel.set(Math.cos(f.a), 0, Math.sin(f.a)).multiplyScalar(1.3 + Math.random() * 1.5); f.vel.y = 4.2 + Math.random() * 2.2 - f.sizeT * 0.8; f.pos.y = -0.1; this.hooks.splash(f.pos.x, f.pos.z, 0.8 + f.scale * 0.3); this.hooks.sfx('splash', f.pos); }
  update(dt, time, ctx) {
    this.t = time; this.night = ctx.night || 0;
    if (ctx.diver) { this.popT = (this.popT || 0) - dt; if (this.popT <= 0) { this.popT = 2.2; this.populate(ctx.diver, 5, 7, 16); } }
    this.recT -= dt; if (this.recT <= 0) { this.recT = 1.2; const far = this.free().filter(f => Math.hypot(f.pos.x - ctx.focus.x, f.pos.z - ctx.focus.z) > 85); if (far.length) { const f = far[Math.random() * far.length | 0]; this.respawn(f, false, ctx.focus, 14, 60); } }
    // rastgele zıplama
    this.jumpT -= dt; if (this.jumpT <= 0) { this.jumpT = 3.5 + Math.random() * 5; const cands = this.free().filter(f => { const d = Math.hypot(f.pos.x - ctx.focus.x, f.pos.z - ctx.focus.z); return d > 6 && d < 60; }); if (cands.length) this.jump(cands[Math.random() * cands.length | 0]); }
    for (const f of this.fish) {
      f.phase += dt * (5 + f.speed * 6);
      switch (f.state) {
        case 'swim': {
          if (Math.hypot(f.target.x - f.pos.x, f.target.z - f.pos.z) < 1.5) { this.newTarget(f); f.speed = 0.4 + Math.random() * 0.8; }
          let fleeing = false; const dv = ctx.diver; if (dv) { const dx = f.pos.x - dv.x, dz = f.pos.z - dv.z, dy = f.pos.y - dv.y; const d3 = Math.hypot(dx, dy, dz), rr = 3.4 + f.scale * 1.3; if (d3 < rr) { fleeing = true; const ta = Math.atan2(dz, dx); this.steer(f, dt, f.pos.x + Math.cos(ta) * 6, f.pos.z + Math.sin(ta) * 6, 5); f.speed = Math.max(f.speed, 1.1 + f.sp.power * 2.1); f.phase += dt * 10; } } if (!fleeing) this.steer(f, dt, f.target.x, f.target.z); const nx = f.pos.x + Math.cos(f.a) * f.speed * dt, nz = f.pos.z + Math.sin(f.a) * f.speed * dt;
          if (lakeD(nx, nz) > 2.6 && islandD(nx, nz) < -1.8 && !nearDockZone(nx, nz, 0.3)) { f.pos.x = nx; f.pos.z = nz; } else { this.newTarget(f); f.a += 0.5; }
          const dep = -terrainH(f.pos.x, f.pos.z); let wantY = -(0.4 + 0.5 * (Math.sin(time * 0.3 + f.seed) + 1) + f.sp.dep[0] * 0.95 + (f.seed % 1) * f.sp.dep[1] * 0.3); if (dv) { const hd = Math.hypot(f.pos.x - dv.x, f.pos.z - dv.z); if (hd < 30) { const dy = Math.min(-0.5, Math.max(-(dep - 0.5), dv.y + Math.sin(time * 0.35 + f.seed) * 1.6)); wantY = wantY + (dy - wantY) * 0.7 * (1 - hd / 30); } }
          f.y += (Math.max(wantY, -(dep - 0.3)) - f.y) * Math.min(1, dt * 1.5); f.pos.y = f.y; break; }
        case 'approach': {
          const b = ctx.bobber; if (!b) { f.state = 'swim'; break; } this.steer(f, dt, b.x, b.z, 3.2); const d = Math.hypot(b.x - f.pos.x, b.z - f.pos.z);
          f.pos.x += Math.cos(f.a) * f.speed * dt; f.pos.z += Math.sin(f.a) * f.speed * dt; f.y += (-0.45 - f.y) * dt * 2; f.pos.y = f.y;
          if (d < 0.7) { f.state = 'nibble'; f.timer = 0.8 + Math.random() * 0.9; f.speed = 0.4; } break; }
        case 'nibble': {
          const b = ctx.bobber; if (!b) { f.state = 'swim'; break; } const ang = time * 2.5 + f.seed; const tx = b.x + Math.cos(ang) * 0.5, tz = b.z + Math.sin(ang) * 0.5; this.steer(f, dt, tx, tz, 4); f.pos.x += (tx - f.pos.x) * dt * 1.4; f.pos.z += (tz - f.pos.z) * dt * 1.4; f.y += (-0.38 - f.y) * dt * 2; f.pos.y = f.y;
          f.timer -= dt; f.phase += dt * 6;
          if (f.timer <= 0) { if (f.nibbles > 0) { f.nibbles--; f.timer = 0.9 + Math.random() * 1.2; this.hooks.nibble(f); } else { f.state = 'biting'; f.timer = 4.2; this.hooks.bite(f); } } break; }
        case 'biting': {
          const b = ctx.bobber; if (b) { f.pos.x += (b.x - f.pos.x) * dt * 3; f.pos.z += (b.z - f.pos.z) * dt * 3; } f.y += (-0.5 - f.y) * dt * 3; f.pos.y = f.y; f.timer -= dt;
          if (f.timer <= 0) { f.state = 'flee'; f.timer = 3; f.speed = 2.6; this.hooks.missed(f); } break; }
        case 'flee': {
          f.timer -= dt; const nx = f.pos.x + Math.cos(f.a) * f.speed * dt, nz = f.pos.z + Math.sin(f.a) * f.speed * dt; if (lakeD(nx, nz) > 2.5 && islandD(nx, nz) < -1.8 && !nearDockZone(nx, nz, 0.3)) { f.pos.x = nx; f.pos.z = nz; } else f.a += 1.0; f.y += (-0.9 - f.y) * dt * 2; f.pos.y = f.y; if (f.timer <= 0) { f.state = 'swim'; f.speed = 0.6; this.newTarget(f); } break; }
        case 'hooked': { f.phase += dt * 14; f.pos.y = ctx.hookY !== undefined ? ctx.hookY : -0.3; break; }
        case 'jump': {
          f.vel.y -= 9.8 * dt; f.pos.addScaledVector(f.vel, dt); const hs = Math.hypot(f.vel.x, f.vel.z); f.pitch.rotation.z = Math.atan2(f.vel.y, hs) * 0.9;
          if (f.pos.y <= -0.02 && f.vel.y < 0) { this.hooks.splash(f.pos.x, f.pos.z, 0.9 + f.scale * 0.3); this.hooks.sfx('splash', f.pos); f.state = 'swim'; f.pitch.rotation.z = 0; f.y = -0.5; f.pos.y = -0.5; f.speed = 1.2; this.newTarget(f); if (lakeD(f.pos.x, f.pos.z) < 2 || islandD(f.pos.x, f.pos.z) > -1.2) this.respawn(f); } break; }
        case 'caught': { f.timer += dt / 0.85; const u = Math.min(1, f.timer); f.pos.lerpVectors(f.from, f.to, u); f.pos.y += Math.sin(u * Math.PI) * 1.6; f.pitch.rotation.z = (1 - u) * 0.6 - u * 0.4; f.phase += dt * 20; if (u >= 1) { f.state = 'held'; this.hooks.landed(f); } break; }
        case 'held': { f.phase += dt * 9; break; }
        case 'speared': { f.phase += dt * 17; break; }
      }
      if (f.state !== 'jump' && f.state !== 'caught' && f.state !== 'held' && f.state !== 'speared') f.pitch.rotation.z *= 0.9;
      f.tailPivot.rotation.y = Math.sin(f.phase) * (f.state === 'hooked' || f.state === 'held' || f.state === 'caught' || f.state === 'speared' ? 0.8 : 0.45);
      f.body.rotation.y = Math.sin(f.phase) * 0.06;
      if (f.state === 'hooked' || f.state === 'speared') f.pitch.rotation.x = Math.sin(f.phase * 0.7) * 0.5; else if (f.state === 'held') f.pitch.rotation.x = Math.sin(f.phase) * 0.3; else f.pitch.rotation.x *= 0.9;
      f.apply();
    }
  }
}
