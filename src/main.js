import * as THREE from 'three';
import { terrainH, bridgeY, streamNear, lakeD, islandD, isWater, gradOf, DOCK, ISL, ISLAND, toDockLocal, nearDockZone, inTown, buildTerrain, ALT, buildSky, buildWater, CAUSTIC, clamp, lerp, smooth } from './world.js';
import { makeMaterials, buildVegetation, box } from './props.js';
import { buildFisherman, setSeated } from './fisher.js';
import { buildBoat, animateOars, boatGrips } from './boats.js';
import { buildDockHouse, dockGroundY, buildIslandHouse, buildStall, buildFire, updateFire, DOCK_LAYOUTS } from './houses.js';
import { COL } from './collide.js';
import { Animals } from './animals.js';
import { Particles } from './effects.js';
import { buildCustomer, animateCustomer } from './npc.js';
import { FishSystem, SPECIES, makeDisplayFish } from './fish.js';
import { Sound } from './audio.js';
import { createUI, drawFishArt, spById } from './ui.js';
import { BOATS, DEFAULT_OUTFIT, BASKET_MAX, FRUITS, FRUIT_MAX, GAME, GAME_MAX } from './data.js';
import { createHunt } from './hunt.js';
import { createQuests } from './quests.js';
import { createPost } from './post.js';
import { buildFruitTrees } from './fruit.js';
import { buildTown, bake, townMats } from './town.js';
import { buildStream, updateStream } from './stream.js';
import { buildInterior } from './interior.js';
import { createDiveSystem, DIVE_U } from './diving.js';
import { createSpearSystem } from './spear.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 620;
const V3 = THREE.Vector3;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const rr = (a, b) => a + Math.random() * (b - a);

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pr = Math.min(devicePixelRatio || 1, 2); const PR_MIN = Math.min(pr, 1);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const post = createPost(renderer, { isMobile }); post.on = false; try { post.on = localStorage.getItem('sg-paint') === '1'; } catch (e) { }
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.25, 1000);
function fitCamera() { const a = innerWidth / innerHeight; camera.aspect = a; camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(40)) / a)), 52, 82); camera.updateProjectionMatrix(); }
fitCamera();

const timeU = { value: 0 };
const state = { time: 0 };
/* ---------- kayıt ---------- */
const KEY = 'sakin-gol-v2';
const save = (() => {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!s) { let old = null; try { old = JSON.parse(localStorage.getItem('sakin-gol-v1')); } catch (e) { } s = { coins: old ? old.coins || 0 : 0, caught: old ? old.caught || {} : {} }; }
  s.coins = s.coins || 0; s.caught = s.caught || {}; s.inv = s.inv || []; s.boats = s.boats || [true, false, false]; s.boats[0] = true; s.boat = s.boats[s.boat] ? (s.boat || 0) : 0;
  s.dockLv = clamp(s.dockLv || 1, 1, 3); s.isleLv = clamp(s.isleLv || 1, 1, 3); s.own = s.own || {}; s.outfit = { ...DEFAULT_OUTFIT, ...(s.outfit || {}) }; if (s.outfitV !== 2) { s.outfit = { ...DEFAULT_OUTFIT }; s.outfitV = 2; } s.sold = s.sold || 0; s.hour = typeof s.hour === 'number' ? s.hour : 9.5; s.fruit = s.fruit || {}; s.game = s.game || {}; return s;
})();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { } };
const sound = new Sound();

