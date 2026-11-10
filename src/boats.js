import * as THREE from 'three';
import { box, cyl } from './props.js';

const CFG = [
  { L: 3.5, hb: 0.68, depth: 0.36, outer: '#4c7f86', inner: '#c9a577', rail: '#d9c49a', oarLen: 2.5, lockX: 0.3, lockZ: 0.62, grip: 0.4, seatX: 0.05, seats: [0.3, -0.95, 1.15], blade: '#e0d2b0' },
  { L: 4.6, hb: 0.88, depth: 0.42, outer: '#8e3b2c', inner: '#d6b98a', rail: '#ecdcb4', oarLen: 3.1, lockX: 0.35, lockZ: 0.8, grip: 0.46, seatX: 0.05, seats: [0.35, -1.2, 1.5], blade: '#f0e6c8' },
  { L: 5.8, hb: 1.08, depth: 0.5, outer: '#27506e', inner: '#e4dccb', rail: '#f2f0ea', oarLen: 0, lockX: 0, lockZ: 0, grip: 0, seatX: -1.45, seats: [-1.45, 0.25], blade: '#fff' },
];
export function buildBoat(tier = 0) {
  const c = CFG[tier]; const root = new THREE.Group(); const hull = new THREE.Group(); root.add(hull);
  const { L, hb } = c; const N = 19, MM = 9; const pts = [];
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1; const x = u * L / 2; const wmul = u > 0 ? Math.pow(1 - Math.pow(u, 2.3), 0.65) : Math.pow(1 - Math.pow(-u, tier === 2 ? 6 : 3.2), 0.5) * (tier === 2 ? 1.0 : 0.98); const w = hb * Math.max(wmul, 0.02);
    const sheer = 0.05 + 0.22 * u * u * (u > 0 ? 1.15 : 0.6); const depth = c.depth * (1 - 0.55 * u * u);
    const row = []; for (let j = 0; j < MM; j++) { const a = (j / (MM - 1)) * 2 - 1; const zz = Math.sign(a) * Math.abs(a) * w; const yy = sheer - depth * (1 - Math.pow(Math.abs(a), 2.4)); row.push(new THREE.Vector3(x, yy, zz)); }
    pts.push(row);
  }
  const pos = [], idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < MM; j++) { const p = pts[i][j]; pos.push(p.x, p.y, p.z); }
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < MM - 1; j++) { const a = i * MM + j, b = (i + 1) * MM + j, cc = (i + 1) * MM + j + 1, d = i * MM + j + 1; idx.push(a, d, b, b, d, cc); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c.outer, roughness: 0.7 })); outer.castShadow = true;
  const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c.inner, roughness: 0.9, side: THREE.BackSide })); inner.receiveShadow = true;
  hull.add(outer, inner);
  const railMat = new THREE.MeshStandardMaterial({ color: c.rail, roughness: 0.8 });
  for (const s of [1, -1]) { const cp = []; for (let i = 0; i < N; i++) { const p = pts[i][s > 0 ? MM - 1 : 0]; cp.push(new THREE.Vector3(p.x, p.y + 0.01, p.z)); } const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 48, tier ? 0.045 : 0.035, 6), railMat); tube.castShadow = true; hull.add(tube); }
  // su hattı şeridi (kıç-baş boyunca boya)
  if (tier >= 1) { const bandMat = new THREE.MeshStandardMaterial({ color: tier === 1 ? '#efe6cf' : '#f4f2ec', roughness: 0.7, side: THREE.DoubleSide }); for (const s of [1, -1]) { const cp = []; for (let i = 1; i < N - 1; i++) { const p = pts[i][s > 0 ? MM - 2 : 1]; cp.push(new THREE.Vector3(p.x, p.y - 0.02, p.z * 1.02)); } hull.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 40, 0.028, 5), bandMat)); } }
  const seatMat = new THREE.MeshStandardMaterial({ color: tier === 2 ? '#d8d0bd' : '#a98557', roughness: 0.9 });
  for (const x of c.seats) { const t = x / (L / 2); const wm = t > 0 ? Math.pow(1 - Math.pow(t, 2.3), 0.65) : Math.pow(1 - Math.pow(-t, tier === 2 ? 6 : 3.2), 0.5); const w = hb * Math.max(0.2, wm); hull.add(box(tier === 2 ? 0.5 : 0.34, 0.05, w * 2 * 0.96, seatMat, x, -0.07, 0)); }
  hull.add(box(L * 0.62, 0.03, hb * 0.9, seatMat, 0, tier === 2 ? -0.24 : -0.3, 0, false));
  const ud = { hull, oars: [], L, hb, tier, seat: { x: c.seatX, y: -0.84 }, grip: c.grip, seatTop: -0.045, tiller: null, lap: new THREE.Vector3(c.seatX + 0.4, 0.02, -0.18), prop: null, speedRef: 1 };
  // kürekler
  if (tier < 2) {
    for (const s of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(c.lockX, 0.2, s * c.lockZ); hull.add(piv);
      const shaft = cyl(0.026, 0.026, c.oarLen, seatMat, 6); shaft.rotation.x = Math.PI / 2; shaft.position.z = s * (c.oarLen / 2 - c.grip - 0.1); piv.add(shaft);
      piv.add(box(0.36, 0.015, 0.54, new THREE.MeshStandardMaterial({ color: c.blade, roughness: 0.8 }), 0, 0, s * (c.oarLen - c.grip - 0.35)));
      const grip = cyl(0.036, 0.036, 0.3, new THREE.MeshStandardMaterial({ color: '#3a2a1a' }), 6); grip.rotation.x = Math.PI / 2; grip.position.z = -s * c.grip; piv.add(grip);
      piv.add(box(0.07, 0.03, 0.12, new THREE.MeshStandardMaterial({ color: '#2d2d2d' }), 0, 0.0, s * 0.05));
      ud.oars.push({ piv, s });
      hull.add(box(0.06, 0.16, 0.06, new THREE.MeshStandardMaterial({ color: '#333' }), c.lockX, 0.13, s * c.lockZ));
    }
  } else {
    // motorlu tekne: konsol, ön cam, dıştan motor, yönlendirme kolu
    const white = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.6 }), darkM = new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.5, metalness: 0.2 });
    hull.add(box(0.5, 0.5, 1.5, white, 0.35, 0.08, 0)); hull.add(box(0.52, 0.06, 1.54, darkM, 0.35, 0.35, 0));
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 1.5), new THREE.MeshStandardMaterial({ color: '#a9d6e0', roughness: 0.1, transparent: true, opacity: 0.42 })); ws.position.set(0.6, 0.62, 0); ws.rotation.z = -0.28; hull.add(ws);
    for (const s of [1, -1]) hull.add(box(0.05, 0.62, 0.05, darkM, 0.6 - 0.09, 0.6, s * 0.75));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 5, 14), darkM); wheel.position.set(0.12, 0.5, 0); wheel.rotation.y = Math.PI / 2 - 0.5; hull.add(wheel);
    const mx = -L / 2 - 0.05;
    const motor = new THREE.Group(); motor.position.set(mx, 0, 0); hull.add(motor);
    motor.add(box(0.2, 0.2, 0.5, darkM, 0.05, 0.12, 0)); const cowl = box(0.4, 0.46, 0.34, new THREE.MeshStandardMaterial({ color: '#d7d9db', roughness: 0.4, metalness: 0.2 }), -0.2, 0.36, 0); motor.add(cowl); motor.add(box(0.42, 0.1, 0.36, new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 }), -0.2, 0.62, 0));
    const leg = cyl(0.06, 0.07, 0.95, darkM, 6); leg.position.set(-0.2, -0.28, 0); motor.add(leg); const gb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 3, 7), darkM); gb.rotation.z = Math.PI / 2; gb.position.set(-0.22, -0.72, 0); motor.add(gb);
    const prop = new THREE.Group(); prop.position.set(-0.46, -0.72, 0); motor.add(prop); for (let i = 0; i < 3; i++) { const bl = box(0.01, 0.24, 0.06, white, 0, 0.12, 0, false); const pg = new THREE.Group(); pg.rotation.x = i * Math.PI * 2 / 3; pg.add(bl); prop.add(pg); } ud.prop = prop;
    ud.motor = motor;
    const tiller = new THREE.Group(); tiller.position.set(mx - 0.18, 0.42, 0); hull.add(tiller);
    const tl = cyl(0.022, 0.018, 1.55, darkM, 5); tl.rotation.z = Math.PI / 2; tl.position.set(0.77, 0, 0.14); tl.rotation.y = -0.18; tiller.add(tl);
    const grip = new THREE.Object3D(); grip.position.set(1.52, 0, 0.28); tiller.add(grip); const gm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), new THREE.MeshStandardMaterial({ color: '#111' })); gm.rotation.x = Math.PI / 2; gm.position.copy(grip.position); tiller.add(gm);
    ud.tiller = tiller; ud.tillerGrip = grip;
    // dümen feneri / bayrak
    hull.add(box(0.03, 1.3, 0.03, darkM, -L / 2 + 0.25, 0.65, 0.5)); const flag = box(0.02, 0.22, 0.34, new THREE.MeshStandardMaterial({ color: '#d9443a' }), -L / 2 + 0.25, 1.2, 0.68, false); hull.add(flag);
    // yan şamandıra
    for (const s of [1, -1]) hull.add(box(1.0, 0.1, 0.1, new THREE.MeshStandardMaterial({ color: '#d9443a' }), 0.4, 0.2, s * (hb * 0.97)));
  }
  root.userData = ud;
  return root;
}
export function animateOars(boat, phase, amt) {
  for (const { piv, s } of boat.userData.oars) {
    const sw = Math.sin(phase) * 0.5 * amt; const lift = Math.cos(phase) * 0.35 * amt;
    piv.rotation.y = s * sw; piv.rotation.x = s * (0.17 - Math.max(0, lift) * 0.55 + (amt < 0.05 ? 0.12 : 0));
  }
}
const _v = new THREE.Vector3();
/** ellerin tutacağı noktalar (dünya) — sağ el: R, sol el: L */
export function boatGrips(boat, out, steer = 0) {
  const ud = boat.userData; boat.updateWorldMatrix(true, true);
  if (ud.oars.length) {
    for (const { piv, s } of ud.oars) { _v.set(0, 0, -s * ud.grip); piv.localToWorld(_v); (s > 0 ? out.R : out.L).copy(_v); }
  } else {
    ud.tiller.rotation.y = -steer * 0.5; ud.tiller.updateWorldMatrix(true, true); ud.tillerGrip.getWorldPosition(out.R);
    _v.copy(ud.lap); ud.hull.localToWorld(_v); out.L.copy(_v);
  }
  return out;
}
export const BOAT_COUNT = CFG.length;
