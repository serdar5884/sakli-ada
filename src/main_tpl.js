import * as THREE from 'three';
import { terrainH, lakeD, islandD, isWater, gradOf, DOCK, ISL, ISLAND, toDockLocal, nearDockZone, buildTerrain, buildSky, buildWater, clamp, lerp, smooth } from './world.js';
import { makeMaterials, buildVegetation } from './props.js';
import { buildFisherman, setSeated } from './fisher.js';
import { buildBoat, animateOars, boatGrips } from './boats.js';
import { buildDockHouse, dockGroundY, buildIslandHouse, buildStall, buildFire, updateFire, DOCK_LAYOUTS } from './houses.js';
import { COL } from './collide.js';
import { Animals } from './animals.js';
import { Particles } from './effects.js';
import { buildCustomer, animateCustomer } from './npc.js';
import { FishSystem, SPECIES } from './fish.js';
import { Sound } from './audio.js';
import { createUI, drawFishArt, spById } from './ui.js';
import { BOATS, DEFAULT_OUTFIT, BASKET_MAX } from './data.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 620;
const V3 = THREE.Vector3;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const rr = (a, b) => a + Math.random() * (b - a);

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
let pr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
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
  s.dockLv = clamp(s.dockLv || 1, 1, 3); s.isleLv = clamp(s.isleLv || 1, 1, 3); s.own = s.own || {}; s.outfit = { ...DEFAULT_OUTFIT, ...(s.outfit || {}) }; s.sold = s.sold || 0; return s;
})();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { } };
const sound = new Sound();

/* ====================== DÜNYA ====================== */
const terrain = buildTerrain(); scene.add(terrain);
const sky = buildSky(scene, renderer, isMobile);
const refW = clamp(Math.round(innerWidth * pr * 0.6), 320, 1100), refH = clamp(Math.round(innerHeight * pr * 0.6), 320, 1100);
const water = buildWater(refW, refH, sky.tod, isMobile); scene.add(water);
const M = makeMaterials();
scene.add(DOCK.group);
let dockObj = buildDockHouse(M, save.dockLv);
const veg = buildVegetation(scene, M, timeU, isMobile ? 0.7 : 1);
{ const orig = water.onBeforeRender; water.onBeforeRender = function (...a) { const g = veg.userData.grass; if (g) g.visible = false; orig.apply(this, a); if (g) g.visible = true; }; }
const cabinWorld = new V3(); dockObj.cabin.getWorldPosition(cabinWorld);

/* ada evi, tezgah, ateş */
let isleHouse = null;
function placeIsleHouse(lv) { if (isleHouse) scene.remove(isleHouse); isleHouse = buildIslandHouse(M, lv); scene.add(isleHouse); COL.clearRects('isle'); const c = isleHouse.userData.col; COL.addRect('isle', c.cx, c.cz, c.rot, c.hx, c.hz); }
placeIsleHouse(save.isleLv);
const stall = buildStall(M); stall.position.copy(ISL.stall); stall.position.y += 0.03; stall.rotation.y = ISL.cabinRot; scene.add(stall); stall.updateMatrixWorld(true);
COL.addRect('stall', ISL.stall.x, ISL.stall.z, ISL.cabinRot, 0.7, 1.6);
const fireObj = buildFire(M); fireObj.position.copy(ISL.fire); scene.add(fireObj); COL.addTree(ISL.fire.x, ISL.fire.z, 0.85);
const fireS = { lit: false, burn: 0, slots: [0, 1, 2].map(() => ({ it: null, t: 0, dur: 9, done: false })) };
function placeDockColliders() {
  COL.clearRects('dock'); COL.clearRects('chest'); const L = DOCK.layout; const w = DOCK.group.localToWorld(new V3(L.cabX, 0, 0));
  COL.addRect('dock', w.x, w.z, DOCK.rotY, L.Lx / 2 + 0.15, L.W / 2 + 0.15);
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

//@@FX@@
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

/* ====================== OLTA / DURUM ====================== */
const F = { st: 'idle', power: 0, pdir: 1, castT: 0, launched: false, target: new V3(), p0: new V3(), p1: new V3(), flyT: 0, flyDur: 1, arc: 2, retT: 0, retFrom: new V3(), waitT: 0, attractT: 0, tension: 0, prog: 0, surge: 0, surgeT: 0, surgeLeft: 0, fishPow: 0.5, dist0: 10, dir0: new V3(), hold: false, rodTilt: 0.85, bobDip: 0, tickT: 0, rippleT: 0, thrash: 0, slackT: 0, caught: null, dirAngle: 0, hookTime: 0 };
//@@ROPE@@
const playerPos = () => { fisher.updateWorldMatrix(true, false); return fisher.getWorldPosition(new V3()); };
const camFwd = () => new V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
function castPoint(power) { const o = playerPos(); const d = 5 + power * 21; return o.addScaledVector(camFwd(), d); }
const validCast = (p) => isWater(p.x, p.z, 0.7) && !nearDockZone(p.x, p.z, 0.4);

function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }
function setBobberAt(p) { BP.set(p.x, 0, p.z); }

