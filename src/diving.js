import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry, smooth, clamp, lerp, fbm, vnoise } from './world.js';
import { createWreck, findWreckSpots } from './wrecks.js';
import { createSeabed } from './seabed.js';
import { createSolids } from './solids.js';
import { kelpGeometry, rockGeometry, bake2, tmpC, WATER_LEVEL, DIVE_U, V3, M4, Q4, C3, TAU, angDiff, tint, bare, piece, beamGeo, patchDiveMaterial } from './diveutil.js';

/**
 * DALIŞ MODU — yüzey (SURFACE_MODE) ↔ su altı (UNDERWATER_MODE)
 *
 *  createScubaDiver()          tüplü dalgıç (neopren giysi, sarı/turuncu şeritler, maske, şnorkel, regülatör, tüp, hortumlar, paletler)
 *  updateDiverMovement()       3B yüzme fiziği: yaw/pitch, ileri itiş, su direnci, eylemsizlik, dip/yüzey çarpışması
 *  setUnderwaterAtmosphere()   kamera suyun altına girerken sis, ışık, gökyüzü, yüzey altı yüzeyi, ışık huzmeleri
 *  createSunkenShipwreck()     yan yatmış, yosunlu, delikli ahşap balıkçı teknesi
 *  createLakeFlora()           rüzgâr/akıntıyla sallanan kelp + göl otları, nehir taşları, yosunlu oluşumlar, tatlı su süngerleri (InstancedMesh)
 *  createFishBoids()           boids sürü davranışlı balık okulları (dalgıç yaklaşınca dağılırlar)
 *  createDiveSystem()          hepsini bağlayan durum yöneticisi (kamera/kontrol/görünürlük/sis geçişleri)
 */

export const MODE = Object.freeze({ SURFACE: 'SURFACE_MODE', UNDERWATER: 'UNDERWATER_MODE' });
export { WATER_LEVEL, DIVE_U, patchDiveMaterial };

/* ============================================================
 *  1) TÜPLÜ DALGIÇ
 * ============================================================ */
function neopreneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1b2027'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = '#2b343f'; g.beginPath(); g.arc(x * 8 + (y % 2) * 4 + 3, y * 8 + 3, 2.3, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); t.anisotropy = 4; return t;
}

/**
 * Yatay yüzme duruşunda (+X ileri, +Y sırt/tüp tarafı, Z yanlar) tüplü dalgıç.
 * Dönen: { group, body, update(dt, {speed, vy}), maskLocal }
 *   group  → konum + yaw (rotation.y = -yaw)
 *   body   → pitch (rotation.z) + roll (rotation.x)
 */
