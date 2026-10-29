/* Latent Atlas — appendix figures for the 'ztrain' chapter (Training & Optimization).
   One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------- helpers ---------- */
  /* A 2D chart on the vertical plane at depth z. Returns m(x, y) -> world [x, y, z]. */
  function panel(g, o) {
    const w = o.w || 8, h = o.h || 4, cx = o.cx || 0, z = o.z || 0, y0 = o.y0 || 0;
    const [xa, xb] = o.xr || [0, 1], [ya, yb] = o.yr || [0, 1];
    const m = (x, y) => [cx - w / 2 + w * (x - xa) / (xb - xa), y0 + h * (y - ya) / (yb - ya), z];
    m.X = (x) => m(x, ya)[0]; m.Y = (y) => m(xa, y)[1];
    m.w = w; m.h = h; m.z = z; m.y0 = y0; m.cx = cx;
    if (o.axes !== false) {
      const ax0 = o.ax0 == null ? ya : o.ax0, ay0 = o.ay0 == null ? xa : o.ay0;
      g.add(K.line([m(xa, ax0), m(xb, ax0)], { o: 0.5, w: 1 }));
      g.add(K.line([m(ay0, ya), m(ay0, yb)], { o: 0.5, w: 1 }));
      const s = o.ls || 0.34;
      if (o.lx) g.add(K.label(o.lx, [m(xb, ax0)[0] + 0.25 + 0.09 * o.lx.length, m(xb, ax0)[1], z], { size: s, o: 0.75 }));
      if (o.ly) g.add(K.label(o.ly, [m(ay0, yb)[0], m(ay0, yb)[1] + 0.35, z], { size: s, o: 0.75 }));
    }
    if (o.grid) {
      const pr = [];
      for (let i = 1; i <= 4; i++) { const yy = y0 + h * i / 4; pr.push([[cx - w / 2, yy, z], [cx + w / 2, yy, z]]); }
      g.add(K.segs(pr, { o: 0.07 }));
    }
    return m;
  }
  /* Sample y = f(x) through mapping m; breaks the polyline where y leaves [lo, hi]. Returns list of polylines. */
  function fn(m, f, xa, xb, n, lo, hi) {
    const out = []; let cur = [];
    for (let i = 0; i <= n; i++) {
      const x = xa + (xb - xa) * i / n, y = f(x);
      if (lo != null && (y < lo || y > hi || !isFinite(y))) {
        if (cur.length) {
          const yc = Math.max(lo, Math.min(hi, isFinite(y) ? y : hi)); cur.push(m(x, yc));
          if (cur.length > 1) out.push(cur);
        }
        cur = [];
        continue;
      }
      if (!cur.length && i > 0 && lo != null) {
        const xp = xa + (xb - xa) * (i - 1) / n, yp = f(xp);
        cur.push(m(xp, Math.max(lo, Math.min(hi, isFinite(yp) ? yp : hi))));
      }
      cur.push(m(x, y));
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }
  const lines = (g, polys, o) => polys.forEach((P) => g.add(K.line(P, o)));
  /* filled polygon in a vertical plane at depth z (pts: [[x,y],...] world) */
  function polyXY(pts, z, o = {}) {
    const sh = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
    const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.fill == null ? 0.2 : o.fill, side: T.DoubleSide, depthWrite: false }));
    m.position.z = z;
    return m;
  }
  function ground(g, xr, zr, y, n = 8, op = 0.08) {
    const pr = [];
    for (let i = 0; i <= n; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / n, z = zr[0] + (zr[1] - zr[0]) * i / n;
      pr.push([[x, y, zr[0]], [x, y, zr[1]]]); pr.push([[xr[0], y, z], [xr[1], y, z]]);
    }
    g.add(K.segs(pr, { o: op }));
  }
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function polyfit(xs, ys, d) {
    const A = [], b = [];
    for (let i = 0; i <= d; i++) {
      A.push([]); for (let j = 0; j <= d; j++) A[i].push(xs.reduce((s, x) => s + Math.pow(x, i + j), 0) + (i === j ? 1e-9 : 0));
      b.push(xs.reduce((s, x, k) => s + ys[k] * Math.pow(x, i), 0));
    }
    const c = solve(A, b);
    return (x) => c.reduce((s, ci, i) => s + ci * Math.pow(x, i), 0);
  }
  function ellipse(cx, cz, a, b, rot, y, n = 64) {
    const P = [], cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const t = 2 * Math.PI * i / n, u = a * Math.cos(t), v = b * Math.sin(t);
      P.push([cx + u * cr - v * sr, y, cz + u * sr + v * cr]);
    }
    return P;
  }

  VIZ.ztrain = function (p, Kk) {
    K = Kk; T = K.THREE;
    const g = new T.Group(), kind = p.kind;
    const add = (o) => { g.add(o); return o; };
    let legend = [], tick = null;
    const L = (t, pos, o = {}) => add(K.label(t, pos, Object.assign({ size: 0.34, o: 0.8 }, o)));

    /* ======================= LOSS FUNCTION ======================= */
    if (kind === 'lossfn') {
      const r = K.rng(3);
      const xs = [], ys = [];
      for (let i = 0; i < 8; i++) { const x = 0.8 + i * 1.2; xs.push(x); ys.push(0.55 * x + 1 + 0.7 * r.n()); }
      const b0 = 1, th = 0.3;
      const m = panel(g, { cx: -2.7, z: 0.9, w: 4.6, h: 3.8, xr: [0, 10], yr: [0, 7.5], lx: 'x', ly: 'y' });
      add(K.line([m(0, b0), m(10, b0 + th * 10)], { w: 1.8 }));
      xs.forEach((x, i) => {
        const yh = b0 + th * x, a = m(x, ys[i]), bb = m(x, yh);
        add(K.line([a, bb], { c: 'acc', w: 2 }));
        const s = Math.abs(a[1] - bb[1]);
        add(K.rect(a[0], (a[1] + bb[1]) / 2, a[2] - s / 2, s, s, 'yz', { c: 'acc', o: 0.7, fill: 0.16 }));
      });
      add(K.dots(xs.map((x, i) => m(x, ys[i])), { r: 0.08 }));
      // loss curve over θ
      const Lf = (t) => xs.reduce((s, x, i) => s + (ys[i] - b0 - t * x) ** 2, 0) / xs.length;
      let mx = 0; for (let i = 0; i <= 40; i++) mx = Math.max(mx, Lf(-0.1 + 1.2 * i / 40));
      const m2 = panel(g, { cx: 2.8, z: -0.9, w: 4.4, h: 3.6, xr: [-0.1, 1.1], yr: [0, mx * 1.05], lx: 'θ', ly: 'L(θ)' });
      lines(g, fn(m2, Lf, -0.1, 1.1, 80), { w: 2 });
      const cur = m2(th, Lf(th));
      add(K.line([m2(th, 0), cur], { c: 'acc', w: 1.4, dash: true }));
      add(K.dots([cur], { r: 0.14, c: 'acc' }));
      let best = 0, bv = Infinity; for (let i = 0; i <= 200; i++) { const t = -0.1 + 1.2 * i / 200; if (Lf(t) < bv) { bv = Lf(t); best = t; } }
      add(K.dots([m2(best, bv)], { r: 0.08, o: 0.6 }));
      add(K.arrow([cur[0] + 0.3, cur[1] - 0.05, cur[2]], [m2(best, bv)[0] - 0.25, m2(best, bv)[1] + 0.25, cur[2]], { w: 1.2, o: 0.45 }));
      ground(g, [-5.2, 5.2], [-1.8, 1.8], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Errors and their loss' }, { c: 'ink', t: 'Loss over θ' }];

    /* ======================= OBJECTIVE FUNCTION ======================= */
    } else if (kind === 'objective') {
      const Lf = (t) => 0.22 * (t - 1.8) ** 2 + 0.25, Rf = (t) => 0.12 * t * t, Jf = (t) => Lf(t) + Rf(t);
      const yr = [0, 4.2];
      const mb = panel(g, { z: -1.4, w: 8.4, h: 4, xr: [-3, 3.5], yr, axes: false });
      const m = panel(g, { z: 0.6, w: 8.4, h: 4, xr: [-3, 3.5], yr, lx: 'θ', ly: 'J' });
      lines(g, fn(mb, Lf, -3, 3.5, 80, 0, 4.2), { w: 1.6, o: 0.5 });
      lines(g, fn(mb, Rf, -3, 3.5, 80, 0, 4.2), { w: 1.4, o: 0.5, dash: true });
      lines(g, fn(m, Jf, -3, 3.5, 80, 0, 4.2), { c: 'acc', w: 2.6 });
      const tJ = 0.22 * 1.8 / (0.22 + 0.12);
      add(K.dots([m(tJ, Jf(tJ))], { r: 0.15, c: 'acc' }));
      add(K.line([m(tJ, 0), m(tJ, Jf(tJ))], { c: 'acc', w: 1.2, dash: true }));
      add(K.dots([mb(1.8, Lf(1.8))], { r: 0.08, o: 0.55 }));
      add(K.line([mb(1.8, 0), mb(1.8, Lf(1.8))], { w: 1, o: 0.35, dash: true }));
      L('L', [mb(3.5, Lf(3.5))[0] + 0.3, mb(3.5, Lf(3.5))[1], -1.4], { o: 0.6 });
      L('λR', [mb(-3, Rf(-3))[0] - 0.5, mb(-3, Rf(-3))[1], -1.4], { o: 0.6 });
      L('J = L + λR', [m(-1.6, 3.9)[0] + 1.0, m(0, 3.9)[1], 0.6], { c: 'acc', size: 0.4, o: 1 });
      L('θ*', [m(tJ, 0)[0], -0.35, 0.6], { c: 'acc' });
      ground(g, [-4.4, 4.4], [-1.8, 1.4], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Objective to minimise' }, { c: 'ink', t: 'Loss and penalty terms' }];

    /* ======================= PARAMETERS vs HYPERPARAMETERS ======================= */
    } else if (kind === 'paramhyper') {
      const r = K.rng(5);
      add(K.box(-1.4, 1.8, 0, 5, 3.2, 3, { o: 0.55, fill: 0.03 }));
      const P = [], rs = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) {
        P.push([-3.4 + i * 0.8, 0.6 + j * 0.8, -0.9 + k * 0.9]); rs.push(0.04 + 0.08 * r());
      }
      add(K.dots(P, { rs, o: 0.85 }));
      L('θ', [-1.4, 3.85, 0], { size: 0.44 });
      add(K.arrow([-5.6, 1.8, 0], [-4.05, 1.8, 0], { w: 1.4, o: 0.6 }));
      L('x', [-5.85, 1.8, 0], { o: 0.7 });
      add(K.arrow([1.25, 1.8, 0], [2.3, 1.8, 0], { w: 1.4, o: 0.6 }));
      L('ŷ', [2.55, 1.8, 0], { o: 0.7 });
      // hyperparameter sliders
      const names = ['η', 'λ', 'B'], vals = [0.35, 0.7, 0.5];
      names.forEach((nm, i) => {
        const x = 3.4 + i * 0.85, z = 0.6;
        add(K.line([[x, 0.4, z], [x, 3.2, z]], { w: 1, o: 0.4 }));
        [0.4, 3.2].forEach((yy) => add(K.line([[x - 0.12, yy, z], [x + 0.12, yy, z]], { w: 1, o: 0.4 })));
        const yv = 0.4 + 2.8 * vals[i];
        add(K.box(x, yv, z, 0.42, 0.22, 0.22, { c: 'acc', fill: 0.85, fc: 'acc' }));
        L(nm, [x, 3.6, z], { c: 'acc', size: 0.4, o: 1 });
      });
      add(K.arrow([3.2, 3.95, 0.6], [0.2, 3.55, 0.3], { c: 'acc', w: 1.2, dash: true, o: 0.7 }));
      ground(g, [-5.2, 5.4], [-2, 2], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Set before training' }, { c: 'ink', t: 'Learned during training' }];

    /* ======================= WEIGHTS & BIAS ======================= */
    } else if (kind === 'weightsbias') {
      const S = [-1.6, 2, 0];
      const ins = [[-4.6, 3.4, 0], [-4.6, 2.4, 0], [-4.6, 1.4, 0]], ws = [2.6, 1.0, 1.8];
      ins.forEach((a, i) => {
        add(K.line([a, S], { w: ws[i], o: 0.85 }));
        const mid = [(a[0] + S[0]) / 2, (a[1] + S[1]) / 2 + 0.28, 0];
        L('w' + '₁₂₃'[i], mid, { size: 0.3, o: 0.7 });
        L('x' + '₁₂₃'[i], [a[0] - 0.45, a[1], 0], { size: 0.34 });
      });
      add(K.dots(ins, { r: 0.12 }));
      const B = [-4.6, 0.2, 0];
      add(K.line([B, S], { c: 'acc', w: 2.2 }));
      add(K.dots([B], { r: 0.14, c: 'acc' }));
      L('1', [B[0] - 0.45, B[1], 0], { c: 'acc' });
      L('b', [-3.0, 0.75, 0], { c: 'acc', size: 0.38, o: 1 });
      add(K.dots([S], { r: 0.2 }));
      L('Σ', [S[0], S[1] + 0.55, 0], { size: 0.38 });
      add(K.arrow([S[0] + 0.4, S[1], 0], [S[0] + 1.3, S[1], 0], { w: 1.4 }));
      L('ŷ', [S[0] + 1.6, S[1], 0], { size: 0.36 });
      // right panel: y = w x  vs  y = w x + b
      const m = panel(g, { cx: 3.2, z: -0.8, w: 3.6, h: 3.6, xr: [-2, 2], yr: [-2, 2], ax0: 0, ay0: 0 });
      add(K.line([m(-2, -1.6), m(1.75, 1.4)], { w: 1.4, o: 0.6, dash: true }));
      add(K.line([m(-2, -0.6), m(1.75, 2.0)].map((q, i) => (i === 1 ? m(1.75, 0.8 * 1.75 + 1) : q)), { w: 2 }));
      add(K.arrow(m(0, 0), m(0, 1), { c: 'acc', w: 2.4, head: 0.22 }));
      add(K.dots([m(0, 1)], { r: 0.07, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Bias (shift)' }, { c: 'ink', t: 'Weights (strength, slope)' }];

    /* ======================= EPOCH / BATCH / ITERATION ======================= */
    } else if (kind === 'epoch') {
      const nS = 24, bs = 6, nb = nS / bs, sp = 0.37, gap = 0.5, cube = 0.3, ch = 0.5;
      const xOf = (i) => -4.9 + i * sp + Math.floor(i / bs) * gap;
      const rowY = (e) => e * 1.75, rowZ = (e) => -0.7 * e;
      const hiE = 1, hiB = 1;
      for (let e = 0; e < 3; e++) {
        const y = rowY(e), z = rowZ(e);
        for (let i = 0; i < nS; i++) {
          const on = e === hiE && Math.floor(i / bs) === hiB;
          add(K.box(xOf(i), y + ch / 2, z, cube, ch, cube, on ? { c: 'acc', fill: 0.75, fc: 'acc' } : { o: 0.55, fill: 0.08 }));
        }
        for (let b = 0; b < nb; b++) {
          const x0 = xOf(b * bs) - 0.2, x1 = xOf(b * bs + bs - 1) + 0.2, on = e === hiE && b === hiB;
          add(K.rect((x0 + x1) / 2, y + 0.003, z, x1 - x0, 0.62, 'xz', on ? { c: 'acc', w: 1.6, fill: 0.15 } : { o: 0.3, w: 1 }));
        }
        const x0 = xOf(0) - 0.2, x1 = xOf(nS - 1) + 0.2;
        if (e === 0) add(K.line([[x0, y - 0.15, z + 0.45], [x0, y - 0.3, z + 0.45], [x1, y - 0.3, z + 0.45], [x1, y - 0.15, z + 0.45]], { w: 1, o: 0.5 }));
        L(String(e + 1), [x0 - 0.55, y + 0.25, z], { size: 0.42, o: 0.75 });
        if (e < 2) add(K.curve([[x1 + 0.2, y + 0.25, z], [x1 + 0.75, y + 0.9, z - 0.35], [x0 - 0.2, rowY(e + 1) + 0.25, rowZ(e + 1) + 0.6], [x0 - 0.05, rowY(e + 1) + 0.25, rowZ(e + 1)]].slice(0, 2).concat([[x1 + 0.2, rowY(e + 1) + 0.25, rowZ(e + 1)]]), { w: 1, o: 0.3, dash: true }));
      }
      L('N = 24', [0, -0.65, 0.45], { size: 0.34, o: 0.75 });
      const bx0 = xOf(hiB * bs) - 0.2, bx1 = xOf(hiB * bs + bs - 1) + 0.2;
      add(K.line([[bx0, rowY(hiE) + 0.75, rowZ(hiE)], [bx0, rowY(hiE) + 0.9, rowZ(hiE)], [bx1, rowY(hiE) + 0.9, rowZ(hiE)], [bx1, rowY(hiE) + 0.75, rowZ(hiE)]], { c: 'acc', w: 1.2 }));
      L('B = 6', [(bx0 + bx1) / 2, rowY(hiE) + 1.2, rowZ(hiE)], { size: 0.34, c: 'acc', o: 1 });
      legend = [{ c: 'acc', t: 'One iteration (batch)' }, { c: 'ink', t: 'One epoch (all data)' }];

    /* ======================= CONVERGENCE ======================= */
    } else if (kind === 'convergence') {
      const r = K.rng(4), N = 60, Ls = 0.6, eps = 0.12;
      const ys = []; for (let t = 0; t <= N; t++) ys.push(Ls + 2.9 * Math.exp(-t / 9) + 0.12 * Math.exp(-t / 14) * r.n());
      const m = panel(g, { z: 0.8, w: 8.4, h: 3.6, xr: [0, N], yr: [0, 3.8], lx: 't', ly: 'L' });
      let tc = 0; for (let t = N; t >= 0; t--) if (Math.abs(ys[t] - Ls) > eps) { tc = t + 1; break; }
      add(polyXY([m(tc, Ls - eps), m(N, Ls - eps), m(N, Ls + eps), m(tc, Ls + eps)].map((q) => [q[0], q[1]]), 0.8, { c: 'acc', fill: 0.16 }));
      add(K.line([m(0, Ls), m(N, Ls)], { w: 1, o: 0.45, dash: true }));
      add(K.line(ys.slice(0, tc + 1).map((y, t) => m(t, y)), { w: 2 }));
      add(K.line(ys.slice(tc).map((y, t) => m(t + tc, y)), { c: 'acc', w: 2.6 }));
      add(K.line([m(tc, 0), m(tc, Ls + eps)], { c: 'acc', w: 1.2, dash: true }));
      L('L*', [m(0, Ls)[0] - 0.4, m(0, Ls)[1], 0.8], { size: 0.32, o: 0.7 });
      L('±ε', [m(N, Ls)[0] + 0.45, m(N, Ls)[1], 0.8], { c: 'acc', size: 0.34, o: 1 });
      // step sizes shrinking to zero, behind
      const mb = panel(g, { z: -1.2, w: 8.4, h: 2.2, xr: [0, N], yr: [0, 1], axes: false });
      for (let t = 1; t <= N; t += 2) {
        const v = Math.abs(ys[t] - ys[t - 1]) / 0.6 + 0.02 * Math.exp(-t / 10);
        const h = Math.min(1, v), a = mb(t, 0), b = mb(t, h);
        add(K.box(a[0], (a[1] + b[1]) / 2, -1.2, 0.08, Math.max(0.01, b[1] - a[1]), 0.08, { o: t >= tc ? 0.6 : 0.35, c: t >= tc ? 'acc' : 'ink', fill: 0.15, fc: t >= tc ? 'acc' : 'ink' }));
      }
      add(K.line([mb(0, 0), mb(N, 0)], { w: 1, o: 0.3 }));
      L('|Δθ|', [mb(0, 0)[0] - 0.55, mb(0, 0.3)[1], -1.2], { size: 0.3, o: 0.6 });
      legend = [{ c: 'acc', t: 'Settled within tolerance' }, { c: 'ink', t: 'Loss still falling' }];

    /* ======================= LOCAL vs GLOBAL MINIMUM ======================= */
    } else if (kind === 'localmin') {
      const f = (x, z) => 0.025 * (x * x + z * z) - 1.4 * Math.exp(-((x - 2) ** 2 + (z - 1) ** 2) / 2.2) - 2.4 * Math.exp(-((x + 1.7) ** 2 + (z + 1.1) ** 2) / 1.8);
      const Y = (x, z) => 1.15 * (f(x, z) + 2.5);
      const R = [-4, 4];
      add(K.surface(Y, { xr: R, zr: R, n: 30, o: 0.22 }));
      ground(g, R, R, 0, 8, 0.07);
      const gd = (s) => {
        let [x, z] = s; const P = [[x, Y(x, z) + 0.05, z]];
        for (let i = 0; i < 80; i++) {
          const h = 1e-4, gx = (f(x + h, z) - f(x - h, z)) / (2 * h), gz = (f(x, z + h) - f(x, z - h)) / (2 * h);
          x -= 0.7 * gx; z -= 0.7 * gz; P.push([x, Y(x, z) + 0.05, z]);
        }
        return P;
      };
      const pl = gd([3.6, 3.4]), pg = gd([-3.6, 2.6]);
      add(K.line(pl, { w: 1.6, o: 0.75, dash: true }));
      add(K.line(pg, { c: 'acc', w: 2.2 }));
      const el = pl[pl.length - 1], eg = pg[pg.length - 1];
      add(K.dots([el], { r: 0.17 }));
      add(K.dots([eg], { r: 0.2, c: 'acc' }));
      add(K.line([[el[0], 0, el[2]], el], { w: 1, o: 0.4, dash: true }));
      add(K.line([[eg[0], 0, eg[2]], eg], { c: 'acc', w: 1.2, dash: true }));
      add(K.dots([pl[0], pg[0]], { r: 0.08, o: 0.6 }));
      legend = [{ c: 'acc', t: 'Global minimum' }, { c: 'ink', t: 'Local minimum' }];

    /* ======================= CLOSED-FORM SOLUTION ======================= */
    } else if (kind === 'closedform') {
      const rot = 0.5, c = [0.6, 0.3], la = 0.07, lb = 0.5;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const f = (x, z) => { const dx = x - c[0], dz = z - c[1], u = dx * cr + dz * sr, v = -dx * sr + dz * cr; return la * u * u + lb * v * v; };
      const Y = (x, z) => 0.3 * f(x, z) + 0.8;
      const R = [-4.5, 4.5], Rz = [-3.5, 3.5];
      add(K.surface(Y, { xr: R, zr: Rz, n: 26, o: 0.13 }));
      ground(g, R, Rz, 0, 8, 0.07);
      [0.15, 0.5, 1.1, 2].forEach((lv) => add(K.line(ellipse(c[0], c[1], Math.sqrt(lv / la), Math.sqrt(lv / lb), rot, 0.01), { w: 1, o: 0.35 })));
      // gradient descent zig-zag
      const S0 = [c[0] - 3.8 * cr - 1.5 * sr, c[1] - 3.8 * sr + 1.5 * cr];
      let x = S0[0], z = S0[1]; const P = [[x, 0.02, z]];
      for (let i = 0; i < 24; i++) {
        const h = 1e-4, gx = (f(x + h, z) - f(x - h, z)) / (2 * h), gz = (f(x, z + h) - f(x, z - h)) / (2 * h);
        x -= 1.55 * gx; z -= 1.55 * gz; P.push([x, 0.02, z]);
      }
      add(K.line(P, { w: 1.4, o: 0.75 }));
      add(K.dots(P, { r: 0.055, o: 0.75 }));
      const dd = Math.hypot(c[0] - S0[0], c[1] - S0[1]), ux = (c[0] - S0[0]) / dd, uz = (c[1] - S0[1]) / dd;
      add(K.arc([S0[0], 0.03, S0[1]], [c[0] - 0.15 * ux, 0.03, c[1] - 0.15 * uz], 1.2, { c: 'acc', w: 2.6 }));
      add(K.dots([[c[0], 0.03, c[1]]], { r: 0.15, c: 'acc' }));
      add(K.line([[c[0], 0.03, c[1]], [c[0], 4.0, c[1]]], { c: 'acc', w: 1, o: 0.6, dash: true }));
      add(K.dots([[c[0], Y(c[0], c[1]), c[1]]], { r: 0.09, c: 'acc' }));
      L('θ₀', [S0[0] - 0.45, 0.3, S0[1]]);
      L('θ* = (XᵀX)⁻¹Xᵀy', [c[0], 4.4, c[1]], { c: 'acc', size: 0.4, o: 1 });
      legend = [{ c: 'acc', t: 'One exact step' }, { c: 'ink', t: 'Iterative descent' }];

    /* ======================= STOCHASTIC vs DETERMINISTIC ======================= */
    } else if (kind === 'stochastic') {
      const N = 50, yr = [0, 3.2];
      const base = (t) => 0.45 + 2.4 * Math.exp(-t / 10);
      const mL = panel(g, { cx: -2.7, z: 0, w: 4.4, h: 3.4, xr: [0, N], yr, lx: 't', ly: 'L' });
      for (let k = 0; k < 5; k++) add(K.line(Array.from({ length: N + 1 }, (_, t) => mL(t, base(t))).map((q) => [q[0], q[1], q[2] + k * 0.001]), { w: 2, o: 0.9 }));
      L('×5', [mL(N, base(N))[0] - 0.2, mL(N, base(N))[1] + 0.45, 0], { size: 0.34, o: 0.7 });
      const zs = [-1.2, -0.6, 0, 0.6, 1.2];
      zs.forEach((dz, k) => {
        const r = K.rng(20 + k);
        const mR = panel(g, { cx: 2.7, z: dz, w: 4.4, h: 3.4, xr: [0, N], yr, axes: k === 2, lx: k === 2 ? 't' : null, ly: k === 2 ? 'L' : null });
        let e = 0; const P = [];
        for (let t = 0; t <= N; t++) { e = 0.85 * e + 0.06 * r.n(); P.push(mR(t, Math.max(0.05, base(t) * (1 + 0.03 * r.n()) + e + (k - 2) * 0.08 * Math.min(1, t / 15)))); }
        add(K.line(P, { c: 'acc', w: 1.6, o: 0.85 }));
      });
      ground(g, [-5.2, 5.2], [-1.6, 1.6], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Stochastic: runs differ' }, { c: 'ink', t: 'Deterministic: runs identical' }];

    /* ======================= LAGRANGE MULTIPLIERS ======================= */
    } else if (kind === 'lagrange') {
      const cx = 0.4, cz = 1.5;
      const f = (x, z) => 0.5 * ((x - cx) ** 2 + 2 * (z - cz) ** 2);
      const Y = (x, z) => 0.5 + 0.11 * f(x, z);
      const R = [-4, 4];
      add(K.surface(Y, { xr: R, zr: R, n: 26, o: 0.12 }));
      ground(g, R, R, 0, 8, 0.06);
      const gz = (x) => -0.6 + 0.12 * x; // constraint: z = gz(x)
      let xs = 0, fb = Infinity;
      for (let i = 0; i <= 800; i++) { const x = -4 + 8 * i / 800, v = f(x, gz(x)); if (v < fb) { fb = v; xs = x; } }
      [0.5, 1.4, fb, 5].forEach((c) => {
        const P = ellipse(cx, cz, Math.sqrt(2 * c), Math.sqrt(c), 0, 0.01).filter((q) => Math.abs(q[0]) <= 4.05 && Math.abs(q[2]) <= 4.05);
        add(K.line(P, { w: c === fb ? 1.8 : 1, o: c === fb ? 0.85 : 0.35 }));
      });
      add(K.dots([[cx, 0.01, cz]], { r: 0.06, o: 0.5 }));
      add(K.line([[-4, 0.02, gz(-4)], [4, 0.02, gz(4)]], { c: 'acc', w: 2.4 }));
      const lift = []; for (let i = 0; i <= 40; i++) { const x = -4 + 8 * i / 40; lift.push([x, Y(x, gz(x)) + 0.02, gz(x)]); }
      add(K.line(lift, { c: 'acc', w: 1.6, o: 0.7 }));
      const X = [xs, 0.04, gz(xs)], Yt = Y(xs, gz(xs));
      add(K.dots([X], { r: 0.15, c: 'acc' }));
      add(K.line([X, [X[0], Yt, X[2]]], { c: 'acc', w: 1.1, dash: true }));
      add(K.dots([[X[0], Yt, X[2]]], { r: 0.09, c: 'acc' }));
      let gx = xs - cx, gzz = 2 * (gz(xs) - cz); const gn = Math.hypot(gx, gzz); gx /= gn; gzz /= gn;
      const d = 1.9;
      add(K.arrow(X, [X[0] + gx * d, 0.04, X[2] + gzz * d], { w: 2.2, head: 0.35 }));
      add(K.arrow(X, [X[0] - gx * d * 0.75, 0.04, X[2] - gzz * d * 0.75], { c: 'acc', w: 2.2, head: 0.35 }));
      L('∇f', [X[0] + gx * (d + 0.45), 0.3, X[2] + gzz * (d + 0.45)]);
      L('∇g', [X[0] - gx * (d * 0.75 + 0.45), 0.3, X[2] - gzz * (d * 0.75 + 0.45)], { c: 'acc', o: 1 });
      L('g = 0', [4.75, 0.3, gz(4)], { c: 'acc', o: 1 });
      L('x*', [X[0] - 0.6, 0.35, X[2] - 0.25]);
      legend = [{ c: 'acc', t: 'Constraint g = 0' }, { c: 'ink', t: 'Contours of f' }];

    /* ======================= GENERALIZATION ======================= */
    } else if (kind === 'generalization') {
      const r = K.rng(12), tf = (x) => 2 + 1.2 * Math.sin(x * 1.1);
      const m = panel(g, { cx: -0.8, z: 0, w: 7.6, h: 3.8, xr: [-3, 3], yr: [0.3, 3.7], lx: 'x', ly: 'y' });
      const tr = [], te = [];
      for (let i = 0; i < 12; i++) { const x = -2.8 + 5.6 * r(); tr.push([x, tf(x) + 0.28 * r.n()]); }
      for (let i = 0; i < 9; i++) { const x = -2.8 + 5.6 * r(); te.push([x, tf(x) + 0.3 * r.n()]); }
      const fit = polyfit(tr.map((q) => q[0]), tr.map((q) => q[1]), 3);
      lines(g, fn(m, fit, -3, 3, 80, 0.3, 3.7), { w: 2 });
      add(K.dots(tr.map(([x, y]) => m(x, y)), { r: 0.09 }));
      te.forEach(([x, y]) => add(K.line([m(x, y), m(x, fit(x))], { c: 'acc', w: 1.4, o: 0.75 })));
      add(K.dots(te.map(([x, y]) => m(x, y)), { r: 0.12, c: 'acc', hollow: true }));
      // error bars: train vs test
      const etr = Math.sqrt(tr.reduce((s, [x, y]) => s + (y - fit(x)) ** 2, 0) / tr.length);
      const ete = Math.sqrt(te.reduce((s, [x, y]) => s + (y - fit(x)) ** 2, 0) / te.length);
      const sc = 2.2 / Math.max(etr, ete);
      add(K.box(4.0, etr * sc / 2, -0.6, 0.5, etr * sc, 0.5, { fill: 0.12, o: 0.7 }));
      add(K.box(4.8, ete * sc / 2, -0.6, 0.5, ete * sc, 0.5, { c: 'acc', fill: 0.55, fc: 'acc' }));
      add(K.line([[3.6, 0, -0.6], [5.2, 0, -0.6]], { w: 1, o: 0.5 }));
      L('E', [4.4, Math.max(etr, ete) * sc + 0.45, -0.6], { size: 0.34, o: 0.7 });
      ground(g, [-4.8, 5.4], [-1.6, 1.2], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Unseen test data' }, { c: 'ink', t: 'Training data' }];

    /* ======================= MODEL CAPACITY ======================= */
    } else if (kind === 'capacity') {
      const r = K.rng(7), xs = [], ys = [];
      for (let i = 0; i < 9; i++) { const x = -0.95 + 1.9 * i / 8; xs.push(x); ys.push(0.9 * x * x - 0.3 * x + 0.25 * r.n()); }
      const deg = [1, 3, 8], yr = [-1.4, 1.8];
      deg.forEach((d, k) => {
        const cx = -3.6 + k * 3.6, z = 1.4 - k * 1.4;
        const m = panel(g, { cx, z, w: 3.0, h: 3.4, xr: [-1.05, 1.05], yr });
        const rr = K.rng(30 + k);
        for (let s = 0; s < 7; s++) {
          const cs = Array.from({ length: d + 1 }, (_, i) => rr.n() * (i === 0 ? 0.6 : 1.0 * Math.pow(1.25, i)));
          lines(g, fn(m, (x) => cs.reduce((a, c, i) => a + c * Math.pow(x, i), 0) + 0.2, -1.05, 1.05, 70, yr[0], yr[1]), { w: 1, o: 0.2 });
        }
        const fit = polyfit(xs, ys, d);
        lines(g, fn(m, fit, -1.0, 1.0, 120, yr[0], yr[1]), { c: 'acc', w: 2.4 });
        add(K.dots(xs.map((x, i) => m(x, ys[i])), { r: 0.08 }));
        L('d = ' + d, [cx, 3.85, z], { size: 0.36, o: 0.75 });
      });
      ground(g, [-5.4, 5.4], [-1.2, 2.6], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Best fit in family' }, { c: 'ink', t: 'Functions it can express' }];

    /* ======================= INDUCTIVE BIAS ======================= */
    } else if (kind === 'inductivebias') {
      const xs = [-0.8, -0.4, 0.05, 0.45, 0.85], ys = [0.4, 0.95, 1.3, 1.55, 2.25];
      const yr = [-0.6, 3.4];
      const m = panel(g, { z: 0, w: 8.4, h: 4, xr: [-1.05, 1.05], yr, lx: 'x', ly: 'y' });
      const lin = polyfit(xs, ys, 1);
      const interp = polyfit(xs, ys, 4);
      const prodf = (x) => xs.reduce((a, xi) => a * (x - xi), 1);
      [-14, -7, 6, 12, 20].forEach((a, k) => {
        const zz = -0.5 - 0.35 * k;
        const mk = panel(g, { z: zz, w: 8.4, h: 4, xr: [-1.05, 1.05], yr, axes: false });
        lines(g, fn(mk, (x) => interp(x) + a * prodf(x), -1.05, 1.05, 100, yr[0], yr[1]), { w: 1.1, o: 0.3 });
        xs.forEach((x, i) => add(K.line([m(x, ys[i]), mk(x, ys[i])], { w: 1, o: 0.15 })));
      });
      lines(g, fn(m, lin, -1.05, 1.05, 2, yr[0], yr[1]), { c: 'acc', w: 2.6 });
      add(K.dots(xs.map((x, i) => m(x, ys[i])), { r: 0.11 }));
      ground(g, [-4.4, 4.4], [-2.3, 0.8], m.Y(yr[0]), 8, 0.05);
      legend = [{ c: 'acc', t: 'Fit the bias prefers' }, { c: 'ink', t: 'Other fits to same data' }];

    /* ======================= TRAINING LOOP ======================= */
    } else if (kind === 'trainloop') {
      const C = [0, 2.7], Rr = 2.4, n = 5;
      const labs = ['x, y', 'ŷ = f(x; θ)', 'L(ŷ, y)', '∇θ L', 'θ ← θ − η∇L'];
      const ang = (i) => Math.PI / 2 - 2 * Math.PI * i / n;
      const pos = (a, rr = Rr) => [C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a), 0];
      const path = [];
      for (let i = 0; i < n; i++) {
        const a0 = ang(i) - 0.32, a1 = ang(i + 1) + 0.32, P = [];
        for (let k = 0; k <= 20; k++) P.push(pos(a0 + (a1 - a0) * k / 20));
        add(K.line(P.slice(0, 19), { c: 'acc', w: 2.2 }));
        add(K.arrow(P[17], P[20], { c: 'acc', w: 2.2, head: 0.3 }));
        P.forEach((q) => path.push(q));
      }
      for (let i = 0; i < n; i++) {
        const q = pos(ang(i));
        add(K.box(q[0], q[1], 0, 0.5, 0.5, 0.5, { fill: i === 0 ? 0.08 : 0.04, o: 0.85 }));
        const lq = pos(ang(i), Rr + 1.05);
        const off = Math.cos(ang(i)) * 0.45 * (labs[i].length > 6 ? 1.6 : 0.4);
        L(labs[i], [lq[0] + off, lq[1] + (i === 0 ? -0.1 : 0), 0], { size: 0.36, o: 0.85 });
      }
      // dataset of batches behind the first node
      const top = pos(ang(0));
      for (let k = 0; k < 6; k++) add(K.box(top[0], top[1] + 0.02 * k, -1.0 - k * 0.35, 1.1, 0.06, 0.25, { o: 0.4, fill: 0.06 }));
      add(K.arrow([top[0], top[1], -0.95], [top[0], top[1], -0.3], { w: 1, o: 0.5 }));
      const mk = new T.Group(); mk.add(K.dots([[0, 0, 0]], { r: 0.14, c: 'acc' })); add(mk);
      const setM = (u) => { const k = Math.floor(u * path.length) % path.length; mk.position.set(...path[k]); };
      setM(0.08);
      tick = (t) => setM(0.08 + t / 5);
      ground(g, [-4.5, 4.5], [-3.2, 1.4], 0, 8, 0.05);
      legend = [{ c: 'acc', t: 'One training step' }, { c: 'ink', t: 'Mini-batches of data' }];

    /* ======================= MODEL CHECKPOINT ======================= */
    } else if (kind === 'checkpoint') {
      const r = K.rng(9), N = 50;
      const ys = []; for (let t = 0; t <= N; t++) ys.push(0.6 + 2.6 * Math.exp(-t / 14) + 0.1 * r.n());
      const m = panel(g, { z: -0.4, w: 8.6, h: 3.6, xr: [0, N + 4], yr: [0, 3.6], lx: 't', ly: 'L' });
      const crash = 46;
      add(K.line(ys.slice(0, crash + 1).map((y, t) => m(t, y)), { w: 1.8 }));
      const cks = [10, 20, 30, 40];
      cks.forEach((t) => {
        const q = m(t, ys[t]);
        add(K.dots([q], { r: 0.13, c: 'acc' }));
        add(K.line([q, [q[0], 0, q[2]], [q[0], 0, 1.3]], { c: 'acc', w: 1.1, o: 0.6, dash: true }));
        const disk = [q[0], 0.14, 1.6];
        add(K.box(disk[0], disk[1], disk[2], 0.55, 0.28, 0.55, { c: 'acc', fill: 0.6, fc: 'acc' }));
        add(K.label(String(t), [disk[0], 0.6, disk[2] + 0.1], { size: 0.3, o: 0.7 }));
      });
      const cq = m(crash, ys[crash]);
      L('✕', [cq[0], cq[1], cq[2]], { size: 0.5, o: 0.9 });
      const rq = m(40, ys[40]);
      add(K.arc([cq[0] - 0.05, cq[1] + 0.25, cq[2]], [rq[0] + 0.05, rq[1] + 0.25, rq[2]], 0.8, { w: 1.2, o: 0.55, dash: true }));
      add(K.arrow([rq[0] + 0.25, rq[1] + 0.55, rq[2]], [rq[0] + 0.05, rq[1] + 0.25, rq[2]], { w: 1.2, o: 0.55, head: 0.2 }));
      ground(g, [-4.8, 4.8], [-1.2, 2.2], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Saved checkpoints' }, { c: 'ink', t: 'Training loss' }];

    /* ======================= HINGE LOSS ======================= */
    } else if (kind === 'hingeloss') {
      const xr = [-2.5, 3], yr = [0, 3.6];
      const m = panel(g, { z: 0, w: 8.6, h: 4, xr, yr, lx: 'm = y·f(x)', ly: 'L', ls: 0.32, ay0: 0 });
      lines(g, fn(m, (x) => Math.log(1 + Math.exp(-x)) / Math.LN2, xr[0], xr[1], 80, 0, 3.6), { w: 1.2, o: 0.35 });
      add(K.line([m(xr[0], 1), m(0, 1), m(0, 0), m(xr[1], 0)], { w: 1.4, o: 0.6, dash: true }));
      const hinge = (x) => Math.max(0, 1 - x);
      add(K.line([m(xr[0], hinge(xr[0])), m(1, 0), m(xr[1], 0)].map((q) => [q[0], q[1] + 0.01, 0.01]), { c: 'acc', w: 2.8 }));
      add(K.line([m(1, 0), m(1, 3.4)], { w: 1, o: 0.3, dash: true }));
      L('1', [m(1, 0)[0], -0.35, 0], { size: 0.32, o: 0.7 });
      L('0', [m(0, 0)[0], -0.35, 0], { size: 0.32, o: 0.7 });
      // sample points: margin in front row
      const ms = [-1.7, -0.9, -0.3, 0.4, 0.8, 1.4, 1.9, 2.5];
      ms.forEach((x) => {
        const on = m(x, hinge(x)), fl = [on[0], 0, 1.3];
        const pos = x < 1;
        add(K.dots([fl], { r: 0.11, c: pos ? 'acc' : 'ink', o: pos ? 1 : 0.7 }));
        if (pos) {
          add(K.line([fl, [on[0], 0, 0.02]], { c: 'acc', w: 1, o: 0.4, dash: true }));
          add(K.line([[on[0], 0, 0.02], [on[0], on[1], 0.02]], { c: 'acc', w: 1.4, o: 0.6 }));
          add(K.dots([[on[0], on[1], 0.02]], { r: 0.08, c: 'acc' }));
        }
      });
      ground(g, [-4.3, 4.3], [-1, 1.8], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Hinge loss' }, { c: 'ink', t: '0–1 and logistic loss' }];

    /* ======================= HUBER LOSS ======================= */
    } else if (kind === 'huberloss') {
      const d = 1, hub = (r) => (Math.abs(r) <= d ? 0.5 * r * r : d * (Math.abs(r) - 0.5 * d));
      const xr = [-3, 3], yr = [0, 3.6];
      const m = panel(g, { cx: -2.6, z: 0.6, w: 4.6, h: 3.6, xr, yr, lx: 'r', ly: 'L', ax0: 0, ay0: 0 });
      lines(g, fn(m, (r) => 0.5 * r * r, -3, 3, 80, 0, 3.6), { w: 1.4, o: 0.45 });
      lines(g, fn(m, (r) => Math.abs(r), -3, 3, 2, 0, 3.6), { w: 1.2, o: 0.45, dash: true });
      lines(g, fn(m, hub, -3, 3, 80, 0, 3.6), { c: 'acc', w: 2.6 });
      [-d, d].forEach((x) => add(K.line([m(x, 0), m(x, 3.0)], { w: 1, o: 0.3, dash: true })));
      L('−δ', [m(-d, 0)[0], -0.32, 0.6], { size: 0.3, o: 0.7 });
      L('δ', [m(d, 0)[0], -0.32, 0.6], { size: 0.3, o: 0.7 });
      L('r²/2', [m(-2.6, 3.4)[0] - 0.5, m(0, 3.4)[1], 0.6], { size: 0.3, o: 0.6 });
      // fits with an outlier
      const r = K.rng(14), xs = [], ys = [];
      for (let i = 0; i < 10; i++) { const x = 0.5 + i; xs.push(x); ys.push(0.4 * x + 1 + 0.25 * r.n()); }
      xs.push(9.2); ys.push(0.2);
      const m2 = panel(g, { cx: 2.8, z: -0.8, w: 4.4, h: 3.6, xr: [0, 10.5], yr: [0, 6.5], lx: 'x', ly: 'y' });
      const ls = polyfit(xs, ys, 1);
      let a = 1, b = 0.4; // IRLS for Huber
      for (let it = 0; it < 30; it++) {
        let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
        xs.forEach((x, i) => { const res = ys[i] - (a + b * x), w = Math.abs(res) <= d * 0.6 ? 1 : d * 0.6 / Math.abs(res); sw += w; sx += w * x; sy += w * ys[i]; sxx += w * x * x; sxy += w * x * ys[i]; });
        b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx); a = (sy - b * sx) / sw;
      }
      add(K.line([m2(0, ls(0)), m2(10.5, ls(10.5))], { w: 1.4, o: 0.5, dash: true }));
      add(K.line([m2(0, a), m2(10.5, a + b * 10.5)], { c: 'acc', w: 2.4 }));
      add(K.dots(xs.slice(0, 10).map((x, i) => m2(x, ys[i])), { r: 0.08 }));
      add(K.dots([m2(9.2, 0.2)], { r: 0.14, hollow: true }));
      ground(g, [-5.2, 5.2], [-1.6, 1.8], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Huber loss and fit' }, { c: 'ink', t: 'Squared loss and fit' }];

    /* ======================= FOCAL LOSS ======================= */
    } else if (kind === 'focalloss') {
      const gs = [0, 0.5, 1, 2, 5], yr = [0, 3.4];
      const fl = (gm) => (q) => -Math.pow(1 - q, gm) * Math.log(q);
      gs.forEach((gm, k) => {
        const z = -1.6 + 0.8 * k;
        const m = panel(g, { z, w: 8, h: 3.8, xr: [0, 1], yr, axes: k === 0, ly: 'L' });
        if (k === 0) L('p', [m(1, 0)[0], -0.35, z], { o: 0.75 });
        if (k !== 0) add(K.line([m(0, 0), m(1, 0)], { w: 1, o: 0.2 }));
        const isA = gm === 2;
        lines(g, fn(m, fl(gm), 0.012, 1, 100, 0, 3.4), { c: isA ? 'acc' : 'ink', w: isA ? 2.6 : (gm === 0 ? 2 : 1.2), o: isA ? 1 : (gm === 0 ? 0.85 : 0.35) });
        if (isA) {
          lines(g, fn(m, fl(0), 0.012, 1, 100, 0, 3.4), { w: 1, o: 0.4, dash: true });
          // easy-example region: gap between CE and focal
          const P = []; for (let i = 0; i <= 30; i++) { const q = 0.55 + 0.45 * i / 30; P.push(m(q, fl(0)(q))); }
          for (let i = 30; i >= 0; i--) { const q = 0.55 + 0.45 * i / 30; P.push(m(q, fl(2)(q))); }
          add(polyXY(P.map((q) => [q[0], q[1]]), z, { c: 'acc', fill: 0.22 }));
        }
        const lp = m(0.12, fl(gm)(0.12));
        if (gm === 0 || gm === 2 || gm === 5) L('γ = ' + gm, [m(1, 0)[0] + 0.7, 0.25, z], { size: 0.32, c: isA ? 'acc' : 'ink', o: isA ? 1 : 0.65 });
      });
      ground(g, [-4.2, 4.2], [-1.8, 1.8], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Focal loss, γ = 2' }, { c: 'ink', t: 'Cross-entropy (γ = 0)' }];

    /* ======================= MAPE ======================= */
    } else if (kind === 'mape') {
      const ya = [3.2, 3.6, 3.0, 3.9, 4.2, 0.35, 3.4, 3.8, 4.1, 3.5];
      const yf = [3.0, 3.9, 3.3, 3.6, 4.0, 0.95, 3.7, 3.5, 4.3, 3.2];
      const n = ya.length;
      const m = panel(g, { z: -1.4, w: 8.4, h: 3.2, y0: 0, xr: [-0.5, n - 0.5], yr: [0, 4.8], lx: 't', ly: 'y' });
      add(K.line(ya.map((y, i) => m(i, y)), { w: 2 }));
      add(K.dots(ya.map((y, i) => m(i, y)), { r: 0.08 }));
      add(K.line(yf.map((y, i) => m(i, y)), { w: 1.3, o: 0.55, dash: true }));
      ya.forEach((y, i) => add(K.line([m(i, y), m(i, yf[i])], { c: 'acc', w: 2.2 })));
      // percentage errors as bars in front
      const pe = ya.map((y, i) => Math.abs(y - yf[i]) / Math.abs(y));
      const mean = pe.reduce((a, b) => a + b, 0) / n;
      const sc = 1.25;
      pe.forEach((v, i) => {
        const x = m(i, 0)[0], h = Math.min(v, 2) * sc;
        add(K.box(x, h / 2, 1.2, 0.42, h, 0.42, { c: 'acc', fill: i === 5 ? 0.75 : 0.4, fc: 'acc', o: 0.8 }));
      });
      add(K.line([[m(-0.5, 0)[0], mean * sc, 1.2], [m(n - 0.5, 0)[0], mean * sc, 1.2]], { w: 1.4, dash: true }));
      L('MAPE', [m(n - 0.5, 0)[0] + 0.75, mean * sc, 1.2], { size: 0.32 });
      L('|e|/|y|', [m(-0.5, 0)[0] - 0.75, 0.6, 1.2], { size: 0.3, o: 0.7 });
      add(K.line([[m(-0.5, 0)[0], 0, 1.2], [m(n - 0.5, 0)[0], 0, 1.2]], { w: 1, o: 0.5 }));
      ground(g, [-4.6, 4.6], [-1.8, 1.8], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Percentage errors' }, { c: 'ink', t: 'Actual vs forecast' }];

    /* ======================= RANKING METRICS ======================= */
    } else if (kind === 'rankmetrics') {
      const rel = [0, 1, 1, 0, 0, 1, 0, 0], n = rel.length;
      const xOf = (i) => -3.85 + i * 1.1;
      const disc = (i) => 1 / Math.log2(i + 2);
      const H = 3.4, curve = [];
      for (let i = 0; i < n; i++) {
        const x = xOf(i), h = H * disc(i);
        add(K.box(x, 0.3, 1.0, 0.6, 0.6, 0.6, rel[i] ? { c: 'acc', fill: 0.7, fc: 'acc' } : { fill: 0.05, o: 0.45 }));
        add(K.label(String(i + 1), [x, -0.35, 1.45], { size: 0.32, o: 0.7 }));
        add(K.box(x, h / 2, -0.6, 0.5, h, 0.3, rel[i] ? { c: 'acc', fill: 0.4, fc: 'acc', o: 0.8 } : { fill: 0.04, o: 0.3 }));
        curve.push([x, h + 0.02, -0.6]);
      }
      add(K.curve(curve, { w: 1.2, o: 0.5, dash: true }));
      L('1/log₂(i+1)', [xOf(n - 1) + 0.6, H * disc(n - 1) + 0.6, -0.6], { size: 0.3, o: 0.7 });
      L('RR = 1/2', [xOf(1) - 0.2, H * disc(1) + 0.45, 1.0], { size: 0.34, c: 'acc', o: 1 });
      ground(g, [-4.6, 4.6], [-1.4, 1.8], 0, 8, 0.06);
      legend = [{ c: 'acc', t: 'Relevant results' }, { c: 'ink', t: 'Rank discount' }];

    /* ======================= IoU ======================= */
    } else if (kind === 'iou') {
      const G = [-4.4, -1.0, 0.4, 3.4], Pp = [-3.4, -0.2, 1.0, 3.9];
      const rectP = (r) => [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]], [r[0], r[2]]];
      const I = [Math.max(G[0], Pp[0]), Math.min(G[1], Pp[1]), Math.max(G[2], Pp[2]), Math.min(G[3], Pp[3])];
      add(K.line(rectP(G).map(([x, y]) => [x, y, 0]), { w: 2 }));
      add(K.line(rectP(Pp).map(([x, y]) => [x, y, 0]), { w: 1.2, o: 0.5 }));
      add(K.line(rectP(I).map(([x, y]) => [x, y, 0.01]), { c: 'acc', w: 1.6 }));
      add(polyXY(rectP(I).slice(0, 4), 0.005, { c: 'acc', fill: 0.6 }));
      const U = [[G[0], G[2]], [G[1], G[2]], [G[1], Pp[2]], [Pp[1], Pp[2]], [Pp[1], Pp[3]], [Pp[0], Pp[3]], [Pp[0], G[3]], [G[0], G[3]]];
      add(polyXY(U, -0.005, { fill: 0.06 }));
      // ratio on the right, pushed back in depth
      const s = 0.42, ox = 3.0, z = -1.2;
      const tr = (pts, dy) => pts.map(([x, y]) => [ox + (x - (-2.2)) * s, dy + (y - 2.15) * s]);
      const Ic = tr(rectP(I).slice(0, 4), 3.0), Uc = tr(U, 0.9);
      add(polyXY(Ic, z, { c: 'acc', fill: 0.6 }));
      add(K.line(Ic.concat([Ic[0]]).map(([x, y]) => [x, y, z]), { c: 'acc', w: 1.4 }));
      add(polyXY(Uc, z, { fill: 0.1 }));
      add(K.line(Uc.concat([Uc[0]]).map(([x, y]) => [x, y, z]), { w: 1.4, o: 0.8 }));
      add(K.line([[ox - 1.2, 2.0, z], [ox + 1.2, 2.0, z]], { w: 1.8 }));
      const iA = (I[1] - I[0]) * (I[3] - I[2]), uA = (G[1] - G[0]) * (G[3] - G[2]) + (Pp[1] - Pp[0]) * (Pp[3] - Pp[2]) - iA;
      L('= ' + (iA / uA).toFixed(2), [ox + 2.15, 2.0, z], { size: 0.42, c: 'acc', o: 1 });
      L('IoU', [ox, 4.6, z], { size: 0.42 });
      add(K.arc([-2.0, 2.2, 0.02], [ox - 0.3, 3.4, z], 0.6, { c: 'acc', w: 1, o: 0.45, dash: true }));
      ground(g, [-5, 5], [-2, 1], 0, 8, 0.05);
      legend = [{ c: 'acc', t: 'Intersection' }, { c: 'ink', t: 'Union of both boxes' }];

    /* ======================= TRUE & FALSE POSITIVES ======================= */
    } else if (kind === 'truepos') {
      const thr = 0.3, bw = 0.42, dh = 0.3;
      const rows = [{ z: -1.8, mu: 1.1, hollow: false }, { z: 1.8, mu: -1.1, hollow: true }];
      rows.forEach((row, ri) => {
        const r = K.rng(40 + ri), cnt = {};
        const acc = [], ink = [];
        for (let i = 0; i < 36; i++) {
          const v = Math.max(-4.2, Math.min(4.2, row.mu + 1.05 * r.n()));
          const b = Math.round(v / bw); cnt[b] = (cnt[b] || 0) + 1;
          const x = b * bw, P = [x, 0.18 + (cnt[b] - 1) * dh, row.z];
          (x > thr ? acc : ink).push(P);
        }
        add(K.dots(acc, { r: 0.12, c: 'acc', hollow: row.hollow }));
        add(K.dots(ink, { r: 0.12, o: 0.75, hollow: row.hollow }));
        add(K.line([[-4.6, 0, row.z], [4.6, 0, row.z]], { w: 1, o: 0.4 }));
      });
      add(K.rect(thr, 1.6, 0, 3.2, 5.2, 'yz', { o: 0.5, fill: 0.05, w: 1.2 }));
      L('t', [thr, 3.55, 0], { size: 0.4 });
      L('TP', [5.1, 0.3, -1.8], { c: 'acc', size: 0.42, o: 1 });
      L('FN', [-5.1, 0.3, -1.8], { size: 0.42, o: 0.8 });
      L('FP', [5.1, 0.3, 1.8], { c: 'acc', size: 0.42, o: 1 });
      L('TN', [-5.1, 0.3, 1.8], { size: 0.42, o: 0.8 });
      ground(g, [-4.6, 4.6], [-2.6, 2.6], 0, 8, 0.05);
      legend = [{ c: 'acc', t: 'Predicted positive' }, { c: 'ink', t: 'Predicted negative' }, { c: 'ink', t: 'Hollow: actually negative' }];

    /* ======================= BASE RATE ======================= */
    } else if (kind === 'baserate') {
      const nx = 20, nz = 10, sp = 0.42, lift = 1.3;
      const pos = new Set([23, 87, 131, 176]);
      const r = K.rng(17), fp = new Set();
      while (fp.size < 10) { const k = r.int(0, nx * nz - 1); if (!pos.has(k)) fp.add(k); }
      const flat = [], up = [], accP = [], stems = [], accStems = [];
      for (let k = 0; k < nx * nz; k++) {
        const x = -((nx - 1) * sp) / 2 + (k % nx) * sp - 1.0, z = -((nz - 1) * sp) / 2 + Math.floor(k / nx) * sp;
        if (pos.has(k)) { accP.push([x, lift, z]); accStems.push([[x, 0, z], [x, lift, z]]); }
        else if (fp.has(k)) { up.push([x, lift, z]); stems.push([[x, 0, z], [x, lift, z]]); }
        else flat.push([x, 0.06, z]);
      }
      add(K.dots(flat, { r: 0.07, o: 0.3 }));
      add(K.dots(up, { r: 0.1, o: 0.85 }));
      add(K.dots(accP, { r: 0.13, c: 'acc' }));
      add(K.segs(stems, { o: 0.35 }));
      add(K.segs(accStems, { c: 'acc', o: 0.7 }));
      add(K.rect(-1.0, lift - 0.02, 0, nx * sp + 0.2, nz * sp + 0.2, 'xz', { o: 0.18, w: 1 }));
      // stacked column of what the test flags
      const cx = 4.4, Ht = 3.6, a = Ht * 4 / 14;
      add(K.box(cx, a / 2, 0, 0.7, a, 0.7, { c: 'acc', fill: 0.7, fc: 'acc' }));
      add(K.box(cx, a + (Ht - a) / 2, 0, 0.7, Ht - a, 0.7, { fill: 0.08, o: 0.7 }));
      L('4/14', [cx + 0.95, a / 2, 0], { size: 0.32, c: 'acc', o: 1 });
      L('2%', [-1.0 - (nx * sp) / 2 - 0.1, 0.3, (nz * sp) / 2 + 0.1], { size: 0.42, c: 'acc', o: 1 });
      legend = [{ c: 'acc', t: 'Actual positives (2%)' }, { c: 'ink', t: 'Raised: test positive' }];

    } else {
      g.add(K.box(0, 0, 0, 3, 3, 3, { o: 0.3 }));
    }
    if (!['localmin', 'closedform', 'lagrange', 'baserate'].includes(kind)) g.rotation.y = 0.45;
    return { g, legend, tick };
  };
})();
