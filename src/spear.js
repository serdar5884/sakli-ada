import * as THREE from 'three';
import { clamp, lerp } from './world.js';
import { V3, Q4, C3, bare, tint, piece, patchDiveMaterial } from './diveutil.js';

/**
 *  ZIPKIN (spearfishing) — su altında gerçek göl balıklarını (FishSystem) avlar.
 *  createSpearSystem({ scene, camera, diver, fishSys, terrainH, bubbles, hooks:{ sfx, splash, toast, landed(f), hit(f), miss(), escape(f) } })
 *   .fire(D)        zıpkını ateşler (hazırsa)
 *   .update(dt, t, D, active)   D: dalgıç durumu (x,y,z,yaw)
 *   .state          'ready' | 'flying' | 'reeling' | 'reload'
 *   .target         nişan yardımı hedefi (balık | null)
 *   .reset()
 */
const SPEED = 27, RANGE = 12.5, REEL = 8.5, RELOAD = 1.0;
const UP = new V3(0, 1, 0);

function makeGun() {
  const g = new THREE.Group(); g.name = 'speargun';
  const steel = new THREE.MeshStandardMaterial({ color: '#c9d1d8', metalness: 0.85, roughness: 0.3 }), dark = new THREE.MeshStandardMaterial({ color: '#1d2228', roughness: 0.7 }), wood = new THREE.MeshStandardMaterial({ color: '#8a5a2f', roughness: 0.65 }), band = new THREE.MeshStandardMaterial({ color: '#d84a2a', roughness: 0.5 });
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  m(new THREE.BoxGeometry(0.34, 0.075, 0.055), wood, 0.0, 0, 0);                                     // dipçik
  m(new THREE.BoxGeometry(0.05, 0.13, 0.04), dark, -0.04, -0.09, 0);                                // tabanca kabzası
  const bar = m(new THREE.CylinderGeometry(0.016, 0.016, 0.95, 8).rotateZ(Math.PI / 2), steel, 0.55, 0.045, 0);   // namlu
  m(new THREE.BoxGeometry(0.1, 0.05, 0.065), dark, 0.2, 0.0, 0);
  m(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5).rotateZ(Math.PI / 2), band, 0.42, 0.015, 0.055); m(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5).rotateZ(Math.PI / 2), band, 0.42, 0.015, -0.055);
  const muzzle = new THREE.Object3D(); muzzle.position.set(1.02, 0.045, 0); g.add(muzzle);
  // takılı zıpkın
  const loaded = new THREE.Group(); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1.05, 6).rotateZ(Math.PI / 2), steel); rod.position.set(0.55, 0.05, 0); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4).rotateZ(-Math.PI / 2), steel); tip.position.set(1.1, 0.05, 0); loaded.add(rod, tip); g.add(loaded);
  return { group: g, muzzle, loaded };
}
function makeSpearMesh() {
  const steel = new THREE.MeshStandardMaterial({ color: '#dfe6ec', metalness: 0.9, roughness: 0.25, emissive: '#6f8a99', emissiveIntensity: 0.35 });
  const g = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6).rotateZ(Math.PI / 2), steel); shaft.position.x = -0.5;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.16, 4).rotateZ(-Math.PI / 2), steel); tip.position.x = 0.08;
  const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 3).rotateZ(Math.PI / 2 + 0.5), steel); b1.position.set(-0.04, 0.03, 0); const b2 = b1.clone(); b2.rotation.x = Math.PI; b2.position.set(-0.04, -0.03, 0);
  g.add(shaft, tip, b1, b2); g.traverse((o) => { o.frustumCulled = false; }); return g;   // +X: uç
}

