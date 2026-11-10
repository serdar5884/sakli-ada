/* çarpışma: ağaç gövdeleri (daire) + yönlü dikdörtgenler (evler, tezgah) */
const CELL = 8;
const grid = new Map();
const key = (i, j) => i * 73856093 ^ j * 19349663;
export const COL = {
  trees: 0, rects: [],
  addTree(x, z, r) { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(x, z, r); this.trees++; },
  clearRects(tag) { this.rects = this.rects.filter(r => r.tag !== tag); },
  addRect(tag, cx, cz, rot, hx, hz) { this.rects.push({ tag, cx, cz, c: Math.cos(rot), s: Math.sin(rot), hx, hz }); },
  /** (x,z) noktasını r yarıçaplı bir cisim için dışarı iter; {x,z,hit} döndürür */
  push(x, z, r, out) {
    let hit = false; const i0 = Math.floor((x - r - 2) / CELL), i1 = Math.floor((x + r + 2) / CELL), j0 = Math.floor((z - r - 2) / CELL), j1 = Math.floor((z + r + 2) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = grid.get(key(i, j)); if (!a) continue; for (let n = 0; n < a.length; n += 3) { const dx = x - a[n], dz = z - a[n + 1]; const rr = a[n + 2] + r; const d2 = dx * dx + dz * dz; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; x = a[n] + dx / d * rr; z = a[n + 1] + dz / d * rr; hit = true; } } }
    for (const q of this.rects) {
      const dx = x - q.cx, dz = z - q.cz; if (dx * dx + dz * dz > (q.hx + q.hz + r + 1) * (q.hx + q.hz + r + 1)) continue;
      // yerel: x' = dx*c + dz*s ? (rotasyon y = rot → yerel x = dx*cos - dz*sin ... kullanılan tanım: dünya = R_y(rot) * yerel)
      const lx = dx * q.c - dz * q.s, lz = dx * q.s + dz * q.c; // R_y(rot)^-1
      const px = q.hx + r - Math.abs(lx), pz = q.hz + r - Math.abs(lz);
      if (px > 0 && pz > 0) { let nx = lx, nz = lz; if (px < pz) nx = Math.sign(lx || 1) * (q.hx + r); else nz = Math.sign(lz || 1) * (q.hz + r); x = q.cx + nx * q.c + nz * q.s; z = q.cz - nx * q.s + nz * q.c; hit = true; }
    }
    out.x = x; out.z = z; out.hit = hit; return out;
  },
  blocked(x, z, r) { const o = { x: 0, z: 0, hit: false }; this.push(x, z, r, o); return o.hit; },
};
