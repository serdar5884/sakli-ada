import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STREAM, streamQ, streamSurface, streamHalfW, terrainH, fbm, vnoise, mulberry, smooth, lakeD } from './world.js';
import { COL } from './collide.js';
import { box, buildCabin, swayMat } from './props.js';

/* =====================================================================
 *  DERE SİSTEMİ  (gölün doğu kıyısı)
 *  createStreamMesh()   : turkuaz akan su (ShaderMaterial: kayan normal, köpük, parıltı)
 *  createStreamRocks()  : yuvarlak beyaz/gri dere taşları (InstancedMesh)
 *  createStoneBridge()  : taş kemer köprü + kaynak başında tünel ağzı
 *  createHillsideHouse(): tepedeki ahşap/sıvalı ev (girilebilir)
 *  createFoliage()      : kıyı çimenleri, çalılar, çiçekler (rüzgârda sallanır)
 *  updateStream(dt)     : uTime / rüzgâr / gün ışığı
 * ===================================================================== */

const V3 = THREE.Vector3;
const windU = { value: 0 };
const state = { water: null, uniforms: null, sunDir: null, sunColor: null, haze: null };

/* ---------- yardımcılar ---------- */
function frameAt(u) { // u: 0 (ağız) → 1 (kaynak); merkez noktası + teğet
  const P = STREAM.pts, n = P.length - 1; const f = Math.min(n - 1e-6, Math.max(0, u * n)); const i = Math.floor(f), t = f - i;
  const x = P[i][0] + (P[i + 1][0] - P[i][0]) * t, z = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
  const j0 = Math.max(0, i - 1), j1 = Math.min(n, i + 2); let tx = P[j1][0] - P[j0][0], tz = P[j1][1] - P[j0][1]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
  return { x, z, tx, tz, nx: -tz, nz: tx };
}