function pressAction() {
  if (!S.started || cardOpen || ui.isOpen()) return;
  sound.start();
  if (F.st === 'idle' && S.mode === 'swim') { toast('Yüzerken olta atılmaz — kıyıya çık ya da tekneye bin.'); return; }
  switch (F.st) {
    case 'idle': S.rodOut = true; F.st = 'charging'; F.power = 0; F.pdir = 1; aimRing.visible = true; break;
    case 'waiting': retrieve(); break;
    case 'bite': { const f = fishSys.tryHook(); if (f) startFight(f); else { toast('Çok geç!'); } break; }
    case 'fight': F.hold = true; break;
  }
}
function releaseAction() {
  if (F.st === 'charging') { aimRing.visible = false; F.target.copy(castPoint(F.power)); F.st = 'casting'; F.castT = 0; F.launched = false; sound.sfx('cast'); }
  F.hold = false;
}
function retrieve(fast) { fishSys.release(); F.st = 'retrieve'; F.retT = 0; F.retFrom.copy(BP); F.retDur = fast ? 0.35 : 0.8; }
function onNibble() { if (F.st !== 'waiting') return; F.bobDip = 0.9; splash(BP.x, BP.z, 0.25); sound.sfx('nibble'); navigator.vibrate && navigator.vibrate(12); }
function onBite() { if (F.st !== 'waiting') return; F.st = 'bite'; F.bobDip = 2.2; splash(BP.x, BP.z, 0.7); sound.sfx('bite'); toast('Bir balık yedi — ÇEK!', 1400); navigator.vibrate && navigator.vibrate([60, 40, 80]); }
function onMissed() { if (F.st === 'bite') { F.st = 'waiting'; F.bobDip = 0; toast('Kaçırdın… beklemeye devam', 1600); } }
function startFight(f) {
  F.st = 'fight'; F.tension = 0.4; F.prog = 0.2; F.surge = 0; F.surgeT = 1.2; F.surgeLeft = 0; F.hold = true; F.slackT = 0;
  F.fishPow = f.sp.power * (0.75 + 0.5 * f.sizeT); const pp = playerPos(); F.dir0.set(BP.x - pp.x, 0, BP.z - pp.z); F.dist0 = Math.max(6, F.dir0.length()); F.dir0.normalize(); F.hookTime = 0;
  F.fish = f; F.bobDip = 0; toast('Makarayı basılı tutup çevir! Çekerken gerilimi izle.', 2600); navigator.vibrate && navigator.vibrate(40); setMode('bobber', true);
}
let cardOpen = false; let cardFish = null;
const baseValue = (f) => Math.round(f.sp.value * (0.6 + 0.9 * f.sizeT));
function onLanded(f) {
  F.st = 'landed'; bobber.visible = false; lineMesh.visible = false;
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
    case 'follow': { const p = playerPos(); cam.ttarget.set(p.x, p.y + (S.mode === 'swim' ? 0.7 : 1.25), p.z); break; }
    case 'bird': { cam.ttarget.set(0, 0, -2); break; }
    case 'cinema': { cam.ttarget.set(ISLAND.x, 1.6, ISLAND.z); cam.tyaw += dt * 0.05; cam.tpitch = 0.4 + 0.1 * Math.sin(state.time * 0.07); break; }
    case 'reflect': cam.ttarget.set(cabinWorld.x, 1.1, cabinWorld.z); break;
    case 'island': cam.ttarget.set(ISL.cabin.x, ISL.cabin.y + 1.6, ISL.cabin.z); break;
    case 'preview': { const p = playerPos(); cam.ttarget.set(p.x, p.y + (S.mode === 'swim' ? 0.4 : 1.0), p.z); cam.tyaw += dt * 0.4; break; }
    case 'bobber': { if (bobber.visible) cam.ttarget.set(BP.x, 0.35, BP.z); else { const p = playerPos(); cam.ttarget.set(p.x, p.y + 1.25, p.z); } break; }
  }
  cam.tpitch = clamp(cam.tpitch, cam.plim[0], cam.plim[1]); cam.tdist = clamp(cam.tdist, cam.lim[0], cam.lim[1]);
  let k = 1 - Math.exp(-dt * 6), kt = 1 - Math.exp(-dt * (cam.mode === 'follow' || cam.mode === 'preview' ? 10 : 4)); if (cam.snap) { k = kt = 1; cam.snap--; }
  cam.yaw += angDiff(cam.tyaw, cam.yaw) * k; cam.pitch += (cam.tpitch - cam.pitch) * k; cam.dist += (cam.tdist - cam.dist) * k; cam.target.lerp(cam.ttarget, kt);
  const cp = Math.cos(cam.pitch); camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
  const floor = Math.max(terrainH(camera.position.x, camera.position.z) + 0.55, 0.45); if (camera.position.y < floor) camera.position.y = floor;
  camera.position.y += Math.sin(state.time * 0.5) * 0.01; camera.lookAt(cam.target);
  if (window.__photo) { const p = playerPos(), a = S.face + window.__photo.az; camera.position.set(p.x + Math.cos(a) * window.__photo.d, p.y + 1.0 + window.__photo.h, p.z + Math.sin(a) * window.__photo.d); camera.lookAt(p.x, p.y + 0.95, p.z); }
}

