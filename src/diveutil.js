import * as THREE from 'three';
import { mulberry, smooth, vnoise } from './world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Dalış/deniz dibi modülleri için ortak yardımcılar */
export const WATER_LEVEL = 0;

export const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q4 = THREE.Quaternion, C3 = THREE.Color;
export const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

/* ortak uniform'lar: tüm dalış malzemeleri paylaşır */
export const DIVE_U = {
  uSwT: { value: 0 },   // akıntı zamanı (kelp/balık kuyruğu)
  uUW: { value: 0 },    // 0 = yüzeyde, 1 = su altında (kostik gücü)
  uCT: { value: 0 }, uCI: { value: 0.6 }, uCC: { value: new C3('#fff0d2') }, // kostik zamanı / şiddeti / rengi
};

/* ================= küçük yardımcılar ================= */
export function tint(geo, color, k = 1) {
  const c = new C3(color); const n = geo.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
export function bare(geo) { // sadece position + normal kalsın, indeksli değil → mergeGeometries güvenli
  const g = geo.index ? geo.toNonIndexed() : geo; for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n); return g;
}
const _m = new M4(), _q = new Q4(), _e = new THREE.Euler(), _p = new V3(), _s = new V3();
export function piece(geo, color, pos, rot, scl, k = 1) {
  const g = bare(geo.clone()); _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e);
  _p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0); if (typeof scl === 'number') _s.set(scl, scl, scl); else if (scl) _s.set(scl[0], scl[1], scl[2]); else _s.set(1, 1, 1);
  g.applyMatrix4(_m.compose(_p, _q, _s)); if (g.attributes.normal) g.computeVertexNormals(); return tint(g, color, k);
}
/** p0→p1 arasına uzanan kutu (kiriş, kaburga, çıta) */
export function beamGeo(p0, p1, w, h) {
  const len = p0.distanceTo(p1); const g = new THREE.BoxGeometry(len, h, w); const dir = new V3().subVectors(p1, p0).normalize();
  _q.setFromUnitVectors(new V3(1, 0, 0), dir); g.applyMatrix4(_m.compose(new V3().addScaledVector(p0, 0.5).addScaledVector(p1, 0.5), _q, new V3(1, 1, 1))); return g;
}

/* ---- kostik + sallanma yaması (MeshStandardMaterial'e eklenir) ---- */
const CAUSTIC_FN = `
  float caustF(vec2 uv, float t){ vec2 p = mod(uv*6.2831853, 6.2831853) - 250.; vec2 i = p; float c = 1.; const float inten = .005;
    for(int n=0;n<4;n++){ float tt = t*(1.-(3.5/float(n+1))); i = p + vec2(cos(tt-i.x)+sin(tt+i.y), sin(tt-i.y)+cos(tt+i.x)); c += 1./length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten))); }
    c /= 4.; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.); }`;
/**
 * opts.sway: 0 = yok, >0 = kelp/ot sallanma genliği (nesne uzayında, y∈[0,1] yüksekliğe göre)
 * opts.fish: balık kuyruğu çırpması (aPhase özniteliği ister)
 * opts.caustics: su altı kostik ışık deseni
 */
