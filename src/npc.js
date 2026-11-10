import * as THREE from 'three';
const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
const ico = (sx, sy, sz, d = 1) => { const g = new THREE.IcosahedronGeometry(1, d); g.scale(sx, sy, sz); return g; };
const SK = ['#e0b08a', '#c68e66', '#a8734e', '#f0c8a4'], CO = ['#3f6a8a', '#8a3f3f', '#4d7a4a', '#7a5aa0', '#c09a3a', '#3f4f5a', '#a85a82'], HA = ['#3a2a1e', '#6a4a2a', '#1c1c1c', '#b08a52', '#8a8a8a'];
/** düşük poligonlu müşteri figürü; yürürken bacak/kol sallar */
export function buildCustomer(seed = 0) {
  const r = (n) => { const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
  const pick = (a, n) => a[Math.floor(r(n) * a.length) % a.length];
  const root = new THREE.Group(); const sk = flat(pick(SK, 1)), co = flat(pick(CO, 2)), pa = flat(pick(['#2f3a4a', '#4a3f32', '#3a4a3a', '#5a5048'], 3)), ha = flat(pick(HA, 4));
  const mk = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const legs = [], arms = [];
  for (const s of [1, -1]) { const hip = new THREE.Group(); hip.position.set(0, 0.88, s * 0.1); hip.add(mk(new THREE.CylinderGeometry(0.075, 0.06, 0.88, 6).translate(0, -0.44, 0), pa, 0, 0, 0)); hip.add(mk(ico(0.1, 0.045, 0.065, 0), flat('#2a2420'), 0.05, -0.88, 0)); root.add(hip); legs.push(hip); }
  const T = new THREE.Group(); T.position.y = 0.88; root.add(T);
  T.add(mk(new THREE.CylinderGeometry(0.17, 0.2, 0.6, 8).translate(0, 0.3, 0), co, 0, 0, 0)); T.add(mk(ico(0.05, 0.05, 0.05, 0), sk, 0, 0.63, 0));
  const H = mk(ico(0.1, 0.12, 0.09, 1), sk, 0.01, 0.78, 0); T.add(H); H.add(mk(ico(0.105, 0.09, 0.095, 1), ha, -0.02, 0.04, 0));
  const hatK = r(5); if (hatK < 0.4) { const hb = mk(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 10), flat(pick(['#cfae62', '#6a5a3a', '#4a5a6a'], 6)), 0, 0.1, 0); H.add(hb); H.add(mk(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 9), hb.material, 0, 0.16, 0)); } else if (hatK < 0.7) H.add(mk(ico(0.11, 0.09, 0.1, 1), flat(pick(CO, 7)), -0.01, 0.07, 0));
  for (const s of [1, -1]) { const sh = new THREE.Group(); sh.position.set(0, 0.55, s * 0.22); sh.add(mk(new THREE.CylinderGeometry(0.05, 0.04, 0.55, 6).translate(0, -0.27, 0), co, 0, 0, 0)); sh.add(mk(ico(0.045, 0.04, 0.04, 0), sk, 0, -0.56, 0)); T.add(sh); arms.push(sh); }
  root.userData = { legs, arms, T, H, ph: 0 };
  return root;
}
export function animateCustomer(c, dt, walk, t, pose) {
  const u = c.userData; u.ph += dt * walk * 7.5; const s = Math.sin(u.ph) * walk;
  if (!pose) { u.legs[0].rotation.z = 0.5 * s; u.legs[1].rotation.z = -0.5 * s; u.arms[0].rotation.z = -0.45 * s; u.arms[1].rotation.z = 0.45 * s; u.T.rotation.z = 0.02; c.position.y = Math.abs(Math.sin(u.ph)) * 0.03 * walk; }
  else if (pose === 'sit') { u.legs[0].rotation.z = Math.PI / 2 - 0.1; u.legs[1].rotation.z = Math.PI / 2 - 0.1; u.arms[0].rotation.z = 0.7; u.arms[1].rotation.z = 0.7; }
  else if (pose === 'wait') { u.legs[0].rotation.z = 0; u.legs[1].rotation.z = 0; u.arms[0].rotation.z = 0.1 + 0.05 * Math.sin(t * 1.2); u.arms[1].rotation.z = -0.1; u.H.rotation.y = 0.3 * Math.sin(t * 0.7); }
  else if (pose === 'wave') { u.arms[0].rotation.z = -2.6 + 0.4 * Math.sin(t * 9); u.legs[0].rotation.z = 0; u.legs[1].rotation.z = 0; }
}