/* ====================== GİRDİ ====================== */
const keys = {}; const joy = { x: 0, y: 0, active: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (cardOpen) closeCard(true); else pressAction(); }
  if (e.code === 'KeyE') mountAction();
  if (e.code === 'KeyF') interact();
  if (e.code === 'KeyB') openBasket();
  if (e.code === 'KeyM') ui.isOpen() && $('shop').classList.contains('on') ? ui.closeShop() : ui.openShop();
  if (e.code === 'Escape') { ui.closePanel(); ui.closeShop(); }
  const n = { Digit1: 'follow', Digit2: 'bird', Digit3: 'cinema', Digit4: 'reflect', Digit5: 'island', Digit6: 'bobber' }[e.code]; if (n) setMode(n);
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space' || e.code === 'Enter') releaseAction(); });
const ptrs = new Map(); let pinchD = 0;
canvas.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); pinchD = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) { cam.tyaw -= dx * 0.0058; cam.tpitch += dy * 0.0045; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD) cam.tdist *= pinchD / d; pinchD = d; }
});
const endP = (e) => { ptrs.delete(e.pointerId); pinchD = 0; }; canvas.addEventListener('pointerup', endP); canvas.addEventListener('pointercancel', endP);
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
$('ctx').addEventListener('click', interact);
$('tod').addEventListener('click', () => { sky.tod.target = sky.tod.target === 'day' ? 'dusk' : 'day'; $('tod').textContent = sky.tod.target === 'day' ? 'Gün' : 'Akşam'; sound.sfx('ui'); });
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
function hud() { $('coins').textContent = save.coins; $('bbtn').textContent = `Sepet ${save.inv.length}`; ui.refresh(); }
function openBasket() { if (!S.started) return; sound.start(); ui.open('basket'); }

function swapBoat(tier) {
  const old = boat; const parent = old.parent; scene.remove(old); boat = buildBoat(tier); B.tier = tier; scene.add(boat); boat.position.copy(old.position); boat.rotation.copy(old.rotation);
  if (S.mode === 'boat') { boat.add(fisher); const sd = boat.userData.seat; fisher.position.set(sd.x, sd.y, 0); }
  B.v = 0; collideBoat(true);
}
function upgradeDock(lv) {
  dockObj = buildDockHouse(M, lv); placeDockColliders(); dockObj.cabin.getWorldPosition(cabinWorld);
}