/* ====================== DÜNYA ====================== */
const terrain = buildTerrain(); scene.add(terrain);
const sky = buildSky(scene, renderer, isMobile);
const REFK = isMobile ? 0.6 : 0.85;
const refW = clamp(Math.round(innerWidth * pr * REFK), 320, 1700), refH = clamp(Math.round(innerHeight * pr * REFK), 320, 1700);
const water = buildWater(refW, refH, sky.tod, isMobile); scene.add(water);
const M = makeMaterials();
scene.add(DOCK.group);
let dockObj = buildDockHouse(M, save.dockLv); water.userData.bakeObs();
const veg = buildVegetation(scene, M, timeU, isMobile ? 0.7 : 1);
const reflHide = []; // yansıma geçişinde çizilmeyecekler (iç mekânlar, köylüler)
const refreshRefl = () => { reflHide.length = 0; for (const e of town.enterables) if (e.interior) reflHide.push(e.interior); for (const f of town.folks) reflHide.push(f.npc); reflHide.push(stream.water); };
{ const orig = water.onBeforeRender; const was = []; water.onBeforeRender = function (...a) { if (isMobile && (shadowTick & 1)) return; const g = veg.userData.grass; if (g) g.visible = false; was.length = 0; refreshRefl(); for (const o of reflHide) { was.push(o.visible); o.visible = false; } orig.apply(this, a); reflHide.forEach((o, i) => { o.visible = was[i]; }); if (g) g.visible = true; }; }
const cabinWorld = new V3(); dockObj.cabin.getWorldPosition(cabinWorld);
/* ---------- sahil kasabası ---------- */
const town = buildTown(M, scene);
renderer.shadowMap.autoUpdate = !isMobile; let shadowTick = 0;
const stream = buildStream({ scene, M, tod: sky.tod, isMobile, town, TM: townMats(M), buildInterior, bake });
/* ---------- meyve ağaçları ---------- */
const fruitSys = (() => {
  const rnd = (() => { let a = 4242; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const kinds = ['elma', 'armut', 'erik', 'seftali']; const spots = []; const far = (x, z, d) => spots.every((q) => Math.hypot(q.x - x, q.z - z) > d);
  const ok = (x, z) => { const h = terrainH(x, z); return h > 0.35 && !nearDockZone(x, z, 3.5) && !inTown(x, z, 2) && !streamNear(x, z, 2.5) && !COL.blocked(x, z, 1.5) && Math.hypot(x - cabinWorld.x, z - cabinWorld.z) > 8; };
  const dp = DOCK.pos;
  const want = [['dock', 8, (x, z) => { const l = lakeD(x, z), i = islandD(x, z); return l < -2.5 && l > -11 && i < -3 && Math.hypot(x - dp.x, z - dp.z) < 42; }], ['isle', 4, (x, z) => { const i = islandD(x, z); return i > 2.2 && i < 9 && Math.hypot(x - ISL.cabin.x, z - ISL.cabin.z) > 8.5 && Math.hypot(x - ISL.stall.x, z - ISL.stall.z) > 5.5 && Math.hypot(x - ISL.fire.x, z - ISL.fire.z) > 5; }], ['shore', 14, (x, z) => { const l = lakeD(x, z), i = islandD(x, z); return l < -3 && l > -10 && i < -3; }], ['stream', 7, (x, z) => streamNear(x, z, 10)], ['town', 8, (x, z) => inTown(x, z, 18)]];
  town.orchard.forEach((o, i) => spots.push({ ...o, kind: kinds[(i + 1) % 4] }));
  for (const [, cnt, test] of want) { let got = 0; for (let t = 0; t < 9000 && got < cnt; t++) { const x = (rnd() - 0.5) * 190, z = (rnd() - 0.5) * 190; if (!test(x, z) || !ok(x, z) || !far(x, z, 8)) continue; spots.push({ x, z, y: terrainH(x, z), kind: kinds[spots.length % 4] }); got++; } }
  const fs = buildFruitTrees(spots); scene.add(fs.group); for (const t of fs.trees) COL.addTree(t.x, t.z, 0.5); return fs;
})();

/* ada evi, tezgah, ateş */
let isleHouse = null;
let isleGlow = null;
function registerIsleCabin() {
  const cab = isleHouse.userData.cabin; const ud = cab.userData; const fy = 0.02; const it = buildInterior(M, ud.Lx, ud.W, fy, ud.Lx < 3.6 ? 'tiny' : 'home', 11, { wallH: ud.wallH, rise: ud.rise }); it.group.position.copy(cab.position); isleHouse.add(it.group); const ib = bake(it.group); isleHouse.remove(it.group); isleHouse.add(ib);
  const b = ISL.cabin; if (isleGlow) scene.remove(isleGlow); isleGlow = town.addGlow(b.x, cab.position.y + 0.07, b.z, 0.85);
  town.addEnterable({ id: 'isle', wx: b.x, wz: b.z, rot: ISL.cabinRot, floorY: cab.position.y + 0.03, Lx: ud.Lx, W: ud.W, shell: cab, interior: ib, cols: it.cols });
}
function placeIsleHouse(lv) { if (isleHouse) scene.remove(isleHouse); isleHouse = buildIslandHouse(M, lv); scene.add(isleHouse); COL.clearRects('isle'); registerIsleCabin(); }
placeIsleHouse(save.isleLv);
const stall = buildStall(M); stall.position.copy(ISL.stall); stall.position.y += 0.03; stall.rotation.y = ISL.cabinRot; scene.add(stall); stall.updateMatrixWorld(true);
COL.addRect('stall', ISL.stall.x, ISL.stall.z, ISL.cabinRot, 0.7, 1.6);
const fireObj = buildFire(M); fireObj.position.copy(ISL.fire); scene.add(fireObj); COL.addTree(ISL.fire.x, ISL.fire.z, 0.85);
const fireS = { lit: false, burn: 0, slots: [0, 1, 2].map(() => ({ it: null, t: 0, dur: 9, done: false })) };
let dockGlow = null;
function registerDockCabin() {
  const cab = dockObj.cabin; const ud = cab.userData; const fy = 0.02; const it = buildInterior(M, ud.Lx, ud.W, fy, ud.Lx < 3.6 ? 'tiny' : 'fisher', 5, { wallH: ud.wallH, rise: ud.rise }); it.group.position.copy(cab.position); DOCK.group.add(it.group); const ib = bake(it.group); DOCK.group.remove(it.group); DOCK.group.add(ib);
  const w = DOCK.group.localToWorld(cab.position.clone()); if (dockGlow) scene.remove(dockGlow); dockGlow = town.addGlow(w.x, w.y + 0.07, w.z, 0.9);
  town.addEnterable({ id: 'dock', wx: w.x, wz: w.z, rot: DOCK.rotY, floorY: w.y + 0.03, Lx: ud.Lx, W: ud.W, shell: cab, interior: ib, cols: it.cols });
}
function placeDockColliders() {
  COL.clearRects('dock'); COL.clearRects('chest'); const L = DOCK.layout; const w = DOCK.group.localToWorld(new V3(L.cabX, 0, 0));
  registerDockCabin();
  const cw = DOCK.group.localToWorld(new V3(L.chest.x, 0, L.chest.z)); COL.addRect('chest', cw.x, cw.z, DOCK.rotY, 0.55, 0.38);
}
placeDockColliders();
const chestWorld = () => DOCK.group.localToWorld(new V3(DOCK.layout.chest.x, 0, DOCK.layout.chest.z));

/* tekne + balıkçı */
let boat = buildBoat(save.boat); scene.add(boat);
const B = { x: 0, z: 0, a: DOCK.angle, v: 0, w: 0, amt: 0, phase: 0, tier: save.boat, steer: 0 };
function boatSpawn() { const L = DOCK.layout; const hb = boat.userData.hb; const p = DOCK.group.localToWorld(new V3((L.x1 + L.px1) / 2 - 0.5, 0, L.hw + 0.5 + hb)); B.x = p.x; B.z = p.z; B.a = DOCK.angle; }
boatSpawn();
const fisher = buildFisherman(); scene.add(fisher); fisher.userData.applyOutfit(save.outfit);
const S = { mode: 'foot', x: 0, y: 0, z: 0, face: DOCK.angle, faceT: DOCK.angle, started: false, walkT: 0, rodOut: true, run: false, swimSpd: 0 };
{ const p = DOCK.group.localToWorld(new V3(DOCK.layout.px1 - 1.7, 0, 0)); S.x = p.x; S.z = p.z; S.y = DOCK.layout.DOCK_Y; fisher.position.set(S.x, S.y, S.z); }
/* ---------- dalış modu (diving.js) ---------- */
const dive = createDiveSystem({ scene, camera, renderer, sky, water, fisher, terrainH, lakeD, islandD, anchor: DOCK.pos, isMobile, avoid: (x, z) => nearDockZone(x, z, 3), collide: (x, z) => { COL.push(x, z, 0.45, _col); return _col; },
  hooks: { splash: (x, z, s) => splash(x, z, s), sfx: (n) => sound.sfx(n), ripple: (x, z, t, s) => water.userData.addRipple(x, z, t, s) } });

/* parıltı / polen / ateş böcekleri */
const motes = (() => {
  const N = 260, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = 0.4 + Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; seed[i] = Math.random() * 10; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime: timeU, uNight: { value: 0 }, uC: { value: new V3() }, uScale: { value: 300 } },
    vertexShader: `attribute float aSeed; uniform float uTime,uNight,uScale; uniform vec3 uC; varying float vS; varying float vF;
      void main(){ vec3 p = position; p.xz = uC.xz + mod(p.xz - uC.xz + 30., 60.) - 30.; p.x += sin(uTime*0.4+aSeed)*1.2; p.z += cos(uTime*0.35+aSeed*1.7)*1.2; p.y += sin(uTime*0.6+aSeed*3.)*0.5; vec4 mv = viewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; float fl = 0.5+0.5*sin(uTime*(1.5+aSeed*0.3)+aSeed*9.); vF = fl; gl_PointSize = uScale*mix(0.035,0.11,uNight)*(0.6+fl*uNight*0.8)/(-mv.z); vS = aSeed; }`,
    fragmentShader: `uniform float uNight; varying float vF; void main(){ float d = length(gl_PointCoord-0.5)*2.; float a = smoothstep(1.,0.,d); vec3 day = vec3(1.,.97,.85)*0.55; vec3 ngt = vec3(.75,1.,.25)*(0.4+1.4*vF); vec3 c = mix(day,ngt,uNight); gl_FragColor = vec4(c, a*mix(0.28,0.9,uNight)*mix(1.,vF,uNight)); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
})();

/* ====================== EFEKTLER: halkalar, damlalar ====================== */
const ringPool = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true })); m.visible = false; m.renderOrder = 5; m.userData = { t: 0, life: 1.6, max: 1.5 }; scene.add(m); ringPool.push(m); }
let ringI = 0;
function ring(x, z, max = 1.5, life = 1.6) { const m = ringPool[ringI++ % ringPool.length]; m.position.set(x, 0.045, z); m.userData.t = 0; m.userData.life = life; m.userData.max = max; m.visible = true; }
const DROPS = 100; const dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.8 }), DROPS); dropMesh.frustumCulled = false; scene.add(dropMesh);
const drops = Array.from({ length: DROPS }, () => ({ p: new V3(0, -10, 0), v: new V3(), life: 0, s: 1 })); let dropI = 0; const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3();
function splash(x, z, s = 1, quiet = false) {
  water.userData.addRipple(x, z, state.time, Math.min(1.6, s)); ring(x, z, 1.2 + s * 1.4, 1.5 + s * 0.4);
  const n = Math.round(8 + 12 * s); for (let i = 0; i < n; i++) { const d = drops[dropI++ % DROPS]; const a = Math.random() * 6.28, r = Math.random() * 0.25; d.p.set(x + Math.cos(a) * r, 0.02, z + Math.sin(a) * r); const sp = 0.6 + Math.random() * 1.2 * s; d.v.set(Math.cos(a) * sp, 2.2 + Math.random() * 3.0 * Math.sqrt(s), Math.sin(a) * sp); d.life = 0.7 + Math.random() * 0.5; d.s = 0.6 + Math.random() * 0.9; }
}
function updateFx(dt) {
  for (const m of ringPool) if (m.visible) { const u = m.userData; u.t += dt; const k = u.t / u.life; if (k >= 1) { m.visible = false; continue; } const sc = 0.15 + u.max * (1 - Math.pow(1 - k, 2)); m.scale.set(sc, 1, sc); m.material.opacity = 0.55 * (1 - k) * (1 - k); }
  for (let i = 0; i < DROPS; i++) { const d = drops[i]; if (d.life > 0) { d.life -= dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); if (d.p.y < 0.0) d.life = 0; } const sc = d.life > 0 ? d.s : 0; _s.set(sc, sc, sc); _m.compose(d.life > 0 ? d.p : new V3(0, -50, 0), _q, _s); dropMesh.setMatrixAt(i, _m); }
  dropMesh.instanceMatrix.needsUpdate = true;
}


/* parçacıklar: duman + kıvılcım */
const smoke = new Particles(scene, 160, { gravity: 0.35, drag: 0.55, wind: 0.25 });
const sparks = new Particles(scene, 50, { additive: true, gravity: -0.8, drag: 0.5 });

/* ====================== HAYVANLAR ====================== */
const animals = new Animals(scene, { ripple: (x, z, s) => water.userData.addRipple(x, z, state.time, s), splash: (x, z, s) => splash(x, z, s) });

/* ====================== BALIKLAR ====================== */
const fishSys = new FishSystem(scene, {
  splash: (x, z, s) => splash(x, z, s), sfx: (n) => sound.sfx(n),
  nibble: () => onNibble(), bite: () => onBite(), missed: () => onMissed(), landed: (f) => onLanded(f),
});

const spear = createSpearSystem({ scene, camera, diver: dive.diver, fishSys, terrainH, bubbles: dive.fx.bubbles, hooks: {
  sfx: (n) => sound.sfx(n), hit: (f) => { navigator.vibrate && navigator.vibrate(30); },
  landed: (f) => { F.caught = f; F.fish = null; f.root.visible = false; onLanded(f); },
  escape: () => toast('Zıpkından kurtuldu!', 1500), miss: () => {}, blocked: (x, y, z) => dive.solids.blocked(x, y, z, 0.05),
} });
/* ====================== OLTA / DURUM ====================== */
const F = { st: 'idle', power: 0, pdir: 1, castT: 0, launched: false, target: new V3(), p0: new V3(), p1: new V3(), flyT: 0, flyDur: 1, arc: 2, retT: 0, retFrom: new V3(), waitT: 0, attractT: 0, tension: 0, prog: 0, surge: 0, surgeT: 0, surgeLeft: 0, fishPow: 0.5, dist0: 10, dir0: new V3(), hold: false, rodTilt: 0.85, bobDip: 0, tickT: 0, rippleT: 0, thrash: 0, slackT: 0, caught: null, dirAngle: 0, hookTime: 0 };
const bobber = new THREE.Group(); { const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, 6.3, 0, 1.6), new THREE.MeshStandardMaterial({ color: '#e63a2a', roughness: 0.4 })); const bot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, 6.3, 1.6, 1.55), new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.4 })); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), new THREE.MeshStandardMaterial({ color: '#f4d03a' })); stick.position.y = 0.2; top.castShadow = true; bobber.add(top, bot, stick); bobber.visible = false; scene.add(bobber); }
const BP = new V3(); // bobber dünya konumu (su yüzeyinde)
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false })); aimRing.visible = false; aimRing.renderOrder = 9; scene.add(aimRing);
const aimDot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12).rotateX(-Math.PI / 2), aimRing.material); aimRing.add(aimDot);
/* misina: verlet ip simülasyonu + kameraya dönük ince şerit */
const LN = 24; const lineGeo = new THREE.BufferGeometry(); const linePos = new Float32Array((LN + 1) * 2 * 3); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3)); { const idx = []; for (let i = 0; i < LN; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } lineGeo.setIndex(idx); }
const lineMesh = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); lineMesh.frustumCulled = false; lineMesh.visible = false; scene.add(lineMesh);
const _tip = new V3(), _r = new V3(), _a = new V3(), _b = new V3(), _c = new V3();
const rope = { p: Array.from({ length: LN + 1 }, () => new V3()), q: Array.from({ length: LN + 1 }, () => new V3()), len: 5, init: false };
function ropeStep(dt, tipP, endP, taut, slack) {
  const n = LN, P = rope.p, Q = rope.q; const dist = tipP.distanceTo(endP);
  if (!rope.init) { for (let i = 0; i <= n; i++) { P[i].lerpVectors(tipP, endP, i / n); Q[i].copy(P[i]); } rope.init = true; rope.len = dist * 1.02; }
  rope.len = taut ? dist * 1.002 : Math.max(rope.len, dist * slack);
  const segL = rope.len / n, sub = 2, h = Math.min(dt, 0.033) / sub;
  for (let s = 0; s < sub; s++) {
    for (let i = 1; i < n; i++) { const p = P[i], q = Q[i]; const vx = (p.x - q.x) * 0.965, vy = (p.y - q.y) * 0.965, vz = (p.z - q.z) * 0.965; q.copy(p); p.x += vx; p.y += vy - 7.5 * h * h; p.z += vz; if (p.y < 0.02) { p.y = 0.02; q.y = 0.02; } }
    P[0].copy(tipP); P[n].copy(endP);
    for (let it = 0; it < 10; it++) for (let i = 0; i < n; i++) {
      const a = P[i], b = P[i + 1]; _a.subVectors(b, a); const dl = _a.length() || 1e-5; const k = (dl - segL) / dl; const wa = i === 0 ? 0 : (i + 1 === n ? 1 : 0.5), wb = i === 0 ? 1 : (i + 1 === n ? 0 : 0.5);
      a.addScaledVector(_a, k * wa); b.addScaledVector(_a, -k * wb);
    }
  }
}
function writeRibbon(endP) {
  _r.setFromMatrixColumn(camera.matrixWorld, 0); const w = 0.004 + camera.position.distanceTo(endP) * 0.0007;
  for (let i = 0; i <= LN; i++) { const c = rope.p[i]; linePos[i * 6] = c.x - _r.x * w; linePos[i * 6 + 1] = c.y - _r.y * w; linePos[i * 6 + 2] = c.z - _r.z * w; linePos[i * 6 + 3] = c.x + _r.x * w; linePos[i * 6 + 4] = c.y + _r.y * w; linePos[i * 6 + 5] = c.z + _r.z * w; }
  lineGeo.attributes.position.needsUpdate = true;
}

const playerPos = () => { fisher.updateWorldMatrix(true, false); return fisher.getWorldPosition(new V3()); };
const camFwd = () => new V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
function castPoint(power) { const o = playerPos(); const d = 5 + power * 21; return o.addScaledVector(camFwd(), d); }
const validCast = (p) => isWater(p.x, p.z, 0.7) && !nearDockZone(p.x, p.z, 0.4);

function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }
function setBobberAt(p) { BP.set(p.x, 0, p.z); }

function sitDown(st) {
  if (F.st !== 'idle') { toast('Önce oltayı topla'); return; }
  st.occ = 'player'; S.sitting = st; S.x = st.x; S.z = st.z; S.y = st.y - 0.795; S.face = S.faceT = st.a; S.rodOut = false; S.walkT = 0; setSeated(fisher, true); fisher.position.set(S.x, S.y, S.z);
  toast(st.kind === 'fire' ? 'Ateşin başına oturdun — kalkmak için yürü' : 'Oturdun — kalkmak için yürü', 2000);
}
function standUp() {
  const st = S.sitting; if (!st) return; S.sitting = null; st.occ = null; setSeated(fisher, false);
  S.x = st.x + Math.cos(st.a) * 0.75; S.z = st.z + Math.sin(st.a) * 0.75; { COL.push(S.x, S.z, 0.33, _col); S.x = _col.x; S.z = _col.z; } S.y = groundAt(S.x, S.z);
}
function pressAction() {
  if (!S.started || cardOpen || ui.isOpen()) return;
  sound.start(); if (S.sitting) standUp();
  if (hunt.on) { shootHunt(); return; }
  if (S.away && S.mode === 'foot' && F.st === 'idle') { toast('Olta için göle yaklaş — yayla avlanmak için “Yay (Av)”', 2200); return; }
  if (S.mode === 'dive') { dive.input.up = true; return; }
  if (F.st === 'idle' && S.mode === 'swim') { startDive(); return; }
  switch (F.st) {
    case 'idle': S.rodOut = true; F.st = 'charging'; F.power = 0; F.pdir = 1; aimRing.visible = true; break;
    case 'waiting': retrieve(); break;
    case 'bite': { const f = fishSys.tryHook(); if (f) startFight(f); else { toast('Çok geç!'); } break; }
    case 'fight': F.hold = true; break;
  }
}
function releaseAction() {
  if (S.mode === 'dive' || dive.input.up) { dive.input.up = false; if (S.mode === 'dive') return; }
  if (F.st === 'charging') { aimRing.visible = false; F.target.copy(castPoint(F.power)); F.st = 'casting'; F.castT = 0; F.launched = false; sound.sfx('cast'); }
  F.hold = false;
}
function retrieve(fast) { fishSys.release(); F.st = 'retrieve'; F.retT = 0; F.retFrom.copy(BP); F.retDur = fast ? 0.35 : 0.8; }
function onNibble() { if (F.st !== 'waiting') return; F.bobDip = 0.9; splash(BP.x, BP.z, 0.25); sound.sfx('nibble'); navigator.vibrate && navigator.vibrate(12); }
function onBite() { if (F.st !== 'waiting') return; F.st = 'bite'; F.bobDip = 2.2; splash(BP.x, BP.z, 0.7); sound.sfx('bite'); toast('Bir balık yedi — ÇEK!', 1400); navigator.vibrate && navigator.vibrate([60, 40, 80]); }
function onMissed() { if (F.st === 'bite') { F.st = 'waiting'; F.bobDip = 0; toast('Kaçırdın… beklemeye devam', 1600); } }
function startFight(f) {
  F.st = 'fight'; F.tension = 0.3; F.prog = 0.35; F.surge = 0; F.surgeT = 1.2; F.surgeLeft = 0; F.hold = true; F.slackT = 0;
  F.fishPow = f.sp.power * (0.75 + 0.5 * f.sizeT); const pp = playerPos(); F.dir0.set(BP.x - pp.x, 0, BP.z - pp.z); F.dist0 = Math.max(6, F.dir0.length()); F.dir0.normalize(); F.hookTime = 0;
  F.fish = f; F.bobDip = 0; toast('Makarayı basılı tutup çevir! Çekerken gerilimi izle.', 2600); navigator.vibrate && navigator.vibrate(40); setMode('bobber', true);
}
let cardOpen = false; let cardFish = null;
const baseValue = (f) => Math.round(f.sp.value * (0.6 + 0.9 * f.sizeT));
function onLanded(f) {
  F.st = 'landed'; bobber.visible = false; lineMesh.visible = false; quests.add('fish'); if (S.mode === 'dive') quests.add('speared');
  const sp = f.sp; const rec = save.caught[sp.id] || { n: 0, max: 0 }; const isNew = rec.n === 0; rec.n++; const record = f.weight > rec.max; rec.max = Math.max(rec.max, f.weight); save.caught[sp.id] = rec; persist();
  cardFish = { id: sp.id, w: f.weight, v: baseValue(f), cooked: false }; showCard(f, isNew, record); sound.sfx('win');
}
function showCard(f, isNew, record) {
  cardOpen = true; $('cname').textContent = f.sp.name; $('cweight').textContent = f.weight.toFixed(2).replace('.', ',') + ' kg'; $('creward').textContent = `Değeri ≈ ${cardFish.v} altın · Sepet ${save.inv.length}/${BASKET_MAX}`;
  $('cbadge').textContent = isNew ? 'Yeni tür!' : record ? 'Yeni rekor!' : ''; $('cbadge').style.display = isNew || record ? 'inline-block' : 'none';
  $('cok').disabled = save.inv.length >= BASKET_MAX; $('cok').textContent = save.inv.length >= BASKET_MAX ? 'Sepet dolu' : 'Sepete Koy';
  drawFishArt($('cart'), f.sp); $('card').classList.add('on');
}
function closeCard(keep) {
  if (!cardOpen) return; if (keep && cardFish) { if (save.inv.length >= BASKET_MAX) { toast('Sepet dolu! Önce sat ya da bırak.'); return; } save.inv.push(cardFish); toast('Sepete eklendi'); sound.sfx('ui'); } else if (cardFish) { sound.sfx('splash'); }
  cardOpen = false; cardFish = null; $('card').classList.remove('on'); const f = F.caught || F.fish; if (f) { fishSys.respawn(f, false); } F.fish = null; F.st = 'idle'; fishSys.release(); persist(); hud();
}
$('cok').addEventListener('click', () => closeCard(true));
$('crel').addEventListener('click', () => closeCard(false));

/* ====================== KAMERA ====================== */
const cam = { mode: 'follow', yaw: 0, pitch: 0.26, dist: 6.5, tyaw: 0, tpitch: 0.26, tdist: 6.5, target: new V3(), ttarget: new V3(), lim: [2.2, 30], plim: [-0.02, 1.4] };
const MODES = { follow: { pitch: 0.26, dist: 6.5, lim: [2.2, 30] }, bird: { pitch: 1.1, dist: 95, lim: [30, 230] }, cinema: { pitch: 0.4, dist: 58, lim: [20, 150] }, reflect: { pitch: -0.02, dist: 46, lim: [10, 120] }, island: { pitch: 0.17, dist: 22, lim: [6, 60] }, bobber: { pitch: 0.36, dist: 4.2, lim: [1.6, 16] }, preview: { pitch: 0.1, dist: 3.4, lim: [2, 8] } };
function setMode(m, silent) {
  const d = MODES[m]; if (!d) return; cam.mode = m; cam.tdist = d.dist; cam.tpitch = d.pitch; cam.lim = d.lim;
  const pp = playerPos();
  if (m === 'follow') { cam.tdist = S.mode === 'boat' ? (B.tier === 2 ? 9 : 7.5) : 6.2; cam.tyaw = cam.yaw + angDiff(Math.atan2(-Math.cos(S.face), -Math.sin(S.face)), cam.yaw); }
  if (m === 'reflect') cam.tyaw = cam.yaw + angDiff(Math.atan2(DOCK.dir.x, DOCK.dir.y), cam.yaw);
  if (m === 'island') cam.tyaw = cam.yaw + angDiff(Math.atan2(DOCK.pos.x - ISL.cabin.x, DOCK.pos.z - ISL.cabin.z), cam.yaw);
  if (m === 'bobber') cam.tyaw = cam.yaw + angDiff(Math.atan2(pp.x - BP.x, pp.z - BP.z), cam.yaw);
  if (m === 'preview') cam.tyaw = cam.yaw + angDiff(Math.atan2(Math.cos(S.face), Math.sin(S.face)), cam.yaw);
  document.querySelectorAll('#cams button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); if (!silent) sound.sfx('ui');
}
function updateCamera(dt) {
  switch (cam.mode) {
    case 'follow': { const p = playerPos(); cam.ttarget.set(p.x, p.y + (S.mode === 'dive' ? 0.05 : S.mode === 'swim' ? 0.7 : 1.25), p.z); break; }
    case 'bird': { cam.ttarget.set(0, 0, -2); break; }
    case 'cinema': { cam.ttarget.set(ISLAND.x, 1.6, ISLAND.z); cam.tyaw += dt * 0.05; cam.tpitch = 0.4 + 0.1 * Math.sin(state.time * 0.07); break; }
    case 'reflect': cam.ttarget.set(cabinWorld.x, 1.1, cabinWorld.z); break;
    case 'island': cam.ttarget.set(ISL.cabin.x, ISL.cabin.y + 1.6, ISL.cabin.z); break;
    case 'preview': { const p = playerPos(); const wide = innerWidth > innerHeight * 1.1; const o = wide ? 0.7 : 0; cam.ttarget.set(p.x + Math.cos(cam.yaw) * o, p.y + (S.mode === 'swim' ? 0.4 : 1.0) - (wide ? 0 : 0.35), p.z - Math.sin(cam.yaw) * o); cam.tyaw += dt * 0.4; break; }
    case 'bobber': { if (bobber.visible) cam.ttarget.set(BP.x, 0.35, BP.z); else { const p = playerPos(); cam.ttarget.set(p.x, p.y + 1.25, p.z); } break; }
  }
  { const pl = S.mode === 'dive' ? [-1.3, 1.35] : cam.plim; cam.tpitch = clamp(cam.tpitch, pl[0], pl[1]); } cam.tdist = clamp(cam.tdist, cam.lim[0], cam.lim[1]);
  let k = 1 - Math.exp(-dt * 6), kt = 1 - Math.exp(-dt * (cam.mode === 'follow' || cam.mode === 'preview' ? 10 : 4)); if (cam.snap) { k = kt = 1; cam.snap--; }
  cam.yaw += angDiff(cam.tyaw, cam.yaw) * k; cam.pitch += (cam.tpitch - cam.pitch) * k; cam.dist += (cam.tdist - cam.dist) * k; cam.target.lerp(cam.ttarget, kt);
  const cp = Math.cos(cam.pitch); camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  const floor = S.mode === 'dive' ? terrainH(camera.position.x, camera.position.z) + 0.3 : Math.max(terrainH(camera.position.x, camera.position.z) + 0.55, 0.45); if (camera.position.y < floor) camera.position.y = floor; if (S.mode === 'dive') { const maxY = -0.3 + 3.0 * clamp((dive.D.y + 1.3) / 1.1, 0, 1); if (camera.position.y > maxY) camera.position.y = maxY; }
  camera.position.y += Math.sin(state.time * 0.5) * 0.01; camera.lookAt(cam.target);
  if (window.__photo && window.__photo.look) { const p = playerPos(), L = window.__photo.look; camera.position.set(p.x, p.y + 1.7, p.z); camera.lookAt(p.x + L[0], p.y + 1.7 + L[1], p.z + L[2]); } else if (window.__photo) { const p = playerPos(), a = S.face + window.__photo.az; camera.position.set(p.x + Math.cos(a) * window.__photo.d, p.y + 1.0 + window.__photo.h, p.z + Math.sin(a) * window.__photo.d); camera.lookAt(p.x, p.y + (window.__photo.ty ?? 0.95), p.z); }
}

/* ====================== GİRDİ ====================== */
const keys = {}; const joy = { x: 0, y: 0, active: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (cardOpen) closeCard(true); else pressAction(); }
  if (e.code === 'KeyE') mountAction();
  if (e.code === 'KeyH' && S.started && !cardOpen) setHunt(!hunt.on);
  if (e.code === 'KeyG' && S.started && !cardOpen) { if (ui.isOpen()) ui.closePanel(); else ui.open('quests'); }
  if (e.code === 'KeyV' && S.started && !cardOpen) { if (S.mode === 'swim') startDive(); else if (S.mode === 'dive') { dive.requestSurface(); toast('Yüzeye çıkılıyor…', 1200); } }
  if (e.code === 'KeyF') { if (S.mode === 'dive') fireSpear(); else interact(); }
  if (e.code === 'KeyB') openBasket();
  if (e.code === 'KeyM') ui.isOpen() && $('shop').classList.contains('on') ? ui.closeShop() : ui.openShop();
  if (e.code === 'Escape') { ui.closePanel(); ui.closeShop(); }
  const n = { Digit1: 'follow', Digit2: 'bird', Digit3: 'cinema', Digit4: 'reflect', Digit5: 'island', Digit6: 'bobber' }[e.code]; if (n) setMode(n);
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space' || e.code === 'Enter') releaseAction(); });
const ptrs = new Map(); let pinchD = 0;
canvas.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() }); canvas.setPointerCapture(e.pointerId); pinchD = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) { cam.tyaw -= dx * 0.0058; cam.tpitch += dy * 0.0045; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD) cam.tdist *= pinchD / d; pinchD = d; }
});
const endP = (e) => { const p = ptrs.get(e.pointerId); if (p && ptrs.size === 1 && performance.now() - p.t0 < 260 && Math.hypot(p.x - p.x0, p.y - p.y0) < 7) { if (S.mode === 'dive') fireSpear(); else if (hunt.on) shootHunt(); } ptrs.delete(e.pointerId); pinchD = 0; }; canvas.addEventListener('pointerup', endP); canvas.addEventListener('pointercancel', endP);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.tdist *= 1 + Math.sign(e.deltaY) * 0.1; }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
(() => { const el = $('joy'), kn = $('knob'); let id = null, cx = 0, cy = 0; const R = 46;
  const set = (e) => { let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } kn.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / R; joy.y = -dy / R; };
  el.addEventListener('pointerdown', (e) => { id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.active = true; set(e); e.stopPropagation(); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
  const up = (e) => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; joy.active = false; kn.style.transform = ''; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); })();
const act = $('act');
act.addEventListener('pointerdown', (e) => { e.preventDefault(); act.setPointerCapture(e.pointerId); pressAction(); });
act.addEventListener('pointerup', () => releaseAction()); act.addEventListener('pointercancel', () => releaseAction());
document.querySelectorAll('#cams button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
$('mount').addEventListener('click', mountAction);
const diveDownBtn = (() => { const b = document.createElement('button'); b.id = 'dDown'; b.textContent = 'Alçal';
  b.style.cssText = 'position:absolute;display:none;right:calc(22px + 122px);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 76px);width:84px;height:84px;border-radius:50%;border:0;font:700 15px system-ui,sans-serif;color:#fff;background:linear-gradient(160deg,#2f8fc0,#1a5f93);box-shadow:0 8px 20px rgba(0,0,0,.28);touch-action:none;user-select:none;-webkit-user-select:none;z-index:6';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); dive.input.down = true; });
  const off = () => { dive.input.down = false; }; b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); document.body.appendChild(b); return b; })();
function fireSpear() { if (!S.started || cardOpen || ui.isOpen() || S.mode !== 'dive' || dive.state.morph < 0.6) return; spear.fire(dive.D); }
const spearBtn = (() => { const b = document.createElement('button'); b.id = 'dSpear'; b.textContent = 'Zıpkın';
  b.style.cssText = 'position:absolute;display:none;width:84px;height:84px;border-radius:50%;border:0;font:700 15px system-ui,sans-serif;color:#fff;background:linear-gradient(160deg,#e0663a,#b3361c);box-shadow:0 8px 20px rgba(0,0,0,.28);touch-action:none;user-select:none;-webkit-user-select:none;z-index:6';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fireSpear(); }); document.body.appendChild(b); return b; })();
const crosshair = (() => { const d = document.createElement('div'); d.id = 'dCross';
  d.style.cssText = 'position:fixed;left:50%;top:50%;width:0;height:0;display:none;pointer-events:none;z-index:4';
  d.innerHTML = '<div class="r" style="position:absolute;left:-17px;top:-17px;width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.8);box-shadow:0 0 6px rgba(0,0,0,.45);transition:transform .12s,border-color .12s"></div><div style="position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.6)"></div><div class="l" style="position:absolute;left:-90px;width:180px;top:24px;text-align:center;font:600 12px system-ui,sans-serif;color:#ffe1b0;text-shadow:0 1px 3px rgba(0,0,0,.7)"></div>';
  document.body.appendChild(d); return d; })();
$('ctx').addEventListener('click', interact);
$('tod').style.pointerEvents = 'none';
// gece/gündüz düğmesi: saati hızla gündüze (09:30) ya da geceye (22:00) kaydırır, sonra otomatik akış sürer
const dnBtn = document.createElement('button'); dnBtn.className = 'pill glass'; dnBtn.id = 'dn'; $('tod').after(dnBtn);
let todGoal = null; const dnLabel = () => { dnBtn.textContent = sky.tod.cur.night > 0.5 ? '☀ Gündüz' : '☾ Gece'; };
dnBtn.addEventListener('click', () => { todGoal = sky.tod.cur.night > 0.5 ? 9.5 : 22.0; sound.start(); sound.sfx('ui'); });
function stepTodGoal(dt) { if (todGoal == null) return; const h = sky.tod.hour; let d = (todGoal - h + 24) % 24; const st = Math.min(d, dt * 7); sky.tod.hour = (h + st) % 24; if (d - st < 0.01) { sky.tod.hour = todGoal; todGoal = null; } dnLabel(); }
dnLabel(); // gece/gündüz artık zamanla kendiliğinden ilerler; düğme saat göstergesi
$('mute').addEventListener('click', () => { sound.setMuted(!sound.muted); $('mute').textContent = sound.muted ? 'Ses kapalı' : 'Ses'; $('mute').classList.toggle('off', sound.muted); sound.start(); });
$('jbtn').addEventListener('click', () => { buildJournal(); $('journal').classList.add('on'); sound.sfx('ui'); });
$('jclose').addEventListener('click', () => $('journal').classList.remove('on'));
$('bbtn').addEventListener('click', openBasket);
$('sbtn').addEventListener('click', () => { sound.start(); ui.openShop(); });
function buildJournal() {
  const list = $('jlist'); list.innerHTML = ''; let found = 0;
  for (const sp of SPECIES) { const r = save.caught[sp.id]; const row = document.createElement('div'); row.className = 'jrow' + (r ? '' : ' lock'); const cv = document.createElement('canvas'); cv.width = 130; cv.height = 65; if (r) { found++; drawFishArt(cv, sp, 130, 65); } row.appendChild(cv); const t = document.createElement('div'); t.innerHTML = r ? `<b>${sp.name}</b><small>${r.n} adet · en ağır ${r.max.toFixed(2).replace('.', ',')} kg</small>` : `<b>???</b><small>Henüz yakalanmadı</small>`; row.appendChild(t); list.appendChild(row); }
  $('jtitle').textContent = `Balık Günlüğü  ${found}/${SPECIES.length}`;
}

/* ====================== ARAYÜZ / EKONOMİ ====================== */
const G = {
  save, persist, toast, sound, customers: [], fire: fireS,
  hud: () => hud(),
  serve: (c, pay) => serveCustomer(c, pay),
  lightFire: () => { fireS.lit = true; fireS.burn = 260; fireObj.userData.lit = true; sound.sfx('fire'); toast('Ateş yandı'); },
  cookStart: (it) => { const s = fireS.slots.find(x => !x.it); if (!s) return false; Object.assign(s, { it, t: 0, done: false }); return true; },
  swapBoat: (tier) => swapBoat(tier),
  upgradeDock: (lv) => upgradeDock(lv), upgradeIsle: (lv) => { placeIsleHouse(lv); },
  applyOutfit: () => fisher.userData.applyOutfit(save.outfit),
  onShop: (open, tab) => { if (open && tab === 'giyim') { shopPrevMode = shopPrevMode || cam.mode; setMode('preview', true); } else if (shopPrevMode) { const m = shopPrevMode === 'preview' ? 'follow' : shopPrevMode; shopPrevMode = null; setMode(m, true); } },
};
let shopPrevMode = null;
const ui = createUI(G);
/* ====================== GÖREVLER / AVLANMA ====================== */
const qTrack = document.createElement('div'); qTrack.id = 'qtrack';
qTrack.style.cssText = 'font:700 12.5px system-ui,sans-serif;color:#fff;text-shadow:0 1px 6px rgba(0,30,20,.75);cursor:pointer;pointer-events:auto;max-width:210px;line-height:1.25;margin:-2px 0 0 4px';
$('coins').after(qTrack); qTrack.addEventListener('click', () => { sound.start(); ui.open('quests'); });
function updateQTrack() { const q = quests.active(); const v = q ? quests.val(q) : 0; const t = q ? `★ ${q.title}: ${v}/${q.goal}${q.stat === 'run' ? ' m' : ''}` : '★ Tüm görevler tamamlandı!'; if (qTrack.textContent !== t) qTrack.textContent = t; }
const quests = createQuests({ save,
  onReward: (q) => { sound.sfx('coin'); sound.sfx('win'); toast(`Görev tamamlandı: ${q.title} · +${q.reward} altın`, 4200); navigator.vibrate && navigator.vibrate([40, 30, 60]); persist(); hud(); },
  onChange: () => updateQTrack() });
G.quests = quests; updateQTrack();
const gameCount = () => Object.values(save.game).reduce((a, b) => a + b, 0);
const qBtn = document.createElement('button'); qBtn.className = 'pill glass'; qBtn.id = 'qbtn'; qBtn.textContent = 'Görevler'; $('mute').before(qBtn);
qBtn.addEventListener('click', () => { sound.start(); ui.open('quests'); });
const _v1 = new THREE.Vector3();
const hunt = createHunt({ scene, camera, animals, terrainH, hooks: {
  sfx: (n) => sound.sfx(n), splash: (x, z, s) => splash(x, z, s),
  origin: (o) => o.set(S.x + Math.cos(S.faceT) * 0.3, S.y + 1.3, S.z + Math.sin(S.faceT) * 0.3),
  face: (a) => { S.faceT = a; },
  hit: (kind, killed) => {
    if (!killed) { toast('Yaraladı! Bir daha vur', 1500); sound.sfx('thud'); return; }
    save.game[kind] = (save.game[kind] || 0) + 1; quests.add(kind); quests.add('hunt'); persist(); sound.sfx('thud'); navigator.vibrate && navigator.vibrate(30);
    toast(`${GAME[kind].name} avlandı! · Av çantası ${gameCount()}/${GAME_MAX}`, 2400);
  } } });
const hbtn = document.createElement('button'); hbtn.className = 'pill glass'; hbtn.id = 'hbtn'; hbtn.textContent = 'Yay (Av)'; $('lefts').appendChild(hbtn);
function camYaw() { const d = camera.getWorldDirection(_v1); return Math.atan2(d.z, d.x); }
function setHunt(on) {
  if (on === hunt.on) return;
  if (on) { if (S.mode !== 'foot' || F.st !== 'idle' || S.sitting) { toast('Avlanmak için karada ol ve oltayı topla', 2000); return; } S.rodOut = false; S.faceT = camYaw(); toast('Av modu · Boşluk / Ateş: ok at · Nişangâhı hayvana getir', 3400); }
  hunt.setOn(on); hbtn.textContent = on ? 'Avı Bırak' : 'Yay (Av)'; hbtn.style.outline = on ? '2px solid #ffb030' : '';
  act.dataset.s = '';
}
hbtn.addEventListener('click', () => { sound.start(); setHunt(!hunt.on); });
const runBtn = document.createElement('button'); runBtn.id = 'runBtn'; runBtn.textContent = 'Koş';
runBtn.style.cssText = 'position:absolute;display:none;left:156px;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 84px);width:56px;height:56px;border-radius:50%;border:0;font:700 14px system-ui,sans-serif;color:#fff;background:rgba(36,66,52,.62);box-shadow:0 6px 16px rgba(0,0,0,.28);touch-action:none;user-select:none;-webkit-user-select:none;z-index:6';
runBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); S.sprint = !S.sprint; runBtn.style.background = S.sprint ? 'linear-gradient(160deg,#e0a73a,#c27a1a)' : 'rgba(36,66,52,.62)'; });
document.body.appendChild(runBtn);
function shootHunt() {
  if (!hunt.on || S.mode !== 'foot' || cardOpen || ui.isOpen()) return;
  if (gameCount() >= GAME_MAX) { toast('Av çantan dolu — tezgahta ya da sandıkta sat', 2200); return; }
  if (hunt.state === 'ready') { S.faceT = camYaw(); hunt.press(); }
}
let stallSig = null;
function updateStallFish() {
  const sig = save.inv.map((f) => f.id + f.w + (f.cooked ? 'c' : '')).join('|'); if (sig === stallSig) return; stallSig = sig; const ud = stall.userData;
  for (const grp of [ud.tray, ud.hang]) for (let i = grp.children.length - 1; i >= 0; i--) if (grp.children[i].userData.fishDisp) grp.remove(grp.children[i]);
  const list = save.inv.slice().sort((a, b) => b.v - a.v);
  list.slice(0, 9).forEach((it, i) => { const tray = Math.floor(i / 3), k = i % 3; const f = makeDisplayFish(spById(it.id), it.w, it.cooked, 0.64); f.userData.fishDisp = true; f.rotation.order = 'YXZ'; f.rotation.y = Math.sin(i * 5.1) * 0.22; f.rotation.x = (i % 2 ? 1 : -1) * Math.PI / 2 * 0.94; f.position.set(0, 0.17, [-0.95, 0, 0.95][tray] + (k - 1) * 0.26); ud.tray.add(f); });
  list.slice(9, 14).forEach((it, i) => { const f = makeDisplayFish(spById(it.id), it.w, it.cooked, 0.8); f.userData.fishDisp = true; f.rotation.z = -Math.PI / 2; f.position.set(0.06, -0.2 - f.userData.len * 0.5, -1.1 + i * 0.55); ud.hang.add(f); const cord = box(0.012, 0.2, 0.012, M.dark, 0.06, -0.1, -1.1 + i * 0.55, false); cord.userData.fishDisp = true; ud.hang.add(cord); });
}
function hud() { updateStallFish(); $('coins').textContent = save.coins; $('bbtn').textContent = `Sepet ${save.inv.length}`; ui.refresh(); }
function openBasket() { if (!S.started) return; sound.start(); ui.open('basket'); }

function swapBoat(tier) {
  const old = boat; const parent = old.parent; scene.remove(old); boat = buildBoat(tier); B.tier = tier; scene.add(boat); boat.position.copy(old.position); boat.rotation.copy(old.rotation);
  if (S.mode === 'boat') { boat.add(fisher); const sd = boat.userData.seat; fisher.position.set(sd.x, sd.y, 0); }
  B.v = 0; collideBoat(true);
}
function upgradeDock(lv) {
  dockObj = buildDockHouse(M, lv); water.userData.bakeObs(); placeDockColliders(); dockObj.cabin.getWorldPosition(cabinWorld);
}

/* ====================== OYUNCU HAREKETİ ====================== */
const Y = new V3(0, 1, 0), _v = new V3(), _col = { x: 0, z: 0, hit: false }, GR = { R: new V3(), L: new V3() };
function inputVec() {
  if (ui.isOpen() || cardOpen) return null;
  let ix = joy.x, iy = joy.y; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1;
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; } if (l < 0.12) return null;
  const f = camFwd(); const right = new V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)); return new V3().addScaledVector(f, iy).addScaledVector(right, ix);
}
const _bp = { x: 0, z: 0 };
/** yürüyen/yüzen balıkçı tekneleri (kendi teknesi + müşteri kayıkları) delip geçemez: gövde iki daire olarak itilir */
function boatPush(x, z, r) {
  const list = [boat]; for (const c of G.customers) if (c.boat && c.boat.parent) list.push(c.boat);
  for (const bt of list) {
    if (!bt || !bt.parent) continue; const ud = bt.userData, sc = bt.scale.x, L = ud.L * sc, hb = ud.hb * sc, hd = -bt.rotation.y, cx = Math.cos(hd), cz = Math.sin(hd), px = bt.position.x, pz = bt.position.z;
    for (const k of [-0.24, 0.0, 0.24]) { const bx = px + cx * L * k, bz = pz + cz * L * k, rr = hb * 0.92 + r; const dx = x - bx, dz = z - bz, d2 = dx * dx + dz * dz; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-3; x = bx + dx / d * rr; z = bz + dz / d * rr; } }
  }
  _bp.x = x; _bp.z = z; return _bp;
}
const altEl = (() => { const e = document.createElement('div'); e.id = 'alt'; e.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);padding:7px 16px;border-radius:999px;background:rgba(244,240,228,.88);color:#3b4a36;font:600 14px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .4s;z-index:9;letter-spacing:.2px'; document.body.appendChild(e); return e; })();
let altT = 0, altShown = 0, altMsg = 0;
function altUpdate(dt, g) {
  const h = Math.max(0, g); const show = S.mode === 'foot' && h > 6; if (show !== !!altShown) { altShown = show ? 1 : 0; altEl.style.opacity = show ? '1' : '0'; }
  altT -= dt; if (altT > 0) return; altT = 0.25;
  if (show) { altEl.textContent = '⛰ Yükseklik ' + Math.round(h) + ' m'; if (h > (quests.stats.alt || 0) + 1) quests.max('alt', h); const ms = h > 100 ? 3 : h > 70 ? 2 : h > 40 ? 1 : 0; if (ms > altMsg) { altMsg = ms; toast(['', 'Yamaçtasın — manzara açılıyor', 'Zirvelere yaklaşıyorsun', 'Zirvedesin! Bütün ada ayaklarının altında'][ms], 2400); } }
}
function groundAt(x, z) { const fl = town.floorAt(x, z); _v.set(x, 0, z); DOCK.group.worldToLocal(_v); const gy = dockGroundY(_v.x, _v.z); const th = terrainH(x, z); let g = gy !== null ? Math.max(gy, th) : th; if (fl !== null) g = Math.max(g, fl); const by = bridgeY(x, z, S.y); if (by !== null) g = Math.max(g, by); return g; }
const boatR = () => 0.28 * boat.userData.L + 0.1;
function collideBoat(force) {
  const r = boatR(); const L = DOCK.layout; const v = DOCK.group.worldToLocal(new V3(B.x, 0, B.z)); let hit = false;
  const rects = [{ x0: L.x0 - 1.5, x1: L.x1 + 0.2, hz: L.hz + 0.3 }, { x0: L.x1 + 0.2, x1: L.px1, hz: L.hw + 0.05 }];
  for (const q of rects) if (v.x > q.x0 - r && v.x < q.x1 + r && Math.abs(v.z) < q.hz + r) {
    const pl = v.x - (q.x0 - r), pr_ = (q.x1 + r) - v.x, pz = (q.hz + r) - Math.abs(v.z); const mn = Math.min(pl, pr_, pz);
    if (mn === pl) v.x = q.x0 - r; else if (mn === pr_) v.x = q.x1 + r; else v.z = Math.sign(v.z || 1) * (q.hz + r); hit = true;
  }
  if (hit) { const w = DOCK.group.localToWorld(v); B.x = w.x; B.z = w.z; B.v *= 0.6; }
  const lm = r + 1.35; const ld = lakeD(B.x, B.z); if (ld < lm) { const [gx, gz] = gradOf(lakeD, B.x, B.z); const l = Math.hypot(gx, gz) || 1; B.x += gx / l * (lm - ld); B.z += gz / l * (lm - ld); B.v *= 0.7; }
  for (const c of G.customers) { if (!c.boat || !c.boat.parent) continue; const dx = B.x - c.pos.x, dz = B.z - c.pos.z; const d = Math.hypot(dx, dz) || 1e-3; const mn = r + 0.28 * c.boat.userData.L * 0.88 + 0.55; if (d < mn) { B.x += dx / d * (mn - d); B.z += dz / d * (mn - d); B.v *= 0.85; } }
  const im = r + 1.5; const id = islandD(B.x, B.z); if (id > -im) { const [gx, gz] = gradOf(islandD, B.x, B.z); const l = Math.hypot(gx, gz) || 1; B.x -= gx / l * (id + im); B.z -= gz / l * (id + im); B.v *= 0.7; }
}
function findLanding() {
  const r0 = boatR(); let best = null, bd = 1e9;
  for (let r = r0 + 0.8; r < r0 + 5.8; r += 0.7) for (let k = 0; k < 28; k++) {
    const a = k / 28 * 6.283; const x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r; const g = groundAt(x, z); if (g < -0.35) continue; if (COL.blocked(x, z, 0.4)) continue; if (Math.hypot(x, z) > 148) continue;
    const d = r + 0.3 * Math.abs(angDiff(a, B.a)); if (d < bd) { bd = d; best = [x, z, g]; }
  }
  return best;
}
function mountAction() {
  if (!S.started || cardOpen || S.mode === 'dive') return; if (S.sitting) standUp(); if (F.st !== 'idle') { toast('Önce oltayı topla'); return; } if (ui.isOpen()) return;
  const bd = Math.hypot(S.x - B.x, S.z - B.z);
  if (S.mode === 'boat') {
    const spot = findLanding();
    scene.add(fisher); setSeated(fisher, false);
    if (spot) { S.mode = 'foot'; S.rodOut = false; S.x = spot[0]; S.z = spot[1]; S.y = spot[2]; S.face = S.faceT = Math.atan2(spot[1] - B.z, spot[0] - B.x); toast('Karaya çıktın. Keşfet! (F: etkileşim)', 2400); }
    else { S.mode = 'swim'; const a = B.a + Math.PI / 2; S.x = B.x + Math.cos(a) * (boat.userData.hb + 0.9); S.z = B.z + Math.sin(a) * (boat.userData.hb + 0.9); S.y = 0; S.face = S.faceT = a; toast('Suya atladın', 1600); splash(S.x, S.z, 0.8); sound.sfx('splash'); }
    if (S.mode === 'swim') S.rodOut = false; else S.rodOut = false; B.v = 0; sound.setMotor(0); setMode('follow', true);
  } else {
    if (bd > boat.userData.L / 2 + 3.4) { callBoat(); return; }
    S.x = B.x; S.z = B.z; S.mode = 'boat'; boat.add(fisher); const sd = boat.userData.seat; fisher.position.set(sd.x, sd.y, 0); setSeated(fisher, true); S.rodOut = false; B.v = 0; sound.sfx('splash'); toast(B.tier === 2 ? 'Joystick ile yönlendir — motor hazır!' : 'Joystick ile kürek çek. Kıyıya yanaşınca “Karaya Çık”.', 2600); S.face = S.faceT = B.a; setMode('follow', true);
  }
}
function callBoat() {
  const bm = boatR() + 1.6; const px = S.x, pz = S.z;
  for (let r = 3; r < 40; r += 1.5) for (let k = 0; k < 24; k++) {
    const a = k / 24 * 6.283 + r; const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
    if (isWater(x, z, 1.4) && lakeD(x, z) > bm + 0.5 && islandD(x, z) < -(bm + 0.5) && !nearDockZone(x, z, bm)) { B.x = x; B.z = z; B.a = Math.atan2(pz - z, px - x); B.v = 0; splash(x, z, 0.7); sound.sfx('splash'); toast('Tekne yanına geldi'); return; }
  }
  toast('Yakında suya çağıracak yer yok');
}

let rowSfxT = 0, wadeT = 0;
function updateDive(dt) {
  const iv = inputVec(); const D = dive.D;
  const r = dive.update(dt, state.time, { dirX: iv ? iv.x : 0, dirZ: iv ? iv.z : 0, mag: iv ? Math.min(1, iv.length()) : 0, up: false, down: !!(keys.ShiftLeft || keys.ShiftRight || keys.KeyC || keys.ControlLeft) });
  spear.update(dt, state.time, D, dive.state.morph > 0.5);
  { const ch = dive.seabed.chest; const ready = Date.now() - (save.treasureAt || 0) > 720000; if (ch.claimed === ready) ch.setClaimed(!ready);
    if (ready && dive.state.morph > 0.5 && Math.hypot(D.x - ch.x, D.y - ch.y, D.z - ch.z) < 1.8) { const n = 10 * (14 + ((Math.random() * 22) | 0)); save.coins += n; save.treasureAt = Date.now(); save.treasures = (save.treasures || 0) + 1; ch.setClaimed(true); quests.add('treasure'); persist(); hud(); sound.sfx('coin'); sound.sfx('win'); toast(`Hazine sandığı bulundun! +${n} altın`, 3200); navigator.vibrate && navigator.vibrate([40, 30, 60]); } }
  S.x = D.x; S.y = D.y; S.z = D.z; S.face = S.faceT = D.yaw; S.walkT = 0; S.swimSpd = 0; S.rodOut = false;
  fisher.position.set(S.x, S.y, S.z); fisher.rotation.y = -S.face;
  if (r && r.exit) { dive.exit(S); S.mode = 'swim'; S.y = 0; fisher.position.set(S.x, 0, S.z); toast('Yüzeye çıktın', 1400); cam.tdist = 6.2; }
}
let runAcc = 0;
function updatePlayer(dt) {
  { const ld = lakeD(S.x, S.z); S.away = S.mode === 'foot' && (S.away ? ld < -20 : ld < -27) && F.st === 'idle'; if (S.away && F.st === 'idle') S.rodOut = false; sound.setZone(clamp(1 + ld / 35, 0, 1)); }
  hunt.update(dt); if (hunt.on && (S.mode !== 'foot' || S.sitting || F.st !== 'idle')) setHunt(false);
  if (S.mode === 'dive') { updateDive(dt); return; }
  if (dive.state.morph > 0) dive.update(dt, state.time, { dirX: 0, dirZ: 0, mag: 0, up: false, down: false });
  if (spear.state !== 'ready') spear.update(dt, state.time, dive.D, false);
  const iv = inputVec(); const busy = F.st !== 'idle' && F.st !== 'landed';
  if (S.mode === 'foot' || S.mode === 'swim') {
    const sw = S.mode === 'swim'; let spd = 0; S.walkT = 0;
    if (S.sitting && iv && iv.length() > 0.3) standUp();
    if (iv && !busy && !S.sitting) {
      const m = Math.min(1, iv.length()); const dir = iv.clone().normalize(); const g0 = groundAt(S.x, S.z); const depth = Math.max(0, -terrainH(S.x, S.z));
      const sprint = !sw && (keys.ShiftLeft || keys.ShiftRight || S.sprint); spd = sw ? 1.8 * (0.4 + 0.6 * m) : (sprint ? 6.3 : 2.1 + 1.9 * smooth(0.78, 1, m)) * (0.35 + 0.65 * m) * (1 - 0.4 * clamp(depth / 0.9, 0, 1));
      if (!sw) { const gr = gradOf(terrainH, S.x, S.z); const up = gr[0] * dir.x + gr[1] * dir.z; spd *= 1 - 0.42 * clamp(up / 0.9, 0, 1); }
      let nx = S.x + dir.x * spd * dt, nz = S.z + dir.z * spd * dt;
      if (!sw) { COL.push(nx, nz, 0.33, _col); nx = _col.x; nz = _col.z; } else { COL.push(nx, nz, 0.4, _col); nx = _col.x; nz = _col.z; }
      if (S.y < 0.15) { const q = boatPush(nx, nz, 0.35); nx = q.x; nz = q.z; }
      const g1 = groundAt(nx, nz); const r = Math.hypot(nx, nz);
      if (r > 208) { nx *= 208 / r; nz *= 208 / r; }
      if (!(g1 - g0 > 0.95 && !sw && g1 > 0.9)) { S.x = nx; S.z = nz; }
      S.faceT = Math.atan2(dir.z, dir.x); S.walkT = Math.min(1, m); S.run = spd > 3.6; if (S.run && !sw) { runAcc += spd * dt; if (runAcc >= 5) { quests.add('run', runAcc); runAcc = 0; } } S.swimSpd = sw ? m : 0; S.moveT = (S.moveT || 0) + dt; if ((S.moveT > 0.6 || sw) && F.st === 'idle') S.rodOut = false;
      wadeT -= dt; if (depth > 0.12 && !sw && wadeT <= 0) { wadeT = 0.38; water.userData.addRipple(S.x, S.z, state.time, 0.18); }
      if (sw) { wadeT -= dt; if (wadeT <= 0) { wadeT = 0.45; water.userData.addRipple(S.x, S.z, state.time, 0.28); } }
    } else { S.swimSpd = 0; S.moveT = 0; }
    const g = groundAt(S.x, S.z); altUpdate(dt, g);
    if (S.sitting) { S.walkT = 0; S.faceT = S.sitting.a; S.y = S.sitting.y - 0.795; }
    else if (!sw && g < -0.95) { S.mode = 'swim'; S.rodOut = false; sound.sfx('splash'); splash(S.x, S.z, 0.5); toast('Yüzüyorsun — kıyıya dönmek için geri yürü', 1800); setSeated(fisher, false); }
    else if (sw && g > -0.55) { S.mode = 'foot'; toast('Kıyıdasın', 1200); }
    if (S.sitting) { /* sabit */ } else if (S.mode === 'swim') S.y += (0 - S.y) * Math.min(1, dt * 6); else S.y += (g - S.y) * Math.min(1, dt * 14);
    fisher.position.set(S.x, S.y, S.z);
    // tekne dururken suda sürüklenmez; ama iskelede bağlı kalır
    boat.position.set(B.x, 0.13 + Math.sin(state.time * 1.3 + B.x * 0.2) * 0.02, B.z); boat.rotation.y = -B.a; boat.userData.hull.rotation.x = Math.sin(state.time * 1.1) * 0.025; boat.userData.hull.rotation.z = Math.sin(state.time * 0.9 + 1) * 0.02; animateOars(boat, 0, 0); if (boat.userData.prop) boat.userData.prop.rotation.x += dt * 0.5;
  } else {
    S.walkT = 0; let thrust = 0; const bt = BOATS[B.tier];
    if (iv && F.st === 'idle') S.rodOut = false;
    if (iv && (F.st === 'idle' || F.st === 'landed')) { const ta = Math.atan2(iv.z, iv.x); const da = angDiff(ta, B.a); const rate = bt.turn * (0.45 + 0.55 * Math.min(1, iv.length())); const dB = clamp(da, -rate * dt, rate * dt); B.a += dB; B.w = dB / Math.max(dt, 1e-3); thrust = Math.max(0, Math.cos(da)) * Math.min(1, iv.length()); if (Math.abs(da) > 1.9 && iv.length() > 0.5) thrust = 0.35 * iv.length(); } else B.w *= 0.9;
    B.steer += (clamp(B.w / bt.turn, -1, 1) - B.steer) * Math.min(1, dt * 5);
    const target = bt.speed * thrust; B.v += (target - B.v) * (1 - Math.exp(-dt * (target > B.v ? (B.tier === 2 ? 0.9 : 1.1) : 0.7)));
    B.x += Math.cos(B.a) * B.v * dt; B.z += Math.sin(B.a) * B.v * dt; collideBoat();
    B.amt += (Math.min(1, thrust * 1.3) - B.amt) * (1 - Math.exp(-dt * 3)); if (B.tier < 2) B.phase += dt * (1.2 + B.v * 1.3 * (3.1 / bt.speed)) * 2.6 * (B.amt > 0.05 ? 1 : 0);
    rowSfxT -= dt; if (B.tier < 2 && thrust > 0.3 && rowSfxT <= 0) { rowSfxT = 1.1 * (B.tier === 1 ? 0.85 : 1); sound.sfx('row'); }
    if (B.tier === 2) { sound.setMotor(clamp(B.v / bt.speed, 0, 1) * 0.9 + 0.1); boat.userData.prop.rotation.x += dt * (6 + B.v * 6); }
    if (B.v > 0.8 && Math.random() < dt * (B.tier === 2 ? 14 : 4)) { const bx = B.x - Math.cos(B.a) * boat.userData.L * 0.48, bz = B.z - Math.sin(B.a) * boat.userData.L * 0.48; water.userData.addRipple(bx, bz, state.time, B.tier === 2 ? 0.55 : 0.3); }
    animateOars(boat, B.phase, B.amt);
    const t = state.time; boat.position.set(B.x, 0.13 + Math.sin(t * 1.3 + B.x * 0.2) * 0.02, B.z); boat.rotation.y = -B.a; boat.userData.hull.rotation.x = Math.sin(t * 1.1) * 0.025 - (B.tier === 2 ? B.v * 0.012 : 0); boat.userData.hull.rotation.z = Math.sin(t * 0.9 + 1) * 0.02 - B.v * 0.012 - B.steer * B.v * 0.012;
    S.x = B.x; S.z = B.z; S.y = 0;
  }
  if (busy || F.st === 'charging') { const pp = playerPos(); const f = F.st === 'fight' ? Math.atan2(BP.z - pp.z, BP.x - pp.x) : Math.atan2(camFwd().z, camFwd().x); S.faceT = f; }
  if (S.mode === 'boat' && !busy && F.st !== 'charging') { S.faceT = B.a; if (!S.rodOut) S.face = B.a; }
  if (hunt.on && S.mode === 'foot' && !(S.walkT > 0.05) && !window.__noHuntFace) S.faceT = camYaw();
  S.face += angDiff(S.faceT, S.face) * (1 - Math.exp(-dt * 8));
  fisher.rotation.y = S.mode === 'boat' ? -S.face + B.a : -S.face;
}

/* ---- bağlamsal etkileşim butonları ---- */
const standWorld = (k) => stall.localToWorld(stall.userData.stands[k].clone());
function nearestInteract() {
  if (S.mode === 'swim' && F.st === 'idle') return { k: 'dive', label: 'Dal' };
  if (S.mode === 'dive') return { k: 'surface', label: 'Yüzeye Çık' };
  if (S.mode !== 'foot') return null; let best = null, bd = 1e9;
  if (S.sitting) return { k: 'stand', label: 'Kalk' };
  for (const st of town.seats) { if (st.occ) continue; const d = Math.hypot(S.x - st.x, S.z - st.z); if (d < 1.7 && d < bd) { bd = d; best = { k: 'seat', seat: st, label: 'Otur' }; } }
  if (best) { bd -= 0.8; }
  const sp = standWorld('customer'); let d = Math.hypot(S.x - sp.x, S.z - sp.z); if (d < 3.6 && d < bd) { bd = d; best = { k: 'stall', label: 'Tezgah' }; }
  d = Math.hypot(S.x - ISL.fire.x, S.z - ISL.fire.z); if (d < 3.1 && d < bd) { bd = d; best = { k: 'fire', label: fireS.lit ? 'Ateş / Pişir' : 'Ateşi Yak' }; }
  const cw = chestWorld(); d = Math.hypot(S.x - cw.x, S.z - cw.z); if (d < 2.6 && d < bd) { bd = d; best = { k: 'chest', label: 'Toptancı Sandığı' }; }
  for (const tr of fruitSys.trees) { d = Math.hypot(S.x - tr.x, S.z - tr.z); if (d < 2.9 && d < bd + 0.6) { const n = tr.avail(); if (n > 0) { bd = d; best = { k: 'fruit', tree: tr, label: `${FRUITS[tr.kind].name} Topla (${n})` }; } } }
  return best;
}
const fruitTotal = () => Object.values(save.fruit).reduce((a, b) => a + b, 0);
function pickFruit(tr) {
  const room = FRUIT_MAX - fruitTotal(); if (room <= 0) { toast('Meyve çantan dolu — tezgahta ya da sandıkta sat'); return; }
  const n = tr.pick(); if (!n) return; const take = Math.min(n, room); save.fruit[tr.kind] = (save.fruit[tr.kind] || 0) + take; quests.add('fruit', take); persist(); sound.sfx('splash'); toast(`+${take} ${FRUITS[tr.kind].name}${take < n ? ' (çanta doldu)' : ''}`, 1800); ui.refresh(); hud();
}
let ctxT = null; let spearPlaced = false; addEventListener('resize', () => { spearPlaced = false; });
function startDive() {
  if (S.mode !== 'swim') return; if (F.st !== 'idle') { toast('Önce oltayı topla'); return; }
  if (-terrainH(S.x, S.z) < 1.1) { toast('Burası dalmak için çok sığ — göle doğru yüz', 1800); return; }
  S.face = S.face; if (dive.enter(S)) { S.mode = 'dive'; S.rodOut = false; setMode('follow', true); cam.tdist = 5.2; cam.tpitch = 0.12; toast('Dalış · Zıpkın: F / dokun · Yüksel: Boşluk · Alçal: Shift', 3800); fishSys.populate(dive.D, 5, 8, 15); }
}
function interact() {
  if (!S.started || cardOpen) return; if (ui.isOpen()) return; const t = nearestInteract(); if (!t) return; sound.start();
  if (t.k === 'dive') { startDive(); return; }
  if (t.k === 'surface') { dive.requestSurface(); toast('Yüzeye çıkılıyor…', 1200); return; }
  if (t.k === 'fruit') { pickFruit(t.tree); return; }
  if (t.k === 'seat') { sitDown(t.seat); return; }
  if (t.k === 'stand') { standUp(); return; }
  if (t.k === 'fire' && !fireS.lit) { G.lightFire(); ui.open('fire'); } else ui.open(t.k === 'chest' ? 'chest' : t.k === 'fire' ? 'fire' : 'stall');
}
function updateButtons() {
  // mount
  let lab = null; const bd = Math.hypot(S.x - B.x, S.z - B.z);
  if (S.mode === 'dive') lab = null;
  else if (S.mode === 'boat') lab = findLanding() ? 'Karaya Çık' : 'Suya Atla';
  else lab = bd < boat.userData.L / 2 + 3.4 ? 'Tekneye Bin' : bd > 9 ? 'Tekneyi Çağır' : null;
  const mb = $('mount'); if (mb.dataset.l !== String(lab)) { mb.dataset.l = String(lab); mb.textContent = lab || ''; mb.classList.toggle('on', !!lab); }
  mb.classList.toggle('dim', F.st !== 'idle');
  { const sd = S.mode === 'dive' ? 'block' : 'none'; if (diveDownBtn.style.display !== sd) diveDownBtn.style.display = sd; }
  { const ad = S.away && S.mode === 'foot' && !hunt.on && F.st === 'idle' ? 'none' : ''; if (act.style.display !== ad) act.style.display = ad; }
  { const rd = S.mode === 'foot' && S.started && !cardOpen ? 'block' : 'none'; if (runBtn.style.display !== rd) runBtn.style.display = rd; }
  { const dv = S.mode === 'dive' && dive.state.morph > 0.5; const sd = dv ? 'block' : 'none'; if (spearBtn.style.display !== sd) { spearBtn.style.display = sd; spearPlaced = false; }
    if (dv && !spearPlaced) { const r = act.getBoundingClientRect(); if (r.width) { spearBtn.style.right = Math.max(10, innerWidth - r.right + (r.width - 84) / 2) + 'px'; spearBtn.style.bottom = Math.round(innerHeight - r.top + 12) + 'px'; spearPlaced = true; } }
    const hv = hunt.on && S.mode === 'foot'; const cd = (dv || hv) && !cardOpen ? 'block' : 'none'; if (crosshair.style.display !== cd) crosshair.style.display = cd;
    if (hv) { const ck = 'h' + hunt.state + (hunt.target || ''); if (crosshair.dataset.k !== ck) { crosshair.dataset.k = ck; const r = crosshair.querySelector('.r'), l = crosshair.querySelector('.l'); r.style.borderColor = hunt.target ? '#ffb030' : 'rgba(255,255,255,.8)'; r.style.transform = hunt.target ? 'scale(.78)' : ''; l.textContent = hunt.target ? hunt.NAMES[hunt.target] : ''; } }
    if (dv) { const tg = spear.target; const ck = spear.state + (tg ? tg.sp.id : ''); if (crosshair.dataset.k !== ck) { crosshair.dataset.k = ck; const r = crosshair.querySelector('.r'), l = crosshair.querySelector('.l'); const rl = spear.state !== 'ready'; r.style.borderColor = rl ? 'rgba(255,120,90,.85)' : tg ? '#ffb030' : 'rgba(255,255,255,.8)'; r.style.transform = tg && !rl ? 'scale(1.35)' : 'scale(1)'; l.textContent = rl ? (spear.state === 'reload' ? 'Yükleniyor…' : '') : tg ? `${tg.sp.name} · ${tg.weight.toFixed(1).replace('.', ',')} kg` : ''; }
      const sk = spear.state === 'ready' ? '1' : '.5'; if (spearBtn.style.opacity !== sk) spearBtn.style.opacity = sk; } }
  const t = nearestInteract(); const cb = $('ctx'); const key = t ? t.k + t.label : ''; if (cb.dataset.l !== key) { cb.dataset.l = key; cb.textContent = t ? t.label : ''; cb.classList.toggle('on', !!t); }
}

/* ====================== OLTA GÜNCELLEME ====================== */
function updateFishing(dt) {
  const t = state.time; fisher.updateWorldMatrix(true, true); const tip = fisher.userData.tip.getWorldPosition(_tip);
  let rodTarget = 0.85, rate = 6;
  const fnow = F.st;
  if (fnow === 'charging') { F.power += F.pdir * dt * 0.8; if (F.power >= 1) { F.power = 1; F.pdir = -1; } if (F.power <= 0) { F.power = 0; F.pdir = 1; } const p = castPoint(F.power); const ok = validCast(p); aimRing.position.set(p.x, ok ? 0.06 : Math.max(0.1, terrainH(p.x, p.z) + 0.1), p.z); aimRing.material.color.set(ok ? 0x66ff88 : 0xff7766); const s = 1 + 0.08 * Math.sin(t * 8); aimRing.scale.set(s, 1, s); rodTarget = 1.15 + F.power * 0.9; rate = 9; $('pwr').style.setProperty('--p', F.power); }
  if (fnow === 'casting') {
    F.castT += dt; rodTarget = 0.35; rate = 18;
    if (!F.launched && F.castT >= 0.46) { F.launched = true; F.st = 'flying'; F.p0.copy(tip); F.p1.copy(F.target); F.p1.y = 0; const d = Math.hypot(F.p1.x - F.p0.x, F.p1.z - F.p0.z); F.flyDur = 0.55 + d * 0.028; F.arc = 1.5 + d * 0.13; F.flyT = 0; bobber.visible = true; lineMesh.visible = true; BP.copy(F.p0); }
  }
  if (fnow === 'flying') {
    rodTarget = 0.35; F.castT += dt; F.flyT += dt / F.flyDur; const u = Math.min(1, F.flyT); BP.x = lerp(F.p0.x, F.p1.x, u); BP.z = lerp(F.p0.z, F.p1.z, u); const y = lerp(F.p0.y, 0, u) + 4 * F.arc * u * (1 - u); bobber.position.set(BP.x, y, BP.z);
    if (u >= 1) { if (validCast(F.p1)) { splash(BP.x, BP.z, 0.55); sound.sfx('plop'); F.st = 'waiting'; F.waitT = 0; F.attractT = 0.6; F.bobDip = 0; toast('Bekle… şamandıra batınca çek', 2000); } else { splash(BP.x, BP.z, 0.2); toast(nearDockZone(BP.x, BP.z, 0.4) ? 'İskeleye çarptı!' : 'Suya düşmedi!', 1500); retrieve(true); } }
  }
  if (fnow === 'waiting' || fnow === 'bite') {
    rodTarget = fnow === 'bite' ? 0.95 + Math.sin(t * 40) * 0.08 : 0.5; rate = 8; F.waitT += dt;
    if (fnow === 'waiting') { F.attractT -= dt; if (F.attractT <= 0) { F.attractT = 0.5; fishSys.attract(BP); } F.rippleT -= dt; if (F.rippleT <= 0) { F.rippleT = 2.6 + Math.random() * 2; water.userData.addRipple(BP.x, BP.z, t, 0.25); } }
    if (Math.hypot(BP.x - tip.x, BP.z - tip.z) > 34) { toast('Misina çok uzadı!'); retrieve(true); }
  }
  if (fnow === 'retrieve') {
    F.retT += dt / (F.retDur || 0.8); const u = Math.min(1, F.retT); const e = u * u; BP.x = lerp(F.retFrom.x, tip.x, e); BP.z = lerp(F.retFrom.z, tip.z, e); const y = lerp(0, tip.y, e * e) + Math.sin(u * Math.PI) * 0.5; bobber.position.set(BP.x, y, BP.z); rodTarget = 0.7;
    if (u >= 1) { F.st = 'idle'; bobber.visible = false; lineMesh.visible = false; }
  }
  if (fnow === 'fight') {
    const f = F.fish; F.hookTime += dt; rodTarget = 1.0 + Math.sin(t * 17) * 0.05 + F.surge * 0.35; rate = 10; const P = F.fishPow;
    F.surgeT -= dt; if (F.surgeT <= 0 && F.surgeLeft <= 0) { F.surgeLeft = 0.6 + Math.random() * 0.5 + P * 0.3; F.surgeT = (1.1 + Math.random() * 1.6) / (0.55 + P * 0.7); splash(BP.x, BP.z, 0.5); sound.sfx('splash'); navigator.vibrate && navigator.vibrate(25); }
    if (F.surgeLeft > 0) { F.surgeLeft -= dt; F.surge += (1 - F.surge) * Math.min(1, dt * 10); } else F.surge += (0 - F.surge) * Math.min(1, dt * 6);
    const rel = F.hold;
    let dT = rel ? (0.26 + 0.55 * F.surge * (0.4 + P)) : (-1.3 + 0.3 * F.surge * (0.3 + P)); if (F.tension > 0.84 && dT > 0) dT *= 0.25; // olta sürtünme freni: ip neredeyse hiç kopmaz
    F.tension = clamp(F.tension + dT * dt, 0, 1.0); F.over = F.tension >= 1.0 ? (F.over || 0) + dt : 0;
    const zoneOK = F.tension < 0.97 && F.tension > 0.03;
    if (rel) F.prog += (zoneOK ? (0.36 + 0.16 * (1 - P)) : 0.1) * dt * (1 - F.surge * 0.4); else F.prog -= (0.018 + 0.025 * P) * dt * (1 + F.surge * 1.0);
    F.prog = clamp(F.prog, 0, 1);
    
    // balık konumu
    const pp = playerPos(); const perp = new V3(-F.dir0.z, 0, F.dir0.x); const dist = Math.max(2.4, F.dist0 * (1 - 0.88 * F.prog) + F.surge * 1.4); const lat = Math.sin(F.hookTime * (1.2 + P) + f.seed) * (1.6 + P * 3.2) * (1 - 0.55 * F.prog);
    let fx = pp.x + F.dir0.x * dist + perp.x * lat, fz = pp.z + F.dir0.z * dist + perp.z * lat; if (!isWater(fx, fz, 0.5) || nearDockZone(fx, fz, 0.2)) { fx = pp.x + F.dir0.x * dist; fz = pp.z + F.dir0.z * dist; }
    const ox = BP.x, oz = BP.z; BP.set(lerp(BP.x, fx, Math.min(1, dt * 6)), 0, lerp(BP.z, fz, Math.min(1, dt * 6))); f.pos.set(BP.x, -0.2, BP.z); f.a = Math.atan2(BP.z - oz, BP.x - ox) + (F.surge > 0.3 ? 0 : 0.0); if (Math.hypot(BP.x - ox, BP.z - oz) < 0.001) f.a += dt * 3;
    F.rippleT -= dt; if (F.rippleT <= 0) { F.rippleT = 0.28; water.userData.addRipple(BP.x, BP.z, t, 0.7 + F.surge * 0.5); if (Math.random() < 0.35) ring(BP.x, BP.z, 1.4, 1.2); }
    bobber.position.set(BP.x, -0.02, BP.z);
    if (F.prog >= 1) { f.state = 'caught'; f.timer = 0; f.from = new V3(BP.x, -0.2, BP.z); f.to = new V3(pp.x, pp.y + 0.9, pp.z); F.caught = f; F.st = 'landing'; F.hold = false; splash(BP.x, BP.z, 1.0); sound.sfx('splash'); bobber.visible = false; }
    else if (F.over > 1.6) { sound.sfx('snap'); toast('Misina koptu!', 2000); f.state = 'flee'; f.timer = 3; f.speed = 2.8; F.fish = null; F.hold = false; navigator.vibrate && navigator.vibrate([100, 50, 100]); retrieve(true); }
    else if (F.prog <= 0.0 && F.hookTime > 8.0) { toast('Balık kaçtı…', 2000); f.state = 'flee'; f.timer = 3; f.speed = 2.8; F.fish = null; F.hold = false; retrieve(true); }
    $('tbar').style.setProperty('--t', F.tension); $('pbar').style.setProperty('--p', F.prog); $('fight').classList.toggle('surge', F.surge > 0.3); $('tbar').classList.toggle('danger', F.tension > 0.86);
  }
  if (fnow === 'landing') { rodTarget = 0.6; }
  F.rodTilt += (rodTarget - F.rodTilt) * (1 - Math.exp(-dt * rate));
  const castC = (F.st === 'casting' || F.st === 'flying') && F.castT < 1.25 ? F.castT : -1;
  let row = null;
  if (S.mode === 'boat' && !S.rodOut && F.st === 'idle') { boatGrips(boat, GR, B.steer); row = { R: GR.R, L: GR.L, stroke: B.tier < 2 ? -Math.sin(B.phase) * B.amt : 0 }; }
  const ar = fisher.userData.animate(dt, t, { walk: S.walkT || 0, run: S.run, seated: S.mode === 'boat' || !!S.sitting, swim: S.mode === 'swim', swimSpd: S.swimSpd, cast: castC, charge: F.st === 'charging' ? F.power : -1, tilt: F.rodTilt, fight: F.st === 'fight' ? 0.4 + F.surge : 0, idle: F.st === 'idle', rod: S.rodOut && !hunt.on && !(S.away && S.mode === 'foot') && (S.mode === 'foot' || S.mode === 'boat'), away: S.away && S.mode === 'foot', row, bow: hunt.on, draw: hunt.draw, nocked: hunt.on && hunt.state !== 'cool' });
  if (castC >= 0) F.rodTilt = ar.tilt;
  // şamandıra
  const vis = bobber.visible && (F.st === 'waiting' || F.st === 'bite' || F.st === 'fight');
  if (vis) { F.bobDip = Math.max(0, F.bobDip - dt * (F.st === 'bite' ? 0.9 : 2.2)); const y = 0.02 + Math.sin(t * 2.1) * 0.015 - Math.min(1, F.bobDip) * 0.14; bobber.position.set(BP.x, F.st === 'fight' ? -0.02 : y, BP.z); bobber.rotation.z = Math.sin(t * 1.5) * 0.12; }
  // misina
  fisher.updateWorldMatrix(true, true); const tip2 = fisher.userData.tip.getWorldPosition(_tip);
  if (lineMesh.visible) { const end = _b.set(BP.x, bobber.position.y + 0.1, BP.z); if (F.st === 'flying' || F.st === 'retrieve') end.copy(bobber.position); const wait = F.st === 'waiting' || F.st === 'bite'; ropeStep(dt, tip2, end, F.st === 'fight' || F.st === 'retrieve', wait ? 1.06 : 1.03); writeRibbon(end); } else rope.init = false;
  // arayüz
  const lab = hunt.on ? (hunt.state === 'ready' ? 'Ateş' : '…') : S.mode === 'dive' ? 'Yüksel' : S.mode === 'swim' ? 'Dal' : { idle: 'Oltayı At', charging: 'Bırak → Fırlat', casting: '…', flying: '…', waiting: 'Olta Topla', bite: 'ÇEK!', fight: 'Makara', landing: '…', retrieve: '…', landed: '…' }[F.st];
  const akey = hunt.on ? 'hunt' + hunt.state : S.mode === 'dive' ? 'dive' : S.mode === 'swim' ? 'swim' : F.st; if (act.dataset.s !== akey) { act.dataset.s = akey; act.textContent = lab; act.className = hunt.on ? '' : F.st; }
  $('pwr').classList.toggle('on', F.st === 'charging'); $('fight').classList.toggle('on', F.st === 'fight');
}



/* ====================== MÜŞTERİLER (kayıkla gelir) ====================== */
const CUST_NAMES = ['Ayşe Hanım', 'Mehmet Amca', 'Kemal', 'Zeynep', 'Hasan Usta', 'Elif', 'Cemil', 'Fatma Teyze', 'Murat', 'Selin', 'Osman Abi', 'Derya'];
/* ---------- konuşma balonları ---------- */
const talkers = new Map();
function say(obj, yOff, text, dur = 3.2, cls = '') {
  let t = talkers.get(obj); if (!t) { const el = document.createElement('div'); $('bubs').appendChild(el); t = { obj, el, yOff, t: 0 }; talkers.set(obj, t); }
  t.yOff = yOff; t.t = dur; t.el.className = 'bub say ' + cls; t.el.textContent = text; t.el.style.display = 'none';
}
function updateTalkers(dt) {
  for (const [o, t] of talkers) {
    t.t -= dt; if (t.t <= 0) { t.el.remove(); talkers.delete(o); continue; }
    o.getWorldPosition(_v); _v.y += t.yOff; _v.project(camera); const dist = Math.hypot(o.position.x - camera.position.x, o.position.z - camera.position.z);
    if (_v.z < 1 && _v.z > -1 && dist < 40 && Math.abs(_v.x) < 1.1) { t.el.style.display = 'block'; t.el.style.left = clamp((_v.x + 1) / 2 * innerWidth, 110, innerWidth - 110) + 'px'; t.el.style.top = clamp((1 - _v.y) / 2 * innerHeight, 40, innerHeight) + 'px'; } else t.el.style.display = 'none';
  }
}
let custT = 25, custId = 1;
function shoreAt(off) { for (let r = ISL.shoreR - 5; r < ISL.shoreR + 8; r += 0.1) { const p = ISL.P(r, off); if (islandD(p.x, p.z) < 0.3) return r; } return ISL.shoreR; }
const SLOTS = [4.6, 1.0].map((off) => { const r = shoreAt(off); const land = ISL.P(r - 0.9, off), water = ISL.P(r + 3.2, off); water.y = 0; return { off, land, water, out: new V3(water.x + ISL.dir.x * 9, 0, water.z + ISL.dir.y * 9) }; });
function makeOrder() {
  const r = Math.random(); const ids = Object.keys(save.caught);
  if (r < 0.45 && ids.length) return { type: 'sp', sp: ids[Math.random() * ids.length | 0], cooked: Math.random() < 0.3 };
  if (r < 0.65) return { type: 'cooked' };
  if (r < 0.82) return { type: 'big', minW: [1, 2, 3, 5][Math.random() * 4 | 0] };
  return { type: 'any' };
}
function spawnCustomer() {
  if (G.customers.length >= 2) return null; const used = G.customers.map(c => c.slot); const free = [0, 1].filter(k => !used.includes(k)); const slot = free.sort((a, b2) => Math.hypot(B.x - SLOTS[b2].water.x, B.z - SLOTS[b2].water.z) - Math.hypot(B.x - SLOTS[a].water.x, B.z - SLOTS[a].water.z))[0]; const sd = SLOTS[slot];
  let start = null; const phi0 = (Math.random() < 0.5 ? 1 : -1);
  for (let k = 0; k < 40 && !start; k++) { const ang = ISL.la + phi0 * rr(0.3, 1.0) * (k % 2 ? 1 : -1); const R = rr(54, 64); const x = ISLAND.x + Math.cos(ang) * R, z = ISLAND.z + Math.sin(ang) * R; if (lakeD(x, z) > 8) start = new V3(x, 0, z); }
  if (!start) start = new V3(ISLAND.x + ISL.dir.x * 55, 0, ISLAND.z + ISL.dir.y * 55);
  const ang1 = Math.atan2(start.z - ISLAND.z, start.x - ISLAND.x); const w1 = new V3(ISLAND.x + Math.cos(ISL.la + angDiff(ang1, ISL.la) * 0.6) * 32, 0, ISLAND.z + Math.sin(ISL.la + angDiff(ang1, ISL.la) * 0.6) * 32);
  const b = buildBoat(0); b.scale.setScalar(0.88); b.position.copy(start); scene.add(b);
  const npc = buildCustomer(custId * 3 + 1); b.add(npc); npc.position.set(0.05, -0.84, 0);
  const el = document.createElement('div'); el.className = 'bub'; $('bubs').appendChild(el);
  const c = { id: custId++, name: CUST_NAMES[Math.random() * CUST_NAMES.length | 0], boat: b, npc, state: 'sail', pos: start.clone(), a: Math.atan2(w1.z - start.z, w1.x - start.x), path: [w1, sd.out, sd.water], slot, order: makeOrder(), wait: 170, el, ph: 0, v: 0, stand: null, wp: new V3(), t: 0, sd, startPos: start.clone(), w1 };
  b.rotation.y = -c.a; G.customers.push(c); return c;
}
const SELL_LINES = ['Buyur, taze taze!', 'Bunu sana ayırmıştım!', 'Bugünün en güzeli bu, al bakalım.', 'Afiyet olsun, sabah tuttum!'];
const THANK_LINES = ['Eline sağlık usta, çok teşekkürler!', 'Tam aradığım buydu, sağ ol!', 'Harika! Yine uğrarım.', 'Ne güzel balık! Hakkını helal et.'];
const GREET_LINES = ['Merhaba balıkçı!', 'Selamlar usta!', 'Kolay gelsin balıkçı!'];
function serveCustomer(c, pay) {
  quests.add('served');
  c.state = 'happy'; c.t = 0; c.thankT = 1.5; c.pay = pay; S.faceT = Math.atan2(c.npc.position.z - S.z, c.npc.position.x - S.x);
  say(fisher, 2.25, SELL_LINES[(Math.random() * SELL_LINES.length) | 0], 1.7, 'me'); toast(`+${pay} altın`, 1800);
}
function moveToward(o, tx, tz, sp, dt) { const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz); if (d < 1e-4) return 0; const st = Math.min(d, sp * dt); o.x += dx / d * st; o.z += dz / d * st; return d - st; }
function updateCustomers(dt) {
  if (S.started) { custT -= dt; if (custT <= 0) { custT = rr(45, 90); if (G.customers.length < 2 && !ui.isOpen()) { const c = spawnCustomer(); if (c) toast('Adaya bir müşteri kayığı yaklaşıyor…', 2600); } } }
  for (let i = G.customers.length - 1; i >= 0; i--) {
    const c = G.customers[i]; const b = c.boat, npc = c.npc; const bp = c.pos;
    if (c.state === 'sail' || c.state === 'out') {
      const wps = c.state === 'sail' ? c.path : [c.sd.out, c.w1, c.startPos]; c.pi = c.pi || 0; const tgt = wps[Math.min(c.pi, wps.length - 1)];
      const dist = Math.hypot(tgt.x - bp.x, tgt.z - bp.z); const last = c.pi >= wps.length - 1; let sp = last && c.state === 'sail' ? Math.min(2.7, 0.35 + dist * 0.55) : 2.7; if (last && c.state === 'sail' && dist < 9 && Math.hypot(B.x - tgt.x, B.z - tgt.z) < 5) sp = 0.05;
      c.a += angDiff(Math.atan2(tgt.z - bp.z, tgt.x - bp.x), c.a) * Math.min(1, dt * 1.5);
      bp.x += Math.cos(c.a) * sp * dt; bp.z += Math.sin(c.a) * sp * dt; c.ph += dt * 2.8 * (sp > 0.6 ? 1 : 0.2);
      if (dist < (last ? 0.7 : 3)) { if (last) { if (c.state === 'sail') { c.state = 'walk'; c.pi = 0; c.stand = standWorld(c.slot === 0 ? 'customer' : 'customer2'); c.stand.y = 0; scene.add(npc); b.localToWorld(npc.position.set(0.4, 0, 0)); npc.position.y = 0; npc.rotation.y = 0; c.walkPath = [c.sd.land, c.stand]; c.wi = 0; animateOars(b, 0, 0); } else { scene.remove(b); b.traverse(() => { }); c.el.remove(); G.customers.splice(i, 1); continue; } } else c.pi++; }
      b.position.set(bp.x, 0.13 + Math.sin(state.time * 1.3 + c.id) * 0.02, bp.z); b.rotation.y = -c.a; animateOars(b, c.ph, sp > 0.6 ? 1 : 0); animateCustomer(npc, dt, 0, state.time, 'sit');
    } else if (c.state === 'walk' || c.state === 'leave') {
      const wp = c.walkPath[c.wi]; const np = npc.position; const rem = moveToward(np, wp.x, wp.z, 1.5, dt); const gy = Math.max(terrainH(np.x, np.z), -0.45); np.y += (gy - np.y) * Math.min(1, dt * 10);
      npc.rotation.y = -Math.atan2(wp.z - np.z, wp.x - np.x); animateCustomer(npc, dt, 1, state.time);
      if (rem < 0.05) { c.wi++; if (c.wi >= c.walkPath.length) { if (c.state === 'walk') { c.state = 'wait'; npc.rotation.y = -(ISL.la + Math.PI / 2 * 0 + Math.PI) + 0 ; npc.rotation.y = -Math.atan2(S.z - np.z, S.x - np.x); } else { b.add(npc); npc.position.set(0.05, -0.84, 0); npc.rotation.y = 0; c.state = 'out'; c.pi = 0; c.a = Math.atan2(c.sd.out.z - bp.z, c.sd.out.x - bp.x); } } }
    } else if (c.state === 'wait') {
      c.wait -= dt; { const dp = Math.hypot(S.x - npc.position.x, S.z - npc.position.z);
        if (!c.hello) { c.hello = 1; say(npc, 3.0, `${c.name}: “${GREET_LINES[(Math.random() * GREET_LINES.length) | 0]}”`, 2.4); }
        if (dp < 7.5 && !c.greeted) { c.greeted = 1; c.replyT = 1.9; say(fisher, 2.25, 'Hoş geldin! Ne arıyordun?', 1.9, 'me'); }
        if (c.replyT > 0) { c.replyT -= dt; if (c.replyT <= 0) say(npc, 3.0, `“Bana ${ui.orderText(c.order).toLowerCase().replace(' (herhangi)', '')} lazım.”`, 3.4); }
        c.nag = (c.nag || 28) - dt; if (c.nag <= 0) { c.nag = 30; if (dp > 8) say(npc, 3.0, 'Hey balıkçı, bekliyorum!', 2.6); }
        if (ui.isOpen() && dp < 6 && S.mode === 'foot') S.faceT = Math.atan2(npc.position.z - S.z, npc.position.x - S.x); } const np = npc.position; npc.rotation.y += angDiff(-Math.atan2(S.z - np.z, S.x - np.x), npc.rotation.y) * Math.min(1, dt * 2); animateCustomer(npc, dt, 0, state.time, 'wait');
      if (c.wait <= 0) { c.state = 'leave'; c.walkPath = [c.sd.land, new V3(bp.x, 0, bp.z)]; c.wi = 0; toast(`${c.name} beklemekten sıkılıp gitti`, 2200); ui.refresh(); }
    } else if (c.state === 'happy') {
      c.t += dt; if (c.thankT > 0) { c.thankT -= dt; if (c.thankT <= 0) say(npc, 3.0, `“${THANK_LINES[(Math.random() * THANK_LINES.length) | 0]}”`, 2.8); } animateCustomer(npc, dt, 0, state.time, 'wave'); if (c.t > 2.2) { c.state = 'leave'; c.walkPath = [c.sd.land, new V3(bp.x, 0, bp.z)]; c.wi = 0; ui.refresh(); }
    }
    // konuşma balonu
    if (c.state === 'wait' && !(c.replyT > 0) && !talkers.has(npc)) {
      _v.set(npc.position.x, npc.position.y + 2.15, npc.position.z).project(camera); const vis = _v.z < 1 && _v.z > -1 && Math.hypot(npc.position.x - camera.position.x, npc.position.z - camera.position.z) < 55 && Math.abs(_v.x) < 1.1;
      if (vis) { c.el.style.display = 'block'; c.el.style.left = clamp((_v.x + 1) / 2 * innerWidth, 105, innerWidth - 105) + 'px'; c.el.style.top = (((1 - _v.y) / 2 * innerHeight) - (c.slot || 0) * 40) + 'px'; const html = `${ui.orderText(c.order)}<i style="--k:${Math.max(0, c.wait / 1.7)}%"></i>`; if (c.el.dataset.h !== html) { c.el.dataset.h = html; c.el.innerHTML = html; } } else c.el.style.display = 'none';
    } else c.el.style.display = 'none';
  }
}

/* ====================== ATEŞ + DUMAN ====================== */
let smokeAcc = 0, chimAcc = 0, spkAcc = 0, tSmokeAcc = 0, tSparkAcc = 0;
function updateFireSim(dt, night) {
  fireObj.userData.lit = fireS.lit; updateFire(fireObj, dt, state.time, night); const fp = ISL.fire; const pd = Math.hypot(S.x - fp.x, S.z - fp.z);
  if (fireS.lit) {
    fireS.burn -= dt; if (fireS.burn <= 0) { fireS.lit = false; if (pd < 25) toast('Ateş söndü'); ui.refresh(); }
    smokeAcc += dt; while (smokeAcc > 0.1) { smokeAcc -= 0.1; const g = 0.78 - night * 0.35; smoke.emit(fp.x + rr(-0.12, 0.12), fp.y + 1.0, fp.z + rr(-0.12, 0.12), rr(-0.1, 0.1), rr(0.55, 0.9), rr(-0.1, 0.1), rr(2.8, 3.8), 0.3, 1.5, g, g, g, 0.3); }
    spkAcc += dt; while (spkAcc > 0.12) { spkAcc -= 0.12; sparks.emit(fp.x + rr(-0.2, 0.2), fp.y + 0.7, fp.z + rr(-0.2, 0.2), rr(-0.4, 0.4), rr(0.8, 2.2), rr(-0.4, 0.4), rr(0.8, 1.7), 0.06, 0.015, 1, 0.55, 0.15, 0.95); }
  }
  fireS.slots.forEach((s, i) => {
    const m = fireObj.userData.slots[i]; m.mesh.visible = !!s.it;
    if (s.it) {
      if (fireS.lit && !s.done) { s.t += dt; if (s.t >= s.dur) { s.done = true; sound.sfx('ding'); if (pd < 14) toast(`${spById(s.it.id).name} pişti!`, 1800); ui.refresh(); } }
      const k = clamp(s.t / s.dur, 0, 1); const sp = spById(s.it.id); m.mesh.material.color.set(sp.top).lerp(new THREE.Color('#d9a45a'), 0.35).lerp(new THREE.Color('#9a5a24'), smooth(0.2, 1, k)); const sc = 0.55 + Math.min(1.1, Math.pow(s.it.w, 0.3) * 0.5); m.mesh.scale.set(0.95 * sc, 0.22 * sc, 0.32 * sc);
      if (s.done && pd < 4.6 && save.inv.length < BASKET_MAX) { save.inv.push({ ...s.it, cooked: true }); quests.add('cooked'); toast(`Sepete: ${spById(s.it.id).name} (pişmiş)`, 1800); sound.sfx('coin'); s.it = null; persist(); hud(); }
    }
  });
  { const tf = town.fire; if (tf.userData.lit && Math.hypot(S.x - tf.position.x, S.z - tf.position.z) < 70) {
    tSmokeAcc += dt; while (tSmokeAcc > 0.1) { tSmokeAcc -= 0.1; const g = 0.78 - night * 0.35; smoke.emit(tf.position.x + rr(-0.12, 0.12), tf.position.y + 1.0, tf.position.z + rr(-0.12, 0.12), rr(-0.1, 0.1), rr(0.55, 0.9), rr(-0.1, 0.1), rr(2.8, 3.8), 0.3, 1.5, g, g, g, 0.3); }
    tSparkAcc += dt; while (tSparkAcc > 0.12) { tSparkAcc -= 0.12; sparks.emit(tf.position.x + rr(-0.2, 0.2), tf.position.y + 0.7, tf.position.z + rr(-0.2, 0.2), rr(-0.4, 0.4), rr(0.8, 2.2), rr(-0.4, 0.4), rr(0.8, 1.7), 0.06, 0.015, 1, 0.55, 0.15, 0.95); } } }
  stall.userData.light.intensity = night * 12;
}
let townChim = 0;
function updateChimneys(dt) {
  chimAcc += dt; if (chimAcc < 0.22) return; chimAcc = 0; const g = 0.82 - 0.3 * sky.tod.cur.night;
  const em = (cabin, tops) => { for (const t of tops) { const w = cabin.localToWorld(t.clone()); smoke.emit(w.x, w.y + 0.1, w.z, rr(-0.1, 0.15), rr(0.6, 1.0), rr(-0.1, 0.1), rr(3, 4.4), 0.3, 1.6, g, g, g, 0.28); } };
  townChim = (townChim + 1) % town.houseObjs.length; for (const k of [townChim, (townChim + 5) % town.houseObjs.length]) { const hh = town.houseObjs[k]; if (hh.userData.chimneys && (k % 3 !== 0 || sky.tod.cur.night > 0.3)) em(hh, hh.userData.chimneys.slice(0, 1)); }
  if (dockObj.group.userData.smoke) em(dockObj.cabin, dockObj.cabin.userData.chimneys); if (isleHouse.userData.smoke) em(isleHouse.userData.cabin, isleHouse.userData.chimneys);
}

/* ====================== GÜNCELLEME ====================== */
let todLabel = '', hourSaveT = 12;
function update(dt) {
  updatePlayer(dt); updateCamera(dt); camera.updateMatrixWorld();
  const c = sky.tod.cur, night = c.night;
  fishSys.update(dt, state.time, { focus: cam.target, bobber: (F.st === 'waiting' || F.st === 'bite') ? BP : null, hookY: -0.28, night, diver: S.mode === 'dive' ? dive.D : null });
  updateFishing(dt); updateFx(dt);
  _pp.set(S.x, S.y, S.z); animals.update(dt, state.time, _pp, night);
  town.updateEnter(S.x, S.z); fruitSys.update(dt); town.update(dt, state.time, S, night, say, sky.tod.hour); updateCustomers(dt); updateTalkers(dt); updateFireSim(dt, night); updateChimneys(dt); smoke.update(dt); sparks.update(dt); updateButtons();
  stepTodGoal(dt); sky.apply(dt, state.time, cam.target);
  if (sky.tod.label !== todLabel) { todLabel = sky.tod.label; $('tod').textContent = todLabel; dnLabel(); } hourSaveT -= dt; if (hourSaveT <= 0) { hourSaveT = 12; save.hour = sky.tod.hour; persist(); }
  sound.setNight(night); sound.setUnder(S.mode === 'dive' ? 1 : 0); sound.update(dt); if (S.mode !== 'boat' || B.tier !== 2) sound.setMotor(0);
  const u = water.material.uniforms; u.uTime.value = state.time; u.uHazeD.value = c.fogD * (1 - 0.62 * ALT.k); u.uHaze.value = c.fog;
  { const day = clamp(c.sunI / 3.0, 0, 1); u.uDay.value = day; updateStream(dt, 0.18 + 0.82 * day); CAUSTIC.uCT.value = state.time; CAUSTIC.uCI.value = 0.06 + 0.5 * day; CAUSTIC.uCC.value.copy(c.sunColor); water.userData.follow(camera.position.x, camera.position.z);
    const bl = [{ x: B.x, z: B.z, a: B.a, hl: boat.userData.L * 0.5, hw: boat.userData.hb }]; for (const cu of G.customers) if (cu.state === 'sail' || cu.state === 'out') bl.push({ x: cu.pos.x, z: cu.pos.z, a: cu.a, hl: 1.55, hw: 0.6 }); water.userData.setBoats(bl); }
  dive.atmosphere(dt, c, state.time); CAUSTIC.uCI.value *= 1 + 2.4 * dive.state.k; CAUSTIC.uCC.value.copy(c.sunColor); DIVE_U.uCC.value.copy(c.sunColor);
  M.glass.emissiveIntensity = night * 1.4; M.lantern.emissiveIntensity = 0.3 + night * 2.2; const lg = dockObj.lights; lg.lampLight.intensity = night * 26; lg.doorLight.intensity = night * 14; lg.terraceLight.intensity = night * 10;
  motes.material.uniforms.uNight.value = night; motes.material.uniforms.uC.value.copy(cam.target);
}
const _pp = new V3();


/* ====================== HAZIR + DÖNGÜ ====================== */
function resize() {
  renderer.setSize(innerWidth, innerHeight); fitCamera();
  const rt = water.getRenderTarget(); rt.setSize(clamp(Math.round(innerWidth * pr * REFK), 320, 1700), clamp(Math.round(innerHeight * pr * REFK), 320, 1700)); const sc = innerHeight * pr * 0.6; motes.material.uniforms.uScale.value = sc; smoke.uScale.value = sc * 1.2; sparks.uScale.value = sc * 1.2;
}
addEventListener('resize', resize); resize();
/* Gündüz hiçbir nokta ışığı yanmıyor: ışıkları kapatmak her pikselin ışık döngüsünü kısaltır. İki durum da başta derlenir (takılma olmaz). */
let lightList = [], lightsOn = true, lightScan = 0;
function collectLights() { lightList = []; scene.traverse((o) => { if (o.isPointLight) lightList.push(o); }); }
function setLights(v) { for (const l of lightList) l.visible = v; lightsOn = v; }
function syncLights(dt) {
  lightScan -= dt; if (lightScan < 0) { lightScan = 2; const n = lightList.length; collectLights(); if (lightList.length !== n) setLights(lightsOn); }
  let any = false; for (const l of lightList) if (l.intensity > 0.01) { any = true; break; }
  if (any !== lightsOn) setLights(any);
}
let last = performance.now(), ema = 1 / 60, lowFrames = 0;
// Çözünürlük merdiveni: yalnızca yavaş kareler sürerse, 1x altına hiç inmeden ve gölge/yansıma kalitesine dokunmadan
function degrade() { if (pr > PR_MIN + 0.01) { pr = Math.max(PR_MIN, pr - 0.125); renderer.setPixelRatio(pr); resize(); } lowFrames = 0; ema = 1 / 45; }
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.066, (now - last) / 1000); last = now; if (dt <= 0) return;
  ema += (dt - ema) * 0.04; if (ema > 1 / 36 && state.time > 4) { if (++lowFrames > 100) degrade(); } else lowFrames = Math.max(0, lowFrames - 1);
  state.time += dt; timeU.value = state.time;
  ALT.k = smooth(25, 100, camera.position.y); update(dt); syncLights(dt); if (isMobile) { renderer.shadowMap.needsUpdate = (shadowTick++ & 1) === 0; } post.render(scene, camera);
}
function startGame() {
  if (S.started) return; S.started = true; sound.start(); $('intro').classList.add('off'); document.body.classList.add('playing'); setMode('follow', true);
  cam.tyaw = Math.atan2(-Math.cos(S.face), -Math.sin(S.face)); setTimeout(() => toast('Sürükle: kamera · Sıkıştır: yakınlaştır · Joystick: yürü / kürek · E: bin-in · F: etkileşim', 4600), 600);
  custT = 18; hud();
}
$('start').addEventListener('click', startGame);
hud();
// başlangıç: sinematik arka plan
cam.mode = 'cinema'; Object.assign(cam, { pitch: 0.4, tpitch: 0.4, dist: 58, tdist: 58, lim: MODES.cinema.lim, yaw: 2.4, tyaw: 2.4 }); cam.target.set(ISLAND.x, 1.6, ISLAND.z); cam.ttarget.copy(cam.target);
document.querySelectorAll('#cams button').forEach(b => b.classList.remove('on'));
sky.tod.hour = save.hour; sky.apply(-1, 0, cam.target);
// shader ısınması: sonradan görünecek tekneleri/ateşi önceden derle (oyun içi takılma olmasın)
try { const tmpB = [1, 2].map((t) => { const b = buildBoat(t); b.position.set(0, -200, 0); scene.add(b); return b; }); const wasLit = fireObj.userData.lit; fireObj.userData.lit = true; const hid = []; for (const e of town.enterables) if (e.interior && !e.interior.visible) hid.push(e.interior); hid.forEach((o) => { o.visible = true; });
  collectLights(); setLights(true); renderer.compile(scene, camera); setLights(false); renderer.compile(scene, camera); lightsOn = false; hid.forEach((o) => { o.visible = false; }); dive.warmup(); fireObj.userData.lit = wasLit; tmpB.forEach((b) => scene.remove(b)); } catch (e) { /* önemsiz */ }
$('loading').classList.add('off'); updateStallFish();
requestAnimationFrame(frame);
window.__dbg = {
  dive, startDive, water, terrainH, town, say, updateStallFish, COL,
  run: (n, dt = 0.05) => { for (let i = 0; i < n; i++) { state.time += dt; timeU.value = state.time; update(dt); } }, snap: () => { cam.snap = 2; },
  F, S, B, cam, setMode, startGame, pressAction, releaseAction, fishSys, sky, camera, scene, renderer, castPoint, playerPos, mountAction, splash, save, G, ui, fireS, customers: G.customers, animals, hunt, quests, post, fisherObj: fisher, keys, joy, tele: (x, z) => { S.x = x; S.z = z; S.y = groundAt(x, z); fisher.position.set(S.x, S.y, S.z); }, stream, streamInfo: { w: stream.house.pos, b: stream.bridge.userData.wall && stream.bridge.userData.wall.position }, fruitSys, tpBoat: (x, z, a) => { B.x = x; B.z = z; if (a !== undefined) B.a = a; }, interact, openBasket, spawnCustomer: () => spawnCustomer(), swapBoat, upgradeDock, placeIsleHouse, hud, DOCK, ISL, stall, fisher, boatRef: () => boat, groundAt,
};