export function patchDiveMaterial(mat, opts = {}) {
  const key = `dive|${opts.sway || 0}|${opts.fish ? 1 : 0}|${opts.caustics === false ? 0 : 1}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSwT = DIVE_U.uSwT; sh.uniforms.uUW = DIVE_U.uUW; sh.uniforms.uCT = DIVE_U.uCT; sh.uniforms.uCI = DIVE_U.uCI; sh.uniforms.uCC = DIVE_U.uCC;
    let vs = 'varying vec3 vCW2; uniform float uSwT;\n' + (opts.fish ? 'attribute float aPhase;\n' : '') + sh.vertexShader;
    let sway = '';
    if (opts.sway) sway = `
      { vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]); float hh = clamp(position.y, 0.0, 1.0); float ph = uSwT * 1.15 + ip.x * 0.55 + ip.z * 0.47;
        transformed.x += (sin(ph + hh * 2.6) * 0.22 + sin(ph * 1.9 + hh * 5.0) * 0.06) * hh * hh * ${(opts.sway).toFixed(3)};
        transformed.z += cos(ph * 0.8 + hh * 2.1 + 1.3) * 0.17 * hh * hh * ${(opts.sway).toFixed(3)}; }`;
    if (opts.fish) sway += `
      { float tw = clamp((-position.x + 0.02) / 0.2, 0.0, 1.0); transformed.z += sin(uSwT * 11.0 + aPhase + position.x * 7.0) * 0.11 * tw * tw; transformed.x += sin(uSwT * 5.0 + aPhase) * 0.01; }`;
    vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>' + sway);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vCW2 = (modelMatrix * wp4).xyz; }`);
    sh.vertexShader = vs;
    if (opts.caustics !== false) {
      sh.fragmentShader = `varying vec3 vCW2; uniform float uCT, uCI, uUW; uniform vec3 uCC;\n${CAUSTIC_FN}\n` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float dd = -vCW2.y; float cm = smoothstep(-0.05, 0.3, dd) * (1. - smoothstep(1.5, 6.5, dd)) * uUW;
          if (cm > 0.001) { float cs = caustF(vCW2.xz * 0.34, uCT * 0.75) * 0.95 + caustF(vCW2.xz * 0.5 + 7.3, -uCT * 0.62) * 0.65; totalEmissiveRadiance += uCC * uCI * cm * cs * 0.8; } }`);
    } else sh.fragmentShader = 'varying vec3 vCW2;\n' + sh.fragmentShader;
  };
  return mat;
}


/* ---- ortak geometri üreticileri ---- */

export function kelpGeometry(blades, segs, widthK) {
  const rnd = mulberry(9); const pos = [], col = [], idx = []; const base = new C3('#1f5a2e'), tip = new C3('#8fc24d'); let off = 0;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * TAU + rnd() * 0.8, lean = 0.12 + rnd() * 0.3, h = 0.65 + rnd() * 0.35, w0 = (0.06 + rnd() * 0.03) * widthK; const nx = Math.cos(a + Math.PI / 2), nz = Math.sin(a + Math.PI / 2); const ox = Math.cos(a) * 0.08, oz = Math.sin(a) * 0.08; const cv = (rnd() - 0.5) * 0.15;
    for (let j = 0; j <= segs; j++) {
      const y = (j / segs) * h, t = j / segs, w = w0 * (1 - 0.82 * t) * (0.8 + 0.2 * Math.sin(t * 9 + b)); const cx = ox + Math.cos(a) * lean * t * t, cz = oz + Math.sin(a) * lean * t * t + cv * t;
      pos.push(cx - nx * w, y, cz - nz * w, cx + nx * w, y, cz + nz * w); tmpC.copy(base).lerp(tip, Math.pow(t, 0.8)).multiplyScalar(0.85 + rnd() * 0.3); col.push(tmpC.r, tmpC.g, tmpC.b, tmpC.r, tmpC.g, tmpC.b);
    }
    for (let j = 0; j < segs; j++) { const i0 = off + j * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); } off += (segs + 1) * 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export const tmpC = new C3();
export function rockGeometry(seed, moss = 0.5) {
  const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; const rnd = mulberry(seed);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (vnoise(x * 1.7 + seed, z * 1.7 + y * 1.3) - 0.5) * 0.55; p.setXYZ(i, x * k * 1.1, y * k * 0.62, z * k * 0.95); }
  g.computeVertexNormals(); const n = g.attributes.normal, c = new Float32Array(p.count * 3); const st = new C3('#8d8a80'), st2 = new C3('#6f7468'), mo = new C3('#5f8a36');
  for (let i = 0; i < p.count; i++) { tmpC.copy(st).lerp(st2, (vnoise(p.getX(i) * 2 + seed, p.getZ(i) * 2) * 0.9)); const up = smooth(0.15, 0.7, n.getY(i)) * moss; tmpC.lerp(mo, up * (0.55 + 0.45 * vnoise(p.getX(i) * 4, p.getZ(i) * 4 + seed))); c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g;
}

export function bake2(g) { // renkli taş geometrisini yosun renkleriyle yeniden boya
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3); const st = new C3('#85837a'), mo = new C3('#5f8a36');
  for (let i = 0; i < p.count; i++) { tmpC.copy(st).lerp(mo, smooth(0.0, 0.55, n.getY(i)) * (0.7 + 0.3 * vnoise(p.getX(i) * 3, p.getZ(i) * 3))); c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