/* ====================== OYUNCU HAREKETİ ====================== */
const Y = new V3(0, 1, 0), _v = new V3(), _col = { x: 0, z: 0, hit: false }, GR = { R: new V3(), L: new V3() };
function inputVec() {
  if (ui.isOpen() || cardOpen) return null;
  let ix = joy.x, iy = joy.y; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1;
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; } if (l < 0.12) return null;
  const f = camFwd(); const right = new V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)); return new V3().addScaledVector(f, iy).addScaledVector(right, ix);
}
function groundAt(x, z) { _v.set(x, 0, z); DOCK.group.worldToLocal(_v); const gy = dockGroundY(_v.x, _v.z); const th = terrainH(x, z); return gy !== null ? Math.max(gy, th) : th; }
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
  if (!S.started || cardOpen) return; if (F.st !== 'idle') { toast('Önce oltayı topla'); return; } if (ui.isOpen()) return;
  const bd = Math.hypot(S.x - B.x, S.z - B.z);
  if (S.mode === 'boat') {
    const spot = findLanding();
    scene.add(fisher); setSeated(fisher, false);
    if (spot) { S.mode = 'foot'; S.x = spot[0]; S.z = spot[1]; S.y = spot[2]; S.face = S.faceT = Math.atan2(spot[1] - B.z, spot[0] - B.x); toast('Karaya çıktın. Keşfet! (F: etkileşim)', 2400); }
    else { S.mode = 'swim'; const a = B.a + Math.PI / 2; S.x = B.x + Math.cos(a) * (boat.userData.hb + 0.9); S.z = B.z + Math.sin(a) * (boat.userData.hb + 0.9); S.y = 0; S.face = S.faceT = a; toast('Suya atladın', 1600); splash(S.x, S.z, 0.8); sound.sfx('splash'); }
    S.rodOut = true; B.v = 0; sound.setMotor(0); setMode('follow', true);
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
function updatePlayer(dt) {
  const iv = inputVec(); const busy = F.st !== 'idle' && F.st !== 'landed';
  if (S.mode === 'foot' || S.mode === 'swim') {
    const sw = S.mode === 'swim'; let spd = 0; S.walkT = 0;
    if (iv && !busy) {
      const m = Math.min(1, iv.length()); const dir = iv.clone().normalize(); const g0 = groundAt(S.x, S.z); const depth = Math.max(0, -terrainH(S.x, S.z));
      spd = sw ? 1.8 * (0.4 + 0.6 * m) : (2.1 + 1.9 * smooth(0.78, 1, m) + (keys.ShiftLeft || keys.ShiftRight ? 1.3 : 0)) * (0.35 + 0.65 * m) * (1 - 0.4 * clamp(depth / 0.9, 0, 1));
      let nx = S.x + dir.x * spd * dt, nz = S.z + dir.z * spd * dt;
      if (!sw) { COL.push(nx, nz, 0.33, _col); nx = _col.x; nz = _col.z; } else { COL.push(nx, nz, 0.4, _col); nx = _col.x; nz = _col.z; }
      const g1 = groundAt(nx, nz); const r = Math.hypot(nx, nz);
      if (r > 150) { nx *= 150 / r; nz *= 150 / r; }
      if (!(g1 - g0 > 0.95 && !sw && g1 > 0.9)) { S.x = nx; S.z = nz; }
      S.faceT = Math.atan2(dir.z, dir.x); S.walkT = Math.min(1, m); S.run = spd > 3.6; S.swimSpd = sw ? m : 0;
      wadeT -= dt; if (depth > 0.12 && !sw && wadeT <= 0) { wadeT = 0.38; water.userData.addRipple(S.x, S.z, state.time, 0.18); sound.sfx('wade'); }
      if (sw) { wadeT -= dt; if (wadeT <= 0) { wadeT = 0.45; water.userData.addRipple(S.x, S.z, state.time, 0.28); } }
    } else S.swimSpd = 0;
    const g = groundAt(S.x, S.z);
    if (!sw && g < -0.95) { S.mode = 'swim'; sound.sfx('splash'); splash(S.x, S.z, 0.5); toast('Yüzüyorsun — kıyıya dönmek için geri yürü', 1800); setSeated(fisher, false); }
    else if (sw && g > -0.55) { S.mode = 'foot'; toast('Kıyıdasın', 1200); }
    if (S.mode === 'swim') S.y += (0 - S.y) * Math.min(1, dt * 6); else S.y += (g - S.y) * Math.min(1, dt * 14);
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
  S.face += angDiff(S.faceT, S.face) * (1 - Math.exp(-dt * 8));
  fisher.rotation.y = S.mode === 'boat' ? -S.face + B.a : -S.face;
}

/* ---- bağlamsal etkileşim butonları ---- */
const standWorld = (k) => stall.localToWorld(stall.userData.stands[k].clone());
function nearestInteract() {
  if (S.mode !== 'foot') return null; let best = null, bd = 1e9;
  const sp = standWorld('customer'); let d = Math.hypot(S.x - sp.x, S.z - sp.z); if (d < 3.6 && d < bd) { bd = d; best = { k: 'stall', label: 'Tezgah' }; }
  d = Math.hypot(S.x - ISL.fire.x, S.z - ISL.fire.z); if (d < 3.1 && d < bd) { bd = d; best = { k: 'fire', label: fireS.lit ? 'Ateş / Pişir' : 'Ateşi Yak' }; }
  const cw = chestWorld(); d = Math.hypot(S.x - cw.x, S.z - cw.z); if (d < 2.6 && d < bd) { bd = d; best = { k: 'chest', label: 'Toptancı Sandığı' }; }
  return best;
}
let ctxT = null;
function interact() {
  if (!S.started || cardOpen) return; if (ui.isOpen()) return; const t = nearestInteract(); if (!t) return; sound.start();
  if (t.k === 'fire' && !fireS.lit) { G.lightFire(); ui.open('fire'); } else ui.open(t.k === 'chest' ? 'chest' : t.k === 'fire' ? 'fire' : 'stall');
}
function updateButtons() {
  // mount
  let lab = null; const bd = Math.hypot(S.x - B.x, S.z - B.z);
  if (S.mode === 'boat') lab = findLanding() ? 'Karaya Çık' : 'Suya Atla';
  else lab = bd < boat.userData.L / 2 + 3.4 ? 'Tekneye Bin' : bd > 9 ? 'Tekneyi Çağır' : null;
  const mb = $('mount'); if (mb.dataset.l !== String(lab)) { mb.dataset.l = String(lab); mb.textContent = lab || ''; mb.classList.toggle('on', !!lab); }
  mb.classList.toggle('dim', F.st !== 'idle');
  const t = nearestInteract(); const cb = $('ctx'); const key = t ? t.k + t.label : ''; if (cb.dataset.l !== key) { cb.dataset.l = key; cb.textContent = t ? t.label : ''; cb.classList.toggle('on', !!t); }
}

//@@FISHING@@

//@@WORLDSIM@@

/* ====================== HAZIR + DÖNGÜ ====================== */
function resize() {
  renderer.setSize(innerWidth, innerHeight); fitCamera();
  const rt = water.getRenderTarget(); rt.setSize(clamp(Math.round(innerWidth * pr * 0.6), 320, 1100), clamp(Math.round(innerHeight * pr * 0.6), 320, 1100)); const sc = innerHeight * pr * 0.6; motes.material.uniforms.uScale.value = sc; smoke.uScale.value = sc * 1.2; sparks.uScale.value = sc * 1.2;
}
addEventListener('resize', resize); resize();
let last = performance.now(), ema = 1 / 60, lowFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (dt <= 0) return; state.time += dt; timeU.value = state.time;
  ema += (dt - ema) * 0.05; if (ema > 1 / 27 && state.time > 4) { if (++lowFrames > 90 && pr > 0.8) { pr = Math.max(0.75, pr - 0.25); renderer.setPixelRatio(pr); resize(); lowFrames = 0; ema = 1 / 45; } } else lowFrames = Math.max(0, lowFrames - 1);
  update(dt); renderer.render(scene, camera);
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
sky.apply(-1, 0, cam.target);
$('loading').classList.add('off');
requestAnimationFrame(frame);
window.__dbg = {
  run: (n, dt = 0.05) => { for (let i = 0; i < n; i++) { state.time += dt; timeU.value = state.time; update(dt); } }, snap: () => { cam.snap = 2; },
  F, S, B, cam, setMode, startGame, pressAction, releaseAction, fishSys, sky, camera, scene, renderer, castPoint, playerPos, mountAction, splash, save, G, ui, fireS, customers: G.customers, animals, keys, joy, tele: (x, z) => { S.x = x; S.z = z; S.y = groundAt(x, z); fisher.position.set(S.x, S.y, S.z); }, tpBoat: (x, z, a) => { B.x = x; B.z = z; if (a !== undefined) B.a = a; }, interact, openBasket, spawnCustomer: () => spawnCustomer(), swapBoat, upgradeDock, placeIsleHouse, hud, DOCK, ISL, stall, fisher, boatRef: () => boat, groundAt,
};