export function createScubaDiver() {
  const root = new THREE.Group(); root.name = 'scubaDiver'; const body = new THREE.Group(); root.add(body);
  const tex = neopreneTexture();
  const suit = new THREE.MeshStandardMaterial({ color: '#2c333c', map: tex, bumpMap: tex, bumpScale: 0.9, roughness: 0.72, metalness: 0.1 });
  const yel = new THREE.MeshStandardMaterial({ color: '#ffc21a', roughness: 0.5, emissive: '#7a5600', emissiveIntensity: 0.3 });
  const org = new THREE.MeshStandardMaterial({ color: '#ff6a13', roughness: 0.5, emissive: '#6a2400', emissiveIntensity: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#101215', roughness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#cfd6dc', metalness: 0.85, roughness: 0.28 });
  const tankM = new THREE.MeshStandardMaterial({ color: '#b3bcc4', metalness: 0.55, roughness: 0.38 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e0aa86', roughness: 0.8, emissive: '#5a2f22', emissiveIntensity: 0.18 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#a8ecff', transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const finM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const mk = (geo, mat, x = 0, y = 0, z = 0, parent = body) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const ell = (sx, sy, sz, seg = 14) => { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)); g.scale(sx, sy, sz); return g; };
  const alongX = (g) => { g.rotateZ(Math.PI / 2); return g; };

  // gövde + leğen
  mk(ell(0.44, 0.17, 0.21, 18), suit, 0.02, 0, 0); mk(ell(0.2, 0.145, 0.185), suit, -0.32, -0.005, 0);
  // gövde yan şeritleri (elipsoit yüzeyine oturan tüpler): sarı + turuncu
  for (const side of [1, -1]) for (const [yy, mat, r] of [[0.02, yel, 0.017], [-0.035, org, 0.013]]) {
    const pts = []; for (let i = 0; i <= 14; i++) { const x = -0.34 + i * (0.68 / 14); const ex = (x - 0.02) / 0.44; const sc = Math.sqrt(Math.max(0.02, 1 - ex * ex - (yy / 0.17) ** 2)); pts.push(new V3(x, yy, side * 0.21 * sc * 1.02)); }
    mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 5), mat);
  }
  // kafa: kukuleta + yüz + maske
  mk(ell(0.14, 0.125, 0.118, 14), suit, 0.5, 0.005, 0);
  mk(ell(0.07, 0.082, 0.084), skin, 0.575, -0.012, 0);
  mk(new THREE.BoxGeometry(0.075, 0.098, 0.205), rubber, 0.628, 0.0, 0);                       // maske çerçevesi
  mk(new THREE.BoxGeometry(0.008, 0.078, 0.176), glass, 0.668, 0.0, 0).castShadow = false;       // saydam cam
  mk(new THREE.BoxGeometry(0.03, 0.02, 0.215), yel, 0.6, 0.055, 0);                              // maske üst şeridi
  { const g = new THREE.TorusGeometry(0.128, 0.011, 6, 18); g.rotateY(Math.PI / 2); mk(g, rubber, 0.5, 0.005, 0); }   // maske bandı
  // regülatör ağızlığı + ikinci kademe
  mk(alongX(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8)), rubber, 0.61, -0.088, 0);
  mk(alongX(new THREE.CylinderGeometry(0.038, 0.038, 0.06, 12)), chrome, 0.575, -0.105, 0);
  mk(alongX(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 12)), yel, 0.608, -0.105, 0);
  // şnorkel (sol yan), sarı
  { const c = new THREE.CatmullRomCurve3([new V3(0.6, -0.075, -0.03), new V3(0.57, -0.04, -0.115), new V3(0.5, 0.06, -0.155), new V3(0.45, 0.2, -0.165), new V3(0.425, 0.33, -0.165)]);
    mk(new THREE.TubeGeometry(c, 18, 0.015, 6), yel); mk(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), rubber, 0.425, 0.345, -0.165); }
  // oksijen tüpü (sırtta) + sarı omuz kapağı + valf + bantlar
  mk(alongX(new THREE.CylinderGeometry(0.1, 0.1, 0.56, 18)), tankM, 0.0, 0.245, 0);
  { const e1 = new THREE.SphereGeometry(0.1, 12, 8); e1.scale(0.55, 1, 1); mk(e1, tankM, -0.28, 0.245, 0); const e2 = e1.clone(); mk(e2, yel, 0.28, 0.245, 0); }
  mk(alongX(new THREE.CylinderGeometry(0.103, 0.103, 0.17, 18)), yel, 0.17, 0.245, 0);
  for (const bx of [0.06, -0.14]) mk(alongX(new THREE.CylinderGeometry(0.106, 0.106, 0.032, 18)), rubber, bx, 0.245, 0);
  mk(new THREE.BoxGeometry(0.05, 0.075, 0.055), chrome, 0.325, 0.272, 0); mk(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), org, 0.325, 0.325, 0);
  // esnek hava hortumları
  const hoseMain = new THREE.CatmullRomCurve3([new V3(0.325, 0.31, 0), new V3(0.37, 0.4, 0.02), new V3(0.44, 0.34, 0.13), new V3(0.5, 0.15, 0.165), new V3(0.57, -0.02, 0.11), new V3(0.58, -0.095, 0.03)]);
  mk(new THREE.TubeGeometry(hoseMain, 28, 0.014, 6), rubber);
  const hose2 = new THREE.Group(); hose2.position.set(0.3, 0.28, 0.05); body.add(hose2);   // serbest ikinci hortum + manometre (sallanır)
  { const c = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(-0.05, -0.07, 0.15), new V3(-0.17, -0.22, 0.21), new V3(-0.3, -0.31, 0.2), new V3(-0.4, -0.35, 0.17)]);
    mk(new THREE.TubeGeometry(c, 22, 0.012, 6), rubber, 0, 0, 0, hose2); mk(alongX(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 14)), yel, -0.42, -0.36, 0.17, hose2); mk(alongX(new THREE.CylinderGeometry(0.025, 0.025, 0.022, 12)), chrome, -0.425, -0.36, 0.17, hose2); }

  // kollar (omuz → dirsek), eldivenli
  const arms = [];
  for (const side of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(0.3, -0.02, side * 0.235); body.add(sh);
    mk(alongX(new THREE.CapsuleGeometry(0.052, 0.19, 4, 10)).translate(-0.14, 0, 0), suit, 0, 0, 0, sh);
    for (const [bx, mat] of [[-0.09, yel], [-0.14, org]]) { const g = new THREE.CylinderGeometry(0.058, 0.058, 0.022, 12, 1, true); g.rotateZ(Math.PI / 2); mk(g, mat, bx, 0, 0, sh); }
    const el = new THREE.Group(); el.position.set(-0.29, 0, 0); sh.add(el);
    mk(alongX(new THREE.CapsuleGeometry(0.044, 0.16, 4, 10)).translate(-0.12, 0, 0), suit, 0, 0, 0, el);
    { const g = new THREE.CylinderGeometry(0.049, 0.049, 0.02, 12, 1, true); g.rotateZ(Math.PI / 2); mk(g, yel, -0.1, 0, 0, el); }
    mk(ell(0.06, 0.05, 0.05, 10), rubber, -0.27, 0, 0, el);
    arms.push({ sh, el, side });
  }
  // bacaklar (kalça → diz → bilek) + paletler
  const legs = [];
  const finGeo = (() => {
    const s = new THREE.Shape(); s.moveTo(0, -0.045); s.lineTo(0.12, -0.06); s.lineTo(0.5, -0.125); s.lineTo(0.44, 0.0); s.lineTo(0.5, 0.125); s.lineTo(0.12, 0.06); s.lineTo(0, 0.045); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.scale(-1, 1, 1); g.translate(0, -0.007, 0);
    const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3); const cb = new C3('#14161a'), cy = new C3('#ffc21a'), co = new C3('#ff6a13');
    for (let i = 0; i < n; i++) { const d = -p.getX(i); const c = d > 0.38 ? cy : (d > 0.3 ? co : cb); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.computeVertexNormals(); return g; })();
  for (const side of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(-0.36, -0.012, side * 0.1); body.add(hip);
    mk(alongX(new THREE.CapsuleGeometry(0.07, 0.22, 4, 10)).translate(-0.16, 0, 0), suit, 0, 0, 0, hip);
    for (const [bx, mat] of [[-0.14, yel], [-0.2, org]]) { const g = new THREE.CylinderGeometry(0.075, 0.075, 0.024, 12, 1, true); g.rotateZ(Math.PI / 2); mk(g, mat, bx, 0, 0, hip); }
    const knee = new THREE.Group(); knee.position.set(-0.37, 0, 0); hip.add(knee);
    mk(alongX(new THREE.CapsuleGeometry(0.058, 0.2, 4, 10)).translate(-0.14, 0, 0), suit, 0, 0, 0, knee);
    { const g = new THREE.CylinderGeometry(0.063, 0.063, 0.022, 12, 1, true); g.rotateZ(Math.PI / 2); mk(g, yel, -0.13, 0, 0, knee); }
    if (side > 0) mk(new THREE.BoxGeometry(0.17, 0.03, 0.045), rubber, -0.14, 0.055, 0.0, knee);   // dalış bıçağı kınında
    const ank = new THREE.Group(); ank.position.set(-0.33, 0, 0); ank.rotation.z = 0.12; knee.add(ank);
    mk(ell(0.075, 0.05, 0.055, 10), rubber, -0.03, 0, 0, ank);
    mk(finGeo, finM, -0.05, 0, 0, ank);
    legs.push({ hip, knee, ank, side });
  }

  const maskLocal = new V3(0.7, 0.02, 0); let phase = 0, spdS = 0;
  return {
    group: root, body, maskLocal,
    /** o: { speed: 0..1, vy } */
    update(dt, o) {
      spdS += (o.speed - spdS) * (1 - Math.exp(-dt * 4)); const sp = spdS;
      phase += dt * (2.4 + 7.8 * sp); const kA = 0.15 + 0.34 * sp;
      for (const L of legs) { const ph = phase + (L.side > 0 ? 0 : Math.PI); L.hip.rotation.z = Math.sin(ph) * kA + 0.07; L.knee.rotation.z = (Math.sin(ph - 0.9) * 0.5 + 0.5) * (0.12 + 0.3 * sp); L.ank.rotation.z = 0.12 + Math.sin(ph - 1.6) * (0.12 + 0.26 * sp); L.hip.rotation.y = Math.sin(phase * 0.5) * 0.03 * L.side; }
      const aA = 0.12 + 0.4 * sp;
      for (const A of arms) { const ph = phase * 0.55 + (A.side > 0 ? 0 : Math.PI); A.sh.rotation.z = 0.14 + Math.sin(ph) * aA; A.sh.rotation.y = A.side * (0.2 + 0.1 * Math.sin(ph + 1) * sp); A.el.rotation.z = 0.2 + (Math.cos(ph) * 0.5 + 0.5) * (0.15 + 0.5 * sp); }
      hose2.rotation.x = Math.sin(phase * 0.6) * 0.12 + o.vy * 0.05; hose2.rotation.z = Math.sin(phase * 0.45 + 1) * 0.08 - sp * 0.15;
      body.position.y = Math.sin(phase * 0.5) * 0.012;   // hafif dalgalanma
    },
  };
}

/* ============================================================
 *  2) 3B YÜZME FİZİĞİ
 * ============================================================ */
export const DIVE_PHYS = { thrust: 4.2, vert: 3.8, drag: 1.35, drag2: 0.38, maxSpeed: 3.0, maxVert: 1.9, turn: 3.4, clear: 0.42, ceil: -0.12, buoy: 0.35 };

/**
 * D   : { x, y, z, vx, vy, vz, yaw, pitch, roll, speed }  (yaw: dir = (cos, sin))
 * cmd : { dirX, dirZ, mag, up, down }   — dirX/dirZ kamera-göreli yatay istek (joystick), mag 0..1
 * env : { bedAt(x,z), t, collide?(x,z)→{x,z} }
 * dönen: { surfaced, depth, speed01 }
 */