/* ---------- 1) AKAN SU ---------- */
export function createStreamMesh(ctx) {
  const { tod, isMobile } = ctx; const NU = isMobile ? 120 : 190, NV = isMobile ? 9 : 13;
  const pos = [], uvs = [], depth = [], foam = [], dirs = [], idx = [];
  const rocks = ctx.rockList || [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU; const fr = frameAt(u); const hw = streamHalfW(u); const S = streamSurface(u);
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * 2 - 1; const w = hw * 1.08 + 0.12; const x = fr.x + fr.nx * v * w, z = fr.z + fr.nz * v * w;
      const bed = terrainH(x, z); const dep = Math.max(0, S + 0.075 - bed);
      let f = 0; for (const r of rocks) { const d = Math.hypot(x - r.x, z - r.z); const rr = r.r * 0.8 + 0.3; if (d < rr) f = Math.max(f, (1 - d / rr) * 0.9); }
      f = Math.max(f, smooth(0.78, 1.0, Math.abs(v)) * 0.6, dep < 0.05 ? 0.35 : 0);
      pos.push(x, S + 0.075, z); uvs.push(u * STREAM.len * 1.0, v * w); depth.push(dep); foam.push(Math.min(1, f)); dirs.push(fr.tx, fr.tz);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1)); geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 2)); geo.setIndex(idx);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uSunDir: { value: tod.cur.sunDir }, uSunColor: { value: tod.cur.sunColor }, uDay: { value: 1 }, uHaze: { value: tod.cur.fog },
    uShallow: { value: new THREE.Color('#8fe0c4') }, uDeep: { value: new THREE.Color('#2b9490') },
  }]);
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute float aDepth; attribute float aFoam; attribute vec2 aDir;
      uniform float uTime;
      varying vec2 vUv; varying float vDepth; varying float vFoam; varying vec2 vDir; varying vec3 vWorld; varying float vU;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv; vDepth = aDepth; vFoam = aFoam; vDir = aDir;
        vec3 p = position;
        // dikey salınım: akış yönünde ilerleyen küçük dalgalar
        p.y += 0.018 * sin(uv.x * 2.3 + uTime * 3.1 + uv.y * 1.7) + 0.012 * sin(uv.x * 4.7 + uTime * 4.6 - uv.y * 2.9);
        vec4 wp = modelMatrix * vec4(p, 1.0); vWorld = wp.xyz; vU = uv.x;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uDay; uniform vec3 uHaze; uniform vec3 uShallow; uniform vec3 uDeep;
      varying vec2 vUv; varying float vDepth; varying float vFoam; varying vec2 vDir; varying vec3 vWorld; varying float vU;
      #include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
      // iki yönde kayan yükseklik alanı (akış boyunca + çapraz)
      float hf(vec2 p, float t){
        float a = vn(p * vec2(1.1, 2.2) + vec2(t * 1.9, t * 0.35)) * 0.55 + vn(p * vec2(2.3, 4.4) + vec2(t * 2.8, -t * 0.5)) * 0.3;
        float b = vn(p * vec2(1.7, 1.5) * 1.3 + vec2(t * 1.2, -t * 0.7) + 7.0) * 0.5 + vn(p * vec2(3.9, 3.1) + vec2(t * 2.1, t * 0.9) + 3.0) * 0.25;
        return a + b;
      }
      void main(){
        vec2 p = vUv; float t = uTime;
        float e = 0.06; float h0 = hf(p, t); float hx = hf(p + vec2(e, 0.0), t); float hz = hf(p + vec2(0.0, e), t);
        vec3 N = normalize(vec3(-(hx - h0) / e * 0.22, 1.0, -(hz - h0) / e * 0.22));
        // dünya uzayına: akış yönü (vDir) ve dik
        vec3 T = normalize(vec3(vDir.x, 0.0, vDir.y)); vec3 B = vec3(-T.z, 0.0, T.x);
        N = normalize(T * N.x + vec3(0.0, N.y, 0.0) + B * N.z);
        vec3 V = normalize(cameraPosition - vWorld); vec3 L = normalize(uSunDir);
        float dep = clamp(vDepth / 0.55, 0.0, 1.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, dep));
        // sığ tabanda kostik ağı
        vec2 cp = vWorld.xz * 2.6; float c1 = abs(sin(cp.x + sin(cp.y * 1.3 + t * 1.1) * 1.4 + t * 0.9)) , c2 = abs(sin(cp.y * 1.2 + sin(cp.x * 1.1 - t * 0.8) * 1.5 - t * 0.7));
        float caus = pow(1.0 - min(c1, c2), 5.0) * (1.0 - dep * 0.7);
        col += vec3(0.55, 0.85, 0.75) * caus * 0.35 * uDay;
        // gökyüzü yansıması (fresnel)
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0); col = mix(col, uHaze * 0.9 + vec3(0.04), fr * 0.5);
        // güneş parıltıları
        vec3 R = reflect(-L, N); float sp = pow(max(dot(R, V), 0.0), 140.0); float sp2 = pow(max(dot(R, V), 0.0), 18.0);
        float sparkle = smoothstep(0.55, 0.9, vn(vWorld.xz * 9.0 + vec2(t * 2.4, t * 0.8))) ;
        col += uSunColor * (sp * (0.9 + sparkle * 1.6) + sp2 * 0.1) * uDay;
        // köpük: taş çevresi + kıyı + ağız
        float fn = vn(vec2(p.x * 2.2 + t * 2.6, p.y * 3.4)) * 0.6 + vn(vec2(p.x * 5.1 + t * 3.8, p.y * 6.3 + 4.0)) * 0.4;
        float mouth = 1.0 - smoothstep(0.0, 7.0, vU);
        float fo = clamp(vFoam + mouth * 0.7, 0.0, 1.0);
        float fm = smoothstep(0.5, 0.74, fn + fo * 0.7 - 0.42) * smoothstep(0.0, 0.35, fo);
        col = mix(col, vec3(0.96, 0.99, 0.98), clamp(fm, 0.0, 1.0) * 0.9);
        // alfa: sığda saydam (taban görünür), derinde daha opak
        float alpha = mix(0.2, 0.74, smoothstep(0.0, 0.9, dep)); alpha = max(alpha, fm * 0.92);
        alpha *= smoothstep(0.0, 6.0, vU) ;
        // tünel ağzı: kaynağa doğru kararır
        float tl = smoothstep(0.0, 1.8, STREAMLEN - vU); col *= mix(0.08, 1.0, tl);
        col *= mix(0.22, 1.0, uDay);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`.replace(/STREAMLEN/g, STREAM.len.toFixed(1)),
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.name = 'stream';
  state.water = mesh; state.uniforms = uniforms; return mesh;
}

/* ---------- 2) DERE TAŞLARI ---------- */
function riverRockGeo(seed, flat) {
  let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, v = new V3(); const col = new Float32Array(p.count * 3); const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = fbm(v.x * 1.25 + seed + v.y * 0.6, v.z * 1.25 - seed - v.y * 0.8, 3) - 0.5; const n2 = vnoise(v.x * 3.1 + seed, v.z * 3.1 + v.y * 2.0) - 0.5;
    const k = 1 + n * 0.34 + n2 * 0.07; v.multiplyScalar(k); v.y *= flat ? 0.5 : 0.68; if (v.y < 0) v.y *= 0.55; p.setXYZ(i, v.x, v.y, v.z);
    const shade = 0.86 + n2 * 0.5 + n * 0.25; c.setRGB(0.93 * shade, 0.9 * shade, 0.84 * shade); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
export function createStreamRocks(ctx) {
  const { isMobile } = ctx; const rnd = mulberry(909); const list = []; const dummy = new THREE.Object3D();
  const N = isMobile ? 78 : 112; const q = { x: 0, z: 0 };
  const tints = ['#ffffff', '#f4efe4', '#d9d6cf', '#bdbab2', '#a7a8a5'].map((c) => new THREE.Color(c));
  const place = (u, off, s, bank) => {
    const fr = frameAt(u); const hw = streamHalfW(u); const x = fr.x + fr.nx * off * hw, z = fr.z + fr.nz * off * hw; const S = streamSurface(u);
    const bed = terrainH(x, z); const sy = s * (0.5 + rnd() * 0.25); const y = bank ? bed + sy * 0.2 : Math.max(bed - 0.1, S + (-0.28 + rnd() * 0.75) - 1.1 * sy);
    list.push({ x, z, y, s, sy, r: s * 0.95, bank, ry: rnd() * 6.28, S });
  };
  let tries = 0; while (list.length < N && tries++ < 4000) {
    const u = 0.025 + rnd() * 0.955; const big = rnd() < 0.18; const s = big ? 0.8 + rnd() * 0.55 : 0.28 + rnd() * rnd() * 0.65;
    const off = (rnd() * 2 - 1) * (big ? 0.7 : 0.9);
    const fr = frameAt(u); const x = fr.x + fr.nx * off * streamHalfW(u), z = fr.z + fr.nz * off * streamHalfW(u);
    if (list.some((r) => Math.hypot(r.x - x, r.z - z) < (r.r + s) * 0.9)) continue; if (lakeD(x, z) < 0.2 && false) continue;
    place(u, off, s, false);
  }
  // kıyı taşları (yarı gömülü, gri)
  for (let k = 0; k < (isMobile ? 40 : 64); k++) { const u = 0.02 + rnd() * 0.97; const side = rnd() < 0.5 ? -1 : 1; const off = side * (1.02 + rnd() * 0.35); const s = 0.25 + rnd() * rnd() * 0.7; place(u, off, s, true); }
  const geos = [riverRockGeo(1.3, false), riverRockGeo(7.7, true)];
  const meshes = geos.map((g) => { const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }), list.length); im.castShadow = true; im.receiveShadow = true; im.count = 0; return im; });
  list.forEach((r, i) => {
    const im = meshes[i % 2]; dummy.position.set(r.x, r.y, r.z); dummy.rotation.set((rnd() - 0.5) * 0.25, r.ry, (rnd() - 0.5) * 0.25); dummy.scale.set(r.s * (1.05 + rnd() * 0.3), r.sy / 0.6 * 1.0, r.s * (0.85 + rnd() * 0.25)); dummy.updateMatrix(); im.setMatrixAt(im.count, dummy.matrix);
    const c = tints[(rnd() * tints.length) | 0]; im.setColorAt(im.count, r.bank ? c.clone().multiplyScalar(0.8) : c); im.count++;
    if (r.s > 0.62) COL.addTree(r.x, r.z, r.s * 0.72);
  });
  const g = new THREE.Group(); g.name = 'streamRocks'; for (const im of meshes) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
  g.userData.list = list; return g;
}

/* ---------- 3) TAŞ KEMER KÖPRÜ + TÜNEL AĞZI ---------- */
function archShape(Wl, yb, topFn, hx, yArc, ry, segs = 24) {
  const sh = new THREE.Shape(); sh.moveTo(-Wl / 2, yb); sh.lineTo(Wl / 2, yb); const n = 28; for (let i = 0; i <= n; i++) { const x = Wl / 2 - (Wl * i) / n; sh.lineTo(x, topFn(x)); } sh.closePath();
  const hole = new THREE.Path(); hole.moveTo(hx, yArc); hole.absellipse(0, yArc, hx, ry, 0, Math.PI, false, 0); hole.lineTo(hx, yArc); sh.holes.push(hole); return sh;
}
export function createStoneBridge(ctx) {
  const { M } = ctx; const g = new THREE.Group(); g.name = 'streamStone';
  const stoneM = M.stone;
  // ---- köprü ----
  const b = STREAM.bridge; const L = b.L; const bridge = new THREE.Group(); const th = Math.atan2(-b.az, b.ax); bridge.position.set(b.x, 0, b.z); bridge.rotation.y = th;
  const topFn = (x) => { const q = (2 * x) / L, qq = q * q; return b.Yc * (1 - qq) + (x > 0 ? b.yR : b.yL) * qq; };
  const yb = Math.min(b.yL, b.yR, b.Sb - 0.8) - 0.6; const deckW = 2.3; const hx = b.hw + 0.6, yArc = b.Sb - 0.6, ry = 1.5;
  const sh = archShape(L, yb, topFn, hx, yArc, ry);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: deckW, bevelEnabled: false, curveSegments: 20 }), stoneM); body.position.z = -deckW / 2; body.castShadow = body.receiveShadow = true; bridge.add(body);
  // kemer halkası (açık renk taşlar)
  { const rs = new THREE.Shape(); rs.absellipse(0, yArc, hx + 0.34, ry + 0.34, 0, Math.PI, false, 0); rs.absellipse(0, yArc, hx, ry, Math.PI, 0, true, 0); rs.closePath();
    const rm = new THREE.MeshStandardMaterial({ color: '#d7d2c4', roughness: 0.95 }); for (const sd of [-1, 1]) { const r = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 0.14, bevelEnabled: false, curveSegments: 20 }), rm); r.position.z = sd * (deckW / 2) + (sd > 0 ? 0 : -0.14); r.castShadow = true; bridge.add(r); } }
  // korkuluk (eğriyi izler)
  const NP = 14; for (const sd of [-1, 1]) for (let i = 0; i < NP; i++) {
    const x0 = -L / 2 + (L * i) / NP, x1 = -L / 2 + (L * (i + 1)) / NP; const y0 = topFn(x0), y1 = topFn(x1); const len = Math.hypot(x1 - x0, y1 - y0) + 0.02; const pr = box(len, 0.62, 0.3, stoneM, (x0 + x1) / 2, (y0 + y1) / 2 + 0.31, sd * (deckW / 2 - 0.12)); pr.rotation.z = Math.atan2(y1 - y0, x1 - x0); bridge.add(pr);
    const cap = box(len + 0.04, 0.1, 0.4, new THREE.MeshStandardMaterial({ color: '#cfc9ba', roughness: 0.95 }), (x0 + x1) / 2, (y0 + y1) / 2 + 0.66, sd * (deckW / 2 - 0.12)); cap.rotation.z = pr.rotation.z; bridge.add(cap);
  }
  g.add(bridge);
  for (const sd of [-1, 1]) { const cx = b.x + b.tx * sd * (deckW / 2 - 0.12), cz = b.z + b.tz * sd * (deckW / 2 - 0.12); COL.addRect('stream', cx, cz, th, L / 2, 0.17); }
  // ---- kaynak başı: tünel ağzı (kemer duvarı) ----
  const w = STREAM.wall; const hw0 = streamHalfW(1), S0 = streamSurface(1); const Wl = 2 * (hw0 + 3.8), depth = 2.8; const wy0 = S0 - 0.9;
  const lat = Wl / 2 - 0.6; const tAx = -w.tz, tAz = w.tx; const topY = Math.max(S0 + 2.3, terrainH(w.x + tAx * lat + w.tx * 1.5, w.z + tAz * lat + w.tz * 1.5) + 0.2, terrainH(w.x - tAx * lat + w.tx * 1.5, w.z - tAz * lat + w.tz * 1.5) + 0.2); const wH = topY - S0 + 0.8;
  const wall = new THREE.Group(); wall.position.set(w.x, 0, w.z); wall.rotation.y = Math.atan2(w.tx, w.tz);
  const tsh = new THREE.Shape(); tsh.moveTo(-Wl / 2, wy0); tsh.lineTo(Wl / 2, wy0); tsh.lineTo(Wl / 2, S0 + wH - 0.8); tsh.lineTo(-Wl / 2, S0 + wH - 0.8); tsh.closePath();
  const rx = hw0 * 0.95 + 0.2, ryT = 1.55, yA = S0 - 0.55; const hole = new THREE.Path(); hole.moveTo(rx, yA); hole.absellipse(0, yA, rx, ryT, 0, Math.PI, false, 0); hole.lineTo(rx, yA); tsh.holes.push(hole);
  const wm = new THREE.Mesh(new THREE.ExtrudeGeometry(tsh, { depth, bevelEnabled: false, curveSegments: 20 }), stoneM); wm.castShadow = wm.receiveShadow = true; wall.add(wm);
  { const rs = new THREE.Shape(); rs.absellipse(0, yA, rx + 0.36, ryT + 0.36, 0, Math.PI, false, 0); rs.absellipse(0, yA, rx, ryT, Math.PI, 0, true, 0); rs.closePath(); const r = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 0.18, bevelEnabled: false, curveSegments: 20 }), new THREE.MeshStandardMaterial({ color: '#d7d2c4', roughness: 0.95 })); r.position.z = -0.08; r.castShadow = true; wall.add(r); }
  // karanlık iç (tünel)
  wall.add(box(rx * 2 + 0.1, ryT + 0.6, depth - 0.1, new THREE.MeshBasicMaterial({ color: '#050807' }), 0, yA + (ryT - 0.6) / 2 + 0.02, depth / 2 + 0.2, false));
  wall.add(box(Wl + 0.6, 0.22, depth + 0.4, new THREE.MeshStandardMaterial({ color: '#cfc9ba', roughness: 0.95 }), 0, S0 + wH - 0.69, depth / 2));
  // kanat duvarları (kıyıya uzanır)
  for (const sd of [-1, 1]) { const wg = box(0.7, 1.7, 3.2, stoneM, sd * (Wl / 2 + 0.1), S0 + 0.45, -1.2); wg.rotation.y = sd * -0.55; wall.add(wg); }
  g.add(wall);
  COL.addRect('stream', w.x + w.tx * depth / 2, w.z + w.tz * depth / 2, Math.atan2(w.tx, w.tz), Wl / 2, depth / 2);
  g.userData.wall = wall; return g;
}

/* ---------- 4) TEPEDEKİ EV ---------- */
export function createHillsideHouse(ctx) {
  const { M, town, TM, buildInterior, bake, scene } = ctx; const H = STREAM.house;
  const Lx = 5.4, W = 4.8, wallH = 2.4, rise = 1.85;
  const cab = buildCabin(M, { Lx, W, wallH, floors: 2, rise, mats: { wall: TM.walls.cream.wall, gable: TM.walls.cream.gable, roof: TM.roofs.terra2, door: new THREE.MeshStandardMaterial({ color: '#5a3b24', roughness: 0.85 }) }, timber: true, shutter: '#4d8a52', roundWin: false, dormer: true, chimney2: false, flowers: true, open: true, porch: 1.3 });
  cab.add(box(Lx + 0.36, 2.6, W + 0.36, M.stone, 0, 0.3 - 1.3, 0)); cab.add(box(0.7, 0.4, 1.5, M.stone, Lx / 2 + 0.38, 0.0, 0)); cab.add(box(0.5, 0.4, 1.3, M.stone, Lx / 2 + 0.78, -0.1, 0));
  const y0 = H.h + 0.14; const rot = Math.atan2(H.tz, -H.tx); cab.position.set(H.x, y0, H.z); cab.rotation.y = rot; scene.add(cab);
  const baked = bake(cab); scene.remove(cab); baked.userData = { chimneys: cab.userData.chimneys, hill: true }; scene.add(baked);
  const it = buildInterior(M, Lx, W, 0.3, 'home', 17, { wallH: cab.userData.wallH, rise: cab.userData.rise }); it.group.position.set(H.x, y0, H.z); it.group.rotation.y = rot; scene.add(it.group); const ib = bake(it.group); scene.remove(it.group); scene.add(ib);
  for (const l of it.lamps) town.addGlow(H.x + l[0] * Math.cos(rot) + l[2] * Math.sin(rot), y0 + 0.36, H.z - l[0] * Math.sin(rot) + l[2] * Math.cos(rot), 1);
  town.addEnterable({ id: 'hill', wx: H.x, wz: H.z, rot, floorY: y0 + 0.3, Lx, W, shell: baked, interior: ib, cols: it.cols });
  // ev çevresi: küçük çit, kapı önünde taş basamak
  baked.userData.rot = rot; return { shell: baked, interior: ib, rot, pos: new V3(H.x, y0, H.z) };
}

/* ---------- 5) KIYI ÇİMENİ, ÇALILAR, ÇİÇEKLER ---------- */
export function createFoliage(ctx) {
  const { isMobile } = ctx; const rnd = mulberry(4242); const g = new THREE.Group(); g.name = 'streamFoliage';
  const tuft = () => { // 7 bıçaklı püskül, kökte koyu → uçta açık yeşil
    const parts = []; const r2 = mulberry(8); const c0 = new THREE.Color('#2c5c1c'), c1 = new THREE.Color('#9ad04a');
    for (let b = 0; b < 7; b++) { const a = (b / 7) * 6.28 + r2() * 0.6, h = 0.5 + r2() * 0.65, lean = 0.12 + r2() * 0.32, w = 0.045; const nx = -Math.sin(a), nz = Math.cos(a); const bx = Math.cos(a) * (0.05 + r2() * 0.12), bz = Math.sin(a) * (0.05 + r2() * 0.12);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([bx - nx * w, 0, bz - nz * w, bx + nx * w, 0, bz + nz * w, bx + Math.cos(a) * lean * 0.5 - nx * w * 0.5, h * 0.6, bz + Math.sin(a) * lean * 0.5 - nz * w * 0.5, bx + Math.cos(a) * lean * 0.5 + nx * w * 0.5, h * 0.6, bz + Math.sin(a) * lean * 0.5 + nz * w * 0.5, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean], 3));
      geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); const cs = [c0, c0, c0.clone().lerp(c1, 0.6), c0.clone().lerp(c1, 0.6), c1]; geo.setAttribute('color', new THREE.Float32BufferAttribute(cs.flatMap((c) => [c.r, c.g, c.b]), 3)); geo.computeVertexNormals(); parts.push(geo); }
    return mergeGeometries(parts);
  };
  const grassMat = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), windU, 0.55);
  const N = isMobile ? 2600 : 4200; const im = new THREE.InstancedMesh(tuft(), grassMat, N); const m = new THREE.Matrix4(); let n = 0; const rocks = ctx.rockList || [];
  const q = { d: 0, u: 0 }; let tries = 0;
  while (n < N && tries++ < N * 8) {
    const u = 0.01 + rnd() * 0.99; const fr = frameAt(u); const hw = streamHalfW(u); const side = rnd() < 0.5 ? -1 : 1; const off = hw * (0.82 + rnd() * 0.3) + Math.pow(rnd(), 1.5) * 6.5; const x = fr.x + fr.nx * side * off, z = fr.z + fr.nz * side * off;
    const y = terrainH(x, z); if (y < 0.03) continue; const S = streamSurface(u); if (y < S - 0.02) continue;
    if (rocks.some((r) => (r.x - x) ** 2 + (r.z - z) ** 2 < (r.r * 0.85) ** 2)) continue;
    const sc = (0.5 + rnd() * 0.75) * (off < hw * 1.1 ? 0.8 : 1);
    m.compose(new V3(x, y - 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.15, rnd() * 6.28, (rnd() - 0.5) * 0.15)), new V3(sc, sc * (0.8 + rnd() * 0.6), sc)); im.setMatrixAt(n, m); const t = 0.85 + rnd() * 0.3; im.setColorAt(n, new THREE.Color(t, t * (0.96 + rnd() * 0.1), t * 0.9)); n++;
  }
  im.count = n; im.receiveShadow = true; g.add(im);
  // çalılar / eğreltiler
  { const bush = mergeGeometries([0, 1, 2, 3].map((i) => { const geo = new THREE.IcosahedronGeometry(0.42 + (i % 2) * 0.1, 0); const a = i * 1.7; geo.translate(Math.cos(a) * 0.3, 0.3 + (i % 3) * 0.08, Math.sin(a) * 0.3); const c = new THREE.Color(['#3d7a2a', '#4f8f30', '#5ea03a', '#356f26'][i]); const arr = new Float32Array(geo.attributes.position.count * 3); for (let k = 0; k < arr.length; k += 3) { arr[k] = c.r; arr[k + 1] = c.g; arr[k + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); geo.deleteAttribute('uv'); return geo; }));
    const bm = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), windU, 0.05);
    const NB = isMobile ? 46 : 80; const bi = new THREE.InstancedMesh(bush, bm, NB); let k = 0; tries = 0;
    while (k < NB && tries++ < 3000) { const u = 0.03 + rnd() * 0.96; const fr = frameAt(u); const hw = streamHalfW(u); const side = rnd() < 0.5 ? -1 : 1; const off = hw + 0.9 + rnd() * 5.5; const x = fr.x + fr.nx * side * off, z = fr.z + fr.nz * side * off; const y = terrainH(x, z); if (y < 0.2) continue; const s = 0.7 + rnd() * 0.9;
      m.compose(new V3(x, y - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new V3(s, s * 0.85, s)); bi.setMatrixAt(k++, m); }
    bi.count = k; bi.castShadow = true; bi.receiveShadow = true; g.add(bi); }
  // kır çiçekleri (beyaz papatya, sarı, mor)
  { const head = new THREE.IcosahedronGeometry(0.05, 0); const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.38, 4); stem.translate(0, 0.19, 0); head.translate(0, 0.4, 0);
    const mk = (geo, hex) => { const c = new THREE.Color(hex); const a = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } const gg = geo.index ? geo.toNonIndexed() : geo.clone(); gg.deleteAttribute('uv'); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); return gg; };
    const fl = mergeGeometries([mk(stem, '#4f8a34'), mk(head, '#ffffff')]); const fm = swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), windU, 0.4);
    const NF = isMobile ? 260 : 520; const fi = new THREE.InstancedMesh(fl, fm, NF); let k = 0; tries = 0; const pal = ['#ffffff', '#f6e04a', '#c78ae8', '#ff8aa0'].map((c) => new THREE.Color(c));
    while (k < NF && tries++ < 6000) { const u = 0.02 + rnd() * 0.97; const fr = frameAt(u); const hw = streamHalfW(u); const side = rnd() < 0.5 ? -1 : 1; const off = hw + 0.5 + rnd() * 6; const x = fr.x + fr.nx * side * off, z = fr.z + fr.nz * side * off; const y = terrainH(x, z); if (y < 0.2) continue;
      m.compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new V3(1, 0.7 + rnd() * 0.8, 1).multiplyScalar(0.9 + rnd() * 0.5)); fi.setMatrixAt(k, m); fi.setColorAt(k, pal[(rnd() * 4) | 0]); k++; }
    fi.count = k; g.add(fi); }
  return g;
}

/* ---------- hepsini kur ---------- */
export function buildStream(ctx) {
  const group = new THREE.Group(); group.name = 'streamSystem';
  const rocks = createStreamRocks(ctx); ctx.rockList = rocks.userData.list;
  const water = createStreamMesh(ctx); const bridge = createStoneBridge(ctx); const foliage = createFoliage(ctx);
  group.add(water, rocks, bridge, foliage); ctx.scene.add(group);
  const house = createHillsideHouse(ctx);
  return { group, water, rocks, bridge, foliage, house };
}

/** her karede çağır: akan su zamanı, rüzgâr, gün ışığı */
export function updateStream(dt, dayK = 1) {
  windU.value += dt; if (state.uniforms) { state.uniforms.uTime.value += dt; state.uniforms.uDay.value = dayK; }
}
