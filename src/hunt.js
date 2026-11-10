import * as THREE from 'three';
import { COL } from './collide.js';
const V3 = THREE.Vector3;
const SPEED = 34, GRAV = 7.5, DRAW = 0.38, COOL = 0.5, MAXR = 85;
const NAMES = { tavsan: 'Tavşan', ordek: 'Yaban Ördeği', ceylan: 'Ceylan', geyik: 'Geyik' };
/** Yay ile avlanma: çek (0.38 sn) → ok uçar → hayvana isabet / yere saplanır */
export function createHunt({ scene, camera, animals, terrainH, hooks }) {
  const shaft = new THREE.CylinderGeometry(0.01, 0.01, 0.8, 5); shaft.rotateZ(Math.PI / 2); shaft.translate(0.4, 0, 0);
  const headG = new THREE.ConeGeometry(0.026, 0.09, 5); headG.rotateZ(-Math.PI / 2); headG.translate(0.84, 0, 0);
  const fletG = new THREE.BoxGeometry(0.1, 0.05, 0.004); fletG.translate(0.08, 0, 0);
  const mShaft = new THREE.MeshStandardMaterial({ color: '#c9a56a', roughness: 1 }), mHead = new THREE.MeshStandardMaterial({ color: '#8e8e92', metalness: 0.4, roughness: 0.6 }), mFlet = new THREE.MeshStandardMaterial({ color: '#e6eadc', roughness: 1, side: THREE.DoubleSide });
  const mkArrow = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(shaft, mShaft), new THREE.Mesh(headG, mHead)); for (const a of [0, 2.1, 4.2]) { const f = new THREE.Mesh(fletG, mFlet); f.rotation.x = a; g.add(f); } g.traverse(o => { o.castShadow = false; }); return g; };
  const arrows = []; const X = new V3(1, 0, 0);
  const H = { on: false, state: 'ready', t: 0, draw: 0, nocked: false, target: null, shots: 0, NAMES };
  const cp = new V3(), cd = new V3(), o = new V3(), dir = new V3(), tp = new V3(), p0 = new V3();
  function aim() { camera.getWorldPosition(cp); camera.getWorldDirection(cd); }
  H.setOn = (v) => { H.on = v; H.state = 'ready'; H.t = 0; H.draw = 0; H.nocked = false; H.target = null; };
  H.press = () => { if (!H.on || H.state !== 'ready') return false; H.state = 'draw'; H.t = 0; H.nocked = true; hooks.sfx && hooks.sfx('bowdraw'); return true; };
  function release() {
    aim(); const tg = animals.aimAt(cp, cd); hooks.origin(o);
    if (tg) { const d = Math.hypot(tg.x - o.x, tg.y - o.y, tg.z - o.z); const t = d / SPEED; const sp = tg.o.dead ? 0 : (tg.o.spd !== undefined ? tg.o.spd : (tg.o.st === 'fly' ? 6.5 : 0.5)); const a = tg.o.a || 0; const drop = 0.5 * GRAV * t * t;
      tp.set(tg.x + Math.cos(a) * sp * t * 0.85, tg.y + drop * 0.9, tg.z + Math.sin(a) * sp * t * 0.85); }
    else tp.copy(cp).addScaledVector(cd, 60).y += 1.6;
    dir.copy(tp).sub(o).normalize(); hooks.face && hooks.face(Math.atan2(dir.z, dir.x));
    const m = mkArrow(); scene.add(m); const ar = { m, p: o.clone().addScaledVector(dir, 0.6), v: dir.clone().multiplyScalar(SPEED), life: 0, stuck: 0, dist: 0 };
    m.position.copy(ar.p); m.quaternion.setFromUnitVectors(X, dir); arrows.push(ar); H.shots++; animals.lastShooter.copy(o); hooks.sfx && hooks.sfx('bowshot');
  }
  H.update = (dt) => {
    if (H.on) {
      aim(); const tg = animals.aimAt(cp, cd); H.target = tg ? tg.kind : null;
      if (H.state === 'draw') { H.t += dt / DRAW; H.draw = Math.min(1, H.t); if (H.t >= 1) { release(); H.state = 'cool'; H.t = 0; H.draw = 0; H.nocked = false; } }
      else if (H.state === 'cool') { H.t += dt / COOL; H.draw = 0; if (H.t >= 1) { H.state = 'ready'; H.t = 0; } }
    }
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i]; a.life += dt;
      if (a.stuck) { a.stuck += dt; if (a.stuck > 6) { scene.remove(a.m); arrows.splice(i, 1); } else if (a.stuck > 5) a.m.scale.setScalar(Math.max(0.01, 6 - a.stuck)); continue; }
      p0.copy(a.p); a.v.y -= GRAV * dt; a.p.addScaledVector(a.v, dt); a.dist += a.v.length() * dt;
      const h = animals.raycast(p0, a.p, 0.05);
      if (h) { const killed = animals.hit(h); hooks.hit && hooks.hit(h.kind, killed, h); scene.remove(a.m); arrows.splice(i, 1); continue; }
      const gy = terrainH(a.p.x, a.p.z);
      if (a.p.y <= gy + 0.02) { if (gy < -0.1) { hooks.splash && hooks.splash(a.p.x, a.p.z, 0.3); scene.remove(a.m); arrows.splice(i, 1); } else { a.p.y = gy + 0.05; a.stuck = 0.001; a.m.position.copy(a.p); a.v.set(0, 0, 0); } continue; }
      if (a.p.y < 3.2 && COL.blocked(a.p.x, a.p.z, 0.08)) { a.stuck = 0.001; a.v.set(0, 0, 0); a.m.position.copy(a.p); continue; }
      if (a.dist > MAXR || a.life > 5) { scene.remove(a.m); arrows.splice(i, 1); continue; }
      a.m.position.copy(a.p); dir.copy(a.v).normalize(); a.m.quaternion.setFromUnitVectors(X, dir);
    }
  };
  return H;
}
