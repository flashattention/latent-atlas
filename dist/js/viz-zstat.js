/* Latent Atlas — appendix figures for the 'zstat' chapter. One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------------- helpers ---------------- */
  const SQ2PI = Math.sqrt(2 * Math.PI);
  const npdf = (x, m = 0, s = 1) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * SQ2PI);
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const ncdf = (x, m = 0, s = 1) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
  const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  const meanOf = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sdOf = (a) => { const m = meanOf(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

  /* curve y = f(x) on the vertical plane at depth z */
  function fcurve(f, a, b, z, o = {}) { return K.line(lin(a, b, o.n || 90).map((x) => [x, f(x), z]), o); }
  /* filled region between y0 and f(x) for x in [a,b] on the plane at depth z (robust triangle strip) */
  function ffill(f, a, b, z, o = {}) {
    const n = o.n || 60, y0 = o.y0 || 0, pos = [];
    const xs = lin(a, b, n);
    for (let i = 0; i < n; i++) {
      const x0 = xs[i], x1 = xs[i + 1], f0 = f(x0), f1 = f(x1);
      pos.push(x0, y0, z, x1, y0, z, x1, f1, z, x0, y0, z, x1, f1, z, x0, f0, z);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    return new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.c || 'acc'), transparent: true, opacity: o.fill == null ? 0.25 : o.fill, side: T.DoubleSide, depthWrite: false }));
  }
  /* filled convex/simple polygon on the floor (pts [[x,z]]) at height y */
  function floorPoly(pts, y, o = {}) {
    const sh = new T.Shape(pts.map(([x, z]) => new T.Vector2(x, -z)));
    const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: K.colorOf(o.c || 'acc'), transparent: true, opacity: o.fill == null ? 0.25 : o.fill, side: T.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y;
    return m;
  }
  function circ(cx, cy, cz, r, plane = 'xz', n = 64) {
    return lin(0, 2 * Math.PI, n).map((a) => plane === 'xz' ? [cx + r * Math.cos(a), cy, cz + r * Math.sin(a)] : [cx + r * Math.cos(a), cy + r * Math.sin(a), cz]);
  }
  /* bar: edged box standing on y0 */
  function bar(x, h, w, z, d, hl, y0 = 0) {
    if (hl === 'b') return K.box(x, y0 + h / 2, z, w, h, d, { fill: 0.45, fc: 'b', c: 'b', o: 0.9 });
    return hl ? K.box(x, y0 + h / 2, z, w, h, d, { fill: 0.6, fc: 'acc', c: 'acc', o: 0.95 })
      : K.box(x, y0 + h / 2, z, w, h, d, { fill: 0.08, o: 0.5 });
  }
  /* x axis at depth z with optional y axis */
  function axes(g, a, b, z, h, o = {}) {
    g.add(K.line([[a, 0, z], [b, 0, z]], { o: o.o || 0.5, w: 1 }));
    if (h) g.add(K.line([[a, 0, z], [a, h, z]], { o: o.o || 0.5, w: 1 }));
  }
  function vline(x, y0, y1, z, o = {}) { return K.line([[x, y0, z], [x, y1, z]], Object.assign({ w: 1.2, dash: true }, o)); }
  function darrow(a, b, o = {}) { const g = new T.Group(); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; g.add(K.arrow(m, a, o)); g.add(K.arrow(m, b, o)); return g; }
  function fulcrum(x, y, z, c = 'acc') {
    const m = new T.Mesh(new T.ConeGeometry(0.42, 0.75, 4), new T.MeshBasicMaterial({ color: K.colorOf(c), transparent: true, opacity: 0.85 }));
    m.position.set(x, y - 0.375, z); m.rotation.y = Math.PI / 4; return m;
  }
  function hist(vals, a, b, nb) {
    const c = new Array(nb).fill(0);
    vals.forEach((v) => { const i = Math.floor((v - a) / (b - a) * nb); if (i >= 0 && i < nb) c[i]++; });
    return c;
  }
  function samp(r, n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f(r)); return a; }
  function arcArrow(a, b, h, o = {}) {
    a = K.V(...a); b = K.V(...b);
    const m = a.clone().add(b).multiplyScalar(0.5); m.y += h;
    const cv = new T.QuadraticBezierCurve3(a, m, b);
    const pts = cv.getPoints(40);
    const g = new T.Group();
    g.add(K.line(pts.slice(0, 38), o));
    g.add(K.arrow(pts[34], pts[40], Object.assign({}, o, { head: 0.26 })));
    g.userData.pts = pts;
    return g;
  }

  /* ---------------- figures ---------------- */
  const F = {};

  F.mean = (g) => {
    const vals = [1, 2, 2, 3, 3, 3, 4, 4, 5, 8];
    const m = meanOf(vals), X = (v) => (v - m) * 0.95;
    g.add(K.box(X(m) + 0.4, 0.04, 0, 8.6, 0.08, 1.1, { fill: 0.1, o: 0.6 }));
    const cnt = {}, P = [];
    vals.forEach((v) => { cnt[v] = (cnt[v] || 0) + 1; P.push([X(v), 0.08 + 0.18 + (cnt[v] - 1) * 0.38, 0]); });
    g.add(K.dots(P, { r: 0.17 }));
    g.add(fulcrum(X(m), 0, 0));
    g.add(vline(X(m), 0.1, 2.3, 0, { c: 'acc', w: 1.6 }));
    g.add(K.label('x̄', [X(m), 2.65, 0], { c: 'acc', size: 0.5 }));
    g.add(K.label('Σ (xᵢ − x̄) = 0', [X(m), -1.1, 0], { size: 0.36, o: 0.75 }));
    return [{ c: 'acc', t: 'Mean (balance point)' }];
  };

  F.median = (g) => {
    const vals = [0.9, 1.3, 1.6, 2.0, 2.3, 2.7, 3.0, 3.4, 8.2];
    const n = vals.length, mid = 4, sy = 0.6;
    const X = (i) => -4 + i * 1.0;
    vals.forEach((v, i) => g.add(bar(X(i), v * sy, 0.6, 0, 0.8, i === mid)));
    axes(g, -4.6, 4.6, 0, 0);
    const med = vals[mid] * sy, mu = meanOf(vals) * sy;
    g.add(K.line([[-4.7, med, 0], [4.7, med, 0]], { c: 'acc', w: 1.4 }));
    g.add(K.line([[-4.7, mu, 0], [4.7, mu, 0]], { o: 0.45, w: 1.2, dash: true }));
    g.add(K.label('x̃', [-5.1, med, 0], { c: 'acc', size: 0.45 }));
    g.add(K.label('x̄', [5.1, mu, 0], { size: 0.42, o: 0.7 }));
    // equal counts on each side
    g.add(darrow([X(0) - 0.3, -0.45, 0], [X(mid - 1) + 0.3, -0.45, 0], { w: 1, o: 0.5, head: 0.18 }));
    g.add(darrow([X(mid + 1) - 0.3, -0.45, 0], [X(n - 1) + 0.3, -0.45, 0], { w: 1, o: 0.5, head: 0.18 }));
    g.add(K.label('4', [X(1.5), -0.85, 0], { size: 0.34, o: 0.7 }));
    g.add(K.label('4', [X(6.5), -0.85, 0], { size: 0.34, o: 0.7 }));
    return [{ c: 'acc', t: 'Median (middle value)' }];
  };

  F.variance = (g) => {
    let xs = [-2.6, -1.6, -0.9, -0.3, 0.4, 1.0, 1.7, 2.9];
    const m0 = meanOf(xs); xs = xs.map((x) => x - m0);
    const n = xs.length;
    g.add(K.line([[0, 0, -3.6], [0, 0, 3.6]], { w: 1.4, o: 0.8 }));
    g.add(K.label('x̄', [0, 0, 4.1], { size: 0.42 }));
    xs.forEach((x, i) => {
      const z = -3 + 6 * i / (n - 1), d = Math.abs(x);
      const x0 = Math.min(0, x);
      g.add(K.rect(x0 + d / 2, d / 2, z, d, d, 'xy', { c: 'acc', fill: 0.16, o: 0.8, w: 1.2 }));
      g.add(K.line([[0, 0, z], [x, 0, z]], { o: 0.4, w: 1 }));
    });
    g.add(K.dots(xs.map((x, i) => [x, 0, -3 + 6 * i / (n - 1)]), { r: 0.11 }));
    g.add(K.line([[-3.6, 0, -3.6], [3.6, 0, -3.6]], { o: 0.35, w: 1 }));
    g.add(K.label('σ² = (1/n) Σ (xᵢ − x̄)²', [0, 3.6, -3], { size: 0.38, o: 0.85 }));
    return [{ c: 'acc', t: 'Squared deviations' }];
  };

  F.stddev = (g, r) => {
    const sx = 1.4, sy = 6.5, f = (x) => npdf(x / sx) * sy;
    axes(g, -4.6, 4.6, 0, 0);
    g.add(ffill(f, -sx, sx, 0, { fill: 0.25 }));
    g.add(fcurve(f, -4.6, 4.6, 0, { w: 2 }));
    g.add(vline(0, 0, f(0) + 0.2, 0, { o: 0.6 }));
    [-2, 2].forEach((k) => g.add(vline(k * sx, 0, f(k * sx) + 0.6, 0, { o: 0.35, w: 1 })));
    [-1, 1].forEach((k) => g.add(vline(k * sx, 0, f(k * sx), 0, { c: 'acc', o: 0.9 })));
    g.add(darrow([-sx, 1.0, 0], [sx, 1.0, 0], { c: 'acc', w: 1.8, head: 0.22 }));
    g.add(K.label('μ', [0, f(0) + 0.5, 0], { size: 0.45 }));
    g.add(K.label('±σ', [0.55, 1.35, 0], { c: 'acc', size: 0.4 }));
    g.add(K.label('68%', [0, 0.42, 0], { c: 'acc', size: 0.36 }));
    g.add(K.label('2σ', [2 * sx, f(2 * sx) + 0.9, 0], { size: 0.32, o: 0.6 }));
    g.add(K.dots(samp(r, 120, (q) => [q.n() * sx, 0, 0.6 + q() * 2.4]).filter((p) => Math.abs(p[0]) < 4.5), { r: 0.06, o: 0.5 }));
    return [{ c: 'acc', t: 'One standard deviation' }];
  };

  F.covariance = (g, r) => {
    const P = samp(r, 46, (q) => { const x = q.n() * 1.5; return [x, 0.65 * x + q.n() * 0.9]; });
    const mx = meanOf(P.map((p) => p[0])), mz = meanOf(P.map((p) => p[1]));
    const s = 3.8;
    g.add(K.rect(0, 0, 0, 2 * s, 2 * s, 'xz', { o: 0.25 }));
    g.add(K.line([[mx, 0, -s], [mx, 0, s]], { o: 0.55, w: 1 }));
    g.add(K.line([[-s, 0, mz], [s, 0, mz]], { o: 0.55, w: 1 }));
    const pos = [], neg = [], pd = [], nd = [];
    P.forEach(([x, z]) => {
      x = Math.max(-s + 0.1, Math.min(s - 0.1, x)); z = Math.max(-s + 0.1, Math.min(s - 0.1, z));
      const h = (x - mx) * (z - mz) * 0.38;
      (h >= 0 ? pos : neg).push([[x, 0, z], [x, h, z]]);
      (h >= 0 ? pd : nd).push([x, h, z]);
    });
    g.add(K.segs(pos, { c: 'acc', w: 2 })); g.add(K.segs(neg, { c: 'b', w: 2 }));
    g.add(K.dots(pd, { r: 0.07, c: 'acc' })); g.add(K.dots(nd, { r: 0.07, c: 'b' }));
    g.add(K.dots(P.map(([x, z]) => [Math.max(-s + 0.1, Math.min(s - 0.1, x)), 0, Math.max(-s + 0.1, Math.min(s - 0.1, z))]), { r: 0.05, o: 0.55 }));
    g.add(K.label('x', [s + 0.4, 0, mz], { size: 0.4, o: 0.7 }));
    g.add(K.label('y', [mx, 0, s + 0.4], { size: 0.4, o: 0.7 }));
    g.add(K.label('(x − x̄)(y − ȳ)', [-2.2, 3.2, -s], { size: 0.38, o: 0.8 }));
    return [{ c: 'acc', t: 'Positive product' }, { c: 'b', t: 'Negative product' }];
  };

  F.correlation = (g, r) => {
    [[-0.85, -4.2, -1.6, 'r = −0.85'], [0, 0, 0, 'r ≈ 0'], [0.9, 4.2, 1.6, 'r = 0.9']].forEach(([rho, cx, z, lab]) => {
      const w = 3.4, P = [];
      for (let i = 0; i < 34; i++) { const a = r.n(), b = r.n(); P.push([a, rho * a + Math.sqrt(1 - rho * rho) * b]); }
      const sx = 0.62;
      g.add(K.rect(cx, w / 2, z, w, w, 'xy', { o: 0.22 }));
      g.add(K.dots(P.map(([a, b]) => [cx + Math.max(-2.6, Math.min(2.6, a)) * sx, w / 2 + Math.max(-2.6, Math.min(2.6, b)) * sx, z]), { r: 0.06 }));
      const k = rho * 1.5 * sx;
      g.add(K.line([[cx - 1.5 * sx, w / 2 - k, z], [cx + 1.5 * sx, w / 2 + k, z]], { c: 'acc', w: 2.2 }));
      g.add(K.label(lab, [cx, -0.45, z], { size: 0.38, c: 'acc' }));
    });
    return [{ c: 'acc', t: 'Direction and strength' }];
  };

  F.corrmatrix = (g, r) => {
    const n = 6, N = 300;
    const L = [[0.9, 0.1], [0.8, 0.2], [0.7, -0.3], [-0.6, 0.2], [0.1, 0.9], [-0.2, -0.75]];
    const D = [];
    for (let s = 0; s < N; s++) { const f = [r.n(), r.n()]; D.push(L.map((l) => l[0] * f[0] + l[1] * f[1] + r.n() * 0.5)); }
    const col = (j) => D.map((d) => d[j]);
    const C = [];
    for (let i = 0; i < n; i++) { C.push([]); for (let j = 0; j < n; j++) { const a = col(i), b = col(j), ma = meanOf(a), mb = meanOf(b); let s = 0; for (let k = 0; k < N; k++) s += (a[k] - ma) * (b[k] - mb); C[i].push(s / N / (sdOf(a) * sdOf(b))); } }
    const c = 1.05, off = -(n - 1) * c / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = C[i][j], x = off + j * c, z = off + i * c, h = Math.abs(v) * 1.25;
      if (i === j) g.add(K.box(x, h / 2, z, 0.74, h, 0.74, { fill: 0.1, o: 0.45 }));
      else g.add(K.box(x, h / 2, z, 0.74, Math.max(h, 0.02), 0.74, { fill: 0.15 + 0.6 * Math.abs(v), fc: v > 0 ? 'acc' : 'b', c: v > 0 ? 'acc' : 'b', o: 0.85 }));
    }
    g.add(K.rect(0, 0, 0, n * c, n * c, 'xz', { o: 0.3 }));
    for (let i = 0; i < n; i++) {
      g.add(K.label('x' + '₁₂₃₄₅₆'[i], [off + i * c, 0, -off + 0.85], { size: 0.34, o: 0.75 }));
      g.add(K.label('x' + '₁₂₃₄₅₆'[i], [-off + 0.85, 0, off + i * c], { size: 0.34, o: 0.75 }));
    }
    return [{ c: 'acc', t: 'Positive correlation' }, { c: 'b', t: 'Negative correlation' }];
  };

  F.quantile = (g) => {
    const s = 1.3, H = 4, f = (x) => ncdf(x, 0, s) * H;
    axes(g, -4.5, 4.5, 0, H + 0.2);
    g.add(K.line([[-4.5, H, 0], [4.5, H, 0]], { o: 0.2, w: 1, dash: true }));
    g.add(ffill((x) => npdf(x, 0, s) * 4, -4.5, 4.5, -1.6, { c: 'ink', fill: 0.06 }));
    g.add(fcurve((x) => npdf(x, 0, s) * 4, -4.5, 4.5, -1.6, { o: 0.3, w: 1 }));
    g.add(fcurve(f, -4.5, 4.5, 0, { w: 2 }));
    const qs = [[0.25, 'Q₁'], [0.5, 'Q₂'], [0.75, 'Q₃']];
    qs.forEach(([q, lab]) => {
      const x = s * Math.SQRT2 * erfinv(2 * q - 1), y = q * H;
      g.add(K.line([[-4.5, y, 0], [x, y, 0], [x, 0, 0]], { c: 'acc', w: 1.4, dash: true }));
      g.add(K.line([[x, 0, 0], [x, 0, -1.6]], { c: 'acc', w: 1, o: 0.6 }));
      g.add(K.label(lab, [x, -0.45, 0], { c: 'acc', size: 0.38 }));
      g.add(K.label(String(q), [-5.1, y, 0], { size: 0.32, o: 0.7 }));
    });
    g.add(K.dots(qs.map(([q]) => [s * Math.SQRT2 * erfinv(2 * q - 1), q * H, 0]), { r: 0.1, c: 'acc' }));
    return [{ c: 'acc', t: 'Quartiles' }];
  };
  function erfinv(y) { let lo = -6, hi = 6; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (erf(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; }

  F.iqr = (g, r) => {
    const vals = samp(r, 46, (q) => q.n() * 0.9 + 0.3).concat([3.9, 4.4, -3.4]).sort((a, b) => a - b);
    const Q = (p) => { const i = p * (vals.length - 1), lo = Math.floor(i); return vals[lo] + (vals[Math.min(lo + 1, vals.length - 1)] - vals[lo]) * (i - lo); };
    const q1 = Q(0.25), q2 = Q(0.5), q3 = Q(0.75), iqr = q3 - q1;
    const wl = Math.min(...vals.filter((v) => v >= q1 - 1.5 * iqr)), wh = Math.max(...vals.filter((v) => v <= q3 + 1.5 * iqr));
    const by = 1.3, bh = 1.0;
    g.add(K.box((q1 + q3) / 2, by, 0, iqr, bh, 0.45, { fill: 0.35, fc: 'acc', c: 'acc', o: 0.95 }));
    g.add(K.line([[q2, by - bh / 2, 0.23], [q2, by + bh / 2, 0.23]], { w: 2.2 }));
    g.add(K.line([[wl, by, 0], [q1, by, 0]], { w: 1.2, o: 0.7 }));
    g.add(K.line([[q3, by, 0], [wh, by, 0]], { w: 1.2, o: 0.7 }));
    [wl, wh].forEach((x) => g.add(K.line([[x, by - 0.3, 0], [x, by + 0.3, 0]], { w: 1.2, o: 0.7 })));
    g.add(K.dots(vals.filter((v) => v < wl || v > wh).map((v) => [v, by, 0]), { r: 0.11, hollow: true }));
    g.add(darrow([q1, by + bh / 2 + 0.45, 0], [q3, by + bh / 2 + 0.45, 0], { c: 'acc', w: 1.6, head: 0.2 }));
    g.add(K.label('IQR', [(q1 + q3) / 2, by + bh / 2 + 0.85, 0], { c: 'acc', size: 0.42 }));
    g.add(K.label('Q₁', [q1, by - bh / 2 - 0.3, 0.25], { size: 0.32, o: 0.75 }));
    g.add(K.label('Q₃', [q3, by - bh / 2 - 0.3, 0.25], { size: 0.32, o: 0.75 }));
    const zj = vals.map(() => 0.9 + r() * 1.5);
    g.add(K.dots(vals.map((v, i) => [v, 0, zj[i]]).filter((p) => p[0] >= q1 && p[0] <= q3), { r: 0.08, c: 'acc' }));
    g.add(K.dots(vals.map((v, i) => [v, 0, zj[i]]).filter((p) => p[0] < q1 || p[0] > q3), { r: 0.08, o: 0.5 }));
    g.add(K.line([[-4, 0, 2.6], [4.8, 0, 2.6]], { o: 0.4, w: 1 }));
    g.add(K.segs([[[q1, 0, 0.7], [q1, 0, 2.6]], [[q3, 0, 0.7], [q3, 0, 2.6]]], { c: 'acc', o: 0.5 }));
    return [{ c: 'acc', t: 'Middle 50%' }];
  };

  F.skewness = (g) => {
    const sx = 1.25, X0 = -4.2, A = 4.2 * Math.E;
    const f = (x) => { const u = (x - X0) / sx; return u > 0 ? u * Math.exp(-u) * A : 0; };
    axes(g, -4.4, 5, 0, 0);
    const mode = X0 + sx, med = X0 + 1.678 * sx, mn = X0 + 2 * sx, t0 = X0 + 3.2 * sx;
    g.add(ffill(f, t0, 5, 0, { fill: 0.3 }));
    g.add(fcurve(f, -4.4, 5, 0, { w: 2, n: 140 }));
    g.add(K.line(lin(t0, 5, 60).map((x) => [x, f(x), 0]), { c: 'acc', w: 2.6 }));
    g.add(vline(mode, 0, f(mode) + 0.35, 0, { o: 0.4, w: 1 }));
    g.add(vline(med, 0, f(med) + 0.8, 0, { o: 0.55, w: 1 }));
    g.add(vline(mn, 0, f(mn) + 1.4, 0, { o: 0.8, w: 1.2 }));
    g.add(K.label('x̃', [med, f(med) + 1.1, 0], { size: 0.38, o: 0.75 }));
    g.add(K.label('x̄', [mn + 0.05, f(mn) + 1.75, 0], { size: 0.4 }));
    g.add(K.arrow([0.9, 2.2, 0], [3.8, 1.0, 0], { c: 'acc', w: 1.6 }));
    g.add(K.label('γ₁ > 0', [2.9, 2.3, 0], { c: 'acc', size: 0.42 }));
    return [{ c: 'acc', t: 'Long right tail' }];
  };

  F.kurtosis = (g, r) => {
    const sx = 0.85, sy = 7.5;
    const tp = (x) => 0.3676 * Math.pow(1 + x * x / 3, -2);
    const fn = (x) => npdf(x / sx, 0, 1) * sy, ft = (x) => tp(x / sx) * sy;
    axes(g, -4.6, 4.6, 0, 0);
    g.add(ffill(ft, 2.2 * sx, 4.6, 0, { fill: 0.35 })); g.add(ffill(ft, -4.6, -2.2 * sx, 0, { fill: 0.35 }));
    g.add(fcurve(fn, -4.6, 4.6, 0, { w: 1.4, o: 0.5, dash: true }));
    g.add(fcurve(ft, -4.6, 4.6, 0, { w: 2.2, c: 'acc' }));
    const tS = (q) => { const c = q.n() ** 2 + q.n() ** 2 + q.n() ** 2; return q.n() / Math.sqrt(c / 3) * sx; };
    const ts = samp(r, 70, tS).map((x) => Math.max(-5.2, Math.min(5.2, x)));
    const ns = samp(r, 70, (q) => q.n() * sx * 1.5);
    g.add(K.line([[-5.3, 0, 1.4], [5.3, 0, 1.4]], { o: 0.25, w: 1 }));
    g.add(K.line([[-5.3, 0, 2.4], [5.3, 0, 2.4]], { o: 0.25, w: 1 }));
    g.add(K.dots(ns.map((x) => [x, 0, 1.4]), { r: 0.07, o: 0.45 }));
    g.add(K.dots(ts.filter((x) => Math.abs(x) <= 2.6).map((x) => [x, 0, 2.4]), { r: 0.07, o: 0.45 }));
    g.add(K.dots(ts.filter((x) => Math.abs(x) > 2.6).map((x) => [x, 0, 2.4]), { r: 0.1, c: 'acc' }));
    g.add(K.label('N(0,1)', [-3.6, fn(-1.2 * sx) + 0.8, 0], { size: 0.34, o: 0.6 }));
    g.add(K.label('t₃', [1.6, ft(0.9 * sx) + 0.5, 0], { size: 0.4, c: 'acc' }));
    return [{ c: 'acc', t: 'Heavy tails' }, { c: 'ink', t: 'Normal reference' }];
  };

  F.probdist = (g) => {
    // discrete: sum of two dice, front
    const pm = (s) => (6 - Math.abs(s - 7)) / 36;
    for (let s = 2; s <= 12; s++) g.add(bar(-4.5 + (s - 2) * 0.62, pm(s) * 18, 0.42, 1.6, 0.42, s >= 6 && s <= 8));
    g.add(K.line([[-4.9, 0, 1.6], [1.9, 0, 1.6]], { o: 0.45, w: 1 }));
    g.add(K.label('P(X = x)', [-1.4, 3.7, 1.6], { size: 0.36, o: 0.8 }));
    // continuous: density, back
    const f = (x) => (npdf(x, 1.6, 0.9) * 0.6 + npdf(x, 3.4, 0.7) * 0.4) * 6;
    axes(g, -0.4, 5.2, -1.6, 0);
    g.add(ffill(f, 1.2, 2.8, -1.6, { fill: 0.35 }));
    g.add(fcurve(f, -0.4, 5.2, -1.6, { w: 2 }));
    g.add(K.label('p(x)', [3.6, 2.7, -1.6], { size: 0.36, o: 0.8 }));
    g.add(K.label('a', [1.2, -0.35, -1.6], { size: 0.32, o: 0.7 }));
    g.add(K.label('b', [2.8, -0.35, -1.6], { size: 0.32, o: 0.7 }));
    g.add(K.label('Σ = 1', [-3.4, -0.5, 1.6], { size: 0.34, o: 0.6 }));
    g.add(K.label('∫ = 1', [4.4, -0.5, -1.6], { size: 0.34, o: 0.6 }));
    return [{ c: 'acc', t: 'Probability of an event' }];
  };

  F.normaldist = (g, r) => {
    const s = 1.3, vals = samp(r, 700, (q) => q.n() * s), nb = 22, a = -4.4, b = 4.4, w = (b - a) / nb;
    const c = hist(vals, a, b, nb), sc = 9.5 / (700 * w);
    c.forEach((k, i) => g.add(bar(a + (i + 0.5) * w, k * sc, w * 0.86, 0, 0.5, false)));
    const f = (x) => npdf(x, 0, s) * 9.5;
    g.add(fcurve(f, -4.6, 4.6, 0.26, { c: 'acc', w: 2.6 }));
    axes(g, -4.8, 4.8, 0.26, 0);
    g.add(vline(0, 0, f(0) + 0.35, 0.26, { o: 0.6 }));
    g.add(darrow([0, f(s) , 0.26], [s, f(s), 0.26], { w: 1.2, o: 0.7, head: 0.16 }));
    g.add(K.label('μ', [0, f(0) + 0.65, 0.26], { size: 0.42 }));
    g.add(K.label('σ', [s / 2, f(s) + 0.3, 0.26], { size: 0.38, o: 0.8 }));
    return [{ c: 'acc', t: 'Bell curve' }, { c: 'ink', t: 'Sample histogram' }];
  };

  F.binomial = (g) => {
    const n = 10, p = 0.3;
    const C = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; };
    for (let k = 0; k <= n; k++) g.add(bar(-1.6 + k * 0.6, C(n, k) * p ** k * (1 - p) ** (n - k) * 13, 0.42, 1.2, 0.42, true));
    g.add(K.line([[-2, 0, 1.2], [4.6, 0, 1.2]], { o: 0.45, w: 1 }));
    g.add(K.label('0', [-1.6, -0.35, 1.2], { size: 0.3, o: 0.7 }));
    g.add(K.label('10', [4.4, -0.35, 1.2], { size: 0.3, o: 0.7 }));
    g.add(K.label('n = 10', [3.2, 3.5, 1.2], { size: 0.38, c: 'acc' }));
    // Bernoulli
    g.add(bar(-4.4, 0.7 * 4, 0.5, -1.4, 0.5, false)); g.add(bar(-3.6, 0.3 * 4, 0.5, -1.4, 0.5, false));
    g.add(K.line([[-4.9, 0, -1.4], [-3.1, 0, -1.4]], { o: 0.45, w: 1 }));
    g.add(K.label('0', [-4.4, -0.35, -1.4], { size: 0.3, o: 0.7 }));
    g.add(K.label('1', [-3.6, -0.35, -1.4], { size: 0.3, o: 0.7 }));
    g.add(K.label('p = 0.3', [-4.0, 3.4, -1.4], { size: 0.36, o: 0.8 }));
    // 10 coin flips -> count of ones
    const flips = [0, 1, 0, 0, 1, 0, 0, 0, 1, 0];
    flips.forEach((f, i) => { const pos = [-1.4 + i * 0.55, 0, 2.7]; g.add(f ? K.dots([pos], { r: 0.16, c: 'acc' }) : K.dots([pos], { r: 0.16, hollow: true, o: 0.6 })); });
    g.add(K.arrow([1.2, 0, 2.3], [0.2, 0, 1.55], { w: 1, o: 0.45, head: 0.18 }));
    g.add(K.label('3', [-1.6 + 3 * 0.6, 0.6 + 0.2668 * 13, 1.2], { size: 0.34, c: 'acc' }));
    return [{ c: 'acc', t: 'Count of successes' }];
  };

  F.poisson = (g, r, p) => {
    const lam = p.lambda == null ? 3 : p.lambda;
    // timeline of events (front)
    const Z = 2.2, nI = 8;
    g.add(K.line([[-4, 0, Z], [4, 0, Z]], { o: 0.6, w: 1.2 }));
    const ticks = []; for (let i = 0; i <= nI; i++) ticks.push([[-4 + i, -0.12, Z], [-4 + i, 0.12, Z]]);
    g.add(K.segs(ticks, { o: 0.6 }));
    let t = 0; const ev = [];
    while (true) { t += -Math.log(1 - r()) / lam; if (t >= nI) break; ev.push(t); }
    const cnt = new Array(nI).fill(0);
    const EP = ev.map((e) => { const i = Math.floor(e); cnt[i]++; return [-4 + e, 0, Z]; });
    g.add(K.dots(EP, { r: 0.09 }));
    cnt.forEach((c, i) => g.add(K.label(String(c), [-3.5 + i, 0.45, Z], { size: 0.32, c: 'acc' })));
    // PMF (back)
    let pk = Math.exp(-lam); const kmax = 12, w = 0.62, sc = 9;
    for (let k = 0; k <= kmax; k++) { if (k > 0) pk = pk * lam / k; g.add(bar(-4 + k * w, pk * sc, w * 0.7, -1.2, 0.45, true)); }
    g.add(K.line([[-4.4, 0, -1.2], [-4 + kmax * w + 0.4, 0, -1.2]], { o: 0.45, w: 1 }));
    g.add(K.label('0', [-4, -0.35, -1.2], { size: 0.3, o: 0.7 }));
    g.add(K.label('k', [-4 + kmax * w + 0.7, 0, -1.2], { size: 0.34, o: 0.7 }));
    g.add(K.label('λ = ' + lam, [2.2, 3.4, -1.2], { size: 0.4, c: 'acc' }));
    return [{ c: 'acc', t: 'Events per interval' }];
  };

  F.uniformdist = (g, r) => {
    const a = -3, b = 3, h = 2.8;
    axes(g, -4.5, 4.5, 0, 0);
    g.add(K.rect(0, h / 2, 0, b - a, h, 'xy', { c: 'acc', fill: 0.22, o: 0.95, w: 2.2 }));
    g.add(K.line([[-4.5, 0, 0], [a, 0, 0]], { w: 2 })); g.add(K.line([[b, 0, 0], [4.5, 0, 0]], { w: 2 }));
    g.add(K.label('a', [a, -0.4, 0], { size: 0.38 })); g.add(K.label('b', [b, -0.4, 0], { size: 0.38 }));
    g.add(K.label('1 / (b − a)', [0, h + 0.45, 0], { size: 0.38, c: 'acc' }));
    g.add(K.dots(samp(r, 110, (q) => [q.range(a, b), 0, 1.0 + q() * 2.4]), { r: 0.06, o: 0.55 }));
    g.add(K.rect(0, 0, 2.2, b - a, 2.6, 'xz', { o: 0.25 }));
    return [{ c: 'acc', t: 'Constant density' }];
  };

  F.expectation = (g, r) => {
    const xs = [1, 2, 3, 4, 5, 6], ps = [0.05, 0.1, 0.12, 0.18, 0.25, 0.3];
    const E = xs.reduce((s, x, i) => s + x * ps[i], 0);
    const X = (v) => (v - 3.5) * 1.25;
    g.add(K.box(0, 0.04, 0.8, 8, 0.08, 1.1, { fill: 0.1, o: 0.55 }));
    xs.forEach((x, i) => g.add(bar(X(x), ps[i] * 10, 0.55, 0.8, 0.55, false, 0.08)));
    xs.forEach((x) => g.add(K.label(String(x), [X(x), 0.3, 1.75], { size: 0.3, o: 0.7 })));
    g.add(fulcrum(X(E), 0, 0.8));
    g.add(vline(X(E), 0.1, 3.6, 0.8, { c: 'acc', w: 1.6 }));
    g.add(K.label('E[X] = Σ x·p(x)', [X(E), 4.0, 0.8], { c: 'acc', size: 0.38 }));
    // running average behind
    const Zb = -1.8, N = 160; let s = 0; const pts = [];
    for (let i = 1; i <= N; i++) {
      let u = r(), k = 0; while (k < 5 && u > ps[k]) { u -= ps[k]; k++; }
      s += xs[k]; pts.push([-4 + 8 * (i - 1) / (N - 1), 0.4 + (s / i - 1) * 0.6, Zb]);
    }
    g.add(K.line(pts, { w: 1.2, o: 0.55 }));
    g.add(K.line([[-4, 0.4 + (E - 1) * 0.6, Zb], [4, 0.4 + (E - 1) * 0.6, Zb]], { c: 'acc', w: 1, dash: true }));
    g.add(K.line([[-4, 0.4, Zb], [4, 0.4, Zb]], { o: 0.3, w: 1 }));
    return [{ c: 'acc', t: 'Expected value' }, { c: 'ink', t: 'Running average' }];
  };

  F.condprob = (g, r) => {
    const W = 4.6, D = 3.0, A = [-0.9, 0], B = [1.0, 0.1], R = 1.8, Y = 2.4;
    g.add(K.rect(0, 0, 0, 2 * W, 2 * D, 'xz', { o: 0.45 }));
    const inA = (x, z) => (x - A[0]) ** 2 + (z - A[1]) ** 2 < R * R, inB = (x, z) => (x - B[0]) ** 2 + (z - B[1]) ** 2 < R * R;
    const P = samp(r, 170, (q) => [q.range(-W + 0.2, W - 0.2), q.range(-D + 0.2, D - 0.2)]);
    g.add(K.dots(P.map(([x, z]) => [x, 0, z]), { r: 0.05, o: 0.4 }));
    g.add(K.line(circ(A[0], 0, A[1], R), { w: 1.2, o: 0.6 }));
    g.add(K.line(circ(B[0], 0, B[1], R), { w: 1.2, o: 0.6 }));
    // B lifted as the new universe
    g.add(K.line(circ(B[0], Y, B[1], R), { w: 1.8 }));
    g.add(floorPoly(circ(B[0], 0, B[1], R).map((p) => [p[0], p[2]]), Y, { c: 'ink', fill: 0.05 }));
    const PB = P.filter(([x, z]) => inB(x, z));
    g.add(K.dots(PB.filter(([x, z]) => inA(x, z)).map(([x, z]) => [x, Y, z]), { r: 0.08, c: 'acc' }));
    g.add(K.dots(PB.filter(([x, z]) => !inA(x, z)).map(([x, z]) => [x, Y, z]), { r: 0.08, o: 0.7 }));
    // A boundary clipped inside B
    const arcA = circ(A[0], Y, A[1], R, 'xz', 120).filter((p) => inB(p[0], p[2]) || ((p[0] - B[0]) ** 2 + (p[2] - B[1]) ** 2 < R * R * 1.01));
    g.add(K.line(arcA, { c: 'acc', w: 1.4 }));
    [0, Math.PI / 2, Math.PI, 1.5 * Math.PI].forEach((a) => { const x = B[0] + R * Math.cos(a), z = B[1] + R * Math.sin(a); g.add(K.line([[x, 0, z], [x, Y, z]], { o: 0.18, w: 1 })); });
    g.add(K.label('Ω', [-W + 0.4, 0, D + 0.4], { size: 0.42, o: 0.7 }));
    g.add(K.label('A', [A[0] - R + 0.2, 0.3, A[1] - 0.6], { size: 0.4, o: 0.75 }));
    g.add(K.label('B', [B[0] + R + 0.3, Y, B[1]], { size: 0.42 }));
    g.add(K.label('P(A | B)', [B[0], Y + 0.9, B[1] - R], { size: 0.42, c: 'acc' }));
    return [{ c: 'acc', t: 'A within B' }];
  };

  F.bayesthm = (g) => {
    const W = 6, H = 4, pH = 0.3, pEH = 0.8, pEn = 0.25;
    const x0 = -4, xs = x0 + W * pH, x1 = x0 + W;
    g.add(K.rect(x0 + W / 2, H / 2, 0, W, H, 'xy', { o: 0.5 }));
    g.add(K.line([[xs, 0, 0], [xs, H, 0]], { o: 0.5, w: 1 }));
    const hA = H * pEH, hB = H * pEn;
    g.add(K.box((x0 + xs) / 2, hA / 2, 0.4, xs - x0, hA, 0.8, { fill: 0.55, fc: 'acc', c: 'acc', o: 0.95 }));
    g.add(K.box((xs + x1) / 2, hB / 2, 0.4, x1 - xs, hB, 0.8, { fill: 0.45, fc: 'b', c: 'b', o: 0.95 }));
    g.add(K.label('H', [(x0 + xs) / 2, H + 0.4, 0], { size: 0.42 }));
    g.add(K.label('¬H', [(xs + x1) / 2, H + 0.4, 0], { size: 0.42 }));
    g.add(K.label('E', [x0 - 0.45, hA / 2, 0.8], { size: 0.4, o: 0.75 }));
    // posterior stack
    const a = pH * pEH, b = (1 - pH) * pEn, ht = 4, sx = 3.6;
    g.add(K.box(sx, ht * (a / (a + b)) / 2, 0.4, 0.8, ht * a / (a + b), 0.8, { fill: 0.55, fc: 'acc', c: 'acc', o: 0.95 }));
    g.add(K.box(sx, ht * a / (a + b) + ht * (b / (a + b)) / 2, 0.4, 0.8, ht * b / (a + b), 0.8, { fill: 0.45, fc: 'b', c: 'b', o: 0.95 }));
    g.add(K.label('P(H | E)', [sx, ht + 0.45, 0.4], { size: 0.36, c: 'acc' }));
    g.add(K.arrow([x1 + 0.2, 0.6, 0.4], [sx - 0.55, 0.6, 0.4], { w: 1, o: 0.45, head: 0.18 }));
    g.add(K.label('P(H|E) = P(E|H)·P(H) / P(E)', [-1, -1.3, 0.8], { size: 0.36, o: 0.85 }));
    return [{ c: 'acc', t: 'E and H' }, { c: 'b', t: 'E without H' }];
  };

  F.priorpost = (g) => {
    const m0 = 0, s0 = 1.4, ml = 1.8, sl = 0.8;
    const pp = 1 / s0 ** 2 + 1 / sl ** 2, sp = Math.sqrt(1 / pp), mp = (m0 / s0 ** 2 + ml / sl ** 2) / pp;
    const sc = 7.5, X = 1.15;
    const rows = [[(x) => npdf(x / X, m0, s0) * sc, -2.2, { w: 1.6, o: 0.55 }, 'p(θ)'], [(x) => npdf(x / X, ml, sl) * sc, 0, { w: 1.4, o: 0.6, dash: true }, 'p(D | θ)'], [(x) => npdf(x / X, mp, sp) * sc, 2.2, { w: 2.4, c: 'acc' }, 'p(θ | D)']];
    rows.forEach(([f, z, o, lab]) => {
      axes(g, -4.5, 4.5, z, 0, { o: 0.35 });
      if (o.c) g.add(ffill(f, -4.5, 4.5, z, { fill: 0.22 }));
      g.add(fcurve(f, -4.5, 4.5, z, o));
      g.add(K.label(lab, [-4.6, 0.55, z], { size: 0.4, c: o.c || 'ink', o: o.c ? 1 : 0.75 }));
    });
    g.add(K.segs([[[mp * X, 0, 2.2], [mp * X, 0, -2.2]]], { o: 0.3 }));
    return [{ c: 'acc', t: 'Posterior' }, { c: 'ink', t: 'Prior and likelihood' }];
  };

  F.likelihood = (g) => {
    const data = [0.4, 1.0, 1.4, 1.9, 2.6], s = 0.9, sc = 6.5;
    [[-0.6, -2.4, 'θ₁'], [1.46, 0, 'θ₂'], [3.4, 2.4, 'θ₃']].forEach(([mu, z, lab]) => {
      const f = (x) => npdf(x, mu, s) * sc;
      axes(g, -3.2, 5.2, z, 0, { o: 0.35 });
      g.add(fcurve(f, -3.2, 5.2, z, { w: 1.4, o: 0.6 }));
      g.add(K.segs(data.map((x) => [[x, 0, z], [x, f(x), z]]), { c: 'acc', w: 2.2 }));
      g.add(K.dots(data.map((x) => [x, f(x), z]), { r: 0.07, c: 'acc' }));
      g.add(K.dots(data.map((x) => [x, 0, z]), { r: 0.08 }));
      g.add(K.label(lab, [-3.6, 0.3, z], { size: 0.38, o: 0.8 }));
    });
    g.add(K.label('L(θ) = ∏ p(xᵢ | θ)', [-1.8, 2.6, 2.4], { size: 0.38, c: 'acc' }));
    return [{ c: 'acc', t: 'p(xᵢ | θ) at each point' }, { c: 'ink', t: 'Fixed data' }];
  };

  F.mle = (g, r) => {
    const muT = 0.6, s = 1, data = samp(r, 60, (q) => q.n() * s + muT), m = meanOf(data);
    // front: histogram + fitted bell
    const a = -3, b = 4.2, nb = 14, w = (b - a) / nb, c = hist(data, a, b, nb), sc = 4.6 / (60 * w);
    c.forEach((k, i) => g.add(bar(a + (i + 0.5) * w, k * sc, w * 0.85, 1.6, 0.5, false)));
    g.add(fcurve((x) => npdf(x, m, s) * 4.6, -3.2, 4.4, 1.6, { c: 'acc', w: 2.4 }));
    g.add(fcurve((x) => npdf(x, m - 1.6, s) * 4.6, -3.2, 4.4, 1.6, { w: 1, o: 0.3, dash: true }));
    // back: log-likelihood over θ
    const Zb = -2.2, ll = (t) => data.reduce((q, x) => q - 0.5 * (x - t) ** 2, 0);
    const lmax = ll(m), kk = 3.0 / (0.5 * data.length * 1.6 * 1.6), Y = (t) => 3.3 + (ll(t) - lmax) * kk;
    axes(g, -3.2, 4.4, Zb, 0, { o: 0.35 });
    g.add(fcurve(Y, m - 1.6, m + 1.6, Zb, { w: 1.8 }));
    g.add(K.dots([[m, Y(m), Zb]], { r: 0.13, c: 'acc' }));
    g.add(vline(m, 0, Y(m), Zb, { c: 'acc' }));
    g.add(K.line([[m, 0, Zb], [m, 0, 1.6]], { c: 'acc', w: 1, o: 0.5, dash: true }));
    g.add(K.label('θ̂', [m, -0.4, Zb], { size: 0.42, c: 'acc' }));
    g.add(K.label('log L(θ)', [m + 2.4, 1.0, Zb], { size: 0.36, o: 0.8 }));
    return [{ c: 'acc', t: 'Maximum likelihood fit' }];
  };

  F.mapest = (g) => {
    const m0 = -1.2, s0 = 1.1, ml = 1.6, sl = 1.1;
    const pp = 1 / s0 ** 2 + 1 / sl ** 2, sp = Math.sqrt(1 / pp), mp = (m0 / s0 ** 2 + ml / sl ** 2) / pp;
    const sc = 6, X = 1.25;
    const fp = (x) => npdf(x / X, m0, s0) * sc * 0.8, fl = (x) => npdf(x / X, ml, sl) * sc * 0.8, fq = (x) => npdf(x / X, mp, sp) * sc * 0.8;
    axes(g, -4.8, 4.8, -1.6, 0, { o: 0.3 });
    g.add(fcurve(fp, -4.8, 4.8, -1.6, { w: 1.2, o: 0.4 }));
    g.add(K.label('p(θ)', [m0 * X, fp(m0 * X) + 0.4, -1.6], { size: 0.34, o: 0.6 }));
    axes(g, -4.8, 4.8, 0.6, 0);
    g.add(fcurve(fl, -4.8, 4.8, 0.6, { w: 1.8, c: 'b' }));
    g.add(fcurve(fq, -4.8, 4.8, 0.6, { w: 2.4, c: 'acc' }));
    g.add(vline(ml * X, 0, fl(ml * X), 0.6, { c: 'b' }));
    g.add(vline(mp * X, 0, fq(mp * X), 0.6, { c: 'acc' }));
    g.add(K.dots([[ml * X, fl(ml * X), 0.6]], { r: 0.12, c: 'b' }));
    g.add(K.dots([[mp * X, fq(mp * X), 0.6]], { r: 0.12, c: 'acc' }));
    g.add(K.label('MLE', [ml * X + 0.3, -0.4, 0.6], { size: 0.34, c: 'b' }));
    g.add(K.label('MAP', [mp * X - 0.3, -0.4, 0.6], { size: 0.34, c: 'acc' }));
    g.add(K.arrow([ml * X - 0.1, 0.5, 0.6], [mp * X + 0.15, 0.5, 0.6], { w: 1.2, o: 0.5, head: 0.18 }));
    return [{ c: 'acc', t: 'Posterior peak (MAP)' }, { c: 'b', t: 'Likelihood peak (MLE)' }];
  };

  F.iid = (g, r) => {
    const n = 6, sc = 4.2;
    for (let i = 0; i < n; i++) {
      const z = -3 + 6 * i / (n - 1);
      // left: identical distributions
      const fA = (x) => npdf(x, -2.6, 0.8) * sc;
      g.add(fcurve(fA, -5, -0.2, z, { c: 'acc', w: 1.6, o: 0.85 }));
      g.add(K.line([[-5, 0, z], [-0.2, 0, z]], { o: 0.3, w: 1 }));
      const xa = -2.6 + r.n() * 0.8;
      g.add(K.dots([[Math.max(-4.9, Math.min(-0.3, xa)), 0, z]], { r: 0.1, c: 'acc' }));
      // right: drifting distributions (not identical)
      const mu = 1.6 + i * 0.4, sd = 0.5 + i * 0.1;
      const fB = (x) => npdf(x, mu, sd) * sc * 0.9;
      g.add(fcurve(fB, 0.2, 5.4, z, { c: 'b', w: 1.4, o: 0.8 }));
      g.add(K.line([[0.2, 0, z], [5.4, 0, z]], { o: 0.3, w: 1 }));
      g.add(K.dots([[mu + r.n() * sd * 0.6, 0, z]], { r: 0.1, c: 'b' }));
    }
    g.add(K.label('x₁ … xₙ', [-5.8, 0.3, 3], { size: 0.4, o: 0.65 }));
    return [{ c: 'acc', t: 'Same distribution' }, { c: 'b', t: 'Drifting distribution' }];
  };

  F.clt = (g, r) => {
    const ns = [1, 2, 5, 30], a = 0, b = 3.6, nb = 24, w = (b - a) / nb, Xw = (v) => -3.6 + v * 2.0, ww = w * 2.0;
    ns.forEach((n, j) => {
      const z = -3 + j * 2, S = 2500;
      const means = samp(r, S, (q) => { let s = 0; for (let i = 0; i < n; i++) s += -Math.log(1 - q()); return s / n; });
      const c = hist(means, a, b, nb), cm = Math.max(...c), sc = 2.8 / cm;
      c.forEach((k, i) => g.add(bar(Xw(a + (i + 0.5) * w), k * sc, ww * 0.82, z, 0.35, false)));
      g.add(K.line([[Xw(a) - 0.2, 0, z], [Xw(b) + 0.2, 0, z]], { o: 0.4, w: 1 }));
      if (n === 30) g.add(fcurve((x) => npdf((x + 3.6) / 2, 1, 1 / Math.sqrt(30)) * 2.8 / npdf(0, 0, 1 / Math.sqrt(30)) * 0.98, Xw(0.3), Xw(1.7), z + 0.2, { c: 'acc', w: 2.4, n: 120 }));
      g.add(K.label('n = ' + n, [Xw(b) + 1.0, 0.3, z], { size: 0.36, c: n === 30 ? 'acc' : 'ink', o: n === 30 ? 1 : 0.75 }));
    });
    return [{ c: 'acc', t: 'Normal limit' }, { c: 'ink', t: 'Sample means' }];
  };

  F.stderr = (g, r, p) => {
    const n = p.n == null ? 10 : p.n, se = 1 / Math.sqrt(n), X = 1.25, sc = 3.4;
    const fP = (x) => npdf(x / X, 0, 1) * sc, fS = (x) => npdf(x / X, 0, se) * sc;
    axes(g, -4.6, 4.6, -1.4, 0, { o: 0.35 });
    g.add(fcurve(fP, -4.6, 4.6, -1.4, { w: 1.6, o: 0.6 }));
    g.add(darrow([-X, fP(X), -1.4], [X, fP(X), -1.4], { w: 1.2, o: 0.6, head: 0.18 }));
    g.add(K.label('σ', [X + 0.45, fP(X), -1.4], { size: 0.38, o: 0.75 }));
    const pts = samp(r, 70, (q) => q.n()).map((v) => [v * X, 0, -1.4 + 0.35]);
    g.add(K.dots(pts.filter((p) => Math.abs(p[0]) < 4.5), { r: 0.05, o: 0.35 }));
    axes(g, -4.6, 4.6, 1.4, 0);
    const e = Math.min(4.6, 4 * se * X);
    g.add(ffill(fS, -e, e, 1.4, { fill: 0.18, n: 120 }));
    g.add(fcurve(fS, -e, e, 1.4, { c: 'acc', w: 2.4, n: 120 }));
    const hs = fS(se * X);
    g.add(darrow([-se * X, hs, 1.4], [se * X, hs, 1.4], { c: 'acc', w: 1.6, head: 0.14 }));
    g.add(K.label('σ / √n', [se * X + 1.5, hs + 0.2, 1.4], { size: 0.38, c: 'acc' }));
    g.add(K.label('n = ' + n, [3.6, 2.4, 1.4], { size: 0.36, o: 0.75 }));
    return [{ c: 'acc', t: 'Spread of sample means' }, { c: 'ink', t: 'Spread of data' }];
  };

  F.confint = (g, r) => {
    const mu = 0, N = 24, n = 15, X = 1.6;
    g.add(K.line([[mu, -0.2, 0], [mu, 5.7, 0]], { w: 1.4, o: 0.8 }));
    g.add(K.rect(mu, 2.75, 0, 1.6, 5.9, 'yz', { c: 'ink', fill: 0.05, edge: false }));
    let miss = 0;
    for (let i = 0; i < N; i++) {
      const d = samp(r, n, (q) => q.n() * 1.2 + mu), m = meanOf(d), s = sdOf(d) * Math.sqrt(n / (n - 1)), h = 2.145 * s / Math.sqrt(n);
      let lo = m - h, hi = m + h;
      if (i === 9 && miss === 0) { lo = 0.12; hi = lo + 2 * h; }
      const bad = lo > mu || hi < mu; if (bad) miss++;
      const y = i * 0.24, c = bad ? 'acc' : 'ink';
      g.add(K.line([[lo * X, y, 0], [hi * X, y, 0]], { c, w: bad ? 2.4 : 1.4, o: bad ? 1 : 0.7 }));
      g.add(K.dots([[(lo + hi) / 2 * X, y, 0]], { r: 0.06, c, o: bad ? 1 : 0.7 }));
    }
    g.add(K.label('μ', [mu, 6.1, 0], { size: 0.45 }));
    g.add(K.label('95%', [3.4, 5.6, 0], { size: 0.36, o: 0.7 }));
    return [{ c: 'acc', t: 'Misses true value' }, { c: 'ink', t: 'Covers true value' }];
  };

  F.hyptest = (g) => {
    const X = 1.25, sc = 11, f = (x) => npdf(x / X) * sc, crit = 1.96 * X, tobs = 2.15 * X;
    axes(g, -4.8, 4.8, 0, 0);
    g.add(ffill(f, crit, 4.8, -0.02, { c: 'ink', fill: 0.1 })); g.add(ffill(f, -4.8, -crit, -0.02, { c: 'ink', fill: 0.1 }));
    g.add(ffill(f, tobs, 4.8, 0.01, { fill: 0.65 })); g.add(ffill(f, -4.8, -tobs, 0.01, { fill: 0.65 }));
    g.add(fcurve(f, -4.8, 4.8, 0, { w: 2 }));
    [-crit, crit].forEach((x) => g.add(vline(x, 0, 2.0, 0, { o: 0.45, w: 1 })));
    g.add(K.line([[tobs, 0, 0], [tobs, 2.4, 0]], { c: 'acc', w: 2 }));
    g.add(K.dots([[tobs, 0, 0]], { r: 0.11, c: 'acc' }));
    g.add(K.label('t_obs', [tobs + 0.3, 2.75, 0], { size: 0.36, c: 'acc' }));
    g.add(K.label('p', [tobs + 0.75, 0.75, 0], { size: 0.4, c: 'acc' }));
    g.add(K.label('α/2', [-crit - 0.6, 1.3, 0], { size: 0.32, o: 0.65 }));
    g.add(K.label('H₀', [0, f(0) + 0.45, 0], { size: 0.42 }));
    return [{ c: 'acc', t: 'p-value area' }, { c: 'ink', t: 'Null distribution' }];
  };

  F.abtest = (g, r) => {
    const X = (v) => (v - 0.11) * 100 * 1.3;
    const sA = 0.008, mA = 0.100, mB = 0.121, sB = 0.0085, sc = 0.0085 * 7;
    [[mA, sA, -1.2, 'b', 'A'], [mB, sB, 1.2, 'acc', 'B']].forEach(([m, s, z, c, lab]) => {
      const f = (x) => npdf(x / 130 + 0.11, m, s) * sc;
      axes(g, -4.8, 4.8, z, 0, { o: 0.35 });
      g.add(ffill(f, -4.8, 4.8, z, { c, fill: 0.2 }));
      g.add(fcurve(f, -4.8, 4.8, z, { c, w: 2.2 }));
      g.add(vline(X(m), 0, f(X(m)) + 0.3, z, { c, o: 0.8 }));
      g.add(K.label(lab, [X(m), f(X(m)) + 0.65, z], { size: 0.46, c }));
    });
    g.add(K.arrow([X(mA), 4.3, 0], [X(mB), 4.3, 0], { w: 1.4, o: 0.7, head: 0.2 }));
    g.add(K.label('Δ', [(X(mA) + X(mB)) / 2, 4.65, 0], { size: 0.4, o: 0.8 }));
    return [{ c: 'b', t: 'Variant A (control)' }, { c: 'acc', t: 'Variant B' }];
  };

  F.kldiv = (g) => {
    const X = 1.15, P = (x) => npdf(x / X, -0.6, 0.85), Q = (x) => npdf(x / X, 0.9, 1.3), sc = 5;
    axes(g, -4.6, 4.6, -1.4, 0, { o: 0.35 });
    g.add(fcurve((x) => P(x) * sc, -4.6, 4.6, -1.4, { w: 2 }));
    g.add(fcurve((x) => Q(x) * sc, -4.6, 4.6, -1.4, { w: 1.6, dash: true, o: 0.7 }));
    g.add(K.label('P', [-0.6 * X, P(-0.6 * X) * sc + 0.4, -1.4], { size: 0.42 }));
    g.add(K.label('Q', [2.6, Q(2.6) * sc + 0.35, -1.4], { size: 0.42, o: 0.7 }));
    const I = (x) => { const p = P(x), q = Q(x); return p * Math.log(p / q) * 4.2; };
    axes(g, -4.6, 4.6, 1.4, 0, { o: 0.5 });
    g.add(ffill(I, -4.6, 4.6, 1.4, { fill: 0.35, n: 120 }));
    g.add(fcurve(I, -4.6, 4.6, 1.4, { c: 'acc', w: 2.2, n: 120 }));
    g.add(K.label('D_KL(P ‖ Q) = ∫ p·log(p/q)', [-3.2, 3.9, 1.4], { size: 0.36, c: 'acc' }));
    return [{ c: 'acc', t: 'Divergence density' }, { c: 'ink', t: 'P and Q' }];
  };

  F.mutualinfo = (g) => {
    const R = 2.2, cx = 1.2, cy = R + 0.1, D = 0.5;
    [-cx, cx].forEach((x) => {
      g.add(K.line(circ(x, cy, 0, R, 'xy', 96), { w: 1.8 }));
      const sh = new T.Shape(circ(x, cy, 0, R, 'xy', 64).map((q) => new T.Vector2(q[0], q[1])));
      g.add(new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: K.colorOf('ink'), transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false })));
    });
    const h = Math.sqrt(R * R - cx * cx), a = Math.atan2(h, cx), lens = [];
    lin(-a, a, 30).forEach((t) => lens.push([-cx + R * Math.cos(t), cy + R * Math.sin(t)]));
    lin(Math.PI - a, Math.PI + a, 30).forEach((t) => lens.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]));
    const sh = new T.Shape(lens.map(([x, y]) => new T.Vector2(x, y)));
    const m = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false }), new T.MeshBasicMaterial({ color: K.colorOf('acc'), transparent: true, opacity: 0.45, depthWrite: false }));
    g.add(m);
    const front = lens.map(([x, y]) => [x, y, D]); front.push(front[0]);
    g.add(K.line(front, { c: 'acc', w: 2 }));
    g.add(K.segs([[[0, cy + h, 0], [0, cy + h, D]], [[0, cy - h, 0], [0, cy - h, D]], [[R - cx, cy, 0], [R - cx, cy, D]], [[cx - R, cy, 0], [cx - R, cy, D]]], { c: 'acc', o: 0.6 }));
    g.add(K.label('I(X;Y)', [0, cy, D + 0.1], { size: 0.4, c: 'acc', weight: 600 }));
    g.add(K.label('H(X)', [-cx - R * 0.5, cy + R + 0.4, 0], { size: 0.42 }));
    g.add(K.label('H(Y)', [cx + R * 0.5, cy + R + 0.4, 0], { size: 0.42 }));
    g.add(K.label('H(X|Y)', [-cx - 1.15, cy + 0.5, 0], { size: 0.34, o: 0.6 }));
    g.add(K.label('H(Y|X)', [cx + 1.15, cy + 0.5, 0], { size: 0.34, o: 0.6 }));
    return [{ c: 'acc', t: 'Shared information' }];
  };

  F.montecarlo = (g, r) => {
    const S = 5, x0 = -2.5, z0 = 2.5, N = 700;
    g.add(K.rect(0, 0, 0, S, S, 'xz', { w: 1.4, o: 0.7 }));
    const arc = lin(0, Math.PI / 2, 60).map((a) => [x0 + S * Math.cos(a), 0, z0 - S * Math.sin(a)]);
    g.add(K.line(arc, { c: 'acc', w: 2 }));
    const P = samp(r, N, (q) => [q(), q()]);
    const inn = P.filter(([u, v]) => u * u + v * v < 1);
    g.add(K.dots(inn.map(([u, v]) => [x0 + S * u, 0, z0 - S * v]), { r: 0.045, c: 'acc' }));
    g.add(K.dots(P.filter(([u, v]) => u * u + v * v >= 1).map(([u, v]) => [x0 + S * u, 0, z0 - S * v]), { r: 0.045, o: 0.45 }));
    // running estimate on a back wall
    const Zb = -3.3; let k = 0; const pts = [];
    P.forEach(([u, v], i) => { if (u * u + v * v < 1) k++; if (i >= 9) pts.push([-2.5 + 5 * i / (N - 1), 1.6 + (4 * k / (i + 1) - Math.PI) * 2.2, Zb]); });
    g.add(K.line(pts.map((p) => [p[0], Math.max(0.2, Math.min(3, p[1])), p[2]]), { w: 1.2, o: 0.6 }));
    g.add(K.line([[-2.5, 1.6, Zb], [2.5, 1.6, Zb]], { w: 1, dash: true, o: 0.5 }));
    g.add(K.label('π', [-3, 1.6, Zb], { size: 0.42, o: 0.8 }));
    g.add(K.label('π ≈ 4 · ' + (inn.length / N).toFixed(3) + ' = ' + (4 * inn.length / N).toFixed(2), [0, 3.6, Zb], { size: 0.38, c: 'acc' }));
    return [{ c: 'acc', t: 'Samples inside' }];
  };

  F.markovchain = (g, r) => {
    const N = [[-2.8, 0.9], [2.8, 0.9], [0, 4.6]], names = ['A', 'B', 'C'], R = 0.6;
    const P = [[0.5, 0.3, 0.2], [0.1, 0.6, 0.3], [0.4, 0.2, 0.4]];
    const cen = [0, (0.9 + 0.9 + 4.6) / 3];
    N.forEach(([x, y], i) => {
      g.add(K.line(circ(x, y, 0, R, 'xy'), { w: 1.8 }));
      g.add(new T.Mesh(new T.ShapeGeometry(new T.Shape(circ(x, y, 0, R, 'xy', 40).map((q) => new T.Vector2(q[0], q[1])))), new T.MeshBasicMaterial({ color: K.colorOf('ink'), transparent: true, opacity: 0.06, side: T.DoubleSide, depthWrite: false })));
      g.add(K.label(names[i], [x, y, 0.05], { size: 0.46 }));
    });
    const paths = {};
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const [ax, ay] = N[i], [bx, by] = N[j];
      let pts;
      if (i === j) {
        let ox = ax - cen[0], oy = ay - cen[1]; const l = Math.hypot(ox, oy); ox /= l; oy /= l;
        const c = [ax + ox * (R + 0.35), ay + oy * (R + 0.35)], a0 = Math.atan2(-oy, -ox);
        pts = lin(a0 + 0.9, a0 + 2 * Math.PI - 0.9, 40).map((t) => K.V(c[0] + 0.48 * Math.cos(t), c[1] + 0.48 * Math.sin(t), 0));
        g.add(K.label(String(P[i][j]), [ax + ox * (R + 1.25), ay + oy * (R + 1.25), 0], { size: 0.32, o: 0.7 }));
      } else {
        let dx = bx - ax, dy = by - ay; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const px = -dy, py = dx;
        const A = K.V(ax + dx * R + px * 0.15, ay + dy * R + py * 0.15, 0), B = K.V(bx - dx * R + px * 0.15, by - dy * R + py * 0.15, 0);
        const C = K.V((ax + bx) / 2 + px * 0.7, (ay + by) / 2 + py * 0.7, 0);
        pts = new T.QuadraticBezierCurve3(A, C, B).getPoints(40);
        g.add(K.label(String(P[i][j]), [(ax + bx) / 2 + px * 0.95, (ay + by) / 2 + py * 0.95, 0], { size: 0.32, o: 0.7 }));
      }
      paths[i + '' + j] = pts;
      g.add(K.line(pts.slice(0, pts.length - 3), { w: 1.2, o: 0.5 }));
      g.add(K.arrow(pts[pts.length - 6], pts[pts.length - 1], { w: 1.2, o: 0.5, head: 0.24 }));
    }
    let s = 0; const seq = [0];
    for (let k = 0; k < 6; k++) { let u = r(), j = 0; while (j < 2 && u > P[s][j]) { u -= P[s][j]; j++; } s = j; seq.push(s); }
    const hops = []; for (let k = 0; k < 6; k++) hops.push(paths[seq[k] + '' + seq[k + 1]]);
    const hl = hops.map((h, i) => { const l = K.line(h, { c: 'acc', w: 2.6 }); l.position.z = 0.02; l.visible = i === 0; g.add(l); return l; });
    const dot = K.dots([[0, 0, 0]], { r: 0.17, c: 'acc' }); g.add(dot);
    dot.position.copy(hops[0][Math.round(hops[0].length / 2)]);
    const tick = (t) => {
      const u = (t % 6), k = Math.floor(u), f = K.ease(u - k), h = hops[k];
      hl.forEach((l, i) => { l.visible = i === k; });
      dot.position.copy(h[Math.min(h.length - 1, Math.round(f * (h.length - 1)))]);
    };
    return { legend: [{ c: 'acc', t: 'Current transition' }], tick };
  };

  F.causation = (g, r) => {
    const w = 3.6, h = 3.2;
    [[-2.3, -1.0, false], [2.3, 1.0, true]].forEach(([cx, z, doX]) => {
      g.add(K.line([[cx - w / 2, h, z], [cx - w / 2, 0, z], [cx + w / 2, 0, z]], { o: 0.5, w: 1 }));
      const P = samp(r, 30, (q) => { const x = doX ? q.range(-1, 1) : q.n() * 0.5; const y = doX ? q.n() * 0.25 : 0.85 * x + q.n() * 0.22; return [cx + x * 1.5, h / 2 + y * 1.5, z]; })
        .filter((p) => Math.abs(p[0] - cx) < w / 2 - 0.1 && p[1] > 0.1 && p[1] < h - 0.1);
      g.add(K.dots(P, { r: 0.07, o: doX ? 0.6 : 1 }));
      if (doX) {
        g.add(K.line([[cx - 1.6, h / 2, z], [cx + 1.6, h / 2, z]], { c: 'acc', w: 2.4 }));
        g.add(K.label('P(Y | do(X))', [cx, h + 0.45, z], { size: 0.36, c: 'acc' }));
        g.add(K.segs(lin(-1, 1, 6).map((x) => [[cx + x * 1.5, -0.25, z], [cx + x * 1.5, 0, z]]), { c: 'acc', w: 1.4 }));
      } else {
        g.add(K.line([[cx - 1.3, h / 2 - 1.1, z], [cx + 1.3, h / 2 + 1.1, z]], { w: 2 }));
        g.add(K.label('P(Y | X)', [cx, h + 0.45, z], { size: 0.36, o: 0.85 }));
      }
      g.add(K.label('X', [cx + w / 2 + 0.3, 0, z], { size: 0.34, o: 0.65 }));
      g.add(K.label('Y', [cx - w / 2, h + 0.3, z], { size: 0.34, o: 0.65 }));
    });
    return [{ c: 'acc', t: 'Effect of intervening' }, { c: 'ink', t: 'Observed correlation' }];
  };

  F.confounder = (g, r) => {
    // DAG behind and above
    const Zd = -2.2, NZ = [0, 5.0, Zd], NX = [-2.4, 3.6, Zd], NY = [2.4, 3.6, Zd], R = 0.38;
    [[NZ, 'Z', 'acc'], [NX, 'X', 'ink'], [NY, 'Y', 'ink']].forEach(([p, l, c]) => { g.add(K.line(circ(p[0], p[1], p[2], R, 'xy'), { c, w: 1.8 })); g.add(K.label(l, p, { size: 0.38, c })); });
    const toward = (a, b, d) => { const v = K.V(b[0] - a[0], b[1] - a[1], 0).normalize(); return [[a[0] + v.x * d, a[1] + v.y * d, Zd], [b[0] - v.x * d, b[1] - v.y * d, Zd]]; };
    let [a, b] = toward(NZ, NX, R + 0.08); g.add(K.arrow(a, b, { c: 'acc', w: 2 }));
    [a, b] = toward(NZ, NY, R + 0.08); g.add(K.arrow(a, b, { c: 'acc', w: 2 }));
    [a, b] = toward(NX, NY, R + 0.08); g.add(K.arrow(a, b, { w: 1.2, o: 0.4, dash: true }));
    g.add(K.label('?', [0, 3.25, Zd], { size: 0.4, o: 0.6 }));
    // scatter: two strata of Z, flat within each
    const Zs = 1.2;
    g.add(K.line([[-4, 2.9, Zs], [-4, 0, Zs], [4, 0, Zs]], { o: 0.5, w: 1 }));
    const g1 = samp(r, 18, (q) => [q.range(-3.6, -0.6), 0.7 + q.n() * 0.2]), g2 = samp(r, 18, (q) => [q.range(0.6, 3.6), 2.1 + q.n() * 0.2]);
    g.add(K.dots(g1.map(([x, y]) => [x, y, Zs]), { r: 0.08, o: 0.8 }));
    g.add(K.dots(g2.map(([x, y]) => [x, y, Zs]), { r: 0.1, hollow: true, o: 0.8 }));
    g.add(K.line([[-3.6, 0.7, Zs], [-0.6, 0.7, Zs]], { w: 1.6, o: 0.75 }));
    g.add(K.line([[0.6, 2.1, Zs], [3.6, 2.1, Zs]], { w: 1.6, o: 0.75 }));
    g.add(K.line([[-3.8, 0.25, Zs], [3.8, 2.6, Zs]], { w: 1.2, o: 0.4, dash: true }));
    g.add(K.label('X', [4.35, 0, Zs], { size: 0.34, o: 0.65 }));
    g.add(K.label('Y', [-4, 3.25, Zs], { size: 0.34, o: 0.65 }));
    return [{ c: 'acc', t: 'Confounder Z' }];
  };

  F.samplingbias = (g, r) => {
    const P = samp(r, 320, (q) => [q.n() * 1.3, q.n() * 1.1]).filter(([x, z]) => Math.abs(x) < 4.2 && Math.abs(z) < 3);
    const sel = [], rest = [];
    P.forEach((p) => { const pr = 1 / (1 + Math.exp(-(p[0] - 1.0) * 3)); (r() < pr * 0.8 ? sel : rest).push(p); });
    g.add(K.rect(0, 0, 0, 8.8, 6.4, 'xz', { o: 0.3 }));
    g.add(K.dots(rest.map(([x, z]) => [x, 0, z]), { r: 0.06, o: 0.4 }));
    g.add(K.dots(sel.map(([x, z]) => [x, 0, z]), { r: 0.08, c: 'acc' }));
    // back wall: distributions of x
    const Zb = -3.6, sc = 5;
    const mP = meanOf(P.map((p) => p[0])), sP = sdOf(P.map((p) => p[0])), mS = meanOf(sel.map((p) => p[0])), sS = sdOf(sel.map((p) => p[0]));
    axes(g, -4.4, 4.4, Zb, 0, { o: 0.4 });
    g.add(fcurve((x) => npdf(x, mP, sP) * sc, -4.4, 4.4, Zb, { w: 1.8, o: 0.7 }));
    g.add(ffill((x) => npdf(x, mS, sS) * sc * 0.75, -4.4, 4.4, Zb, { fill: 0.2 }));
    g.add(fcurve((x) => npdf(x, mS, sS) * sc * 0.75, -4.4, 4.4, Zb, { c: 'acc', w: 2.2 }));
    g.add(vline(mP, 0, npdf(0, 0, sP) * sc + 0.3, Zb, { o: 0.6 }));
    g.add(vline(mS, 0, npdf(0, 0, sS) * sc * 0.75 + 0.3, Zb, { c: 'acc' }));
    g.add(K.label('μ', [mP, npdf(0, 0, sP) * sc + 0.6, Zb], { size: 0.38, o: 0.7 }));
    g.add(K.label('μ̂', [mS, npdf(0, 0, sS) * sc * 0.75 + 0.6, Zb], { size: 0.38, c: 'acc' }));
    return [{ c: 'acc', t: 'Biased sample' }, { c: 'ink', t: 'Population' }];
  };

  F.heterosked = (g, r) => {
    const sd = (x) => 0.12 + 0.17 * (x + 4.2), mY = (x) => 1.6 + 0.3 * x;
    g.add(K.line([[-4.4, 4.4, 0], [-4.4, -0.6, 0], [4.6, -0.6, 0]], { o: 0.45, w: 1 }));
    const P = samp(r, 110, (q) => { const x = q.range(-4.1, 4.1); return [x, mY(x) + q.n() * sd(x), 0]; }).filter((p) => p[1] > -0.5 && p[1] < 4.4);
    g.add(K.dots(P, { r: 0.06 }));
    g.add(K.line([[-4.2, mY(-4.2), 0], [4.2, mY(4.2), 0]], { w: 1.6, o: 0.8 }));
    g.add(K.line(lin(-4.2, 4.2, 30).map((x) => [x, mY(x) + 2 * sd(x), 0]), { c: 'acc', w: 1.8 }));
    g.add(K.line(lin(-4.2, 4.2, 30).map((x) => [x, mY(x) - 2 * sd(x), 0]), { c: 'acc', w: 1.8 }));
    // residual densities at three x positions, drawn in the y-z plane
    [-3, 0, 3].forEach((x0) => {
      const s = sd(x0), m = mY(x0);
      const pts = lin(-2.6, 2.6, 50).map((u) => [x0, m + u * s, 0.08 + npdf(u) * 2.4]);
      g.add(K.line(pts, { c: 'acc', w: 1.4, o: 0.85 }));
      g.add(K.line([[x0, m - 2.6 * s, 0.08], [x0, m + 2.6 * s, 0.08]], { o: 0.35, w: 1 }));
    });
    g.add(K.label('x', [4.9, -0.6, 0], { size: 0.36, o: 0.65 }));
    g.add(K.label('y', [-4.4, 4.75, 0], { size: 0.36, o: 0.65 }));
    return [{ c: 'acc', t: 'Growing error spread' }];
  };

  const SEEDS = {};
  const ROT = { covariance: 0, corrmatrix: 0.15, condprob: 0, mutualinfo: 0.3, montecarlo: 0, markovchain: 0.4, samplingbias: 0.3, variance: 0, uniformdist: 0.45 };
  VIZ.zstat = function (p, k) {
    K = k; T = k.THREE;
    const g = new T.Group();
    const kind = p.kind, fn = F[kind];
    if (!fn) { g.add(K.box(0, 0, 0, 3, 3, 3, { o: 0.3 })); return { g, legend: [] }; }
    let h = 7; for (const ch of kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = K.rng(SEEDS[kind] || h);
    const out = fn(g, r, p);
    const rot = ROT[kind] == null ? 0.5 : ROT[kind];
    const gg = rot ? (() => { const o = new T.Group(); g.rotation.y = rot; o.add(g); return o; })() : g;
    const ctl = kind === 'poisson' ? [{ key: 'lambda', label: 'λ', min: 0.5, max: 8, step: 0.5, value: 3 }]
      : kind === 'stderr' ? [{ key: 'n', label: 'n', min: 2, max: 50, step: 1, value: 10 }] : undefined;
    if (Array.isArray(out)) return { g: gg, legend: out, ctl };
    return { g: gg, legend: out.legend, tick: out.tick, ctl };
  };
})();
