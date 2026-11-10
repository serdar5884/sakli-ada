import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainH, lakeD, islandD, nearDockZone, inTown, streamNear, clamp } from './world.js';
import { COL } from './collide.js';

const V3 = THREE.Vector3;
function P(geo, color, mtx) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.deleteAttribute('uv'); if (mtx) g.applyMatrix4(mtx);
  const n = g.attributes.position.count; const c = new Float32Array(n * 3); const col = new THREE.Color(color);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g;
}
const MT = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
const ico = (r = 1, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const cylG = (r1, r2, h, s = 6) => new THREE.CylinderGeometry(r1, r2, h, s);
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
const matD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
const rr = (a, b) => a + Math.random() * (b - a);
const adiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/* ---------------- GEYİK ---------------- */
function deerGeoms(stag) {
  const tan = '#a7764a', dk = '#7a5233', belly = '#e8d9bd', ear = '#c89a70';
  const body = mergeGeometries([P(ico(1, 1), tan, MT(0, 0.95, 0, 0.62, 0.3, 0.24)), P(ico(1, 1), tan, MT(0.38, 0.97, 0, 0.3, 0.3, 0.23)), P(ico(1, 1), dk, MT(-0.42, 0.97, 0, 0.3, 0.3, 0.22)), P(ico(1, 1), belly, MT(0.0, 0.76, 0, 0.55, 0.12, 0.2)), P(ico(1, 0), '#f2ead8', MT(-0.7, 1.05, 0, 0.1, 0.14, 0.09))]);
  const hg = [P(cylG(0.075, 0.1, 0.62, 6), tan, MT(0.23, 0.2, 0, 1, 1, 1, 0, 0, -0.6)), P(ico(1, 1), tan, MT(0.46, 0.52, 0, 0.19, 0.12, 0.1, 0, 0, 0.1)), P(cone(0.06, 0.2, 5), dk, MT(0.65, 0.48, 0, 1, 1, 1, 0, 0, -Math.PI / 2 + 0.1)), P(ico(1, 0), '#222', MT(0.62, 0.47, 0, 0.03, 0.03, 0.03))];
  for (const s of [1, -1]) { hg.push(P(cone(0.05, 0.22, 4), ear, MT(0.4, 0.66, s * 0.1, 1, 1, 0.5, s * 0.8, 0, -0.5))); hg.push(P(ico(1, 0), '#161616', MT(0.57, 0.55, s * 0.07, 0.025, 0.025, 0.025))); }
  if (stag) { for (const s of [1, -1]) { const base = new V3(0.38, 0.66, s * 0.07); hg.push(P(cylG(0.015, 0.02, 0.5, 4), '#d8cdb4', MT(base.x - 0.05, base.y + 0.22, base.z + s * 0.08, 1, 1, 1, s * 0.3, 0, 0.35))); for (let k = 0; k < 3; k++) hg.push(P(cylG(0.01, 0.014, 0.24, 4), '#d8cdb4', MT(base.x + 0.03 - k * 0.04, base.y + 0.22 + k * 0.1, base.z + s * (0.15 + k * 0.03), 1, 1, 1, s * 0.9, 0, -0.5 + k * 0.1))); } }
  const head = mergeGeometries(hg);
  const leg = mergeGeometries([P(cylG(0.04, 0.025, 0.7, 5), dk, MT(0, -0.35, 0)), P(cylG(0.028, 0.03, 0.06, 5), '#2a2018', MT(0, -0.72, 0))]);
  return { body, head, leg };
}
/* ---------------- CEYLAN (ince, açık kum rengi, lir boynuz, beyaz kıç) ---------------- */
function gazelleGeoms() {
  const sand = '#d0a36a', dk = '#8a5d34', belly = '#f6efe0', ear = '#e2c196', stripe = '#4a3220';
  const body = mergeGeometries([P(ico(1, 1), sand, MT(0, 0.98, 0, 0.58, 0.26, 0.2)), P(ico(1, 1), sand, MT(0.36, 1.0, 0, 0.27, 0.25, 0.19)), P(ico(1, 1), sand, MT(-0.4, 1.0, 0, 0.27, 0.26, 0.19)), P(ico(1, 1), belly, MT(0.0, 0.8, 0, 0.52, 0.1, 0.17)), P(ico(1, 1), stripe, MT(0.0, 0.93, 0, 0.5, 0.045, 0.205)), P(ico(1, 1), '#fbf6ea', MT(-0.6, 1.02, 0, 0.12, 0.2, 0.17)), P(ico(1, 0), '#3a2a1c', MT(-0.72, 1.06, 0, 0.05, 0.08, 0.05))]);
  const hg = [P(cylG(0.06, 0.085, 0.66, 6), sand, MT(0.23, 0.22, 0, 1, 1, 1, 0, 0, -0.62)), P(ico(1, 1), sand, MT(0.46, 0.54, 0, 0.17, 0.11, 0.09, 0, 0, 0.1)), P(cone(0.05, 0.19, 5), '#f3ead8', MT(0.63, 0.5, 0, 1, 1, 1, 0, 0, -Math.PI / 2 + 0.1)), P(ico(1, 0), '#1a1a1a', MT(0.7, 0.5, 0, 0.032, 0.026, 0.026)), P(ico(1, 1), stripe, MT(0.5, 0.55, 0, 0.12, 0.012, 0.095))];
  for (const sg of [1, -1]) {
    hg.push(P(cone(0.045, 0.24, 4), ear, MT(0.4, 0.68, sg * 0.1, 1, 1, 0.5, sg * 0.9, 0, -0.4))); hg.push(P(ico(1, 0), '#111', MT(0.57, 0.57, sg * 0.07, 0.024, 0.024, 0.024)));
    for (let k = 0; k < 5; k++) { const a = k / 4; hg.push(P(cylG(0.016 - a * 0.006, 0.02 - a * 0.006, 0.17, 5), '#2a2018', MT(0.36 - Math.sin(a * 1.6) * 0.07 - a * 0.1, 0.73 + k * 0.1, sg * (0.075 + Math.sin(a * 2.6) * 0.07), 1, 1, 1, sg * (0.1 + Math.sin(a * 3) * 0.35), 0, 0.3 + a * 0.5))); }
  }
  const head = mergeGeometries(hg);
  const leg = mergeGeometries([P(cylG(0.032, 0.02, 0.74, 5), sand, MT(0, -0.37, 0)), P(cylG(0.02, 0.022, 0.07, 5), '#241a12', MT(0, -0.76, 0)), P(cylG(0.034, 0.034, 0.1, 5), dk, MT(0, -0.2, 0))]);
  return { body, head, leg };
}
const _dg = {}; const dgeo = (kind) => _dg[kind] || (_dg[kind] = kind === 'gaz' ? gazelleGeoms() : deerGeoms(kind === 'stag'));
class Deer {
  constructor(scene, herd, kind) {
    this.herd = herd; this.kind = kind; this.hp = kind === 'gaz' ? 1 : 2; const stag = kind === 'stag'; const g = dgeo(kind); this.root = new THREE.Group(); this.body = new THREE.Mesh(g.body, mat); this.body.castShadow = true; this.root.add(this.body);
    this.headP = new THREE.Group(); this.headP.position.set(0.55, 1.0, 0); this.head = new THREE.Mesh(g.head, mat); this.head.position.set(-0.055, 0.056, 0); this.head.castShadow = true; this.headP.add(this.head); this.root.add(this.headP);
    this.legs = [[0.42, 0.14], [0.42, -0.14], [-0.42, 0.14], [-0.42, -0.14]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.78, z); const m = new THREE.Mesh(g.leg, mat); m.castShadow = true; p.add(m); this.root.add(p); return p; });
    const s = kind === 'gaz' ? 0.8 : stag ? 1.08 : 0.92; this.root.scale.setScalar(s * rr(0.95, 1.05)); this.bs = this.root.scale.x; this.a = rr(0, 6.28); this.pos = new V3(); this.st = 'graze'; this.t = rr(2, 6); this.target = new V3(); this.phase = rr(0, 6); this.spd = 0; this.headDown = 0; scene.add(this.root);
  }
}
/* ---------------- TAVŞAN ---------------- */
function rabbitGeo() {
  return mergeGeometries([P(ico(1, 1), '#9a8a74', MT(0, 0.14, 0, 0.19, 0.14, 0.11)), P(ico(1, 1), '#a89882', MT(0.17, 0.2, 0, 0.1, 0.09, 0.08)), P(cone(0.03, 0.2, 4), '#b3a28c', MT(0.16, 0.38, 0.04, 1, 1, 0.5, 0.2, 0, -0.1)), P(cone(0.03, 0.2, 4), '#b3a28c', MT(0.16, 0.38, -0.04, 1, 1, 0.5, -0.2, 0, -0.1)), P(ico(1, 0), '#f4efe6', MT(-0.2, 0.17, 0, 0.06, 0.06, 0.06)), P(ico(1, 0), '#161616', MT(0.25, 0.22, 0.05, 0.015, 0.015, 0.015)), P(ico(1, 0), '#161616', MT(0.25, 0.22, -0.05, 0.015, 0.015, 0.015))]);
}
/* ---------------- ÖRDEK ---------------- */
function duckGeo(female) {
  const body = female ? '#8a7352' : '#7b8590', head = female ? '#7a6445' : '#1f6a4a';
  return mergeGeometries([P(ico(1, 1), body, MT(0, 0.1, 0, 0.26, 0.11, 0.14)), P(cone(0.08, 0.2, 4), body, MT(-0.28, 0.17, 0, 1, 1, 0.8, 0, 0, Math.PI / 2 + 0.5)), P(ico(1, 1), head, MT(0.22, 0.27, 0, 0.09, 0.09, 0.08)), P(cylG(0.04, 0.05, 0.16, 5), head, MT(0.17, 0.19, 0, 1, 1, 1, 0, 0, -0.35)), P(cone(0.035, 0.1, 4), '#e6a12a', MT(0.34, 0.26, 0, 1, 1, 1.4, 0, 0, -Math.PI / 2)), P(ico(1, 0), female ? '#e8e8e0' : '#f2f2ee', MT(0.12, 0.28, 0, 0.0001, 0.0001, 0.0001)), P(ico(1, 0), '#111', MT(0.27, 0.3, 0.05, 0.015, 0.015, 0.015)), P(ico(1, 0), '#111', MT(0.27, 0.3, -0.05, 0.015, 0.015, 0.015)), P(ico(1, 0), female ? '#6e5b3a' : '#3b4752', MT(-0.04, 0.17, 0.1, 0.16, 0.07, 0.04)), P(ico(1, 0), female ? '#6e5b3a' : '#3b4752', MT(-0.04, 0.17, -0.1, 0.16, 0.07, 0.04))]);
}
/* ---------------- KUŞ ---------------- */
function birdGeo(c1, c2) {
  const body = mergeGeometries([P(ico(1, 1), c1, MT(0, 0, 0, 0.32, 0.1, 0.1)), P(ico(1, 0), c1, MT(0.34, 0.03, 0, 0.1, 0.08, 0.08)), P(cone(0.03, 0.14, 4), '#e8a82a', MT(0.46, 0.02, 0, 1, 1, 1, 0, 0, -Math.PI / 2)), P(cone(0.07, 0.22, 4), c1, MT(-0.34, 0, 0, 1, 0.4, 1, 0, 0, Math.PI / 2))]);
  const wing = new THREE.BufferGeometry(); const pos = [0, 0, 0, -0.15, 0, 0.0, 0.1, 0, 0.0, 0, 0, 0.95, -0.05, 0, 0.55]; // x: ileri, z: kanat boyu
  const wg = mergeGeometries([P(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0.14, 0, 0, -0.18, 0, 0, -0.06, 0, 0.55, 0.14, 0, 0, -0.06, 0, 0.55, 0.06, 0, 0.5], 3)), c1), P(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0.55, -0.1, 0, 1.05, 0.06, 0, 0.5, -0.06, 0, 0.55, 0.06, 0, 0.5, -0.1, 0, 1.05], 3)), c2)].map(g => { g.computeVertexNormals(); return g; }));
  return { body, wing: wg };
}