export function updateDiverMovement(D, cmd, dt, env) {
  const P = DIVE_PHYS; dt = Math.min(dt, 0.05);
  const has = cmd.mag > 0.05; const v = (cmd.up ? 1 : 0) - (cmd.down ? 1 : 0);
  let dyaw = 0; if (has) { dyaw = angDiff(Math.atan2(cmd.dirZ, cmd.dirX), D.yaw); D.yaw += dyaw * (1 - Math.exp(-dt * P.turn)); if (D.yaw > Math.PI) D.yaw -= TAU; else if (D.yaw < -Math.PI) D.yaw += TAU; }
  const cp = Math.cos(D.pitch), thrust = has ? P.thrust * cmd.mag * Math.min(1, 0.45 + Math.abs(Math.cos(dyaw)) * 0.8) : 0; // dönüş sırasında itiş azalır
  let ax = Math.cos(D.yaw) * cp * thrust, az = Math.sin(D.yaw) * cp * thrust, ay = Math.sin(D.pitch) * thrust * 0.85 + v * P.vert;
  ay += (Math.sin(env.t * 0.9) * 0.5) * P.buoy * (has ? 0.2 : 1) * 0.35;   // hafif dalgalanan kaldırma
  D.vx += ax * dt; D.vy += ay * dt; D.vz += az * dt;
  const sp = Math.hypot(D.vx, D.vy, D.vz); const drag = Math.exp(-dt * (P.drag + P.drag2 * sp)); D.vx *= drag; D.vy *= drag; D.vz *= drag;
  const hs = Math.hypot(D.vx, D.vz); if (hs > P.maxSpeed) { D.vx *= P.maxSpeed / hs; D.vz *= P.maxSpeed / hs; } D.vy = clamp(D.vy, -P.maxVert, P.maxVert);
  // yatay hareket + dip engeli (sığlıkta ve kıyıda ilerleme durur, kayar)
  const tryMove = (nx, nz) => env.bedAt(nx, nz) + P.clear < P.ceil - 0.3;
  let nx = D.x + D.vx * dt, nz = D.z + D.vz * dt;
  if (env.collide) { const q = env.collide(nx, nz); nx = q.x; nz = q.z; }
  const r = Math.hypot(nx, nz); if (r > 150) { nx *= 150 / r; nz *= 150 / r; }
  if (tryMove(nx, nz)) { D.x = nx; D.z = nz; }
  else if (tryMove(nx, D.z)) { D.x = nx; D.vz *= 0.3; }
  else if (tryMove(D.x, nz)) { D.z = nz; D.vx *= 0.3; }
  else { D.vx *= 0.2; D.vz *= 0.2; }
  D.y += D.vy * dt;
  if (env.solid) env.solid(D);
  const minY = env.bedAt(D.x, D.z) + P.clear; let hit = false;
  if (D.y < minY) { D.y = minY; if (D.vy < 0) D.vy *= -0.1; hit = true; }
  if (D.y > P.ceil) { D.y = P.ceil; if (D.vy > 0) D.vy = 0; hit = true; }
  // eğim (pitch) ve yatış (roll)
  const hsp = Math.hypot(D.vx, D.vz); const tp = has ? clamp(v * 0.8 + (D.vy / Math.max(0.9, hsp)) * 0.4, -1.05, 1.05) : v * 0.7;
  D.pitch += (tp - D.pitch) * (1 - Math.exp(-dt * 3.2));
  const rr = clamp(-dyaw * 0.25, -0.5, 0.5) * (has ? 1 : 0); D.roll += (rr - D.roll) * (1 - Math.exp(-dt * 4));
  D.speed = Math.hypot(D.vx, D.vy, D.vz);
  return { surfaced: D.y >= P.ceil - 0.005, depth: -D.y, speed01: clamp(D.speed / P.maxSpeed, 0, 1), hit };
}

/* ============================================================
 *  3) SU ALTI ATMOSFER (sis / ışık / gökyüzü / yüzey altı / huzmeler)
 * ============================================================ */
const _sd = new V3();
const UW_DAY = new C3('#2aa7b8'), UW_DEEP = new C3('#0a4658'), UW_NIGHT = new C3('#04202b'), _fc = new C3(), _hc = new C3('#72d6e2'), _hg = new C3('#0e5262');

