/* Latent Atlas — viz-b: bars, curves, act, quant */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------- shared helpers ---------- */
  const ST = {
    ink: { fill: 0.08, o: 0.55 },
    faint: { fill: 0.035, o: 0.22 },
    ghost: { fill: 0.0, o: 0.16 },
    acc: { fill: 0.7, fc: 'acc', c: 'acc', o: 0.95 },
    accL: { fill: 0.35, fc: 'acc', c: 'acc', o: 0.85 },
    b: { fill: 0.6, fc: 'b', c: 'b', o: 0.95 },
  };
  function bar(g, x, z, bw, h, d, st, y0) {
    if (Math.abs(h) < 1e-3) return;
    y0 = y0 || 0;
    g.add(K.box(x, y0 + h / 2, z, bw, Math.abs(h), d, st));
  }
  function lab(g, t, p, o) { g.add(K.label(t, p, Object.assign({ size: 0.34, o: 0.8 }, o || {}))); }
  function hline(g, x0, x1, y, z, o) { g.add(K.line([[x0, y, z], [x1, y, z]], Object.assign({ o: 0.45, w: 1 }, o || {}))); }
  function vline(g, x, y0, y1, z, o) { g.add(K.line([[x, y0, z], [x, y1, z]], Object.assign({ o: 0.45, w: 1 }, o || {}))); }
  function rails(g, xs, z0, z1, o) { g.add(K.segs(xs.map((x) => [[x, 0, z0], [x, 0, z1]]), { o: o || 0.16 })); }
  function hist(vals, lo, hi, nb) {
    const c = new Array(nb).fill(0);
    vals.forEach((v) => { let i = Math.floor((v - lo) / (hi - lo) * nb); if (i === nb) i = nb - 1; if (i >= 0 && i < nb) c[i]++; });
    return c;
  }
  function histBars(g, counts, o) {
    const nb = counts.length, bw = (o.x1 - o.x0) / nb, m = o.max || Math.max(...counts);
    counts.forEach((c, i) => {
      const s = o.stFn ? o.stFn(i, c) : o.st;
      if (!s) return;
      bar(g, o.x0 + bw * (i + 0.5), o.z, bw * (o.gap == null ? 0.8 : o.gap), o.h * c / m, o.d == null ? 0.5 : o.d, s, o.y0);
    });
  }
  function area2(top, bot, o) {
    const pos = [];
    for (let i = 0; i < top.length - 1; i++) {
      const a = top[i], b = top[i + 1], c = bot[i], d = bot[i + 1];
      pos.push(c[0], c[1], c[2], d[0], d[1], d[2], b[0], b[1], b[2], c[0], c[1], c[2], b[0], b[1], b[2], a[0], a[1], a[2]);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    return new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.o, side: T.DoubleSide, depthWrite: false }));
  }
  function area(pts, y0, o) { return area2(pts, pts.map((p) => [p[0], y0, p[2]]), o); }
  function quad(a, b, c, d, o) { return area2([a, b], [d, c], o); }
  /* map a 2D plot range to a vertical plane at depth z */
  function mapper(xr, yr, W, H, z, xoff, yoff) {
    xoff = xoff || 0; yoff = yoff || 0;
    return (u, v) => [xoff - W / 2 + W * (u - xr[0]) / (xr[1] - xr[0]), yoff + H * (v - yr[0]) / (yr[1] - yr[0]), z];
  }
  function samp(f, a, b, n) { const out = []; for (let i = 0; i <= n; i++) { const t = a + (b - a) * i / n; out.push([t, f(t)]); } return out; }
  function plot(g, M, uv, o) { g.add(K.line(uv.map(([u, v]) => M(u, v)), Object.assign({ w: 2 }, o || {}))); }
  function axesL(g, M, xr, yr, o) {
    o = o || {};
    g.add(K.line([M(xr[0], yr[0]), M(xr[1], yr[0])], { o: o.o == null ? 0.45 : o.o, w: 1 }));
    g.add(K.line([M(xr[0], yr[0]), M(xr[0], yr[1])], { o: o.o == null ? 0.45 : o.o, w: 1 }));
  }
  function stairs(vals, M) { // step function points from [[u,v],...]
    const pts = [];
    for (let i = 0; i < vals.length; i++) {
      const [u, v] = vals[i];
      if (i > 0) pts.push(M(u, vals[i - 1][1]));
      pts.push(M(u, v));
    }
    return pts;
  }
  function turn(g, a) { const o = new T.Group(); g.rotation.y = a; o.add(g); return o; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sig = (x) => 1 / (1 + Math.exp(-x));
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

  /* =====================================================================
     BARS
     ===================================================================== */
  const BARS = {};
  const BROT = { shap: 0.55, hist3: 0.5, bench: 0.45, importance: 0.45 };

  /* EDA: three quick looks at a dataset, each revealing a problem (accent) */
  BARS.hist3 = function (p, g) {
    const r = K.rng(11), H = 3.4, PW = 3.0;
    const P = [{ cx: -3.7, z: -0.8 }, { cx: 0, z: 0 }, { cx: 3.7, z: 0.8 }];
    const base = (k) => { const { cx, z } = P[k]; hline(g, cx - PW / 2 - 0.1, cx + PW / 2 + 0.1, 0, z, { o: 0.4 }); };
    // 1) skewed histogram: long right tail
    {
      const { cx, z } = P[0], nb = 11;
      const v = Array.from({ length: 900 }, () => Math.exp(r.n() * 0.55));
      const c = hist(v, 0, 5, nb).map((n) => Math.pow(n, 0.55));
      histBars(g, c, { x0: cx - PW / 2, x1: cx + PW / 2, z, h: H, d: 0.45, gap: 0.82, stFn: (i, n) => (n ? (i >= 5 ? ST.acc : ST.ink) : null) });
      for (let i = 5; i < nb; i++) if (c[i] < 4) bar(g, cx - PW / 2 + PW / nb * (i + 0.5), z, PW / nb * 0.82, 0.1, 0.45, ST.acc);
      base(0);
      lab(g, 'x₁', [cx, -0.5, z], { o: 0.65 });
    }
    // 2) box plot with outliers
    {
      const { cx, z } = P[1], S = 0.5, y = (v) => 1.5 + v * S;
      const q1 = -0.67, q3 = 0.67, md = 0.05, lo = -2.0, hi = 2.0;
      g.add(K.box(cx + 0.3, (y(q1) + y(q3)) / 2, z, 1.1, y(q3) - y(q1), 0.45, ST.ink));
      g.add(K.line([[cx - 0.25, y(md), z + 0.23], [cx + 0.85, y(md), z + 0.23]], { w: 2.2 }));
      vline(g, cx + 0.3, y(lo), y(q1), z, { o: 0.7, w: 1.4 }); vline(g, cx + 0.3, y(q3), y(hi), z, { o: 0.7, w: 1.4 });
      hline(g, cx + 0.02, cx + 0.58, y(lo), z, { o: 0.7, w: 1.4 }); hline(g, cx + 0.02, cx + 0.58, y(hi), z, { o: 0.7, w: 1.4 });
      const pts = [];
      for (let i = 0; i < 30; i++) pts.push([cx - 0.9 + r.range(-0.18, 0.18), y(clamp(r.n() * 0.9, lo, hi)), z]);
      g.add(K.dots(pts, { r: 0.05, o: 0.4 }));
      g.add(K.dots([[cx + 0.3, y(3.5), z], [cx + 0.42, y(3.95), z], [cx + 0.25, y(-2.8), z]], { r: 0.12, c: 'acc' }));
      base(1);
      lab(g, 'x₂', [cx, -0.5, z], { o: 0.65 });
    }
    // 3) missing-value map: rows × columns, one column full of gaps
    {
      const { cx, z } = P[2], nc = 5, nr = 12, cw = PW / nc, ch = H / nr;
      const ok = [], gap = [];
      for (let j = 0; j < nc; j++) for (let i = 0; i < nr; i++) {
        const miss = j === 3 ? r() < 0.55 : r() < 0.04;
        (miss ? gap : ok).push([cx - PW / 2 + cw * (j + 0.5), ch * (i + 0.5), z]);
      }
      ok.forEach((q) => g.add(K.rect(q[0], q[1], q[2], cw * 0.8, ch * 0.72, 'xy', { o: 0.35, fill: 0.12 })));
      gap.forEach((q) => g.add(K.rect(q[0], q[1], q[2], cw * 0.8, ch * 0.72, 'xy', { c: 'acc', o: 0.9, fill: 0.6, fc: 'acc' })));
      base(2);
      lab(g, 'NaN', [cx - PW / 2 + cw * 3.5, H + 0.35, z], { c: 'acc', size: 0.34, mono: true });
    }
    return [{ c: 'acc', t: 'Problems found' }];
  };

  /* Min-max: same shape, raw range [min, max] (top) squeezed onto [0, 1] (bottom) */
  BARS.scale = function (p, g) {
    const r = K.rng(3), N = 900, nb = 14, H = 2.3;
    const v = Array.from({ length: N }, () => (r() < 0.62 ? 38 + r.n() * 7 : 64 + r.n() * 6));
    const lo = Math.min(...v), hi = Math.max(...v);
    const c = hist(v, lo, hi, nb), m = Math.max(...c);
    const zb = -1.0, zf = 1.0, yT = 3.3, R0 = -4.2, R1 = 4.2, F0 = -1.5, F1 = 1.5;
    histBars(g, c, { x0: R0, x1: R1, z: zb, y0: yT, h: H, d: 0.45, max: m, gap: 0.8, st: ST.ink });
    histBars(g, c, { x0: F0, x1: F1, z: zf, h: H, d: 0.45, max: m, gap: 0.8, st: ST.acc });
    hline(g, R0 - 0.2, R1 + 0.2, yT, zb, { o: 0.45 }); hline(g, F0 - 0.4, F1 + 0.4, 0, zf, { o: 0.45 });
    [R0, R1].forEach((x) => vline(g, x, yT - 0.18, yT + 0.18, zb, { o: 0.8, w: 1.4 }));
    [F0, F1].forEach((x) => vline(g, x, -0.18, 0.18, zf, { c: 'acc', w: 1.6, o: 1 }));
    // min -> 0, max -> 1
    g.add(K.arrow([R0, yT - 0.25, zb], [F0, 0.25, zf], { c: 'acc', w: 1.5, o: 0.8, dash: true }));
    g.add(K.arrow([R1, yT - 0.25, zb], [F1, 0.25, zf], { c: 'acc', w: 1.5, o: 0.8, dash: true }));
    lab(g, 'min', [R0 - 0.6, yT, zb], { size: 0.34, o: 0.75, mono: true });
    lab(g, 'max', [R1 + 0.65, yT, zb], { size: 0.34, o: 0.75, mono: true });
    lab(g, '0', [F0, -0.5, zf], { c: 'acc', size: 0.44 });
    lab(g, '1', [F1, -0.5, zf], { c: 'acc', size: 0.44 });
    lab(g, 'x', [R0 + 0.2, yT + H * 0.7, zb], { o: 0.6 });
    lab(g, 'x′', [F0 - 0.5, H * 0.7, zf], { c: 'acc' });
    return [{ c: 'acc', t: 'Rescaled to [0, 1]' }, { c: 'ink', t: 'Original range' }];
  };

  BARS.robust = function (p, g) {
    const r = K.rng(5), N = 500;
    const s = Array.from({ length: N }, () => r.n());
    const sorted = s.slice().sort((a, b) => a - b);
    const q = (t) => sorted[Math.floor(t * (N - 1))];
    const med = q(0.5), iqr = q(0.75) - q(0.25);
    const OUT = 26;
    // raw: x = -2 + v*0.55
    const layers = [
      { z: -2.6, map: (v) => -2.2 + v * 0.55, st: ST.faint, outX: 4.1 },
      { z: 0, map: (v) => -4 + 8 * (v - sorted[0]) / (OUT - sorted[0]), st: ST.faint, outX: 4 },
      { z: 2.6, map: (v) => (v - med) / iqr * 1.05, st: ST.acc, outX: 4.1 },
    ];
    const nb = 34, lo = -4, hi = 4.4, bw = (hi - lo) / nb;
    layers.forEach((L, k) => {
      const c = new Array(nb).fill(0);
      s.forEach((v) => { const i = Math.floor((L.map(v) - lo) / bw); if (i >= 0 && i < nb) c[i]++; });
      const m = Math.max(...c);
      c.forEach((n, i) => { if (n) bar(g, lo + bw * (i + 0.5), L.z, bw * 0.78, 2.6 * n / m, 0.5, L.st); });
      // outlier
      bar(g, L.outX, L.z, bw * 0.78, 0.25, 0.5, ST.ink);
      g.add(K.dots([[L.outX, 0.55, L.z]], { r: 0.08, hollow: true }));
      hline(g, -4.3, 4.5, 0, L.z, { o: 0.28 });
    });
    // break marks: outlier is really far away on raw & robust axes
    [-2.6, 2.6].forEach((z) => g.add(K.segs([[[3.55, -0.15, z], [3.7, 0.15, z]], [[3.7, -0.15, z], [3.85, 0.15, z]]], { o: 0.5 })));
    // median and IQR on the robust layer
    const zf = 2.6 + 0.6;
    vline(g, 0, 0, 3.0, 2.6, { c: 'acc', o: 0.7, dash: true, w: 1.2 });
    g.add(K.line([[-0.5 * iqr / iqr * 1.05, -0.25, zf], [0.5 * 1.05, -0.25, zf]], { c: 'acc', w: 2.2 }));
    g.add(K.segs([[[-0.525, -0.38, zf], [-0.525, -0.12, zf]], [[0.525, -0.38, zf], [0.525, -0.12, zf]]], { c: 'acc', w: 2 }));
    lab(g, 'IQR', [0, -0.68, zf], { c: 'acc', size: 0.3 });
    lab(g, '0', [0, 3.3, 2.6], { c: 'acc', size: 0.32 });
    lab(g, 'x', [-4.9, 0.3, -2.6], { o: 0.5 });
    rails(g, [-4.3, 4.5], -2.9, 2.9);
    return [{ c: 'acc', t: 'Median / IQR scaled' }, { c: 'ink', t: 'Outlier' }];
  };

  BARS.skew = function (p, g) {
    const r = K.rng(9), N = 1200, nb = 26;
    const x = Array.from({ length: N }, () => Math.exp(r.n() * 0.85 + 0.3));
    histBars(g, hist(x, 0, 12, nb), { x0: -4, x1: 4, z: -2.2, h: 3.4, d: 0.6, st: ST.ink });
    histBars(g, hist(x.map(Math.log), -2.6, 3.2, nb), { x0: -4, x1: 4, z: 2.2, h: 3.0, d: 0.6, st: ST.acc });
    hline(g, -4.1, 4.1, 0, -2.2, { o: 0.35 }); hline(g, -4.1, 4.1, 0, 2.2, { o: 0.35 });
    lab(g, 'x', [-4.6, 0.3, -2.2], { o: 0.6 });
    lab(g, 'log x', [-4.9, 0.3, 2.2], { c: 'acc' });
    rails(g, [-4.1, 4.1], -2.5, 2.5);
    return [{ c: 'acc', t: 'Log-transformed' }, { c: 'ink', t: 'Raw skewed feature' }];
  };

  /* Box-Cox: skewed raw feature (top) -> transform with λ (bottom); the right λ makes it near-symmetric */
  BARS.boxcox = function (p, g) {
    const r = K.rng(21), N = 1400, nb = 22, H = 2.4, BEST = 0.5, yT = 3.3;
    const x = Array.from({ length: N }, () => Math.pow(Math.max(0.05, 1 + r.n() * 0.33), 2));
    const lam = clamp(p.lambda == null ? BEST : +p.lambda, -1, 2);
    const bc = (v, l) => (Math.abs(l) < 1e-9 ? Math.log(v) : (Math.pow(v, l) - 1) / l);
    const rng = (a) => { const s = a.slice().sort((u, w) => u - w); return [s[3], s[N - 4]]; };
    const panel = (a, z, y0, st) => { const [lo, hi] = rng(a); histBars(g, hist(a, lo, hi, nb), { x0: -3.6, x1: 3.6, z, y0, h: H, d: 0.45, st }); hline(g, -3.8, 3.8, y0, z, { o: 0.45 }); };
    const t = x.map((v) => bc(v, lam));
    const good = Math.abs(lam - BEST) < 0.13;
    panel(x, -1.0, yT, ST.ink);
    panel(t, 1.0, 0, good ? ST.acc : ST.ink);
    // median guide on the transformed panel: centred when symmetric
    const s = t.slice().sort((u, w) => u - w), [lo, hi] = rng(t), md = s[N >> 1];
    vline(g, -3.6 + 7.2 * (md - lo) / (hi - lo), 0, H + 0.3, 1.0, { c: good ? 'acc' : 'ink', o: 0.7, dash: true, w: 1.2 });
    g.add(K.arrow([-4.3, yT - 0.15, -1.0], [-4.3, 0.6, 1.0], { o: 0.45, w: 1.2 }));
    lab(g, 'x', [-4.35, yT + 0.4, -1.0], { o: 0.6 });
    lab(g, 'λ=' + (+lam.toFixed(2)), [-4.9, 0.25, 1.0], { c: good ? 'acc' : 'ink', size: 0.38 });
    return { legend: [{ c: 'acc', t: 'Best λ' }, { c: 'ink', t: 'Raw skewed feature' }], ctl: [{ key: 'lambda', label: 'λ', min: -1, max: 2, step: 0.25, value: lam }] };
  };

  BARS.target = function (p, g) {
    const r = K.rng(4);
    const means = [0.2, 0.7, 0.42, 0.88, 0.3], counts = [12, 8, 16, 8, 12];
    const names = ['a', 'b', 'c', 'd', 'e'];
    const H = 3.6;
    means.forEach((m, i) => {
      const x = -3.6 + 1.8 * i;
      const ones = Math.round(m * counts[i]);
      const idx = Array.from({ length: counts[i] }, (_, k) => k);
      for (let k = idx.length - 1; k > 0; k--) { const j = r.int(0, k); [idx[k], idx[j]] = [idx[j], idx[k]]; }
      const filled = [], hollow = [];
      idx.forEach((k, n) => {
        const pos = [x - 0.45 + 0.3 * (n % 4), 0.1, -3.2 + 0.36 * Math.floor(n / 4)];
        (k < ones ? filled : hollow).push(pos);
      });
      if (filled.length) g.add(K.dots(filled, { r: 0.085, o: 0.75 }));
      if (hollow.length) g.add(K.dots(hollow, { r: 0.085, hollow: true, o: 0.6 }));
      bar(g, x, 0.9, 0.8, m * H, 0.8, ST.acc);
      lab(g, names[i], [x, -0.4, 2.1], { size: 0.38, mono: true });
    });
    hline(g, -4.6, 4.6, 0, 0.9, { o: 0.35 });
    // y = 1 reference
    hline(g, -4.6, 4.6, H, 0.9, { o: 0.18, dash: true });
    lab(g, '1', [-4.9, H, 0.9], { o: 0.5, size: 0.3 });
    lab(g, 'ȳ', [-4.9, 1.6, 0.9], { c: 'acc', size: 0.42 });
    return [{ c: 'acc', t: 'Mean target per category' }];
  };

  BARS.freq = function (p, g) {
    const counts = [9, 5, 3, 2, 1], N = 20, u = 0.38;
    const names = ['a', 'b', 'c', 'd', 'e'];
    counts.forEach((c, i) => {
      const x = -3.6 + 1.8 * i;
      for (let k = 0; k < c; k++) g.add(K.box(x, u * (k + 0.5), -1.8, 0.62, u * 0.86, 0.62, ST.faint));
      bar(g, x, 1.4, 0.8, (c / N) * 7.2, 0.8, ST.acc);
      lab(g, (c / N).toFixed(2).replace(/^0/, ''), [x, (c / N) * 7.2 + 0.35, 1.4], { c: 'acc', size: 0.3 });
      lab(g, names[i], [x, -0.4, 2.6], { size: 0.38, mono: true });
    });
    hline(g, -4.6, 4.6, 0, 1.4, { o: 0.35 });
    hline(g, -4.6, 4.6, 0, -1.8, { o: 0.25 });
    rails(g, [-4.6, 4.6], -2.2, 1.8);
    return [{ c: 'acc', t: 'Category frequency' }, { c: 'ink', t: 'Occurrences' }];
  };

  BARS.imbalance = function (p, g) {
    const r = K.rng(8);
    const maj = [], min = [];
    for (let i = 0; i < 380; i++) maj.push([r.range(-4.2, 4.2), 0.08, r.range(-0.6, 3.4)]);
    for (let i = 0; i < 12; i++) min.push([2.2 + r.n() * 0.7, 0.08, 1.8 + r.n() * 0.6]);
    g.add(K.dots(maj, { r: 0.06, o: 0.55 }));
    g.add(K.dots(min, { r: 0.11, c: 'acc' }));
    bar(g, -1.1, -2.4, 1.2, 4.4, 1.0, ST.ink);
    bar(g, 1.1, -2.4, 1.2, 0.18, 1.0, ST.acc);
    lab(g, '97%', [-1.1, 4.8, -2.4], { size: 0.36 });
    lab(g, '3%', [1.1, 0.6, -2.4], { size: 0.36, c: 'acc' });
    hline(g, -4.3, 4.3, 0, -2.4, { o: 0.3 });
    g.add(K.rect(0, 0, 1.4, 8.6, 4.4, 'xz', { o: 0.15 }));
    return [{ c: 'acc', t: 'Minority class' }, { c: 'ink', t: 'Majority class' }];
  };

  BARS.weights = function (p, g) {
    const H = 4.2, ratio = 10;
    // before
    bar(g, -1.2, -1.5, 1.1, H, 0.9, ST.faint);
    bar(g, 1.2, -1.5, 1.1, H / ratio, 0.9, ST.faint);
    // after: minority up-weighted
    bar(g, -1.2, 1.5, 1.1, H, 0.9, ST.ink);
    g.add(K.box(1.2, H / ratio / 2, 1.5, 1.1, H / ratio, 0.9, { fill: 0.15, o: 0.6 }));
    bar(g, 1.2, 1.5, 1.1, H - H / ratio, 0.9, ST.acc, H / ratio);
    g.add(K.arrow([2.2, H / ratio + 0.1, 1.5], [2.2, H - 0.1, 1.5], { c: 'acc', w: 1.6 }));
    lab(g, '×w', [2.85, H * 0.55, 1.5], { c: 'acc', size: 0.42 });
    lab(g, 'w=1', [-1.2, H + 0.4, 1.5], { size: 0.3, o: 0.6 });
    hline(g, -2.4, 2.4, 0, -1.5, { o: 0.25 }); hline(g, -2.4, 2.4, 0, 1.5, { o: 0.35 });
    rails(g, [-2.4, 2.4], -2.1, 2.1);
    return [{ c: 'acc', t: 'Class-weighted minority' }];
  };

  /* Feature selection: rank features by score, keep the top subset above the cut (accent), drop the rest */
  BARS.importance = function (p, g) {
    const imp = [0.24, 0.21, 0.18, 0.13, 0.09, 0.06, 0.05, 0.04, 0.035, 0.03, 0.02, 0.015];
    const id = ['₂', '₈', '₅', '₁₁', '₄', '₁', '₉', '₇', '₁₂', '₃', '₆', '₁₀'];
    const n = imp.length, H = 15, th = 0.11, z = 0;
    const x = (i) => -4.4 + 0.8 * i;
    imp.forEach((v, i) => {
      const keep = v >= th;
      bar(g, x(i), z, 0.5, H * v, 0.5, keep ? ST.acc : ST.ghost);
      lab(g, 'x' + id[i], [x(i), -0.4, z + 0.45], keep ? { c: 'acc', size: 0.32 } : { size: 0.26, o: 0.35 });
    });
    hline(g, x(0) - 0.4, x(n - 1) + 0.4, 0, z, { o: 0.45 });
    hline(g, x(0) - 0.4, x(n - 1) + 0.4, H * th, z, { o: 0.6, dash: true, w: 1.2 });
    lab(g, 'τ', [x(n - 1) + 0.8, H * th, z], { size: 0.4, o: 0.75 });
    return [{ c: 'acc', t: 'Selected features' }, { c: 'ink', t: 'Dropped features' }];
  };

  /* MDI: each split's impurity decrease ΔI is credited to its feature; summed over all trees -> importance */
  BARS.mdi = function (p, g) {
    // three small trees: [feature, ΔI] for root, left, right
    const trees = [
      [[0, 0.30], [2, 0.08], [1, 0.12]],
      [[0, 0.25], [1, 0.10], [3, 0.05]],
      [[1, 0.20], [0, 0.15], [2, 0.06]],
    ];
    const zt = -1.6, ty = 3.4, RS = 0.85;
    const nodePos = (cx) => [[cx, ty + 1.7, zt], [cx - RS, ty + 0.8, zt], [cx + RS, ty + 0.8, zt]];
    const tot = [0, 0, 0, 0], parts = [[], [], [], []];
    trees.forEach((tr, t) => {
      const P = nodePos(-3.2 + 3.2 * t);
      const leaf = [];
      [1, 2].forEach((c) => { leaf.push([P[c][0] - 0.38, ty, zt], [P[c][0] + 0.38, ty, zt]); });
      g.add(K.segs([[P[0], P[1]], [P[0], P[2]], [P[1], leaf[0]], [P[1], leaf[1]], [P[2], leaf[2]], [P[2], leaf[3]]], { o: 0.35 }));
      g.add(K.dots(leaf, { r: 0.06, o: 0.35, hollow: true }));
      tr.forEach(([f, d], k) => {
        const hl = f === 0;
        g.add(K.dots([P[k]], { r: 0.07 + d * 0.5, c: hl ? 'acc' : 'ink', o: hl ? 1 : 0.6 }));
        parts[f].push({ d, pos: P[k] });
        tot[f] += d;
      });
    });
    // importance bars: stacked ΔI contributions per feature, sorted
    const order = [0, 1, 2, 3].sort((a, b) => tot[b] - tot[a]);
    const S = 4.0, bx = (k) => -1.8 + 1.2 * k, bz = 1.2;
    order.forEach((f, k) => {
      let y = 0;
      parts[f].forEach(({ d, pos }, j) => {
        const hl = f === 0;
        g.add(K.box(bx(k), y + d * S / 2, bz, 0.7, d * S - 0.05, 0.5, hl ? (j % 2 ? ST.accL : ST.acc) : (j % 2 ? ST.faint : ST.ink)));
        if (hl) g.add(K.line([[pos[0], pos[1] - 0.2, pos[2]], [bx(k), y + d * S - 0.05, bz]], { c: 'acc', o: 0.35, w: 1, dash: true }));
        y += d * S;
      });
      lab(g, 'x' + '₁₂₃₄'[f], [bx(k), -0.4, bz + 0.4], { size: 0.38, c: f === 0 ? 'acc' : 'ink', o: f === 0 ? 1 : 0.7 });
    });
    hline(g, bx(0) - 0.6, bx(3) + 0.6, 0, bz, { o: 0.45 });
    lab(g, 'ΣΔI', [bx(0) - 1.0, tot[0] * S * 0.5, bz], { size: 0.38, c: 'acc' });
    return [{ c: 'acc', t: 'Splits on top feature' }, { c: 'ink', t: 'Split nodes' }];
  };

  BARS.smooth = function (p, g) {
    const Kc = 5, eps = 0.2, H = 4, hot = 1;
    for (let i = 0; i < Kc; i++) {
      const x = -3 + 1.5 * i;
      if (i === hot) bar(g, x, -1.4, 0.8, H, 0.8, ST.ink);
      else g.add(K.box(x, 0.01, -1.4, 0.8, 0.02, 0.8, { o: 0.35 }));
      const v = i === hot ? 1 - eps + eps / Kc : eps / Kc;
      bar(g, x, 1.4, 0.8, H * v, 0.8, ST.acc);
    }
    hline(g, -4, 4, 0, -1.4, { o: 0.3 }); hline(g, -4, 4, 0, 1.4, { o: 0.4 });
    hline(g, -4, 4, H, -1.4, { o: 0.18, dash: true });
    lab(g, '1', [-1.5, H + 0.4, -1.4], { size: 0.32, o: 0.6 });
    lab(g, (1 - eps + eps / Kc).toFixed(2), [-1.5, H * (1 - eps + eps / Kc) + 0.4, 1.4], { c: 'acc', size: 0.32 });
    lab(g, 'ε/K', [1.5, H * eps / Kc + 0.45, 1.4], { c: 'acc', size: 0.32 });
    rails(g, [-4, 4], -2, 2);
    return [{ c: 'acc', t: 'Smoothed target' }, { c: 'ink', t: 'One-hot target' }];
  };

  BARS.goss = function (p, g) {
    const r = K.rng(31), N = 40, a = 0.2, b = 0.15;
    const gr = Array.from({ length: N }, (_, i) => 3.6 * Math.exp(-i / 7) + 0.18 + r() * 0.12).sort((u, v) => v - u);
    const top = Math.round(a * N), nb = Math.round(b * N);
    const rest = []; for (let i = top; i < N; i++) rest.push(i);
    for (let k = rest.length - 1; k > 0; k--) { const j = r.int(0, k); [rest[k], rest[j]] = [rest[j], rest[k]]; }
    const kept = new Set(rest.slice(0, nb));
    const bw = 8.4 / N, x = (i) => -4.2 + bw * (i + 0.5), w = (1 - a) / b;
    gr.forEach((v, i) => bar(g, x(i), -1.6, bw * 0.7, v, 0.45, i < top ? ST.accL : ST.faint));
    gr.forEach((v, i) => {
      if (i < top) bar(g, x(i), 1.6, bw * 0.7, v, 0.45, ST.acc);
      else if (kept.has(i)) bar(g, x(i), 1.6, bw * 0.7, v, 0.45, { fill: 0.35, o: 0.8 });
      else g.add(K.box(x(i), 0.01, 1.6, bw * 0.7, 0.02, 0.45, { o: 0.2 }));
    });
    hline(g, -4.3, 4.3, 0, -1.6, { o: 0.25 }); hline(g, -4.3, 4.3, 0, 1.6, { o: 0.4 });
    // bracket over top-a
    const xa = x(top - 0.5);
    g.add(K.line([[-4.2, 4.2, 1.6], [xa, 4.2, 1.6]], { c: 'acc', w: 1.6 }));
    lab(g, 'a', [(-4.2 + xa) / 2, 4.55, 1.6], { c: 'acc', size: 0.36 });
    const firstKept = Math.min(...kept);
    lab(g, '×(1−a)/b', [x(Math.round((top + N) / 2)), 1.25, 1.6], { size: 0.32, o: 0.75 });
    lab(g, '|g|', [-4.8, 1.2, -1.6], { o: 0.5, size: 0.32 });
    rails(g, [-4.3, 4.3], -1.9, 1.9);
    return [{ c: 'acc', t: 'Large gradients, all kept' }, { c: 'ink', t: 'Sampled small gradients' }];
  };

  BARS.shap = function (p, g) {
    const base = 0.12, phi = [0.24, -0.12, 0.17, 0.09, -0.07, 0.05, -0.03];
    const S = 9, n = phi.length;
    let cum = base;
    const x = (i) => -3.3 + 1.1 * i, z = (i) => 0;
    hline(g, -4.6, x(0) - 0.4, base * S, z(0), { o: 0.6, dash: true, w: 1.2 });
    lab(g, 'E[f(x)]', [-4.6, base * S + 0.4, z(0)], { size: 0.3, o: 0.75 });
    phi.forEach((v, i) => {
      const st = v > 0 ? ST.acc : ST.b;
      bar(g, x(i), z(i), 0.7, v * S, 0.6, st, cum * S);
      const nc = cum + v;
      if (i < n - 1) g.add(K.line([[x(i) + 0.35, nc * S, z(i)], [x(i + 1) - 0.35, nc * S, z(i + 1)]], { o: 0.4, w: 1 }));
      vline(g, x(i), 0, Math.min(cum, nc) * S, z(i), { o: 0.1, dash: true });
      lab(g, 'x' + '₁₂₃₄₅₆₇'[i], [x(i), -0.4, z(i) + 0.3], { size: 0.34, o: 0.6 });
      cum = nc;
    });
    const xe = x(n - 1) + 0.35;
    hline(g, xe, xe + 1.0, cum * S, z(n - 1), { o: 0.9, w: 1.8 });
    g.add(K.dots([[xe + 1.0, cum * S, z(n - 1)]], { r: 0.09 }));
    lab(g, 'f(x)', [xe + 1.0, cum * S + 0.42, z(n - 1)], { size: 0.34 });
    g.add(K.line([[x(0) - 0.5, 0, z(0)], [x(n - 1) + 0.5, 0, z(n - 1)]], { o: 0.3, w: 1 }));
    return [{ c: 'acc', t: 'Raises prediction' }, { c: 'b', t: 'Lowers prediction' }];
  };

  BARS.reward = function (p, g) {
    const ch = [3.3, 2.6, 3.7, 2.3, 3.0, 2.8], rj = [1.2, 1.9, 0.9, 1.5, 0.7, 2.0];
    const x = (i) => -3.75 + 1.5 * i;
    ch.forEach((v, i) => {
      bar(g, x(i), -0.55, 0.7, v, 0.7, ST.acc);
      bar(g, x(i), 0.55, 0.7, rj[i], 0.7, ST.b);
      lab(g, 'x' + '₁₂₃₄₅₆'[i], [x(i), -0.38, 1.5], { size: 0.28, o: 0.55 });
    });
    hline(g, -4.6, 4.6, 0, -0.55, { o: 0.3 }); hline(g, -4.6, 4.6, 0, 0.55, { o: 0.3 });
    // RM module
    g.add(K.box(-6.0, 1.0, 0, 1.0, 1.0, 1.0, { fill: 0.04, o: 0.6 }));
    lab(g, 'RM', [-6.0, 1.0, 0.55], { size: 0.34 });
    g.add(K.arrow([-5.4, 1.0, 0], [-4.7, 1.0, 0], { o: 0.5, w: 1.2 }));
    lab(g, 'y⁺', [5.1, 2.8, -0.55], { c: 'acc', size: 0.4 });
    lab(g, 'y⁻', [5.1, 2.0, 0.55], { c: 'b', size: 0.4 });
    return [{ c: 'acc', t: 'Chosen response' }, { c: 'b', t: 'Rejected response' }];
  };

  BARS.grpo = function (p, g) {
    const rw = [0.9, 0.2, 0.62, 0.1, 0.82, 0.38, 0.28, 0.7];
    const G = rw.length, mu = rw.reduce((s, v) => s + v, 0) / G;
    const sd = Math.sqrt(rw.reduce((s, v) => s + (v - mu) ** 2, 0) / G);
    const S = 3.6, x = (i) => -3.5 + 1.0 * i, my = mu * S;
    rw.forEach((v, i) => bar(g, x(i), -1.5, 0.55, v * S, 0.55, ST.faint));
    hline(g, -4.2, 4.2, my, -1.5, { o: 0.55, dash: true, w: 1.2 });
    hline(g, -4.2, 4.2, 0, -1.5, { o: 0.3 });
    rw.forEach((v, i) => {
      const A = (v - mu) / sd;
      bar(g, x(i), 1.5, 0.55, A * 0.95, 0.55, A > 0 ? ST.acc : ST.b, my);
      lab(g, 'o' + '₁₂₃₄₅₆₇₈'[i], [x(i), -0.35, 2.0], { size: 0.26, o: 0.5 });
    });
    hline(g, -4.2, 4.2, my, 1.5, { o: 0.6, w: 1.2 });
    hline(g, -4.2, 4.2, 0, 1.5, { o: 0.15 });
    g.add(K.segs([[[-4.2, my, -1.5], [-4.2, my, 1.5]]], { o: 0.35 }));
    lab(g, 'μ', [-4.7, my, -1.5], { size: 0.38, o: 0.7 });
    lab(g, 'r', [-4.7, 3.4, -1.5], { size: 0.36, o: 0.55 });
    lab(g, 'A', [4.7, my + 0.9, 1.5], { size: 0.4 });
    rails(g, [-4.2, 4.2], -1.8, 1.8);
    return [{ c: 'acc', t: 'Above group mean' }, { c: 'b', t: 'Below group mean' }];
  };

  /* INT4 quantization: a continuous weight distribution (top) snapped onto 16 discrete levels (bottom) */
  BARS.quant = function (p, g) {
    const lo = -3.6, hi = 3.6, H = 2.3, zb = -1.0, zf = 1.0, yT = 3.4;
    const pdf = (x) => Math.exp(-x * x / 2);
    const X = (v) => -4 + 8 * (v - lo) / (hi - lo);
    const pts = samp(pdf, lo, hi, 120).map(([u, v]) => [X(u), yT + H * v, zb]);
    g.add(area(pts, yT, { o: 0.07 }));
    g.add(K.line(pts, { w: 1.8, o: 0.85 }));
    hline(g, -4.1, 4.1, yT, zb, { o: 0.45 });
    const L = 16, a = 3.0, step = 2 * a / (L - 1);
    const lev = Array.from({ length: L }, (_, k) => -a + k * step);
    const mass = lev.map((v) => { let m = 0; for (let t = v - step / 2; t < v + step / 2; t += step / 40) m += pdf(t) * step / 40; return m; });
    mass[0] += 0.02; mass[L - 1] += 0.02; // clipped tails
    const mm = Math.max(...mass), hq = (k) => H * mass[k] / mm;
    lev.forEach((v, k) => bar(g, X(v), zf, 0.16, hq(k), 0.4, ST.acc));
    hline(g, -4.1, 4.1, 0, zf, { o: 0.45 });
    // the grid of allowed values, ticked on both axes
    g.add(K.segs(lev.map((v) => [[X(v), yT - 0.12, zb], [X(v), yT, zb]]), { c: 'acc', o: 0.8 }));
    // a few weights snapping to their nearest level
    [-1.93, -0.71, 0.33, 1.52].forEach((w) => {
      const k = lev.reduce((b, v, i) => (Math.abs(v - w) < Math.abs(lev[b] - w) ? i : b), 0);
      g.add(K.dots([[X(w), yT, zb]], { r: 0.08 }));
      g.add(K.arrow([X(w), yT - 0.05, zb], [X(lev[k]), hq(k) + 0.15, zf], { c: 'acc', w: 1.2, o: 0.6, head: 0.18 }));
    });
    const k0 = 12, yS = hq(k0) + 0.3;
    g.add(K.line([[X(lev[k0]), yS, zf], [X(lev[k0 + 1]), yS, zf]], { c: 'acc', w: 1.4 }));
    lab(g, 'Δ', [(X(lev[k0]) + X(lev[k0 + 1])) / 2 + 0.05, yS + 0.3, zf], { c: 'acc', size: 0.34 });
    lab(g, 'w', [-4.6, yT + 0.3, zb], { o: 0.6 });
    lab(g, 'INT4', [-4.95, 0.3, zf], { c: 'acc', size: 0.34 });
    lab(g, '−a', [X(-a), -0.45, zf + 0.3], { size: 0.3, o: 0.65 });
    lab(g, '+a', [X(a), -0.45, zf + 0.3], { size: 0.3, o: 0.65 });
    return [{ c: 'acc', t: 'INT4 levels' }, { c: 'ink', t: 'FP16 weights' }];
  };

  /* Reranking: first-stage list (left) re-scored by a stronger model (right); relevant docs move up */
  BARS.rerank = function (p, g) {
    const n = 8, rel = [3, 5, 6];
    const order = rel.concat([0, 1, 2, 4, 7]);          // new rank -> doc (first-stage index)
    const y = (k) => 4.4 - 0.62 * k, CW = 2.4, CH = 0.42;
    const XL = -2.8, XR = 2.8, zl = -0.6, zr = 0.6;
    const card = (x, yy, z, hl, st) => g.add(K.box(x, yy, z, CW, CH, 0.18, hl ? ST.acc : st));
    for (let i = 0; i < n; i++) card(XL, y(i), zl, rel.includes(i), ST.ink);
    order.forEach((doc, k) => {
      const hl = rel.includes(doc);
      card(XR, y(k), zr, hl, ST.faint);
      g.add(K.curve([[XL + CW / 2 + 0.05, y(doc), zl], [0, (y(doc) + y(k)) / 2, 0], [XR - CW / 2 - 0.05, y(k), zr]],
        { c: hl ? 'acc' : 'ink', o: hl ? 0.9 : 0.2, w: hl ? 2 : 1, n: 30 }));
    });
    for (let k = 0; k < n; k++) lab(g, String(k + 1), [XL - CW / 2 - 0.45, y(k), zl], { size: 0.32, o: 0.6 });
    lab(g, 'q', [XL, y(0) + 0.75, zl], { size: 0.42, o: 0.75 });
    lab(g, '↑', [XR + CW / 2 + 0.45, y(1), zr], { size: 0.5, c: 'acc' });
    return [{ c: 'acc', t: 'Relevant documents' }, { c: 'ink', t: 'First-stage order' }];
  };

  /* LLM evaluation: a few benchmarks × model sizes; one model's profile highlighted */
  BARS.bench = function (p, g) {
    const tasks = ['MMLU', 'GSM8K', 'HumanEval', 'ARC'];
    const models = ['7B', '13B', '70B'];
    const sc = [[0.45, 0.2, 0.15, 0.5], [0.55, 0.32, 0.22, 0.6], [0.8, 0.78, 0.62, 0.86]];
    const H = 4.2, gx = (t) => -3.3 + 2.2 * t, off = [-0.58, 0, 0.58], bw = 0.48;
    [0.5, 1].forEach((v) => hline(g, -4.3, 4.3, v * H, -0.3, { o: v === 1 ? 0.25 : 0.14, dash: true }));
    sc.forEach((row, m) => row.forEach((v, t) => bar(g, gx(t) + off[m], 0, bw, v * H, 0.4, m === 2 ? ST.acc : (m === 1 ? ST.ink : ST.faint))));
    g.add(K.line(sc[2].map((v, t) => [gx(t) + off[2], v * H + 0.02, 0.21]), { c: 'acc', o: 0.6, w: 1.4, dash: true }));
    hline(g, -4.3, 4.3, 0, 0, { o: 0.45 });
    tasks.forEach((t, i) => lab(g, t, [gx(i), -0.5, 0.3], { size: 0.32, o: 0.8 }));
    models.forEach((m, k) => lab(g, m, [gx(0) + off[k], sc[k][0] * H + 0.32, 0], { size: 0.29, c: k === 2 ? 'acc' : 'ink', o: k === 2 ? 1 : 0.65 }));
    lab(g, '100', [-4.75, H, -0.3], { size: 0.28, o: 0.5 });
    lab(g, '50', [-4.7, H / 2, -0.3], { size: 0.28, o: 0.5 });
    return [{ c: 'acc', t: 'Strongest model' }, { c: 'ink', t: 'Smaller models' }];
  };


  BARS.load = function (p, g) {
    const un = [3.6, 0.35, 2.4, 0.2, 0.55, 0.3, 0.12, 0.4];
    const tot = un.reduce((s, v) => s + v, 0), E = un.length, avg = tot / E;
    const bal = [1.06, 0.95, 1.02, 0.97, 1.08, 0.93, 0.99, 1.0].map((v) => v * avg);
    const x = (i) => -3.5 + 1.0 * i;
    un.forEach((v, i) => bar(g, x(i), -1.5, 0.55, v, 0.55, ST.ink));
    bal.forEach((v, i) => {
      bar(g, x(i), 1.5, 0.55, v, 0.55, ST.acc);
      lab(g, 'E' + '₁₂₃₄₅₆₇₈'[i], [x(i), -0.35, 2.05], { size: 0.26, o: 0.5 });
    });
    [-1.5, 1.5].forEach((z) => { hline(g, -4.1, 4.1, 0, z, { o: 0.3 }); hline(g, -4.1, 4.1, avg, z, { o: 0.5, dash: true, w: 1.2 }); });
    lab(g, 'T/E', [4.75, avg, 1.5], { size: 0.3, o: 0.65 });
    rails(g, [-4.1, 4.1], -1.8, 1.8);
    return [{ c: 'acc', t: 'Balanced load' }, { c: 'ink', t: 'Without balancing loss' }];
  };

  BARS.ternary = function (p, g) {
    const nb = 60, lo = -3, hi = 3, H = 3.4;
    const pdf = (x) => Math.exp(-Math.abs(x) * 1.6);
    const c = Array.from({ length: nb }, (_, i) => pdf(lo + (hi - lo) * (i + 0.5) / nb));
    const X = (v) => -4 + 8 * (v - lo) / (hi - lo);
    const th = 0.5;
    histBars(g, c, { x0: -4, x1: 4, z: -1.6, h: H, d: 0.5, gap: 0.75, st: ST.ink });
    [-th, th].forEach((v) => vline(g, X(v), 0, H + 0.3, -1.6, { o: 0.55, dash: true, w: 1.2 }));
    // masses
    const cdf = (x) => (x < 0 ? 0.5 * Math.exp(1.6 * x) : 1 - 0.5 * Math.exp(-1.6 * x));
    const m0 = cdf(th) - cdf(-th), mN = cdf(-th), mP = 1 - cdf(th);
    const mx = Math.max(m0, mN, mP);
    [[-1, mN], [0, m0], [1, mP]].forEach(([v, m]) => {
      bar(g, X(v * 2), 1.6, 0.9, H * m / mx, 0.7, ST.acc);
      lab(g, v === 0 ? '0' : (v > 0 ? '+1' : '−1'), [X(v * 2), -0.4, 2.3], { c: 'acc', size: 0.4 });
    });
    // mapping guides on the floor
    g.add(K.segs([
      [[-4, 0.01, -1.2], [X(-2) - 0.45, 0.01, 1.2]], [[X(-th), 0.01, -1.2], [X(-2) + 0.45, 0.01, 1.2]],
      [[X(-th), 0.01, -1.2], [X(0) - 0.45, 0.01, 1.2]], [[X(th), 0.01, -1.2], [X(0) + 0.45, 0.01, 1.2]],
      [[X(th), 0.01, -1.2], [X(2) - 0.45, 0.01, 1.2]], [[4, 0.01, -1.2], [X(2) + 0.45, 0.01, 1.2]],
    ], { o: 0.2 }));
    hline(g, -4.1, 4.1, 0, -1.6, { o: 0.3 }); hline(g, -4.1, 4.1, 0, 1.6, { o: 0.35 });
    lab(g, 'w', [-4.6, 0.3, -1.6], { o: 0.6 });
    return [{ c: 'acc', t: 'Ternary weights' }, { c: 'ink', t: 'Full-precision weights' }];
  };

  VIZ.bars = function (p, Kk) {
    K = Kk; T = K.THREE;
    const g = new T.Group();
    const fn = BARS[p.kind] || BARS.hist3;
    const res = fn(p, g);
    const out = turn(g, BROT[p.kind] == null ? 0.3 : BROT[p.kind]);
    if (Array.isArray(res)) return { g: out, legend: res };
    return Object.assign({}, res, { g: out });
  };

  /* =====================================================================
     CURVES
     ===================================================================== */
  const CV = {};
  const ROT = 0.42, CROT = { warmup: 0.62, ppo: 0.62 };

  CV.biasvar = function (p, g) {
    const W = 8, H = 4.2, xr = [0, 1], yr = [0, 1.25];
    const bias = (c) => 0.95 * Math.exp(-3.6 * c) + 0.03;
    const vari = (c) => 0.035 * Math.exp(3.4 * c);
    const noise = 0.08;
    const tot = (c) => bias(c) + vari(c) + noise;
    let cs = 0, best = 9; for (let c = 0; c <= 1; c += 0.002) if (tot(c) < best) { best = tot(c); cs = c; }
    const Mb = mapper(xr, yr, W, H, -1.4), Mf = mapper(xr, yr, W, H, 1.4);
    axesL(g, Mb, xr, yr, { o: 0.3 }); axesL(g, Mf, xr, yr);
    const lim = (f) => samp(f, 0, 1, 80).filter(([, v]) => v <= 1.25);
    plot(g, Mb, lim(bias), { o: 0.55, w: 1.6 });
    plot(g, Mb, lim(vari), { o: 0.55, w: 1.6, dash: true });
    hline(g, Mb(0, 0)[0], Mb(1, 0)[0], Mb(0, noise)[1], -1.4, { o: 0.2, dash: true });
    plot(g, Mf, lim(tot), { w: 2.4 });
    const pf = Mf(cs, best);
    vline(g, pf[0], 0, H, 1.4, { c: 'acc', o: 0.85, w: 1.6, dash: true });
    g.add(K.line([[pf[0], 0, -1.4], [pf[0], 0, 1.4]], { c: 'acc', o: 0.6, w: 1.2 }));
    g.add(K.dots([pf], { r: 0.13, c: 'acc' }));
    g.add(quad([pf[0] - 0.6, 0, 1.4], [pf[0] + 0.6, 0, 1.4], [pf[0] + 0.6, H, 1.4], [pf[0] - 0.6, H, 1.4], { c: 'acc', o: 0.07 }));
    lab(g, 'bias²', [Mb(0.1, bias(0.1))[0] + 0.7, Mb(0.1, bias(0.1))[1] + 0.2, -1.4], { size: 0.32, o: 0.7 });
    const vx = 0.93; lab(g, 'var', [Mb(vx, vari(vx))[0] + 0.55, Mb(vx, vari(vx))[1], -1.4], { size: 0.32, o: 0.7 });
    lab(g, 'err', [Mf(0.98, tot(0.98))[0] + 0.1, Math.min(H, Mf(0.98, tot(0.98))[1]) + 0.35, 1.4], { size: 0.34 });
    rails(g, [-4, 4], -1.6, 1.6);
    return [{ c: 'acc', t: 'Optimal complexity' }, { c: 'ink', t: 'Total error' }];
  };

  CV.learning = function (p, g) {
    const W = 8, H = 4, xr = [0, 1], yr = [0, 1];
    const Mf = mapper(xr, yr, W, H, 1.2), Mb = mapper(xr, yr, W, H, -1.4);
    const trC = (n) => 0.03 + 0.2 * (1 - Math.exp(-3.2 * n)), vaC = (n) => 0.27 + 0.65 * Math.exp(-3.6 * n);
    const trS = (n) => 0.44 - 0.1 * Math.exp(-6 * n), vaS = (n) => 0.48 + 0.42 * Math.exp(-7 * n);
    axesL(g, Mb, xr, yr, { o: 0.25 }); axesL(g, Mf, xr, yr);
    plot(g, Mb, samp(trS, 0.03, 1, 60), { o: 0.35, w: 1.4, dash: true });
    plot(g, Mb, samp(vaS, 0.03, 1, 60), { o: 0.35, w: 1.4 });
    const tr = samp(trC, 0.03, 1, 80), va = samp(vaC, 0.03, 1, 80);
    g.add(area2(va.map(([u, v]) => Mf(u, v)), tr.map(([u, v]) => Mf(u, v)), { c: 'acc', o: 0.18 }));
    plot(g, Mf, tr, { w: 2, dash: true });
    plot(g, Mf, va, { w: 2.2 });
    const e = Mf(1, vaC(1)), e2 = Mf(1, trC(1));
    g.add(K.line([[e[0] + 0.15, e[1], e[2]], [e2[0] + 0.15, e2[1], e2[2]]], { c: 'acc', w: 2.2 }));
    lab(g, 'n', [4.35, -0.3, 1.2], { size: 0.36, o: 0.7 });
    lab(g, 'L', [-4.4, H, 1.2], { size: 0.36, o: 0.7 });
    rails(g, [-4, 4], -1.6, 1.4);
    return [{ c: 'acc', t: 'Generalization gap' }, { c: 'ink', t: 'Train vs validation' }];
  };

  CV.early = function (p, g) {
    const W = 8, H = 4, xr = [0, 1], yr = [0, 1];
    const tr = (t) => 0.06 + 0.82 * Math.exp(-4.2 * t);
    const va = (t) => 0.2 + 0.7 * Math.exp(-5 * t) + 0.42 * Math.max(0, t - 0.32) ** 1.6;
    let ts = 0, mv = 9; for (let t = 0; t <= 1; t += 0.002) if (va(t) < mv) { mv = va(t); ts = t; }
    const Mb = mapper(xr, yr, W, H, -1.2), Mf = mapper(xr, yr, W, H, 1.2);
    axesL(g, Mb, xr, yr, { o: 0.3 }); axesL(g, Mf, xr, yr);
    plot(g, Mb, samp(tr, 0, 1, 80), { o: 0.5, w: 1.6, dash: true });
    plot(g, Mf, samp(va, 0, ts, 60), { w: 2.4 });
    plot(g, Mf, samp(va, ts, 1, 60), { w: 1.6, o: 0.3 });
    const xs = Mf(ts, 0)[0];
    g.add(quad([xs, 0, -1.6], [xs, 0, 1.6], [xs, H, 1.6], [xs, H, -1.6], { c: 'acc', o: 0.1 }));
    g.add(K.line([[xs, 0, -1.6], [xs, 0, 1.6], [xs, H, 1.6], [xs, H, -1.6], [xs, 0, -1.6]], { c: 'acc', o: 0.8, w: 1.4 }));
    g.add(K.dots([Mf(ts, mv)], { r: 0.13, c: 'acc' }));
    g.add(quad([xs, 0, 1.2], [4, 0, 1.2], [4, H, 1.2], [xs, H, 1.2], { c: 'ink', o: 0.035 }));
    lab(g, 'epoch', [4.5, -0.3, 1.2], { size: 0.3, o: 0.6 });
    lab(g, 'L', [-4.4, H, 1.2], { size: 0.36, o: 0.7 });
    rails(g, [-4, 4], -1.6, 1.6);
    return [{ c: 'acc', t: 'Stopping point' }, { c: 'ink', t: 'Validation loss' }];
  };

  CV.impurity = function (p, g) {
    const hl = p.hl || 'gini';
    const W = 6.4, H = 4.2, xr = [0, 1], yr = [0, 1];
    const gini = (q) => 2 * q * (1 - q), ent = (q) => (q <= 0 || q >= 1 ? 0 : -(q * Math.log2(q) + (1 - q) * Math.log2(1 - q)));
    const mis = (q) => Math.min(q, 1 - q);
    const fA = hl === 'gini' ? gini : ent, fB = hl === 'gini' ? ent : gini;
    const Mf = mapper(xr, yr, W, H, 1.2), Mb = mapper(xr, yr, W, H, -0.4), Mm = mapper(xr, yr, W, H, -2);
    axesL(g, Mm, xr, yr, { o: 0.2 }); axesL(g, Mb, xr, yr, { o: 0.3 }); axesL(g, Mf, xr, yr);
    plot(g, Mm, samp(mis, 0, 1, 2), { o: 0.25, w: 1.2, dash: true });
    plot(g, Mb, samp(fB, 0, 1, 100), { o: 0.45, w: 1.6 });
    plot(g, Mf, samp(fA, 0, 1, 120), { c: 'acc', w: 2.6 });
    // information gain on a split: parent vs weighted children
    const pp = 0.42, pl = 0.12, pr = 0.72, wl = (pr - pp) / (pr - pl);
    const child = wl * fA(pl) + (1 - wl) * fA(pr);
    g.add(K.line([Mf(pl, fA(pl)), Mf(pr, fA(pr))], { o: 0.5, w: 1.2 }));
    g.add(K.dots([Mf(pl, fA(pl)), Mf(pr, fA(pr)), Mf(pp, child)], { r: 0.08 }));
    g.add(K.dots([Mf(pp, fA(pp))], { r: 0.11, c: 'acc' }));
    g.add(K.line([Mf(pp, child), Mf(pp, fA(pp))], { c: 'acc', w: 3 }));
    lab(g, hl === 'gini' ? 'ΔG' : 'IG', [Mf(pp, 0)[0] - 0.45, (Mf(pp, child)[1] + Mf(pp, fA(pp))[1]) / 2, 1.2], { c: 'acc', size: 0.34 });
    lab(g, hl === 'gini' ? 'Gini' : 'H(p)', [Mf(0.5, 0)[0], Mf(0, fA(0.5))[1] + 0.4, 1.2], { c: 'acc', size: 0.38 });
    lab(g, hl === 'gini' ? 'H(p)' : 'Gini', [Mb(0.5, 0)[0], Mb(0, fB(0.5))[1] + 0.35, -0.4], { size: 0.32, o: 0.5 });
    lab(g, 'p', [3.5, -0.3, 1.2], { size: 0.36, o: 0.7 });
    lab(g, '0', [-3.2, -0.3, 1.2], { size: 0.28, o: 0.5 }); lab(g, '1', [3.2, -0.3, 1.2], { size: 0.28, o: 0.5 });
    rails(g, [-3.2, 3.2], -2.2, 1.4);
    return [{ c: 'acc', t: hl === 'gini' ? 'Gini impurity' : 'Entropy' }, { c: 'ink', t: hl === 'gini' ? 'Entropy' : 'Gini impurity' }];
  };

  CV.shrink = function (p, g) {
    const W = 8, H = 4.2, M = 20, xr = [0, M], yr = [0, 4.2], y = 3.2;
    const r = K.rng(12);
    const noise = Array.from({ length: M }, () => r.n() * 0.55);
    const run = (eta) => { const out = [[0, 0.3]]; let F = 0.3; for (let m = 1; m <= M; m++) { F = F + eta * (y - F + noise[m - 1]); out.push([m, clamp(F, 0, 4.1)]); } return out; };
    const big = run(1.0), small = run(0.15);
    const Mb = mapper(xr, yr, W, H, -1.4), Mf = mapper(xr, yr, W, H, 1.4);
    axesL(g, Mb, xr, yr, { o: 0.3 }); axesL(g, Mf, xr, yr);
    [[Mb, -1.4, 0.35], [Mf, 1.4, 0.5]].forEach(([Mx, z, o]) => hline(g, -4, 4, Mx(0, y)[1], z, { o, dash: true, w: 1.2 }));
    g.add(K.line(stairs(big, Mb), { o: 0.5, w: 1.5 }));
    g.add(K.line(stairs(small, Mf), { c: 'acc', w: 2.2 }));
    g.add(K.dots(small.map(([u, v]) => Mf(u, v)), { r: 0.075, c: 'acc' }));
    lab(g, 'y', [4.4, Mf(0, y)[1], 1.4], { size: 0.38 });
    lab(g, 'η=1', [-4.8, Mb(0, 2)[1], -1.4], { size: 0.3, o: 0.55 });
    lab(g, 'η=0.1', [-5.0, Mf(0, 1.0)[1], 1.4], { size: 0.32, c: 'acc' });
    lab(g, 'm', [4.4, -0.3, 1.4], { size: 0.34, o: 0.6 });
    rails(g, [-4, 4], -1.6, 1.6);
    return [{ c: 'acc', t: 'Small learning rate' }, { c: 'ink', t: 'Large learning rate' }];
  };

  function rocPanel(g, z, S, o) {
    const M = mapper([0, 1], [0, 1], S, S, z);
    g.add(K.line([M(0, 0), M(1, 0), M(1, 1), M(0, 1), M(0, 0)], { o: o, w: 1 }));
    return M;
  }

  CV.roc = function (p, g) {
    const S = 4.6, ks = [1.7, 3.2, 7], zs = [-2.4, -1.0, 0.6];
    const f = (k) => (x) => 1 - Math.pow(1 - x, k);
    let front, Mfront;
    ks.forEach((k, i) => {
      const M = rocPanel(g, zs[i], S, i === 2 ? 0.45 : 0.2);
      g.add(K.line([M(0, 0), M(1, 1)], { o: i === 2 ? 0.4 : 0.15, w: 1.2, dash: i === 2 }));
      const pts = samp(f(k), 0, 1, 100).map(([u, v]) => M(u, v));
      if (i < 2) g.add(K.line(pts, { o: 0.3 + 0.15 * i, w: 1.5 }));
      else { front = pts; Mfront = M; }
    });
    if (p.fill) {
      g.add(area(front, 0, { c: 'acc', o: 0.28 }));
      lab(g, 'AUC', [Mfront(0.62, 0.35)[0], Mfront(0, 0.35)[1], 0.62], { c: 'acc', size: 0.48, weight: 600 });
    }
    g.add(K.line(front, { c: 'acc', w: 2.6 }));
    const th = [0.03, 0.1, 0.22, 0.4, 0.65].map((u) => Mfront(u, f(7)(u)));
    const dt = K.dots(th, { r: 0.075, c: 'acc' }); g.add(dt);
    const mover = K.dots([Mfront(0.1, f(7)(0.1))], { r: 0.13, c: 'acc' }); g.add(mover);
    lab(g, 'FPR', [0, -0.4, 0.6], { size: 0.3, o: 0.65 });
    lab(g, 'TPR', [-3.0, S / 2, 0.6], { size: 0.3, o: 0.65 });
    rails(g, [-S / 2, S / 2], -2.4, 0.6);
    const tick = (t) => {
      const u = 0.5 - 0.5 * Math.cos((t % 6) / 6 * Math.PI * 2); const x = u * u;
      const q = Mfront(x, f(7)(x)); const m = new T.Matrix4(); m.makeScale(0.13, 0.13, 0.13); m.setPosition(q[0], q[1], q[2]);
      mover.setMatrixAt(0, m); mover.instanceMatrix.needsUpdate = true;
    };
    return { legend: p.fill ? [{ c: 'acc', t: 'Area under curve' }, { c: 'ink', t: 'Weaker models' }] : [{ c: 'acc', t: 'ROC curve' }, { c: 'ink', t: 'Weaker models' }], tick };
  };

  CV.pr = function (p, g) {
    const S = 4.6, pi = 0.3, zs = [-2.4, -1.0, 0.6], as = [1.3, 2.4, 5];
    const f = (a) => (r) => pi + (1 - pi) * Math.pow(Math.max(0, 1 - Math.pow(r, a)), 0.55);
    let front, Mfront;
    as.forEach((a, i) => {
      const M = rocPanel(g, zs[i], S, i === 2 ? 0.45 : 0.2);
      g.add(K.line([M(0, pi), M(1, pi)], { o: i === 2 ? 0.55 : 0.15, w: 1.2, dash: i === 2 }));
      const pts = samp(f(a), 0, 1, 120).map(([u, v]) => M(u, v));
      if (i < 2) g.add(K.line(pts, { o: 0.3 + 0.15 * i, w: 1.5 }));
      else { front = pts; Mfront = M; }
    });
    if (p.fill) {
      g.add(area(front, 0, { c: 'acc', o: 0.28 }));
      lab(g, 'AP', [Mfront(0.5, 0)[0], Mfront(0, 0.62)[1], 0.62], { c: 'acc', size: 0.48, weight: 600 });
    }
    g.add(K.line(front, { c: 'acc', w: 2.6 }));
    lab(g, 'π', [S / 2 + 0.35, Mfront(0, pi)[1], 0.6], { size: 0.38, o: 0.8 });
    lab(g, 'R', [0, -0.4, 0.6], { size: 0.32, o: 0.65 });
    lab(g, 'P', [-2.75, S / 2, 0.6], { size: 0.32, o: 0.65 });
    rails(g, [-S / 2, S / 2], -2.4, 0.6);
    return { legend: [{ c: 'acc', t: p.fill ? 'Area under curve' : 'Precision–recall curve' }, { c: 'ink', t: 'Random baseline' }] };
  };

  CV.calib = function (p, g) {
    const S = 4.6;
    const Mf = rocPanel(g, 1.0, S, 0.4);
    g.add(K.line([Mf(0, 0), Mf(1, 1)], { o: 0.6, w: 1.4, dash: true }));
    const obs = (q) => 0.5 + (q - 0.5) * 0.55 + 0.04 * Math.sin(q * 9);
    const bins = Array.from({ length: 10 }, (_, i) => (i + 0.5) / 10);
    const pts = bins.map((q) => Mf(q, obs(q)));
    g.add(K.segs(bins.map((q) => [Mf(q, q), Mf(q, obs(q))]), { c: 'acc', o: 0.45 }));
    g.add(K.line(pts, { c: 'acc', w: 2.4 }));
    g.add(K.dots(pts, { r: 0.09, c: 'acc' }));
    // confidence histogram behind: over-confident -> mass piles at 0 and 1
    const hc = bins.map((q) => 0.25 + 3 * (Math.pow(Math.abs(q - 0.5) * 2, 3)));
    const mx = Math.max(...hc);
    bins.forEach((q, i) => bar(g, Mf(q, 0)[0], -1.4, S / 10 * 0.75, 2.2 * hc[i] / mx, 0.5, ST.faint));
    hline(g, -S / 2, S / 2, 0, -1.4, { o: 0.25 });
    lab(g, 'p̂', [0, -0.42, 1.0], { size: 0.36, o: 0.7 });
    lab(g, 'ȳ', [-2.75, S / 2, 1.0], { size: 0.36, o: 0.7 });
    rails(g, [-S / 2, S / 2], -1.7, 1.0);
    return [{ c: 'acc', t: 'Over-confident model' }, { c: 'ink', t: 'Perfect calibration' }];
  };

  CV.loss = function (p, g) {
    const W = 7, H = 4.6, xr = [0, 1], yr = [0, 4.7];
    const Mf = mapper(xr, yr, W, H, 1.0), Mb = mapper(xr, yr, W, H, -1.0);
    axesL(g, Mb, xr, yr, { o: 0.3 }); axesL(g, Mf, xr, yr);
    plot(g, Mb, samp((q) => (1 - q) ** 2, 0, 1, 60), { w: 1.8, o: 0.55 });
    plot(g, Mf, samp((q) => -Math.log(q), 0.0095, 1, 160).filter(([, v]) => v <= 4.7), { c: 'acc', w: 2.6 });
    hline(g, -3.5, 3.5, Mb(0, 1)[1], -1.0, { o: 0.15, dash: true });
    lab(g, '−log p', [Mf(0.14, 0)[0] + 0.9, Mf(0, 2.6)[1], 1.0], { c: 'acc', size: 0.36 });
    lab(g, '(1−p)²', [Mb(0.3, 0)[0] + 0.5, Mb(0, 0.55)[1] + 0.35, -1.0], { size: 0.32, o: 0.6 });
    lab(g, 'p', [3.85, -0.3, 1.0], { size: 0.36, o: 0.7 });
    lab(g, '0', [-3.5, -0.3, 1.0], { size: 0.28, o: 0.5 }); lab(g, '1', [3.5, -0.3, 1.0], { size: 0.28, o: 0.5 });
    lab(g, '1', [-3.85, Mb(0, 1)[1], -1.0], { size: 0.26, o: 0.45 });
    rails(g, [-3.5, 3.5], -1.2, 1.2);
    return [{ c: 'acc', t: 'Log loss' }, { c: 'ink', t: 'Squared error' }];
  };

  CV.ice = function (p, g) {
    const W = 8, H = 4, xr = [0, 1], yr = [-0.2, 1.3];
    const r = K.rng(17), n = 22;
    const curves = [];
    for (let i = 0; i < n; i++) {
      const b = 0.15 + r() * 0.5, s = (r() < 0.2 ? -0.35 : 0.55) * (0.5 + r()), c = 0.3 + r() * 0.4, k = 6 + r() * 10;
      curves.push((x) => b + s * sig((x - c) * k) + 0.06 * Math.sin(x * 7 + i));
    }
    const zs = curves.map((_, i) => -2.6 + 4.2 * i / (n - 1));
    curves.forEach((f, i) => { const M = mapper(xr, yr, W, H, zs[i]); plot(g, M, samp(f, 0, 1, 50), { w: 1, o: 0.3 }); });
    const pdp = (x) => curves.reduce((s, f) => s + f(x), 0) / n;
    const Mf = mapper(xr, yr, W, H, 2.4);
    axesL(g, Mf, xr, yr, { o: 0.4 });
    plot(g, Mf, samp(pdp, 0, 1, 80), { c: 'acc', w: 3 });
    rails(g, [-4, 4], -2.6, 2.4, 0.2);
    lab(g, 'xⱼ', [4.4, -0.3, 2.4], { size: 0.36, o: 0.7 });
    lab(g, 'f̂', [-4.4, H, 2.4], { size: 0.38, o: 0.7 });
    return [{ c: 'acc', t: 'Average effect (PDP)' }, { c: 'ink', t: 'Individual instances' }];
  };

  CV.lr = function (p, g) {
    const W = 8, H = 3.8, xr = [0, 1], yr = [0, 1.05], wu = 0.08;
    const cosw = (t) => (t < wu ? t / wu : 0.05 + 0.95 * 0.5 * (1 + Math.cos(Math.PI * (t - wu) / (1 - wu))));
    const step = (t) => (t < 0.4 ? 1 : t < 0.75 ? 0.3 : 0.09);
    const lin = (t) => 1 - 0.95 * t;
    const zs = [-2.4, -1.2, 0.6];
    [[lin, 0.25], [step, 0.35]].forEach(([f, o], i) => {
      const M = mapper(xr, yr, W, H, zs[i]); axesL(g, M, xr, yr, { o: 0.2 });
      plot(g, M, samp(f, 0, 1, 200), { o, w: 1.4 });
    });
    const M = mapper(xr, yr, W, H, zs[2]); axesL(g, M, xr, yr);
    const pts = samp(cosw, 0, 1, 200);
    g.add(area(pts.slice(0, 18).map(([u, v]) => M(u, v)), 0, { c: 'acc', o: 0.12 }));
    plot(g, M, pts, { c: 'acc', w: 2.6 });
    vline(g, M(wu, 0)[0], 0, H, zs[2], { o: 0.4, dash: true, w: 1.2 });
    const mover = K.dots([M(0.3, cosw(0.3))], { r: 0.12, c: 'acc' }); g.add(mover);
    lab(g, 'η', [-4.4, H, zs[2]], { size: 0.4, o: 0.7 });
    lab(g, 't', [4.35, -0.3, zs[2]], { size: 0.36, o: 0.7 });
    rails(g, [-4, 4], -2.6, 0.8);
    const tick = (t) => {
      const u = (t % 6) / 6; const q = M(u, cosw(u)); const m = new T.Matrix4(); m.makeScale(0.12, 0.12, 0.12); m.setPosition(q[0], q[1], q[2]);
      mover.setMatrixAt(0, m); mover.instanceMatrix.needsUpdate = true;
    };
    return { legend: [{ c: 'acc', t: 'Warmup + cosine decay' }, { c: 'ink', t: 'Constant / step decay' }], tick };
  };

  /* Warmup: η ramps up linearly before decaying (left); with it the loss falls smoothly, without it it spikes (right) */
  CV.warmup = function (p, g) {
    const xr = [0, 1], wu = 0.15, W = 4.2, H = 3.4;
    const lrW = (t) => (t < wu ? t / wu : 0.06 + 0.94 * 0.5 * (1 + Math.cos(Math.PI * (t - wu) / (1 - wu))));
    const lrN = (t) => 0.06 + 0.94 * 0.5 * (1 + Math.cos(Math.PI * t));
    const r = K.rng(23), nz = Array.from({ length: 201 }, () => r.n());
    const lossW = (t, i) => 0.22 + 0.7 * Math.exp(-3.4 * Math.max(0, t - 0.04)) + 0.012 * nz[i];
    const lossN = (t, i) => 0.22 + 0.7 * Math.exp(-3.4 * t) + 0.75 * Math.exp(-Math.pow((t - 0.07) / 0.03, 2)) + 0.4 * Math.exp(-Math.pow((t - 0.17) / 0.025, 2)) + 0.035 * nz[i];
    const zl = -0.3, zr = 0.3;
    const Ml = mapper(xr, [0, 1.1], W, H, zl, -2.6), Mr = mapper(xr, [0, 1.75], W, H, zr, 2.6);
    axesL(g, Ml, xr, [0, 1.1]); axesL(g, Mr, xr, [0, 1.75]);
    // warmup window shaded on both panels
    [[Ml, 1.1, zl], [Mr, 1.75, zr]].forEach(([M, top]) => g.add(quad(M(0, 0), M(wu, 0), M(wu, top), M(0, top), { c: 'acc', o: 0.08 })));
    plot(g, Ml, samp(lrN, 0, 1, 100), { o: 0.35, w: 1.3, dash: true });
    plot(g, Ml, samp(lrW, 0, wu, 20), { c: 'acc', w: 3 });
    plot(g, Ml, samp(lrW, wu, 1, 100), { w: 2 });
    const ts = Array.from({ length: 201 }, (_, i) => i / 200);
    g.add(K.line(ts.map((t, i) => Mr(t, Math.min(1.72, lossN(t, i)))), { o: 0.4, w: 1.3 }));
    g.add(K.line(ts.map((t, i) => Mr(t, lossW(t, i))), { c: 'acc', w: 2.6 }));
    lab(g, 'η', [Ml(0, 0)[0] - 0.35, H, zl], { size: 0.42, o: 0.75 });
    lab(g, 'L', [Mr(0, 0)[0] - 0.35, H, zr], { size: 0.42, o: 0.75 });
    lab(g, 't', [Mr(1, 0)[0] + 0.3, -0.25, zr], { size: 0.36, o: 0.7 });
    lab(g, 'Tʷ', [Ml(wu, 0)[0], -0.35, zl], { size: 0.34, c: 'acc' });
    return [{ c: 'acc', t: 'With warmup' }, { c: 'ink', t: 'No warmup' }];
  };

  /* UAT: a target curve rebuilt as a sum of n shifted ReLU bumps (faint, behind) */
  CV.uat = function (p, g) {
    const n = clamp(Math.round(p.n == null ? 6 : p.n), 2, 16);
    const W = 9, H = 4.4, xr = [0, 1], yr = [0, 1.25];
    const tgt = (x) => 0.62 + 0.36 * Math.sin(2 * Math.PI * 1.25 * x) * Math.exp(-0.4 * x) + 0.12 * Math.sin(8.5 * x);
    const knots = Array.from({ length: n + 1 }, (_, i) => i / n);
    const vals = knots.map(tgt);
    // hat bump at knot i = (ReLU(x−k₋) − 2ReLU(x−k) + ReLU(x−k₊))/h, weighted by target value
    const h = 1 / n;
    const hat = (x, i) => Math.max(0, 1 - Math.abs(x - knots[i]) / h);
    const zb = -1.2, zf = 0.4;
    const Mb = mapper(xr, yr, W, H, zb), Mf = mapper(xr, yr, W, H, zf);
    axesL(g, Mb, xr, yr, { o: 0.15 });
    knots.forEach((k, i) => {
      const pts = [[Math.max(0, k - h), 0], [k, vals[i]], [Math.min(1, k + h), 0]];
      if (i === 0) pts.shift(); if (i === n) pts.pop();
      if (i === 0) pts.unshift([0, 0]); if (i === n) pts.push([1, 0]);
      g.add(K.line(pts.map(([u, v]) => Mb(u, v)), { w: 1.2, o: 0.35 }));
    });
    axesL(g, Mf, xr, yr);
    plot(g, Mf, samp(tgt, 0, 1, 160), { w: 1.6, o: 0.6, dash: true });
    g.add(K.line(knots.map((k, i) => Mf(k, vals[i])), { c: 'acc', w: 3 }));
    g.add(K.dots(knots.map((k, i) => Mf(k, vals[i])), { r: 0.07, c: 'acc' }));
    // faint drop lines link each bump peak to its knot on the sum
    g.add(K.segs(knots.map((k, i) => [Mb(k, vals[i]), Mf(k, vals[i])]), { o: 0.12 }));
    lab(g, 'Σ', [W / 2 + 0.45, Mf(1, vals[n])[1], zf], { c: 'acc', size: 0.46 });
    lab(g, 'f(x)', [-W / 2 + 0.2, H + 0.35, zf], { size: 0.38, o: 0.7 });
    lab(g, 'x', [W / 2 + 0.35, -0.2, zf], { size: 0.36, o: 0.7 });
    return { legend: [{ c: 'acc', t: 'Sum of ReLUs' }, { c: 'ink', t: 'Target' }], ctl: [{ key: 'n', label: 'n', min: 2, max: 16, step: 1, value: n }] };
  };


  CV.scaling = function (p, g) {
    const W = 8, H = 4.4, xr = [0, 9], yr = [0, 4.8];
    const f = (x) => 4.3 - 0.42 * x, r = 0.9;
    const xi = [1.2, 2.8, 4.4, 6.0, 7.6];
    const zOf = (x) => -2.4 + 1.2 * (x - 1.2) / 1.6;
    const tp = [];
    xi.forEach((x0, i) => {
      const z = zOf(x0), M = mapper(xr, yr, W, H, z);
      const y = (x) => f(x0) - 0.42 / r + (0.42 / r) * Math.exp(-(x - x0) * r);
      const pts = samp(y, 0, 9, 120).filter(([, v]) => v <= 4.8);
      plot(g, M, pts, { w: 1.6, o: 0.35 + 0.1 * i });
      hline(g, -4, 4, 0, z, { o: 0.15 });
      tp.push(M(x0, f(x0)));
    });
    const a = mapper(xr, yr, W, H, zOf(0.3))(0.3, f(0.3)), b = mapper(xr, yr, W, H, zOf(9))(9, f(9));
    g.add(K.line([a, b], { c: 'acc', w: 2.6 }));
    g.add(K.dots(tp, { r: 0.1, c: 'acc' }));
    const zb = zOf(1.2), zf = zOf(7.6);
    const Mb = mapper(xr, yr, W, H, zb - 0.6);
    axesL(g, Mb, xr, yr, { o: 0.3 });
    rails(g, [-4], zb - 0.6, zf + 0.4, 0.4);
    g.add(K.arrow([4.4, 0, zb], [4.4, 0, zf + 0.6], { o: 0.45, w: 1.2 }));
    lab(g, 'N', [4.8, 0.3, zf + 0.6], { size: 0.38, o: 0.7 });
    lab(g, 'log C', [4.2, -0.4, zb - 0.6], { size: 0.32, o: 0.6 });
    lab(g, 'log L', [-4.2, H + 0.35, zb - 0.6], { size: 0.32, o: 0.6 });
    return [{ c: 'acc', t: 'Compute-optimal frontier' }, { c: 'ink', t: 'Fixed model size' }];
  };

  /* PPO-clip: objective vs probability ratio r, for A>0 (left) and A<0 (right); flat beyond the trust band */
  CV.ppo = function (p, g) {
    const eps = 0.2, xr = [0, 2], W = 4.0, H = 3.2;
    const panel = (cx, z, A) => {
      const yr = A > 0 ? [0, 2] : [-2, 0];
      const M = mapper(xr, yr, W, H, z, cx, A > 0 ? 0 : -H);
      const y0 = M(0, 0)[1];
      // trust band [1−ε, 1+ε]
      g.add(quad(M(1 - eps, yr[0]), M(1 + eps, yr[0]), M(1 + eps, yr[1]), M(1 - eps, yr[1]), { o: 0.07 }));
      [1 - eps, 1 + eps].forEach((u) => vline(g, M(u, 0)[0], M(0, yr[0])[1], M(0, yr[1])[1], z, { o: 0.35, w: 1, dash: true }));
      // axes: r axis at L=0, L axis at r=0
      hline(g, M(0, 0)[0], M(2, 0)[0] + 0.15, y0, z, { o: 0.55 });
      vline(g, M(0, 0)[0], M(0, yr[0])[1], M(0, yr[1])[1], z, { o: 0.55 });
      // unclipped r·A continues faintly where clipping takes over
      const [c0, c1] = A > 0 ? [1 + eps, 2] : [0, 1 - eps];
      plot(g, M, samp((rr) => rr * A, c0, c1, 20), { o: 0.3, w: 1.2, dash: true });
      // objective: linear part ink, flat clipped part accent
      const Lc = (rr) => Math.min(rr * A, clamp(rr, 1 - eps, 1 + eps) * A);
      const [u0, u1] = A > 0 ? [0, 1 + eps] : [1 - eps, 2];
      plot(g, M, samp(Lc, u0, u1, 30), { w: 2.2 });
      plot(g, M, samp(Lc, c0, c1, 20), { c: 'acc', w: 3.4 });
      lab(g, A > 0 ? 'A>0' : 'A<0', [cx, A > 0 ? M(0, 2)[1] + 0.45 : M(0, 0)[1] + 0.45, z], { size: 0.4 });
      lab(g, '1−ε', [M(1 - eps, 0)[0] - 0.1, (A > 0 ? M(0, 0)[1] : M(0, -2)[1]) - 0.35, z], { size: 0.28, o: 0.7 });
      lab(g, '1+ε', [M(1 + eps, 0)[0] + 0.15, (A > 0 ? M(0, 0)[1] : M(0, -2)[1]) - 0.35, z], { size: 0.28, o: 0.7 });
      lab(g, 'r', [M(2, 0)[0] + 0.4, y0, z], { size: 0.36, o: 0.7 });
      return M;
    };
    panel(-2.6, -0.3, 1);
    panel(2.6, 0.3, -1);
    lab(g, 'L', [-2.6 - W / 2, H + 0.4, -0.3], { size: 0.38, o: 0.7 });
    return [{ c: 'acc', t: 'Clipped region' }, { c: 'ink', t: 'Clipped objective' }];
  };

  CV.ttc = function (p, g) {
    const W = 8, H = 4, xr = [2, 5], yr = [0, 1];
    const models = [{ z: -3.0, lo: 0.1, hi: 0.3, o: 0.35 }, { z: -1.2, lo: 0.14, hi: 0.52, o: 0.55 }, { z: 1.2, lo: 0.18, hi: 0.92, acc: true }];
    models.forEach((m) => {
      const M = mapper(xr, yr, W, H, m.z);
      axesL(g, M, xr, yr, { o: m.acc ? 0.45 : 0.18 });
      const f = (x) => m.lo + (m.hi - m.lo) * (1 - Math.exp(-1.25 * (x - 2))) / (1 - Math.exp(-1.25 * 3));
      plot(g, M, samp(f, 2, 5, 90), m.acc ? { c: 'acc', w: 2.6 } : { o: m.o, w: 1.6 });
      if (m.acc) {
        g.add(K.segs([2, 3, 4, 5].map((d) => [M(d, 0), [M(d, 0)[0], -0.12, m.z]]), { o: 0.5 }));
        ['10²', '10³', '10⁴', '10⁵'].forEach((t, i) => lab(g, t, [M(2 + i, 0)[0], -0.42, m.z], { size: 0.28, o: 0.6 }));
        g.add(area(samp(f, 2, 5, 60).map(([u, v]) => M(u, v)), 0, { c: 'acc', o: 0.07 }));
        g.add(K.dots([2, 3, 4, 5].map((d) => M(d, f(d))), { r: 0.08, c: 'acc' }));
      }
    });
    rails(g, [-4, 4], -3.2, 1.4);
    lab(g, 'acc', [-4.5, H, 1.2], { size: 0.3, o: 0.6 });
    lab(g, 'tokens', [4.6, -0.42, 1.2], { size: 0.28, o: 0.5, mono: true });
    return [{ c: 'acc', t: 'Reasoning model' }, { c: 'ink', t: 'Smaller models' }];
  };

  VIZ.curves = function (p, Kk) {
    K = Kk; T = K.THREE;
    const g = new T.Group();
    const fn = CV[p.kind] || CV.roc;
    const res = fn(p, g);
    const out = turn(g, CROT[p.kind] == null ? ROT : CROT[p.kind]);
    if (Array.isArray(res)) return { g: out, legend: res };
    return Object.assign({}, res, { g: out });
  };

  /* =====================================================================
     ACT — activation functions (front: f in accent; back: f′ faded)
     ===================================================================== */
  VIZ.act = function (p, Kk) {
    K = Kk; T = K.THREE;
    const g = new T.Group();
    const f = p.f || 'relu';
    if (f === 'swiglu') return swiglu(p, g);
    if (f === 'clip') return clipF(p, g);
    const gelu = (x) => x * Phi(x);
    const F = {
      relu: { f: (x) => Math.max(0, x), d: (x) => (x > 0 ? 1 : 0), ys: 1, yr: [-1, 4] },
      sigmoid: { f: sig, d: (x) => sig(x) * (1 - sig(x)), ys: 3.2, yr: [-0.3, 1.25] },
      tanh: { f: Math.tanh, d: (x) => 1 - Math.tanh(x) ** 2, ys: 2, yr: [-1.2, 1.2] },
      gelu: { f: gelu, d: (x) => Phi(x) + x * Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI), ys: 1, yr: [-1, 4] },
    }[f];
    const X = 4, zf = 1.2, zb = -1.2, ys = F.ys;
    const Y = (v) => v * ys;
    // axes through origin on both planes
    [[zf, 0.45], [zb, 0.25]].forEach(([z, o]) => {
      hline(g, -X, X, 0, z, { o });
      vline(g, 0, Y(F.yr[0]), Y(F.yr[1]), z, { o });
    });
    const pts = (fn) => samp(fn, -X, X, 200).map(([x, v]) => [x, Y(v)]);
    if (f === 'relu') {
      g.add(K.line([[-X, 0, zb], [0, 0, zb]], { o: 0.5, w: 1.8 }));
      g.add(K.line([[0, Y(1), zb], [X, Y(1), zb]], { o: 0.5, w: 1.8 }));
      g.add(K.dots([[0, 0, zb]], { r: 0.07, o: 0.5 })); g.add(K.dots([[0, Y(1), zb]], { r: 0.07, o: 0.5, hollow: true }));
    } else {
      g.add(K.line(pts(F.d).map(([x, y]) => [x, y, zb]), { o: 0.5, w: 1.8 }));
    }
    if (f === 'gelu') g.add(K.line(pts((x) => Math.max(0, x)).map(([x, y]) => [x, y, zf]), { o: 0.3, w: 1.2, dash: true }));
    if (f === 'sigmoid' || f === 'tanh') {
      const top = f === 'sigmoid' ? 1 : 1, bot = f === 'sigmoid' ? 0 : -1;
      hline(g, -X, X, Y(top), zf, { o: 0.18, dash: true }); hline(g, -X, X, Y(bot), zf, { o: 0.18, dash: true });
    }
    const fp = pts(F.f).map(([x, y]) => [x, y, zf]);
    g.add(K.line(fp, { c: 'acc', w: 2.8 }));
    // a sample input moving along x (tick) with its projections
    const mover = K.dots([[0, Y(F.f(0)), zf]], { r: 0.12, c: 'acc' }); g.add(mover);
    const dmover = K.dots([[0, Y(F.d(0)), zb]], { r: 0.08, o: 0.6 }); g.add(dmover);
    const link = K.line([[0, 0, zb], [0, 1, zf]], { o: 0.25, w: 1 }); g.add(link);
    const place = (x) => {
      const a = [x, Y(F.f(x)), zf], b = [x, Y(F.d(x)), zb];
      const m = new T.Matrix4();
      m.makeScale(0.12, 0.12, 0.12); m.setPosition(a[0], a[1], a[2]); mover.setMatrixAt(0, m); mover.instanceMatrix.needsUpdate = true;
      m.makeScale(0.08, 0.08, 0.08); m.setPosition(b[0], b[1], b[2]); dmover.setMatrixAt(0, m); dmover.instanceMatrix.needsUpdate = true;
      const pa = link.geometry.attributes.position; pa.setXYZ(0, b[0], b[1], b[2]); pa.setXYZ(1, a[0], a[1], a[2]); pa.needsUpdate = true;
    };
    place(1.2);
    const endF = fp[fp.length - 1];
    lab(g, 'f(x)', [X + 0.6, endF[1] + 0.05, zf], { c: 'acc', size: 0.36 });
    lab(g, 'f′(x)', [X + 0.6, Y(F.d(X)) + 0.05, zb], { size: 0.32, o: 0.55 });
    lab(g, 'x', [X + 0.35, -0.3, zf], { size: 0.34, o: 0.6 });
    rails(g, [-X, X], zb, zf, 0.14);
    const gg = turn(g, 0.42);
    const tick = (t) => { const u = (t % 6) / 6; place(-3.4 + 6.8 * (0.5 - 0.5 * Math.cos(u * 2 * Math.PI)) * 0.85 + 0.5 * 0); };
    return { g: gg, legend: [{ c: 'acc', t: 'Activation f(x)' }, { c: 'ink', t: 'Derivative f′(x)' }], tick };
  };

  function swiglu(p, g) {
    const swish = (a) => a * sig(a);
    const R = 3, ys = 0.34;
    g.add(K.surface((a, b) => swish(a) * b, { xr: [-R, R], zr: [-R, R], n: 22, ys, c: 'acc', o: 0.6, fill: 0.1, fc: 'acc' }));
    // floor grid
    const pairs = []; for (let i = 0; i <= 6; i++) { const t = -R + i; pairs.push([[t, -3.2, -R], [t, -3.2, R]]); pairs.push([[-R, -3.2, t], [R, -3.2, t]]); }
    g.add(K.segs(pairs, { o: 0.08 }));
    // gate on the back wall
    const zw = -R - 0.6;
    hline(g, -R, R, 0, zw, { o: 0.3 }); vline(g, 0, -1, 3.2, zw, { o: 0.2 });
    g.add(K.line(samp(swish, -R, R, 80).map(([a, v]) => [a, v * 0.9, zw]), { o: 0.6, w: 1.8 }));
    // linear value branch on the side wall
    const xw = -R - 0.6;
    g.add(K.line([[xw, -0, -R], [xw, 0, R]], { o: 0.3, w: 1 }));
    g.add(K.line([[xw, -R * 0.7, -R], [xw, R * 0.7, R]], { o: 0.6, w: 1.8 }));
    // zero gate line on the surface (a ≈ 0 → output ≈ 0)
    g.add(K.line([[0, 0, -R], [0, 0, R]], { c: 'acc', o: 0.5, w: 1.2, dash: true }));
    lab(g, 'Swish(a)', [R + 0.6, swish(R) * 0.9 + 0.3, zw], { size: 0.32, o: 0.6 });
    lab(g, 'b', [xw, R * 0.7 + 0.4, R], { size: 0.36, o: 0.6 });
    lab(g, 'a', [R + 0.5, -3.2, R + 0.3], { size: 0.36, o: 0.6 });
    lab(g, 'Swish(a)·b', [R + 0.4, swish(R) * R * ys + 0.4, R], { c: 'acc', size: 0.34 });
    return { g, legend: [{ c: 'acc', t: 'Gated output' }, { c: 'ink', t: 'Gate and value inputs' }] };
  }

  function clipF(p, g) {
    const pc = clamp(p.p == null ? 5 : p.p, 1, 20);
    const r = K.rng(29), N = 800;
    const data = Array.from({ length: N }, () => { const t = r.n() / Math.sqrt(Math.max(0.12, (r.n() ** 2 + r.n() ** 2 + r.n() ** 2) / 3)); return t * 0.9; });
    const s = data.slice().sort((a, b) => a - b);
    const lo = s[Math.floor(pc / 100 * (N - 1))], hi = s[Math.floor((1 - pc / 100) * (N - 1))];
    const X = 4, zf = 1.3, zb = -1.6;
    // front: identity faint + clamp in accent
    hline(g, -X, X, 0, zf, { o: 0.4 }); vline(g, 0, -X * 0.8, X * 0.8, zf, { o: 0.4 });
    g.add(K.line([[-X * 0.8, -X * 0.8, zf], [X * 0.8, X * 0.8, zf]], { o: 0.35, w: 1.2, dash: true }));
    const cl = (x) => clamp(x, lo, hi);
    g.add(K.line([[-X, cl(-X), zf], [lo, lo, zf], [hi, hi, zf], [X, cl(X), zf]], { c: 'acc', w: 2.8 }));
    g.add(K.dots([[lo, lo, zf], [hi, hi, zf]], { r: 0.1, c: 'acc' }));
    // back: data histogram, tails beyond bounds faded
    const nb = 40, H = 2.6;
    const c = hist(data, -X, X, nb), m = Math.max(...c), bw = 2 * X / nb;
    c.forEach((n, i) => {
      if (!n) return;
      const xc = -X + bw * (i + 0.5);
      const out = xc < lo || xc > hi;
      bar(g, xc, zb, bw * 0.75, Math.max(0.05, H * n / m), 0.5, out ? ST.ghost : ST.faint, -X * 0.8);
    });
    hline(g, -X, X, -X * 0.8, zb, { o: 0.3 });
    // bounds connecting the two planes
    [lo, hi].forEach((b) => {
      g.add(K.line([[b, -X * 0.8, zb], [b, -X * 0.8, zf]], { c: 'acc', o: 0.45, w: 1.2 }));
      vline(g, b, -X * 0.8, -X * 0.8 + H + 0.2, zb, { c: 'acc', o: 0.55, dash: true, w: 1.2 });
    });
    lab(g, 'P' + pc, [lo, -X * 0.8 - 0.4, zf + 0.3], { c: 'acc', size: 0.3 });
    lab(g, 'P' + (100 - pc), [hi, -X * 0.8 - 0.4, zf + 0.3], { c: 'acc', size: 0.3 });
    lab(g, 'x', [X + 0.35, -0.3, zf], { size: 0.34, o: 0.6 });
    return { g: turn(g, 0.42), legend: [{ c: 'acc', t: 'Clipped values' }, { c: 'ink', t: 'Raw distribution' }], ctl: [{ key: 'p', label: 'p', min: 1, max: 20, step: 1, value: pc }] };
  }

  /* =====================================================================
     QUANT — smooth weights behind, stepped quantized version in front
     ===================================================================== */
  VIZ.quant = function (p, Kk) {
    K = Kk; T = K.THREE;
    const g = new T.Group();
    const bits = clamp(Math.round(p.bits == null ? 3 : p.bits), 2, 8);
    const W = 8.4, n = 400;
    const w = (x) => 1.25 * Math.sin(2 * Math.PI * x * 1.2) + 0.55 * Math.sin(2 * Math.PI * 3.3 * x + 1) + 0.25 * Math.sin(2 * Math.PI * 7.1 * x + 2);
    const xs = Array.from({ length: n + 1 }, (_, i) => i / n);
    const v = xs.map(w);
    const mn = Math.min(...v), mx = Math.max(...v);
    const L = Math.pow(2, bits), D = (mx - mn) / (L - 1);
    const q = (y) => mn + Math.round((y - mn) / D) * D;
    const X = (u) => -W / 2 + W * u, ys = 1.2, Y = (y) => y * ys;
    const zb = -1.8, zf = 1.0;
    // back: smooth
    g.add(K.line(xs.map((u, i) => [X(u), Y(v[i]), zb]), { w: 2, o: 0.6 }));
    // front: stepped (sample-and-hold on a weight grid)
    const m = 64;
    const st = [];
    for (let k = 0; k < m; k++) {
      const u0 = k / m, u1 = (k + 1) / m, y = Y(q(w((u0 + u1) / 2)));
      st.push([X(u0), y, zf], [X(u1), y, zf]);
    }
    g.add(K.line(st, { c: 'acc', w: 2.4 }));
    // faint ghost of the smooth curve on the front plane for comparison
    g.add(K.line(xs.map((u, i) => [X(u), Y(v[i]), zf]), { w: 1, o: 0.3, dash: true }));
    // quantization levels
    if (L <= 32) {
      const pairs = [];
      for (let k = 0; k < L; k++) { const y = Y(mn + k * D); pairs.push([[-W / 2, y, zf], [W / 2, y, zf]]); }
      g.add(K.segs(pairs, { o: L <= 8 ? 0.14 : 0.08 }));
    }
    // ticks of levels at the left edge
    hline(g, -W / 2, W / 2, 0, zb, { o: 0.25 }); hline(g, -W / 2, W / 2, 0, zf, { o: 0.35 });
    rails(g, [-W / 2, W / 2], zb, zf, 0.15);
    // floor projections for depth
    g.add(K.segs([[[-W / 2, Y(mn), zb], [-W / 2, Y(mn), zf]], [[-W / 2, Y(mx), zb], [-W / 2, Y(mx), zf]]], { o: 0.2 }));
    lab(g, 'w', [-W / 2 - 0.5, Y(v[0]) + 0.1, zb], { size: 0.38, o: 0.6 });
    lab(g, 'Q(w)', [W / 2 + 0.7, Y(q(w(1))) + 0.05, zf], { c: 'acc', size: 0.36 });
    lab(g, '2^' + bits + '=' + L, [-W / 2 - 0.9, Y(mx), zf], { size: 0.28, o: 0.55 });
    lab(g, 'INT' + bits, [-W / 2 - 0.75, Y(mn) - 0.05, zf], { c: 'acc', size: 0.32 });
    return { g: turn(g, 0.45), legend: [{ c: 'acc', t: 'Quantized weights' }, { c: 'ink', t: 'Full-precision weights' }], ctl: [{ key: 'bits', label: 'bits', min: 2, max: 8, step: 1, value: bits }] };
  };
})();
