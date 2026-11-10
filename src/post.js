import * as THREE from 'three';
/**
 * Yağlı boya / gouache görünümü: sahne HDR bir hedefe çizilir, sonra tam ekran geçişte
 *  - fırça darbesi yönünde kenar-koruyan yumuşatma (renk lekeleri),
 *  - kıl dokusu + tuval greni,
 *  - sıcak pastel renk derecelendirme (mavi-eflatun gölge, krem ışık) ve hafif parıltı uygulanır.
 */
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FS = `
uniform sampler2D tScene; uniform vec2 uRes; uniform float uStr; uniform float uQ;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
void main(){
  vec2 px = 1.0 / uRes; float asp = uRes.x / uRes.y; float u = max(0.6, uRes.y / 760.0);
  vec2 p = vUv * vec2(asp, 1.0);
  // fırça yönü alanı (büyük, düzensiz lekeler)
  float a = vn(p * 7.0) * 6.2831 + vn(p * 19.0 + 3.1) * 1.7;
  vec2 dir = vec2(cos(a), sin(a)); vec2 nrm = vec2(-dir.y, dir.x);
  vec3 c0 = texture2D(tScene, vUv).rgb;
  vec3 acc = c0; float ws = 1.0; float L0 = dot(c0, vec3(0.299, 0.587, 0.114));
  float sg = 0.32 + 0.55 * L0;
  for (int i = 1; i <= 4; i++) {
    float d = float(i) * 2.4 * u;
    for (int k = 0; k < 2; k++) {
      float s = k == 0 ? 1.0 : -1.0; vec2 o = dir * px * d * s;
      vec3 c = texture2D(tScene, vUv + o).rgb; float dd = length(c - c0) / sg; float w = exp(-dd * dd * 3.0) * (1.0 - float(i) * 0.12); acc += c * w; ws += w;
    }
  }
  for (int i = 1; i <= 2; i++) {
    float d = float(i) * 2.0 * u;
    for (int k = 0; k < 2; k++) {
      float s = k == 0 ? 1.0 : -1.0; vec2 o = nrm * px * d * s;
      vec3 c = texture2D(tScene, vUv + o).rgb; float dd = length(c - c0) / sg; float w = exp(-dd * dd * 3.0) * 0.55; acc += c * w; ws += w;
    }
  }
  vec3 col = acc / ws;
  // yumuşak parıltı (parlak alanlar)
  vec3 gl = vec3(0.0); for (int i = 0; i < 4; i++) { float an = float(i) * 1.5708 + 0.5; vec2 o = vec2(cos(an), sin(an)) * px * 7.0 * u; gl += max(texture2D(tScene, vUv + o).rgb - 0.9, 0.0); }
  col += gl * 0.07;
  vec4 outc = vec4(col, 1.0);
  gl_FragColor = outc;
  #ifdef TONE_MAPPING
  gl_FragColor.rgb = toneMapping(gl_FragColor.rgb);
  #endif
  gl_FragColor = linearToOutputTexel(gl_FragColor);
  vec3 c = gl_FragColor.rgb;
  // kıl dokusu (fırça yönünde) + tuval grenleri
  vec2 pw = p + 0.035 * vec2(vn(p * 13.0), vn(p * 13.0 + 9.0)); vec2 cell = floor(pw * 8.0);
  float ac = (h21(cell) - 0.5) * 1.3 + 0.75; vec2 dc = vec2(cos(ac), sin(ac)), nc = vec2(-dc.y, dc.x);
  float bristle = vn(vec2(dot(pw, nc) * 230.0 / u, dot(pw, dc) * 12.0 / u));
  float grain = h21(floor(vUv * uRes / (1.4 * u)) + 7.0);
  float tex = (bristle - 0.5) * 0.085 + (grain - 0.5) * 0.03;
  float L = dot(c, vec3(0.299, 0.587, 0.114));
  // pastel derecelendirme
  c = mix(vec3(L), c, 1.2);
  c = mix(c, c * vec3(1.03, 1.0, 0.95) + vec3(0.035, 0.022, 0.0), smoothstep(0.45, 1.0, L));        // sıcak/krem ışık
  c = mix(c, c * 0.86 + vec3(0.075, 0.09, 0.15), 1.0 - smoothstep(0.0, 0.55, L));                    // mavi-eflatun gölgeler
  c = mix(c, smoothstep(0.0, 1.0, c), 0.18);
  c *= 1.0 + tex * (0.6 + 0.8 * (1.0 - abs(L - 0.5) * 1.4));
  vec2 vq = vUv - 0.5; c *= 1.0 - 0.18 * dot(vq, vq);
  gl_FragColor = vec4(mix(gl_FragColor.rgb, c, uStr), 1.0);
}`;
export function createPost(renderer, { isMobile }) {
  let rt = null; const v = new THREE.Vector2();
  const mat = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uStr: { value: 1 }, uQ: { value: 1 } }, vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false, toneMapped: true });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; const scn = new THREE.Scene(); scn.add(quad); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const P = { on: true, str: 1 };
  function fit() {
    renderer.getDrawingBufferSize(v); const w = Math.max(2, v.x | 0), h = Math.max(2, v.y | 0);
    if (!rt) rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: isMobile ? 0 : 4, depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    else if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    mat.uniforms.uRes.value.set(w, h);
  }
  P.render = (scene, camera) => {
    if (!P.on) { renderer.render(scene, camera); return; }
    fit(); renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
    mat.uniforms.tScene.value = rt.texture; mat.uniforms.uStr.value = P.str; renderer.render(scn, cam);
  };
  return P;
}