export function createSpearSystem({ scene, camera, diver, fishSys, terrainH, bubbles, hooks = {} }) {
  const gun = makeGun(); gun.group.position.set(0.5, -0.1, 0.14); gun.group.rotation.y = 0; diver.body.add(gun.group);
  const spear = makeSpearMesh(); spear.visible = false; scene.add(spear);
  const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 4), new THREE.MeshBasicMaterial({ color: '#efe9d2', transparent: true, opacity: 0.85 })); tether.visible = false; tether.frustumCulled = false; scene.add(tether);
  const S = { state: 'ready', t: 0, pos: new V3(), prev: new V3(), vel: new V3(), dist: 0, fish: null, breakAt: 0, reelT: 0, target: null, cool: 0, shots: 0, hits: 0 };
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _m = new V3(), _fw = new V3(), _q = new Q4();
  const live = (f) => (f.state === 'swim' || f.state === 'flee') && f.pos.y < -0.25;
  const fishLen = (f) => 0.62 * f.scale;                       // yarı uzunluk
  const fishR = (f) => 0.1 + 0.19 * f.scale * (f.sp.h || 1) * (f.sp.wd || 1) ** 0.5;

  /** nişan: kameranın bakış ışınına en yakın canlı balık */
  function findTarget(maxD = RANGE + 5) {
    camera.getWorldDirection(_fw); const cp = camera.position; let best = null, bs = 1e9;
    for (const f of fishSys.fish) {
      if (!live(f)) continue; _a.set(f.pos.x, f.pos.y, f.pos.z).sub(cp); const t = _a.dot(_fw); if (t < 1 || t > maxD) continue; const d = _b.copy(_a).addScaledVector(_fw, -t).length();
      const tol = 0.45 + f.scale * 0.5 + t * 0.055; if (d > tol) continue; const sc = d / tol + t * 0.01; if (sc < bs) { bs = sc; best = f; }
    }
    return best;
  }
  function muzzleWorld(out) { diver.group.updateMatrixWorld(true); return gun.muzzle.getWorldPosition(out); }

  S.fire = (D) => {
    if (S.state !== 'ready') return false;
    muzzleWorld(_m); camera.getWorldDirection(_fw);
    const tg = findTarget(); let aim = _c.copy(camera.position).addScaledVector(_fw, 22);
    if (tg) { const dist = _a.set(tg.pos.x, tg.pos.y, tg.pos.z).distanceTo(_m); const ft = dist / SPEED * 0.85; const sp = tg.speed || 0.6; aim = _c.set(tg.pos.x + Math.cos(tg.a) * sp * ft, tg.pos.y, tg.pos.z + Math.sin(tg.a) * sp * ft); }
    S.vel.copy(aim).sub(_m).normalize().multiplyScalar(SPEED);
    // namlu arkada kalırsa (kamera çok geride) dalgıcın önüne zorla
    S.pos.copy(_m); S.prev.copy(_m); S.dist = 0; S.state = 'flying'; S.t = 0; S.fish = null; S.shots++;
    spear.visible = true; tether.visible = true; gun.loaded.visible = false; hooks.sfx && hooks.sfx('cast'); bubbles && bubbles.emit(_m.x, _m.y, _m.z, 7, 0.04, 0.2);
    return true;
  };

  function aimSpear() { _a.copy(S.vel).normalize(); _q.setFromUnitVectors(new V3(1, 0, 0), _a); spear.quaternion.copy(_q); spear.position.copy(S.pos); }
  function drawTether() { muzzleWorld(_m); _a.copy(S.pos).sub(_m); const len = _a.length(); if (len < 0.01) { tether.visible = false; return; } tether.visible = true; tether.position.copy(_m).addScaledVector(_a, 0.5); tether.quaternion.setFromUnitVectors(UP, _a.multiplyScalar(1 / len)); tether.scale.set(1, len, 1); }

  S.update = (dt, t, D, active) => {
    dt = Math.min(dt, 0.05);
    // hedef (yalnız hazırken gösterilir)
    S.target = active && (S.state === 'ready') ? findTarget() : null;
    gun.loaded.visible = S.state === 'ready' || (S.state === 'reload' && S.cool < 0.35);
    if (S.state === 'reload') { gun.loaded.scale.setScalar(clamp(1 - S.cool / 0.35, 0.05, 1)); }
    if (S.state === 'ready') gun.loaded.scale.setScalar(1);
    if (!active && S.state !== 'ready') S.reset();
    if (S.state === 'flying') {
      S.t += dt; const step = S.vel.length() * dt; S.prev.copy(S.pos); S.pos.addScaledVector(S.vel, dt); S.dist += step; S.vel.multiplyScalar(Math.exp(-0.08 * dt));
      aimSpear(); drawTether(); if (Math.random() < 0.7) bubbles && bubbles.emit(S.pos.x, S.pos.y, S.pos.z, 1, 0.025, 0.04);
      // balık çarpışması (çizgi parçası ↔ gövde kapsülü)
      let hitF = null, hb = 1e9;
      for (const f of fishSys.fish) {
        if (!live(f)) continue; const hl = fishLen(f), R = fishR(f) + 0.06; const hx = Math.cos(f.a) * hl, hz = Math.sin(f.a) * hl;
        // segment-segment en yakın nokta (yaklaşık: örnekleme)
        for (let k = 0; k <= 4; k++) { const u = k / 4; _a.lerpVectors(S.prev, S.pos, u); for (let j = -1; j <= 1; j++) { const px = f.pos.x + hx * j, pz = f.pos.z + hz * j; const d = Math.hypot(_a.x - px, _a.y - f.pos.y, _a.z - pz); if (d < R && u < hb) { hb = u; hitF = f; } } }
      }
      if (hitF) {
        const f = hitF; S.fish = f; S.hits++; f.state = 'speared'; f.spearT = 0; S.state = 'reeling'; S.reelT = 0; S.vel.normalize();
        const str = f.sp.power * (0.75 + 0.5 * f.sizeT); const chance = clamp((str - 0.6) * 1.9, 0, 0.78); const dist = _a.set(f.pos.x, f.pos.y, f.pos.z).distanceTo(muzzleWorld(_m));
        S.breakAt = Math.random() < chance ? 0.35 + Math.random() * Math.min(1.4, dist / REEL * 0.85) : 1e9;
        hooks.sfx && hooks.sfx('bite'); hooks.splash && hooks.splash(f.pos.x, f.pos.z, 0.25); bubbles && bubbles.emit(f.pos.x, f.pos.y, f.pos.z, 12, 0.05, 0.3); hooks.hit && hooks.hit(f);
      } else {
        const bed = terrainH(S.pos.x, S.pos.z);
        if (S.pos.y < bed + 0.04 || S.pos.y > -0.05 || (hooks.blocked && hooks.blocked(S.pos.x, S.pos.y, S.pos.z)) || S.dist > RANGE || (S.t > 0.25 && S.pos.distanceTo(muzzleWorld(_m)) > RANGE + 1)) { S.state = 'reeling'; S.fish = null; S.reelT = 0; if (S.pos.y < bed + 0.1) bubbles && bubbles.emit(S.pos.x, S.pos.y + 0.05, S.pos.z, 8, 0.05, 0.25); hooks.miss && hooks.miss(); }
      }
    } else if (S.state === 'reeling') {
      S.reelT += dt; muzzleWorld(_m); const f = S.fish; const speed = f ? REEL * (0.65 + 0.35 * Math.min(1, S.reelT * 1.4)) / (1 + 0.5 * (f.sizeT * f.sp.power)) : 26;
      _a.copy(_m).sub(S.pos); const dist = _a.length();
      if (f && S.reelT > S.breakAt) { // kurtuldu
        f.state = 'flee'; f.timer = 3.5; f.speed = 3.4; f.a = Math.atan2(S.pos.z - _m.z, S.pos.x - _m.x) + (Math.random() - 0.5) * 1.2; f.pitch.rotation.x = 0; S.fish = null; bubbles && bubbles.emit(S.pos.x, S.pos.y, S.pos.z, 10, 0.05, 0.3); hooks.sfx && hooks.sfx('splash'); hooks.escape && hooks.escape(f);
      } else if (dist < (f ? 1.0 : 0.45)) {
        if (f) { S.fish = null; f.state = 'held'; hooks.landed && hooks.landed(f); }
        S.state = 'reload'; S.cool = RELOAD; spear.visible = false; tether.visible = false; gun.loaded.visible = false;
      } else {
        S.pos.addScaledVector(_a, speed * dt / dist); S.vel.copy(_a).normalize().multiplyScalar(-1); // uç gerideki yöne bakar → mızrak ucu balığa dönük kalır
        if (f) {
          // balık mızrağın ucunda çırpınır; vücut ekseni çekiş yönüne uyar
          f.pos.set(S.pos.x, S.pos.y, S.pos.z); f.a = Math.atan2(S.vel.z, S.vel.x); f.spearT += dt;
        }
        _a.copy(S.vel); _q.setFromUnitVectors(new V3(1, 0, 0), _a); spear.quaternion.copy(_q); spear.position.copy(S.pos);
        if (f) { f.pos.addScaledVector(_a, 0.0); }
        drawTether(); if (f && Math.random() < 0.5) bubbles && bubbles.emit(S.pos.x, S.pos.y, S.pos.z, 1, 0.03, 0.1);
      }
    } else if (S.state === 'reload') {
      S.cool -= dt; if (S.cool <= 0) { S.state = 'ready'; hooks.sfx && hooks.sfx('ui'); }
    }
  };
  S.reset = () => { if (S.fish && S.fish.state === 'speared') { S.fish.state = 'swim'; S.fish.speed = 0.8; } S.fish = null; S.state = 'ready'; spear.visible = false; tether.visible = false; gun.loaded.visible = true; gun.loaded.scale.setScalar(1); S.target = null; };
  S.gun = gun; S.spearMesh = spear; S.tether = tether;
  return S;
}
