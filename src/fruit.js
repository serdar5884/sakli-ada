import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './world.js';
import { FRUITS } from './data.js';

/** Meyve ağaçları: gövde+yaprak ağaç başına tek parça, meyveler türe göre tek InstancedMesh (az çizim çağrısı).
 *  Toplanan meyve kaybolur, bir süre sonra yeniden büyür. */
export function buildFruitTrees(spots) {
  const group = new THREE.Group(); const trees = []; const rnd = mulberry(909);
  const treeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, flatShading: true });
  const leafCols = ['#4f9a3a', '#5aa63f', '#468f35', '#62ad45'].map((c) => new THREE.Color(c)); const trunkCol = new THREE.Color('#5b4331');
  const colorize = (geo, c, k = 1) => { const n = geo.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const fruitGeo = new THREE.IcosahedronGeometry(0.2, 1); const fruitMats = {}; for (const k in FRUITS) fruitMats[k] = new THREE.MeshStandardMaterial({ color: FRUITS[k].c, roughness: 0.5, flatShading: false });
  const dir = new THREE.Vector3(); const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3(); const byKind = {};
  let time = 0;
  spots.forEach(({ x, z, y, kind }) => {
    const g = new THREE.Group(); g.position.set(x, y - 0.05, z); g.rotation.y = rnd() * 6.28; group.add(g);
    const parts = []; const tg = new THREE.CylinderGeometry(0.13, 0.22, 1.9, 7).toNonIndexed(); tg.translate(0, 0.95, 0); parts.push(colorize(tg, trunkCol));
    const balls = [];
    for (let i = 0; i < 6; i++) {
      const a = rnd() * 6.28, d = i === 0 ? 0 : 0.7 + rnd() * 0.55; const r = 0.95 + rnd() * 0.35; const ig = new THREE.IcosahedronGeometry(r, 1);
      const pos = new THREE.Vector3(Math.cos(a) * d, 2.35 + rnd() * 0.75, Math.sin(a) * d); ig.scale(1, 0.85, 1); ig.translate(pos.x, pos.y, pos.z);
      parts.push(colorize(ig, leafCols[i % 4], 0.92 + rnd() * 0.16)); balls.push({ pos, r });
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts), treeMat); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); parts.forEach((p) => p.dispose());
    const fruits = []; const n = 14 + (rnd() * 7 | 0);
    for (let i = 0; i < n; i++) {
      const b = balls[1 + (rnd() * (balls.length - 1) | 0)]; dir.set(rnd() - 0.5, -0.05 - rnd() * 0.5, rnd() - 0.5).normalize();
      const p = b.pos.clone().addScaledVector(dir, b.r * 1.1); p.y = b.pos.y + dir.y * b.r * 1.1 * 0.85;
      const s = kind === 'armut' ? new THREE.Vector3(0.85, 1.3, 0.85) : new THREE.Vector3(1, 1, 1);
      fruits.push({ p, s, on: true, ripeT: 0, grow: 1, idx: -1 });
    }
    const tree = { x, z, kind, g, fruits, shake: 0, dirty: true,
      avail() { let c = 0; for (const f of fruits) if (f.on) c++; return c; },
      pick() { let c = 0; for (const f of fruits) if (f.on) { f.on = false; f.ripeT = time + 100 + Math.random() * 90; c++; } if (c) { tree.shake = 0.7; tree.dirty = true; } return c; } };
    (byKind[kind] ||= []).push(tree); trees.push(tree);
  });
  // meyve instance'ları
  const inst = {};
  for (const k in byKind) {
    let cnt = 0; for (const t of byKind[k]) for (const f of t.fruits) f.idx = cnt++;
    const im = new THREE.InstancedMesh(fruitGeo, fruitMats[k], cnt); im.frustumCulled = false; im.castShadow = false; group.add(im); inst[k] = im;
  }
  const refresh = (t) => {
    const im = inst[t.kind]; t.g.updateMatrixWorld(true);
    for (const f of t.fruits) {
      const k = f.on ? (0.01 + 0.99 * f.grow) : 0.0001; S3.copy(f.s).multiplyScalar(k); M4.compose(f.p, Q.identity(), S3).premultiply(t.g.matrixWorld); im.setMatrixAt(f.idx, M4);
    }
    im.instanceMatrix.needsUpdate = true; t.dirty = false;
  };
  group.updateMatrixWorld(true); for (const t of trees) refresh(t);
  return { group, trees, update(dt) {
    time += dt;
    for (const t of trees) {
      if (t.shake > 0) { t.shake = Math.max(0, t.shake - dt); t.g.rotation.z = Math.sin(t.shake * 38) * t.shake * 0.05; t.g.rotation.x = Math.cos(t.shake * 31) * t.shake * 0.04; t.dirty = true; }
      for (const f of t.fruits) {
        if (!f.on && f.ripeT > 0 && time >= f.ripeT) { f.on = true; f.grow = 0; f.ripeT = 0; t.dirty = true; }
        if (f.on && f.grow < 1) { f.grow = Math.min(1, f.grow + dt / 6); t.dirty = true; }
      }
      if (t.dirty) refresh(t);
    }
  } };
}
