/* Latent Atlas — appendix figures for the 'zdata' chapter. One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K;

  /* ---------- helpers ---------- */
  // axes on a vertical (xy) plane at depth z
  function axes(g, x0, x1, y0, y1, z, o = {}) {
    g.add(K.line([[x0, y0, z], [x1, y0, z]], { o: o.o == null ? 0.5 : o.o, w: 1 }));
    if (o.noY !== true) g.add(K.line([[x0, y0, z], [x0, y1, z]], { o: o.o == null ? 0.5 : o.o, w: 1 }));
  }
  function floorGrid(g, x0, x1, z0, z1, y, n, op) {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      P.push([[x, y, z0], [x, y, z1]]); P.push([[x0, y, z], [x1, y, z]]);
    }
    g.add(K.segs(P, { o: op == null ? 0.08 : op }));
  }
  function normPdf(x, m, s) { return Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)); }
  function sorted(a) { return a.slice().sort((p, q) => p - q); }
  function q(a, t) { const s = sorted(a), i = t * (s.length - 1), lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
  function invNorm(p) { // Acklam approximation
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155211613];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    if (p < 0.02425) { const qq = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * qq + c[1]) * qq + c[2]) * qq + c[3]) * qq + c[4]) * qq + c[5]) / ((((d[0] * qq + d[1]) * qq + d[2]) * qq + d[3]) * qq + 1); }
    if (p > 1 - 0.02425) return -invNorm(1 - p);
    const qq = p - 0.5, r = qq * qq;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * qq / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // table of cells laid on the floor: rows along z, columns along x; returns cell centre fn
  function cellGrid(g, nr, nc, cw, cd, x0, z0, o = {}) {
    const P = [], y = o.y || 0;
    for (let i = 0; i <= nc; i++) P.push([[x0 + i * cw, y, z0], [x0 + i * cw, y, z0 + nr * cd]]);
    for (let j = 0; j <= nr; j++) P.push([[x0, y, z0 + j * cd], [x0 + nc * cw, y, z0 + j * cd]]);
    g.add(K.segs(P, { o: o.o == null ? 0.3 : o.o }));
    return (r, c) => [x0 + (c + 0.5) * cw, y, z0 + (r + 0.5) * cd];
  }
  function series(n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f(i)); return a; }
  function toPts(ys, x0, x1, y0, sy, z) { const n = ys.length; return ys.map((v, i) => [x0 + (x1 - x0) * i / (n - 1), y0 + v * sy, z]); }

  /* ---------- figures ---------- */
  const F = {};

  F.histogram = (g, r) => {
    const data = series(260, () => r.n() * 1.0);
    const nb = 12, lo = -3, hi = 3, bw = 8 / nb, X0 = -4;
    const cnt = new Array(nb).fill(0), bin = (v) => Math.max(0, Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb)));
    data.forEach((v) => cnt[bin(v)]++);
    const mx = Math.max(...cnt), H = 4.2, hb = 7;
    cnt.forEach((c, i) => {
      const h = H * c / mx, x = X0 + (i + 0.5) * bw;
      const on = i === hb;
      g.add(K.box(x, h / 2, 0, bw * 0.92, h, 0.9, on ? { c: 'acc', fill: 0.6, fc: 'acc' } : { o: 0.7, fill: 0.07 }));
    });
    // raw values as a strip of dots on the floor in front
    const pts = [], hot = [];
    data.forEach((v, k) => {
      const x = X0 + (v - lo) / (hi - lo) * 8; if (x < X0 || x > X0 + 8) return;
      const p = [x, 0.02, 1.5 + ((k * 37) % 23) / 23 * 1.6];
      (bin(v) === hb ? hot : pts).push(p);
    });
    g.add(K.dots(pts, { r: 0.045, o: 0.45 }));
    g.add(K.dots(hot, { r: 0.05, c: 'acc' }));
    // bin edges guiding dots into the bar
    const xa = X0 + hb * bw, xb = xa + bw;
    g.add(K.segs([[[xa, 0.01, 0.45], [xa, 0.01, 3.2]], [[xb, 0.01, 0.45], [xb, 0.01, 3.2]]], { c: 'acc', o: 0.6 }));
    axes(g, X0, X0 + 8, 0, H + 0.4, -0.45);
    g.add(K.label('x', [X0 + 8.4, 0, -0.45], { size: 0.38, o: 0.7 }));
    return [{ c: 'acc', t: 'One bin' }];
  };

  F.boxplot = (g, r) => {
    const data = series(80, () => r.n() * 0.8);
    data.push(3.3, 3.0, -2.9);
    const Q1 = q(data, 0.25), Q3 = q(data, 0.75), M = q(data, 0.5), I = Q3 - Q1;
    const lw = Math.min(...data.filter((v) => v >= Q1 - 1.5 * I)), uw = Math.max(...data.filter((v) => v <= Q3 + 1.5 * I));
    const Y = (v) => 2.8 + v * 1.25;
    const W = 1.8, D = 0.8;
    g.add(K.box(0, (Y(Q1) + Y(Q3)) / 2, 0, W, Y(Q3) - Y(Q1), D, { c: 'acc', fill: 0.18, fc: 'acc' }));
    g.add(K.line([[-W / 2, Y(M), D / 2 + 0.01], [W / 2, Y(M), D / 2 + 0.01]], { c: 'acc', w: 3 }));
    g.add(K.line([[-W / 2, Y(M), -D / 2], [W / 2, Y(M), -D / 2]], { c: 'acc', w: 1.4, o: 0.6 }));
    g.add(K.line([[0, Y(Q3), 0], [0, Y(uw), 0]], { w: 1.6 }));
    g.add(K.line([[0, Y(Q1), 0], [0, Y(lw), 0]], { w: 1.6 }));
    g.add(K.line([[-0.45, Y(uw), 0], [0.45, Y(uw), 0]], { w: 1.6 }));
    g.add(K.line([[-0.45, Y(lw), 0], [0.45, Y(lw), 0]], { w: 1.6 }));
    const out = data.filter((v) => v < lw || v > uw).map((v) => [0, Y(v), 0]);
    g.add(K.dots(out, { r: 0.09, hollow: true }));
    // raw data as a jittered strip to the left
    g.add(K.dots(data.filter((v) => v >= lw && v <= uw).map((v, k) => [-3 + ((k * 29) % 17) / 17 * 1.1, Y(v), 0]), { r: 0.05, o: 0.4 }));
    // quartile guides from strip to box
    [Q1, M, Q3].forEach((v) => g.add(K.line([[-3.1, Y(v), 0], [-W / 2 - 0.1, Y(v), 0]], { o: 0.3, w: 1, dash: true })));
    g.add(K.label('Q1', [W / 2 + 0.75, Y(Q1), D / 2], { size: 0.34, o: 0.75 }));
    g.add(K.label('Q3', [W / 2 + 0.75, Y(Q3), D / 2], { size: 0.34, o: 0.75 }));
    g.add(K.label('x̃', [W / 2 + 0.75, Y(M), D / 2], { size: 0.4, c: 'acc' }));
    return [{ c: 'acc', t: 'Box and median' }];
  };

  F.scatterplot = (g, r) => {
    const pts = [];
    for (let i = 0; i < 70; i++) { const x = r.range(-3.6, 3.6); pts.push([x, Math.max(0.35, 2.6 + 0.5 * x + r.n() * 0.55), 0]); }
    const k = 0; pts[k] = [1.8, 2.6 + 0.9 + 0.35, 0];
    g.add(K.dots(pts.slice(1), { r: 0.07, o: 0.75 }));
    const p = pts[k];
    g.add(K.dots([p], { r: 0.13, c: 'acc' }));
    g.add(K.line([[p[0], 0, 0], p], { c: 'acc', o: 0.7, w: 1.4, dash: true }));
    g.add(K.line([[-4, p[1], 0], p], { c: 'acc', o: 0.7, w: 1.4, dash: true }));
    axes(g, -4, 4, 0, 5.2, 0);
    g.add(K.label('x', [4.4, 0, 0], { size: 0.4, o: 0.75 }));
    g.add(K.label('y', [-4, 5.6, 0], { size: 0.4, o: 0.75 }));
    g.add(K.label('xᵢ', [p[0], -0.4, 0], { size: 0.38, c: 'acc' }));
    g.add(K.label('yᵢ', [-4.45, p[1], 0], { size: 0.38, c: 'acc' }));
    floorGrid(g, -4, 4, -1.5, 1.5, 0, 8, 0.07);
    return [{ c: 'acc', t: 'One observation' }];
  };

  F.heatmap = (g, r) => {
    // a matrix of cells standing upright; colour intensity encodes each cell's value
    const n = 9, cs = 0.62, x0 = -n * cs / 2 - 0.4, yt = n * cs;
    const P = [];
    for (let i = 0; i <= n; i++) { P.push([[x0 + i * cs, 0, 0], [x0 + i * cs, yt, 0]]); P.push([[x0, i * cs, 0], [x0 + n * cs, i * cs, 0]]); }
    g.add(K.segs(P, { o: 0.2 }));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a1 = (i - 2.2) / 1.6, b1 = (j - 6) / 1.8, a2 = (i - 6.2) / 1.4, b2 = (j - 2.5) / 1.3;
      const v = Math.min(1, 0.95 * Math.exp(-(a1 * a1 + b1 * b1) / 2) + 0.7 * Math.exp(-(a2 * a2 + b2 * b2) / 2) + 0.06 * r());
      const x = x0 + (j + 0.5) * cs, y = yt - (i + 0.5) * cs, d = 0.04 + 0.36 * v;
      g.add(K.box(x, y, d / 2, cs * 0.94, cs * 0.94, d, { c: 'acc', o: 0.1 + 0.4 * v, fill: 0.04 + 0.86 * v, fc: 'acc' }));
    }
    // colour scale bar
    const bx = x0 + n * cs + 0.8;
    for (let k = 0; k < 8; k++) { const v = k / 7; g.add(K.box(bx, 0.6 + k * 0.5, 0.15, 0.4, 0.48, 0.3, { c: 'acc', o: 0.1 + 0.4 * v, fill: 0.04 + 0.86 * v, fc: 'acc' })); }
    g.add(K.label('0', [bx + 0.6, 0.6, 0.15], { size: 0.32, o: 0.7 }));
    g.add(K.label('1', [bx + 0.6, 0.6 + 7 * 0.5, 0.15], { size: 0.32, o: 0.7 }));
    g.add(K.label('i', [x0 - 0.4, yt / 2, 0], { size: 0.38, o: 0.6 }));
    g.add(K.label('j', [x0 + n * cs / 2, yt + 0.4, 0], { size: 0.38, o: 0.6 }));
    return [{ c: 'acc', t: 'Cell value' }];
  };

  F.qqplot = (g, r) => {
    const n = 40;
    const smp = sorted(series(n, () => { const v = r.n(); return v * (1 + 0.28 * v * v); }));
    const S = 0.8, cy = 2.6;
    const pts = smp.map((v, i) => { const t = invNorm((i + 0.5) / n); return [t * S * 1.25, cy + Math.max(-3.2, Math.min(3.2, v)) * S * 0.8, 0]; });
    g.add(K.line([[-3.4, cy - 3.4 * 0.8, 0], [3.4, cy + 3.4 * 0.8, 0]], { o: 0.55, w: 1.4, dash: true }));
    g.add(K.dots(pts, { r: 0.085, c: 'acc' }));
    axes(g, -3.6, 3.6, cy - 2.9, cy + 2.9, 0, { o: 0.4 });
    g.add(K.line([[0, cy - 2.9, 0], [0, cy + 2.9, 0]], { o: 0.12, w: 1 }));
    g.add(K.line([[-3.6, cy, 0], [3.6, cy, 0]], { o: 0.12, w: 1 }));
    // reference normal pdf along the bottom (theoretical) and the sample histogram along the side, at depth
    const pdf = []; for (let i = 0; i <= 60; i++) { const x = -3.4 + 6.8 * i / 60; pdf.push([x, cy - 2.9 + 3.2 * normPdf(x / (S * 1.25), 0, 1), -2]); }
    g.add(K.line(pdf, { o: 0.35, w: 1.2 }));
    g.add(K.line([[-3.6, cy - 2.9, -2], [3.6, cy - 2.9, -2]], { o: 0.25, w: 1 }));
    g.add(K.label('N(0,1)', [0, cy - 1.3, -2], { size: 0.3, o: 0.5 }));
    floorGrid(g, -3.6, 3.6, -2, 0, cy - 2.9, 6, 0.06);
    g.add(K.label('θ', [3.95, cy - 2.9, 0], { size: 0.36, o: 0.7 }));
    g.add(K.label('x₍ᵢ₎', [-3.6, cy + 3.3, 0], { size: 0.36, o: 0.7 }));
    return [{ c: 'acc', t: 'Sample quantiles' }, { c: 'ink', t: 'Reference line y = x' }];
  };

  /* spreadsheet standing in the xy plane: rows go down, columns go right */
  function sheet(g, nr, nc, cw, ch, x0, yt, z, o = {}) {
    const P = [];
    for (let i = 0; i <= nc; i++) P.push([[x0 + i * cw, yt, z], [x0 + i * cw, yt - nr * ch, z]]);
    for (let j = 0; j <= nr; j++) P.push([[x0, yt - j * ch, z], [x0 + nc * cw, yt - j * ch, z]]);
    g.add(K.segs(P, { o: o.o == null ? 0.25 : o.o }));
    g.add(K.line([[x0, yt, z], [x0 + nc * cw, yt, z]], { o: 0.7, w: 1.6 }));
    const at = (i, j) => [x0 + (j + 0.5) * cw, yt - (i + 0.5) * ch, z];
    return { at, cw, ch, x0, yt, z, nr, nc };
  }
  // data bar in a cell: width proportional to v in [0,1], a little depth
  function dbar(g, S, i, j, v, st) {
    const c = S.at(i, j), w = Math.max(0.05, S.cw * 0.8 * v), x = c[0] - S.cw * 0.4 + w / 2;
    const o = st === 'acc' ? { c: 'acc', fill: 0.7, o: 1 } : st === 'dark' ? { fill: 0.6, o: 1 } : st === 'ghost' ? { c: 'acc', o: 0.9, w: 1.4 } : { fill: 0.18, o: 0.45 };
    g.add(K.rect(x, c[1], c[2] + 0.02, w, S.ch * 0.46, 'xy', o));
  }
  function cellFill(g, S, i, j, c, f) { const p = S.at(i, j); g.add(K.rect(p[0], p[1], p[2] + 0.005, S.cw, S.ch, 'xy', { c, fill: f, o: 0 })); }
  function heads(g, S, names, hi) {
    names.forEach((t, j) => { const c = S.at(0, j); g.add(K.label(t, [c[0], S.yt + 0.35, S.z], { size: 0.36, c: j === hi ? 'acc' : undefined, o: j === hi ? 1 : 0.6 })); });
  }
  function vals(r, nr, nc) { const a = []; for (let i = 0; i < nr; i++) { a.push([]); for (let j = 0; j < nc; j++) a[i].push(0.15 + 0.85 * r()); } return a; }

  F.feature = (g, r) => {
    const nr = 9, nc = 5, S = sheet(g, nr, nc, 1.5, 0.55, -3.75, 5, 0), A = vals(r, nr, nc);
    A.forEach((row, i) => row.forEach((v, j) => dbar(g, S, i, j, v, j === 2 ? 'acc' : null)));
    const c = S.at(0, 2);
    g.add(K.rect(c[0], S.yt - nr * S.ch / 2, 0.01, S.cw, nr * S.ch, 'xy', { c: 'acc', fill: 0.1, w: 2 }));
    heads(g, S, ['x₁', 'x₂', 'x₃', 'x₄', 'x₅'], 2);
    return [{ c: 'acc', t: 'One feature column' }];
  };

  F.label = (g, r) => {
    const nr = 9, nc = 4, S = sheet(g, nr, nc, 1.35, 0.55, -4.4, 5, 0), A = vals(r, nr, nc);
    A.forEach((row, i) => row.forEach((v, j) => dbar(g, S, i, j, v, null)));
    heads(g, S, ['x₁', 'x₂', 'x₃', 'x₄'], -1);
    // separate label column
    const L = sheet(g, nr, 1, 1.2, 0.55, 2.6, 5, 0, { o: 0.5 });
    for (let i = 0; i < nr; i++) { const c = L.at(i, 0); g.add(K.dots([[c[0], c[1], 0.1]], { r: 0.15, c: 'acc', hollow: r() < 0.5 })); }
    g.add(K.rect(L.at(0, 0)[0], 5 - nr * 0.55 / 2, 0.01, 1.2, nr * 0.55, 'xy', { c: 'acc', fill: 0.1, w: 2 }));
    g.add(K.label('y', [L.at(0, 0)[0], 5.35, 0], { size: 0.42, c: 'acc' }));
    g.add(K.arrow([1.15, 5 - nr * 0.55 / 2, 0.2], [2.45, 5 - nr * 0.55 / 2, 0.2], { o: 0.55, w: 1.6, head: 0.3 }));
    g.add(K.label('f(x) → y', [1.8, 5 - nr * 0.55 / 2 + 0.45, 0.2], { size: 0.3, o: 0.6 }));
    return [{ c: 'acc', t: 'Label column' }];
  };

  F.tabular = (g, r) => {
    const nr = 9, nc = 5, S = sheet(g, nr, nc, 1.5, 0.55, -3.75, 5, 0), hr = 3;
    const cats = ['A', 'B', 'C'];
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      const on = i === hr, c = S.at(i, j);
      if (j === 1 || j === 3) g.add(K.dots([[c[0] - 0.3 + 0.3 * r.int(0, 2), c[1], 0.08]], { r: 0.1, c: on ? 'acc' : undefined, o: on ? 1 : 0.5 }));
      else if (j === 4) g.add(K.dots([[c[0], c[1], 0.08]], { r: 0.13, c: on ? 'acc' : undefined, o: on ? 1 : 0.5, hollow: r() < 0.5 }));
      else dbar(g, S, i, j, 0.15 + 0.85 * r(), on ? 'acc' : null);
    }
    const c = S.at(hr, 0);
    g.add(K.rect(S.x0 + nc * S.cw / 2, c[1], 0.01, nc * S.cw, S.ch, 'xy', { c: 'acc', fill: 0.1, w: 2 }));
    heads(g, S, ['x₁', 'x₂', 'x₃', 'x₄', 'y'], -1);
    return [{ c: 'acc', t: 'One record (row)' }];
  };

  F.missingval = (g, r) => {
    const nr = 9, nc = 3, cw = 0.85, ch = 0.5;
    const A = vals(r, nr, nc);
    const c0 = [0.3, 0.9, 0.4, 0.8, 0.2, 0.5, 0.95, 0.35, 0.55], c1 = [0.5, 0.9, 0.3, 0.4, 0.85, 0.2, 0.75, 0.95, 0.35];
    A.forEach((row, i) => { row[0] = c0[i]; row[1] = c1[i]; });
    const panels = [['MCAR', -3.5, 0.9], ['MAR', 0, 0], ['MNAR', 3.5, -0.9]];
    panels.forEach(([nm, cx, z], pi) => {
      const S = sheet(g, nr, nc, cw, ch, cx - nc * cw / 2, 5, z);
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const v = A[i][j];
        let miss = false;
        if (j === 1) {
          if (pi === 0) miss = [2, 5, 7].includes(i);
          if (pi === 1) miss = A[i][0] > 0.62;         // driven by another, observed column
          if (pi === 2) miss = v > 0.62;               // driven by its own hidden value
        }
        if (miss) {
          cellFill(g, S, i, j, 'acc', 0.45);
          if (pi === 2) dbar(g, S, i, j, v, 'ghost');
        } else dbar(g, S, i, j, v, pi === 1 && j === 0 && A[i][0] > 0.62 ? 'dark' : null);
      }
      g.add(K.label(nm, [cx, 5.45, z], { size: 0.4, o: 0.85 }));
    });
    return [{ c: 'acc', t: 'Missing value' }];
  };

  F.duplicates = (g, r) => {
    const nr = 9, nc = 5, S = sheet(g, nr, nc, 1.4, 0.55, -4.2, 5, 0), A = vals(r, nr, nc);
    A[5] = A[1].slice(); A[8] = A[1].slice();
    const dup = [1, 5, 8];
    A.forEach((row, i) => row.forEach((v, j) => dbar(g, S, i, j, v, dup.includes(i) ? 'acc' : null)));
    dup.forEach((i) => { const c = S.at(i, 0); g.add(K.rect(S.x0 + nc * S.cw / 2, c[1], 0.01, nc * S.cw, S.ch, 'xy', { c: 'acc', fill: 0.08, w: 1.4 })); });
    const xr = S.x0 + nc * S.cw + 0.1;
    [[1, 5], [5, 8]].forEach(([a, b]) => {
      const A0 = S.at(a, 0)[1], B0 = S.at(b, 0)[1];
      const P = []; for (let k = 0; k <= 24; k++) { const t = k / 24; P.push([xr + Math.sin(Math.PI * t) * 0.8, A0 + (B0 - A0) * t, 0]); }
      g.add(K.line(P, { c: 'acc', w: 1.8 }));
      g.add(K.label('=', [xr + 1.15, (A0 + B0) / 2, 0], { size: 0.5, c: 'acc' }));
    });
    return [{ c: 'acc', t: 'Duplicate rows' }];
  };

  F.numcat = (g, r) => {
    // numerical: a continuous axis, values anywhere along it (dot plot)
    const X0 = -4.8, X1 = -0.6, nb = 14, cnt = new Array(nb).fill(0), pts = [];
    for (let k = 0; k < 30; k++) { const v = Math.max(0, Math.min(0.999, 0.5 + r.n() * 0.22)); const b = Math.floor(v * nb); pts.push([X0 + (b + 0.5) * (X1 - X0) / nb, 0.2 + cnt[b] * 0.28, 0]); cnt[b]++; }
    g.add(K.dots(pts, { r: 0.1, c: 'acc' }));
    g.add(K.arrow([X0 - 0.1, 0, 0], [X1 + 0.3, 0, 0], { c: 'acc', w: 1.8, head: 0.25 }));
    for (let i = 0; i <= 10; i++) { const x = X0 + (X1 - X0) * i / 10; g.add(K.line([[x, -0.12, 0], [x, 0, 0]], { c: 'acc', o: 0.6, w: 1 })); }
    g.add(K.label('1.7', [X0, -0.45, 0], { size: 0.32, c: 'acc', o: 0.85 }));
    g.add(K.label('42.0', [X1, -0.45, 0], { size: 0.32, c: 'acc', o: 0.85 }));
    // categorical: separate buckets, no axis between them
    [['A', 6], ['B', 3], ['C', 4]].forEach(([t, n], k) => {
      const x = 1.0 + k * 1.6;
      g.add(K.box(x, 1.2, 0, 1.1, 2.4, 0.9, { c: 'b', o: 0.55, fill: 0.04, fc: 'b' }));
      const P = []; for (let m = 0; m < n; m++) P.push([x, 0.2 + m * 0.36, 0]);
      g.add(K.dots(P, { r: 0.14, c: 'b', hollow: true }));
      g.add(K.label(t, [x, -0.45, 0.45], { size: 0.42, c: 'b' }));
    });
    floorGrid(g, -5, 5, -1.6, 1.6, -0.01, 10, 0.06);
    return [{ c: 'acc', t: 'Numerical' }, { c: 'b', t: 'Categorical' }];
  };

  F.ordinal = (g, r) => {
    // ordinal: a staircase, every level above the previous one
    const lv = ['S', 'M', 'L', 'XL'];
    lv.forEach((t, k) => {
      const x = -4.4 + k * 1.05, h = 0.5 + k * 0.75;
      g.add(K.box(x, h / 2, 0, 0.8, h, 0.8, { c: 'acc', fill: 0.35, fc: 'acc' }));
      g.add(K.label(t, [x, h + 0.35, 0], { size: 0.4, c: 'acc' }));
    });
    g.add(K.arrow([-4.6, 1.5, 0], [-1.2, 3.9, 0], { c: 'acc', o: 0.7, w: 1.6, head: 0.28 }));
    // nominal: same-sized blocks on a ring, no order
    const nm = ['A', 'B', 'C', 'D', 'E'], cx = 2.7, R = 1.5;
    nm.forEach((t, k) => {
      const a = 2 * Math.PI * k / nm.length + 1.0, x = cx + R * Math.cos(a), z = R * Math.sin(a);
      g.add(K.box(x, 0.45, z, 0.7, 0.9, 0.7, { c: 'b', fill: 0.18, fc: 'b' }));
      g.add(K.label(t, [x, 1.25, z], { size: 0.4, c: 'b' }));
    });
    const C = []; for (let i = 0; i <= 60; i++) { const a = 2 * Math.PI * i / 60; C.push([cx + R * Math.cos(a), 0, R * Math.sin(a)]); }
    g.add(K.line(C, { c: 'b', o: 0.35, w: 1, dash: true }));
    floorGrid(g, -5.2, 4.6, -2, 2, -0.01, 10, 0.06);
    return [{ c: 'acc', t: 'Ordinal (ordered)' }, { c: 'b', t: 'Nominal (unordered)' }];
  };

  F.cardinality = (g, r) => {
    const X0 = -4.2, W = 8.4;
    // back: low cardinality, 3 distinct values with big counts
    [34, 22, 14].forEach((c, k) => { const h = c * 0.11; g.add(K.box(X0 + 1.2 + k * 1.6, h / 2, -1.6, 1.1, h, 0.8, { c: 'b', fill: 0.25, fc: 'b' })); });
    g.add(K.label('3', [X0 + 6.4, 0.4, -1.6], { size: 0.5, c: 'b' }));
    // front: high cardinality, many distinct values with count ≈ 1
    const n = 36, w = W / n;
    for (let k = 0; k < n; k++) { const h = (r() < 0.12 ? 2 : 1) * 0.3; g.add(K.box(X0 + (k + 0.5) * w, h / 2, 1.4, w * 0.6, h, 0.5, { c: 'acc', fill: 0.6, fc: 'acc' })); }
    g.add(K.label(String(n), [X0 + W + 0.6, 0.3, 1.4], { size: 0.5, c: 'acc' }));
    floorGrid(g, X0, X0 + W, -2.2, 2.2, -0.01, 8, 0.07);
    return [{ c: 'b', t: 'Low cardinality' }, { c: 'acc', t: 'High cardinality' }];
  };

  F.labelnoise = (g, r) => {
    const A = [], B = [], flipA = [], flipB = [];
    for (let i = 0; i < 110; i++) {
      const x = r.range(-4, 4), z = r.range(-3, 3), s = x * 0.8 + z * 0.6;
      if (Math.abs(s) < 0.35) continue;
      const pos = s > 0, flip = r() < 0.06;
      const p = [x, 0.12, z];
      if (pos !== flip) (flip ? flipA : A).push(p); else (flip ? flipB : B).push(p);
    }
    g.add(K.dots(A, { r: 0.1, o: 0.8 }));
    g.add(K.dots(B, { r: 0.12, o: 0.6, hollow: true }));
    // flipped labels in accent, lifted on stems
    flipA.forEach((p) => { g.add(K.dots([[p[0], 0.6, p[2]]], { r: 0.14, c: 'acc' })); g.add(K.line([[p[0], 0, p[2]], [p[0], 0.5, p[2]]], { c: 'acc', o: 0.6, w: 1 })); g.add(K.rect(p[0], 0.005, p[2], 0.3, 0.3, 'xz', { c: 'acc', o: 0.6 })); });
    flipB.forEach((p) => { g.add(K.dots([[p[0], 0.6, p[2]]], { r: 0.16, c: 'acc', hollow: true })); g.add(K.line([[p[0], 0, p[2]], [p[0], 0.5, p[2]]], { c: 'acc', o: 0.6, w: 1 })); g.add(K.rect(p[0], 0.005, p[2], 0.3, 0.3, 'xz', { c: 'acc', o: 0.6 })); });
    // true boundary
    const z1 = 3, z0 = -3; g.add(K.line([[-0.6 * z0 / 0.8, 0.01, z0], [-0.6 * z1 / 0.8, 0.01, z1]], { o: 0.55, w: 1.4, dash: true }));
    floorGrid(g, -4.2, 4.2, -3.2, 3.2, 0, 8, 0.06);
    return [{ c: 'acc', t: 'Flipped labels' }];
  };

  F.sparsedata = (g, r) => {
    const nr = 14, nc = 22, s = 0.38, x0 = -nc * s / 2, z0 = -nr * s / 2;
    const P = [], nz = [];
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      const c = [x0 + (j + 0.5) * s, 0, z0 + (i + 0.5) * s];
      if (r() < 0.06) nz.push([c, 0.3 + 0.9 * r()]); else P.push(c);
    }
    g.add(K.dots(P, { r: 0.03, o: 0.3 }));
    nz.forEach(([c, v]) => g.add(K.box(c[0], v / 2, c[2], s * 0.7, v, s * 0.7, { c: 'acc', fill: 0.6, fc: 'acc' })));
    g.add(K.rect(0, -0.01, 0, nc * s, nr * s, 'xz', { o: 0.4 }));
    return [{ c: 'acc', t: 'Non-zero entries' }];
  };

  F.interaction = (g, r) => {
    const f = (x, z) => 0.13 * x * z;
    g.add(K.surface((x, z) => 2 + f(x, z), { xr: [-3.5, 3.5], zr: [-3, 3], n: 18, o: 0.25 }));
    // slices: effect of x1 depends on x2
    [-2.4, 2.4].forEach((z) => {
      const P = []; for (let i = 0; i <= 30; i++) { const x = -3.5 + 7 * i / 30; P.push([x, 2 + f(x, z), z]); }
      g.add(K.line(P, { c: 'acc', w: 2.8 }));
      g.add(K.label(z > 0 ? 'x₂ > 0' : 'x₂ < 0', [-4.6, 2 + f(-3.5, z), z], { size: 0.42, c: 'acc' }));
    });
    floorGrid(g, -3.5, 3.5, -3, 3, -0.3, 7, 0.07);
    g.add(K.label('x₁', [4.0, -0.3, -3], { size: 0.38, o: 0.7 }));
    g.add(K.label('x₂', [-3.5, -0.3, 3.5], { size: 0.38, o: 0.7 }));
    g.add(K.label('y', [-3.5, 4.4, -3], { size: 0.38, o: 0.7 }));
    g.add(K.line([[-3.5, -0.3, -3], [-3.5, 4.1, -3]], { o: 0.4, w: 1 }));
    return [{ c: 'acc', t: 'Slope of x₁ flips' }];
  };

  F.baseline = (g, r) => {
    // front: data + a flat "predict the mean" line (accent) + a fitted model (ink)
    const xs = series(34, (i) => -4 + 8 * i / 33), ys = xs.map((x) => 2 + 0.35 * x + 0.5 * Math.sin(x * 1.1) + r.n() * 0.3);
    const m = ys.reduce((a, b) => a + b, 0) / ys.length;
    g.add(K.dots(xs.map((x, i) => [x, ys[i], 1.2]), { r: 0.07, o: 0.7 }));
    g.add(K.line([[-4.2, m, 1.2], [4.2, m, 1.2]], { c: 'acc', w: 2.6 }));
    const P = []; for (let i = 0; i <= 50; i++) { const x = -4 + 8 * i / 50; P.push([x, 2 + 0.35 * x + 0.5 * Math.sin(x * 1.1), 1.2]); }
    g.add(K.line(P, { w: 1.8, o: 0.85 }));
    axes(g, -4.2, 4.2, 0, 4, 1.2, { o: 0.4 });
    g.add(K.label('ȳ', [-4.6, m, 1.2], { size: 0.42, c: 'acc' }));
    // back: error bars — baseline vs model; the bar to beat
    const eb = 2.6, em = 1.1;
    g.add(K.box(5.8, eb / 2, 1.2, 0.9, eb, 0.6, { c: 'acc', fill: 0.5, fc: 'acc' }));
    g.add(K.box(7.0, em / 2, 1.2, 0.9, em, 0.6, { o: 0.7, fill: 0.08 }));
    g.add(K.line([[5.2, eb, 1.2], [7.6, eb, 1.2]], { c: 'acc', o: 0.6, w: 1.2, dash: true }));
    g.add(K.line([[5.1, 0, 1.2], [7.7, 0, 1.2]], { o: 0.4, w: 1 }));
    g.add(K.label('MSE', [6.4, -0.4, 1.2], { size: 0.32, o: 0.6 }));
    return [{ c: 'acc', t: 'Baseline (mean)' }, { c: 'ink', t: 'Real model' }];
  };

  F.timeseries = (g, r) => {
    const n = 40;
    const mk = (seed, amp) => { const rr = K.rng(seed); let v = 0; return series(n, (i) => { v = 0.7 * v + rr.n() * 0.35; return amp * Math.sin(i / 4) + v; }); };
    const s1 = mk(3, 0.8), s2 = mk(9, 0.5), s3 = mk(17, 0.6);
    [[s2, -1.6], [s3, -3.2]].forEach(([s, z]) => g.add(K.line(toPts(s, -4.2, 4.2, 1.8, 0.8, z), { o: 0.3, w: 1.2 })));
    const P = toPts(s1, -4.2, 4.2, 2, 1, 0);
    g.add(K.line(P, { c: 'acc', w: 2 }));
    g.add(K.dots(P, { r: 0.06, c: 'acc' }));
    // regular time ticks
    const T = []; P.forEach((p, i) => { if (i % 2 === 0) T.push([[p[0], 0, 0], [p[0], 0.12, 0]]); });
    g.add(K.segs(T, { o: 0.5 }));
    g.add(K.arrow([-4.4, 0, 0], [4.8, 0, 0], { o: 0.6, w: 1.2, head: 0.25 }));
    g.add(K.label('t', [5.1, 0, 0], { size: 0.42, o: 0.75 }));
    g.add(K.label('yₜ', [-4.8, 2, 0], { size: 0.4, c: 'acc' }));
    floorGrid(g, -4.2, 4.2, -3.4, 0.4, -0.01, 8, 0.06);
    return [{ c: 'acc', t: 'Observations in time order' }];
  };

  F.trend = (g, r) => {
    const n = 70, tr = (i) => 0.6 + 3.2 * Math.pow(i / (n - 1), 1.3);
    const ys = series(n, (i) => tr(i) + 0.5 * Math.sin(i / 2.2) + r.n() * 0.3);
    g.add(K.line(toPts(ys, -4.5, 4.5, 0, 1, 0), { o: 0.45, w: 1.2 }));
    g.add(K.dots(toPts(ys, -4.5, 4.5, 0, 1, 0), { r: 0.04, o: 0.45 }));
    g.add(K.line(toPts(series(n, tr), -4.5, 4.5, 0, 1, 0), { c: 'acc', w: 3 }));
    g.add(K.arrow([-4.6, -0.3, 0], [4.9, -0.3, 0], { o: 0.5, w: 1, head: 0.22 }));
    g.add(K.label('t', [5.2, -0.3, 0], { size: 0.4, o: 0.7 }));
    floorGrid(g, -4.5, 4.5, -2.4, 0.6, -0.31, 9, 0.06);
    return [{ c: 'acc', t: 'Trend' }];
  };

  F.seasonality = (g, r) => {
    // the series cut into periods and stacked along depth: every period has the same shape
    const per = 24, np = 5, shape = (k) => 1.1 * Math.sin(2 * Math.PI * k / per) + 0.5 * Math.sin(4 * Math.PI * k / per + 0.6);
    for (let p = 0; p < np; p++) {
      const z = 2.6 - p * 1.3, lvl = 1.8;
      const ys = series(per + 1, (k) => shape(k) + r.n() * 0.1);
      g.add(K.line(toPts(ys, -3.5, 3.5, lvl, 1, z), { o: 0.55, w: 1.3 }));
      g.add(K.line([[-3.5, 0, z], [3.5, 0, z]], { o: 0.18, w: 1 }));
    }
    // mean seasonal profile in accent, in front
    const prof = series(per + 1, shape);
    g.add(K.line(toPts(prof, -3.5, 3.5, 1.8, 1, 3.9), { c: 'acc', w: 3 }));
    g.add(K.line([[-3.5, 0, 3.9], [3.5, 0, 3.9]], { c: 'acc', o: 0.4, w: 1 }));
    // one period bracket
    g.add(K.line([[-3.5, -0.35, 3.9], [3.5, -0.35, 3.9]], { c: 'acc', w: 1.2 }));
    g.add(K.line([[-3.5, -0.5, 3.9], [-3.5, -0.2, 3.9]], { c: 'acc', w: 1.2 }));
    g.add(K.line([[3.5, -0.5, 3.9], [3.5, -0.2, 3.9]], { c: 'acc', w: 1.2 }));
    g.add(K.label('m', [0, -0.75, 3.9], { size: 0.42, c: 'acc' }));
    return [{ c: 'acc', t: 'Repeating pattern' }];
  };

  F.whitenoise = (g, r) => {
    const n = 80, ys = series(n, () => r.n() * 0.7);
    const P = toPts(ys, -4.5, 4.5, 2.4, 1, 0);
    g.add(K.line(P, { w: 1.1, o: 0.7 }));
    g.add(K.dots(P, { r: 0.045, o: 0.8 }));
    g.add(K.line([[-4.5, 2.4, 0], [4.5, 2.4, 0]], { c: 'acc', w: 2 }));
    g.add(K.rect(0, 2.4, 0, 9, 2 * 0.7 * 2, 'xy', { c: 'acc', fill: 0.08, o: 0.5, w: 1 }));
    g.add(K.label('μ = 0', [-5.4, 2.4, 0], { size: 0.32, c: 'acc' }));
    g.add(K.label('±2σ', [-5.2, 2.4 + 1.4, 0], { size: 0.32, c: 'acc', o: 0.8 }));
    // marginal histogram on the right: the same distribution at every step
    const nb = 9, lo = -1.8, hi = 1.8, cnt = new Array(nb).fill(0);
    ys.forEach((v) => { const k = Math.floor((v - lo) / (hi - lo) * nb); if (k >= 0 && k < nb) cnt[k]++; });
    const mx = Math.max(...cnt), bh = (hi - lo) / nb;
    cnt.forEach((c, k) => { const w = 1.6 * c / mx; g.add(K.box(4.8 + w / 2, 2.4 + lo + (k + 0.5) * bh, 0, w, bh * 0.9, 0.5, { o: 0.6, fill: 0.08 })); });
    g.add(K.line([[4.8, 2.4 + lo, 0], [4.8, 2.4 + hi, 0]], { o: 0.5, w: 1 }));
    return [{ c: 'acc', t: 'Constant mean and spread' }];
  };

  F.randomwalk = (g, r) => {
    // several walks from the same start, fanned out in depth; one in accent
    const n = 60, x0 = -4.5, x1 = 4.5, y0 = 2.4, sd = 0.28;
    for (let k = 0; k < 9; k++) {
      let v = 0; const ys = [0]; for (let i = 1; i < n; i++) { v += r.n() * sd; ys.push(v); }
      const on = k === 4, zk = on ? 0 : (k - 4) * 0.55;
      const P = ys.map((y, i) => [x0 + (x1 - x0) * i / (n - 1), y0 + y, zk * i / (n - 1)]);
      g.add(K.line(P, on ? { c: 'acc', w: 2.6 } : { o: 0.3, w: 1 }));
    }
    // ±√t envelope: spread grows with the square root of time
    const up = [], dn = []; for (let i = 0; i <= 40; i++) { const t = i / 40, x = x0 + (x1 - x0) * t, s = 1.4 * sd * Math.sqrt(t * (n - 1)); up.push([x, y0 + s, 0]); dn.push([x, y0 - s, 0]); }
    g.add(K.line(up, { o: 0.5, w: 1.2, dash: true })); g.add(K.line(dn, { o: 0.5, w: 1.2, dash: true }));
    g.add(K.dots([[x0, y0, 0]], { r: 0.12 }));
    g.add(K.label('±√t', [x1 + 0.6, y0 + 1.4 * sd * Math.sqrt(n - 1), 0], { size: 0.4, o: 0.75 }));
    g.add(K.label('yₜ = yₜ₋₁ + εₜ', [-2.2, y0 + 3.4, 0], { size: 0.42, c: 'acc' }));
    floorGrid(g, x0, x1, -2.4, 2.4, -0.01, 9, 0.06);
    return [{ c: 'acc', t: 'One walk' }];
  };

  F.differencing = (g, r) => {
    const n = 34; let v = 0; const ys = series(n, (i) => (v += 0.13 + r.n() * 0.18, v));
    const d = ys.slice(1).map((y, i) => y - ys[i]);
    // back: trending series with its step sizes marked
    const P = toPts(ys, -4.2, 4.2, 1.9, 1, -1.6);
    g.add(K.line(P, { w: 1.8, o: 0.8 }));
    const st = []; for (let i = 1; i < n; i++) st.push([[P[i][0], P[i - 1][1], -1.6], [P[i][0], P[i][1], -1.6]]);
    g.add(K.segs(st, { c: 'acc', o: 0.7, w: 2 }));
    g.add(K.label('yₜ', [-4.8, 2.1, -1.6], { size: 0.42, o: 0.75 }));
    // front: the differences, flat around a constant level
    const y0 = 0.2, S = 3;
    const D = d.map((v, i) => [-4.2 + 8.4 * (i + 1) / (n - 1), y0 + 0.8 + v * S, 1.6]);
    g.add(K.line([[-4.2, y0 + 0.8, 1.6], [4.2, y0 + 0.8, 1.6]], { o: 0.35, w: 1, dash: true }));
    D.forEach((p) => g.add(K.line([[p[0], y0 + 0.8, 1.6], p], { c: 'acc', o: 0.5, w: 1 })));
    g.add(K.line(D, { c: 'acc', w: 2 }));
    g.add(K.dots(D, { r: 0.05, c: 'acc' }));
    g.add(K.label('Δyₜ', [-4.8, y0 + 0.8, 1.6], { size: 0.4, c: 'acc' }));
    floorGrid(g, -4.2, 4.2, -1.6, 1.6, 0, 8, 0.06);
    return [{ c: 'acc', t: 'Differenced series' }];
  };

  F.horizon = (g, r) => {
    const nh = 36, nf = 18, x0 = -4.6, xn = 1.2, x1 = 4.6, base = (i) => 2.2 + 0.4 * Math.sin(i / 3.5) + i * 0.02;
    const hist = series(nh, (i) => base(i) + r.n() * 0.18);
    g.add(K.line(toPts(hist, x0, xn, 0, 1, 0), { w: 1.8 }));
    const dx = (xn - x0) / (nh - 1);
    const up = [], dn = [], mid = [];
    for (let k = 0; k <= nf; k++) { const x = xn + k * dx * ((x1 - xn) / (nf * dx)), m = base(nh - 1 + k), s = 0.12 + 0.11 * Math.sqrt(k) * 1.4; mid.push([x, m, 0]); up.push([x, m + s, 0]); dn.push([x, m - s, 0]); }
    g.add(K.line(mid, { c: 'acc', w: 2.4 }));
    g.add(K.line(up, { c: 'acc', o: 0.5, w: 1, dash: true })); g.add(K.line(dn, { c: 'acc', o: 0.5, w: 1, dash: true }));
    // shaded cone
    const T = K.THREE, pos = [];
    for (let k = 0; k < nf; k++) { const a = up[k], b = up[k + 1], c = dn[k], d2 = dn[k + 1]; pos.push(...a, ...c, ...b, ...b, ...c, ...d2); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf('acc'), transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false })));
    // now line
    g.add(K.line([[xn, 0, 0], [xn, 4.4, 0]], { o: 0.5, w: 1, dash: true }));
    g.add(K.label('t₀', [xn, 4.75, 0], { size: 0.36, o: 0.75 }));
    // horizon bracket
    const yb = 0.5;
    g.add(K.arrow([xn, yb, 0], [x1, yb, 0], { c: 'acc', w: 1.6, head: 0.22 }));
    g.add(K.line([[xn, yb - 0.15, 0], [xn, yb + 0.15, 0]], { c: 'acc', w: 1.6 }));
    g.add(K.label('h', [(xn + x1) / 2, yb - 0.4, 0], { size: 0.46, c: 'acc' }));
    g.add(K.line([[x0, 0, 0], [x1 + 0.3, 0, 0]], { o: 0.45, w: 1 }));
    g.add(K.label('t', [x1 + 0.6, 0, 0], { size: 0.38, o: 0.7 }));
    floorGrid(g, x0, x1, -1.5, 1.5, 0, 9, 0.06);
    return [{ c: 'acc', t: 'Forecast horizon' }];
  };

  VIZ.zdata = function (p, k) {
    K = k;
    const g = new K.THREE.Group();
    const r = K.rng(7 + (p.kind || '').length * 13);
    const fn = F[p.kind] || F.histogram;
    const legend = fn(g, r, p);
    // most figures are panels in the xy plane: turn them a little towards the default camera
    if (!['sparsedata', 'labelnoise', 'interaction'].includes(p.kind)) g.rotation.y = 0.5;
    return { g, legend };
  };
})();
