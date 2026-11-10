import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry, smooth } from './world.js';
import { WARDROBE, DEFAULT_OUTFIT, colorOf } from './data.js';

/* ---------- balıkçı (gerçekçi oranlı low-poly) + kıyafet sistemi + kürek/yüzme/yürüme animasyonu ---------- */
export function buildFisherman() {
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const rnd = mulberry(55); const C = (h) => new THREE.Color(h);
  const flat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, flatShading: true, ...o });
  const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const vmatD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const repaints = [];
  const paintRaw = (geo, fn) => { const p = geo.attributes.position, n = p.count, c = new Float32Array(n * 3), col = new THREE.Color(); for (let i = 0; i < n; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
  const paint = (geo, fn) => paintRaw(geo, fn); // kıyafetten bağımsız
  const paintO = (geo, fn) => { paintRaw(geo, fn); repaints.push(() => { paintRaw(geo, fn); geo.attributes.color.needsUpdate = true; }); return geo; };
  const mk = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  const ico = (sx, sy, sz, d = 1) => { const g = new THREE.IcosahedronGeometry(1, d); g.scale(sx, sy, sz); return g; };
  const skinPlain = new THREE.MeshStandardMaterial({ color: '#e3b08c', roughness: 0.8, flatShading: false, emissive: new THREE.Color('#5a2f22'), emissiveIntensity: 0.22 });
  const skin = flat('#d9a37c'), skinD = flat('#c8906a'), hairM = flat('#4a3524'), dark = flat('#26221f'), steel = flat('#c9ced1', { metalness: 0.2, roughness: 0.6 });

  /* palet: değiştirilebilir renkler */
  const pal = { jacket: C('#c8923a'), jacketD: C(), jacketL: C(), pants: C('#2f4a73'), pantsD: C(), pantsL: C(), boots: C('#44362c'), pack: C('#566238'), packD: C() };
  const tinted = []; // [materyal, anahtar, çarpan]
  const tm = (key, mul, o) => { const m = flat('#ffffff', o); tinted.push([m, key, mul]); return m; };
  const derive = () => {
    pal.jacketD.copy(pal.jacket).multiplyScalar(0.75); pal.jacketL.copy(pal.jacket).multiplyScalar(1.1);
    pal.pantsD.copy(pal.pants).multiplyScalar(0.74); pal.pantsL.copy(pal.pants).multiplyScalar(1.38);
    pal.packD.copy(pal.pack).multiplyScalar(0.78);
    for (const [m, key, mul] of tinted) { m.color.copy(pal[key]).multiplyScalar(mul); }
  };

  /* ---- gövde: ceket (lathe, yüzlü, kıvrımlı) ---- */
  const T = new THREE.Group(); T.position.y = 0.92; rig.add(T);
  const prof = [[0.215, -0.15], [0.2, -0.04], [0.188, 0.14], [0.2, 0.31], [0.212, 0.46], [0.15, 0.545], [0.085, 0.585], [0.0, 0.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const jg = new THREE.LatheGeometry(prof, 10); { const p = jg.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ang = Math.atan2(z, x); const f = 1 + 0.045 * Math.sin(ang * 4 + y * 11) + 0.02 * Math.sin(ang * 7 - y * 17); x *= f * 0.72; z *= f * (y > 0.4 ? 1.12 : 1.0); p.setXYZ(i, x, y, z); } jg.computeVertexNormals(); }
  paintO(jg, (c, x, y, z) => { const ang = Math.atan2(z, x); const fold = Math.sin(ang * 5 + y * 13); c.copy(pal.jacket).lerp(pal.jacketL, smooth(0.35, 0.6, y) * 0.5).lerp(pal.jacketD, smooth(0.4, -0.15, y) * 0.35 + (fold > 0.6 ? 0.25 : 0)); c.multiplyScalar(0.92 + 0.12 * Math.sin(ang * 3 + y * 5)); });
  const jacket = mk(jg, vmatD); T.add(jacket);
  const collar = new THREE.CylinderGeometry(0.125, 0.092, 0.075, 9, 1, true); paintO(collar, (c, x, y) => c.copy(pal.jacketD).lerp(pal.jacket, (y + 0.04) * 6)); const col = mk(collar, vmatD, -0.01, 0.615, 0); col.rotation.z = -0.1; T.add(col);
  T.add(mk(new THREE.BoxGeometry(0.012, 0.5, 0.016), dark, 0.142, 0.3, 0)); T.add(mk(new THREE.BoxGeometry(0.02, 0.03, 0.03), steel, 0.145, 0.54, 0));
  for (const s of [1, -1]) {
    const fl = mk(new THREE.BoxGeometry(0.03, 0.065, 0.13), tm('jacket', 0.8), 0.138, 0.0, s * 0.105); fl.rotation.x = -s * 0.12; T.add(fl);
    const pk = mk(new THREE.BoxGeometry(0.026, 0.12, 0.12), tm('jacket', 0.92), 0.135, 0.09, s * 0.105); pk.rotation.x = -s * 0.12; T.add(pk);
    const cp = mk(new THREE.BoxGeometry(0.022, 0.07, 0.08), tm('jacket', 0.92), 0.12, 0.38, s * 0.1); cp.rotation.x = -s * 0.08; T.add(cp);
  }
  const SR = new THREE.Vector3(0, 0.5, 0.215), SL = new THREE.Vector3(0, 0.5, -0.215);
  const shoulderMeshes = []; for (const S of [SR, SL]) { const sm = mk(ico(0.075, 0.07, 0.075, 1), tm('jacket', 1), S.x, S.y, S.z); T.add(sm); shoulderMeshes.push(sm); }
  T.add(mk(new THREE.CylinderGeometry(0.047, 0.058, 0.11, 12), skinPlain, 0.004, 0.63, 0));

  /* yelek (isteğe bağlı) */
  const vestMat = tm('vest', 1); pal.vest = C('#8a7c54');
  const vest = new THREE.Group(); vest.visible = false; T.add(vest);
  { const vprof = [[0.228, -0.1], [0.212, 0.0], [0.205, 0.14], [0.213, 0.31], [0.222, 0.46], [0.2, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)); const vg = new THREE.LatheGeometry(vprof, 10, 0, Math.PI * 2); const p = vg.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ang = Math.atan2(z, x); const f = 1 + 0.045 * Math.sin(ang * 4 + y * 11) + 0.02 * Math.sin(ang * 7 - y * 17); p.setXYZ(i, x * f * 0.72 * 1.02, y, z * f * (y > 0.4 ? 1.12 : 1.0) * 1.02); } vg.computeVertexNormals(); vest.add(mk(vg, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, flatShading: true, side: THREE.DoubleSide }))); vest.children[0].material = vestMat; vestMat.side = THREE.DoubleSide;
    for (const s of [1, -1]) { vest.add(mk(new THREE.BoxGeometry(0.03, 0.1, 0.11), tm('vest', 0.8), 0.15, 0.08, s * 0.105)); vest.add(mk(new THREE.BoxGeometry(0.03, 0.08, 0.09), tm('vest', 0.8), 0.14, 0.34, s * 0.1)); }
    for (const s of [1, -1]) { vest.add(mk(new THREE.BoxGeometry(0.012, 0.3, 0.035), flat('#4f4f2c'), 0.152, 0.22, s * 0.06)); } }

  /* atkı */
  const scarfMat = tm('scarf', 1); pal.scarf = C('#b2402e');
  const scarf = new THREE.Group(); scarf.visible = false; T.add(scarf);
  { const ring = mk(new THREE.TorusGeometry(0.112, 0.042, 6, 12), scarfMat, -0.005, 0.62, 0); ring.rotation.x = Math.PI / 2; ring.rotation.y = -0.1; scarf.add(ring);
    const tail1 = mk(new THREE.BoxGeometry(0.03, 0.26, 0.075), scarfMat, 0.125, 0.5, 0.05); tail1.rotation.x = 0.05; scarf.add(tail1); const tail2 = mk(new THREE.BoxGeometry(0.03, 0.2, 0.075), tm('scarf', 0.85), 0.128, 0.5, -0.04); tail2.rotation.x = -0.1; scarf.add(tail2); }

  /* ---- baş (daha insansı: yumuşak yüzey, göz/kaş/ağız/kulak, yüz hatları) ---- */
  const H = new THREE.Group(); H.position.set(0.015, 0.78, 0); H.rotation.z = -0.12; T.add(H);
  const weld = (g) => { g.deleteAttribute('normal'); g.deleteAttribute('uv'); const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return m; };
  const skinS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, flatShading: false, emissive: new THREE.Color('#5a2f22'), emissiveIntensity: 0.22 });
  const skinPlainD = new THREE.MeshStandardMaterial({ color: '#d09b78', roughness: 0.8, flatShading: false });
  const hairS = new THREE.MeshStandardMaterial({ color: '#46301f', roughness: 0.95, flatShading: false });
  {
    const hg = new THREE.IcosahedronGeometry(1, 5); const p = hg.attributes.position; const cols = new Float32Array(p.count * 3); const cA = C('#eab894'), cB = C('#dba583'), cBl = C('#e5a091'), cSt = C('#b8967f'); const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      let x = vx * 0.098, y = vy * 0.118 + 0.01, z = vz * 0.086;
      const low = smooth(0.15, -0.95, vy); // çene bölgesi
      z *= 1 - 0.36 * Math.pow(low, 1.25); x *= 1 - 0.07 * low;
      if (vx > 0 && vy < -0.55) { x += 0.014 * smooth(-0.55, -0.95, vy) * vx; y -= 0.006 * smooth(-0.6, -1, vy) * vx; } // çene ucu
      z *= 1 + 0.07 * Math.exp(-Math.pow((vy + 0.1) / 0.35, 2)) * (vx > -0.2 ? 1 : 0); // elmacık
      if (vx > 0.5 && vy > 0.25) x -= 0.006 * smooth(0.25, 0.8, vy); // alın hafif geri
      p.setXYZ(i, x, y, z);
      tmp.copy(cA).lerp(cB, smooth(0.2, -0.8, vy) * 0.5); if (vx > 0.35 && vy < 0.05 && vy > -0.5) tmp.lerp(cBl, 0.45 * Math.min(1, Math.abs(vz) * 2.2));
      if (vx > 0.15 && vy < -0.28 && vy > -0.85) tmp.lerp(cSt, 0.1 + 0.05 * Math.sin(vz * 90 + vy * 70)); // sakal gölgesi
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    hg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); H.add(mk(weld(hg), skinS));
  }
  const smo = (sx, sy, sz, d = 2) => { const g = new THREE.IcosahedronGeometry(1, Math.max(d, 2)); g.scale(sx, sy, sz); return weld(g); };
  const bridge = mk(smo(0.024, 0.032, 0.0085, 2), skinPlain, 0.09, 0.004, 0); bridge.rotation.z = -0.28; H.add(bridge);
  H.add(mk(smo(0.0155, 0.0135, 0.0135, 2), skinPlain, 0.1, -0.026, 0)); // burun ucu
  for (const s of [1, -1]) { H.add(mk(smo(0.0085, 0.0095, 0.0085, 1), skinPlain, 0.093, -0.0325, s * 0.0125)); } // burun kanatları
  for (const s of [1, -1]) {
    // göz: beyaz + iris + göz kapakları + kaş
    const ex = 0.0805, ey = 0.026, ez = s * 0.035;
    const eye = mk(smo(0.0125, 0.0125, 0.0185, 2), flat('#f3eee6', { roughness: 0.4 }), ex, ey, ez); H.add(eye);
    const iris = mk(smo(0.0066, 0.0095, 0.0095, 1), flat('#4a3220', { roughness: 0.3 }), ex + 0.0095, ey - 0.0005, ez + s * 0.0004); H.add(iris);
    const pup = mk(smo(0.0035, 0.004, 0.004, 0), flat('#0c0a09', { roughness: 0.2 }), ex + 0.0155, ey - 0.0005, ez + s * 0.0005); H.add(pup);
    const lidU = mk(smo(0.0138, 0.0052, 0.0205, 1), skinPlainD, ex + 0.0008, ey + 0.0098, ez); lidU.rotation.z = -0.15; H.add(lidU);
    const lidL = mk(smo(0.0128, 0.0032, 0.0195, 1), skinPlain, ex + 0.0008, ey - 0.0112, ez); H.add(lidL);
    const brow = mk(smo(0.0085, 0.0055, 0.0255, 1), hairS, 0.082, 0.0535, s * 0.0405); brow.rotation.x = -s * 0.2; brow.rotation.z = -0.18; H.add(brow);
    // kulak
    const ear = mk(smo(0.016, 0.03, 0.0095, 2), skinPlainD, -0.006, -0.002, s * 0.0885); ear.rotation.z = 0.1; ear.rotation.x = s * 0.18; H.add(ear);
    H.add(mk(smo(0.008, 0.019, 0.004, 1), skinPlain, -0.004, -0.002, s * 0.0935));
    // yanak/gamze çizgisi
    const crease = mk(smo(0.004, 0.017, 0.003, 0), skinPlainD, 0.09, -0.043, s * 0.03); crease.rotation.x = -s * 0.6; H.add(crease);
  }
  { // ağız: üst-alt dudak
    const lipC = flat('#a85a4c', { roughness: 0.7 }); H.add(mk(smo(0.0058, 0.0042, 0.019, 1), lipC, 0.0795, -0.0555, 0)); H.add(mk(smo(0.0066, 0.0056, 0.0165, 1), flat('#b8665a', { roughness: 0.7 }), 0.0785, -0.0645, 0));
    for (const s of [1, -1]) H.add(mk(smo(0.004, 0.0035, 0.004, 0), skinPlainD, 0.082, -0.0585, s * 0.022));
    const mus = mk(smo(0.0075, 0.0058, 0.022, 1), hairS, 0.0828, -0.0455, 0); mus.rotation.z = -0.1; H.add(mus);
  }
  { // saç: kafa kabuğu + yanlık + alın perçemi
    H.add(mk(smo(0.108, 0.098, 0.097, 2), hairS, -0.026, 0.038, 0));
    // sakal: çene hattı + yanaklar + çene ucu (gülümseyen ağız etrafı açık)
    { const bj = mk(smo(0.066, 0.04, 0.078, 2), hairS, 0.03, -0.078, 0); bj.rotation.z = 0.12; H.add(bj);
      H.add(mk(smo(0.034, 0.028, 0.046, 2), hairS, 0.064, -0.09, 0));
      for (const sg of [1, -1]) { const ch = mk(smo(0.04, 0.04, 0.016, 2), hairS, 0.04, -0.04, sg * 0.074); ch.rotation.y = -sg * 0.35; H.add(ch); H.add(mk(smo(0.022, 0.03, 0.022, 1), hairS, 0.075, -0.06, sg * 0.05)); }
      // kıvırcık saç tutamları (şapkanın altından)
      for (let i = 0; i < 11; i++) { const an = -2.3 + i * 0.46; H.add(mk(smo(0.026, 0.026, 0.026, 1), hairS, Math.cos(an) * 0.1 - 0.02, 0.012 + 0.03 * Math.sin(i * 2.7), Math.sin(an) * 0.097)); } }
    for (const s of [1, -1]) { const sb = mk(smo(0.016, 0.034, 0.008, 1), hairS, 0.005, -0.012, s * 0.085); H.add(sb); }
    const fringe = mk(smo(0.04, 0.02, 0.08, 1), hairS, 0.046, 0.083, 0); fringe.rotation.z = -0.35; H.add(fringe);
    for (let i = 0; i < 9; i++) { const ang = Math.PI * 0.6 + (i / 8) * Math.PI * 0.8 + (i % 2) * 0.02; const sz = Math.sin(ang); const cone = mk(new THREE.ConeGeometry(0.014, 0.075 + rnd() * 0.04, 5), hairS, -0.08 * Math.abs(sz) - 0.03, -0.05 - rnd() * 0.03, sz * 0.092); cone.rotation.x = Math.sign(sz) * 0.25; cone.rotation.z = 0.15 + rnd() * 0.2; H.add(cone); }
  }
  /* güneş gözlüğü */
  const glasses = new THREE.Group(); glasses.visible = false; H.add(glasses);
  { const lens = flat('#161a1c', { roughness: 0.2, metalness: 0.3 }); for (const s of [1, -1]) glasses.add(mk(new THREE.BoxGeometry(0.02, 0.036, 0.052), lens, 0.093, 0.016, s * 0.044)); glasses.add(mk(new THREE.BoxGeometry(0.014, 0.01, 0.2), dark, 0.09, 0.03, 0)); glasses.add(mk(new THREE.BoxGeometry(0.014, 0.012, 0.012), dark, 0.094, 0.02, 0)); for (const s of [1, -1]) glasses.add(mk(new THREE.BoxGeometry(0.17, 0.01, 0.01), dark, 0.0, 0.03, s * 0.098)); }

  /* şapkalar */
  const hats = {};
  { // safari hasır
    const hat = new THREE.Group(); hat.position.set(0.0, 0.075, 0); hat.rotation.z = -0.07; hat.rotation.x = 0.03; H.add(hat); hats.safari = hat;
    const straw = (c, x, y, z) => { c.set('#cfae62').lerp(C('#a98d48'), 0.35 + 0.25 * Math.sin(x * 60 + z * 47 + y * 20)); };
    const brim = new THREE.CylinderGeometry(0.225, 0.272, 0.028, 13); paint(brim, straw); hat.add(mk(brim, vmat, 0, 0, 0));
    const crown = new THREE.CylinderGeometry(0.118, 0.136, 0.1, 11); paint(crown, straw); hat.add(mk(crown, vmat, 0, 0.06, 0));
    const dome = ico(0.12, 0.05, 0.12, 1); paint(dome, straw); hat.add(mk(dome, vmat, 0, 0.108, 0));
    hat.add(mk(new THREE.CylinderGeometry(0.139, 0.142, 0.034, 11), flat('#2f241d'), 0, 0.03, 0));
    for (let i = 0; i < 3; i++) { const hk = mk(new THREE.ConeGeometry(0.008, 0.04, 4), steel, 0.138, 0.045, -0.04 + i * 0.045); hk.rotation.z = -Math.PI / 2 + 0.3; hat.add(hk); }
  }
  const hatMat = flat('#7d8a5a'); const hatMatD = flat('#5a6540');
  { // balıkçı (bucket) şapkası
    const hat = new THREE.Group(); hat.position.set(0, 0.07, 0); hat.visible = false; H.add(hat); hats.bucket = hat;
    hat.add(mk(new THREE.CylinderGeometry(0.205, 0.235, 0.022, 12), hatMat, 0, 0.0, 0)); hat.add(mk(new THREE.CylinderGeometry(0.108, 0.13, 0.12, 11), hatMat, 0, 0.065, 0)); hat.add(mk(ico(0.112, 0.035, 0.112, 1), hatMat, 0, 0.125, 0)); hat.add(mk(new THREE.CylinderGeometry(0.133, 0.134, 0.028, 11), hatMatD, 0, 0.03, 0));
  }
  { // kasket
    const hat = new THREE.Group(); hat.position.set(0, 0.06, 0); hat.visible = false; H.add(hat); hats.cap = hat;
    hat.add(mk(ico(0.118, 0.085, 0.108, 1), hatMat, -0.012, 0.035, 0)); const visor = mk(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 10, 1, false, -Math.PI / 2 - 1.2, 2.4), hatMatD, 0.1, 0.0, 0); visor.scale.set(1.15, 1, 1.0); visor.rotation.z = -0.1; hat.add(visor);
    hat.add(mk(new THREE.SphereGeometry(0.016, 6, 4), hatMatD, -0.012, 0.118, 0));
  }
  { // bere
    const hat = new THREE.Group(); hat.position.set(0, 0.06, 0); hat.visible = false; H.add(hat); hats.beanie = hat;
    hat.add(mk(ico(0.112, 0.1, 0.104, 1), hatMat, -0.012, 0.045, 0)); hat.add(mk(new THREE.CylinderGeometry(0.113, 0.112, 0.05, 10), hatMatD, -0.012, 0.0, 0)); hat.add(mk(new THREE.SphereGeometry(0.03, 6, 5), tm('hatD', 1.3), -0.012, 0.15, 0));
  }
  pal.hat = C('#7d8a5a'); pal.hatD = C();
  tinted.push([hatMat, 'hat', 1], [hatMatD, 'hatD', 1]);

  /* ---- sırt çantası ---- */
  const packG = new THREE.Group(); T.add(packG); packG.position.set(-0.27, 0.27, 0); packG.rotation.z = 0.06;
  const pg = ico(0.115, 0.2, 0.16, 1); paintO(pg, (c, x, y, z) => c.copy(pal.pack).lerp(pal.packD, smooth(0.0, -0.2, y) * 0.5 + 0.1 * Math.sin(z * 30 + y * 22))); packG.add(mk(pg, vmat));
  packG.add(mk(ico(0.125, 0.062, 0.17, 1), tm('pack', 0.87), -0.005, 0.185, 0)); packG.children[1].rotation.z = 0.12;
  for (const s of [1, -1]) packG.add(mk(ico(0.06, 0.105, 0.05, 1), tm('pack', 0.9), -0.03, -0.06, s * 0.185));
  const roll = mk(new THREE.CylinderGeometry(0.058, 0.058, 0.36, 8), flat('#a88a5a'), -0.0, -0.215, 0); roll.rotation.x = Math.PI / 2; packG.add(roll);
  packG.add(mk(new THREE.CylinderGeometry(0.034, 0.034, 0.2, 8), flat('#7d8f95', { metalness: 0.15 }), -0.03, -0.045, -0.2));
  packG.add(mk(new THREE.BoxGeometry(0.08, 0.075, 0.12), flat('#7a5530'), -0.04, 0.0, 0.2)); packG.add(mk(new THREE.BoxGeometry(0.084, 0.012, 0.02), steel, -0.04, 0.0, 0.2));
  const lure = (z, y, c) => { const l = mk(new THREE.ConeGeometry(0.014, 0.05, 5), flat(c), 0.118, y, z); l.rotation.z = Math.PI; packG.add(l); packG.add(mk(new THREE.TorusGeometry(0.012, 0.003, 4, 8), steel, 0.118, y + 0.035, z)); };
  lure(-0.05, 0.15, '#e24b3a'); lure(0.0, 0.14, '#f2c23a'); lure(0.05, 0.15, '#3aa6d8');
  const strapM = tm('pack', 0.64);
  for (const s of [1, -1]) { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.17, 0.33, s * 0.1), new THREE.Vector3(-0.1, 0.57, s * 0.115), new THREE.Vector3(0.0, 0.595, s * 0.12), new THREE.Vector3(0.1, 0.5, s * 0.115), new THREE.Vector3(0.145, 0.3, s * 0.11), new THREE.Vector3(0.1, 0.1, s * 0.17), new THREE.Vector3(-0.1, 0.04, s * 0.17)]); T.add(mk(new THREE.TubeGeometry(curve, 24, 0.019, 5), strapM)); }
  T.add(mk(new THREE.BoxGeometry(0.012, 0.025, 0.24), strapM, 0.142, 0.36, 0)); T.add(mk(new THREE.BoxGeometry(0.02, 0.03, 0.03), steel, 0.145, 0.36, 0));

  /* ---- bacaklar ---- */
  const legs = [];
  const bootCuffM = tm('boots', 1.3), footM = tm('boots', 0.65); const kneeM = tm('pants', 1);
  [[1, 0.08, -0.14], [-1, -0.03, -0.07]].forEach(([s, hz, kz]) => {
    const hip = new THREE.Group(); hip.position.set(0, 0.92, s * 0.1); rig.add(hip);
    const th = new THREE.CylinderGeometry(0.088, 0.064, 0.47, 8); th.translate(0, -0.235, 0);
    paintO(th, (c, x, y, z) => { const ang = Math.atan2(z, x); c.copy(pal.pants).lerp(pal.pantsD, (Math.sin(ang * 3 + y * 20) > 0.55 ? 0.5 : 0)).lerp(pal.pantsL, smooth(-0.35, -0.47, y) * 0.5); });
    hip.add(mk(th, vmat));
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    knee.add(mk(ico(0.07, 0.065, 0.07, 1), kneeM, 0.0, 0.0, 0));
    const jt = new THREE.CylinderGeometry(0.07, 0.085, 0.09, 8); paintO(jt, (c, x, y, z) => c.copy(pal.pants).lerp(pal.pantsD, 0.25 + 0.25 * Math.sin(z * 90 + x * 70))); knee.add(mk(jt, vmat, 0, -0.06, 0));
    const shaft = new THREE.CylinderGeometry(0.076, 0.066, 0.38, 9); paintO(shaft, (c, x, y, z) => c.copy(pal.boots).multiplyScalar(0.65 + 0.35 * (0.5 + 0.5 * Math.sin(x * 55 + y * 18) * 0.5))); knee.add(mk(shaft, vmat, 0, -0.24, 0));
    knee.add(mk(new THREE.CylinderGeometry(0.083, 0.078, 0.035, 9), bootCuffM, 0, -0.1, 0));
    knee.add(mk(ico(0.135, 0.052, 0.072, 1), footM, 0.055, -0.425, 0));
    knee.add(mk(new THREE.BoxGeometry(0.27, 0.025, 0.105), dark, 0.05, -0.455, 0));
    legs.push({ hip, knee, stand: [hz, kz] }); hip.rotation.z = hz; knee.rotation.z = kz;
  });

  /* ---- olta ---- */
  const rodPivot = new THREE.Group(); T.add(rodPivot);
  const rodMat = flat('#2f2218');
  const handle = mk(new THREE.CylinderGeometry(0.03, 0.026, 0.46, 7), flat('#b98a4a'), -0.15, 0, 0); handle.rotation.z = Math.PI / 2; rodPivot.add(handle);
  const reelM = mk(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), flat('#4a4a4a', { metalness: 0.3 }), 0.17, -0.06, 0.0); reelM.rotation.x = Math.PI / 2; rodPivot.add(reelM);
  const seg = (len, r0, r1) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), rodMat); m.rotation.z = -Math.PI / 2; m.position.x = len / 2; m.castShadow = true; return m; };
  rodPivot.add(seg(0.9, 0.022, 0.014));
  const rodJ2 = new THREE.Group(); rodJ2.position.x = 0.9; rodPivot.add(rodJ2); rodJ2.add(seg(0.9, 0.014, 0.0095));
  const rodJ3 = new THREE.Group(); rodJ3.position.x = 0.9; rodJ2.add(rodJ3); rodJ3.add(seg(0.9, 0.0095, 0.005));
  for (let i = 0; i < 3; i++) { const g = mk(new THREE.TorusGeometry(0.014, 0.0025, 4, 8), steel, 0.45, 0.014, 0); g.rotation.y = Math.PI / 2; (i === 0 ? rodPivot : i === 1 ? rodJ2 : rodJ3).add(g); }
  const tip = new THREE.Object3D(); tip.position.x = 0.9; rodJ3.add(tip);

  /* ---- yay + ok (avlanma) ---- */
  const bowPivot = new THREE.Group(); bowPivot.visible = false; T.add(bowPivot);
  { const wood = flat('#7a4b25'); const limb = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.017, 5, 18, Math.PI), wood); limb.rotation.z = -Math.PI / 2; limb.scale.set(0.35, 1, 1); limb.position.x = -0.161; limb.castShadow = true; bowPivot.add(limb);
    bowPivot.add(mk(new THREE.CylinderGeometry(0.027, 0.027, 0.15, 6), flat('#2a1c10'), 0, 0, 0)); }
  const bowStrGeo = new THREE.BufferGeometry(); bowStrGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const bowStr = new THREE.Line(bowStrGeo, new THREE.LineBasicMaterial({ color: 0xece6d4 })); bowStr.frustumCulled = false; bowPivot.add(bowStr);
  const bowArrow = new THREE.Group(); bowArrow.visible = false; bowPivot.add(bowArrow);
  { const sh = mk(new THREE.CylinderGeometry(0.0075, 0.0075, 0.72, 5), flat('#c9a56a')); sh.rotation.z = Math.PI / 2; sh.position.x = 0.36; bowArrow.add(sh);
    const hd = mk(new THREE.ConeGeometry(0.02, 0.07, 5), flat('#8e8e92', { metalness: 0.4 })); hd.rotation.z = -Math.PI / 2; hd.position.x = 0.75; bowArrow.add(hd);
    for (const a of [0, 2.1, 4.2]) { const fl = mk(new THREE.BoxGeometry(0.07, 0.035, 0.003), flat('#d7e0d0')); fl.position.x = 0.05; fl.rotation.x = a; bowArrow.add(fl); } }

  /* ---- sırtta yay + ok kılıfı (göl uzağındayken olta yerine) ---- */
  const backGear = new THREE.Group(); backGear.visible = false; T.add(backGear);
  { const wood = flat('#7a4b25'); const lb = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.017, 5, 18, Math.PI), wood); lb.rotation.z = -Math.PI / 2; lb.scale.set(0.35, 1, 1); lb.position.x = -0.161; lb.castShadow = true;
    const grip = mk(new THREE.CylinderGeometry(0.027, 0.027, 0.15, 6), flat('#2a1c10'), 0, 0, 0);
    const sg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.161, 0.46, 0, -0.161, -0.46, 0], 3)); const str = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xece6d4 }));
    const bb = new THREE.Group(); bb.add(lb, grip, str); bb.rotation.set(0.45, Math.PI / 2, 0.12); bb.position.set(-0.44, 0.3, 0.02); bb.scale.setScalar(0.95); backGear.add(bb); backGear.userData.bow = bb;
    const qv = new THREE.Group(); qv.add(mk(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 8), flat('#5e3f22'), 0, 0, 0)); qv.add(mk(new THREE.TorusGeometry(0.058, 0.01, 4, 10), flat('#2a1c10'), 0, 0.24, 0)); qv.children[1].rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const ar = mk(new THREE.CylinderGeometry(0.007, 0.007, 0.22, 5), flat('#c9a56a'), (i % 2 - 0.5) * 0.04, 0.34, (i - 1.5) * 0.02); qv.add(ar); const fl = mk(new THREE.BoxGeometry(0.004, 0.05, 0.04), flat('#e6eadc'), ar.position.x, 0.43, ar.position.z); qv.add(fl); }
    qv.position.set(-0.33, 0.3, -0.12); qv.rotation.set(0.1, 0, 0.45); backGear.add(qv); }

  /* ---- el: avuç + 4 parmak (kıvrık) + başparmak ---- */
  function buildHand(sgn) {
    const g = new THREE.Group(); const sm2 = (sx, sy, sz, d = 1) => { const q = new THREE.IcosahedronGeometry(1, d); q.scale(sx, sy, sz); return q; };
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
    add(sm2(0.026, 0.036, 0.04, 2), skinPlain, 0, 0.02, 0); // avuç içi/sırtı
    add(sm2(0.02, 0.016, 0.034, 1), skinPlain, 0, -0.012, 0); // bilek
    const zs = [-0.03, -0.01, 0.01, 0.03]; const lens = [0.026, 0.03, 0.029, 0.024];
    zs.forEach((z, i) => { const L1 = lens[i]; // proksimal falanks öne-aşağı, ikincisi avuca kıvrılır
      add(new THREE.CapsuleGeometry(0.0108, L1, 3, 6), skinPlain, 0.012, 0.055 + L1 * 0.3, z, 0, 0, -0.5);
      add(new THREE.CapsuleGeometry(0.0098, L1 * 0.75, 3, 6), skinPlainD, 0.036, 0.05, z, 0, 0, -1.6 - 0.1 * i * 0);
    });
    add(new THREE.CapsuleGeometry(0.0125, 0.03, 3, 6), skinPlain, 0.019, 0.034, sgn * -0.04, 0, 0, 0.5 * 0 - 0.7);
    add(new THREE.CapsuleGeometry(0.011, 0.022, 3, 6), skinPlain, 0.033, 0.047, sgn * -0.03, 0, 0, -1.5);
    g.children.forEach(c => { c.position.y -= 0.035; });
    return g;
  }

  /* ---- kollar ---- */
  const U = 0.3, Fo = 0.29; const armParts = [];
  const sleeveG = (r1, r2, L) => { const g = new THREE.CylinderGeometry(r1, r2, L, 12, 3); paintO(g, (c, x, y, z) => { c.copy(pal.jacket).lerp(pal.jacketD, 0.15 + 0.25 * Math.sin(Math.atan2(z, x) * 3 + y * 25)); }); return g; };
  for (const [S, sgn] of [[SR, 1], [SL, -1]]) {
    const up = mk(sleeveG(0.05, 0.064, U), vmat), fo = mk(sleeveG(0.05, 0.057, 0.11), vmat), cuff = mk(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 12), tm('jacket', 1.06), 0, -Fo / 2 + 0.11, 0); fo.geometry.translate(0, -Fo / 2 + 0.055, 0); fo.add(cuff, mk(new THREE.CylinderGeometry(0.036, 0.029, Fo - 0.1, 10), skinPlain, 0, 0.05, 0)); // sıvalı gömlek kolu + çıplak ön kol
    const elbow = mk(ico(0.057, 0.057, 0.057, 2), tm('jacket', 0.95)); const hand = buildHand(sgn); hand.scale.setScalar(1.5);
    T.add(up, fo, elbow, hand); armParts.push({ S, sgn, up, fo, elbow, hand, pole: new THREE.Vector3(-0.25, -0.7, sgn * 0.8).normalize() });
  }
  const Yv = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), el = new THREE.Vector3(), perp = new THREE.Vector3(), mid = new THREE.Vector3(), dirv = new THREE.Vector3(), hnd = new THREE.Vector3();
  function solveArm(a, tgt) {
    d.subVectors(tgt, a.S); const dist = Math.max(0.05, Math.min(d.length(), (U + Fo) * 0.998)); d.normalize();
    const aa = (U * U - Fo * Fo + dist * dist) / (2 * dist); const h = Math.sqrt(Math.max(0, U * U - aa * aa));
    perp.copy(a.pole).addScaledVector(d, -a.pole.dot(d)).normalize();
    el.copy(a.S).addScaledVector(d, aa).addScaledVector(perp, h); hnd.copy(a.S).addScaledVector(d, dist);
    dirv.subVectors(el, a.S).normalize(); mid.addVectors(a.S, el).multiplyScalar(0.5); a.up.position.copy(mid); a.up.quaternion.setFromUnitVectors(Yv, dirv);
    dirv.subVectors(hnd, el).normalize(); mid.addVectors(el, hnd).multiplyScalar(0.5); a.fo.position.copy(mid); a.fo.quaternion.setFromUnitVectors(Yv, dirv);
    a.elbow.position.copy(el); a.hand.position.copy(hnd); a.hand.quaternion.copy(a.fo.quaternion);
  }

  /* ---- kıyafet uygula ---- */
  const outfit = { ...DEFAULT_OUTFIT };
  function applyOutfit(o) {
    Object.assign(outfit, o);
    pal.jacket.set(colorOf('jacket', outfit.jacket)); pal.pants.set(colorOf('pants', outfit.pants)); pal.boots.set(colorOf('boots', outfit.boots)); pal.pack.set(colorOf('pack', outfit.pack));
    if (outfit.hat !== 'none') { const hc = colorOf('hat', outfit.hat); if (hc) { pal.hat.set(hc); pal.hatD.copy(pal.hat).multiplyScalar(0.72); } }
    const vc = outfit.vest !== 'none' ? colorOf('vest', outfit.vest) : null; if (vc) pal.vest.set(vc); const sc = outfit.scarf !== 'none' ? colorOf('scarf', outfit.scarf) : null; if (sc) pal.scarf.set(sc);
    derive(); for (const r of repaints) r();
    for (const k in hats) hats[k].visible = outfit.hat === k;
    glasses.visible = outfit.glasses === 'sun'; scarf.visible = !!sc; vest.visible = !!vc;
  }
  derive();

  /* ---- prosedürel animasyon ---- */
  const st = { ph: 0, w: 0, prevW: 0, bend: 0, bendV: 0, tilt: 0.8, tiltV: 0, sw: 0, swPh: 0, rw: 0, rod: 1, stow: 0, bw: 0, rn: 0 };
  const bowG = new THREE.Vector3(), bowL = new THREE.Vector3(); const freeR = new THREE.Vector3(); const STOW_POS = new THREE.Vector3(-0.41, 0.06, 0.1);
  const G = new THREE.Vector3(), L = new THREE.Vector3(), free = new THREE.Vector3(), rowR = new THREE.Vector3(), rowL = new THREE.Vector3(), sTmp = new THREE.Vector3();
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  /** p: { walk, seated, swim, swimSpd, cast, charge, tilt, fight, idle, rod(bool), row:{R,L,stroke}|null } */
  function animate(dt, t, p) {
    dt = Math.min(Math.max(dt, 1e-3), 0.05);
    st.sw += ((p.swim ? 1 : 0) - st.sw) * (1 - Math.exp(-dt * 6)); const swm = st.sw;
    st.swPh += dt * (p.swim ? (1.8 + 4.2 * (p.swimSpd || 0)) : 0);
    st.rw += ((p.row ? 1 : 0) - st.rw) * (1 - Math.exp(-dt * 7)); const rw = st.rw;
    st.w += ((p.seated || p.swim ? 0 : p.walk) - st.w) * (1 - Math.exp(-dt * 9)); const w = st.w;
    const dW = (st.w - st.prevW) / dt; st.prevW = st.w;
    st.rn += ((p.run && w > 0.5 ? 1 : 0) - st.rn) * (1 - Math.exp(-dt * 6)); const rn = st.rn;
    st.ph += dt * (w > 0.02 ? (9.0 * (1 + 0.65 * rn) * w) + 1.2 : 0); const ph = st.ph, sp = Math.sin(ph);
    if (!p.seated) legs.forEach((l, i) => {
      const side = i === 0 ? 0 : Math.PI, s = Math.sin(ph + side);
      const fl = Math.sin(st.swPh * 2 + side) * 0.32;
      l.hip.rotation.z = (l.stand[0] * (1 - w) + (0.42 + 0.26 * rn) * w * s + 0.025 * (1 - w) * Math.sin(t * 0.5 + side * 2)) * (1 - swm) + swm * (0.05 + fl);
      l.knee.rotation.z = (l.stand[1] * (1 - w) + w * (-0.12 - (0.95 + 0.5 * rn) * Math.pow(Math.max(0, Math.cos(ph + side - 0.5)), 1.3))) * (1 - swm) + swm * (-0.18 - 0.2 * Math.max(0, -fl));
    });
    const thS = -1.22 * swm;
    rig.rotation.y = 0.07 * w * sp * (1 - swm);
    rig.rotation.z = thS + 0.05 * swm * Math.sin(st.swPh * 2);
    rig.position.x = 0.92 * Math.sin(thS);
    rig.position.y = (p.seated ? 0 : -0.6 * 0.92 * (1 - Math.cos(0.42 * w * sp))) + 0.92 * (1 - Math.cos(thS)) - 1.04 * swm + 0.02 * swm * Math.sin(t * 2.2);
    let twist = 0, lean = -0.17, gx = 0, gy = 0, tilt = p.tilt, castOn = p.cast >= 0;
    if (castOn) {
      const c = p.cast, a1 = sm(0, 0.46, c), whip = sm(0.44, 0.58, c), settle = sm(0.6, 1.2, c);
      twist = -0.6 * a1 * (1 - whip) + 0.5 * whip * (1 - settle);
      lean = -0.17 + 0.26 * a1 * (1 - whip) - 0.2 * whip * (1 - settle);
      gx = -0.1 * a1 * (1 - whip) + 0.12 * whip * (1 - settle); gy = 0.16 * a1 * (1 - whip) - 0.03 * whip * (1 - settle);
      tilt = c < 0.44 ? mix(0.5, 2.35, a1) : mix(mix(2.35, 0.22, whip), 0.45, settle);
    } else if (p.charge >= 0) { twist = -0.4 * p.charge; lean = -0.17 + 0.16 * p.charge; gx = -0.05 * p.charge; gy = 0.06 * p.charge; }
    else if (p.idle && w > 0.02) tilt = mix(p.tilt, 1.05, w);
    if (p.fight) { lean -= 0.08 * Math.min(1, p.fight); gy += 0.012 * Math.sin(t * 38) * p.fight; gx += 0.01 * Math.sin(t * 29) * p.fight; }
    if (p.row) st.lastRow = p.row; const rp = st.lastRow;
    if (rw > 0.001 && rp) { lean = mix(lean, -0.3 - 0.2 * (rp.stroke || 0), rw); twist *= 1 - rw; }
    st.stow += (((p.rod === false || swm > 0.5) ? 1 : 0) - st.stow) * (1 - Math.exp(-dt * 7)); const stw = st.stow;
    lean += 0.13 * stw * (castOn || p.charge >= 0 ? 0 : 1) * (1 - rw);
    lean -= 0.15 * rn * (1 - rw);
    const br = 0.5 + 0.5 * Math.sin(t * 1.7);
    jacket.scale.set(1 + 0.018 * br, 1 + 0.012 * br, 1 + 0.026 * br); shoulderMeshes.forEach((m, i) => { m.position.y = 0.5 + 0.007 * br; armParts[i].S.y = 0.5 + 0.007 * br; });
    packG.rotation.z = 0.06 + 0.035 * w * Math.cos(2 * ph) + 0.01 * Math.sin(t * 1.7);
    T.rotation.z = lean * (1 - swm) + 0.012 * Math.sin(t * 0.9) + 0.012 * w * Math.cos(2 * ph) + swm * 0.1;
    T.rotation.x = 0.014 * Math.sin(t * 0.5) + 0.035 * w * sp + swm * 0.12 * Math.sin(st.swPh);
    T.rotation.y = -0.16 * w * sp + twist + 0.03 * Math.sin(t * 0.35) * (1 - w) * (1 - swm) + swm * 0.28 * Math.sin(st.swPh);
    H.rotation.y = (-T.rotation.y * 0.6 + (0.2 * Math.sin(t * 0.37) + 0.04 * Math.sin(t * 1.3)) * (1 - w)) * (1 - swm) - swm * T.rotation.y * 0.8;
    H.rotation.z = -0.1 + 0.02 * w * Math.sin(2 * ph) + 0.015 * Math.sin(t * 1.7) + swm * 1.05; H.rotation.x = 0.02 * Math.sin(t * 0.6);
    // sağ el = olta tutacağı
    G.set(0.27 + gx - 0.11 * w * sp + 0.008 * Math.sin(t * 0.6 + 1), 0.22 + gy + 0.014 * w * Math.cos(2 * ph) + 0.01 * Math.sin(t * 0.8) + 0.006 * br, 0.04);
    rodPivot.position.copy(G).lerp(STOW_POS, stw);
    const tiltV = (tilt - st.tilt) / dt, tiltA = Math.max(-1500, Math.min(1500, (tiltV - st.tiltV) / dt)); st.tilt = tilt; st.tiltV = tiltV;
    const Fq = -0.06 * tiltA + 3.2 * dW + 0.8 * w * Math.cos(2 * ph) + 0.22 * Math.sin(t * 1.7) + 0.14 * Math.sin(t * 2.9);
    st.bendV += (Fq - 75 * st.bend - 6 * st.bendV) * dt; st.bend = Math.max(-0.7, Math.min(0.7, st.bend + st.bendV * dt));
    rodPivot.rotation.z = mix(tilt + 0.02 * Math.sin(t * 0.9), 1.95 + 0.02 * Math.sin(t * 1.3) + 0.03 * w * Math.cos(2 * ph), stw); rodJ2.rotation.z = st.bend * 0.3 * (1 - stw); rodJ3.rotation.z = st.bend * 0.45 * (1 - stw);
    rodPivot.scale.set(mix(1, 0.34, stw), 1, 1); rodPivot.rotation.x = 0.0; rodPivot.rotation.y = mix(0, 0.12, stw);
    rodPivot.visible = true;
    const along = 0.22 + 0.04 * Math.sin(t * 0.3), ca = Math.cos(tilt), sa = Math.sin(tilt);
    L.set(G.x + ca * along, G.y + sa * along, G.z);
    free.set(0.03 + 0.17 * (1 + 0.9 * rn) * w * sp, -0.02 + 0.03 * w * Math.abs(sp), -0.27); L.lerp(free, Math.max(sm(0.08, 0.5, w), stw));
    if (stw > 0.001) { freeR.set(0.03 - 0.17 * w * sp, -0.02 + 0.03 * w * Math.abs(sp), 0.27); G.lerp(freeR, stw); }
    if (p.rod === false && p.seated && rw < 0.5 && swm < 0.01) { G.set(0.22, 0.05, 0.12); L.set(0.2, 0.05, -0.12); } // oturur ve olta yokken eller dinlenir
    if (rw > 0.001 && rp) { T.updateWorldMatrix(true, false); rowR.copy(rp.R); rowL.copy(rp.L); T.worldToLocal(rowR); T.worldToLocal(rowL); G.lerp(rowR, rw); L.lerp(rowL, rw); }
    if (swm > 0.001) {
      for (let i = 0; i < 2; i++) {
        const a = st.swPh + i * Math.PI, c = Math.cos(a), sn = Math.sin(a), side = i === 0 ? 1 : -1;
        sTmp.set(sn > 0 ? 0.13 * sn : 0.36 * sn, 0.55 + 0.46 * c, side * (0.22 + 0.06 * Math.abs(sn)));
        (i === 0 ? G : L).lerp(sTmp, swm);
      }
    }
    const away = p.away === true;
    st.bw += ((p.bow && !p.seated && swm < 0.2 ? 1 : 0) - st.bw) * (1 - Math.exp(-dt * 9)); const bw = st.bw;
    if (bw > 0.01) {
      const dr = p.draw || 0; bowL.set(0.55, 0.3 + 0.01 * Math.sin(t * 1.3), -0.1); bowG.set(0.55 - 0.18 - 0.36 * dr + 0.01 * Math.sin(t * 38) * dr * (dr < 0.99 ? 1 : 0), 0.3, 0.06);
      G.lerp(bowG, bw); L.lerp(bowL, bw); rodPivot.visible = bw < 0.4 && !away; bowPivot.visible = bw > 0.3; bowPivot.position.copy(L); bowPivot.rotation.set(0, 0, 0);
      const nx = -0.161 - 0.36 * dr, pa = bowStrGeo.attributes.position; pa.setXYZ(0, -0.161, 0.46, 0); pa.setXYZ(1, nx, 0, 0); pa.setXYZ(2, -0.161, -0.46, 0); pa.needsUpdate = true;
      bowArrow.visible = !!p.nocked; bowArrow.position.set(nx, 0, 0);
    } else bowPivot.visible = false;
    if (bw <= 0.01) rodPivot.visible = !away;
    backGear.visible = away && swm < 0.5 && !p.seated; backGear.userData.bow.visible = bw < 0.3;
    solveArm(armParts[0], G); solveArm(armParts[1], L);
    return { tilt };
  }
  applyOutfit(DEFAULT_OUTFIT);
  animate(0.016, 0, { walk: 0, seated: false, cast: -1, charge: -1, tilt: 0.8 });
  root.userData = { rig, rodPivot, bowPivot, backGear, tip, legs, T, animate, head: H, rodJ2, rodJ3, applyOutfit, outfit };
  return root;
}
export function setSeated(f, seated) {
  const { legs } = f.userData;
  for (const l of legs) { l.hip.rotation.z = seated ? Math.PI / 2 + 0.2 : l.stand[0]; l.knee.rotation.z = seated ? -Math.PI / 2 + 0.05 : l.stand[1]; }
  f.userData.rig.position.y = 0;
}
