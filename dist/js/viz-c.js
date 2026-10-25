/* Latent Atlas — viz-c: dist, matrix, series, tree, partition, forest, boost, bootstrap, folds, hparam */
(function () {
  const VIZ = window.VIZ;

  /* ---------- shared helpers ---------- */
  const gauss = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) * ((x - m) / s));
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const lerp = (a, b, t) => a + (b - a) * t;

  function mk(K) {
    const T = K.THREE;
    const g = new T.Group();
    const add = (o) => { g.add(o); return o; };
    /* filled polygon in the xy plane at depth z (pts = [[x,y],...]) */
    const area = (pts, z, o = {}) => {
      const sh = new T.Shape();
      pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
      const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.fill == null ? 0.15 : o.fill, side: T.DoubleSide, depthWrite: false }));
      m.position.z = z; return add(m);
    };
    /* a curve y=f(x) on the plane at depth z, with optional filled area to baseline y0 */
    const pdf = (f, x0, x1, z, o = {}) => {
      const n = o.n || 80, y0 = o.y0 || 0, pts = [];
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push([x, y0 + f(x), z]); }
      add(K.line(pts, { c: o.c, o: o.o, w: o.w == null ? 2 : o.w, dash: o.dash }));
      if (o.fill) area([[x0, y0]].concat(pts.map((p) => [p[0], p[1]])).concat([[x1, y0]]), z, { c: o.fc || o.c, fill: o.fill });
      return pts;
    };
    /* a bar standing on y0 (h may be negative) */
    const bar = (x, z, w, d, h, o = {}) => {
      const y0 = o.y0 || 0;
      return add(K.box(x, y0 + h / 2, z, w, Math.abs(h) || 0.02, d, o));
    };
    const lab = (t, p, o = {}) => add(K.label(t, p, Object.assign({ size: 0.36 }, o)));
    const ln = (pts, o) => add(K.line(pts, o));
    const sg = (pairs, o) => add(K.segs(pairs, o));
    /* rotate the whole scene about y so the x axis faces the default camera more squarely */
    const yaw = (a) => { const piv = new T.Group(); while (g.children.length) piv.add(g.children[0]); piv.rotation.y = a; g.add(piv); };
    return { T, g, add, area, pdf, bar, lab, ln, sg, yaw };
  }
  const fillA = { fill: 0.65, fc: 'acc', c: 'acc' };
  const fillB = { fill: 0.55, fc: 'b', c: 'b' };
  const fillI = (f = 0.1, o = 1) => ({ fill: f, o });


  /* =========================================================== DIST */
  VIZ.dist = function (p, K) {
    const S = mk(K), { g } = S, kind = p.kind || 'shift';
    let legend = [], ctl, tick;
    const softmax = (z, T = 1) => { const m = Math.max(...z); const e = z.map((v) => Math.exp((v - m) / T)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
    const floorLine = (x0, x1, z, o = 0.35) => S.ln([[x0, 0, z], [x1, 0, z]], { o, w: 1 });

    if (kind === 'shift') {
      const n = 5;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), z = -3 + 6 * t, m = -1.6 + 3.0 * t, s = 0.9 + 0.35 * t;
        const f = (x) => 3.0 * gauss(x, m, s) * (1 - 0.15 * t);
        floorLine(-5, 5, z, 0.25);
        if (k === 0) S.pdf(f, -5, 5, z, { w: 2, fill: 0.12 });
        else if (k === n - 1) S.pdf(f, -5, 5, z, { c: 'acc', w: 2.4, fill: 0.22 });
        else S.pdf(f, -5, 5, z, { o: 0.22, w: 1 });
      }
      const path = range(5).map((k) => { const t = k / 4; return [-1.6 + 3.0 * t, 0, -3 + 6 * t]; });
      S.ln(path, { c: 'acc', w: 1.6, dash: true });
      S.add(K.dots(path, { r: 0.07, c: 'acc' }));
      S.lab('t', [5.4, 0.15, 3.0], { size: 0.38, o: 0.6 });
      S.ln([[5.2, 0, -3], [5.2, 0, 3]], { o: 0.4, w: 1 });
      legend = [{ c: 'ink', t: 'Training data' }, { c: 'acc', t: 'Production data' }];
    }

    else if (kind === 'zscore') {
      const mR = 2.6, sR = 1.5;
      floorLine(-4.5, 6.5, -1.6); floorLine(-4.5, 6.5, 1.6);
      S.pdf((x) => 2.2 * gauss(x, mR, sR), -2.5, 7, -1.6, { w: 1.8, fill: 0.1 });
      S.pdf((x) => 3.6 * gauss(x, 0, 1), -4.2, 4.2, 1.6, { c: 'acc', w: 2.4, fill: 0.22 });
      // mean / sd markers
      S.ln([[mR, 0, -1.6], [mR, 2.4, -1.6]], { o: 0.5, w: 1, dash: true });
      S.ln([[0, 0, 1.6], [0, 3.8, 1.6]], { c: 'acc', o: 0.8, w: 1.2, dash: true });
      [-1, 1].forEach((d) => S.ln([[d, 0, 1.6], [d, 3.6 * gauss(d, 0, 1), 1.6]], { c: 'acc', o: 0.6, w: 1 }));
      S.ln([[mR - sR, 2.2 * gauss(sR, 0, sR), -1.6], [mR + sR, 2.2 * gauss(sR, 0, sR), -1.6]], { o: 0.5, w: 1 });
      S.add(K.arrow([mR, 0.02, -1.4], [0.15, 0.02, 1.4], { c: 'acc', w: 1.6 }));
      S.lab('μ', [mR, 2.75, -1.6]); S.lab('σ', [mR + sR + 0.35, 1.55, -1.6]);
      S.lab('0', [0, -0.4, 1.6], { c: 'acc' }); S.lab('1', [1, -0.4, 1.6], { c: 'acc', o: 0.8 }); S.lab('−1', [-1, -0.4, 1.6], { c: 'acc', o: 0.8 });
      S.lab('(x−μ)/σ', [1.4, 0.45, 0], { size: 0.38, mono: true, o: 0.75 });
      legend = [{ c: 'ink', t: 'Raw feature' }, { c: 'acc', t: 'Standardized feature' }];
    }

    else if (kind === 'bn') {
      const chans = [[-3.1, 0.45], [-2.1, 0.8], [-3.7, 0.35], [-1.6, 0.6]];
      chans.forEach(([m, s], i) => {
        const z = -2.4 + 1.6 * i;
        floorLine(-5.2, -0.6, z, 0.25); floorLine(0.6, 5.2, z, 0.25);
        S.pdf((x) => 1.5 * gauss(x, m, s), -5.2, -0.6, z, { w: 1.4, o: 0.75, fill: 0.06 });
        S.pdf((x) => 1.8 * gauss(x, 2.9, 0.6), 0.6, 5.2, z, { c: 'acc', w: 2, fill: 0.16 });
        S.ln([[m, 0, z], [m, 1.5, z]], { o: 0.35, w: 1, dash: true });
      });
      S.ln([[2.9, 0, -2.6], [2.9, 0, 2.6]], { c: 'acc', o: 0.7, w: 1.2, dash: true });
      S.add(K.arrow([-0.5, 2.3, 0], [0.5, 2.3, 0], { w: 1.6 }));
      S.lab('BN', [0, 2.75, 0], { size: 0.38, weight: 600 });
      S.lab('μ_B, σ_B', [-3, 2.4, -2.4], { size: 0.32, o: 0.6 });
      S.lab('γ x̂ + β', [2.9, 2.4, -2.4], { size: 0.32, c: 'acc' });
      legend = [{ c: 'ink', t: 'Shifted activations' }, { c: 'acc', t: 'Normalized activations' }];
    }

    else if (kind === 'rms') {
      const x = [1.9, 0.7, 2.6, 1.3, 0.4, 2.2, 1.6, 0.9];
      const n = x.length, mean = x.reduce((a, b) => a + b, 0) / n;
      const sd = Math.sqrt(x.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
      const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / n);
      const sc = 0.8, X = (i) => -3.5 + i;
      const rows = [
        { z: -3.4, v: x, o: fillI(0.1, 0.8), t: 'x', c: 'ink' },
        { z: 0, v: x.map((v) => (v - mean) / sd), o: { fill: 0.35, fc: 'b', c: 'b' }, t: 'LN', c: 'b' },
        { z: 3.4, v: x.map((v) => v / rms), o: { fill: 0.6, fc: 'acc', c: 'acc' }, t: 'RMS', c: 'acc' },
      ];
      rows.forEach((r) => {
        S.ln([[-4.3, 0, r.z], [4.3, 0, r.z]], { o: 0.45, w: 1 });
        r.v.forEach((v, i) => S.bar(X(i), r.z, 0.6, 0.3, v * sc, r.o));
        S.lab(r.t, [-5.1, 0.25, r.z], { size: 0.38, weight: 600, c: r.c });
      });
      S.ln([[-4.3, mean * sc, -3.4], [4.3, mean * sc, -3.4]], { c: 'b', w: 1.4, dash: true });
      S.ln([[-4.3, rms * sc, -3.4], [4.3, rms * sc, -3.4]], { c: 'acc', w: 1.4, dash: true });
      S.lab('μ', [4.7, mean * sc, -3.4], { c: 'b', size: 0.36 });
      S.lab('rms', [4.9, rms * sc + 0.1, -3.4], { c: 'acc', size: 0.32, mono: true });
      S.lab('x−μ', [5.0, 0.3, 0], { c: 'b', size: 0.3, mono: true });
      S.lab('x/rms', [5.1, 0.3, 3.4], { c: 'acc', size: 0.3, mono: true });
      legend = [{ c: 'acc', t: 'RMSNorm (no centring)' }, { c: 'b', t: 'LayerNorm (centred)' }];
    }

    else if (kind === 'gauss2') {
      const A = { mx: -1.2, mz: -0.6, sx: 1.0, sz: 1.3 }, B = { mx: 1.4, mz: 0.8, sx: 1.4, sz: 0.9 };
      const f = (c, x, z) => 3.2 * gauss(x, c.mx, c.sx) * gauss(z, c.mz, c.sz);
      const n = 30, r0 = 4, P = (i, j) => { const x = -r0 + 2 * r0 * i / n, z = -r0 + 2 * r0 * j / n; return [x, z]; };
      const pa = [], pb = [];
      const H = (x, z) => Math.max(f(A, x, z), f(B, x, z));
      for (let i = 0; i <= n; i++) for (let j = 0; j < n; j++) {
        for (const [a, b] of [[P(i, j), P(i, j + 1)], [P(j, i), P(j + 1, i)]]) {
          const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
          const seg = [[a[0], H(a[0], a[1]), a[1]], [b[0], H(b[0], b[1]), b[1]]];
          (f(A, mx, mz) >= f(B, mx, mz) ? pa : pb).push(seg);
        }
      }
      S.sg(pa, { c: 'acc', o: 0.55 }); S.sg(pb, { c: 'b', o: 0.5 });
      // decision boundary on the floor (marching along x, solve in z by scan)
      const bnd = [];
      for (let i = 0; i <= 80; i++) {
        const x = -r0 + 2 * r0 * i / 80; let prev = null;
        for (let j = 0; j <= 160; j++) {
          const z = -r0 + 2 * r0 * j / 160; const d = Math.log(f(A, x, z) + 1e-12) - Math.log(f(B, x, z) + 1e-12);
          if (prev != null && Math.sign(d) !== Math.sign(prev)) { bnd.push([x, 0.01, z]); break; }
          prev = d;
        }
      }
      const curtains = [];
      bnd.forEach((q, i) => { if (i % 4 === 0) curtains.push([q, [q[0], H(q[0], q[2]), q[2]]]); });
      S.ln(bnd, { w: 2.4 });
      S.sg(curtains, { o: 0.3 });
      S.add(K.frame({ s: 4, grid: true, h: 0.01, axes: false, n: 8 }));
      const r = K.rng(7), ptsA = [], ptsB = [];
      for (let i = 0; i < 26; i++) { ptsA.push([A.mx + r.n() * A.sx * 0.8, 0.02, A.mz + r.n() * A.sz * 0.8]); ptsB.push([B.mx + r.n() * B.sx * 0.8, 0.02, B.mz + r.n() * B.sz * 0.8]); }
      const clip = (q) => Math.abs(q[0]) < 3.9 && Math.abs(q[2]) < 3.9;
      S.add(K.dots(ptsA.filter(clip), { r: 0.07, c: 'acc' }));
      S.add(K.dots(ptsB.filter(clip), { r: 0.08, c: 'b', hollow: true }));
      S.lab('p(x|A)', [A.mx - 0.6, f(A, A.mx, A.mz) + 0.5, A.mz], { c: 'acc', size: 0.34, mono: true });
      S.lab('p(x|B)', [B.mx + 0.4, f(B, B.mx, B.mz) + 0.5, B.mz], { c: 'b', size: 0.34, mono: true });
      legend = [{ c: 'acc', t: 'Class A' }, { c: 'b', t: 'Class B' }, { c: 'ink', t: 'Decision boundary' }];
    }

    else if (kind === 'thresh') {
      const t = p.threshold == null ? 0.4 : +p.threshold;
      const fN = (x) => 2.6 * gauss(x, -1.2, 1.0), fP = (x) => 2.6 * gauss(x, 1.3, 1.05);
      const zN = -0.9, zP = 0.9, x0 = -4.6, x1 = 4.6;
      floorLine(x0, x1, zN); floorLine(x0, x1, zP);
      const part = (f, z, c, a, b, fill) => {
        const pts = []; const n = 60;
        for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; pts.push([x, f(x)]); }
        S.area([[a, 0]].concat(pts).concat([[b, 0]]), z, { c, fill });
      };
      S.pdf(fN, x0, x1, zN, { c: 'b', w: 2 });
      S.pdf(fP, x0, x1, zP, { c: 'acc', w: 2 });
      part(fN, zN, 'b', x0, t, 0.08); part(fN, zN, 'b', t, x1, 0.45);
      part(fP, zP, 'acc', x0, t, 0.08); part(fP, zP, 'acc', t, x1, 0.55);
      S.add(K.rect(t, 1.6, 0, 3.4, 3.2, 'yz', { fill: 0.04, o: 0.85, w: 1.4 }));
      S.lab('τ', [t, 3.75, 0], { size: 0.44, weight: 600 });
      S.lab('FP', [t + 0.9, 0.35, zN], { c: 'b', size: 0.3 });
      S.lab('TP', [t + 1.3, 0.9, zP + 0.1], { c: 'acc', size: 0.3 });
      S.ln([[x0, 0, 2.0], [x1, 0, 2.0]], { o: 0.35, w: 1 });
      S.lab('s', [x1 + 0.3, 0, 2.0], { size: 0.34, mono: true, o: 0.55 });
      legend = [{ c: 'acc', t: 'Positive class' }, { c: 'b', t: 'Negative class' }, { c: 'ink', t: 'Threshold' }];
      ctl = [{ key: 'threshold', label: 'τ', min: -2.5, max: 2.5, step: 0.1, value: 0.4 }];
    }

    else if (kind === 'softmax') {
      const z = [1.3, 2.9, -0.6, 0.4, 2.0, -1.4], P = softmax(z), n = z.length;
      const xs = (i) => -3.2 + i * 1.28;
      S.ln([[-4, 0, -2.2], [4, 0, -2.2]], { o: 0.45, w: 1 }); S.ln([[-4, 0, 2.2], [4, 0, 2.2]], { o: 0.45, w: 1 });
      z.forEach((v, i) => S.bar(xs(i), -2.2, 0.55, 0.3, v * 0.85, fillI(0.1, 0.85)));
      P.forEach((v, i) => S.bar(xs(i), 2.2, 0.55, 0.3, v * 6, fillA));
      const links = z.map((v, i) => [[xs(i), 0, -1.9], [xs(i), 0, 1.9]]);
      S.sg(links, { o: 0.15 });
      S.lab('z', [-4.6, 0.3, -2.2], { size: 0.42, weight: 600 });
      S.lab('p', [-4.6, 0.3, 2.2], { size: 0.42, weight: 600, c: 'acc' });
      S.lab('Σp = 1', [4.9, 0.35, 2.2], { size: 0.34, c: 'acc' });
      S.lab('eᶻ / Σeᶻ', [5.0, 0.35, 0], { size: 0.34, o: 0.65 });
      legend = [{ c: 'ink', t: 'Logits' }, { c: 'acc', t: 'Probabilities' }];
    }

    else if (kind === 'init') {
      // activation spread through 5 layers for four initialisations
      const rows = [
        { t: 'σ=0.01', s: [0.6, 0.3, 0.14, 0.06, 0.025], good: false },
        { t: 'Xavier', s: [0.6, 0.58, 0.6, 0.57, 0.59], good: true },
        { t: 'He', s: [0.6, 0.62, 0.6, 0.61, 0.6], good: true },
        { t: 'σ=1', s: [0.6, 0.85, 1.05, 1.2, 1.3], good: false },
      ];
      rows.forEach((r, ri) => {
        const z = -3.3 + 2.2 * ri;
        S.ln([[-4.4, 0, z], [4.6, 0, z]], { o: 0.3, w: 1 });
        r.s.forEach((s, li) => {
          const cx = -3.4 + li * 1.9, w = Math.min(s, 0.95);
          const hgt = Math.min(2.0, 0.75 / Math.max(s, 0.05));
          const f = (x) => hgt * gauss(x, cx, w * 0.6);
          S.pdf(f, cx - 0.95, cx + 0.95, z, r.good ? { c: 'acc', w: 2, fill: 0.18, n: 40 } : { w: 1.2, o: 0.5, fill: 0.05, n: 40 });
        });
        S.lab(r.t, [5.5, 0.3, z], { size: 0.34, c: r.good ? 'acc' : 'ink', o: r.good ? 1 : 0.65, weight: 600 });
      });
      S.add(K.arrow([-3.4, -0.35, 4.0], [3.4, -0.35, 4.0], { o: 0.5, w: 1.2 }));
      S.lab('ℓ', [3.9, -0.35, 4.0], { size: 0.36, o: 0.6 });
      legend = [{ c: 'acc', t: 'Stable variance' }, { c: 'ink', t: 'Vanishing / exploding' }];
    }

    else if (kind === 'greedy') {
      const steps = [['the', 'a', 'cat', 'on', 'sat'], ['cat', 'dog', 'mat', 'sat', 'a'], ['sat', 'ran', 'is', 'on', 'the'], ['on', 'down', 'the', 'by', 'up']];
      const r = K.rng(3), picked = [];
      steps.forEach((toks, si) => {
        const z = -2.7 + 1.8 * si;
        let pr = toks.map(() => 0.2 + r()); const best = r.int(0, 4); pr[best] += 1.6;
        const s = pr.reduce((a, b) => a + b, 0); pr = pr.map((v) => v / s);
        S.ln([[-3.4, 0, z], [3.4, 0, z]], { o: 0.35, w: 1 });
        pr.forEach((v, i) => S.bar(-2.6 + i * 1.3, z, 0.5, 0.5, v * 5, i === best ? fillA : fillI(0.08, 0.6)));
        const x = -2.6 + best * 1.3; picked.push([x, pr[best] * 5 + 0.05, z]);
        S.lab(toks[best], [x, pr[best] * 5 + 0.5, z], { c: 'acc', size: 0.36, weight: 600 });
      });
      S.ln(picked, { c: 'acc', w: 1.4, dash: true });
      S.add(K.arrow([4.0, -0.3, -2.7], [4.0, -0.3, 2.7], { o: 0.45, w: 1.2 }));
      S.lab('t', [4.0, -0.3, 3.2], { size: 0.32, o: 0.6 });
      legend = [{ c: 'acc', t: 'Argmax token' }];
    }

    else if (kind === 'beam') {
      // tree drawn on a vertical plane: x = decoding step, y = candidate slot; depth bar = sequence score
      const r = K.rng(5), W = 3, dx = 2.3, H = 6.0;
      const root = { x: -4.6, y: 0, s: 1, kept: true, par: null };
      let beams = [root];
      const nodes = [root], eK = [], eP = [];
      for (let step = 1; step <= 4; step++) {
        const cands = [];
        const per = step === 1 ? 4 : 3;
        beams.forEach((b) => { for (let k = 0; k < per; k++) cands.push({ par: b, s: b.s * (0.3 + 0.7 * r()) }); });
        cands.forEach((c, i) => { c.x = -4.6 + step * dx; c.y = H / 2 - H * i / (cands.length - 1); });
        cands.slice().sort((a, b) => b.s - a.s).slice(0, W).forEach((c) => (c.kept = true));
        cands.forEach((c) => { nodes.push(c); (c.kept ? eK : eP).push([[c.par.x, c.par.y, 0], [c.x, c.y, 0]]); });
        beams = cands.filter((c) => c.kept);
      }
      let best = beams.slice().sort((a, b) => b.s - a.s)[0]; const bp = [];
      while (best) { bp.push([best.x, best.y, 0]); best = best.par; }
      S.sg(eP, { o: 0.16 }); S.sg(eK, { c: 'acc', w: 1.4, o: 0.55 });
      S.ln(bp, { c: 'acc', w: 2.6 });
      const kd = [], pd = [], kr = [];
      nodes.forEach((n) => { (n.kept ? kd : pd).push([n.x, n.y, 0]); });
      S.add(K.dots(kd, { r: 0.13, c: 'acc' }));
      S.add(K.dots(pd, { r: 0.09, o: 0.3 }));
      // score depth bars (log-prob magnitude) behind each node
      for (let st = 0; st <= 4; st++) S.lab('t' + st, [-4.6 + st * dx, -H / 2 - 0.7, 0], { size: 0.3, o: 0.5 });
      S.lab('k = 3', [-4.6, 0.65, 0], { size: 0.36, c: 'acc' });
      legend = [{ c: 'acc', t: 'Kept beams' }, { c: 'ink', t: 'Pruned candidates' }];
    }

    else if (kind === 'temp') {
      const T = p.temperature == null ? 1 : +p.temperature;
      const z = [2.4, 1.6, 0.9, 0.5, 0.1, -0.4, -0.9, -1.5];
      const draw = (TT, zz, cur) => {
        const P = softmax(z, TT);
        S.ln([[-4.2, 0, zz], [4.2, 0, zz]], { o: cur ? 0.5 : 0.3, w: 1 });
        P.forEach((v, i) => S.bar(-3.7 + i * 1.05, zz, 0.45, 0.3, v * 5, cur ? fillA : fillI(0.05, 0.35)));
        S.ln(P.map((v, i) => [-3.7 + i * 1.05, v * 5, zz]), cur ? { c: 'acc', w: 1.6 } : { o: 0.35, w: 1 });
        S.lab('T=' + TT.toFixed(1), [4.9, 0.25, zz], { size: 0.32, c: cur ? 'acc' : 'ink', o: cur ? 1 : 0.5, weight: 600 });
      };
      [0.4, 2.5].forEach((TT, i) => draw(TT, -2.4 + 2.2 * i, false));
      draw(T, 2.2, true);
      legend = [{ c: 'acc', t: 'Current temperature' }, { c: 'ink', t: 'Reference temperatures' }];
      ctl = [{ key: 'temperature', label: 'T', min: 0.2, max: 3, step: 0.1, value: 1 }];
    }

    else if (kind === 'topk' || kind === 'topp') {
      const logits = [2.6, 2.0, 1.6, 1.2, 0.9, 0.6, 0.3, 0.1, -0.2, -0.5, -0.8, -1.1];
      const P = softmax(logits), n = P.length, xs = (i) => -4.4 + i * 0.8, H = 7;
      S.ln([[-4.9, 0, 0.8], [4.9, 0, 0.8]], { o: 0.45, w: 1 });
      if (kind === 'topk') {
        const k = Math.round(p.k == null ? 4 : +p.k);
        P.forEach((v, i) => S.bar(xs(i), 0.8, 0.42, 0.42, v * H, i < k ? fillA : fillI(0.05, 0.35)));
        const kept = P.slice(0, k), sk = kept.reduce((a, b) => a + b, 0);
        S.ln([[-4.9, 0, -2.2], [4.9, 0, -2.2]], { o: 0.3, w: 1 });
        kept.forEach((v, i) => S.bar(xs(i), -2.2, 0.42, 0.42, (v / sk) * H, { fill: 0.18, fc: 'acc', c: 'acc', o: 0.6 }));
        S.sg(kept.map((v, i) => [[xs(i), 0.02, 0.5], [xs(i), 0.02, -1.9]]), { c: 'acc', o: 0.35 });
        const cx = k < n ? (xs(k - 1) + xs(k)) / 2 : xs(n - 1) + 0.4;
        S.ln([[cx, 0, 2.0], [cx, 0, -3.2]], { w: 1.6, dash: true });
        S.ln([[cx, 0, 2.0], [cx, 2.6, 2.0]], { w: 1, o: 0.4 });
        S.lab('k = ' + k, [cx, 2.95, 2.0], { size: 0.4, c: 'acc', weight: 600 });
        S.lab('p / Σ', [5.6, 0.3, -2.2], { size: 0.32, mono: true, c: 'acc', o: 0.8 });
        legend = [{ c: 'acc', t: 'Top-k tokens' }, { c: 'ink', t: 'Discarded tokens' }];
        ctl = [{ key: 'k', label: 'k', min: 1, max: 12, step: 1, value: 4 }];
      } else {
        const pp = p.p == null ? 0.8 : +p.p, Hc = 4.0, zc = -1.6;
        let cum = 0, cut = n - 1; const cpts = [];
        P.forEach((v, i) => { cum += v; cpts.push([xs(i), cum * Hc, zc]); });
        cum = 0; for (let i = 0; i < n; i++) { cum += P[i]; if (cum >= pp - 1e-9) { cut = i; break; } }
        P.forEach((v, i) => S.bar(xs(i), 0.8, 0.42, 0.42, v * H, i <= cut ? fillA : fillI(0.05, 0.35)));
        S.ln([[-4.9, 0, zc], [4.9, 0, zc]], { o: 0.3, w: 1 });
        S.ln([[-4.9, 0, zc], [-4.9, Hc, zc]], { o: 0.3, w: 1 });
        S.ln([[-4.9, Hc, zc], [4.9, Hc, zc]], { o: 0.15, w: 1, dash: true });
        S.ln([[xs(0), 0, zc]].concat(cpts), { w: 2 }); S.add(K.dots(cpts, { r: 0.05 }));
        S.ln([[-4.9, pp * Hc, zc], [4.9, pp * Hc, zc]], { c: 'acc', w: 1.4, dash: true });
        S.ln([[cpts[cut][0], 0, zc], [cpts[cut][0], cpts[cut][1], zc]], { c: 'acc', w: 1, o: 0.7 });
        S.add(K.dots([cpts[cut]], { r: 0.11, c: 'acc' }));
        S.lab('p = ' + pp.toFixed(2), [5.7, pp * Hc, zc], { size: 0.34, c: 'acc' });
        S.lab('1', [-5.25, Hc, zc], { size: 0.3, o: 0.55 });
        S.lab('Σp', [-5.3, Hc * 0.55, zc], { size: 0.32, o: 0.6 });
        legend = [{ c: 'acc', t: 'Nucleus tokens' }, { c: 'ink', t: 'Cumulative probability' }];
        ctl = [{ key: 'p', label: 'p', min: 0.3, max: 0.99, step: 0.01, value: 0.8 }];
      }
    }
    return { g, legend, ctl, tick };
  };


  /* =========================================================== MATRIX */
  VIZ.matrix = function (p, K) {
    const S = mk(K), { g } = S, kind = p.kind || 'attn';
    let legend = [], ctl, tick;
    /* grid of bars on the floor: rows along z, cols along x (rev: cols run right→left so a diagonal is across the view) */
    const grid = (nr, nc, cs, fn, o = {}) => {
      const ox = o.x || 0, oz = o.z || 0, gap = o.gap == null ? 0.18 : o.gap, y0 = o.y || 0;
      const X = (j) => ox + (j - (nc - 1) / 2) * cs;
      const Z = (i) => oz + (i - (nr - 1) / 2) * cs;           // floor layout: rows along z
      const Y = (i) => y0 + ((nr - 1) / 2 - i) * cs;           // wall layout: rows downward
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const c = fn(i, j); if (!c) continue;
        const w = cs * (1 - gap), h = c.h == null ? 0.04 : c.h;
        if (o.wall) {
          if (c.flat) S.add(K.rect(X(j), Y(i), oz + 0.005, w, w, 'xy', c.style));
          else S.add(K.box(X(j), Y(i), oz + h / 2, w, w, Math.max(Math.abs(h), 0.03), c.style));
        } else {
          if (c.flat) S.add(K.rect(X(j), y0 + 0.005, Z(i), w, w, 'xz', c.style));
          else S.add(K.box(X(j), y0 + h / 2, Z(i), w, Math.max(Math.abs(h), 0.03), w, c.style));
        }
      }
      return { X, Z, Y };
    };
    const softmaxRow = (a) => { const m = Math.max(...a); const e = a.map((v) => Math.exp(v - m)); const s = e.reduce((x, y) => x + y, 0); return e.map((v) => v / s); };
    const ctx = (o = 0.3) => ({ fill: 0.04, o });
    const A = { fill: 0.62, fc: 'acc', c: 'acc' }, B = { fill: 0.45, fc: 'b', c: 'b' };
    const flatF = { o: 0.16, w: 1 };

    if (kind === 'missing') {
      const r = K.rng(21), nr = 7, nc = 5, cs = 0.95;
      const vals = range(nr).map(() => range(nc).map((j) => 0.3 + 0.12 * j + r() * 0.7));
      const holes = new Set(['1,1', '3,3', '4,0', '5,2', '0,4', '6,3']);
      const colMean = range(nc).map((j) => { let s2 = 0, c = 0; for (let i = 0; i < nr; i++) if (!holes.has(i + ',' + j)) { s2 += vals[i][j]; c++; } return s2 / c; });
      const G = grid(nr, nc, cs, (i, j) => holes.has(i + ',' + j) ? { h: colMean[j], style: A } : { h: vals[i][j], style: ctx(0.3) }, { wall: true });
      holes.forEach((k) => { const [i, j] = k.split(',').map(Number); S.add(K.rect(G.X(j), G.Y(i), 0.005, cs * 0.92, cs * 0.92, 'xy', { c: 'acc', o: 0.9, w: 1.4 })); S.lab('x̄', [G.X(j), G.Y(i), colMean[j] + 0.25], { size: 0.32, c: 'acc' }); });
      S.add(K.rect(0, 0, 0, nc * cs + 0.1, nr * cs + 0.1, 'xy', { o: 0.3, w: 1 }));
      legend = [{ c: 'acc', t: 'Imputed values' }, { c: 'ink', t: 'Observed values' }];
    }

    else if (kind === 'onehot') {
      const cats = ['A', 'B', 'C', 'A', 'C', 'B'], u = ['A', 'B', 'C'], cs = 0.95, nr = cats.length;
      const Yr = (i) => ((nr - 1) / 2 - i) * cs;
      cats.forEach((c, i) => {
        S.add(K.rect(-3.4, Yr(i), 0, 0.85, 0.85, 'xy', { o: 0.5, w: 1, fill: 0.05 }));
        S.lab(c, [-3.4, Yr(i), 0.05], { size: 0.38, mono: true, weight: 600 });
      });
      S.add(K.arrow([-2.6, 0, 0], [-1.3, 0, 0], { w: 1.4, o: 0.6 }));
      const G = grid(nr, 3, cs, (i, j) => cats[i] === u[j] ? { h: 0.9, style: A } : { flat: true, style: { o: 0.35, w: 1 } }, { x: 0.4, wall: true });
      cats.forEach((c, i) => u.forEach((cc, j) => { if (c !== cc) S.lab('0', [G.X(j), G.Y(i), 0.05], { size: 0.26, mono: true, o: 0.35 }); else S.lab('1', [G.X(j), G.Y(i), 0.95], { size: 0.3, mono: true, c: 'acc' }); }));
      u.forEach((c, j) => S.lab(c, [G.X(j), G.Y(0) + 0.8, 0], { size: 0.36, mono: true, weight: 600, o: 0.7 }));
      legend = [{ c: 'acc', t: 'Ones' }, { c: 'ink', t: 'Zeros' }];
    }

    else if (kind === 'ln') {
      const r = K.rng(4), nr = 6, nc = 8, cs = 0.8;
      const v = range(nr).map(() => range(nc).map(() => 0.15 + r() * 0.8));
      const qi = 2, fj = 5;
      const G = grid(nr, nc, cs, (i, j) => ({ h: v[i][j], style: i === qi ? A : j === fj ? B : ctx(0.22) }), { wall: true });
      const xa = G.X(0) - 0.6, xb = G.X(nc - 1) + 0.6, ya = G.Y(0) + 0.6, yb = G.Y(nr - 1) - 0.6;
      S.add(K.arrow([xa, G.Y(qi), 0], [xb, G.Y(qi), 0], { c: 'acc', w: 2 }));
      S.add(K.arrow([G.X(fj), ya, 0], [G.X(fj), yb, 0], { c: 'b', w: 2 }));
      S.lab('LN', [xb + 0.55, G.Y(qi), 0], { c: 'acc', size: 0.42, weight: 600 });
      S.lab('BN', [G.X(fj), yb - 0.45, 0], { c: 'b', size: 0.42, weight: 600 });
      S.lab('d', [G.X(1), ya + 0.1, 0], { size: 0.34, mono: true, o: 0.55 });
      S.lab('B', [xa - 0.3, G.Y(nr - 1), 0], { size: 0.34, mono: true, o: 0.55 });
      legend = [{ c: 'acc', t: 'LayerNorm: across features' }, { c: 'b', t: 'BatchNorm: across batch' }];
    }

    else if (kind === 'colsample') {
      const r = K.rng(8), nt = 5, nf = 8, cs = 0.85;
      for (let t = 0; t < nt; t++) {
        const z = -3.0 + t * 1.5;
        const pick = new Set(); while (pick.size < 3) pick.add(r.int(0, nf - 1));
        for (let j = 0; j < nf; j++) {
          const x = (j - (nf - 1) / 2) * cs - 0.6;
          if (pick.has(j)) S.add(K.box(x, 0.3, z, cs * 0.75, 0.6, 0.6, A));
          else S.add(K.rect(x, 0.005, z, cs * 0.75, 0.6, 'xz', { o: 0.25, w: 1 }));
        }
        const tx = (nf / 2) * cs + 0.2;
        S.sg([[[tx, 0.9, z], [tx - 0.3, 0.5, z]], [[tx, 0.9, z], [tx + 0.3, 0.5, z]], [[tx + 0.3, 0.5, z], [tx + 0.1, 0.1, z]], [[tx + 0.3, 0.5, z], [tx + 0.5, 0.1, z]]], { o: 0.6, w: 1 });
        S.add(K.dots([[tx, 0.9, z], [tx - 0.3, 0.5, z], [tx + 0.3, 0.5, z], [tx + 0.1, 0.1, z], [tx + 0.5, 0.1, z]], { r: 0.06 }));
      }
      legend = [{ c: 'acc', t: 'Sampled features' }, { c: 'ink', t: 'Unused features' }];
    }

    else if (kind === 'conf') {
      const hl = p.hl || 'none', cs = 2.0, w = 1.4;
      const cells = { TP: [0, 0, 2.6], FN: [0, 1, 0.9], FP: [1, 0, 0.6], TN: [1, 1, 2.1] };
      const style = (k) => {
        const F = ctx(0.3);
        if (hl === 'acc') return k === 'TP' || k === 'TN' ? A : F;
        if (hl === 'prec') return k === 'TP' ? A : k === 'FP' ? B : F;
        if (hl === 'rec') return k === 'TP' ? A : k === 'FN' ? B : F;
        return k === 'TP' || k === 'TN' ? A : B;
      };
      Object.entries(cells).forEach(([k, [i, j, h]]) => {
        const x = (j - 0.5) * cs, z = (i - 0.5) * cs, st = style(k);
        S.add(K.box(x, h / 2, z, w, h, w, st));
        S.add(K.rect(x, 0.005, z, cs * 0.96, cs * 0.96, 'xz', { o: 0.2, w: 1 }));
        S.lab(k, [x, h + 0.35, z], { size: 0.4, weight: 600, mono: true, c: st.c || 'ink', o: st.c ? 1 : 0.45 });
      });
      S.lab('ŷ=1', [-0.5 * cs, 0.05, -cs - 0.4], { size: 0.3, o: 0.55 }); S.lab('ŷ=0', [0.5 * cs, 0.05, -cs - 0.4], { size: 0.3, o: 0.55 });
      S.lab('y=1', [-cs - 0.65, 0.05, -0.5 * cs], { size: 0.3, o: 0.55 }); S.lab('y=0', [-cs - 0.65, 0.05, 0.5 * cs], { size: 0.3, o: 0.55 });
      const fx = [cs + 0.4, 0.05, cs + 0.9];
      if (hl === 'prec') {
        S.add(K.rect(-0.5 * cs, 0.01, 0, cs * 1.02, cs * 2.04, 'xz', { c: 'acc', w: 2.2 }));
        S.lab('TP / (TP+FP)', fx, { size: 0.32, mono: true, c: 'acc' });
        legend = [{ c: 'acc', t: 'True positives' }, { c: 'b', t: 'False positives' }];
      } else if (hl === 'rec') {
        S.add(K.rect(0, 0.01, -0.5 * cs, cs * 2.04, cs * 1.02, 'xz', { c: 'acc', w: 2.2 }));
        S.lab('TP / (TP+FN)', fx, { size: 0.32, mono: true, c: 'acc' });
        legend = [{ c: 'acc', t: 'True positives' }, { c: 'b', t: 'False negatives' }];
      } else if (hl === 'acc') {
        S.lab('(TP+TN) / N', fx, { size: 0.32, mono: true, c: 'acc' });
        legend = [{ c: 'acc', t: 'Correct predictions' }, { c: 'ink', t: 'Errors' }];
      } else legend = [{ c: 'acc', t: 'Correct predictions' }, { c: 'b', t: 'Errors' }];
    }

    else if (kind === 'permute') {
      const r = K.rng(31), nr = 7, nc = 5, cs = 0.85, pj = nc - 1;
      const v = range(nr).map(() => range(nc).map(() => 0.2 + r() * 0.8));
      const perm = [3, 5, 0, 6, 1, 4, 2];
      const G = grid(nr, nc, cs, (i, j) => j === pj ? { h: v[perm[i]][pj], style: A } : { h: v[i][j], style: ctx(0.28) }, { x: -1.6, wall: true });
      const bx0 = G.X(pj) + 0.55, bx1 = bx0 + 1.0;
      S.sg(range(nr).map((i) => [[bx0, G.Y(i), 0], [bx1, G.Y(perm[i]), 0]]), { c: 'acc', w: 1.4, o: 0.7 });
      S.add(K.dots(range(nr).map((i) => [bx0, G.Y(i), 0]).concat(range(nr).map((i) => [bx1, G.Y(i), 0])), { r: 0.05, c: 'acc' }));
      S.lab('x₅', [G.X(pj), G.Y(0) + 0.75, 0], { size: 0.38, c: 'acc', weight: 600 });
      const sx = bx1 + 1.4, y0 = G.Y(nr - 1) - cs / 2;
      S.ln([[sx - 0.6, y0, 0], [sx + 1.6, y0, 0]], { o: 0.4, w: 1 });
      S.add(K.box(sx, y0 + 1.3, 0, 0.55, 2.6, 0.4, ctx(0.8)));
      S.add(K.box(sx + 1.0, y0 + 0.75, 0, 0.55, 1.5, 0.4, A));
      S.ln([[sx, y0 + 2.6, 0], [sx + 1.0, y0 + 2.6, 0]], { c: 'acc', w: 1, dash: true });
      S.add(K.arrow([sx + 1.0, y0 + 2.6, 0], [sx + 1.0, y0 + 1.6, 0], { c: 'acc', w: 1.4 }));
      S.lab('Δ', [sx + 1.5, y0 + 2.1, 0], { size: 0.42, c: 'acc' });
      legend = [{ c: 'acc', t: 'Shuffled feature' }, { c: 'ink', t: 'Other features' }];
    }

    else if (kind === 'lookup') {
      const r = K.rng(12), V = 9, d = 5, cs = 0.62;
      const ids = [6, 1, 4], words = ['the', 'cat', 'sat'];
      const vals = range(V).map(() => range(d).map(() => 0.12 + r() * 0.7));
      const G = grid(V, d, cs, (i, j) => ({ h: vals[i][j], style: ids.includes(i) ? A : ctx(0.25) }), { wall: true });
      for (let i = 0; i < V; i++) S.lab(String(i), [G.X(0) - 0.6, G.Y(i), 0], { size: 0.26, mono: true, o: ids.includes(i) ? 1 : 0.35, c: ids.includes(i) ? 'acc' : 'ink' });
      const ox = G.X(d - 1) + 2.2;
      ids.forEach((id, k) => {
        const yy = 0.9 - k * 0.9;
        S.lab(words[k], [ox + d * 0.5 + 0.7, yy, 0], { size: 0.36, weight: 600 });
        for (let j = 0; j < d; j++) S.add(K.box(ox + j * 0.5, yy, vals[id][j] / 2, 0.4, 0.4, vals[id][j], A));
        S.add(K.curve([[G.X(d - 1) + 0.4, G.Y(id), 0], [(G.X(d - 1) + ox) / 2 + 0.1, (G.Y(id) + yy) / 2, 0], [ox - 0.4, yy, 0]], { c: 'acc', o: 0.6, w: 1.2 }));
      });
      S.lab('E', [0, G.Y(0) + 0.7, 0], { size: 0.42, weight: 600, o: 0.7 });
      legend = [{ c: 'acc', t: 'Looked-up rows' }, { c: 'ink', t: 'Embedding table' }];
    }

    else if (['attn', 'causal', 'alibi', 'window', 'sparse'].includes(kind)) {
      const r = K.rng(17);
      const words = ['the', 'cat', 'sat', 'on', 'the', 'warm', 'mat'];
      const labQK = (G, N, cs) => {
        S.lab('K', [G.X(N - 1) + cs * 0.9, G.Y(0) + cs * 0.9, 0], { size: 0.38, weight: 600, o: 0.7 });
        S.lab('Q', [G.X(0) - cs * 0.9, G.Y(N - 1) - cs * 0.9, 0], { size: 0.38, weight: 600, o: 0.7 });
      };
      let G;
      if (kind === 'attn') {
        const n = 7, cs = 0.85, q = 4;
        const scores = range(n).map((i) => range(n).map((j) => r.n() * 0.8 + (i === j ? 1.2 : 0) + (Math.abs(i - j) === 1 ? 0.5 : 0)));
        const Aw = scores.map(softmaxRow);
        G = grid(n, n, cs, (i, j) => ({ h: Aw[i][j] * 3.0, style: i === q ? A : ctx(0.25) }), { wall: true });
        words.forEach((t, j) => { S.lab(t, [G.X(j), G.Y(0) + 0.7, 0], { size: 0.28, o: 0.6 }); S.lab(t, [G.X(0) - 0.85, G.Y(j), 0], { size: 0.28, o: j === q ? 1 : 0.6, c: j === q ? 'acc' : 'ink' }); });
        S.lab('Σ = 1', [G.X(n - 1) + 1.1, G.Y(q), 0], { size: 0.32, c: 'acc' });
        legend = [{ c: 'acc', t: 'Attention of one query' }];
      } else if (kind === 'causal') {
        const n = 7, cs = 0.85;
        G = grid(n, n, cs, (i, j) => j <= i ? { h: 0.2 + 0.5 * Math.abs(Math.sin(i * 3.1 + j * 1.7)), style: ctx(0.55) } : { flat: true, style: { fill: 0.45, fc: 'acc', c: 'acc', o: 0.8, w: 1 } }, { wall: true });
        S.lab('−∞', [G.X(n - 2), G.Y(1), 0.1], { size: 0.42, c: 'acc' });
        words.forEach((t, j) => { S.lab(t, [G.X(j), G.Y(0) + 0.7, 0], { size: 0.28, o: 0.6 }); S.lab(t, [G.X(0) - 0.85, G.Y(j), 0], { size: 0.28, o: 0.6 }); });
        legend = [{ c: 'acc', t: 'Masked future' }, { c: 'ink', t: 'Visible past' }];
      } else if (kind === 'alibi') {
        const n = 7, cs = 0.9, m = 0.42;
        S.add(K.rect(0, 0, 0, n * cs, n * cs, 'xz', { o: 0.35, w: 1 }));
        const Xr = (j) => ((n - 1) / 2 - j) * cs, Zr = (i) => (i - (n - 1) / 2) * cs;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (j > i) S.add(K.rect(Xr(j), 0.005, Zr(i), cs * 0.82, cs * 0.82, 'xz', { o: 0.14, w: 1 }));
          else if (i === j) S.add(K.rect(Xr(j), 0.005, Zr(i), cs * 0.82, cs * 0.82, 'xz', { c: 'acc', o: 0.9, w: 1.4 }));
          else { const h = m * (i - j); S.add(K.box(Xr(j), -h / 2, Zr(i), cs * 0.82, h, cs * 0.82, { fill: 0.5, fc: 'acc', c: 'acc' })); }
        }
        S.lab('−m·|i−j|', [Xr(0) + 1.4, -m * (n - 1), Zr(n - 1)], { size: 0.36, c: 'acc', mono: true });
        S.lab('0', [Xr(0), 0.35, Zr(0)], { size: 0.32, c: 'acc' });
        S.lab('Q', [Xr(0) + 0.9, 0.1, Zr(n - 1) + 0.6], { size: 0.38, weight: 600, o: 0.7 });
        S.lab('K', [Xr(n - 1), 0.1, Zr(0) - 0.85], { size: 0.38, weight: 600, o: 0.7 });
        legend = [{ c: 'acc', t: 'Distance penalty' }];
      } else if (kind === 'window') {
        const N = 10, w = 3, cs = 0.62;
        G = grid(N, N, cs, (i, j) => (j <= i && i - j < w) ? { h: 0.45, style: A } : j <= i ? { flat: true, style: { o: 0.3, w: 1 } } : { flat: true, style: { o: 0.1, w: 1 } }, { wall: true });
        S.lab('w = 3', [G.X(N - 1) - 0.3, G.Y(N - 1) + 1.8, 0.4], { size: 0.38, c: 'acc' });
        labQK(G, N, cs);
        legend = [{ c: 'acc', t: 'Attended window' }, { c: 'ink', t: 'Skipped positions' }];
      } else {
        const N = 12, st = 4, cs = 0.52;
        G = grid(N, N, cs, (i, j) => {
          if (j > i) return { flat: true, style: { o: 0.08, w: 1 } };
          const loc = i - j < 2, strd = (j % st) === st - 1;
          return loc ? { h: 0.45, style: A } : strd ? { h: 0.3, style: B } : { flat: true, style: { o: 0.22, w: 1 } };
        }, { wall: true });
        labQK(G, N, cs);
        legend = [{ c: 'acc', t: 'Local attention' }, { c: 'b', t: 'Strided attention' }];
      }
    }

    else if (kind === 'kv') {
      const d = 6, t = 6, cs = 0.5;
      const Yr = (i) => 1.6 - i * cs * 1.1;
      const blk = (ox, nm) => {
        for (let i = 0; i <= t; i++) for (let j = 0; j < d; j++) {
          const isNew = i === t, x = ox + (j - (d - 1) / 2) * cs, h = isNew ? 0.5 : 0.12;
          S.add(K.box(x, Yr(i), h / 2, cs * 0.82, cs * 0.82, h, isNew ? A : ctx(0.4)));
        }
        S.add(K.rect(ox, (Yr(0) + Yr(t - 1)) / 2, 0, d * cs + 0.2, (t - 1) * cs * 1.1 + cs + 0.15, 'xy', { o: 0.5, w: 1.2, dash: true }));
        S.lab(nm, [ox, Yr(0) + 0.65, 0], { size: 0.42, weight: 600 });
      };
      blk(-1.8, 'K'); blk(1.8, 'V');
      // query of the new token, to the left, pointing at its own row
      const qx = -5.2;
      for (let j = 0; j < d; j++) S.add(K.box(qx + (j - (d - 1) / 2) * cs * 0.6, Yr(t), 0.25, cs * 0.5, cs * 0.82, 0.5, A));
      S.lab('q', [qx, Yr(t) - 0.6, 0], { size: 0.4, c: 'acc', weight: 600 });
      S.lab('t', [4.0, Yr(t), 0], { size: 0.38, c: 'acc' });
      S.lab('1…t−1', [4.3, (Yr(0) + Yr(t - 1)) / 2, 0], { size: 0.3, mono: true, o: 0.55 });
      legend = [{ c: 'acc', t: 'New token computed' }, { c: 'ink', t: 'Cached and reused' }];
    }

    else if (kind === 'flash') {
      const n = 16, tb = 4, cs = 0.4, ai = 2, aj = 1, span = n * cs, x0 = -span / 2, z0 = -span / 2;
      const T = tb * cs;
      for (let bi = 0; bi < n / tb; bi++) for (let bj = 0; bj < n / tb; bj++) {
        const cx = x0 + (bj + 0.5) * T, cz = z0 + (bi + 0.5) * T;
        const done = bi < ai || (bi === ai && bj < aj);
        S.add(K.rect(cx, 0.005, cz, T - 0.12, T - 0.12, 'xz', done ? { fill: 0.1, o: 0.45, w: 1 } : { o: 0.25, w: 1 }));
      }
      const G = grid(tb, tb, cs, (i, j) => ({ h: 0.25 + ((i * 3 + j * 5) % 7) / 12, style: A }), { x: x0 + (aj + 0.5) * T, z: z0 + (ai + 0.5) * T });
      const cx = x0 + (aj + 0.5) * T, cz = z0 + (ai + 0.5) * T, hs = T / 2 + 0.1;
      S.add(K.box(cx, 2.4, cz, T + 0.3, 0.7, T + 0.3, { fill: 0.06, fc: 'acc', c: 'acc' }));
      S.sg([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [[cx + a * hs, 0.9, cz + b * hs], [cx + a * (hs + 0.05), 2.05, cz + b * (hs + 0.05)]]), { c: 'acc', o: 0.45, w: 1 });
      S.lab('SRAM', [cx, 3.1, cz], { size: 0.36, c: 'acc', weight: 600 });
      S.lab('HBM', [-x0 + 0.9, 0.1, -z0 - 0.4], { size: 0.32, o: 0.55 });
      S.lab('Q', [x0 - 0.6, 0.1, -z0 - 1.0], { size: 0.36, weight: 600, o: 0.75 });
      S.lab('K', [-x0 - 1.0, 0.1, z0 - 0.6], { size: 0.36, weight: 600, o: 0.75 });
      legend = [{ c: 'acc', t: 'Active tile in SRAM' }, { c: 'ink', t: 'Processed tiles' }];
    }

    else if (kind === 'bits') {
      const fmts = [['FP32', 8, 23], ['FP16', 5, 10], ['BF16', 8, 7]], cw = 0.27, x0 = -4.0;
      fmts.forEach(([nm, e, m], k) => {
        const z = -2.2 + k * 2.2, tot = 1 + e + m;
        for (let b = 0; b < tot; b++) {
          const x = x0 + b * cw + cw / 2, kb = b === 0 ? 's' : b <= e ? 'e' : 'm';
          const h = kb === 'm' ? 0.25 : 0.55;
          S.add(K.box(x, h / 2, z, cw * 0.82, h, 0.7, kb === 'e' ? A : kb === 's' ? { fill: 0.7 } : ctx(0.45)));
        }
        S.lab(nm, [x0 - 1.0, 0.2, z + 0.1], { size: 0.36, weight: 600 });
        S.lab(String(e), [x0 + (1 + e / 2) * cw, 0.95, z], { size: 0.32, c: 'acc' });
        S.lab(String(m), [x0 + (1 + e + m / 2) * cw, 0.65, z], { size: 0.3, o: 0.55 });
      });
      legend = [{ c: 'acc', t: 'Exponent bits (range)' }, { c: 'ink', t: 'Sign and mantissa' }];
    }

    else if (kind === 'paged') {
      const pg = 4, cs = 0.36, pw = pg * cs + 0.3, ph = 0.7, nP = 6, nRow = 3;
      const phys = (i, j) => [-(nP * pw) / 2 + (j + 0.5) * pw, -2.0 + i * 1.0];
      const seq = [[1, 4], [0, 1], [2, 2], [1, 0]], len = 14;
      const others = ['0,0', '0,3', '1,2', '2,4', '2,0', '0,5'];
      const page = (cx, cz, n, st, edgeO) => {
        S.add(K.rect(cx, 0.005, cz, pw - 0.1, ph, 'xz', { o: edgeO, w: 1 }));
        for (let s2 = 0; s2 < pg; s2++) {
          const x = cx - pw / 2 + 0.15 + (s2 + 0.5) * cs;
          if (s2 < n) S.add(K.box(x, 0.11, cz, cs * 0.76, 0.22, ph * 0.66, st));
        }
      };
      for (let i = 0; i < nRow; i++) for (let j = 0; j < nP; j++) {
        const [x, z] = phys(i, j);
        const mine = seq.findIndex((q) => q[0] === i && q[1] === j);
        if (mine >= 0) page(x, z, Math.min(pg, len - mine * pg), A, 0.5);
        else if (others.includes(i + ',' + j)) page(x, z, 2 + ((i + j) % 3), ctx(0.35), 0.3);
        else page(x, z, 0, null, 0.18);
      }
      seq.forEach(([i, j], k) => {
        const lx = -(4 * pw) / 2 + (k + 0.5) * pw, lz = 2.4;
        page(lx, lz, Math.min(pg, len - k * pg), A, 0.5);
        S.lab(String(k), [lx, 0.1, lz + 0.7], { size: 0.3, mono: true, c: 'acc' });
        const [px, pz] = phys(i, j);
        S.add(K.arc([lx, 0.25, lz - 0.35], [px, 0.25, pz + 0.35], 0.9, { c: 'acc', o: 0.55, w: 1.2 }));
      });
      legend = [{ c: 'acc', t: 'One sequence’s pages' }, { c: 'ink', t: 'Other sequences' }];
    }

    else if (kind === 'batching') {
      const T = 16, cw = 0.55, x0 = -4.4;
      const lanes = [[5, 7, 4], [9, 6], [3, 4, 5, 4], [7, 3, 6]];
      lanes.forEach((L, s) => {
        const z = -1.95 + s * 1.3; let t = 0;
        S.ln([[x0, 0, z], [x0 + T * cw, 0, z]], { o: 0.25, w: 1 });
        L.forEach((len, k) => {
          len = Math.min(len, T - t); if (len <= 0) return;
          const x = x0 + (t + len / 2) * cw, joined = k > 0;
          S.add(K.box(x, 0.15, z, len * cw - 0.12, 0.3, 0.7, joined ? A : ctx(0.65)));
          t += len;
        });
        S.lab('GPU' + (s + 1), [x0 - 0.75, 0.15, z], { size: 0.28, mono: true, o: 0.5 });
      });
      S.add(K.arrow([x0, 0.01, 3.0], [x0 + T * cw + 0.3, 0.01, 3.0], { o: 0.5, w: 1.2 }));
      S.lab('t', [x0 + T * cw + 0.7, 0.05, 3.0], { size: 0.34, o: 0.6 });
      legend = [{ c: 'acc', t: 'Requests joining mid-batch' }, { c: 'ink', t: 'Initial requests' }];
    }

    if (['paged', 'batching'].includes(kind)) {
      const piv = new S.T.Group(); while (g.children.length) piv.add(g.children[0]);
      piv.rotation.x = Math.PI / 2; g.add(piv);
    }

    return { g, legend, ctl, tick };
  };


  /* =========================================================== SERIES */
  VIZ.series = function (p, K) {
    const S = mk(K), { g } = S, kind = p.kind || 'lag';
    let legend = [], ctl, tick;
    const W = 9, x0 = -4.5;
    const X = (i, n) => x0 + W * i / (n - 1);
    const r = K.rng(42);
    const gen = (n, f) => range(n).map((i) => f(i));
    const base = gen(60, (i) => 1.6 + 0.7 * Math.sin(i * 0.42) + 0.3 * Math.sin(i * 0.13 + 1) + 0.18 * r.n());
    /* draw series at depth z with baseline y0; vertical scale sc */
    const plot = (ys, z, o = {}) => {
      const n = o.n || ys.length, off = o.off || 0, sc = o.sc || 1, y0 = o.y0 || 0;
      const pts = ys.map((v, i) => [X(i + off, n), y0 + v * sc, z]);
      S.ln(pts, { c: o.c, o: o.o, w: o.w == null ? 1.8 : o.w, dash: o.dash });
      return pts;
    };
    const axis = (z, y0 = 0, o = 0.35, xa = x0, xb = x0 + W) => S.ln([[xa, y0, z], [xb, y0, z]], { o, w: 1 });

    if (kind === 'lag') {
      const ys = base.slice(0, 40), n = 40, t = 30;
      [0, 1, 2, 3].forEach((k) => {
        const z = k * 1.4 - 2.1;
        axis(z);
        const seg = ys.slice(0, n - k);
        plot(seg, z, { n, off: k, c: k === 0 ? 'ink' : 'acc', o: k === 0 ? 1 : 0.85 - k * 0.12, w: k === 0 ? 2 : 1.6 });
        S.lab(k === 0 ? 'yₜ' : 'yₜ₋' + '₀₁₂₃'[k], [x0 - 0.7, 0.4, z], { size: 0.34, c: k === 0 ? 'ink' : 'acc' });
      });
      // the row at time t: one value per lag copy
      const pts = [0, 1, 2, 3].map((k) => [X(t, n), ys[t - k], k * 1.4 - 2.1]);
      S.ln(pts, { w: 1.2, o: 0.5, dash: true });
      S.add(K.dots(pts.slice(1), { r: 0.1, c: 'acc' })); S.add(K.dots([pts[0]], { r: 0.1 }));
      S.ln([[X(t, n), 0, -2.1], [X(t, n), 0, 2.1]], { o: 0.3, w: 1 });
      S.lab('t', [X(t, n), -0.35, -2.1], { size: 0.32, o: 0.6 });
      legend = [{ c: 'acc', t: 'Lagged copies' }, { c: 'ink', t: 'Original series' }];
    }

    else if (kind === 'rolling') {
      const ys = base.slice(0, 50), n = 50, w = 7;
      const rm = ys.map((v, i) => { const a = ys.slice(Math.max(0, i - w + 1), i + 1); return a.reduce((s, x) => s + x, 0) / a.length; });
      axis(-0.8); axis(0.8);
      const raw = plot(ys, -0.8, { o: 0.55, w: 1.2 });
      S.add(K.dots(raw, { r: 0.04, o: 0.5 }));
      plot(rm.slice(w - 1), 0.8, { n, off: w - 1, c: 'acc', w: 2.4 });
      // window bracket
      const i1 = 34, i0 = i1 - w + 1, top = Math.max(...ys.slice(i0, i1 + 1)) + 0.3;
      S.add(K.rect((X(i0, n) + X(i1, n)) / 2, top / 2, -0.8, X(i1, n) - X(i0, n) + 0.2, top, 'xy', { fill: 0.07, fc: 'acc', c: 'acc', o: 0.7, w: 1.2 }));
      S.ln([[X(i1, n), rm[i1], -0.8], [X(i1, n), rm[i1], 0.8]], { c: 'acc', w: 1.2, dash: true });
      S.add(K.dots([[X(i1, n), rm[i1], 0.8]], { r: 0.1, c: 'acc' }));
      S.lab('w', [(X(i0, n) + X(i1, n)) / 2, top + 0.35, -0.8], { size: 0.36, c: 'acc' });
      legend = [{ c: 'acc', t: 'Rolling mean' }, { c: 'ink', t: 'Raw series' }];
    }

    else if (kind === 'station') {
      const n = 50, ys = gen(n, (i) => 0.3 + i * 0.06 + 0.25 * Math.sin(i * 0.5) + 0.15 * r.n());
      const d = ys.slice(1).map((v, i) => v - ys[i]);
      axis(-1.2); plot(ys, -1.2, { w: 1.8 });
      const fit = [[x0, 0.3, -1.2], [x0 + W, 0.3 + 0.06 * (n - 1), -1.2]]; S.ln(fit, { o: 0.4, w: 1, dash: true });
      const yb = 1.4;
      axis(1.2, yb);
      plot(d, 1.2, { n, off: 1, y0: yb, sc: 1.5, c: 'acc', w: 1.8 });
      S.add(K.rect(0, yb, 1.2, W, 1.2, 'xy', { fill: 0.06, fc: 'acc', edge: false }));
      S.ln([[x0, yb + 0.6, 1.2], [x0 + W, yb + 0.6, 1.2]], { c: 'acc', o: 0.4, w: 1, dash: true });
      S.ln([[x0, yb - 0.6, 1.2], [x0 + W, yb - 0.6, 1.2]], { c: 'acc', o: 0.4, w: 1, dash: true });
      S.lab('yₜ', [x0 - 0.6, 0.6, -1.2], { size: 0.36 });
      S.lab('Δyₜ', [x0 - 0.7, yb, 1.2], { size: 0.36, c: 'acc' });
      legend = [{ c: 'ink', t: 'Non-stationary series' }, { c: 'acc', t: 'Differenced series' }];
    }

    else if (kind === 'acf') {
      const L = 16, vals = range(L + 1).map((k) => k === 0 ? 1 : 0.85 * Math.cos(k * 2 * Math.PI / 6) * Math.exp(-k * 0.09));
      const bw = 0.32, Xl = (k) => -4 + k * 0.5, sc = 2.2;
      S.ln([[-4.3, 0, 0], [4.4, 0, 0]], { o: 0.5, w: 1 });
      const band = 0.28;
      S.add(K.rect(0.05, 0, 0, 8.6, band * 2 * sc, 'xy', { fill: 0.07, o: 0.0, edge: false }));
      S.ln([[-4.3, band * sc, 0], [4.4, band * sc, 0]], { w: 1, o: 0.5, dash: true });
      S.ln([[-4.3, -band * sc, 0], [4.4, -band * sc, 0]], { w: 1, o: 0.5, dash: true });
      vals.forEach((v, k) => {
        const sig = Math.abs(v) > band && k > 0;
        S.add(K.box(Xl(k), v * sc / 2, 0, bw * 0.6, Math.abs(v * sc) || 0.02, bw, sig ? { fill: 0.65, fc: 'acc', c: 'acc' } : { fill: 0.08, o: 0.45 }));
      });
      // PACF row behind
      const pac = range(L + 1).map((k) => k === 0 ? 1 : k === 1 ? 0.75 : k === 2 ? -0.45 : 0.12 * Math.sin(k * 1.7));
      const zb = -1.6;
      S.ln([[-4.3, 0, zb], [4.4, 0, zb]], { o: 0.3, w: 1 });
      pac.forEach((v, k) => S.add(K.box(Xl(k), v * sc / 2, zb, bw * 0.6, Math.abs(v * sc) || 0.02, bw, { fill: 0.05, o: 0.3 })));
      S.lab('ACF', [-5.1, 0.4, 0], { size: 0.34, weight: 600 });
      S.lab('PACF', [-5.2, 0.4, zb], { size: 0.32, o: 0.55 });
      S.lab('k', [4.8, -0.3, 0], { size: 0.34, o: 0.6 });
      S.lab('±1.96/√n', [5.2, band * sc + 0.3, 0], { size: 0.28, mono: true, o: 0.6 });
      legend = [{ c: 'acc', t: 'Significant lags' }, { c: 'ink', t: 'Confidence band' }];
    }

    else if (kind === 'decomp') {
      const n = 60, tr = gen(n, (i) => 0.2 + i * 0.022), se = gen(n, (i) => 0.4 * Math.sin(i * 2 * Math.PI / 12)), re = gen(n, () => 0.1 * r.n());
      const ob = tr.map((v, i) => v + se[i] + re[i]);
      const rows = [
        { ys: ob, t: 'y', o: { w: 1.8 } }, { ys: tr, t: 'T', o: { c: 'acc', w: 2.6 } },
        { ys: se.map((v) => v + 0.45), t: 'S', o: { w: 1.4, o: 0.6 } }, { ys: re.map((v) => v * 1.5 + 0.3), t: 'R', o: { w: 1, o: 0.45 } },
      ];
      rows.forEach((row, k) => {
        const z = -1.5 + k * 1.0, y0 = (3 - k) * 1.45;
        axis(z, y0, 0.25);
        plot(row.ys, z, Object.assign({ y0 }, row.o));
        S.lab(row.t, [x0 - 0.6, y0 + 0.4, z], { size: 0.4, weight: 600, c: k === 1 ? 'acc' : 'ink', o: k === 1 ? 1 : 0.7 });
      });
      legend = [{ c: 'acc', t: 'Trend' }, { c: 'ink', t: 'Seasonal and residual' }];
    }

    else if (kind === 'arima') {
      const n = 46, h = 10, N = n + h;
      const ys = gen(n, (i) => 0.2 + i * 0.045 + 0.3 * Math.sin(i * 0.55) + 0.08 * r.n());
      const d = ys.slice(1).map((v, i) => v - ys[i]);
      const md = d.reduce((a, b) => a + b, 0) / d.length;
      const fd = []; let a = d[d.length - 1], b = d[d.length - 2];
      for (let k = 0; k < h; k++) { const nx = md + 0.6 * (a - md) - 0.25 * (b - md); fd.push(nx); b = a; a = nx; }
      const fy = []; let last = ys[n - 1]; fd.forEach((v) => { last += v; fy.push(last); });
      const zf = 1.0, zb = -1.0, yb = 4.0, ds = 2.2;
      axis(zf, 0, 0.35); plot(ys, zf, { n: N, w: 1.8 });
      plot([ys[n - 1]].concat(fy), zf, { n: N, off: n - 1, c: 'acc', w: 2.4 });
      axis(zb, yb, 0.35);
      plot(d, zb, { n: N, off: 1, y0: yb, sc: ds, w: 1.2, o: 0.55 });
      plot([d[d.length - 1]].concat(fd), zb, { n: N, off: n - 1, y0: yb, sc: ds, c: 'acc', w: 2 });
      S.ln([[X(n - 1, N), 0, zf], [X(n - 1, N), 3.0, zf]], { o: 0.3, w: 1, dash: true });
      S.ln([[X(n - 1, N), yb - 0.8, zb], [X(n - 1, N), yb + 0.8, zb]], { o: 0.3, w: 1, dash: true });
      S.add(K.arrow([X(N - 3, N), yb - 0.5, zb], [X(N - 3, N), fy[h - 3] + 0.45, zf], { c: 'acc', w: 1.2, o: 0.7 }));
      S.add(K.arrow([X(8, N), 1.9, zf], [X(8, N), yb - 0.6, zb], { w: 1.2, o: 0.4 }));
      S.lab('Δ', [X(8, N) - 0.4, 2.9, 0], { size: 0.36, o: 0.6 });
      S.lab('Σ', [X(N - 3, N) + 0.45, (yb + fy[h - 3]) / 2, 0], { size: 0.36, c: 'acc' });
      S.lab('Δy', [x0 - 0.6, yb, zb], { size: 0.36, o: 0.7 }); S.lab('y', [x0 - 0.5, 0.6, zf], { size: 0.36 });
      S.lab('AR(p)', [X(n + 4, N), yb + 1.0, zb], { size: 0.32, c: 'acc', mono: true });
      legend = [{ c: 'acc', t: 'Forecast' }, { c: 'ink', t: 'History' }];
    }

    else if (kind === 'seasonal') {
      const P = 12, Y = 5, n = P * Y;
      const cyc = (m) => 0.55 * Math.sin((m / P) * 2 * Math.PI) + 0.2 * Math.sin((m / P) * 4 * Math.PI + 0.6);
      const ys = gen(n, (i) => 0.9 + i * 0.012 + cyc(i % P) + (i < n - P ? 0.06 * r.n() : 0));
      const zf = 1.2;
      axis(zf, 0, 0.35);
      plot(ys.slice(0, n - P + 1), zf, { n, w: 1.8 });
      plot(ys.slice(n - P), zf, { n, off: n - P, c: 'acc', w: 2.4 });
      const pk = 2;
      for (let y = 0; y < Y - 1; y++) {
        const a = y * P + pk, b2 = a + P, isF = y === Y - 2;
        S.add(K.arc([X(a, n), ys[a] + 0.1, zf], [X(b2, n), ys[b2] + 0.1, zf], 0.8, { c: isF ? 'acc' : 'ink', o: isF ? 0.9 : 0.35, w: 1.2, dash: true }));
      }
      S.add(K.dots(range(Y).map((y) => [X(y * P + pk, n), ys[y * P + pk], zf]), { r: 0.07, c: 'acc' }));
      S.lab('s = 12', [(X(pk, n) + X(pk + P, n)) / 2, ys[pk] + 1.05, zf], { size: 0.3, mono: true, o: 0.6 });
      S.lab('yₜ₋ₛ → yₜ', [X(n - 6, n), 2.9, zf], { size: 0.3, c: 'acc', mono: true });
      legend = [{ c: 'acc', t: 'Seasonal forecast' }, { c: 'ink', t: 'Past seasons' }];
    }

    else if (kind === 'prophet') {
      const n = 70, tr = gen(n, (i) => 0.2 + i * 0.015 + (i > 40 ? (i - 40) * 0.02 : 0));
      const se = gen(n, (i) => 0.3 * Math.sin(i * 2 * Math.PI / 14));
      const hol = gen(n, (i) => ([18, 46].includes(i) ? 1.0 : [17, 19, 45, 47].includes(i) ? 0.3 : 0));
      const y = tr.map((v, i) => v + se[i] + hol[i] + 0.05 * r.n());
      const rows = [
        { ys: y, t: 'y', o: { w: 1.8 } },
        { ys: tr, t: 'g(t)', o: { w: 2, o: 0.75 } },
        { ys: se.map((v) => v + 0.35), t: 's(t)', o: { w: 1.4, o: 0.55 } },
        { ys: hol.map((v) => v + 0.05), t: 'h(t)', o: { c: 'acc', w: 2 } },
      ];
      const pos = rows.map((rw, k) => ({ z: -1.5 + k * 1.0, y0: (3 - k) * 1.45 }));
      rows.forEach((rw, k) => { axis(pos[k].z, pos[k].y0, 0.25); plot(rw.ys, pos[k].z, Object.assign({ y0: pos[k].y0 }, rw.o)); S.lab(rw.t, [x0 - 0.8, pos[k].y0 + 0.4, pos[k].z], { size: 0.34, mono: true, c: k === 3 ? 'acc' : 'ink', o: k === 3 ? 1 : 0.7 }); });
      [18, 46].forEach((i) => { S.ln([[X(i, n), pos[3].y0 + hol[i] + 0.05, pos[3].z], [X(i, n), pos[0].y0 + y[i], pos[0].z]], { c: 'acc', w: 1, o: 0.5, dash: true }); S.add(K.dots([[X(i, n), pos[0].y0 + y[i], pos[0].z]], { r: 0.08, c: 'acc' })); });
      S.ln([[X(40, n), pos[1].y0, pos[1].z], [X(40, n), pos[1].y0 + tr[40] + 0.6, pos[1].z]], { o: 0.4, w: 1, dash: true });
      legend = [{ c: 'acc', t: 'Holiday effects' }, { c: 'ink', t: 'Trend and seasonality' }];
    }

    else if (kind === 'holt') {
      const alpha = p.alpha == null ? 0.3 : +p.alpha;
      const n = 50, ys = gen(n, (i) => 0.6 + i * 0.03 + 0.35 * r.n());
      let l = ys[0], b = 0.02; const L = [], B = [];
      ys.forEach((v) => { const pl = l; l = alpha * v + (1 - alpha) * (l + b); b = 0.2 * (l - pl) + 0.8 * b; L.push(l); B.push(b); });
      const h = 10, N = n + h, f = range(h + 1).map((k) => L[n - 1] + k * B[n - 1]);
      axis(0, 0, 0.35, x0, x0 + W);
      const raw = plot(ys, 0, { n: N, w: 1, o: 0.4 }); S.add(K.dots(raw, { r: 0.045, o: 0.6 }));
      plot(L, 0, { n: N, c: 'acc', w: 2.4 });
      plot(f, 0, { n: N, off: n - 1, c: 'acc', w: 2, dash: true });
      // weights decaying into the past (depth row)
      const zw = 0, yw = -2.2;
      S.ln([[X(n - 20, N), yw, zw], [X(n - 1, N), yw, zw]], { o: 0.3, w: 1 });
      for (let k = 0; k < 20; k++) { const wv = alpha * Math.pow(1 - alpha, k); S.add(K.box(X(n - 1 - k, N), yw + wv * 3 / 2, zw, 0.09, wv * 3 || 0.01, 0.12, { fill: 0.5, fc: 'acc', c: 'acc', o: 0.8 })); }
      S.lab('α(1−α)ᵏ', [X(n - 22, N) - 0.6, yw + 0.3, zw], { size: 0.3, c: 'acc', mono: true });
      S.lab('ℓₜ + h·bₜ', [X(N - 3, N), f[h] + 0.5, 0], { size: 0.3, c: 'acc', mono: true });
      legend = [{ c: 'acc', t: 'Smoothed level and trend' }, { c: 'ink', t: 'Observations' }];
      ctl = [{ key: 'alpha', label: 'α', min: 0.05, max: 0.95, step: 0.05, value: 0.3 }];
    }

    else if (kind === 'forecast') {
      const n = 40, h = 16, N = n + h;
      const ys = gen(n, (i) => 1.4 + 0.5 * Math.sin(i * 0.35) + i * 0.015 + 0.1 * r.n());
      const f = range(h + 1).map((k) => ys[n - 1] + 0.5 * (Math.sin((n - 1 + k) * 0.35) - Math.sin((n - 1) * 0.35)) + k * 0.015);
      const sd = range(h + 1).map((k) => 0.09 * Math.sqrt(k) * 1.6);
      axis(0, 0, 0.35);
      plot(ys, 0, { n: N, w: 1.8 });
      plot(f, 0, { n: N, off: n - 1, c: 'acc', w: 2.4 });
      const up = f.map((v, k) => [X(n - 1 + k, N), v + 2 * sd[k]]), lo = f.map((v, k) => [X(n - 1 + k, N), v - 2 * sd[k]]);
      S.area(up.concat(lo.slice().reverse()), 0, { c: 'acc', fill: 0.14 });
      S.ln(up.map((q) => [q[0], q[1], 0]), { c: 'acc', w: 1, o: 0.5 }); S.ln(lo.map((q) => [q[0], q[1], 0]), { c: 'acc', w: 1, o: 0.5 });
      // interval width as cross-sections in depth (cone)
      [4, 8, 12, 16].forEach((k) => { const x = X(n - 1 + k, N); S.ln([[x, f[k] - 2 * sd[k], -2 * sd[k] * 1.2], [x, f[k] + 2 * sd[k], 2 * sd[k] * 1.2]], { c: 'acc', o: 0.0, w: 1 });
        const ring = range(25).map((q) => { const a = q / 24 * Math.PI * 2; return [x, f[k] + 2 * sd[k] * Math.cos(a), 2 * sd[k] * Math.sin(a)]; }); S.ln(ring, { c: 'acc', w: 1, o: 0.55 });
        S.lab('h=' + k, [x, f[k] - 2 * sd[k] - 0.35, 0], { size: 0.26, mono: true, c: 'acc', o: 0.8 }); });
      S.ln([[X(n - 1, N), 0, 0], [X(n - 1, N), 3, 0]], { o: 0.3, w: 1, dash: true });
      S.lab('t', [X(n - 1, N), -0.35, 0], { size: 0.32, o: 0.6 });
      legend = [{ c: 'acc', t: 'Forecast interval' }, { c: 'ink', t: 'History' }];
    }

    else if (kind === 'tabular') {
      const n = 30, ys = base.slice(0, n), sx = 0.3, xs0 = -4.4;
      const yS = (v) => v * 0.9 + 3.2, zS = -1.5;
      S.ln(ys.map((v, i) => [xs0 + i * sx, yS(v), zS]), { w: 1.8 });
      S.ln([[xs0, 3.0, zS], [xs0 + (n - 1) * sx, 3.0, zS]], { o: 0.3, w: 1 });
      const rowsT = [22, 23, 24, 25, 26], cols = ['yₜ₋₁', 'yₜ₋₂', 'yₜ₋₃', 'ȳ₇', 'yₜ'], cw = 1.05, zT = 1.2;
      const Xc = (j) => -2.4 + j * cw + (j === 4 ? 0.6 : 0), Yr = (k) => 2.0 - k * 0.55;
      rowsT.forEach((t, k) => {
        const vals = [ys[t - 1], ys[t - 2], ys[t - 3], ys.slice(t - 7, t).reduce((a, b) => a + b, 0) / 7, ys[t]];
        vals.forEach((v, j) => S.add(K.box(Xc(j), Yr(k), zT + v * 0.25, cw * 0.8, 0.42, v * 0.5, j === 4 ? { fill: 0.65, fc: 'acc', c: 'acc' } : { fill: 0.06, o: k === 2 ? 0.8 : 0.4 })));
      });
      cols.forEach((c, j) => S.lab(c, [Xc(j), Yr(0) + 0.55, zT], { size: 0.3, c: j === 4 ? 'acc' : 'ink', o: j === 4 ? 1 : 0.7 }));
      S.ln([[Xc(3) + cw * 0.5 + 0.05, Yr(0) + 0.35, zT], [Xc(3) + cw * 0.5 + 0.05, Yr(4) - 0.35, zT]], { o: 0.4, w: 1 });
      const t = rowsT[2], k = 2;
      [1, 2, 3].forEach((lag) => S.ln([[xs0 + (t - lag) * sx, yS(ys[t - lag]), zS], [Xc(lag - 1), Yr(k) + 0.21, zT]], { o: 0.22, w: 1 }));
      S.ln([[xs0 + t * sx, yS(ys[t]), zS], [Xc(4), Yr(k) + 0.21, zT]], { c: 'acc', o: 0.7, w: 1.2 });
      S.add(K.dots([[xs0 + t * sx, yS(ys[t]), zS]], { r: 0.09, c: 'acc' }));
      S.add(K.dots([1, 2, 3].map((lag) => [xs0 + (t - lag) * sx, yS(ys[t - lag]), zS]), { r: 0.07 }));
      const tx = 4.6, ty = 0.4, tz = zT;
      S.sg([[[tx, ty + 1.4, tz], [tx - 0.4, ty + 0.8, tz]], [[tx, ty + 1.4, tz], [tx + 0.4, ty + 0.8, tz]], [[tx - 0.4, ty + 0.8, tz], [tx - 0.65, ty + 0.2, tz]], [[tx - 0.4, ty + 0.8, tz], [tx - 0.15, ty + 0.2, tz]]], { o: 0.6, w: 1 });
      S.add(K.dots([[tx, ty + 1.4, tz], [tx - 0.4, ty + 0.8, tz], [tx + 0.4, ty + 0.8, tz], [tx - 0.65, ty + 0.2, tz], [tx - 0.15, ty + 0.2, tz]], { r: 0.07 }));
      S.lab('GBM', [tx, ty + 1.85, tz], { size: 0.3, weight: 600, o: 0.7 });
      legend = [{ c: 'acc', t: 'Target' }, { c: 'ink', t: 'Lag features' }];
    }

    else if (kind === 'patch') {
      const n = 48, ys = base.slice(0, n), P = 8, np = n / P, sx = 0.19, xs0 = -4.5;
      S.ln(ys.map((v, i) => [xs0 + i * sx, v * 0.8, -1.4]), { w: 1.6 });
      S.ln([[xs0, 0, -1.4], [xs0 + (n - 1) * sx, 0, -1.4]], { o: 0.3, w: 1 });
      for (let k = 1; k < np; k++) S.ln([[xs0 + (k * P - 0.5) * sx, -0.1, -1.4], [xs0 + (k * P - 0.5) * sx, 2.6, -1.4]], { o: 0.35, w: 1, dash: true });
      for (let k = 0; k < np; k++) {
        const cx = -3.9 + k * 1.56, z = 1.0, yc = 4.0, seg = ys.slice(k * P, (k + 1) * P);
        S.add(K.box(cx, yc, z, 1.3, 1.5, 0.4, { fill: 0.06, fc: 'acc', c: 'acc', o: 0.85 }));
        S.ln(seg.map((v, i) => [cx - 0.55 + i * 0.157, yc - 0.75 + v * 0.55 + 0.1, z + 0.21]), { c: 'acc', w: 1.6 });
        S.add(K.arrow([xs0 + (k * P + 3.5) * sx, 2.4, -1.4], [cx, yc - 0.85, z - 0.2], { o: 0.3, w: 1 }));
        S.add(K.box(cx, yc + 1.35, z, 0.9, 0.26, 0.26, { fill: 0.65, fc: 'acc', c: 'acc' }));
        S.ln([[cx, yc + 0.8, z], [cx, yc + 1.2, z]], { c: 'acc', w: 1, o: 0.6 });
      }
      S.lab('P = 8', [xs0 - 0.8, 0.8, -1.4], { size: 0.32, mono: true, o: 0.65 });
      legend = [{ c: 'acc', t: 'Patch tokens' }, { c: 'ink', t: 'Raw series' }];
    }

    else if (kind === 'tokens') {
      const n = 32, ys = base.slice(4, 4 + n);
      const mu = ys.reduce((a, b) => a + b, 0) / n, sc = ys.reduce((a, b) => a + Math.abs(b), 0) / n;
      const sv = ys.map((v) => (v - mu) / sc * 1.4);
      const bins = 8, lo = -2.2, hi = 2.2, bh = (hi - lo) / bins;
      const q = sv.map((v) => Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / bh))));
      const Xi = (i) => -4.5 + i * 0.29;
      // raw (back)
      S.ln(ys.map((v, i) => [Xi(i), v * 1.0 + 3.6, -2.0]), { w: 1.6 });
      S.ln([[Xi(0), 3.4, -2.0], [Xi(n - 1), 3.4, -2.0]], { o: 0.3, w: 1 });
      // scaled + quantized (front): horizontal bin lines and quantized steps
      const yb = (b) => 0.3 + (b + 0.5) * 0.45;
      S.sg(range(bins + 1).map((b) => [[Xi(0) - 0.2, 0.3 + b * 0.45, 0.6], [Xi(n - 1) + 0.2, 0.3 + b * 0.45, 0.6]]), { o: 0.12 });
      S.ln(sv.map((v, i) => [Xi(i), 0.3 + (v - lo) / bh * 0.45, 0.6]), { w: 1, o: 0.4 });
      q.forEach((b, i) => S.add(K.box(Xi(i), yb(b), 0.6, 0.24, 0.4, 0.3, { fill: 0.6, fc: 'acc', c: 'acc' })));
      // token ids along front
      [0, 6, 12, 18, 24, 30].forEach((i) => S.lab(String(q[i]), [Xi(i), -0.1, 1.0], { size: 0.28, mono: true, c: 'acc' }));
      S.lab('(x−μ)/s', [Xi(n - 1) + 1.3, 4.0, -0.7], { size: 0.3, mono: true, o: 0.6 });
      S.add(K.arrow([Xi(n - 1) + 0.6, 3.6, -1.8], [Xi(n - 1) + 0.6, 2.6, 0.5], { w: 1.2, o: 0.5 }));
      S.lab('V = ' + bins, [Xi(0) - 0.9, yb(bins - 1), 0.6], { size: 0.28, mono: true, o: 0.6 });
      legend = [{ c: 'acc', t: 'Quantized tokens' }, { c: 'ink', t: 'Raw series' }];
    }

    S.yaw(0.42);
    return { g, legend, ctl, tick };
  };


  /* ---------- tree helpers ---------- */
  /* full binary tree of given depth as nested nodes */
  function fullTree(d, id = '') { return d === 0 ? { id } : { id, ch: [fullTree(d - 1, id + 'L'), fullTree(d - 1, id + 'R')] }; }
  /* layout: x by leaf order, y by depth. returns flat list of nodes with x,y,depth,parent */
  function layout(root, o = {}) {
    const dx = o.dx || 1, dy = o.dy || 1, nodes = [];
    let leafI = 0;
    (function walk(n, depth, par) {
      n.depth = depth; n.par = par; nodes.push(n);
      if (n.ch) { n.ch.forEach((c) => walk(c, depth + 1, n)); n.x = n.ch.reduce((a, c) => a + c.x, 0) / n.ch.length; }
      else { n.x = leafI++ * dx; }
      n.y = -depth * dy;
    })(root, 0, null);
    const cx = (nodes.filter((n) => !n.ch).length - 1) * dx / 2;
    nodes.forEach((n) => { n.x -= cx; });
    return nodes;
  }
  /* draw a small tree glyph (for forests/boosting) at origin offset. returns nodes. */
  function miniTree(S, K, root, at, o = {}) {
    const nodes = layout(root, { dx: o.dx || 0.4, dy: o.dy || 0.55 });
    const [ax, ay, az] = at, edges = [];
    nodes.forEach((n) => { if (n.par) edges.push([[ax + n.par.x, ay + n.par.y, az], [ax + n.x, ay + n.y, az]]); });
    S.sg(edges, { c: o.c, o: o.eo == null ? 0.55 : o.eo, w: 1 });
    const pts = nodes.map((n) => [ax + n.x, ay + n.y, az]);
    S.add(K.dots(pts, { r: o.r || 0.06, c: o.c, o: o.o }));
    return nodes.map((n) => Object.assign(n, { wx: ax + n.x, wy: ay + n.y, wz: az }));
  }

  /* =========================================================== TREE */
  VIZ.tree = function (p, K) {
    const S = mk(K), { g } = S;
    const depth = p.depth || 3;
    let legend = [], ctl, tick;
    const A = { fill: 0.62, fc: 'acc', c: 'acc' };
    const node = (n, st, sz = 0.36) => S.add(K.box(n.x, n.y, n.z || 0, sz, sz * 0.7, sz, st));
    const edge = (a, b, o) => S.ln([[a.x, a.y, a.z || 0], [b.x, b.y, b.z || 0]], o);

    if (p.mode === 'tot') {
      // Tree of Thoughts: root problem → thoughts (scored); best path accent, dead ends faded
      const root = { ch: [] }, r = K.rng(9);
      const mkT = (d, best) => d === 0 ? { best, score: best ? 0.9 : r.range(0.15, 0.6) } : { best, ch: range(3).map((k) => mkT(d - 1, best && k === 1)), score: best ? 0.85 : r.range(0.2, 0.6) };
      const t = { best: true, ch: range(3).map((k) => mkT(depth - 1, k === 1)) };
      // prune: non-best subtrees at depth 2 terminate (dead ends)
      const prune = (n, d) => { if (!n.ch) return; if (!n.best && d >= 1) { n.dead = true; n.ch = null; return; } n.ch.forEach((c) => prune(c, d + 1)); };
      prune(t, 0);
      const nodes = layout(t, { dx: 1.25, dy: 1.6 });
      nodes.forEach((n) => { n.z = n.best ? 0 : (n.x > 0 ? -0.6 : 0.6) * (n.depth ? 1 : 0); });
      nodes.forEach((n) => { if (n.par) edge(n.par, n, n.best ? { c: 'acc', w: 2.4 } : { o: 0.25, w: 1 }); });
      nodes.forEach((n) => {
        const st = n.best ? A : { fill: 0.04, o: n.dead ? 0.3 : 0.5 };
        S.add(K.box(n.x, n.y, n.z, 0.75, 0.42, 0.42, st));
        if (n.depth > 0) S.lab((n.best ? 0.9 : n.score).toFixed(1), [n.x + 0.62, n.y + 0.32, n.z], { size: 0.24, mono: true, c: n.best ? 'acc' : 'ink', o: n.best ? 1 : 0.45 });
        if (n.dead) S.lab('×', [n.x, n.y - 0.5, n.z], { size: 0.34, o: 0.45 });
      });
      S.lab('LLM', [nodes[0].x - 1.2, nodes[0].y, 0], { size: 0.34, weight: 600, o: 0.75 });
      legend = [{ c: 'acc', t: 'Best reasoning path' }, { c: 'ink', t: 'Pruned thoughts' }];
      S.yaw(0.5);
      return { g, legend };
    }

    let t;
    if (p.leafwise) {
      // unbalanced: keep splitting the leaf with max gain
      t = { id: '', ch: [{ id: 'L' }, { id: 'R', ch: [{ id: 'RL', ch: [{ id: 'RLL' }, { id: 'RLR', ch: [{ id: 'RLRL' }, { id: 'RLRR' }] }] }, { id: 'RR' }] }] };
    } else t = fullTree(depth);
    const nodes = layout(t, { dx: p.leafwise ? 1.3 : (depth >= 4 ? 0.62 : 1.15), dy: 1.4 });
    nodes.forEach((n) => (n.z = 0));
    const feats = ['x₁', 'x₂', 'x₃', 'x₄'];

    if (p.symmetric) {
      // oblivious tree: same split at each level; draw a translucent plane per level with the shared condition
      const lvls = range(depth);
      lvls.forEach((d) => {
        const ns = nodes.filter((n) => n.depth === d && n.ch);
        const xa = Math.min(...ns.map((n) => n.x)) - 0.6, xb = Math.max(...ns.map((n) => n.x)) + 0.6;
        S.add(K.rect((xa + xb) / 2, -d * 1.3, 0, xb - xa, 1.2, 'xz', { fill: 0.1, fc: 'acc', c: 'acc', o: 0.5, w: 1 }));
        S.lab(feats[d] + ' < ' + ['3', '0.5', '7'][d], [xb + 1.0, -d * 1.3, 0], { size: 0.32, c: 'acc', mono: true });
      });
      nodes.forEach((n) => { if (n.par) edge(n.par, n, { o: 0.5, w: 1.2 }); });
      nodes.forEach((n) => node(n, n.ch ? A : { fill: 0.1, o: 0.7 }, n.ch ? 0.34 : 0.3));
      // leaf index = binary code
      nodes.filter((n) => !n.ch).forEach((n, i) => S.lab(i.toString(2).padStart(depth, '0'), [n.x, n.y - 0.5, 0], { size: 0.24, mono: true, o: 0.55 }));
      legend = [{ c: 'acc', t: 'Shared split per level' }];
      S.yaw(0.35);
      return { g, legend };
    }

    const leaves = nodes.filter((n) => !n.ch);
    const r = K.rng(3);
    // leaf value bars (depth axis → z) to give the tree a 3D read
    let pruned = new Set();
    if (p.prune) {
      // prune the subtrees under two internal nodes at depth 2
      nodes.filter((n) => n.depth === 2 && n.ch && (n.id === 'LR' || n.id === 'RR')).forEach((n) => {
        n.cut = true; const st = [n]; while (st.length) { const m = st.pop(); if (m !== n) pruned.add(m); (m.ch || []).forEach((c) => st.push(c)); }
      });
    }
    const pathTo = p.paths ? 'RLR'.slice(0, depth) : null;
    const onPath = (n) => pathTo != null && pathTo.startsWith(n.id);
    const newest = p.leafwise ? 'RLR' : null;

    nodes.forEach((n) => {
      if (!n.par) return;
      const prn = pruned.has(n);
      let o = { o: 0.55, w: 1.2 };
      if (prn) o = { o: 0.3, w: 1, dash: true };
      if (onPath(n)) o = { c: 'acc', w: 2.6 };
      if (newest && (n.par.id === newest)) o = { c: 'acc', w: 2.2 };
      edge(n.par, n, o);
    });
    nodes.forEach((n) => {
      const prn = pruned.has(n), leaf = !n.ch || n.cut;
      let st = leaf ? { fill: 0.12, o: 0.8 } : { fill: 0.05, o: 0.8 };
      if (prn) st = { fill: 0.0, o: 0.25 };
      if (n.cut) st = A;
      if (onPath(n)) st = A;
      if (newest && (n.id === newest || n.par && n.par.id === newest)) st = A;
      node(n, st, leaf ? 0.3 : 0.36);
      if (!leaf && !prn && depth <= 3 && !p.paths) S.lab(feats[n.depth % 4], [n.x + 0.5, n.y + 0.25, 0], { size: 0.26, o: 0.55 });
    });
    const plain = !p.paths && !p.prune && !p.leafwise;
    // leaf class mix: two tiny bars under each leaf (depth-offset so orbiting separates them)
    nodes.filter((n) => (!n.ch || n.cut) && !pruned.has(n)).forEach((n) => {
      const v = 0.15 + r() * 0.7, hl = onPath(n) || n.cut;
      S.add(K.box(n.x - 0.08, n.y - 0.35 - v / 2, 0, 0.12, v, 0.12, hl || plain ? A : { fill: 0.35, o: 0.6 }));
      S.add(K.box(n.x + 0.08, n.y - 0.35 - (0.9 - v) / 2, 0, 0.12, 0.9 - v, 0.12, { fill: 0.04, o: 0.35 }));
    });
    if (p.paths) {
      // TreeSHAP waterfall: base value then one step per split on the path
      const pn = nodes.filter((n) => onPath(n) && n.ch), ph = [0.55, -0.3, 0.65, 0.35];
      const bx = Math.max(...nodes.map((n) => n.x)) + 1.4, yB = nodes[nodes.length - 1].y - 0.6, sc = 1.4;
      let acc = 0.6;
      S.ln([[bx - 0.3, yB, 0], [bx + pn.length * 0.45 + 0.6, yB, 0]], { o: 0.45, w: 1 });
      S.add(K.box(bx, yB + acc * sc / 2, 0, 0.32, acc * sc, 0.32, { fill: 0.1, o: 0.6 }));
      S.lab('E[f]', [bx, yB - 0.3, 0], { size: 0.26, mono: true, o: 0.55 });
      pn.forEach((n, i) => {
        const v = ph[i], x = bx + (i + 1) * 0.45, ya = yB + acc * sc;
        S.add(K.box(x, ya + v * sc / 2, 0, 0.32, Math.abs(v * sc), 0.32, A));
        S.ln([[x - 0.45, ya, 0], [x, ya, 0]], { o: 0.4, w: 1, dash: true });
        S.lab('φ' + '₁₂₃₄'[i], [x, yB - 0.3, 0], { size: 0.26, c: 'acc' });
        acc += v;
      });
      S.lab('x', [nodes[0].x, nodes[0].y + 0.6, 0], { size: 0.36, c: 'acc', weight: 600 });
      legend = [{ c: 'acc', t: 'Decision path of one sample' }];
    } else if (p.prune) legend = [{ c: 'acc', t: 'Pruned to a leaf' }, { c: 'ink', t: 'Removed branches' }];
    else if (p.leafwise) legend = [{ c: 'acc', t: 'Newest leaf-wise split' }];
    else legend = [{ c: 'acc', t: 'Leaf predictions' }, { c: 'ink', t: 'Split nodes' }];
    S.yaw(0.45);
    return { g, legend };
  };


  /* =========================================================== PARTITION */
  VIZ.partition = function (p, K) {
    const S = mk(K), { g } = S, mode = p.mode || 'tree';
    let legend = [], ctl, tick;
    const r = K.rng(mode === 'iso' ? 5 : 13), R = 3;
    const A = { fill: 0.1, fc: 'acc', c: 'acc', o: 0.85, w: 1.4 };
    const cube = () => {
      S.add(K.box(0, R, 0, 2 * R, 2 * R, 2 * R, { o: 0.18 }));
    };
    // planes: axis 'x' => yz plane at x=v, limited to a box region [x0,x1]x[y0,y1]x[z0,z1]
    const plane = (ax, v, b, st) => {
      const [x0, x1, y0, y1, z0, z1] = b;
      if (ax === 'x') S.add(K.rect(v, (y0 + y1) / 2, (z0 + z1) / 2, y1 - y0, z1 - z0, 'yz', st));
      else if (ax === 'y') S.add(K.rect((x0 + x1) / 2, v, (z0 + z1) / 2, x1 - x0, z1 - z0, 'xz', st));
      else S.add(K.rect((x0 + x1) / 2, (y0 + y1) / 2, v, x1 - x0, y1 - y0, 'xy', st));
    };
    const full = [-R, R, 0, 2 * R, -R, R];

    if (mode === 'tree' || mode === 'extra') {
      // two classes in 3D: class A clustered in a region, class B elsewhere
      const ptsA = [], ptsB = [];
      for (let i = 0; i < 140; i++) {
        const q = [r.range(-R, R), r.range(0, 2 * R), r.range(-R, R)];
        const inA = (q[0] < 0.6 && q[1] > 2.4) || (q[0] >= 0.6 && q[2] < -0.8);
        (inA ? ptsA : ptsB).push(q);
      }
      cube();
      S.add(K.dots(ptsA, { r: 0.075, c: 'acc' }));
      S.add(K.dots(ptsB, { r: 0.07, c: 'b', hollow: true }));
      if (mode === 'tree') {
        plane('x', 0.6, full, { fill: 0.08, o: 0.8, w: 1.6 });
        plane('y', 2.4, [-R, 0.6, 0, 2 * R, -R, R], { fill: 0.08, o: 0.8, w: 1.6 });
        plane('z', -0.8, [0.6, R, 0, 2 * R, -R, R], { fill: 0.08, o: 0.8, w: 1.6 });
        S.lab('x₁ < 0.6', [0.6, 2 * R + 0.4, -R], { size: 0.3, mono: true, o: 0.75 });
        S.lab('x₂ > 2.4', [-R - 0.2, 2.4, R + 0.4], { size: 0.3, mono: true, o: 0.75 });
        S.lab('x₃ < −0.8', [R + 0.4, 2 * R + 0.2, -0.8], { size: 0.3, mono: true, o: 0.75 });
        legend = [{ c: 'acc', t: 'Class A' }, { c: 'b', t: 'Class B' }, { c: 'ink', t: 'Axis-aligned splits' }];
      } else {
        // several randomized trees' thresholds: ink faint; one tree's random cuts drawn
        const rr = K.rng(77);
        for (let k = 0; k < 3; k++) {
          const ax = ['z', 'x', 'y'][k % 3], v = ax === 'y' ? rr.range(0.6, 5.4) : rr.range(-2.4, 2.4);
          plane(ax, v, full, { o: 0.22, w: 1 });
        }
        plane('x', -0.7, full, { fill: 0.06, o: 0.85, w: 1.6 });
        plane('y', 3.6, [-0.7, R, 0, 2 * R, -R, R], { fill: 0.06, o: 0.85, w: 1.6 });
        S.lab('U(min, max)', [-0.7, 2 * R + 0.4, -R], { size: 0.3, mono: true, o: 0.7 });
        legend = [{ c: 'acc', t: 'Class A' }, { c: 'b', t: 'Class B' }, { c: 'ink', t: 'Random thresholds' }];
      }
    }

    else if (mode === 'hist') {
      const nb = 8, x0 = -4, w = 8, bw = w / nb;
      const vals = range(400).map(() => { const u = r(); return u < 0.6 ? r.n() * 1.1 - 1 : r.n() * 0.8 + 1.8; }).filter((v) => v > x0 && v < x0 + w);
      const cnt = range(nb).fill(0); vals.forEach((v) => { cnt[Math.floor((v - x0) / bw)]++; });
      const mx = Math.max(...cnt);
      // raw continuous values: a strip of dots on the floor in front
      const zr = 1.6;
      S.add(K.dots(vals.slice(0, 220).map((v) => [v, 0.03, zr + r.range(-0.35, 0.35)]), { r: 0.035, o: 0.55 }));
      S.ln([[x0, 0, zr + 0.5], [x0 + w, 0, zr + 0.5]], { o: 0.4, w: 1 });
      // binned counts behind
      cnt.forEach((c, b) => S.add(K.box(x0 + (b + 0.5) * bw, c / mx * 3 / 2, -0.4, bw * 0.84, c / mx * 3 || 0.02, 1.0, { fill: 0.08, o: 0.55 })));
      const best = 5;
      for (let b = 0; b <= nb; b++) {
        const x = x0 + b * bw, inner = b > 0 && b < nb;
        S.ln([[x, 0.005, zr + 0.5], [x, 0.005, -1.0]], inner ? { c: 'acc', w: b === best ? 2.4 : 1.2, o: b === best ? 1 : 0.6 } : { o: 0.3, w: 1 });
      }
      S.add(K.rect(x0 + best * bw, 1.75, -0.4, 1.5, 3.5, 'yz', { fill: 0.12, fc: 'acc', c: 'acc', o: 0.9, w: 1.6 }));
      S.lab('x', [x0 + w + 0.5, 0, zr + 0.5], { size: 0.36, o: 0.6 });
      S.lab('B = 8', [x0 - 0.3, 3.2, -0.4], { size: 0.32, mono: true, o: 0.6 });
      legend = [{ c: 'acc', t: 'Split candidates (bin edges)' }, { c: 'ink', t: 'Binned values' }];
      S.yaw(0.45);
    }

    else if (mode === 'iso') {
      const pts = range(120).map(() => [r.n() * 0.9, 3 + r.n() * 0.9, r.n() * 0.9]).filter((q) => Math.abs(q[0]) < 2.8 && Math.abs(q[2]) < 2.8 && q[1] > 0.3 && q[1] < 5.7);
      const out = [2.3, 5.2, 2.0];
      cube();
      S.add(K.dots(pts, { r: 0.065, o: 0.75 }));
      S.add(K.dots([out], { r: 0.14, c: 'acc' }));
      // 3 random cuts isolate the outlier
      plane('x', 1.6, full, { fill: 0.05, c: 'acc', o: 0.85, w: 1.6 });
      plane('y', 4.4, [1.6, R, 0, 2 * R, -R, R], { fill: 0.08, c: 'acc', o: 0.85, w: 1.6 });
      plane('z', 1.2, [1.6, R, 4.4, 2 * R, -R, R], { fill: 0.12, fc: 'acc', c: 'acc', o: 0.9, w: 1.6 });
      S.lab('1', [1.6, 2 * R + 0.35, -R], { size: 0.32, c: 'acc', mono: true });
      S.lab('2', [R + 0.3, 4.4, -R], { size: 0.32, c: 'acc', mono: true });
      S.lab('3', [R + 0.3, 2 * R + 0.25, 1.2], { size: 0.32, c: 'acc', mono: true });
      // many cuts needed for an inlier: faint planes near centre
      const rr = K.rng(4);
      for (let k = 0; k < 5; k++) plane(['x', 'z', 'y'][k % 3], k % 3 === 2 ? 3 + rr.range(-0.6, 0.6) : rr.range(-0.6, 0.6), full, { o: 0.18, w: 1 });
      legend = [{ c: 'acc', t: 'Outlier isolated quickly' }, { c: 'ink', t: 'Normal points' }];
    }

    return { g, legend, ctl, tick };
  };

  /* =========================================================== FOREST */
  VIZ.forest = function (p, K) {
    const S = mk(K), { g } = S, n = p.n || 7;
    const r = K.rng(19);
    const A = { fill: 0.62, fc: 'acc', c: 'acc' };
    const votes = range(n).map((i) => ([1, 4].includes(i % 6) ? 0 : 1));
    const span = Math.PI * (n > 8 ? 1.0 : 0.85), Rr = n > 8 ? 5.4 : 4.6;
    const fin = [0, 0, 1.2], nf = 6;
    for (let i = 0; i < n; i++) {
      const a = -span / 2 + span * i / (n - 1), x = Rr * Math.sin(a), z = -Rr * Math.cos(a) + 1.2;
      const depth = 2 + (i % 2);
      const piv = new S.T.Group(); piv.position.set(x, 0, z); piv.rotation.y = -a;
      const sub = { g: piv, add: (o) => { piv.add(o); return o; }, sg: (pr, o) => piv.add(K.segs(pr, o)) };
      const nodes = miniTree(sub, K, fullTree(depth), [0, 3.4, 0], { dx: n > 8 ? 0.2 : 0.26, dy: 0.5, eo: 0.55, r: 0.05 });
      const leaves = nodes.filter((q) => !q.ch), L = leaves[(i * 3) % leaves.length], v = votes[i];
      piv.add(K.dots([[L.wx, L.wy, 0]], { r: 0.1, c: v ? 'acc' : 'ink', o: v ? 1 : 0.55 }));
      if (p.feat) {
        const pick = new Set(); while (pick.size < 2) pick.add(r.int(0, nf - 1));
        for (let f = 0; f < nf; f++) piv.add(K.box(-0.4 + f * 0.16, 4.0, 0, 0.11, 0.11, 0.11, pick.has(f) ? A : { o: 0.3 }));
      }
      g.add(piv);
      const lw = new S.T.Vector3(L.wx, L.wy, 0).applyEuler(piv.rotation).add(piv.position);
      S.ln([[lw.x, lw.y - 0.1, lw.z], [fin[0], 0.9, fin[2]]], v ? { c: 'acc', w: 1.2, o: 0.55 } : { w: 1, o: 0.2 });
    }
    const k1 = votes.reduce((a, b) => a + b, 0), u = 0.16;
    S.ln([[fin[0] - 0.8, 0, fin[2]], [fin[0] + 0.8, 0, fin[2]]], { o: 0.5, w: 1 });
    S.add(K.box(fin[0] - 0.3, k1 * u / 2, fin[2], 0.45, k1 * u, 0.45, A));
    S.add(K.box(fin[0] + 0.3, (n - k1) * u / 2, fin[2], 0.45, (n - k1) * u || 0.02, 0.45, { fill: 0.08, o: 0.6 }));
    S.lab('ŷ', [fin[0], -0.45, fin[2]], { size: 0.42, c: 'acc', weight: 600 });
    S.yaw(0.62);
    const legend = p.feat ? [{ c: 'acc', t: 'Votes and feature subsets' }, { c: 'ink', t: 'Individual trees' }] : [{ c: 'acc', t: 'Majority vote' }, { c: 'ink', t: 'Individual trees' }];
    return { g, legend };
  };

  /* =========================================================== BOOST */
  VIZ.boost = function (p, K) {
    const S = mk(K), { g } = S, mode = p.mode || 'gbm', n = p.n || 5;
    const r = K.rng(23);
    const A = { fill: 0.62, fc: 'acc', c: 'acc' };
    const dx = mode === 'ada' ? 2.4 : Math.min(2.0, 9.5 / n), x0 = -dx * (n - 1) / 2;
    let legend;
    if (mode === 'ada') {
      // each stage: a row of 10 points (dots on a short rail); misclassified ones grow
      const np = 9; let w = range(np).map(() => 1);
      const mis = [[2, 6], [6, 7], [1, 7], [7]];
      for (let s2 = 0; s2 < n; s2++) {
        const x = x0 + s2 * dx;
        miniTree(S, K, fullTree(1), [x, 1.6, 0], { dx: 0.5, dy: 0.6, r: 0.06 });
        // stump weight alpha bar
        S.lab('α' + '₁₂₃₄₅₆'[s2], [x + 0.6, 1.75, 0], { size: 0.3, o: 0.6 });
        const m = mis[s2 % mis.length];
        const pts = [], rs = [], mpts = [], mrs = [];
        for (let i = 0; i < np; i++) {
          const q = [x - 0.45 + (i % 3) * 0.45, 0.0, 0.2 + Math.floor(i / 3) * 0.45];
          const rad = 0.045 * Math.sqrt(w[i]) + 0.03;
          if (m.includes(i)) { mpts.push(q); mrs.push(rad); } else { pts.push(q); rs.push(rad); }
        }
        if (pts.length) S.add(K.dots(pts, { rs, o: 0.7 }));
        if (mpts.length) S.add(K.dots(mpts, { rs: mrs, c: 'acc' }));
        // update weights for next stage
        w = w.map((v, i) => (m.includes(i) ? v * 2.6 : v * 0.8));
        if (s2 < n - 1) S.add(K.arrow([x + 0.75, 0.0, 0.65], [x + dx - 0.75, 0.0, 0.65], { o: 0.3, w: 1 }));
      }
      legend = [{ c: 'acc', t: 'Misclassified (upweighted)' }, { c: 'ink', t: 'Weak learners' }];
    } else {
      // GBM / XGB: trees left→right; above each, residual bars shrinking
      const nr = 7, base = range(nr).map(() => r.range(-1, 1));
      for (let s2 = 0; s2 < n; s2++) {
        const x = x0 + s2 * dx, shrink = Math.pow(0.6, s2);
        const nodes = miniTree(S, K, fullTree(2), [x, 1.4, 0], { dx: 0.32, dy: 0.5, r: 0.055 });
        if (mode === 'xgb') {
          // leaf weights as small bars below leaves (shrunk by λ)
          nodes.filter((q) => !q.ch).forEach((q, i) => { const lw = (0.25 + 0.2 * Math.sin(i + s2)) * shrink + 0.04; S.add(K.box(q.wx, q.wy - 0.12 - lw / 2, 0, 0.1, lw, 0.1, A)); });
        }
        // residuals
        const yR = 3.0;
        S.ln([[x - 0.75, yR, 0], [x + 0.75, yR, 0]], { o: 0.35, w: 1 });
        base.forEach((v, i) => {
          const h = v * shrink * 1.1;
          S.add(K.box(x - 0.6 + i * 0.2, yR + h / 2, 0, 0.13, Math.abs(h) || 0.01, 0.13, { fill: 0.55, fc: 'acc', c: 'acc', o: 0.9 }));
        });
        if (s2 > 0) S.lab('+', [x - dx / 2, 0.9, 0], { size: 0.36, o: 0.55 });
      }
      S.lab('r = y − F', [x0 - 1.5, 3.0, 0], { size: 0.3, mono: true, c: 'acc' });
      if (mode === 'xgb') S.lab('w* = −G/(H+λ)', [x0 - 1.7, 0.3, 0], { size: 0.28, mono: true, c: 'acc' });
      legend = mode === 'xgb' ? [{ c: 'acc', t: 'Residuals and leaf weights' }, { c: 'ink', t: 'Sequential trees' }] : [{ c: 'acc', t: 'Shrinking residuals' }, { c: 'ink', t: 'Sequential trees' }];
    }
    S.yaw(0.5);
    return { g, legend };
  };


  /* =========================================================== BOOTSTRAP */
  VIZ.bootstrap = function (p, K) {
    const S = mk(K), { g } = S, mode = p.mode || 'boot';
    const r = K.rng(mode === 'oob' ? 61 : 37);
    const A = { fill: 0.62, fc: 'acc', c: 'acc' };
    const N = 10, cs = 0.62, X = (i) => (i - (N - 1) / 2) * cs * 1.15;
    const cubeI = (x, y, z, st, s0 = cs) => S.add(K.box(x, y, z, s0, s0, s0, st));
    let legend;
    const original = (z, y = 0) => { for (let i = 0; i < N; i++) { cubeI(X(i), y, z, { fill: 0.1, o: 0.75 }); S.lab(String(i + 1), [X(i), y + 0.6, z], { size: 0.24, mono: true, o: 0.5 }); } };

    if (mode === 'boot' || mode === 'oob' || mode === 'sub') {
      original(-2.4, 0);
      const B = 4;
      for (let b = 0; b < B; b++) {
        const z = -0.6 + b * 1.3;
        let idx;
        if (mode === 'sub') { const pool = range(N); for (let k = N - 1; k > 0; k--) { const j = r.int(0, k); [pool[k], pool[j]] = [pool[j], pool[k]]; } idx = pool.slice(0, 6).sort((a, c) => a - c); }
        else idx = range(N).map(() => r.int(0, N - 1)).sort((a, c) => a - c);
        const count = range(N).fill(0); idx.forEach((i) => count[i]++);
        for (let i = 0; i < N; i++) {
          if (count[i] === 0) {
            if (mode === 'oob') cubeI(X(i), 0, z, A);
            else S.add(K.rect(X(i), -cs / 2, z, cs, cs, 'xz', { o: 0.22, w: 1 }));
          } else for (let k = 0; k < count[i]; k++) cubeI(X(i), k * cs * 1.05, z, mode === 'oob' ? { fill: 0.06, o: 0.45 } : (k > 0 ? A : { fill: 0.12, o: 0.75 }));
        }
        S.ln([[X(0) - 0.6, -cs / 2, z], [X(N - 1) + 0.6, -cs / 2, z]], { o: 0.2, w: 1 });
      }
      S.lab('D', [X(0) - 1.0, 0, -2.4], { size: 0.4, weight: 600 });
      ['D₁*', 'D₂*', 'D₃*', 'D₄*'].forEach((t, b) => S.lab(mode === 'sub' ? t.replace('*', '') : t, [X(0) - 1.0, 0, -0.6 + b * 1.3], { size: 0.34, o: 0.7 }));
      if (mode === 'boot') legend = [{ c: 'acc', t: 'Repeated draws' }, { c: 'ink', t: 'Sampled once' }];
      else if (mode === 'oob') legend = [{ c: 'acc', t: 'Out-of-bag samples' }, { c: 'ink', t: 'In-bag samples' }];
      else { S.lab('n = 0.6·N', [X(N - 1) + 1.4, 0, 1.3], { size: 0.3, mono: true, o: 0.6 }); legend = [{ c: 'ink', t: 'Sampled rows (no repeats)' }]; }
    }

    else if (mode === 'batch') {
      const M = 24, bs = 6, nb = M / bs, rr = K.rng(3);
      const perm = range(M); for (let k = M - 1; k > 0; k--) { const j = rr.int(0, k); [perm[k], perm[j]] = [perm[j], perm[k]]; }
      // dataset row (back)
      const Xd = (i) => (i - (M - 1) / 2) * 0.38;
      for (let i = 0; i < M; i++) cubeI(Xd(i), 0, -2.4, { fill: 0.1, o: 0.6 }, 0.3);
      // batches (front), each its own slab; the current one accent
      for (let b = 0; b < nb; b++) {
        const z = -0.4 + b * 1.0, cur = b === 1;
        for (let k = 0; k < bs; k++) {
          const i = perm[b * bs + k], x = (k - (bs - 1) / 2) * 0.42 - 2.4 + b * 0.0;
          cubeI(x, 0, z, cur ? A : { fill: 0.06, o: 0.45 }, 0.3);
          if (cur) S.ln([[Xd(i), 0, -2.2], [x, 0, z - 0.2]], { c: 'acc', o: 0.4, w: 1 });
        }
        S.add(K.arrow([0.2, 0, z], [1.8, 0, z], { o: cur ? 0.9 : 0.25, w: cur ? 1.6 : 1, c: cur ? 'acc' : 'ink' }));
        S.lab('∇L', [2.4, 0, z], { size: 0.32, c: cur ? 'acc' : 'ink', o: cur ? 1 : 0.4 });
      }
      S.lab('B = 6', [-2.4, 0.5, -0.4 - 0.7], { size: 0.3, mono: true, o: 0.6 });
      legend = [{ c: 'acc', t: 'Current mini-batch' }, { c: 'ink', t: 'Full dataset' }];
    }

    else if (mode === 'accum') {
      const k = 4, bs = 4;
      const gx = 2.6;
      for (let m = 0; m < k; m++) {
        const z = -2.1 + m * 1.4;
        for (let i = 0; i < bs; i++) cubeI(-3.6 + i * 0.42, 0, z, { fill: 0.08, o: 0.6 }, 0.32);
        S.add(K.arrow([-1.9, 0, z], [-0.6, 0, z], { o: 0.4, w: 1 }));
        // gradient vector of the micro-batch
        S.add(K.box(0.1, 0, z, 0.9, 0.3, 0.3, { fill: 0.3, fc: 'acc', c: 'acc', o: 0.7 }));
        S.lab('g' + '₁₂₃₄'[m], [0.1, 0.45, z], { size: 0.3, c: 'acc' });
        S.ln([[0.6, 0, z], [gx - 0.6, (m + 0.5) * 0.3, 0]], { c: 'acc', w: 1.2, o: 0.5 });
      }
      // accumulator: stacked contributions
      for (let m = 0; m < k; m++) S.add(K.box(gx, (m + 0.5) * 0.3, 0, 0.9, 0.28, 0.6, A));
      S.add(K.box(gx, k * 0.3 / 2, 0, 1.1, k * 0.3 + 0.1, 0.8, { o: 0.6 }));
      S.lab('Σg / 4', [gx, k * 0.3 + 0.5, 0], { size: 0.34, c: 'acc', mono: true });
      S.add(K.arrow([gx + 0.8, 0.6, 0], [gx + 2.0, 0.6, 0], { w: 1.6 }));
      S.lab('θ ← θ − ηĝ', [gx + 2.4, 1.2, 0], { size: 0.3, mono: true, o: 0.75 });
      S.add(K.box(gx + 2.5, 0.6, 0, 0.6, 0.6, 0.6, { fill: 0.08, o: 0.8 }));
      legend = [{ c: 'acc', t: 'Accumulated gradients' }, { c: 'ink', t: 'Micro-batches' }];
    }
    S.yaw(0.35);
    return { g, legend };
  };

  /* =========================================================== FOLDS */
  VIZ.folds = function (p, K) {
    const S = mk(K), { g } = S, kind = p.kind || 'kfold';
    const A = { fill: 0.62, fc: 'acc', c: 'acc' }, Bs = { fill: 0.45, fc: 'b', c: 'b' };
    const Tr = { fill: 0.08, o: 0.6 };
    const W = 9, x0 = -4.5, h = 0.5, d = 0.7;
    const seg = (a, b, z, st, y = 0) => S.add(K.box(x0 + W * (a + b) / 2, y + h / 2, z, W * (b - a) - 0.06, h, d, st));
    let legend;

    if (kind === 'split') {
      seg(0, 0.7, 0, Tr); seg(0.7, 0.85, 0, Bs); seg(0.85, 1, 0, A);
      S.lab('70%', [x0 + W * 0.35, h + 0.4, 0], { size: 0.32, mono: true, o: 0.6 });
      S.lab('15%', [x0 + W * 0.775, h + 0.4, 0], { size: 0.32, mono: true, c: 'b' });
      S.lab('15%', [x0 + W * 0.925, h + 0.4, 0], { size: 0.32, mono: true, c: 'acc' });
      // usage stages in depth: fit → tune → final eval
      S.add(K.box(x0 + W * 0.35, 0.25, 2.0, 1.4, 0.5, 0.7, { fill: 0.04, o: 0.6 }));
      S.add(K.arrow([x0 + W * 0.35, 0.25, 0.45], [x0 + W * 0.35, 0.25, 1.6], { o: 0.4, w: 1.2 }));
      S.add(K.arrow([x0 + W * 0.775, 0.25, 0.45], [x0 + W * 0.775, 0.25, 1.6], { c: 'b', w: 1.4 }));
      S.add(K.arrow([x0 + W * 0.925, 0.25, 0.45], [x0 + W * 0.925, 0.25, 3.2], { c: 'acc', w: 1.4 }));
      S.lab('θ', [x0 + W * 0.35, 0.95, 2.0], { size: 0.36, o: 0.7 });
      S.lab('λ', [x0 + W * 0.775, 0.95, 2.0], { size: 0.36, c: 'b' });
      S.add(K.box(x0 + W * 0.925, 0.25, 3.6, 0.6, 0.5, 0.6, A));
      legend = [{ c: 'ink', t: 'Training set' }, { c: 'b', t: 'Validation set' }, { c: 'acc', t: 'Test set' }];
    }

    else if (kind === 'kfold' || kind === 'strat') {
      const k = 5;
      for (let f = 0; f < k; f++) {
        const z = -2.4 + f * 1.2;
        for (let j = 0; j < k; j++) {
          const val = j === f;
          if (kind === 'strat') {
            // each fold block holds the same class mix: lower part class A, upper part class B
            const a = j / k, b = (j + 1) / k, xc = x0 + W * (a + b) / 2, ww = W / k - 0.08;
            S.add(K.box(xc, 0.3 * 0.7 / 2, z, ww, 0.3 * 0.7, d, val ? A : { fill: 0.5, fc: 'acc', c: 'acc', o: 0.35 }));
            S.add(K.box(xc, 0.21 + 0.3 * 0.3 / 2 + 0.25, z, ww, 0.3 * 0.3 + 0.05, d, val ? Bs : { fill: 0.4, fc: 'b', c: 'b', o: 0.35 }));
            if (val) S.add(K.box(xc, 0.3, z, ww + 0.06, 0.62, d + 0.06, { o: 0.9 }));
          } else seg(j / k, (j + 1) / k, z, val ? A : Tr);
        }
        S.lab(String(f + 1), [x0 - 0.6, 0.25, z], { size: 0.3, mono: true, o: 0.6 });
      }
      if (kind === 'kfold') {
        // validation scores averaged
        const sc = [0.82, 0.79, 0.85, 0.8, 0.83];
        sc.forEach((v, f) => S.add(K.box(x0 + W + 0.8, v * 2 / 2, -2.4 + f * 1.2, 0.35, v * 2, 0.35, { fill: 0.3, fc: 'acc', c: 'acc', o: 0.8 })));
        S.lab('k = 5', [x0 + W / 2, 1.0, -3.4], { size: 0.34, mono: true, o: 0.6 });
        legend = [{ c: 'acc', t: 'Validation fold' }, { c: 'ink', t: 'Training folds' }];
      } else {
        // overall dataset class mix at back for reference
        S.add(K.box(x0 + W * 0.5, 0.21 / 2 + 0.0, -3.8, W, 0.21, d, { fill: 0.5, fc: 'acc', c: 'acc', o: 0.6 }));
        S.add(K.box(x0 + W * 0.5, 0.21 + 0.09 / 2 + 0.25 - 0.21 + 0.05, -3.8, W, 0.14, d, { fill: 0.4, fc: 'b', c: 'b', o: 0.6 }));
        S.lab('70 : 30', [x0 + W + 0.9, 0.3, -3.8], { size: 0.3, mono: true, o: 0.65 });
        legend = [{ c: 'acc', t: 'Class A' }, { c: 'b', t: 'Class B' }];
      }
    }

    else if (kind === 'leak') {
      // train and test blocks; a scaler fitted on all data (incl. test) feeds statistics back into training
      seg(0, 0.72, 0, Tr); seg(0.75, 1, 0, { fill: 0.08, o: 0.6 });
      // global statistic box above, fed from both
      const sx = x0 + W * 0.5, sy = 2.6;
      S.add(K.box(sx, sy, 0, 1.6, 0.6, 0.7, { fill: 0.04, o: 0.8 }));
      S.lab('μ, σ', [sx, sy, 0.4], { size: 0.34, mono: true, o: 0.8 });
      S.add(K.arrow([x0 + W * 0.36, h + 0.1, 0], [sx - 0.4, sy - 0.35, 0], { o: 0.45, w: 1.2 }));
      S.add(K.arrow([x0 + W * 0.875, h + 0.1, 0], [sx + 0.5, sy - 0.35, 0], { c: 'acc', w: 2 }));
      S.add(K.arc([sx - 0.8, sy, 0], [x0 + W * 0.2, h + 0.1, 0], 0.8, { c: 'acc', w: 2, dash: true }));
      // test information "inside" training rows: a few accent cubes within training block
      const rr = K.rng(5);
      for (let i = 0; i < 6; i++) S.add(K.box(x0 + W * rr.range(0.05, 0.68), h / 2, rr.range(-0.2, 0.2), 0.22, 0.22, 0.22, A));
      // the honest pipeline in depth behind, faint
      const zb = -2.2;
      seg(0, 0.72, zb, { fill: 0.04, o: 0.3 }); seg(0.75, 1, zb, { fill: 0.04, o: 0.3 });
      S.add(K.arrow([x0 + W * 0.36, h, zb], [x0 + W * 0.36, 1.6, zb], { o: 0.3, w: 1 }));
      S.lab('μ, σ', [x0 + W * 0.36, 1.9, zb], { size: 0.3, mono: true, o: 0.4 });
      S.lab('✓', [x0 + W + 0.6, 0.3, zb], { size: 0.36, o: 0.4 });
      S.lab('✗', [x0 + W + 0.6, 0.3, 0], { size: 0.4, c: 'acc' });
      legend = [{ c: 'acc', t: 'Leaked test information' }, { c: 'ink', t: 'Training data' }];
    }

    else if (kind === 'ts') {
      const k = 5;
      // time arrow
      S.add(K.arrow([x0, 0, 3.3], [x0 + W + 0.4, 0, 3.3], { o: 0.5, w: 1.2 }));
      S.lab('t', [x0 + W + 0.8, 0, 3.3], { size: 0.34, o: 0.6 });
      for (let f = 0; f < k; f++) {
        const z = -2.4 + f * 1.2, end = 0.35 + f * 0.13, vEnd = end + 0.13;
        seg(0, end, z, Tr); seg(end, vEnd, z, A);
        if (vEnd < 1) S.add(K.box(x0 + W * (vEnd + 1) / 2, 0.02, z, W * (1 - vEnd) - 0.06, 0.04, d, { o: 0.15 }));
        S.lab(String(f + 1), [x0 - 0.6, 0.25, z], { size: 0.3, mono: true, o: 0.6 });
      }
      legend = [{ c: 'acc', t: 'Validation (future)' }, { c: 'ink', t: 'Training (past)' }];
    }
    S.yaw(0.4);
    return { g, legend };
  };

  /* =========================================================== HPARAM */
  VIZ.hparam = function (p, K) {
    const S = mk(K), { g } = S, kind = p.kind || 'grid';
    const R = 3.6;
    // score landscape: a narrow ridge in one dimension (important) and flat in the other
    const f = (x, z) => 2.6 * Math.exp(-((x - 1.1) ** 2) / 0.9) * (0.8 + 0.2 * Math.exp(-((z + 0.5) ** 2) / 6)) + 0.25;
    S.add(K.frame({ s: R, n: 8, h: 3.4 }));
    S.lab('η', [R + 0.4, 0, -R], { size: 0.36, o: 0.6 });
    S.lab('λ', [-R, 0, R + 0.4], { size: 0.36, o: 0.6 });
    let legend;
    const stem = (x, z, st, hl) => {
      const y = f(x, z);
      S.ln([[x, 0, z], [x, y, z]], hl ? { c: 'acc', w: 1.6 } : { o: 0.35, w: 1 });
      return [x, y, z];
    };
    if (kind === 'grid' || kind === 'random') {
      S.add(K.surface(f, { xr: [-R, R], zr: [-R, R], n: 24, o: 0.12 }));
      const pts = [];
      if (kind === 'grid') { for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) pts.push([-R + 0.6 + i * (2 * R - 1.2) / 4, -R + 0.6 + j * (2 * R - 1.2) / 4]); }
      else { const r = K.rng(8); for (let i = 0; i < 25; i++) pts.push([r.range(-R + 0.3, R - 0.3), r.range(-R + 0.3, R - 0.3)]); }
      const tops = pts.map(([x, z]) => [x, f(x, z), z]);
      const best = tops.reduce((a, b) => (b[1] > a[1] ? b : a));
      pts.forEach(([x, z]) => stem(x, z, null, false));
      S.add(K.dots(tops.filter((q) => q !== best), { r: 0.08 }));
      S.add(K.dots([best], { r: 0.15, c: 'acc' }));
      S.ln([[best[0], 0, best[2]], [best[0], best[1], best[2]]], { c: 'acc', w: 2 });
      // projections onto the important axis (back wall): distinct η values tried
      const xs = [...new Set(pts.map((q) => q[0].toFixed(2)))].map(Number);
      S.add(K.dots(xs.map((x) => [x, 0.02, -R]), { r: 0.06, c: 'acc', o: 0.8 }));
      S.lab(kind === 'grid' ? '5 × 5' : '25', [-R - 0.2, 3.3, -R], { size: 0.32, mono: true, o: 0.6 });
      legend = [{ c: 'acc', t: 'Best trial' }, { c: 'ink', t: 'Trials (score as height)' }];
      if (kind === 'random') legend = [{ c: 'acc', t: 'Best trial and η coverage' }, { c: 'ink', t: 'Trials (score as height)' }];
    } else {
      // Bayesian optimisation: surrogate mean surface (accent wire) with uncertainty, observed points, next point by acquisition
      const obs = [[-2.5, -2], [-1, 2.2], [0.3, -1], [2.6, 1.5], [1.4, 0.4], [-2.8, 1.0]];
      const kern = (a, b) => Math.exp(-((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / 2.2);
      const mu = (x, z) => { let s = 0, w = 0; obs.forEach((o) => { const k = kern([x, z], o); s += k * f(o[0], o[1]); w += k; }); return (s + 0.6 * 0.3) / (w + 0.3); };
      const sd = (x, z) => { const m = Math.max(...obs.map((o) => kern([x, z], o))); return 0.9 * (1 - m); };
      S.add(K.surface(mu, { xr: [-R, R], zr: [-R, R], n: 22, o: 0.35 }));
      S.add(K.surface((x, z) => mu(x, z) + 1.6 * sd(x, z), { xr: [-R, R], zr: [-R, R], n: 22, o: 0.1 }));
      const top = obs.map((o) => [o[0], f(o[0], o[1]), o[1]]);
      top.forEach((q) => S.ln([[q[0], 0, q[2]], [q[0], q[1], q[2]]], { o: 0.4, w: 1 }));
      S.add(K.dots(top, { r: 0.1 }));
      // acquisition max (UCB) on a grid
      let best = null, bv = -1e9;
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const x = -R + 2 * R * i / 40, z = -R + 2 * R * j / 40, a = mu(x, z) + 1.6 * sd(x, z); if (a > bv) { bv = a; best = [x, z]; } }
      // acquisition curve on the floor slice through best z
      const zc = best[1], ac = range(61).map((i) => { const x = -R + 2 * R * i / 60; return [x, 0.02 + 0.5 * (mu(x, zc) + 1.6 * sd(x, zc)) - 0.0, -R]; });
      S.ln(ac, { c: 'acc', w: 1.6, o: 0.8 });
      S.ln([[best[0], 0, -R], [best[0], 0.5 * bv, -R]], { c: 'acc', w: 1, dash: true });
      S.ln([[best[0], 0, best[1]], [best[0], mu(best[0], best[1]) + 1.6 * sd(best[0], best[1]), best[1]]], { c: 'acc', w: 2, dash: true });
      S.add(K.dots([[best[0], mu(best[0], best[1]) + 1.6 * sd(best[0], best[1]), best[1]]], { r: 0.16, c: 'acc' }));
      S.lab('α(x)', [-R - 0.6, 0.9, -R], { size: 0.32, c: 'acc', mono: true });
      S.lab('μ ± σ', [R + 0.5, 1.6, R], { size: 0.32, mono: true, o: 0.6 });
      legend = [{ c: 'acc', t: 'Next point (acquisition)' }, { c: 'ink', t: 'Surrogate and uncertainty' }];
    }
    return { g, legend };
  };

/*__END__*/
})();