/** Yüzey altı: kameraya doğru yukarı bakınca görülen su yüzeyi (Snell penceresi + dalga parıltısı) */
function createSurfaceUnderside() {
  const geo = new THREE.PlaneGeometry(700, 700, 1, 1); geo.rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, depthWrite: true, fog: false,
    uniforms: { uTime: { value: 0 }, uDay: { value: 1 }, uFogCol: { value: new C3('#2aa7b8') }, uFogD: { value: 0.08 }, uSun: { value: new C3('#fff4d6') } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec3 vW; uniform float uTime, uDay, uFogD; uniform vec3 uFogCol, uSun;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 V = vW - cameraPosition; float d = max(0.12, -cameraPosition.y); float tanA = length(V.xz) / d;
        float n1 = vn(vW.xz * 0.9 + vec2(uTime * 0.35, uTime * 0.2)), n2 = vn(vW.xz * 2.3 - vec2(uTime * 0.5, -uTime * 0.3));
        float rip = n1 * 0.6 + n2 * 0.4;
        float win = 1.0 - smoothstep(1.0, 1.3, tanA);                       // Snell penceresi (~48.6°)
        vec3 inside = mix(vec3(0.30, 0.74, 0.84), vec3(0.78, 0.98, 1.0), rip) * (0.25 + 0.75 * uDay);
        inside += uSun * pow(max(0.0, rip - 0.62) * 2.6, 2.0) * 0.5 * uDay;  // güneş parıltıları
        vec3 outside = uFogCol * (0.45 + 0.35 * rip);                        // pencere dışında: dibin yansıması
        float rim = smoothstep(0.92, 1.12, tanA) * (1.0 - smoothstep(1.12, 1.45, tanA));
        vec3 col = mix(outside, inside, win) + vec3(0.55, 0.9, 0.95) * rim * 0.18 * uDay;
        float f = 1.0 - exp(-pow(uFogD * length(V) * 0.6, 2.0)); col = mix(col, uFogCol, f);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -5; m.frustumCulled = false; m.visible = false; m.name = 'waterUnderside'; return m;
}

/** Hacimsel ışık huzmeleri: yüzeyden aşağı akan, kırılmış güneş yönünde, additive çapraz düzlemler */
function createGodRays(count) {
  const group = new THREE.Group(); group.name = 'godRays'; group.visible = false;
  const g1 = new THREE.PlaneGeometry(1, 1, 1, 6); g1.translate(0, -0.5, 0); const g2 = g1.clone(); g2.rotateY(Math.PI / 2); const geo = mergeGeometries([g1, g2]);
  const U = { uTime: { value: 0 }, uStr: { value: 0 }, uCol: { value: new C3('#bff3ff') } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: U,
    vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying float vD; uniform float uTime, uStr; uniform vec3 uCol;
      void main(){ float e = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 1.5); float fall = pow(vUv.y, 1.35);
        float fl = 0.7 + 0.3 * sin(uTime * 0.8 + vUv.y * 4.0);
        float a = e * fall * fl * smoothstep(1.2, 5.5, vD) * (1.0 - smoothstep(26.0, 44.0, vD)) * uStr; gl_FragColor = vec4(uCol * a, a); }`,
  });
  const rays = [];
  const rnd = mulberry(77);
  for (let i = 0; i < count; i++) {
    const holder = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat); const w = 1.2 + rnd() * 2.6, len = 11 + rnd() * 5; mesh.scale.set(w, len, w); mesh.rotation.y = rnd() * Math.PI; mesh.frustumCulled = false; holder.add(mesh); group.add(holder);
    rays.push({ holder, ox: (rnd() - 0.5) * 60, oz: (rnd() - 0.5) * 60 });
  }
  const align = new Q4(), down = new V3(0, -1, 0), ld = new V3();
  return {
    group, mat,
    update(t, cam, sunDir, str) {
      U.uTime.value = t; U.uStr.value = str;
      ld.set(-sunDir.x * 0.7, -Math.max(0.35, Math.abs(sunDir.y)), -sunDir.z * 0.7).normalize(); align.setFromUnitVectors(down, ld);   // suda kırılma: daha dikey
      const R = 30;
      for (const r of rays) { r.holder.quaternion.copy(align); r.holder.position.set(cam.x + ((((r.ox - cam.x) % (2 * R)) + 3 * R) % (2 * R)) - R, WATER_LEVEL + 0.2, cam.z + ((((r.oz - cam.z) % (2 * R)) + 3 * R) % (2 * R)) - R); }
    },
  };
}

/** Hava kabarcıkları + sürüklenen plankton partikülleri */
function createBubbles(max, hooks) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#e2f9ff', transparent: true, opacity: 0.52, roughness: 0.12, metalness: 0, flatShading: true, emissive: '#8fd6e6', emissiveIntensity: 0.4, depthWrite: false });
  const im = new THREE.InstancedMesh(geo, mat, max); im.frustumCulled = false; im.count = max; im.name = 'bubbles';
  const P = new Float32Array(max * 3), Vv = new Float32Array(max * 3), S = new Float32Array(max), A = new Float32Array(max), Ph = new Float32Array(max);
  const m = new M4(), q = new Q4(), pp = new V3(), ss = new V3(); const z = new M4().makeScale(0, 0, 0); for (let i = 0; i < max; i++) im.setMatrixAt(i, z);
  let cursor = 0;
  return {
    mesh: im,
    emit(x, y, z, n, size = 0.03, spread = 0.06) {
      for (let k = 0; k < n; k++) { const i = cursor++ % max; P[i * 3] = x + (Math.random() - 0.5) * spread; P[i * 3 + 1] = y + (Math.random() - 0.5) * spread; P[i * 3 + 2] = z + (Math.random() - 0.5) * spread; Vv[i * 3] = (Math.random() - 0.5) * 0.12; Vv[i * 3 + 1] = 0.45 + Math.random() * 0.45 + size * 6; Vv[i * 3 + 2] = (Math.random() - 0.5) * 0.12; S[i] = size * (0.7 + Math.random() * 0.7); A[i] = 1; Ph[i] = Math.random() * 6.28; }
    },
    update(dt, t) {
      for (let i = 0; i < max; i++) {
        if (!A[i]) continue;
        P[i * 3] += (Vv[i * 3] + Math.sin(t * 3 + Ph[i]) * 0.06) * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += (Vv[i * 3 + 2] + Math.cos(t * 2.6 + Ph[i]) * 0.06) * dt; S[i] *= 1 + dt * 0.12;
        if (P[i * 3 + 1] >= WATER_LEVEL - 0.02) { A[i] = 0; im.setMatrixAt(i, z); hooks.ripple && hooks.ripple(P[i * 3], P[i * 3 + 2], t, 0.1); continue; }
        pp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); ss.setScalar(S[i]); im.setMatrixAt(i, m.compose(pp, q, ss));
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
function createPlankton(count) {
  const pos = new Float32Array(count * 3), rnd = mulberry(5); for (let i = 0; i < count; i++) { pos[i * 3] = rnd(); pos[i * 3 + 1] = rnd(); pos[i * 3 + 2] = rnd(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uCam: { value: new V3() }, uTime: { value: 0 }, uA: { value: 0 }, uScale: { value: 700 } },
    vertexShader: `uniform vec3 uCam; uniform float uTime, uScale; varying float vA; void main(){ vec3 p = position * 28.0; vec3 w = mod(p - uCam + vec3(14.0), vec3(28.0)) - vec3(14.0); w.y += sin(uTime * 0.5 + position.x * 40.0) * 0.18; w.x += sin(uTime * 0.3 + position.z * 30.0) * 0.2; vec4 mv = viewMatrix * vec4(uCam + w, 1.0); gl_Position = projectionMatrix * mv; float d = length(mv.xyz); vA = (1.0 - smoothstep(6.0, 14.0, d)) * smoothstep(0.4, 1.4, d); gl_PointSize = clamp(uScale * 0.012 / d, 1.5, 5.0); }`,
    fragmentShader: `uniform float uA; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(c)) * vA * uA; gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * a, a); }` });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.name = 'plankton'; return pts;
}

/** Tüm su altı efektlerini toplar */
export function createUnderwaterFX({ isMobile = false, hooks = {} } = {}) {
  const group = new THREE.Group(); group.name = 'underwaterFX';
  const surface = createSurfaceUnderside(); group.add(surface);
  const rays = createGodRays(isMobile ? 9 : 16); group.add(rays.group);
  const bubbles = createBubbles(isMobile ? 70 : 120, hooks); group.add(bubbles.mesh);
  const plankton = createPlankton(isMobile ? 160 : 320); group.add(plankton);
  let overlay = null, hud = null;
  if (typeof document !== 'undefined') {
    overlay = document.createElement('div'); overlay.id = 'uwOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;transition:none;background:radial-gradient(ellipse at 50% 45%,rgba(30,140,160,0) 35%,rgba(5,60,80,.38) 78%,rgba(2,30,45,.7) 100%);mix-blend-mode:multiply';
    const cv = document.querySelector('canvas'); if (cv && cv.parentNode) cv.parentNode.insertBefore(overlay, cv.nextSibling); else document.body.appendChild(overlay);
    hud = document.createElement('div'); hud.id = 'diveHud';
    hud.style.cssText = 'position:fixed;left:50%;top:max(54px,calc(env(safe-area-inset-top) + 46px));transform:translateX(-50%);padding:6px 14px;border-radius:14px;background:rgba(6,40,56,.55);color:#bff3ff;font:600 13px system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;display:none;backdrop-filter:blur(4px);z-index:5';
    document.body.appendChild(hud); const stl = document.createElement('style'); stl.textContent = '@media (max-width:560px){#diveHud{top:max(104px,calc(env(safe-area-inset-top) + 96px)) !important}}'; document.head.appendChild(stl);
  }
  return {
    group, surface, rays, bubbles, plankton, overlay, hud,
    setUnder(under, k) { surface.visible = under; rays.group.visible = k > 0.01; plankton.visible = k > 0.01; if (overlay) overlay.style.opacity = String(Math.min(1, k)); },
    update(t, cam, sunDir, k, dayK, fogCol, fogD) {
      surface.material.uniforms.uTime.value = t; surface.material.uniforms.uDay.value = dayK; surface.material.uniforms.uFogCol.value.copy(fogCol); surface.material.uniforms.uFogD.value = fogD;
      const depth = Math.max(0, -cam.y);
      rays.update(t, cam, sunDir, k * dayK * (0.9 - 0.6 * clamp(depth / 9, 0, 1)) * 0.5);
      plankton.material.uniforms.uCam.value.copy(cam); plankton.material.uniforms.uTime.value = t; plankton.material.uniforms.uA.value = k * (0.35 + 0.65 * dayK);
    },
  };
}

/** SURFACE_MODE ↔ UNDERWATER_MODE sırasında kamera derinliğine bağlı atmosfer. Sky.apply'dan SONRA her kare çağrılır. */
export function setUnderwaterAtmosphere(env, k, opts = {}) {
  const { scene, renderer, sun, hemi, skyMesh, water, fx, camera } = env; const dayK = opts.dayK ?? 1; const depth = Math.max(0, -camera.position.y); const under = camera.position.y < 0.02;
  if (skyMesh) skyMesh.visible = k < 0.55;
  if (water) water.visible = !under;                                  // yüzeyin altından: yansıma geçişi de çizilmez
  DIVE_U.uUW.value = k; DIVE_U.uCI.value = (0.35 + 0.9 * dayK) * (0.5 + 0.5 * clamp(1 - depth / 7, 0, 1)); DIVE_U.uCT.value = opts.time ?? 0;
  if (k <= 0.0005) { if (fx) fx.setUnder(false, 0); return; }
  _fc.copy(UW_NIGHT).lerp(UW_DAY, dayK).lerp(UW_DEEP, clamp(depth / 9, 0, 1) * (0.5 + 0.4 * dayK));
  scene.fog.color.lerp(_fc, k); scene.fog.density = lerp(scene.fog.density, lerp(0.07, 0.108, clamp(depth / 8, 0, 1)), k);
  if (typeof window !== 'undefined' && window.__fogOv) scene.fog.density = window.__fogOv;
  renderer.setClearColor(scene.fog.color);
  sun.intensity *= lerp(1, 0.55 * (1 - clamp(depth / 12, 0, 0.45)), k);
  hemi.color.lerp(_hc, k * 0.75); hemi.groundColor.lerp(_hg, k * 0.75); hemi.intensity = Math.max(hemi.intensity * lerp(1, 0.92, k), 0.42 * k);
  renderer.toneMappingExposure *= lerp(1, 0.96, k);
  if (fx) { fx.setUnder(under, k); fx.update(opts.time ?? 0, camera.position, _sd.copy(sun.position).sub(sun.target.position).normalize(), k, dayK, scene.fog.color, scene.fog.density); }
}

/* 4) BATIK GEMİLER → wrecks.js */
export { createWreck, createSunkenShipwreck, findWreckSpots, WRECK_TYPES } from './wrecks.js';

/* ============================================================
 *  5) GÖL FLORASI (kelp, otlar, taşlar, yosunlu oluşumlar, süngerler) — hepsi InstancedMesh
 * ============================================================ */
function spongeGeometry(seed) {
  const rnd = mulberry(seed); const parts = []; const up = new V3(0, 1, 0);
  const branch = (p, d, len, r, depth) => {
    const end = p.clone().addScaledVector(d, len); const g = new THREE.CylinderGeometry(r * 0.7, r, len, 5, 1); const q = new Q4().setFromUnitVectors(up, d);
    g.applyMatrix4(new M4().compose(p.clone().addScaledVector(d, len / 2), q, new V3(1, 1, 1))); parts.push(tint(bare(g), '#ffffff', 0.78 + depth * 0.1));
    if (depth < 3) { const n = depth === 0 ? 3 : 2; for (let i = 0; i < n; i++) { const nd = d.clone().add(new V3((rnd() - 0.5) * 1.1, 0.25 + rnd() * 0.3, (rnd() - 0.5) * 1.1)).normalize(); branch(end, nd, len * 0.72, r * 0.68, depth + 1); } }
    else parts.push(tint(bare(new THREE.IcosahedronGeometry(r * 1.3, 0).translate(end.x, end.y, end.z)), '#ffffff', 1));
  };
  branch(new V3(0, 0, 0), up, 0.42, 0.07, 0); return mergeGeometries(parts);
}
/**
 * opts: { terrainH, lakeD, islandD, avoid(x,z), clear: [{x,z,r}], isMobile, seed }
 * dönen: { group, update(dt, t) }
 */
export function createLakeFlora({ terrainH, lakeD, islandD, avoid = () => false, clear = [], isMobile = false, seed = 7, solids = null } = {}) {
  const rnd = mulberry(seed); const group = new THREE.Group(); group.name = 'lakeFlora';
  const M = new M4(), Qq = new Q4(), P = new V3(), S = new V3(), E = new THREE.Euler(), colr = new C3();
  const okSpot = (x, z, minDepth) => { const b = terrainH(x, z); if (b > -minDepth) return null; if (avoid(x, z)) return null; for (const c of clear) if (Math.hypot(x - c.x, z - c.z) < c.r) return null; return b; };
  const scatter = (count, tries, minDepth, fn) => { let n = 0; for (let t = 0; t < tries && n < count; t++) { const x = (rnd() - 0.5) * 120, z = (rnd() - 0.5) * 104; const b = okSpot(x, z, minDepth); if (b === null) continue; if (fn(x, z, b, n)) n++; } return n; };
  const mkInst = (geo, mat, count, setter, tries, minDepth, castShadow = false) => {
    const im = new THREE.InstancedMesh(geo, mat, count); let n = 0;
    scatter(count, tries, minDepth, (x, z, b) => { if (!setter(im, n, x, z, b)) return false; n++; return true; });
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = castShadow; im.receiveShadow = false; im.computeBoundingSphere(); im.boundingSphere.radius += 3; group.add(im); return im;
  };
  const put = (im, i, x, y, z, sx, sy, sz, ry) => { E.set((rnd() - 0.5) * 0.14, ry, (rnd() - 0.5) * 0.14); Qq.setFromEuler(E); im.setMatrixAt(i, M.compose(P.set(x, y, z), Qq, S.set(sx, sy, sz))); };

  // kelp (uzun) — köşe gölgelendiricide sallanır
  const kelpMat = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), { sway: 1.0 });
  mkInst(kelpGeometry(3, 8, 1.0), kelpMat, isMobile ? 520 : 1100, (im, i, x, z, b) => {
    if (fbm(x * 0.085 + 3, z * 0.085 + 9) < 0.5 && rnd() < 0.85) return false; const depth = -b; const forest = smooth(0.55, 0.78, fbm(x * 0.05 + 70, z * 0.05 - 31)); const h = Math.min(depth * 0.92, 0.9 + rnd() * 1.6 + depth * 0.34 + forest * (1.2 + depth * 0.45)); const w = 0.8 + rnd() * 0.7 + forest * 0.4;
    put(im, i, x, b - 0.04, z, w, h, w, rnd() * 6.28); colr.setHSL(0.27 + rnd() * 0.07, 0.5, 0.55 + rnd() * 0.25); im.setColorAt(i, colr); return true;
  }, 9000, 0.7);
  // kısa göl otları
  const grassMat = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), { sway: 0.55 });
  mkInst(kelpGeometry(4, 4, 0.8), grassMat, isMobile ? 1100 : 2600, (im, i, x, z, b) => {
    if (fbm(x * 0.12 + 40, z * 0.12 + 7) < 0.42 && rnd() < 0.7) return false; const h = 0.3 + rnd() * 0.55, w = 0.8 + rnd() * 0.6; put(im, i, x, b - 0.02, z, w, h, w, rnd() * 6.28); colr.setHSL(0.22 + rnd() * 0.1, 0.55, 0.5 + rnd() * 0.25); im.setColorAt(i, colr); return true;
  }, 16000, 0.35);
  // nehir taşları (2 çeşit) — kümeler halinde
  const rockMat = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), {});
  const rockGeos = [rockGeometry(3, 0.55), rockGeometry(8, 0.35)]; const centers = []; for (let i = 0; i < 16; i++) centers.push([(rnd() - 0.5) * 100, (rnd() - 0.5) * 90]);
  for (let gi = 0; gi < 2; gi++) mkInst(rockGeos[gi], rockMat, isMobile ? 70 : 130, (im, i, x, z, b) => {
    let near = false; for (const c of centers) if (Math.hypot(x - c[0], z - c[1]) < 9) { near = true; break; } if (!near && rnd() < 0.8) return false; const s = 0.22 + Math.pow(rnd(), 2.2) * 1.0; const sx = s * (0.9 + rnd() * 0.4), sy = s * (0.8 + rnd() * 0.5), sz = s * (0.9 + rnd() * 0.4), ry = rnd() * 6.28; put(im, i, x, b + s * 0.18, z, sx, sy, sz, ry); if (solids && s > 0.3) solids.ellipsoid(x, b + s * 0.18, z, 1.1 * sx, 0.62 * sy, 0.95 * sz, ry); return true;
  }, 9000, 0.6, true);
  // yosunlu büyük oluşumlar (tüf/kaya yığınları)
  { const mg = mergeGeometries([piece(rockGeometry(21, 0.95), '#ffffff', [0, 0.1, 0], [0, 0, 0], [1.3, 1.1, 1.1]), piece(rockGeometry(22, 0.95), '#ffffff', [0.9, 0.0, 0.3], [0, 1, 0], [0.8, 0.9, 0.8]), piece(rockGeometry(23, 0.95), '#ffffff', [-0.7, 0.0, -0.4], [0, 2, 0], [0.7, 0.8, 0.7])].map((g) => { g.deleteAttribute('color'); return bake2(g); }));
    mkInst(mg, rockMat, isMobile ? 14 : 28, (im, i, x, z, b) => { let near = false; for (const c of centers) if (Math.hypot(x - c[0], z - c[1]) < 12) { near = true; break; } if (!near) return false; const s = 0.9 + rnd() * 0.8, sy = s * (0.7 + rnd() * 0.4), ry = rnd() * 6.28; put(im, i, x, b + 0.02, z, s, sy, s, ry); if (solids) { const c = Math.cos(ry), sn = Math.sin(ry); for (const [lx, ly, lz, ax, ay, az] of [[0, 0.1, 0, 1.43, 0.68, 1.05], [0.9, 0, 0.3, 0.88, 0.56, 0.76], [-0.7, 0, -0.4, 0.77, 0.5, 0.66]]) solids.ellipsoid(x + (lx * c + lz * sn) * s, b + 0.02 + ly * sy + 0.1, z + (-lx * sn + lz * c) * s, ax * s, ay * sy, az * s, ry); } return true; }, 6000, 1.5, true); }
  // tatlı su süngerleri ("mercan" gibi dallanan, turuncu/pembe/zeytin)
  const spMat = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, flatShading: true }), {});
  const spCols = ['#e4872e', '#d6577e', '#a3b53c', '#f0b44a'];
  mkInst(spongeGeometry(31), spMat, isMobile ? 30 : 64, (im, i, x, z, b) => { const s = 0.55 + rnd() * 0.9; put(im, i, x, b - 0.03, z, s, s * (0.9 + rnd() * 0.3), s, rnd() * 6.28); colr.set(spCols[(rnd() * 4) | 0]); im.setColorAt(i, colr); return true; }, 6000, 1.2);
  return { group, update() { /* sallanma uniform'u DIVE_U.uSwT üzerinden */ } };
}
/* ============================================================
 *  6) BALIK SÜRÜLERİ (Boids)
 * ============================================================ */
function fishGeometry() {
  const body = new THREE.IcosahedronGeometry(1, 1); body.scale(0.15, 0.065, 0.036);
  const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, -0.23, 0.07, 0, -0.19, 0, 0, -0.12, 0, 0, -0.19, 0, 0, -0.23, -0.07, 0], 3)); tail.computeVertexNormals();
  const dorsal = new THREE.BufferGeometry(); dorsal.setAttribute('position', new THREE.Float32BufferAttribute([0.02, 0.055, 0, -0.07, 0.055, 0, -0.04, 0.115, 0], 3)); dorsal.computeVertexNormals();
  const parts = [body, tail, dorsal].map((g) => { const b = bare(g); const p = b.attributes.position, a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = clamp(0.5 + y * 6, 0, 1); const c = tmpC.set('#d9e6ea').lerp(tmpC2.set('#56788a'), k * k); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } b.setAttribute('color', new THREE.BufferAttribute(a, 3)); return b; });
  return mergeGeometries(parts);
}
const tmpC2 = new C3();
/**
 * opts: { terrainH, lakeD, islandD, schools, perSchool, isMobile, seed }
 * dönen: { group, update(dt, t, diverPos|null) }
 */
export function createFishBoids({ terrainH, lakeD, islandD, schools = 7, perSchool = 18, isMobile = false, seed = 5, sizeK = 1, tints: tintList = null, attractors = [], speed = 1 } = {}) {
  const rnd = mulberry(seed); const per = isMobile ? Math.round(perSchool * 0.62) : perSchool; const N = schools * per;
  const geo = fishGeometry(); const phase = new Float32Array(N); for (let i = 0; i < N; i++) phase[i] = rnd() * 6.28; geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = patchDiveMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide, flatShading: true }), { fish: true });
  const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.name = 'fishSchools'; im.castShadow = false;
  const tints = tintList || ['#f2f6f8', '#ffd48a', '#9ec8ff', '#c9e0a0', '#ffb7a0', '#d8d0ff', '#ffe9a8'];
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), sz = new Float32Array(N); const goal = [], sch = [];
  const deepSpot = () => { for (let t = 0; t < 200; t++) { const x = (rnd() - 0.5) * 90, z = (rnd() - 0.5) * 78; if (terrainH(x, z) < -2.2 && islandD(x, z) < -4) return [x, z]; } return [0, 30]; };
  for (let s = 0; s < schools; s++) {
    const [cx, cz] = deepSpot(); goal.push({ x: cx, y: -1.5, z: cz, t: 3 + rnd() * 5 });
    for (let k = 0; k < per; k++) { const i = s * per + k; const b = terrainH(cx, cz); pos[i * 3] = cx + (rnd() - 0.5) * 3; pos[i * 3 + 1] = lerp(b + 0.8, -0.8, rnd()); pos[i * 3 + 2] = cz + (rnd() - 0.5) * 3; const a = rnd() * 6.28; vel[i * 3] = Math.cos(a) * 0.8; vel[i * 3 + 1] = 0; vel[i * 3 + 2] = Math.sin(a) * 0.8; sz[i] = (0.8 + rnd() * 0.6 + (s % 3) * 0.12) * sizeK; im.setColorAt(i, tmpC.set(tints[s % tints.length])); }
  }
  const group = new THREE.Group(); group.name = 'fishGroup'; group.add(im);
  const basis = new M4(), X = new V3(), Y = new V3(), Z = new V3(), UP = new V3(0, 1, 0), pp = new V3();
  const bedAt = terrainH; let flee = 0;
  function update(dt, t, diver) {
    dt = Math.min(dt, 0.05);
    for (let s = 0; s < schools; s++) {
      const g = goal[s]; g.t -= dt; const i0 = s * per;
      let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0; for (let k = 0; k < per; k++) { const i = i0 + k; cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; ax += vel[i * 3]; ay += vel[i * 3 + 1]; az += vel[i * 3 + 2]; } cx /= per; cy /= per; cz /= per; ax /= per; ay /= per; az /= per;
      if (g.t <= 0 || Math.hypot(g.x - cx, g.z - cz) < 2.5) { g.t = 5 + rnd() * 7; if (attractors.length && rnd() < 0.5) { const a = attractors[(rnd() * attractors.length) | 0]; g.x = a.x + (rnd() - 0.5) * 8; g.z = a.z + (rnd() - 0.5) * 8; g.y = clamp(terrainH(g.x, g.z) + 1.2 + rnd() * 2.6, -9, -1.0); } else for (let tr = 0; tr < 8; tr++) { const nx = cx + (rnd() - 0.5) * 30, nz = cz + (rnd() - 0.5) * 30; if (terrainH(nx, nz) < -1.8 && islandD(nx, nz) < -3) { g.x = nx; g.z = nz; g.y = lerp(terrainH(nx, nz) + 1.0, -1.0, rnd()); break; } } }
      for (let k = 0; k < per; k++) {
        const i = i0 + k, px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2]; let vx = vel[i * 3], vy = vel[i * 3 + 1], vz = vel[i * 3 + 2];
        let sx = 0, sy = 0, sz2 = 0;
        for (let j = 0; j < per; j++) { if (j === k) continue; const o = i0 + j; const dx = px - pos[o * 3], dy = py - pos[o * 3 + 1], dz = pz - pos[o * 3 + 2]; const d2 = dx * dx + dy * dy + dz * dz; if (d2 < 0.36 && d2 > 1e-6) { const f = 1 / d2; sx += dx * f; sy += dy * f; sz2 += dz * f; } }
        let fx = sx * 0.12 + (ax - vx) * 0.9 + (cx - px) * 0.55, fy = sy * 0.12 + (ay - vy) * 0.9 + (cy - py) * 0.55, fz = sz2 * 0.12 + (az - vz) * 0.9 + (cz - pz) * 0.55;
        const gx = g.x - px, gy = g.y - py, gz = g.z - pz, gl = Math.hypot(gx, gy, gz) + 1e-4; fx += gx / gl * 1.1; fy += gy / gl * 0.7; fz += gz / gl * 1.1;
        const bed = bedAt(px, pz); if (py < bed + 0.55) fy += (bed + 0.55 - py) * 5; if (py > -0.65) fy -= (py + 0.65) * 5;
        if (bed > -1.4) { const gxh = bedAt(px + 0.7, pz) - bedAt(px - 0.7, pz), gzh = bedAt(px, pz + 0.7) - bedAt(px, pz - 0.7); fx -= gxh * 4.5; fz -= gzh * 4.5; }
        let maxS = 1.25 * speed;
        if (diver) { const dx = px - diver.x, dy = py - diver.y, dz = pz - diver.z; const d = Math.hypot(dx, dy, dz); if (d < 4.4) { const f = (4.4 - d) / 4.4; fx += dx / d * f * 9; fy += dy / d * f * 5; fz += dz / d * f * 9; fx += -dz / d * f * 2.5; fz += dx / d * f * 2.5; maxS = (1.25 + f * 2.2) * speed; } }
        vx += fx * dt; vy += fy * dt; vz += fz * dt; vy *= 1 - dt * 0.6;
        let sp = Math.hypot(vx, vy, vz); if (sp > maxS) { const k2 = maxS / sp; vx *= k2; vy *= k2; vz *= k2; sp = maxS; } else if (sp < 0.5) { const k2 = 0.5 / (sp + 1e-4); vx *= k2; vy *= k2; vz *= k2; }
        vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; pos[i * 3] = px + vx * dt; pos[i * 3 + 1] = py + vy * dt; pos[i * 3 + 2] = pz + vz * dt;
        // yön: +X ileri
        X.set(vx, vy, vz).normalize(); Z.crossVectors(X, UP); if (Z.lengthSq() < 1e-4) Z.set(0, 0, 1); Z.normalize(); Y.crossVectors(Z, X); const sc = sz[i];
        basis.makeBasis(X.multiplyScalar(sc), Y.multiplyScalar(sc), Z.multiplyScalar(sc)); basis.setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); im.setMatrixAt(i, basis);
      }
    }
    im.instanceMatrix.needsUpdate = true;
  }
  return { group, update, count: N };
}

/* ============================================================
 *  7) DURUM YÖNETİCİSİ
 * ============================================================ */
/**
 * ctx: { scene, camera, renderer, sky(buildSky çıktısı), water, fisher, terrainH, lakeD, islandD, anchor{x,z},
 *        isMobile, avoid(x,z), collide?(x,z)→{x,z}, hooks:{ splash(x,z,s), sfx(name), toast(msg,ms), ripple(x,z,t,s) } }
 */
export function createDiveSystem(ctx) {
  const { scene, camera, renderer, sky, water, fisher, terrainH, lakeD, islandD, isMobile = false, hooks = {} } = ctx;
  const st = { mode: MODE.SURFACE, k: 0, morph: 0, morphTarget: 0, surfacing: false, upHold: 0, bubT: 2, exhT: 3.5, t: 0 };
  const D = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, speed: 0 };
  const input = { up: false, down: false };
  const skyMesh = scene.children.find((o) => o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 500) || null;

  const solids = createSolids(3);
  const WSPECS = [
    { type: 'schooner', depth: [6.2, 9.4], prefer: 52, maxSlope: 0.3 },
    { type: 'trawler', depth: [4.8, 8.6], prefer: 38 },
    { type: 'rowboat', depth: [3.0, 6.0], prefer: 26, edge: 6, maxSlope: 0.8, resid: 0.9 },
    { type: 'dinghy', depth: [2.0, 4.6], prefer: 18, edge: 4.5, maxSlope: 0.8, resid: 0.8 },
  ];
  const wreckSpots = findWreckSpots(WSPECS, { terrainH, lakeD, islandD, anchor: ctx.anchor || { x: 0, z: 0 }, avoid: ctx.avoid });
  const wrecks = wreckSpots.map((sp, i) => createWreck(sp.type, { x: sp.x, z: sp.z, bedY: sp.bed, rotY: sp.rotY, roll: sp.roll, pitch: sp.pitch, seed: 21 + i * 5 }));
  const wreck = wrecks[0] || null; const spot = wreckSpots.find((w) => w.type === 'rowboat') || wreckSpots[0] || { x: 0, z: 30, bed: terrainH(0, 30) };
  for (const w of wrecks) { const a = w.userData.solids; for (let i = 0; i < a.length; i += 4) solids.sphere(a[i], a[i + 1], a[i + 2], a[i + 3]); }
  const seabed = createSeabed({ terrainH, lakeD, islandD, avoid: ctx.avoid, wrecks: wreckSpots, isMobile, solids });
  const flora = createLakeFlora({ terrainH, lakeD, islandD, avoid: ctx.avoid, clear: wreckSpots.map((w) => ({ x: w.x, z: w.z, r: w.r * 0.9 })).concat(seabed.clear), isMobile, solids });
  const att = seabed.attractors.concat(wreckSpots.map((w) => ({ x: w.x, z: w.z, y: terrainH(w.x, w.z) + 2.2 })));
  const fish = createFishBoids({ terrainH, lakeD, islandD, isMobile, attractors: att });
  const bigFish = createFishBoids({ terrainH, lakeD, islandD, isMobile, schools: 3, perSchool: 6, sizeK: 2.4, seed: 23, attractors: att, tints: ['#c9b27a', '#8fa9a0', '#d9a37a'], speed: 0.8 });
  const fx = createUnderwaterFX({ isMobile, hooks });
  const diver = createScubaDiver(); diver.group.visible = false;
  const under = new THREE.Group(); under.name = 'underwaterWorld'; under.add(...wrecks, flora.group, seabed.group, fish.group, bigFish.group); under.visible = false;
  scene.add(under, diver.group, fx.group); if (seabed.shallow) scene.add(seabed.shallow);
  const env = { bedAt: terrainH, t: 0, collide: ctx.collide, solid: (D) => solids.resolve(D, 0.4) };
  const mw = new V3(), dpos = new V3();

  const setVisible = () => { const on = st.mode === MODE.UNDERWATER || st.k > 0.002 || st.morph > 0.001; under.visible = on; diver.group.visible = on || st.morph > 0.001; };

  const sys = {
    MODE, input, diver, wreck, wrecks, wreckSpots, seabed, solids, bigFish, fish, flora, fx, D, state: st, wreckSpot: spot,
    get mode() { return st.mode; },
    isUnder: () => st.mode === MODE.UNDERWATER,
    /** SURFACE_MODE → UNDERWATER_MODE. S: { x, y, z, face } (yüzme konumu) */
    enter(S) {
      if (st.mode === MODE.UNDERWATER) return false;
      st.mode = MODE.UNDERWATER; st.surfacing = false; st.upHold = 0; st.morphTarget = 1; st.morph = Math.max(st.morph, 0.001);
      D.x = S.x; D.z = S.z; D.y = -0.2; D.yaw = S.face; D.pitch = -0.35; D.roll = 0; D.vx = D.vz = 0; D.vy = -1.1; D.speed = 0;
      diver.group.position.set(D.x, D.y, D.z); diver.group.rotation.set(0, -D.yaw, 0); diver.body.rotation.set(0, 0, D.pitch);
      hooks.splash && hooks.splash(S.x, S.z, 1.1); hooks.sfx && hooks.sfx('splash'); sys.exhale(9, 0.06);
      setVisible(); return true;
    },
    /** UNDERWATER_MODE → SURFACE_MODE (yüzeyde yüzmeye döner) */
    exit(S) {
      if (st.mode !== MODE.UNDERWATER) return false;
      st.mode = MODE.SURFACE; st.morphTarget = 0; st.surfacing = false; if (S) { S.x = D.x; S.z = D.z; S.y = 0; S.face = D.yaw; }
      hooks.splash && hooks.splash(D.x, D.z, 0.9); hooks.sfx && hooks.sfx('splash'); return true;
    },
    requestSurface() { st.surfacing = true; },
    exhale(n = 6, size = 0.05) { diver.group.updateMatrixWorld(true); mw.copy(diver.maskLocal); diver.body.localToWorld(mw); fx.bubbles.emit(mw.x, mw.y, mw.z, n, size, 0.08); },
    /** Her kare: S.mode === 'dive' iken denetimi buradan sür. ctl: { dirX, dirZ, mag, up, down } */
    update(dt, t, ctl) {
      st.t = t; env.t = t; DIVE_U.uSwT.value = t; let res = null;
      if (st.mode === MODE.UNDERWATER) {
        const cmd = { dirX: ctl.dirX, dirZ: ctl.dirZ, mag: ctl.mag, up: ctl.up || input.up || st.surfacing, down: (ctl.down || input.down) && !st.surfacing };
        res = updateDiverMovement(D, cmd, dt, env);
        if (res.surfaced && cmd.up) { st.upHold += dt; } else st.upHold = 0;
        if (st.surfacing && res.surfaced) res.exit = true; else if (st.upHold > 0.3) res.exit = true;
        // maskeden periyodik kabarcık: sürekli ince dizi + nefes verme patlaması
        st.bubT -= dt; if (st.bubT <= 0) { st.bubT = 0.4 + Math.random() * 0.5; sys.exhale(1 + (Math.random() < 0.4 ? 1 : 0), 0.022 + Math.random() * 0.012); }
        st.exhT -= dt; if (st.exhT <= 0) { st.exhT = 3.2 + Math.random() * 1.6; sys.exhale(5 + ((Math.random() * 4) | 0), 0.04 + Math.random() * 0.025); }
      } else { D.vx *= 0.9; D.vy *= 0.9; D.vz *= 0.9; }
      // dönüşüm (morph): balıkçı küçülür, dalgıç büyür
      st.morph += (st.morphTarget - st.morph) * (1 - Math.exp(-dt * 7)); if (Math.abs(st.morph - st.morphTarget) < 0.01) st.morph = st.morphTarget;
      const mS = smooth(0, 1, st.morph); fisher.visible = mS < 0.98; fisher.scale.setScalar(Math.max(0.001, 1 - mS)); diver.group.scale.setScalar(Math.max(0.001, mS));
      diver.group.position.set(D.x, D.y, D.z); diver.group.rotation.set(0, -D.yaw, 0); diver.body.rotation.set(D.roll, 0, D.pitch);
      diver.update(dt, { speed: clamp(D.speed / DIVE_PHYS.maxSpeed * 1.25, 0, 1), vy: D.vy });
      dpos.set(D.x, D.y, D.z);
      if (under.visible) { const dp = st.mode === MODE.UNDERWATER ? dpos : null; fish.update(dt, t, dp); bigFish.update(dt, t, dp); seabed.update(dt, t, dp); }
      fx.bubbles.update(dt, t);
      return res;
    },
    /** sky.apply'dan sonra, her kare. c: sky.tod.cur */
    atmosphere(dt, c, time) {
      const camY = camera.position.y; const kT = smooth(0.14, -0.2, camY); st.k += (kT - st.k) * (1 - Math.exp(-dt * 9)); if (Math.abs(st.k - kT) < 0.002) st.k = kT;
      setVisible();
      const dayK = clamp(c.sunI / 3.0, 0, 1);
      setUnderwaterAtmosphere({ scene, renderer, sun: sky.sun, hemi: sky.hemi, skyMesh, water, fx, camera }, st.k, { dayK, time });
      if (fx.hud) { const show = st.mode === MODE.UNDERWATER; fx.hud.style.display = show ? 'block' : 'none'; if (show) { const tx = `Derinlik ${(-D.y).toFixed(1).replace('.', ',')} m  ·  Zemin ${(-terrainH(D.x, D.z)).toFixed(1).replace('.', ',')} m`; if (fx.hud.dataset.t !== tx) { fx.hud.dataset.t = tx; fx.hud.textContent = tx; } } }
    },
    /** Shader derlemelerini baştan yap (ilk dalışta takılma olmasın) */
    warmup() {
      const s = { u: under.visible, d: diver.group.visible, sf: fx.surface.visible, rg: fx.rays.group.visible, pk: fx.plankton.visible }; under.visible = diver.group.visible = fx.surface.visible = fx.rays.group.visible = fx.plankton.visible = true; DIVE_U.uUW.value = 1;
      try { renderer.compile(scene, camera); } catch (e) { /* önemsiz */ }
      under.visible = s.u; diver.group.visible = s.d; fx.surface.visible = s.sf; fx.rays.group.visible = s.rg; fx.plankton.visible = s.pk; DIVE_U.uUW.value = 0;
    },
    reset() { st.mode = MODE.SURFACE; st.morph = st.morphTarget = 0; st.k = 0; fisher.visible = true; fisher.scale.setScalar(1); setVisible(); },
  };
  return sys;
}
