/* Latent Atlas — viz-a: surface, descent, penalty, clusters, dendro, pca, plane, kernel, regress */
(function () {
  const VIZ = window.VIZ;
  let K, T;
  const use = (k) => { K = k; T = k.THREE; };

  /* ---------------- shared helpers ---------------- */
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  function grad(f, x, z) { const h = 1e-4; return [(f(x + h, z) - f(x - h, z)) / (2 * h), (f(x, z + h) - f(x, z - h)) / (2 * h)]; }
  function hess(f, x, z) {
    const h = 1e-3;
    const fxx = (f(x + h, z) - 2 * f(x, z) + f(x - h, z)) / (h * h);
    const fzz = (f(x, z + h) - 2 * f(x, z) + f(x, z - h)) / (h * h);
    const fxz = (f(x + h, z + h) - f(x + h, z - h) - f(x - h, z + h) + f(x - h, z - h)) / (4 * h * h);
    return [fxx, fxz, fzz];
  }
  function circlePts(c, r, n = 48, plane = 'xz') {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const a = 2 * Math.PI * i / n, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      if (plane === 'xz') P.push([c[0] + ca, c[1], c[2] + sa]);
      else P.push([c[0] + ca, c[1] + sa, c[2]]);
    }
    return P;
  }
  function ellPts(c, a, b, n = 56) { // c, a, b are Vector3
    const P = [];
    for (let i = 0; i <= n; i++) { const t = 2 * Math.PI * i / n; P.push(c.clone().addScaledVector(a, Math.cos(t)).addScaledVector(b, Math.sin(t))); }
    return P;
  }
  function basis(n) {
    const up = Math.abs(n.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
    const u = new T.Vector3().crossVectors(up, n).normalize();
    const v = new T.Vector3().crossVectors(n, u).normalize();
    return [u, v];
  }
  function quad(c, u, v, hu, hv, o = {}) {
    const g = new T.Group();
    const P = (a, b) => c.clone().addScaledVector(u, a * hu).addScaledVector(v, b * hv);
    const pts = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), P(-1, -1)];
    if (o.fill) {
      const geo = new T.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
      g.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.fc || o.c), transparent: true, opacity: o.fill, side: T.DoubleSide, depthWrite: false })));
    }
    if (o.edge !== false) g.add(K.line(pts, { c: o.c, o: o.o, w: o.w == null ? 1 : o.w, dash: o.dash }));
    return g;
  }
  function polyFill(pts2, y, o = {}) { // pts2: [[x,z],...] filled polygon on horizontal plane
    const sh = new T.Shape(pts2.map(([x, z]) => new T.Vector2(x, -z)));
    const geo = new T.ShapeGeometry(sh);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.fill == null ? 0.15 : o.fill, side: T.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y;
    return m;
  }
  /* marching squares iso-lines of f at level L; y is number or function(x,z) */
  function iso(f, L, xr, zr, n, y) {
    const pairs = [], dx = (xr[1] - xr[0]) / n, dz = (zr[1] - zr[0]) / n, val = [];
    for (let i = 0; i <= n; i++) { val.push([]); for (let j = 0; j <= n; j++) val[i].push(f(xr[0] + i * dx, zr[0] + j * dz) - L); }
    const Y = (x, z) => (typeof y === 'function' ? y(x, z) : y);
    const P = (i0, j0, i1, j1) => {
      const a = val[i0][j0], b = val[i1][j1], t = a / (a - b);
      const x = xr[0] + (i0 + (i1 - i0) * t) * dx, z = zr[0] + (j0 + (j1 - j0) * t) * dz;
      return [x, Y(x, z), z];
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
      for (let k = 0; k < 4; k++) {
        const [a0, a1] = c[k], [b0, b1] = c[(k + 1) % 4];
        if ((val[a0][a1] < 0) !== (val[b0][b1] < 0)) pts.push(P(a0, a1, b0, b1));
      }
      if (pts.length >= 2) pairs.push([pts[0], pts[1]]);
      if (pts.length === 4) pairs.push([pts[2], pts[3]]);
    }
    return pairs;
  }
  /* floor: faint grid + back axes + labels */
  function floor(g, xr, zr, y0, h, labs = {}, o = {}) {
    const n = o.n || 8, pairs = [];
    if (o.grid !== false) {
      for (let i = 0; i <= n; i++) {
        const x = xr[0] + (xr[1] - xr[0]) * i / n, z = zr[0] + (zr[1] - zr[0]) * i / n;
        pairs.push([[x, y0, zr[0]], [x, y0, zr[1]]]); pairs.push([[xr[0], y0, z], [xr[1], y0, z]]);
      }
      g.add(K.segs(pairs, { o: 0.08 }));
    }
    g.add(K.line([[xr[0], y0, zr[0]], [xr[1], y0, zr[0]]], { o: 0.45, w: 1 }));
    g.add(K.line([[xr[0], y0, zr[0]], [xr[0], y0, zr[1]]], { o: 0.45, w: 1 }));
    if (h) g.add(K.line([[xr[0], y0, zr[0]], [xr[0], y0 + h, zr[0]]], { o: 0.45, w: 1 }));
    const s = o.ls || 0.36;
    if (labs.x) g.add(K.label(labs.x, [xr[1] + 0.45, y0, zr[0]], { size: s, o: 0.75 }));
    if (labs.z) g.add(K.label(labs.z, [xr[0], y0, zr[1] + 0.45], { size: s, o: 0.75 }));
    if (labs.y && h) g.add(K.label(labs.y, [xr[0], y0 + h + 0.35, zr[0]], { size: s, o: 0.75 }));
  }
  function wire(f, xr, zr, o = {}) { return K.surface(f, { xr, zr, n: o.n || 28, o: o.o == null ? 0.26 : o.o, c: o.c }); }
  function normF(f, xr, zr, H, lo = 0) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) {
      const v = f(xr[0] + (xr[1] - xr[0]) * i / 60, zr[0] + (zr[1] - zr[0]) * j / 60); mn = Math.min(mn, v); mx = Math.max(mx, v);
    }
    return (x, z) => lo + H * (f(x, z) - mn) / (mx - mn);
  }
  function marker(pts, o = {}) { // moving dot along a polyline; returns {obj, set(u)}
    const holder = new T.Group();
    holder.add(K.dots([[0, 0, 0]], { r: o.r || 0.12, c: o.c || 'acc' }));
    const P = pts.map((p) => (p.isVector3 ? p : V3(p[0], p[1], p[2])));
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
    const tot = L[L.length - 1] || 1;
    const set = (u) => {
      const d = Math.max(0, Math.min(1, u)) * tot;
      let i = 1; while (i < L.length - 1 && L[i] < d) i++;
      const a = P[i - 1], b = P[i], t = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
      holder.position.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
    };
    set(0);
    return { obj: holder, set };
  }
  function optim(f, s, o) {
    let x = s[0], z = s[1], vx = 0, vz = 0, mx = 0, mz = 0, sx = 0, sz = 0;
    const P = [[x, z]], r = o.rng;
    for (let t = 1; t <= o.n; t++) {
      let g;
      if (o.opt === 'nesterov') {
        g = grad(f, x + o.b * vx, z + o.b * vz);
        vx = o.b * vx - o.lr * g[0]; vz = o.b * vz - o.lr * g[1]; x += vx; z += vz;
      } else if (o.opt === 'newton') {
        g = grad(f, x, z); const [a, b, c] = hess(f, x, z); const det = a * c - b * b;
        const dx = (c * g[0] - b * g[1]) / det, dz = (-b * g[0] + a * g[1]) / det;
        x -= (o.lr || 1) * dx; z -= (o.lr || 1) * dz;
      } else {
        g = grad(f, x, z);
        if (o.noise) { g[0] += o.noise * r.n(); g[1] += o.noise * r.n(); }
        if (o.decay) { g[0] += o.decay * x; g[1] += o.decay * z; }
        if (o.clip) { const nn = Math.hypot(g[0], g[1]); if (nn > o.clip) { g[0] *= o.clip / nn; g[1] *= o.clip / nn; } }
        if (o.opt === 'momentum') { vx = o.b * vx - o.lr * g[0]; vz = o.b * vz - o.lr * g[1]; x += vx; z += vz; }
        else if (o.opt === 'rmsprop') {
          sx = 0.9 * sx + 0.1 * g[0] * g[0]; sz = 0.9 * sz + 0.1 * g[1] * g[1];
          x -= o.lr * g[0] / (Math.sqrt(sx) + 1e-8); z -= o.lr * g[1] / (Math.sqrt(sz) + 1e-8);
        } else if (o.opt === 'adam') {
          mx = 0.9 * mx + 0.1 * g[0]; mz = 0.9 * mz + 0.1 * g[1];
          sx = 0.999 * sx + 0.001 * g[0] * g[0]; sz = 0.999 * sz + 0.001 * g[1] * g[1];
          const c1 = 1 - Math.pow(0.9, t), c2 = 1 - Math.pow(0.999, t);
          x -= o.lr * (mx / c1) / (Math.sqrt(sz === sz ? sx / c2 : 0) + 1e-8);
          z -= o.lr * (mz / c1) / (Math.sqrt(sz / c2) + 1e-8);
        } else { x -= o.lr * g[0]; z -= o.lr * g[1]; }
      }
      P.push([x, z]);
      if (o.stop && o.stop(x, z)) break;
    }
    return P;
  }
  const lift = (P, Y, dy = 0.05) => P.map(([x, z]) => [x, Y(x, z) + dy, z]);

  /* 3x3 symmetric eigen (Jacobi). returns {vals, vecs (columns as arrays)} sorted desc */
  function eig3(A) {
    const a = A.map((r) => r.slice()); const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 30; sweep++) {
      for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-12) continue;
        const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
    return { vals: idx.map((i) => a[i][i]), vecs: idx.map((i) => [v[0][i], v[1][i], v[2][i]]) };
  }
  function solve(A, b) { // Gaussian elimination
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  /* ================= SURFACE ================= */
  VIZ.surface = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), kind = p.f || 'bowl', R = [-4, 4];
    let legend = [], tick = null;
    const add = (o) => { g.add(o); return o; };

    if (kind === 'valley') {
      const s2 = Math.SQRT1_2;
      const f = (x, z) => { const u = (x + z) * s2, v = (x - z) * s2; return 0.018 * u * u + 0.2 * v * v; };
      const Y = (x, z) => 0.5 * f(x, z);
      floor(g, R, R, 0, 3.4, { x: 'β₁', z: 'β₂', y: 'L' });
      add(wire(Y, R, R, { o: 0.24 }));
      add(K.segs([0.15, 0.4, 0.8, 1.4, 2.2].flatMap((l) => iso(f, l, R, R, 40, 0.005)), { o: 0.35 }));
      const val = []; for (let i = 0; i <= 40; i++) { const t = -4 + 8 * i / 40; val.push([t, Y(t, t) + 0.03, t]); }
      add(K.line(val, { c: 'acc', w: 2.6 }));
      add(K.line(val.map(([x, , z]) => [x, 0.01, z]), { c: 'acc', w: 1.4, o: 0.6, dash: true }));
      legend = [{ c: 'acc', t: 'Flat valley floor' }];
    } else if (kind === 'harmonic') {
      const toPR = (x) => (4 - x) / 8;
      const F = (x, z) => { const P = toPR(x), Rr = toPR(z); return P + Rr > 0 ? 2 * P * Rr / (P + Rr) : 0; };
      const H = 3.4, Y = (x, z) => H * F(x, z);
      floor(g, R, R, 0, 0, {}, {});
      g.add(K.line([[4, 0, 4], [-4, 0, 4]], { o: 0.45, w: 1 })); g.add(K.line([[4, 0, 4], [4, 0, -4]], { o: 0.45, w: 1 }));
      g.add(K.line([[-4, 0, -4], [-4, H + 0.4, -4]], { o: 0.45, w: 1 }));
      g.add(K.label('P', [-4.5, 0, 4.2], { size: 0.36, o: 0.75 })); g.add(K.label('R', [4.3, 0, -4.5], { size: 0.36, o: 0.75 }));
      g.add(K.label('F1', [-4, H + 0.8, -4], { size: 0.36, o: 0.75 }));
      g.add(K.label('1', [-4.4, H, -4], { size: 0.3, o: 0.6 }));
      add(wire(Y, R, R, { o: 0.22, n: 24 }));
      [0.2, 0.4, 0.6, 0.8].forEach((l) => add(K.segs(iso(F, l, R, R, 48, (x, z) => H * l + 0.01), { o: 0.6 })));
      [0.2, 0.4, 0.6, 0.8].forEach((l) => add(K.segs(iso(F, l, R, R, 48, 0.005), { o: 0.18 })));
      const rid = []; for (let i = 0; i <= 30; i++) { const t = -4 + 8 * i / 30; rid.push([t, Y(t, t) + 0.03, t]); }
      add(K.line(rid, { c: 'acc', w: 2.6 }));
      add(K.dots([[-4, H + 0.03, -4]], { r: 0.11, c: 'acc' }));
      const am = (x, z) => H * (toPR(x) + toPR(z)) / 2;
      add(K.line([[4, am(4, -4), -4], [-4, am(-4, -4), -4], [-4, am(-4, 4), 4]], { w: 1, o: 0.35, dash: true }));
      legend = [{ c: 'acc', t: 'Balanced P and R' }, { c: 'ink', t: 'Equal F1 contours' }];
    } else if (kind === 'pdp') {
      const f = (x, z) => 1.5 + 0.85 * Math.sin(0.8 * x) + 0.16 * x * z * 0.5 + 0.1 * z;
      floor(g, R, R, 0, 3.4, { x: 'x₁', z: 'x₂', y: 'f̂' });
      add(wire(f, R, R, { o: 0.2, n: 24 }));
      const zs = [-3.2, -1.6, 0, 1.6, 3.2];
      zs.forEach((zz) => { const c = []; for (let i = 0; i <= 50; i++) { const x = -4 + 8 * i / 50; c.push([x, f(x, zz) + 0.02, zz]); } add(K.line(c, { w: 1.2, o: 0.55 })); });
      // averaged curve on back wall
      const zb = -4.9, pd = [];
      for (let i = 0; i <= 60; i++) { const x = -4 + 8 * i / 60; let s = 0; zs.forEach((zz) => { s += f(x, zz); }); pd.push([x, s / zs.length, zb]); }
      add(K.rect(0, 1.7, zb, 8, 3.4, 'xy', { o: 0.25 }));
      add(K.line(pd, { c: 'acc', w: 2.6 }));
      [-2, 2].forEach((x) => { const yy = pd[Math.round((x + 4) / 8 * 60)][1]; add(K.line([[x, yy, zb], [x, yy, 3.2]], { o: 0.18, w: 1, dash: true })); });
      add(K.label('PD(x₁)', [4.6, pd[60][1] + 0.4, zb], { size: 0.34, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Partial dependence' }, { c: 'ink', t: 'Slices at fixed x₂' }];
    } else if (kind === 'ripple') {
      const f = (x, z) => 1.6 + 0.8 * Math.sin(0.95 * x) * Math.cos(0.75 * z) + 0.05 * x * x;
      floor(g, R, R, 0, 3.4, { x: 'x₁', z: 'x₂', y: 'f̂' });
      add(wire(f, R, R, { o: 0.22, n: 30 }));
      const x0 = 1.0, z0 = 0.9, f0 = f(x0, z0), [gx, gz] = grad(f, x0, z0), h = 1.3;
      const pl = (x, z) => f0 + gx * (x - x0) + gz * (z - z0);
      const corners = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([a, b]) => [x0 + a, pl(x0 + a, z0 + b), z0 + b]);
      const geo = new T.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3].map((i) => V3(...corners[i])));
      add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf('acc'), transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false })));
      add(K.line(corners, { c: 'acc', w: 2 }));
      const gp = []; for (let i = 1; i < 4; i++) { const t = -h + 2 * h * i / 4; gp.push([[x0 + t, pl(x0 + t, z0 - h), z0 - h], [x0 + t, pl(x0 + t, z0 + h), z0 + h]]); gp.push([[x0 - h, pl(x0 - h, z0 + t), z0 + t], [x0 + h, pl(x0 + h, z0 + t), z0 + t]]); }
      add(K.segs(gp, { c: 'acc', o: 0.45 }));
      const r = K.rng(7), smp = [];
      for (let i = 0; i < 16; i++) { const x = x0 + 0.8 * r.n(), z = z0 + 0.8 * r.n(); smp.push([x, f(x, z) + 0.04, z]); }
      add(K.dots(smp, { r: 0.06, o: 0.85 }));
      add(K.dots([[x0, f0 + 0.04, z0]], { r: 0.13, c: 'acc' }));
      add(K.line([[x0, 0, z0], [x0, f0, z0]], { c: 'acc', w: 1, o: 0.6, dash: true }));
      add(K.dots([[x0, 0.01, z0]], { r: 0.06, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Local linear model' }, { c: 'ink', t: 'Perturbed samples' }];
    } else if (kind === 'multi') {
      const f0 = (x, z) => 0.07 * (x * x + z * z) - 1.5 * Math.exp(-((x - 1.7) ** 2 + (z + 1.2) ** 2) / 1.1)
        - 0.9 * Math.exp(-((x + 2.1) ** 2 + (z - 1.6) ** 2) / 0.9) - 0.75 * Math.exp(-((x + 1.6) ** 2 + (z + 2.3) ** 2) / 0.6)
        - 0.7 * Math.exp(-((x - 1.5) ** 2 + (z - 2.4) ** 2) / 0.6) + 0.18 * Math.sin(1.4 * x) * Math.cos(1.2 * z);
      const Y = normF(f0, R, R, 3.4, 0);
      floor(g, R, R, 0, 3.6, { x: 'θ₁', z: 'θ₂', y: 'L' }, { grid: false });
      add(wire(Y, R, R, { o: 0.22, n: 36 }));
      add(K.segs([0.5, 0.9, 1.3, 1.8, 2.4].flatMap((l) => iso(Y, l, R, R, 50, 0.005)), { o: 0.22 }));
      const n = 70, mins = [];
      const at = (i, j) => Y(-4 + 8 * i / n, -4 + 8 * j / n);
      for (let i = 2; i < n - 1; i++) for (let j = 2; j < n - 1; j++) {
        const v = at(i, j); let ok = true;
        for (let a = -2; a <= 2 && ok; a++) for (let b = -2; b <= 2; b++) if ((a || b) && at(i + a, j + b) <= v) { ok = false; break; }
        if (ok) mins.push([-4 + 8 * i / n, v, -4 + 8 * j / n]);
      }
      mins.sort((a, b) => a[1] - b[1]);
      const gm = mins[0], loc = mins.slice(1);
      add(K.dots(loc.map(([x, y, z]) => [x, y + 0.06, z]), { r: 0.11 }));
      loc.forEach(([x, y, z]) => add(K.line([[x, 0, z], [x, y, z]], { o: 0.35, w: 1, dash: true })));
      add(K.dots([[gm[0], gm[1] + 0.07, gm[2]]], { r: 0.16, c: 'acc' }));
      add(K.line([[gm[0], 0, gm[2]], [gm[0], gm[1], gm[2]]], { c: 'acc', w: 1.4, dash: true }));
      add(K.line(circlePts([gm[0], 0.01, gm[2]], 0.35), { c: 'acc', w: 1.6 }));
      legend = [{ c: 'acc', t: 'Global minimum' }, { c: 'ink', t: 'Local minima' }];
    } else if (kind === 'saddle') {
      const f = (x, z) => 1.7 + 0.11 * (x * x - z * z);
      floor(g, R, R, -0.2, 3.8, { x: 'θ₁', z: 'θ₂', y: 'L' });
      add(wire(f, R, R, { o: 0.22 }));
      const cx = [], cz = [];
      for (let i = 0; i <= 40; i++) { const t = -4 + 8 * i / 40; cx.push([t, f(t, 0) + 0.03, 0]); cz.push([0, f(0, t) + 0.03, t]); }
      add(K.line(cx, { c: 'acc', w: 2.2 }));
      add(K.line(cz, { c: 'acc', w: 2.2, dash: true }));
      add(K.arrow([0, f(0, 0) + 0.03, 0], [0, f(0, 1.6) + 0.03, 1.6], { c: 'acc', w: 2.2, head: 0.3 }));
      add(K.dots([[0, 1.73, 0]], { r: 0.15, c: 'acc' }));
      add(K.line([[0, -0.2, 0], [0, 1.7, 0]], { c: 'acc', w: 1, o: 0.5, dash: true }));
      add(K.label('∇L = 0', [0.2, 2.45, -0.6], { size: 0.36, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Saddle point' }, { c: 'ink', t: 'Loss surface' }];
    } else if (kind === 'sharpflat') {
      const f = (x, z) => 3 - 2.6 * Math.exp(-((x + 2) ** 2 + (z + 0.6) ** 2) / 0.22) - 2.4 * Math.exp(-((x - 1.7) ** 2 + (z - 0.6) ** 2) / 4.2);
      floor(g, R, R, 0, 3.4, { x: 'θ₁', z: 'θ₂', y: 'L' }, { grid: false });
      add(wire(f, R, R, { o: 0.2, n: 48 }));
      const sec = (cx, cz, h) => { const c = []; for (let i = 0; i <= 60; i++) { const x = cx - h + 2 * h * i / 60; c.push([x, f(x, cz) + 0.03, cz]); } return c; };
      add(K.line(sec(-2, -0.6, 1.3), { w: 1.8 }));
      add(K.line(sec(1.7, 0.6, 2.2), { c: 'acc', w: 2.4 }));
      const smin = [-2, f(-2, -0.6) + 0.05, -0.6], fmin = [1.7, f(1.7, 0.6) + 0.05, 0.6];
      add(K.dots([smin], { r: 0.12 }));
      add(K.dots([fmin], { r: 0.15, c: 'acc' }));
      // same small shift δ at both minima
      const d = 0.7;
      add(K.line([[-2 + d, smin[1], -0.6], [-2 + d, f(-2 + d, -0.6), -0.6]], { w: 1.6, dash: true }));
      add(K.line([[1.7 + d, fmin[1], 0.6], [1.7 + d, f(1.7 + d, 0.6) + 0.03, 0.6]], { c: 'acc', w: 1.6 }));
      add(K.line([[-2, smin[1], -0.6], [-2 + d, smin[1], -0.6]], { w: 1, o: 0.6 }));
      add(K.line([[1.7, fmin[1], 0.6], [1.7 + d, fmin[1], 0.6]], { c: 'acc', w: 1, o: 0.7 }));
      add(K.segs(iso(f, 0.8, R, R, 60, 0.005), { c: 'acc', o: 0.7 }));
      add(K.segs(iso(f, 0.8, [-3.2, -0.8], [-1.8, 0.6], 30, 0.005), { o: 0.6 }));
      legend = [{ c: 'acc', t: 'Flat minimum' }, { c: 'ink', t: 'Sharp minimum' }];
    } else if (kind === 'chinchilla') {
      const ab = (x) => (x + 4) / 8;
      const Lf = (x, z) => 0.5 + 1.9 * Math.exp(-2.6 * ab(x)) + 1.6 * Math.exp(-2.1 * ab(z));
      const Y = (x, z) => 0.95 * Lf(x, z);
      floor(g, R, R, 0, 3.6, { x: 'log N', z: 'log D', y: 'L' }, { ls: 0.32 });
      add(wire(Y, R, R, { o: 0.22, n: 24 }));
      const cs = [-5.2, -3, -0.8, 1.4, 3.6, 5.8], opt = [];
      cs.forEach((c) => {
        const ln = []; let best = null;
        for (let i = 0; i <= 120; i++) {
          const x = -4 + 8 * i / 120, z = c - x; if (z < -4 || z > 4) continue;
          const y = Y(x, z); ln.push([x, y + 0.02, z]); if (!best || y < best[1]) best = [x, y, z];
        }
        if (ln.length > 1) add(K.line(ln, { w: 1.2, o: 0.55, dash: true }));
        if (best) opt.push(best);
      });
      const fr = []; // continuous frontier
      for (let k = 0; k <= 60; k++) {
        const c = -5.6 + 11.6 * k / 60; let best = null;
        for (let i = 0; i <= 200; i++) { const x = -4 + 8 * i / 200, z = c - x; if (z < -4 || z > 4) continue; const y = Y(x, z); if (!best || y < best[1]) best = [x, y, z]; }
        if (best) fr.push([best[0], best[1] + 0.04, best[2]]);
      }
      add(K.line(fr, { c: 'acc', w: 2.6 }));
      add(K.dots(opt.map(([x, y, z]) => [x, y + 0.05, z]), { r: 0.11, c: 'acc' }));
      add(K.line(fr.map(([x, , z]) => [x, 0.01, z]), { c: 'acc', w: 1.2, o: 0.5, dash: true }));
      legend = [{ c: 'acc', t: 'Compute-optimal frontier' }, { c: 'ink', t: 'Fixed compute budget' }];
    } else if (kind === 'twobowl') {
      const A = [-2.2, -1.4], B = [2.0, 1.6];
      const LA = (x, z) => 0.13 * ((x - A[0]) ** 2 + 1.3 * (z - A[1]) ** 2);
      const LB = (x, z) => 0.13 * (1.4 * (x - B[0]) ** 2 + (z - B[1]) ** 2);
      const sA = 0.42, YA = (x, z) => sA * LA(x, z);
      floor(g, R, R, 0, 4, { x: 'θ₁', z: 'θ₂', y: 'L_A' });
      add(wire(YA, R, R, { o: 0.22, n: 26 }));
      add(K.segs([0.3, 0.9, 1.8, 3].flatMap((l) => iso(LB, l, R, R, 50, 0.005)), { o: 0.4 }));
      add(K.dots([[B[0], 0.02, B[1]]], { r: 0.09 }));
      const path = optim(LB, A, { lr: 0.9, n: 40 });
      const P3 = path.map(([x, z]) => [x, YA(x, z) + 0.04, z]);
      add(K.line(P3, { c: 'acc', w: 2.6 }));
      add(K.line(path.map(([x, z]) => [x, 0.02, z]), { c: 'acc', w: 1.2, o: 0.55, dash: true }));
      const e = P3[P3.length - 1];
      add(K.line([[e[0], 0.02, e[2]], [e[0], e[1], e[2]]], { c: 'acc', w: 1.4, dash: true }));
      add(K.label('ΔL_A', [e[0] + 0.75, e[1] * 0.5, e[2]], { size: 0.34, c: 'acc' }));
      add(K.dots([[A[0], 0.07, A[1]]], { r: 0.13 }));
      add(K.dots([e], { r: 0.13, c: 'acc' }));
      add(K.label('θ*_A', [A[0] - 0.9, 0.35, A[1]], { size: 0.32 }));
      add(K.label('θ*_B', [B[0] + 0.4, -0.05, B[1] + 0.75], { size: 0.32 }));
      const m = marker(P3, { r: 0.1 }); add(m.obj);
      tick = (t) => m.set(((t % 5) / 4));
      legend = [{ c: 'acc', t: 'Training on task B' }, { c: 'ink', t: 'Task A loss' }];
    } else if (kind === 'merge') {
      const t1 = [-1.9, 1.0], t2 = [1.9, -0.7], t0 = [-0.6, -3];
      const f = (x, z) => 0.055 * (x * x + 2.4 * (z - 0.1 * x) ** 2) + 0.7
        - 0.55 * Math.exp(-((x - t1[0]) ** 2 + (z - t1[1]) ** 2) / 0.5) - 0.55 * Math.exp(-((x - t2[0]) ** 2 + (z - t2[1]) ** 2) / 0.5);
      floor(g, R, R, 0, 3.4, { x: 'θ₁', z: 'θ₂', y: 'L' }, { grid: false });
      add(wire(f, R, R, { o: 0.2, n: 32 }));
      add(K.segs([0.35, 0.6, 1, 1.6].flatMap((l) => iso(f, l, R, R, 50, 0.005)), { o: 0.22 }));
      const S = (q) => [q[0], f(q[0], q[1]) + 0.05, q[1]];
      const ln = []; for (let i = 0; i <= 30; i++) { const u = i / 30; const x = t1[0] + (t2[0] - t1[0]) * u, z = t1[1] + (t2[1] - t1[1]) * u; ln.push([x, f(x, z) + 0.04, z]); }
      add(K.line(ln, { c: 'acc', w: 1.6, dash: true }));
      // fine-tuning from shared base
      [t1, t2].forEach((q) => { const c = []; for (let i = 0; i <= 20; i++) { const u = i / 20, x = t0[0] + (q[0] - t0[0]) * u, z = t0[1] + (q[1] - t0[1]) * u; c.push([x, f(x, z) + 0.04, z]); } add(K.line(c, { w: 1.2, o: 0.5 })); });
      add(K.dots([S(t0)], { r: 0.1, o: 0.7 }));
      add(K.dots([S(t1), S(t2)], { r: 0.13 }));
      const mid = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
      add(K.dots([S(mid)], { r: 0.17, c: 'acc' }));
      add(K.line([[mid[0], 0, mid[1]], S(mid)], { c: 'acc', w: 1.2, o: 0.7, dash: true }));
      add(K.label('θ_A', [t1[0] - 0.3, S(t1)[1] + 0.55, t1[1]], { size: 0.34 }));
      add(K.label('θ_B', [t2[0] + 0.3, S(t2)[1] + 0.55, t2[1]], { size: 0.34 }));
      add(K.label('θ₀', [t0[0], S(t0)[1] + 0.45, t0[1]], { size: 0.34, o: 0.7 }));
      add(K.label('½(θ_A+θ_B)', [mid[0], S(mid)[1] + 0.6, mid[1]], { size: 0.32, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Merged weights' }, { c: 'ink', t: 'Fine-tuned models' }];
    } else { // bowl (convex)
      const f = (x, z) => 0.11 * (x * x + 0.8 * z * z) + 0.2;
      floor(g, R, R, 0, 3.6, { x: 'θ₁', z: 'θ₂', y: 'L' });
      add(wire(f, R, R, { o: 0.24 }));
      add(K.segs([0.5, 1, 1.6, 2.3].flatMap((l) => iso(f, l, R, R, 40, 0.005)), { o: 0.25 }));
      const a = [-3.4, -1.5], b = [2.6, 3.2];
      add(K.line([[a[0], f(...a), a[1]], [b[0], f(...b), b[1]]], { w: 1.4, o: 0.7, dash: true }));
      add(K.dots([[a[0], f(...a), a[1]], [b[0], f(...b), b[1]]], { r: 0.08, o: 0.8 }));
      add(K.dots([[0, 0.27, 0]], { r: 0.16, c: 'acc' }));
      add(K.line([[0, 0, 0], [0, 0.2, 0]], { c: 'acc', w: 1.4 }));
      add(K.line(circlePts([0, 0.01, 0], 0.4), { c: 'acc', w: 1.6 }));
      add(K.label('θ*', [0.1, 0.85, -0.2], { size: 0.38, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Unique minimum' }, { c: 'ink', t: 'Chord above surface' }];
    }
    return { g, legend, tick };
  };

  /* ================= DESCENT ================= */
  VIZ.descent = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const fk = p.f || 'bowl', opt = p.opt || 'gd';
    let f, Y, xr = [-4, 4], zr = [-4, 4], levels = [];
    if (fk === 'valley') {
      xr = [-5, 5]; zr = [-3, 3];
      f = (x, z) => 0.03 * x * x + 0.3 * z * z; Y = (x, z) => f(x, z) * 0.9 + 0.05; levels = [0.05, 0.2, 0.5, 1, 1.8, 2.8];
    } else if (fk === 'rosen') {
      xr = [-4.5, 4]; zr = [-2.5, 4.5];
      f = (x, z) => 0.06 * (x - 2) ** 2 + 0.8 * (z - (0.25 * x * x - 1)) ** 2; Y = (x, z) => 1.1 * Math.log(1 + 2 * f(x, z)); levels = [0.05, 0.2, 0.6, 1.5, 4, 9];
    } else if (fk === 'cliff') {
      xr = [-4, 4]; zr = [-3, 3];
      f = (x, z) => 0.05 * ((x - 2.6) ** 2 + 2 * z * z) + 2.4 / (1 + Math.exp(-14 * (-x - 1))); Y = (x, z) => f(x, z) * 0.95 + 0.05; levels = [0.1, 0.3, 0.6, 1.2, 2, 2.6];
    } else {
      f = opt === 'lrhigh' ? (x, z) => 0.05 * x * x + 0.2 * z * z : (x, z) => 0.075 * x * x + 0.14 * z * z; Y = (x, z) => f(x, z) * 1.15 + 0.05; levels = [0.1, 0.4, 0.9, 1.6, 2.4];
    }
    const H = 3.6;
    floor(g, xr, zr, 0, H, { x: 'θ₁', z: 'θ₂', y: 'L' }, { grid: false });
    add(K.surface(Y, { xr, zr, n: 30, o: 0.2 }));
    add(K.segs(levels.flatMap((l) => iso(f, l, xr, zr, 50, 0.005)), { o: 0.22 }));
    const r = K.rng(11);
    let main, other = null, legend, start, oc = 'ink', oDash = true, extra = [];
    const inR = (x, z) => x < xr[0] - 0.2 || x > xr[1] + 0.2 || z < zr[0] - 0.2 || z > zr[1] + 0.2;
    if (opt === 'gd') {
      start = [-3.5, 3.2]; main = optim(f, start, { lr: 2.2, n: 30 });
      legend = [{ c: 'acc', t: 'Gradient path' }];
    } else if (opt === 'sgd') {
      start = [-3.5, 3.2]; main = optim(f, start, { lr: 1.8, n: 45, noise: 0.22, rng: r });
      other = optim(f, start, { lr: 2.2, n: 30 });
      legend = [{ c: 'acc', t: 'SGD path' }, { c: 'ink', t: 'Full-batch gradient' }];
    } else if (opt === 'momentum' || opt === 'nesterov' || opt === 'rmsprop' || opt === 'newton') {
      start = [-4.6, 2.4];
      const gd = optim(f, start, { lr: 3.1, n: 30 });
      if (opt === 'momentum') { main = optim(f, start, { opt: 'momentum', lr: 0.95, b: 0.8, n: 30 }); other = gd; legend = [{ c: 'acc', t: 'Momentum path' }, { c: 'ink', t: 'Plain gradient descent' }]; }
      if (opt === 'nesterov') { main = optim(f, start, { opt: 'nesterov', lr: 0.95, b: 0.8, n: 30 }); other = optim(f, start, { opt: 'momentum', lr: 0.95, b: 0.8, n: 30 }); legend = [{ c: 'acc', t: 'Nesterov path' }, { c: 'ink', t: 'Classical momentum' }]; }
      if (opt === 'rmsprop') { main = optim(f, start, { opt: 'rmsprop', lr: 0.32, n: 30 }); other = gd; legend = [{ c: 'acc', t: 'RMSProp path' }, { c: 'ink', t: 'Plain gradient descent' }]; }
      if (opt === 'newton') {
        main = optim(f, start, { opt: 'newton', lr: 0.7, n: 4 }); other = gd;
        legend = [{ c: 'acc', t: 'Newton steps' }, { c: 'ink', t: 'Plain gradient descent' }];
      }
    } else if (opt === 'adam') {
      start = [-3.8, 3.2];
      main = optim(f, start, { opt: 'adam', lr: 0.12, n: 130 });
      other = optim(f, start, { lr: 0.3, n: 60 });
      legend = [{ c: 'acc', t: 'Adam path' }, { c: 'ink', t: 'Plain gradient descent' }];
    } else if (opt === 'decay') {
      const ws = [2.6, 2.0];
      const fd = (x, z) => 0.06 * ((x - ws[0]) ** 2 + 1.4 * (z - ws[1]) ** 2);
      f = fd; Y = (x, z) => fd(x, z) * 0.95 + 0.05;
      g.clear();
      floor(g, xr, zr, 0, H, { x: 'θ₁', z: 'θ₂', y: 'L' }, { grid: false });
      add(K.surface(Y, { xr, zr, n: 30, o: 0.2 }));
      add(K.segs([0.1, 0.4, 0.9, 1.6, 2.5].flatMap((l) => iso(fd, l, xr, zr, 50, 0.005)), { o: 0.22 }));
      start = [-3.4, 3.4];
      main = optim(fd, start, { lr: 3, n: 40, decay: 0.11 });
      other = optim(fd, start, { lr: 3, n: 40 });
      // origin and pull
      [0.6, 1.2, 1.8].forEach((rr) => add(K.line(circlePts([0, 0.01, 0], rr), { o: 0.2, w: 1 })));
      const e = main[main.length - 1];
      add(K.line([[e[0], 0.02, e[1]], [0, 0.02, 0]], { c: 'acc', w: 1.2, o: 0.6, dash: true }));
      add(K.line([[ws[0], 0.02, ws[1]], [e[0], 0.02, e[1]]], { w: 1, o: 0.5, dash: true }));
      add(K.dots([[ws[0], Y(...ws) + 0.03, ws[1]]], { r: 0.14, hollow: true }));
      add(K.dots([[0, 0.03, 0]], { r: 0.06 }));
      add(K.label('w*', [ws[0] + 0.3, 0.75, ws[1] - 0.3], { size: 0.34 }));
      add(K.label('0', [-0.45, 0.25, 0.45], { size: 0.32, o: 0.7 }));
      legend = [{ c: 'acc', t: 'Path with weight decay' }, { c: 'ink', t: 'Unregularised path' }];
    } else if (opt === 'lrhigh') {
      start = [-3.6, 2.4];
      main = optim(f, start, { lr: 5.15, n: 9 });
      other = optim(f, start, { lr: 1.9, n: 24 }); oc = 'g'; oDash = false;
      legend = [{ c: 'acc', t: 'Learning rate too high' }, { c: 'g', t: 'Well-chosen learning rate' }];
    } else if (opt === 'clip') {
      start = [-3.7, 1.9];
      const cut = (P) => { const o = []; for (const q of P) { o.push(q); if (inR(q[0], q[1])) break; } return o; };
      other = cut(optim(f, start, { lr: 1.05, n: 40 }));
      main = optim(f, start, { lr: 1.05, n: 40, clip: 0.55 });
      legend = [{ c: 'acc', t: 'Clipped gradient path' }, { c: 'ink', t: 'Exploding step' }];
    }
    const clampP = (P) => P.map(([x, z]) => [Math.max(xr[0], Math.min(xr[1], x)), Math.max(zr[0], Math.min(zr[1], z))]);
    if (other) {
      if (opt === 'clip') {
        const o3 = []; let exit = null;
        for (const q of other) { if (inR(q[0], q[1])) { exit = q; break; } o3.push([q[0], Y(q[0], q[1]) + 0.05, q[1]]); }
        add(K.line(o3, { w: 1.4, o: 0.75, dash: true }));
        add(K.dots(o3, { r: 0.05, o: 0.7 }));
        if (exit) {
          const last = o3[o3.length - 1]; const d = V3(exit[0] - last[0], 0, exit[1] - last[2]).normalize();
          const far = [last[0] + d.x * 4.2, last[1] + 2.4, last[2] + d.z * 4.2];
          add(K.arrow(last, far, { w: 1.4, o: 0.75, dash: true, head: 0.3 }));
        }
      } else {
        const o3 = lift(clampP(other), Y, 0.04);
        add(K.line(o3, { c: oc, w: oc === 'ink' ? 1.3 : 2, o: oc === 'ink' ? 0.6 : 0.9, dash: oDash }));
        if (oc !== 'ink') add(K.dots(o3, { r: 0.05, c: oc }));
      }
    }
    const m3 = lift(clampP(main), Y, 0.06);
    add(K.line(m3, { c: 'acc', w: 2.4 }));
    add(K.dots(m3, { r: 0.055, c: 'acc' }));
    add(K.dots([m3[0]], { r: 0.1 }));
    const end = m3[m3.length - 1];
    add(K.dots([end], { r: 0.12, c: 'acc' }));
    const mk = marker(m3, { r: 0.13 }); add(mk.obj);
    const tick = (t) => { const u = (t % 5.5) / 4.5; mk.set(K.ease(Math.min(1, u))); };
    return { g, legend, tick };
  };

  /* ================= PENALTY ================= */
  VIZ.penalty = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const kind = p.k || 'l2', lam = p['λ'] == null ? 1 : p['λ'];
    const al = kind === 'l1' ? 1 : kind === 'en' ? 0.7 : 0;
    const ws = [3.1, 1.3], phi = -0.45, l1 = 1, l2 = 0.3;
    const c = Math.cos(phi), s = Math.sin(phi);
    const Q = (x, z) => { const dx = x - ws[0], dz = z - ws[1]; const u = c * dx + s * dz, v = -s * dx + c * dz; return l1 * u * u + l2 * v * v; };
    const hY = 0.3;
    // constraint ball: alpha*s*|d|1 + (1-alpha)*s^2*|d|2^2 <= t
    const t = Math.min(4, 2.2 / Math.pow(lam, 0.8));
    const tt = al * t + (1 - al) * t * t;
    const rad = (th) => { const dx = Math.cos(th), dz = Math.sin(th), n1 = Math.abs(dx) + Math.abs(dz); const A = (1 - al), B = al * n1; return A < 1e-9 ? tt / B : (-B + Math.sqrt(B * B + 4 * A * tt)) / (2 * A); };
    const N = 360, bd = [];
    for (let i = 0; i <= N; i++) { const th = 2 * Math.PI * i / N, rr = rad(th); bd.push([rr * Math.cos(th), rr * Math.sin(th)]); }
    let best = 0; bd.forEach((q, i) => { if (Q(q[0], q[1]) < Q(bd[best][0], bd[best][1])) best = i; });
    const sol = bd[best], Ls = Q(sol[0], sol[1]), ys = Ls * hY;
    const S = 4.3;
    floor(g, [-S, S], [-S, S], 0, 0, { x: 'w₁', z: 'w₂' }, { n: 8 });
    g.add(K.line([[-S, 0, 0], [S, 0, 0]], { o: 0.35, w: 1 }));
    g.add(K.line([[0, 0, -S], [0, 0, S]], { o: 0.35, w: 1 }));
    // loss rings stacked as a bowl
    const ring = (L, y, o) => { const P = []; const k = Math.sqrt(L); for (let i = 0; i <= 72; i++) { const a = 2 * Math.PI * i / 72; const u = k * Math.cos(a) / Math.sqrt(l1), v = k * Math.sin(a) / Math.sqrt(l2); P.push([ws[0] + c * u - s * v, y, ws[1] + s * u + c * v]); } return K.line(P, o); };
    for (let k = 1; k <= 6; k++) { const L = Math.pow(k * 0.6, 2); if (L * hY > 2.8) break; add(ring(L, L * hY, { w: 1, o: 0.35 })); add(ring(L, 0.005, { w: 1, o: 0.13 })); }
    add(ring(Ls, ys, { w: 2 }));
    add(ring(Ls, 0.006, { w: 1.2, o: 0.6, dash: true }));
    add(K.dots([[ws[0], 0.03, ws[1]]], { r: 0.1 }));
    add(K.label('ŵ', [ws[0] + 0.35, 0.35, ws[1] + 0.2], { size: 0.36 }));
    // region
    add(polyFill(bd, 0.01, { c: 'acc', fill: 0.18 }));
    add(K.line(bd.map(([x, z]) => [x, 0.012, z]), { c: 'acc', w: 2.2 }));
    add(K.line(bd.map(([x, z]) => [x, ys, z]), { c: 'acc', w: 1, o: 0.45 }));
    const vert = [];
    if (al === 1) [[t, 0], [0, t], [-t, 0], [0, -t]].forEach(([x, z]) => vert.push([[x, 0, z], [x, ys, z]]));
    else for (let i = 0; i < 12; i++) { const q = bd[Math.round(i * N / 12)]; vert.push([[q[0], 0, q[1]], [q[0], ys, q[1]]]); }
    add(K.segs(vert, { c: 'acc', o: 0.3 }));
    add(K.dots([[sol[0], ys, sol[1]]], { r: 0.15, c: 'acc' }));
    add(K.dots([[sol[0], 0.02, sol[1]]], { r: 0.1, c: 'acc' }));
    add(K.line([[sol[0], 0, sol[1]], [sol[0], ys, sol[1]]], { c: 'acc', w: 1.4 }));
    if (kind === 'l1' && Math.abs(sol[1]) < 0.05) add(K.label('w₂ = 0', [sol[0] + 0.2, ys + 0.6, sol[1]], { size: 0.36, c: 'acc' }));
    add(K.label(kind === 'l1' ? '‖w‖₁ ≤ t' : kind === 'l2' ? '‖w‖₂² ≤ t' : 'L1 + L2 ≤ t', [-1.2, 0.05, -t - 0.9], { size: 0.32, c: 'acc' }));
    const lg = { l1: 'L1 constraint region', l2: 'L2 constraint region', en: 'Elastic net region' }[kind];
    return {
      g, legend: [{ c: 'acc', t: lg }, { c: 'acc', t: kind === 'l1' ? 'Sparse solution' : 'Regularised solution' }, { c: 'ink', t: 'Loss contours' }],
      ctl: [{ key: 'λ', label: 'λ', min: 0.3, max: 2, step: 0.1, value: lam }],
    };
  };

  /* ================= CLUSTERS ================= */
  function blobs(r, centers, n, sd) {
    const P = [];
    centers.forEach((c, ci) => { for (let i = 0; i < n; i++) P.push({ p: [c[0] + sd * r.n(), c[1] + sd * r.n() * 0.8, c[2] + sd * r.n()], c: ci }); });
    return P;
  }
  VIZ.clusters = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const mode = p.mode || 'kmeans', r = K.rng(23);
    let legend = [], tick = null, ctl;
    const FL = (h = 0) => floor(g, [-4, 4], [-4, 4], h, 0, {}, { n: 8 });

    if (mode === 'kmeans') {
      const k = Math.round(p.k || 3);
      const data = blobs(r, [[-2.2, 1.6, -1.6], [2, 2.6, -1.2], [-0.6, 3, 2.2], [2.4, 1.2, 2.2]], 32, 0.62).map((d) => d.p);
      FL(0);
      // farthest-point init then Lloyd
      const C = [data[0].slice()];
      while (C.length < k) { let bi = 0, bd = -1; data.forEach((q, i) => { const d = Math.min(...C.map((c) => d3(q, c))); if (d > bd) { bd = d; bi = i; } }); C.push(data[bi].slice()); }
      let as = [];
      for (let it = 0; it < 15; it++) {
        as = data.map((q) => { let b = 0; C.forEach((c, j) => { if (d3(q, c) < d3(q, C[b])) b = j; }); return b; });
        C.forEach((c, j) => { const m = data.filter((_, i) => as[i] === j); if (m.length) for (let a = 0; a < 3; a++) c[a] = m.reduce((s, q) => s + q[a], 0) / m.length; });
      }
      add(K.dots(data, { r: 0.07, o: 0.85 }));
      add(K.segs(data.map((q, i) => [q, C[as[i]]]), { o: 0.14 }));
      add(K.dots(C, { r: 0.2, c: 'acc' }));
      C.forEach((c) => { add(K.line([[c[0], 0, c[2]], c], { c: 'acc', w: 1, o: 0.5, dash: true })); add(K.line(circlePts([c[0], 0.01, c[2]], 0.25), { c: 'acc', w: 1.4 })); });
      legend = [{ c: 'acc', t: 'Cluster centroids' }, { c: 'ink', t: 'Assignment to centroid' }];
      ctl = [{ key: 'k', label: 'k', min: 2, max: 6, step: 1, value: k }];
    } else if (mode === 'curse') {
      const n = 24, side = 0.5, sc = 3; // unit cube scaled to 3
      const panel = (dim, ox) => {
        const pts = []; let inside = 0;
        for (let i = 0; i < n; i++) {
          const u = [r(), dim > 1 ? r() : 0.5, dim > 2 ? r() : 0.5];
          const inn = Math.abs(u[0] - 0.5) <= side / 2 && (dim < 2 || Math.abs(u[1] - 0.5) <= side / 2) && (dim < 3 || Math.abs(u[2] - 0.5) <= side / 2);
          pts.push({ q: [ox + (u[0] - 0.5) * sc, (dim > 2 ? u[2] : dim > 1 ? u[1] : 0.5) * sc, dim > 1 ? (dim > 2 ? (u[1] - 0.5) * sc : 0) : 0], inn });
          if (inn) inside++;
        }
        if (dim === 1) add(K.line([[ox - sc / 2, sc / 2, 0], [ox + sc / 2, sc / 2, 0]], { o: 0.5, w: 1 }));
        if (dim === 2) add(K.rect(ox, sc / 2, 0, sc, sc, 'xy', { o: 0.4 }));
        if (dim === 3) add(K.box(ox, sc / 2, 0, sc, sc, sc, { o: 0.3 }));
        const hs = side * sc;
        if (dim === 1) add(K.line([[ox - hs / 2, sc / 2, 0], [ox + hs / 2, sc / 2, 0]], { c: 'acc', w: 3.2, o: 0.9 }));
        if (dim === 2) add(K.rect(ox, sc / 2, 0, hs, hs, 'xy', { c: 'acc', w: 1.8, fill: 0.15 }));
        if (dim === 3) add(K.box(ox, sc / 2, 0, hs, hs, hs, { c: 'acc', fill: 0.15 }));
        add(K.dots(pts.filter((d) => !d.inn).map((d) => d.q), { r: 0.07, o: 0.75 }));
        const ins = pts.filter((d) => d.inn).map((d) => d.q);
        if (ins.length) add(K.dots(ins, { r: 0.1, c: 'acc' }));
        add(K.label('d = ' + dim, [ox, -0.55, 0], { size: 0.36, o: 0.8 }));
        add(K.label(inside + '/' + n, [ox, sc + 0.5, 0], { size: 0.36, c: 'acc' }));
      };
      panel(1, -4.2); panel(2, 0); panel(3, 4.2);
      legend = [{ c: 'acc', t: 'Same-size neighbourhood' }, { c: 'ink', t: 'Same number of points' }];
    } else if (mode === 'outlier') {
      FL(0);
      if (p.lof) {
        const dense = blobs(r, [[-1.6, 2, -0.8]], 40, 0.38).map((d) => d.p);
        const sparse = blobs(r, [[1.8, 2.2, 1.2]], 24, 1.05).map((d) => d.p);
        const outs = [[-0.2, 2.4, -0.9], [-1.8, 3.6, 1.6]];
        const all = dense.concat(sparse).concat(outs);
        const kd = (q) => { const ds = all.map((o) => d3(q, o)).sort((a, b) => a - b); return ds[5]; };
        add(K.dots(dense.concat(sparse), { r: 0.065, o: 0.85 }));
        const show = [dense[0], dense[7], dense[15], sparse[2], sparse[9], sparse[14]];
        show.forEach((q) => add(K.line(circlePts(q, kd(q), 40, 'xy'), { w: 1, o: 0.35 })));
        outs.forEach((q) => { add(K.line(circlePts(q, kd(q), 48, 'xy'), { c: 'acc', w: 1.6 })); });
        add(K.dots(outs, { r: 0.13, c: 'acc' }));
        legend = [{ c: 'acc', t: 'Low local density' }, { c: 'ink', t: 'Neighbourhood radius' }];
      } else {
        const inl = blobs(r, [[0, 2.2, 0]], 90, 0.75).map((d) => d.p);
        const outs = [[3.2, 3.9, -1.6], [-3.1, 0.6, 2.4], [2.6, 0.4, 3], [-2.8, 4.1, -2.6], [0.4, 4.8, 3.2]];
        add(K.dots(inl, { r: 0.065, o: 0.85 }));
        add(K.box(0, 2.2, 0, 3.6, 2.9, 3.6, { o: 0.4 }));
        add(K.dots(outs, { r: 0.13, c: 'acc' }));
        outs.forEach((q) => add(K.line([[q[0], 0, q[2]], q], { c: 'acc', w: 1, o: 0.5, dash: true })));
        legend = [{ c: 'acc', t: 'Outliers' }, { c: 'ink', t: 'Inlier range' }];
      }
    } else if (mode === 'smote') {
      FL(0);
      const maj = blobs(r, [[-1.4, 2.2, -1.2]], 80, 1.0).map((d) => d.p);
      const mino = blobs(r, [[2.2, 2.0, 2.2]], 9, 0.85).map((d) => d.p);
      add(K.dots(maj, { r: 0.07, o: 0.4, hollow: true }));
      add(K.dots(mino, { r: 0.12 }));
      const pairs = [], syn = [];
      mino.forEach((q, i) => {
        const nb = mino.map((o, j) => [d3(q, o), j]).filter((x) => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 2);
        nb.forEach(([, j]) => { if (j > i || !nb.some(() => false)) pairs.push([q, mino[j]]); const u = r.range(0.2, 0.8); syn.push(q.map((v, a) => v + u * (mino[j][a] - v))); });
      });
      add(K.segs(pairs, { o: 0.35 }));
      add(K.dots(syn, { r: 0.09, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Synthetic minority samples' }, { c: 'ink', t: 'Original minority samples' }];
    } else if (mode === 'under') {
      FL(0);
      const maj = blobs(r, [[-1, 2.2, -0.6]], 100, 1.1).map((d) => d.p);
      const mino = blobs(r, [[2.2, 2.6, 1.9]], 14, 0.6).map((d) => d.p);
      const keep = maj.filter((_, i) => i % 7 === 0), drop = maj.filter((_, i) => i % 7 !== 0);
      const dropObj = add(K.dots(drop, { r: 0.07, c: 'acc', o: 0.45, hollow: true }));
      add(K.dots(keep, { r: 0.1 }));
      add(K.dots(mino, { r: 0.1, c: 'b' }));
      tick = (t) => { const u = (t % 5) / 5; const o = u < 0.4 ? 0.45 : u < 0.7 ? 0.45 * (1 - (u - 0.4) / 0.3) : 0.45 * ((u - 0.7) / 0.3); dropObj.traverse((m) => { if (m.material) m.material.opacity = Math.max(0.05, o); }); };
      legend = [{ c: 'acc', t: 'Removed majority samples' }, { c: 'b', t: 'Minority class' }, { c: 'ink', t: 'Kept majority samples' }];
    } else if (mode === 'augment') {
      FL(0);
      const orig = blobs(r, [[-1.6, 2.2, -1], [1.8, 2.6, 1.2]], 7, 0.9).map((d) => d.p);
      const aug = [], links = [];
      orig.forEach((q) => { for (let i = 0; i < 4; i++) { const a = [q[0] + 0.32 * r.n(), q[1] + 0.32 * r.n(), q[2] + 0.32 * r.n()]; aug.push(a); links.push([q, a]); } });
      add(K.segs(links, { c: 'acc', o: 0.35 }));
      add(K.dots(aug, { r: 0.075, c: 'acc' }));
      add(K.dots(orig, { r: 0.13 }));
      legend = [{ c: 'acc', t: 'Augmented copies' }, { c: 'ink', t: 'Original samples' }];
    } else if (mode === 'knn') {
      FL(0);
      const k = Math.round(p.k || 5);
      const D = blobs(r, [[-1.5, 2.2, -1.3], [1.6, 2.4, 1.3]], 20, 1.0);
      const q = [0.1, 2.35, 0.1];
      const nb = D.map((d) => [d3(d.p, q), d]).sort((a, b) => a[0] - b[0]).slice(0, k);
      add(K.dots(D.filter((d) => d.c === 0).map((d) => d.p), { r: 0.08, o: 0.8 }));
      add(K.dots(D.filter((d) => d.c === 1).map((d) => d.p), { r: 0.09, hollow: true, o: 0.8 }));
      add(K.segs(nb.map(([, d]) => [q, d.p]), { c: 'acc', w: 2 }));
      const rr = nb[nb.length - 1][0];
      add(K.line(circlePts([q[0], 0.01, q[2]], rr, 64, 'xz'), { c: 'acc', w: 1, o: 0.45 }));
      nb.forEach(([, d]) => add(K.dots([d.p], { r: 0.17, c: 'acc', hollow: true })));
      add(K.dots([q], { r: 0.17, c: 'acc' }));
      add(K.line([[q[0], 0, q[2]], q], { c: 'acc', w: 1, o: 0.5, dash: true }));
      add(K.label('?', [q[0], q[1] + 0.5, q[2]], { size: 0.45, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Query and k neighbours' }, { c: 'ink', t: 'Two classes' }];
      ctl = [{ key: 'k', label: 'k', min: 1, max: 15, step: 1, value: k }];
    } else if (mode === 'dbscan') {
      FL(0);
      const P = [];
      for (let i = 0; i < 70; i++) { const a = Math.PI * (0.05 + 0.9 * i / 70) + 0.08 * r.n(); P.push([-1 + 2.2 * Math.cos(a) + 0.15 * r.n(), 1.6 + 0.2 * r.n() + 0.4 * Math.sin(a), -0.5 + 2.2 * Math.sin(a) * 0.9 + 0.15 * r.n()]); }
      for (let i = 0; i < 40; i++) P.push([2.4 + 0.42 * r.n(), 2.6 + 0.35 * r.n(), 1.7 + 0.42 * r.n()]);
      for (let i = 0; i < 14; i++) P.push([r.range(-3.8, 3.8), r.range(0.4, 4.6), r.range(-3.8, 3.8)]);
      const eps = 0.62, mp = 5;
      const nbr = P.map((q) => P.map((o, j) => [d3(q, o), j]).filter((x) => x[0] < eps).map((x) => x[1]));
      const core = nbr.map((n) => n.length >= mp);
      const border = P.map((_, i) => !core[i] && nbr[i].some((j) => core[j]));
      add(K.dots(P.filter((_, i) => core[i]), { r: 0.085, c: 'acc' }));
      add(K.dots(P.filter((_, i) => border[i]), { r: 0.09, c: 'acc', hollow: true }));
      add(K.dots(P.filter((_, i) => !core[i] && !border[i]), { r: 0.09, hollow: true, o: 0.75 }));
      const ci = P.findIndex((_, i) => core[i]);
      add(K.line(circlePts(P[ci], eps, 40, 'xy'), { c: 'acc', w: 1, o: 0.6 }));
      add(K.label('ε', [P[ci][0], P[ci][1] + eps + 0.3, P[ci][2]], { size: 0.36, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Dense clusters' }, { c: 'ink', t: 'Noise points' }];
    } else if (mode === 'gmm') {
      FL(0);
      const comps = [
        { m: [-1.8, 2, -1.2], ax: [[1.3, 0.3, 0.5], [-0.2, 0.55, 0.15], [-0.25, 0, 0.5]] },
        { m: [1.9, 2.8, -0.6], ax: [[0.35, 0.35, 0.9], [0.6, -0.2, -0.2], [0, 0.45, -0.15]] },
        { m: [0.3, 2.2, 2.3], ax: [[0.85, -0.25, -0.45], [0.2, 0.7, 0], [0.25, 0, 0.4]] },
      ];
      const pts = [];
      comps.forEach((c, ci) => { for (let i = 0; i < 40; i++) { const a = r.n(), b = r.n(), d = r.n(); pts.push([0, 1, 2].map((k) => c.m[k] + a * c.ax[0][k] + b * c.ax[1][k] + d * c.ax[2][k])); } });
      add(K.dots(pts, { r: 0.06, o: 0.75 }));
      const ellip = (m, ax, sc, o) => {
        const M = V3(...m), A = ax.map((v) => V3(...v).multiplyScalar(sc));
        add(K.line(ellPts(M, A[0], A[1]), o)); add(K.line(ellPts(M, A[0], A[2]), o)); add(K.line(ellPts(M, A[1], A[2]), o));
      };
      if (p.iter) {
        const init = [[-0.6, 2.6, 0.4], [0.6, 2.0, -0.2], [0, 3, 0.6]];
        const its = [0, 0.5];
        const mpath = comps.map(() => []);
        its.forEach((u, k) => comps.forEach((c, ci) => {
          const m = init[ci].map((v, a) => v + (c.m[a] - v) * u);
          const ax = c.ax.map((v, a) => v.map((x, b) => x * u + (1 - u) * (a === b ? 1.4 : 0)));
          const M = V3(...m), A = ax.map((v2) => V3(...v2).multiplyScalar(1.5));
          add(K.line(ellPts(M, A[0], A[1]), { w: 1, o: 0.22 + 0.18 * k, dash: k === 0 }));
          mpath[ci].push(m);
        }));
        comps.forEach((c, ci) => { mpath[ci].push(c.m); add(K.line(mpath[ci], { w: 1.2, o: 0.6, dash: true })); add(K.dots(mpath[ci].slice(0, -1), { r: 0.07, o: 0.6 })); });
        comps.forEach((c) => ellip(c.m, c.ax, 1.5, { c: 'acc', w: 1.6 }));
        add(K.dots(comps.map((c) => c.m), { r: 0.13, c: 'acc' }));
        legend = [{ c: 'acc', t: 'Converged components' }, { c: 'ink', t: 'Earlier EM iterations' }];
      } else {
        comps.forEach((c) => { ellip(c.m, c.ax, 1.0, { c: 'acc', w: 1.8 }); ellip(c.m, c.ax, 2.0, { c: 'acc', w: 1, o: 0.4 }); });
        add(K.dots(comps.map((c) => c.m), { r: 0.13, c: 'acc' }));
        legend = [{ c: 'acc', t: 'Gaussian components' }];
      }
    }
    return { g, legend, tick, ctl };
  };

  /* ================= DENDRO ================= */
  VIZ.dendro = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const r = K.rng(5);
    const cs = [[-2.6, -2], [2.4, -1.8], [-1.6, 2.4], [2.2, 2.4]];
    const L = [];
    cs.forEach((c, i) => { for (let k = 0; k < (i === 0 ? 5 : 4); k++) L.push([c[0] + 0.7 * r.n(), c[1] + 0.7 * r.n()]); });
    // average linkage
    let cl = L.map((q, i) => ({ id: i, pts: [i], pos: q.slice(), h: 0 }));
    const nodes = cl.slice();
    const dist = (a, b) => { let s = 0; a.pts.forEach((i) => b.pts.forEach((j) => { s += Math.hypot(L[i][0] - L[j][0], L[i][1] - L[j][1]); })); return s / (a.pts.length * b.pts.length); };
    while (cl.length > 1) {
      let bi = 0, bj = 1, bd = Infinity;
      for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) { const d = dist(cl[i], cl[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
      const a = cl[bi], b = cl[bj], n = a.pts.length + b.pts.length;
      const nd = { pts: a.pts.concat(b.pts), pos: [(a.pos[0] * a.pts.length + b.pos[0] * b.pts.length) / n, (a.pos[1] * a.pts.length + b.pos[1] * b.pts.length) / n], h: bd, kids: [a, b] };
      nodes.push(nd); cl = cl.filter((_, k) => k !== bi && k !== bj); cl.push(nd);
    }
    const root = cl[0], hs = 4.6 / root.h;
    const hcut = p.h == null ? 0.45 : p.h; // fraction of root height
    const yc = hcut * root.h * hs;
    floor(g, [-4.5, 4.5], [-4.5, 4.5], 0, 0, { x: 'x₁', z: 'x₂' });
    const lo = [], hi = [], cross = [];
    nodes.forEach((nd) => {
      if (!nd.kids) return;
      const y = nd.h * hs;
      nd.kids.forEach((k) => {
        const ky = k.h * hs;
        const a = [k.pos[0], ky, k.pos[1]], b = [k.pos[0], y, k.pos[1]], c = [nd.pos[0], y, nd.pos[1]];
        if (y <= yc) { lo.push([a, b]); lo.push([b, c]); }
        else if (ky >= yc) { hi.push([a, b]); hi.push([b, c]); }
        else { lo.push([a, [k.pos[0], yc, k.pos[1]]]); hi.push([[k.pos[0], yc, k.pos[1]], b]); hi.push([b, c]); cross.push([k.pos[0], yc, k.pos[1]]); }
      });
    });
    add(K.segs(lo, { w: 1.6 }));
    add(K.segs(hi, { w: 1, o: 0.3 }));
    add(K.dots(L.map(([x, z]) => [x, 0.02, z]), { r: 0.09 }));
    add(K.rect(0, yc, 0, 9, 9, 'xz', { c: 'acc', fill: 0.1, w: 1.4, o: 0.8 }));
    add(K.dots(cross, { r: 0.13, c: 'acc' }));
    add(K.label(String(cross.length), [4.9, yc + 0.35, -4.5], { size: 0.45, c: 'acc' }));
    add(K.line([[-4.5, 0, -4.5], [-4.5, 5, -4.5]], { o: 0.45, w: 1 }));
    add(K.label('h', [-4.5, 5.4, -4.5], { size: 0.36, o: 0.75 }));
    return {
      g, legend: [{ c: 'acc', t: 'Cut height' }, { c: 'ink', t: 'Merge tree' }],
      ctl: [{ key: 'h', label: 'h', min: 0.08, max: 0.95, step: 0.01, value: hcut }],
    };
  };

  /* ================= PCA ================= */
  VIZ.pca = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const r = K.rng(31);
    const e1 = V3(0.8, 0.38, -0.6).normalize(), e2 = new T.Vector3().crossVectors(e1, V3(0.3, 0.2, 1)).normalize(), e3 = new T.Vector3().crossVectors(e1, e2);
    const pts = [];
    for (let i = 0; i < 200; i++) { const a = 1.7 * r.n(), b = 0.7 * r.n(), c = 0.25 * r.n(); pts.push([a * e1.x + b * e2.x + c * e3.x, 2.6 + a * e1.y + b * e2.y + c * e3.y, a * e1.z + b * e2.z + c * e3.z]); }
    const mu = [0, 1, 2].map((a) => pts.reduce((s, q) => s + q[a], 0) / pts.length);
    const C = [0, 1, 2].map((a) => [0, 1, 2].map((b) => pts.reduce((s, q) => s + (q[a] - mu[a]) * (q[b] - mu[b]), 0) / pts.length));
    const { vals, vecs } = eig3(C);
    const M = V3(...mu), E = vecs.map((v) => V3(...v)), sd = vals.map((v) => Math.sqrt(v));
    floor(g, [-4.5, 4.5], [-4.5, 4.5], 0, 0, {});
    let legend;
    if (p.proj) {
      const pr = pts.map((q) => { const d = V3(...q).sub(M); return M.clone().addScaledVector(E[0], d.dot(E[0])).addScaledVector(E[1], d.dot(E[1])); });
      add(quad(M, E[0], E[1], sd[0] * 2.6, sd[1] * 2.8, { c: 'acc', fill: 0.1, o: 0.6, w: 1.2 }));
      add(K.dots(pts, { r: 0.05, o: 0.45 }));
      add(K.segs(pts.filter((_, i) => i % 3 === 0).map((q, i) => [q, pr[i * 3]]), { o: 0.18 }));
      add(K.dots(pr, { r: 0.055, c: 'acc' }));
      [0, 1].forEach((k) => add(K.arrow(M, M.clone().addScaledVector(E[k], sd[k] * 2.2), { w: 1.6, head: 0.26 })));
      add(K.arrow(M, M.clone().addScaledVector(E[2], sd[2] * 2.4 + 0.3), { w: 1.2, o: 0.5, head: 0.2 }));
      add(K.label('PC1', M.clone().addScaledVector(E[0], sd[0] * 2.2 + 0.55), { size: 0.34 }));
      add(K.label('PC2', M.clone().addScaledVector(E[1], sd[1] * 2.2 + 0.5), { size: 0.34 }));
      legend = [{ c: 'acc', t: 'Projection onto PC1–PC2' }, { c: 'ink', t: 'Original 3D points' }];
    } else {
      add(K.dots(pts, { r: 0.045, o: 0.6 }));
      [0, 1, 2].forEach((k) => {
        const L = sd[k] * 2.1 + (k === 2 ? 0.25 : 0);
        const o = k === 0 ? { c: 'acc', w: 2.6, head: 0.32 } : { w: 1.6, head: 0.24, o: k === 2 ? 0.7 : 1 };
        add(K.arrow(M, M.clone().addScaledVector(E[k], L), o));
        add(K.line([M, M.clone().addScaledVector(E[k], -L)], { c: o.c, w: k === 0 ? 1.4 : 1, o: 0.5, dash: true }));
        if (k < 2) add(K.label('PC' + (k + 1), M.clone().addScaledVector(E[k], L + 0.5), { size: 0.34, c: k === 0 ? 'acc' : 'ink' }));
      });
      add(K.dots([M], { r: 0.1 }));
      legend = [{ c: 'acc', t: 'First principal component' }, { c: 'ink', t: 'Lower-variance axes' }];
    }
    return { g, legend };
  };

  /* ================= PLANE (classifiers) ================= */
  VIZ.plane = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const mode = p.mode || 'linear', r = K.rng(41);
    const n = V3(0.55, 1, -0.3).normalize(), [u, v] = basis(n), Bx = 3;
    let legend = [], tick = null;
    const gen = (cnt, margin, sd) => {
      const P = []; let guard = 0;
      while (P.length < cnt && guard++ < 5000) {
        const q = V3(r.range(-Bx, Bx), r.range(-Bx, Bx), r.range(-Bx, Bx)); const s = q.dot(n);
        if (Math.abs(s) < margin || Math.abs(s) > margin + sd) continue;
        P.push({ q, y: s > 0 ? 1 : 0 });
      }
      return P;
    };
    const draw = (P, o = {}) => {
      const a = P.filter((d) => d.y === 1).map((d) => d.q), b = P.filter((d) => d.y === 0).map((d) => d.q);
      if (a.length) add(K.dots(a, { r: o.r || 0.09, o: o.o }));
      if (b.length) add(K.dots(b, { r: (o.r || 0.09) * 1.1, c: 'b', hollow: true, o: o.o }));
    };
    const cube = () => add(K.box(0, 0, 0, 2 * Bx, 2 * Bx, 2 * Bx, { o: 0.12 }));
    const clsLeg = { c: 'b', t: 'Class 0' };

    if (mode === 'linear') {
      cube(); draw(gen(70, 0.35, 2.2));
      add(quad(V3(0, 0, 0), u, v, 3.3, 3.3, { c: 'acc', fill: 0.16, w: 2 }));
      add(K.arrow([0, 0, 0], n.clone().multiplyScalar(1.4), { c: 'acc', w: 1.8, head: 0.25 }));
      add(K.label('w', n.clone().multiplyScalar(1.85), { size: 0.36, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Decision boundary' }, clsLeg, { c: 'ink', t: 'Class 1' }];
    } else if (mode === 'logistic') {
      const w = [0.9, 0.5], S = 3.6, Hh = 3.6;
      const sig = (x, z) => 1 / (1 + Math.exp(-(w[0] * x + w[1] * z)));
      floor(g, [-S, S], [-S, S], 0, Hh, { x: 'x₁', z: 'x₂', y: 'p' });
      const D = [];
      for (let i = 0; i < 60; i++) { const x = r.range(-S, S), z = r.range(-S, S); const y = r() < sig(x * 1.6, z * 1.6) ? 1 : 0; D.push({ q: [x, y * Hh, z], y }); }
      add(K.surface((x, z) => Hh * sig(x, z), { xr: [-S, S], zr: [-S, S], n: 26, c: 'acc', o: 0.4 }));
      const half = []; for (let i = 0; i <= 20; i++) { const x = -S + 2 * S * i / 20, z = -w[0] * x / w[1]; if (Math.abs(z) <= S) half.push([x, Hh / 2 + 0.02, z]); }
      add(K.line(half, { c: 'acc', w: 2.6 }));
      add(K.line(half.map(([x, , z]) => [x, 0.01, z]), { c: 'acc', w: 1.2, o: 0.6, dash: true }));
      draw(D.map((d) => ({ q: V3(...d.q), y: d.y })), { r: 0.085 });
      add(K.line([[-S, Hh, -S], [S, Hh, -S]], { o: 0.25, w: 1, dash: true }));
      add(K.label('1', [-S - 0.4, Hh, -S], { size: 0.32, o: 0.7 }));
      add(K.label('0.5', [-S - 0.5, Hh / 2, -S], { size: 0.32, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Sigmoid probability' }, clsLeg, { c: 'ink', t: 'Class 1' }];
    } else if (mode === 'svm') {
      const m = 0.85; cube();
      const D = gen(46, m + 0.2, 1.8);
      const sv = [[0.6, 1.4, 1, 1], [-1.6, -0.4, 0.8, 1], [1.4, -0.6, -1.8, 0], [-0.8, 0.9, -1.4, 0]].map(([a, b, c, y]) => ({ q: u.clone().multiplyScalar(a * 1.3).addScaledVector(v, b * 1.3).addScaledVector(n, y ? m : -m).add(V3(0, 0, 0)), y }));
      sv.forEach((d) => { d.q = u.clone().multiplyScalar(d.q.dot(u)).addScaledVector(v, d.q.dot(v)).addScaledVector(n, d.y ? m : -m); });
      draw(D.concat(sv));
      add(quad(V3(0, 0, 0), u, v, 3.3, 3.3, { c: 'acc', fill: 0.16, w: 2 }));
      add(quad(n.clone().multiplyScalar(m), u, v, 3.3, 3.3, { w: 1.2, o: 0.55, dash: true }));
      add(quad(n.clone().multiplyScalar(-m), u, v, 3.3, 3.3, { w: 1.2, o: 0.55, dash: true }));
      sv.forEach((d) => add(K.dots([d.q], { r: 0.22, c: 'acc', hollow: true })));
      const c0 = u.clone().multiplyScalar(3.3).addScaledVector(v, 3.3);
      add(K.arrow(c0.clone().addScaledVector(n, -m), c0.clone().addScaledVector(n, m), { c: 'acc', w: 1.6, head: 0.2 }));
      add(K.arrow(c0.clone().addScaledVector(n, m), c0.clone().addScaledVector(n, -m), { c: 'acc', w: 1.6, head: 0.2 }));
      add(K.label('2/‖w‖', c0.clone().addScaledVector(u, 0.9).addScaledVector(v, 0.3), { size: 0.34, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Margin and support vectors' }, clsLeg, { c: 'ink', t: 'Class 1' }];
    } else if (mode === 'lda') {
      const S = 4.2; floor(g, [-S, S], [-S, S], 0, 0, { x: 'x₁', z: 'x₂' });
      const cov = [[1.5, 0.3], [-0.3, 0.45]]; // shared axes
      const mk = (m, cnt) => { const P = []; for (let i = 0; i < cnt; i++) { const a = r.n(), b = r.n(); P.push([m[0] + a * cov[0][0] + b * cov[1][0], m[1] + a * cov[0][1] + b * cov[1][1]]); } return P; };
      const A = mk([-0.6, -1.0], 40), B = mk([0.6, 1.0], 40);
      // LDA direction: Sw^-1 (mB - mA)
      const mean = (P) => [P.reduce((s, q) => s + q[0], 0) / P.length, P.reduce((s, q) => s + q[1], 0) / P.length];
      const mA = mean(A), mB = mean(B); let s00 = 0, s01 = 0, s11 = 0;
      [[A, mA], [B, mB]].forEach(([P, m]) => P.forEach((q) => { const dx = q[0] - m[0], dz = q[1] - m[1]; s00 += dx * dx; s01 += dx * dz; s11 += dz * dz; }));
      const det = s00 * s11 - s01 * s01, dm = [mB[0] - mA[0], mB[1] - mA[1]];
      let w = [(s11 * dm[0] - s01 * dm[1]) / det, (-s01 * dm[0] + s00 * dm[1]) / det]; const wl = Math.hypot(...w); w = [w[0] / wl, w[1] / wl];
      const c0 = [(mA[0] + mB[0]) / 2, (mA[1] + mB[1]) / 2], ext = 4.2;
      const ax = (t) => [c0[0] + w[0] * t, 0.02, c0[1] + w[1] * t];
      add(K.line([ax(-ext), ax(ext)], { c: 'acc', w: 2.4 }));
      add(K.dots(A.map(([x, z]) => [x, 0.06, z]), { r: 0.08, c: 'b', hollow: true }));
      add(K.dots(B.map(([x, z]) => [x, 0.06, z]), { r: 0.075 }));
      const proj = (q) => (q[0] - c0[0]) * w[0] + (q[1] - c0[1]) * w[1];
      const pA = A.map(proj), pB = B.map(proj);
      add(K.segs(A.concat(B).filter((_, i) => i % 3 === 0).map((q) => [[q[0], 0.03, q[1]], ax(proj(q))]), { o: 0.15 }));
      add(K.dots(pA.map((t) => ax(t)), { r: 0.06, c: 'b' }));
      add(K.dots(pB.map((t) => ax(t)), { r: 0.06 }));
      // 1D densities standing on the axis
      const dens = (vals, col) => {
        const m = vals.reduce((s, x) => s + x, 0) / vals.length, sd = Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length);
        const c = []; for (let i = 0; i <= 80; i++) { const t = -ext + 2 * ext * i / 80; const y = 2.6 * Math.exp(-0.5 * ((t - m) / sd) ** 2); const q = ax(t); c.push([q[0], y + 0.02, q[2]]); }
        add(K.line(c, { c: col, w: 2 }));
      };
      dens(pA, 'b'); dens(pB, 'ink');
      legend = [{ c: 'acc', t: 'Projection axis' }, clsLeg, { c: 'ink', t: 'Class 1' }];
    } else if (mode === 'perceptron') {
      cube();
      const D = gen(50, 0.4, 2.2);
      const xm = u.clone().multiplyScalar(1.6).addScaledVector(v, -1.2).addScaledVector(n, 0.55);
      const cdot = n.dot(xm), k = 2 * cdot / xm.lengthSq();
      const wOld = n.clone().addScaledVector(xm, -k), wNew = n.clone();
      const [uo, vo] = basis(wOld.clone().normalize());
      draw(D, { o: 0.75 });
      add(quad(V3(0, 0, 0), uo, vo, 3.3, 3.3, { w: 1.2, o: 0.45, dash: true }));
      add(quad(V3(0, 0, 0), u, v, 3.3, 3.3, { c: 'acc', fill: 0.14, w: 2 }));
      add(K.dots([xm], { r: 0.13 }));
      add(K.dots([xm], { r: 0.26, c: 'acc', hollow: true }));
      const sc = 1.8;
      add(K.arrow([0, 0, 0], wOld.clone().multiplyScalar(sc), { w: 1.4, o: 0.6, head: 0.24 }));
      add(K.arrow(wOld.clone().multiplyScalar(sc), wNew.clone().multiplyScalar(sc), { c: 'acc', w: 1.4, dash: true, head: 0.22 }));
      add(K.arrow([0, 0, 0], wNew.clone().multiplyScalar(sc), { c: 'acc', w: 2.2, head: 0.28 }));
      add(K.label('w', wOld.clone().multiplyScalar(sc + 0.35), { size: 0.34, o: 0.7 }));
      add(K.label('w + ηyx', wNew.clone().multiplyScalar(sc + 0.45).add(V3(0.4, 0.1, 0)), { size: 0.34, c: 'acc' }));
      add(K.label('x', xm.clone().add(V3(0.35, 0.4, 0)), { size: 0.34, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Updated boundary' }, { c: 'ink', t: 'Previous boundary' }, clsLeg];
    } else if (mode === 'cf') {
      cube();
      draw(gen(50, 0.35, 2.2), { o: 0.35, r: 0.07 });
      add(quad(V3(0, 0, 0), u, v, 3.3, 3.3, { fill: 0.06, w: 1.4, o: 0.6 }));
      const x = u.clone().multiplyScalar(-0.6).addScaledVector(v, 0.5).addScaledVector(n, -1.6);
      const xc = x.clone().addScaledVector(n, 1.6 + 0.18);
      add(K.dots([x], { r: 0.17, c: 'b', hollow: true }));
      add(K.dots([x], { r: 0.06, c: 'b' }));
      add(K.arrow(x, xc, { c: 'acc', w: 2.4, head: 0.28 }));
      add(K.dots([xc], { r: 0.15, c: 'acc' }));
      // other, longer valid moves
      [[1.6, 1.2], [-1.8, -0.6]].forEach(([a, b]) => { const y = x.clone().addScaledVector(u, a).addScaledVector(v, b).addScaledVector(n, 1.8); add(K.line([x, y], { w: 1, o: 0.35, dash: true })); add(K.dots([y], { r: 0.07, o: 0.4 })); });
      add(K.label('x', x.clone().add(V3(-0.3, -0.45, 0)), { size: 0.36, c: 'b' }));
      add(K.label("x′", xc.clone().add(V3(0.35, 0.4, 0)), { size: 0.36, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Minimal change' }, clsLeg, { c: 'ink', t: 'Decision boundary' }];
    }
    return { g, legend, tick };
  };

  /* ================= KERNEL ================= */
  VIZ.kernel = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const r = K.rng(17), S = 3.6, k2 = 0.42, yc = 1.55;
    const inner = [], outer = [];
    for (let i = 0; i < 40; i++) { const a = r() * 6.283, rr = 1.25 * Math.sqrt(r()); inner.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    for (let i = 0; i < 50; i++) { const a = r() * 6.283, rr = r.range(2.3, 3.1); outer.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    const lz = ([x, z]) => [x, k2 * (x * x + z * z) + 0.06, z];
    floor(g, [-S, S], [-S, S], 0, 0, { x: 'x₁', z: 'x₂' });
    const rc = Math.sqrt(yc / k2);
    if (p.lift) {
      // paraboloid phi(x) drawn with rings and spokes
      const pairs = [];
      for (let k = 1; k <= 7; k++) { const rr = 3.3 * k / 7, P = circlePts([0, k2 * rr * rr, 0], rr, 56); for (let i = 0; i < P.length - 1; i++) pairs.push([P[i], P[i + 1]]); }
      for (let s = 0; s < 16; s++) { const a = 2 * Math.PI * s / 16; for (let i = 0; i < 12; i++) { const r0 = 3.3 * i / 12, r1 = 3.3 * (i + 1) / 12; pairs.push([[r0 * Math.cos(a), k2 * r0 * r0, r0 * Math.sin(a)], [r1 * Math.cos(a), k2 * r1 * r1, r1 * Math.sin(a)]]); } }
      add(K.segs(pairs, { o: 0.18 }));
      add(K.dots(inner.map(([x, z]) => [x, 0.03, z]), { r: 0.05, o: 0.35 }));
      add(K.dots(outer.map(([x, z]) => [x, 0.03, z]), { r: 0.055, c: 'b', o: 0.35 }));
      add(K.dots(inner.map(lz), { r: 0.08 }));
      add(K.dots(outer.map(lz), { r: 0.085, c: 'b', hollow: true }));
      add(K.segs(inner.concat(outer).filter((_, i) => i % 4 === 0).map((q) => [[q[0], 0.03, q[1]], lz(q)]), { o: 0.15 }));
      add(K.rect(0, yc, 0, 7.2, 7.2, 'xz', { c: 'acc', fill: 0.13, w: 1.6 }));
      add(K.line(circlePts([0, yc, 0], rc, 72), { c: 'acc', w: 2.4 }));
      add(K.line(circlePts([0, 0.01, 0], rc, 72), { c: 'acc', w: 1.6, dash: true }));
      add(K.label('φ(x) = (x₁, x₂, x₁²+x₂²)', [0, 5.6, -3.4], { size: 0.34 }));
      legend = [{ c: 'acc', t: 'Linear separator in feature space' }, { c: 'b', t: 'Outer class' }, { c: 'ink', t: 'Inner class' }];
      legend[0].t = 'Separating hyperplane';
    } else {
      add(K.dots(inner.map(([x, z]) => [x, 0.03, z]), { r: 0.07 }));
      add(K.dots(outer.map(([x, z]) => [x, 0.03, z]), { r: 0.075, c: 'b', hollow: true }));
      add(K.dots(inner.map(lz), { r: 0.08, o: 0.9 }));
      add(K.dots(outer.map(lz), { r: 0.085, c: 'b', hollow: true }));
      add(K.segs(inner.concat(outer).map((q) => [[q[0], 0.04, q[1]], lz(q)]), { o: 0.1 }));
      add(K.arrow([-S, 0, -S], [-S, 5.0, -S], { w: 1.6, head: 0.25 }));
      add(K.label('x₃ = x₁²+x₂²', [-S + 0.2, 5.5, -S], { size: 0.38 }));
      add(K.rect(0, yc, 0, 7.2, 7.2, 'xz', { c: 'acc', fill: 0.14, w: 2 }));
      add(K.label('x₃ = c', [S + 0.9, yc, S], { size: 0.34, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Separating plane' }, { c: 'b', t: 'Outer class' }, { c: 'ink', t: 'Inner class' }];
    }
    return { g, legend };
  };

  /* ================= REGRESS ================= */
  VIZ.regress = function (p, Kk) {
    use(Kk);
    const g = new T.Group(), add = (o) => { g.add(o); return o; };
    const mode = p.mode || 'linear', r = K.rng(mode === 'overfit' ? 9 : 13), S = 3.4, R = [-S, S];
    const curved = mode === 'poly' || mode === 'overfit' || mode === 'underfit';
    const truth = curved ? (x, z) => 0.5 + 0.2 * x * x + 0.1 * z * z * 0.6 + 0.12 * x : (mode === 'tls' ? (x, z) => 2.2 - 0.62 * x - 0.3 * z : (x, z) => 2.0 - 0.36 * x - 0.26 * z);
    const npts = mode === 'overfit' ? 16 : mode === 'resid2' ? 14 : mode === 'r2' ? 16 : 24;
    const noise = mode === 'overfit' ? 0.35 : mode === 'resid2' || mode === 'tls' ? 0.75 : mode === 'resid' ? 0.6 : 0.42;
    const D = [];
    for (let i = 0; i < npts; i++) { const x = r.range(-S + 0.3, S - 0.3), z = r.range(-S + 0.3, S - 0.3); D.push([x, Math.max(0.1, truth(x, z) + noise * r.n()), z]); }
    if (mode === 'tls') for (let i = 0; i < D.length; i++) { D[i][0] += 0.5 * r.n(); D[i][2] += 0.3 * r.n(); }
    floor(g, R, R, 0, 4, { x: 'x₁', z: 'x₂', y: 'y' });
    // least-squares fits
    const fitLin = () => {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
      D.forEach(([x, y, z]) => { const f = [1, x, z]; for (let i = 0; i < 3; i++) { b[i] += f[i] * y; for (let j = 0; j < 3; j++) A[i][j] += f[i] * f[j]; } });
      const w = solve(A, b); return (x, z) => w[0] + w[1] * x + w[2] * z;
    };
    const fitQuad = () => {
      const F = (x, z) => [1, x, z, x * x, z * z, x * z], n = 6;
      const A = Array.from({ length: n }, () => Array(n).fill(0)), b = Array(n).fill(0);
      D.forEach(([x, y, z]) => { const f = F(x, z); for (let i = 0; i < n; i++) { b[i] += f[i] * y; for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j]; } });
      for (let i = 0; i < n; i++) A[i][i] += 1e-6;
      const w = solve(A, b); return (x, z) => F(x, z).reduce((s, v, i) => s + v * w[i], 0);
    };
    const planeMesh = (f, o) => { // plane drawn as wire grid
      return K.surface(f, { xr: R, zr: R, n: o.n || 8, c: o.c, o: o.o });
    };
    const ptsDraw = (o = {}) => add(K.dots(D, { r: o.r || 0.1, o: o.o }));
    let legend;
    if (mode === 'linear' || mode === 'resid' || mode === 'resid2') {
      const f = fitLin();
      if (mode === 'linear') {
        add(planeMesh(f, { c: 'acc', o: 0.55 }));
        add(K.line([[-S, f(-S, -S), -S], [S, f(S, -S), -S], [S, f(S, S), S], [-S, f(-S, S), S], [-S, f(-S, -S), -S]], { c: 'acc', w: 2 }));
        add(K.segs(D.map(([x, y, z]) => [[x, y, z], [x, f(x, z), z]]), { w: 1.2, o: 0.5 }));
        ptsDraw();
        legend = [{ c: 'acc', t: 'Fitted plane' }, { c: 'ink', t: 'Residuals' }];
      } else if (mode === 'resid') {
        add(planeMesh(f, { o: 0.3 }));
        add(K.segs(D.map(([x, y, z]) => [[x, y, z], [x, f(x, z), z]]), { c: 'acc', w: 2.6 }));
        ptsDraw();
        legend = [{ c: 'acc', t: 'Absolute residuals |y − ŷ|' }, { c: 'ink', t: 'Fitted plane' }];
        legend[0].t = 'Absolute residuals';
      } else {
        add(planeMesh(f, { o: 0.3 }));
        D.forEach(([x, y, z]) => {
          const yh = f(x, z), e = Math.abs(y - yh), sgn = (x > 0 ? -1 : 1);
          add(K.rect(x + sgn * e / 2, (y + yh) / 2, z, e, e, 'xy', { c: 'acc', fill: 0.22, w: 1.2 }));
        });
        ptsDraw();
        legend = [{ c: 'acc', t: 'Squared residuals' }, { c: 'ink', t: 'Fitted plane' }];
      }
    } else if (mode === 'tls') {
      const mu = [0, 1, 2].map((a) => D.reduce((s, q) => s + q[a], 0) / D.length);
      const C = [0, 1, 2].map((a) => [0, 1, 2].map((b) => D.reduce((s, q) => s + (q[a] - mu[a]) * (q[b] - mu[b]), 0)));
      const nn = V3(...eig3(C).vecs[2]).normalize();
      const M = V3(...mu);
      const fT = (x, z) => mu[1] - (nn.x * (x - mu[0]) + nn.z * (z - mu[2])) / nn.y;
      add(planeMesh(fT, { o: 0.35 }));
      D.forEach((q) => {
        const Q = V3(...q), d = Q.clone().sub(M).dot(nn), F = Q.clone().addScaledVector(nn, -d);
        add(K.line([Q, F], { c: 'acc', w: 2.2 }));
        add(K.line([q, [q[0], fT(q[0], q[2]), q[2]]], { w: 1, o: 0.4, dash: true }));
      });
      ptsDraw();
      legend = [{ c: 'acc', t: 'Orthogonal residuals' }, { c: 'ink', t: 'Vertical residuals' }];
    } else if (mode === 'poly') {
      const f = fitQuad();
      add(K.surface(f, { xr: R, zr: R, n: 18, c: 'acc', o: 0.5 }));
      add(K.segs(D.map(([x, y, z]) => [[x, y, z], [x, f(x, z), z]]), { w: 1.2, o: 0.5 }));
      ptsDraw();
      legend = [{ c: 'acc', t: 'Polynomial surface' }, { c: 'ink', t: 'Residuals' }];
    } else if (mode === 'overfit') {
      const sg = 0.75, phi = (a, b) => Math.exp(-((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2) / (2 * sg * sg));
      const A = D.map((a) => D.map((b) => phi(a, b) + (a === b ? 1e-6 : 0)));
      const m0 = D.reduce((s, q) => s + q[1], 0) / D.length;
      const w = solve(A, D.map((q) => q[1] - m0));
      const f = (x, z) => m0 + D.reduce((s, q, i) => s + w[i] * phi([x, 0, z], q), 0);
      const fc = (x, z) => Math.max(-0.6, Math.min(4.6, f(x, z)));
      add(K.surface(fc, { xr: R, zr: R, n: 40, c: 'acc', o: 0.5 }));
      add(K.surface(truth, { xr: R, zr: R, n: 10, o: 0.18 }));
      ptsDraw({ r: 0.12 });
      legend = [{ c: 'acc', t: 'Overfit surface' }, { c: 'ink', t: 'True function' }];
    } else if (mode === 'underfit') {
      const m0 = D.reduce((s, q) => s + q[1], 0) / D.length;
      const f = fitLin();
      add(planeMesh(f, { c: 'acc', o: 0.55 }));
      add(K.line([[-S, f(-S, -S), -S], [S, f(S, -S), -S], [S, f(S, S), S], [-S, f(-S, S), S], [-S, f(-S, -S), -S]], { c: 'acc', w: 2 }));
      add(K.segs(D.map(([x, y, z]) => [[x, y, z], [x, f(x, z), z]]), { w: 1.2, o: 0.45 }));
      add(K.surface(truth, { xr: R, zr: R, n: 12, o: 0.15 }));
      ptsDraw();
      void m0;
      legend = [{ c: 'acc', t: 'Too-simple model' }, { c: 'ink', t: 'Large residuals' }];
    } else if (mode === 'r2') {
      const f = fitLin(), m0 = D.reduce((s, q) => s + q[1], 0) / D.length, dz = 0.07;
      add(K.rect(0, m0, 0, 2 * S, 2 * S, 'xz', { w: 1.2, o: 0.5, fill: 0.04 }));
      add(planeMesh(f, { o: 0.28 }));
      add(K.segs(D.map(([x, y, z]) => [[x - dz, m0, z], [x - dz, y, z]]), { c: 'b', w: 2 }));
      add(K.segs(D.map(([x, , z]) => [[x + dz, m0, z], [x + dz, f(x, z), z]]), { c: 'acc', w: 2.6 }));
      ptsDraw({ r: 0.09 });
      add(K.label('ȳ', [S + 0.5, m0, -S], { size: 0.38 }));
      add(K.label('ŷ', [-S - 0.5, f(-S, -S), -S], { size: 0.38 }));
      legend = [{ c: 'b', t: 'Total variation' }, { c: 'acc', t: 'Explained variation' }];
    }
    return { g, legend };
  };
})();
