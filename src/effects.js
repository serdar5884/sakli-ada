import * as THREE from 'three';
/** basit parçacık havuzu: duman, kıvılcım */
export class Particles {
  constructor(scene, n, o = {}) {
    this.n = n; this.i = 0; this.gravity = o.gravity || 0; this.drag = o.drag ?? 0.4; this.wind = o.wind || 0;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.life.fill(0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    this.uScale = { value: 400 };
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, uniforms: { uScale: this.uScale },
      vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = aSize*uScale/max(0.1,-mv.z); vA = aAlpha; vC = aCol; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5)*2.; float a = smoothstep(1.,0.2,d)*vA; if(a<0.005) discard; gl_FragColor = vec4(vC, a); }' });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 4; scene.add(this.points); this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0 = 0.5) {
    const i = this.i++ % this.n; this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz; this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt; const k = 1 - Math.max(0, this.life[i]) / this.max[i];
      const dr = Math.exp(-this.drag * dt); this.v[i * 3] = this.v[i * 3] * dr + this.wind * dt; this.v[i * 3 + 1] = this.v[i * 3 + 1] * dr + this.gravity * dt; this.v[i * 3 + 2] *= dr;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k; this.alpha[i] = this.a0[i] * Math.sin(Math.min(1, k * 6) * Math.PI / 2) * (1 - k) * (1 - k * 0.3);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; this.geo.attributes.aAlpha.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true;
  }
}
