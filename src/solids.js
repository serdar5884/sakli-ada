/**
 * Su altı katı nesneleri: küre tabanlı çarpışma (kaya, kemer, sütun, batık gövdesi …).
 * Kürelerin arası boşsa dalgıç (yarıçap ≈ 0.4) oradan geçebilir; boşluklar (batık delikleri, kemer altı) açık kalır.
 */
export function createSolids(cell = 3) {
  const X = [], Y = [], Z = [], R = []; const map = new Map();
  const key = (i, j) => (i + 4096) * 8192 + (j + 4096);
  const api = {
    count: () => X.length,
    sphere(x, y, z, r) {
      const id = X.length; X.push(x); Y.push(y); Z.push(z); R.push(r);
      const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((z - r) / cell), j1 = Math.floor((z + r) / cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(id); }
    },
    /** a→b doğrusu boyunca küre dizisi */
    segment(ax, ay, az, bx, by, bz, r, maxN = 16) {
      const len = Math.hypot(bx - ax, by - ay, bz - az); const n = Math.min(maxN, Math.max(1, Math.ceil(len / (r * 1.5)))); for (let i = 0; i <= n; i++) { const t = i / n; api.sphere(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, r); }
    },
    /** yassı/uzun elipsoid (kaya): alt yarıçap kadar küreyle taban alanını doldurur. rx,rz yatay, ry düşey yarıçap */
    ellipsoid(cx, cy, cz, rx, ry, rz, rot = 0) {
      const Rh = Math.max(0.12, (rx + rz) * 0.5 * 0.92), rs = Math.max(0.16, Math.min(Rh, Math.max(ry, 0.16) * 1.05));
      if (Rh <= rs * 1.35) { api.sphere(cx, cy, cz, Math.max(rs, Rh * 0.95)); return; }
      api.sphere(cx, cy, cz, rs); const rr = Rh - rs; const n = Math.max(5, Math.ceil(Math.PI * 2 * rr / (rs * 1.15))); const c = Math.cos(rot), s = Math.sin(rot);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; let lx = Math.cos(a) * rr * (rx / Math.max(rx, rz)), lz = Math.sin(a) * rr * (rz / Math.max(rx, rz)); api.sphere(cx + lx * c + lz * s, cy, cz - lx * s + lz * c, rs); }
      if (Rh > rs * 2.6) { const n2 = Math.ceil(n * 0.5); for (let i = 0; i < n2; i++) { const a = i / n2 * Math.PI * 2 + 0.4; const lx = Math.cos(a) * rr * 0.45, lz = Math.sin(a) * rr * 0.45; api.sphere(cx + lx * c + lz * s, cy, cz - lx * s + lz * c, rs); } }
    },
    /** dairesel düz değilse: aşağıdan yukarı daralan sütun */
    column(cx, baseY, cz, r0, r1, h) {
      const n = Math.max(2, Math.ceil(h / (Math.max(r1, 0.2) * 1.1))); for (let i = 0; i <= n; i++) { const t = i / n; api.sphere(cx, baseY + h * t, cz, r0 + (r1 - r0) * t); }
    },
    /** dalgıç küresini (D.x,y,z) dışarı iter; hız bileşenini keser. Çarpma olduysa true */
    resolve(D, rad) {
      let hit = false;
      for (let it = 0; it < 3; it++) {
        let moved = false; const i0 = Math.floor((D.x - rad) / cell), i1 = Math.floor((D.x + rad) / cell), j0 = Math.floor((D.z - rad) / cell), j1 = Math.floor((D.z + rad) / cell);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const a = map.get(key(i, j)); if (!a) continue;
          for (let q = 0; q < a.length; q++) {
            const id = a[q]; const dx = D.x - X[id], dy = D.y - Y[id], dz = D.z - Z[id]; const lim = rad + R[id]; const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= lim * lim) continue;
            const d = Math.sqrt(d2); let nx, ny, nz; if (d < 1e-4) { nx = 0; ny = 1; nz = 0; } else { nx = dx / d; ny = dy / d; nz = dz / d; }
            const pen = lim - d; D.x += nx * pen; D.y += ny * pen; D.z += nz * pen; const vn = D.vx * nx + D.vy * ny + D.vz * nz; if (vn < 0) { D.vx -= nx * vn; D.vy -= ny * vn; D.vz -= nz * vn; } moved = hit = true;
          }
        }
        if (!moved) break;
      }
      return hit;
    },
    /** nokta (küçük yarıçaplı) bir katıya giriyor mu? (zıpkın için) */
    blocked(x, y, z, rad = 0.04) {
      const a = map.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!a) return false;
      for (let q = 0; q < a.length; q++) { const id = a[q]; const dx = x - X[id], dy = y - Y[id], dz = z - Z[id]; const lim = rad + R[id]; if (dx * dx + dy * dy + dz * dz < lim * lim) return true; }
      return false;
    },
  };
  return api;
}