export class Animals {
  constructor(scene, ctx) {
    this.scene = scene; this.ctx = ctx; this.lastShooter = new V3(); this.deer = []; this.rabbits = []; this.ducks = []; this.birds = []; this.herds = []; this.tmp = { x: 0, z: 0, hit: false };
    const forest = (minR, maxR, tries = 400) => { for (let i = 0; i < tries; i++) { const a = Math.random() * 6.28, r = minR + Math.random() * (maxR - minR); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (this.walkable(x, z, 0.5, 1.2)) return new V3(x, terrainH(x, z), z); } return new V3(60, 1, 60); };
    this.forest = forest;
    for (let h = 0; h < 7; h++) {
      const gaz = h >= 4; const c = forest(gaz ? 55 : 70, 125); const herd = { c: c.clone(), t: new V3().copy(c), timer: rr(10, 30), gaz }; this.herds.push(herd);
      const n = gaz ? 3 + (h % 2) : 3 + (h % 2) + (h === 0 ? 1 : 0);
      for (let i = 0; i < n; i++) { const d = new Deer(scene, herd, gaz ? 'gaz' : (i === 0 && h % 2 === 0 ? 'stag' : 'doe')); const p = this.near(herd.c, 6); d.pos.copy(p); d.a = Math.random() * 6.28; this.deer.push(d); }
    }
    const rg = rabbitGeo();
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(rg, mat); m.castShadow = true; scene.add(m); const p = forest(45, 130); this.rabbits.push({ root: m, pos: p, a: rr(0, 6.28), st: 'sit', t: rr(1, 4), vy: 0, y: 0, hopT: 0, spd: 0 }); m.position.copy(p); }
    const dg = [duckGeo(false), duckGeo(true)];
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(dg[i % 3 === 2 ? 1 : 0], mat); m.castShadow = true; scene.add(m); const p = this.waterPoint(); this.ducks.push({ root: m, pos: p, a: rr(0, 6.28), t: rr(1, 5), target: this.waterPoint(), st: 'swim', y: 0, rip: rr(0, 1), fly: 0, flyT: 0, home: p.clone() }); }
    const bg = [birdGeo('#f1f2f0', '#2c2f33'), birdGeo('#2a2b2e', '#1a1b1d')];
    for (let i = 0; i < 9; i++) {
      const crow = i >= 6; const g = bg[crow ? 1 : 0]; const root = new THREE.Group(); const body = new THREE.Mesh(g.body, mat); const wl = new THREE.Group(), wr = new THREE.Group(); const w1 = new THREE.Mesh(g.wing, matD), w2 = new THREE.Mesh(g.wing, matD); w2.scale.z = -1; wl.add(w1); wr.add(w2); root.add(body, wl, wr); root.scale.setScalar(crow ? 1.25 : 1.5); root.rotation.order = 'YXZ'; scene.add(root);
      this.birds.push({ root, wl, wr, cx: crow ? rr(-70, 70) : rr(-18, 18), cz: crow ? rr(-70, 70) : rr(-18, 18), R: crow ? rr(30, 60) : rr(28, 48), h: crow ? rr(16, 26) : rr(20, 34), w: (rr(0.05, 0.1)) * (Math.random() < 0.5 ? 1 : -1), ph: rr(0, 6.28), fl: rr(0, 6), flap: rr(7, 10), glide: 0 });
    }
  }
  walkable(x, z, tr = 0.4, minH = 0.5) { return terrainH(x, z) > minH && lakeD(x, z) < -3 && islandD(x, z) < -3 && !nearDockZone(x, z, 2) && !inTown(x, z, 1.5) && !streamNear(x, z, 1.5) && !COL.blocked(x, z, tr); }
  near(c, r) { for (let i = 0; i < 40; i++) { const x = c.x + rr(-r, r), z = c.z + rr(-r, r); if (this.walkable(x, z, 0.5, 0.6)) return new V3(x, terrainH(x, z), z); } return c.clone(); }
  waterPoint() { for (let i = 0; i < 80; i++) { const x = rr(-60, 60), z = rr(-55, 55); if (lakeD(x, z) > 6 && islandD(x, z) < -6 && !nearDockZone(x, z, 4)) return new V3(x, 0, z); } return new V3(0, 0, 28); }
  step(o, dt, speed, a, minH, tr) { // engelleri aşarak ilerle; başarılıysa true
    const nx = o.pos.x + Math.cos(a) * speed * dt, nz = o.pos.z + Math.sin(a) * speed * dt;
    if (terrainH(nx, nz) < minH || lakeD(nx, nz) > -2.2 || islandD(nx, nz) > -2.2) return false;
    COL.push(nx, nz, tr, this.tmp); if (this.tmp.hit && Math.hypot(this.tmp.x - nx, this.tmp.z - nz) > speed * dt * 0.9) return false;
    o.pos.x = this.tmp.x; o.pos.z = this.tmp.z; return true;
  }
  /* ---- avlanma ---- */
  /** adayları [{o, kind, c(V3 merkez), r}] olarak ver */
  *targets() {
    const c = new V3();
    for (const d of this.deer) if (!d.dead) { const k = d.root.scale.x; yield { o: d, kind: d.kind === 'gaz' ? 'ceylan' : 'geyik', c: c.set(d.pos.x, d.pos.y + 0.95 * k, d.pos.z), r: (d.kind === 'gaz' ? 0.62 : 0.78) * (k / (d.kind === 'gaz' ? 0.8 : 0.92)) }; }
    for (const r of this.rabbits) if (!r.dead) yield { o: r, kind: 'tavsan', c: c.set(r.pos.x, r.pos.y + r.y + 0.16, r.pos.z), r: 0.34 };
    for (const d of this.ducks) if (!d.dead) yield { o: d, kind: 'ordek', c: c.set(d.pos.x, d.y + 0.13, d.pos.z), r: 0.34 };
  }
  /** a→b doğrusu bir hayvana değiyor mu? en yakın isabeti döndür */
  raycast(a, b, pad = 0) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz || 1e-6; let best = null;
    for (const tg of this.targets()) {
      let u = ((tg.c.x - a.x) * dx + (tg.c.y - a.y) * dy + (tg.c.z - a.z) * dz) / L2; u = Math.max(0, Math.min(1, u));
      const px = a.x + dx * u - tg.c.x, py = a.y + dy * u - tg.c.y, pz = a.z + dz * u - tg.c.z; const rr2 = tg.r + pad;
      if (px * px + py * py + pz * pz < rr2 * rr2 && (!best || u < best.u)) best = { o: tg.o, kind: tg.kind, u, x: tg.c.x, y: tg.c.y, z: tg.c.z };
    }
    return best;
  }
  /** nişan yardımı: ışına en yakın hayvan (açı sınırı içinde) */
  aimAt(o, d, maxD = 42, ang = 0.085) {
    let best = null, bs = 1e9;
    for (const tg of this.targets()) {
      const vx = tg.c.x - o.x, vy = tg.c.y - o.y, vz = tg.c.z - o.z, dist = Math.hypot(vx, vy, vz); if (dist > maxD || dist < 2) continue;
      const cs = (vx * d.x + vy * d.y + vz * d.z) / dist; if (cs < 0.9) continue; const a = Math.acos(Math.min(1, cs)) - Math.atan2(tg.r, dist) * 0.6; if (a < ang && a < bs) { bs = a; best = { o: tg.o, kind: tg.kind, x: tg.c.x, y: tg.c.y, z: tg.c.z, dist }; }
    }
    return best;
  }
  /** isabet: ölürse true; geyik yaralanıp kaçar */
  hit(tg) {
    const o = tg.o; if (o.dead) return false;
    if (o.hp !== undefined) { o.hp--; if (o.hp > 0) { o.st = 'flee'; o.t = 6; o.fa = Math.atan2(o.pos.z - this.lastShooter.z, o.pos.x - this.lastShooter.x); o.herd.timer = 6; return false; } }
    o.dead = true; o.deadT = 0; o.respawnT = 75 + Math.random() * 60; if (!o.bs) o.bs = o.root.scale.x || 1; return true;
  }
  deadStep(o, dt, type) {
    o.deadT += dt; const r = o.root; const k = Math.min(1, o.deadT / 0.45); r.rotation.z = (type === 'duck' ? 2.6 : 1.5) * (1 - Math.pow(1 - k, 2)); if (type === 'duck') r.position.y = Math.max(-0.05, r.position.y - dt * 0.2);
    if (o.deadT > 1.2) { const s = Math.max(0, 1 - (o.deadT - 1.2) / 0.6); r.scale.setScalar(o.bs * s); if (s <= 0) r.visible = false; }
    o.respawnT -= dt; if (o.respawnT <= 0) this.respawn(o, type);
  }
  respawn(o, type) {
    o.dead = false; o.root.visible = true; o.root.scale.setScalar(o.bs); o.root.rotation.z = 0;
    if (type === 'deer') { const p = this.near(o.herd.c, 8); o.pos.copy(p); o.st = 'graze'; o.t = rr(3, 7); o.spd = 0; o.hp = o.kind === 'gaz' ? 1 : 2; }
    else if (type === 'rabbit') { const p = this.forest(45, 130); o.pos.copy(p); o.st = 'sit'; o.t = rr(1, 4); o.spd = 0; }
    else { const p = this.waterPoint(); o.pos.copy(p); o.home = p.clone(); o.st = 'swim'; o.target = this.waterPoint(); o.y = 0; o.flyT = 0; }
  }
  update(dt, t, pp, night) {
    // ----- geyik -----
    for (const h of this.herds) { h.timer -= dt; if (h.timer <= 0) { h.timer = rr(25, 55); const nc = this.near(new V3(h.c.x + rr(-30, 30), 0, h.c.z + rr(-30, 30)), 8); if (this.walkable(nc.x, nc.z, 0.5, 0.8)) h.t.copy(nc); } h.c.x += (h.t.x - h.c.x) * dt * 0.03; h.c.z += (h.t.z - h.c.z) * dt * 0.03; }
    for (const d of this.deer) {
      if (d.dead) { this.deadStep(d, dt, 'deer'); continue; }
      const dx = d.pos.x - pp.x, dz = d.pos.z - pp.z, dist = Math.hypot(dx, dz); d.t -= dt;
      const gz = d.kind === 'gaz'; if (dist < (gz ? 21 : 16) && d.st !== 'flee') { d.st = 'flee'; d.t = rr(3, 5); d.fa = Math.atan2(dz, dx) + rr(-0.4, 0.4); d.herd.timer = 6; }
      if (d.st === 'flee') { if (d.t <= 0 && dist > 32) { d.st = 'alert'; d.t = rr(2, 4); } else { const da = adiff(d.fa, d.a); d.a += clamp(da, -3 * dt, 3 * dt); const fs = gz ? 9 : 6.5; if (!this.step(d, dt, fs, d.a, 0.4, 0.5)) { d.fa += rr(0.8, 1.6) * (Math.random() < 0.5 ? 1 : -1); } d.spd = fs; } }
      else if (d.st === 'alert') { d.spd = 0; if (dist < 28) d.a += adiff(Math.atan2(-dz, -dx), d.a) * dt * 2; if (d.t <= 0) { d.st = Math.random() < 0.5 ? 'graze' : 'walk'; d.t = rr(4, 9); if (d.st === 'walk') d.target.copy(this.near(d.herd.c, 9)); } }
      else if (d.st === 'graze') { d.spd = 0; if (d.t <= 0) { d.st = 'walk'; d.t = rr(5, 10); d.target.copy(this.near(d.herd.c, 9)); } }
      else { // walk
        const ta = Math.atan2(d.target.z - d.pos.z, d.target.x - d.pos.x); d.a += clamp(adiff(ta, d.a), -1.6 * dt, 1.6 * dt);
        if (!this.step(d, dt, 1.4, d.a, 0.4, 0.5)) { d.a += rr(1, 2) * (Math.random() < 0.5 ? 1 : -1); d.target.copy(this.near(d.herd.c, 9)); } d.spd = 1.4;
        if (Math.hypot(d.target.x - d.pos.x, d.target.z - d.pos.z) < 1.5 || d.t <= 0) { d.st = 'graze'; d.t = rr(5, 12); }
      }
      const hy = terrainH(d.pos.x, d.pos.z); d.pos.y += (hy - d.pos.y) * Math.min(1, dt * 10);
      // animasyon
      d.phase += dt * d.spd * 2.2 * (d.spd > 3 ? 0.9 : 1.2); const sw = d.spd > 0.1 ? 1 : 0; const amp = d.spd > 3 ? 0.9 : 0.5;
      d.legs.forEach((l, i) => { const s = Math.sin(d.phase + (i === 0 || i === 3 ? 0 : Math.PI)); l.rotation.z = s * amp * sw * 0.8; });
      const wantDown = d.st === 'graze' ? 1 : 0; d.headDown += (wantDown - d.headDown) * Math.min(1, dt * 3);
      d.headP.rotation.z = -0.9 * d.headDown + (d.st === 'alert' ? 0.2 : 0) + 0.05 * Math.sin(d.phase * 0.5 + (t * 0.8)) * (1 - d.headDown) + (d.spd > 3 ? -0.15 : 0);
      d.root.position.set(d.pos.x, d.pos.y + (d.spd > 3 ? Math.abs(Math.sin(d.phase)) * 0.12 : 0), d.pos.z); d.root.rotation.y = -d.a;
    }
    // ----- tavşan -----
    for (const r of this.rabbits) {
      if (r.dead) { this.deadStep(r, dt, 'rabbit'); continue; }
      const dx = r.pos.x - pp.x, dz = r.pos.z - pp.z, dist = Math.hypot(dx, dz); r.t -= dt;
      if (dist < 7 && r.st !== 'flee') { r.st = 'flee'; r.t = rr(2, 3.5); r.a = Math.atan2(dz, dx) + rr(-0.5, 0.5); }
      if (r.st === 'flee') { if (r.t <= 0) { r.st = 'sit'; r.t = rr(2, 5); } r.spd = 5; }
      else if (r.st === 'sit') { r.spd = 0; if (r.t <= 0) { r.st = 'hop'; r.t = rr(1.2, 3); r.a += rr(-1.5, 1.5); } }
      else { r.spd = 1.6; if (r.t <= 0) { r.st = 'sit'; r.t = rr(2, 6); } }
      if (r.spd > 0) { r.hopT += dt * (r.spd > 3 ? 3.6 : 2.2); const h = Math.abs(Math.sin(r.hopT * Math.PI)); if (h > 0.2) { if (!this.step(r, dt, r.spd * Math.min(1, h * 1.5), r.a, 0.4, 0.15)) r.a += rr(1, 2.5); } r.y = h * (r.spd > 3 ? 0.35 : 0.2); } else r.y *= 0.8;
      const hy = terrainH(r.pos.x, r.pos.z); r.pos.y += (hy - r.pos.y) * Math.min(1, dt * 12);
      r.root.position.set(r.pos.x, r.pos.y + r.y, r.pos.z); r.root.rotation.y = -r.a; r.root.rotation.z = r.spd > 0 ? Math.cos(r.hopT * Math.PI) * 0.35 : 0;
    }
    // ----- ördek -----
    for (const d of this.ducks) {
      if (d.dead) { this.deadStep(d, dt, 'duck'); continue; }
      const dx = d.pos.x - pp.x, dz = d.pos.z - pp.z, dist = Math.hypot(dx, dz); d.t -= dt;
      if (d.st === 'swim' || d.st === 'sit') {
        if (dist < 5.5 && pp.y < 3) { d.st = 'fly'; d.flyT = 0; d.fa = Math.atan2(dz, dx) + rr(-0.6, 0.6); d.target = this.waterPoint(); d.fa = Math.atan2(d.target.z - d.pos.z, d.target.x - d.pos.x); }
        else {
          const ta = Math.atan2(d.target.z - d.pos.z, d.target.x - d.pos.x); d.a += clamp(adiff(ta, d.a), -1.2 * dt, 1.2 * dt);
          const nx = d.pos.x + Math.cos(d.a) * 0.55 * dt, nz = d.pos.z + Math.sin(d.a) * 0.55 * dt;
          if (lakeD(nx, nz) > 5 && islandD(nx, nz) < -5 && !nearDockZone(nx, nz, 3)) { d.pos.x = nx; d.pos.z = nz; } else { d.target = this.waterPoint(); }
          if (Math.hypot(d.target.x - d.pos.x, d.target.z - d.pos.z) < 2 || d.t <= 0) { d.target = d.t <= 0 && Math.random() < 0.6 ? new V3(d.pos.x + rr(-8, 8), 0, d.pos.z + rr(-8, 8)) : this.waterPoint(); d.t = rr(6, 14); }
          d.rip -= dt; if (d.rip <= 0) { d.rip = rr(1.4, 2.6); this.ctx.ripple && this.ctx.ripple(d.pos.x, d.pos.z, 0.14); }
          d.y = Math.sin(t * 1.6 + d.home.x) * 0.012 - 0.02; d.root.rotation.z = Math.sin(t * 1.3 + d.home.z) * 0.03;
        }
      } else { // fly
        d.flyT += dt; const dd = Math.hypot(d.target.x - d.pos.x, d.target.z - d.pos.z); d.a += clamp(adiff(Math.atan2(d.target.z - d.pos.z, d.target.x - d.pos.x), d.a), -1.5 * dt, 1.5 * dt);
        d.pos.x += Math.cos(d.a) * 6.5 * dt; d.pos.z += Math.sin(d.a) * 6.5 * dt;
        const up = dd > 12 ? Math.min(5, d.flyT * 3) : Math.max(0, dd * 0.4 - 0.05); d.y += (up - d.y) * Math.min(1, dt * 2.5);
        d.root.rotation.z = Math.sin(d.flyT * 28) * 0.25;
        if (dd < 3 || d.flyT > 12) { d.st = 'swim'; d.y = 0; d.t = rr(5, 10); d.root.rotation.z = 0; this.ctx.ripple && this.ctx.ripple(d.pos.x, d.pos.z, 0.5); this.ctx.splash && this.ctx.splash(d.pos.x, d.pos.z, 0.25); }
      }
      d.root.position.set(d.pos.x, d.y, d.pos.z); d.root.rotation.y = -d.a;
    }
    // ----- kuşlar -----
    for (const b of this.birds) {
      b.ph += b.w * dt; const x = b.cx + Math.cos(b.ph) * b.R, z = b.cz + Math.sin(b.ph) * b.R; const y = b.h + Math.sin(t * 0.3 + b.fl) * 2;
      const nxp = Math.cos(b.ph + Math.sign(b.w) * 0.05), nzp = Math.sin(b.ph + Math.sign(b.w) * 0.05); b.root.position.set(x, y, z);
      const hd = Math.atan2(-Math.sin(b.ph) * Math.sign(b.w), -Math.cos(b.ph) * -Math.sign(b.w)); const tx = -Math.sin(b.ph) * Math.sign(b.w), tz = Math.cos(b.ph) * Math.sign(b.w); b.root.rotation.y = -Math.atan2(tz, tx); b.root.rotation.x = -Math.sign(b.w) * 0.25;
      b.fl += dt * b.flap * (Math.sin(t * 0.2 + b.ph * 3) > 0.35 ? 0.0 : 1); const f = Math.sin(b.fl) * 0.7; b.wl.rotation.x = f - 0.1; b.wr.rotation.x = -f + 0.1; b.root.position.y += Math.cos(b.fl) * 0.05;
    }
  }
}
