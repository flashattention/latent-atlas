/* Latent Atlas — viz-d: net, conv, seq, stack, attn, qkv, heads, posenc, moe */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------- shared helpers ---------- */
  function lab(g, t, p, o) { const s = K.label(t, p, Object.assign({ size: 0.34, o: 0.8 }, o || {})); g.add(s); return s; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  function turn(g, a) { const o = new T.Group(); g.rotation.y = a; o.add(g); return o; }
  function wrap(fn, rot) {
    return function (p, KK) {
      K = KK; T = K.THREE;
      const g = new T.Group();
      const res = fn(p, g) || {};
      const out = Array.isArray(res) ? { legend: res } : res;
      if (!out.g) { const a = out.rot != null ? out.rot : rot; out.g = a ? turn(g, a) : g; }
      delete out.rot;
      return out;
    };
  }
  /* module box (faint), accent module box */
  const BX = {
    ink: { fill: 0.05, o: 0.6 },
    faint: { fill: 0.025, o: 0.25 },
    ghost: { fill: 0.0, o: 0.14 },
    acc: { fill: 0.55, fc: 'acc', c: 'acc', o: 0.95 },
    accL: { fill: 0.2, fc: 'acc', c: 'acc', o: 0.9 },
    b: { fill: 0.5, fc: 'b', c: 'b', o: 0.95 },
    bL: { fill: 0.18, fc: 'b', c: 'b', o: 0.9 },
  };
  function bx(g, x, y, z, w, h, d, st) { const b = K.box(x, y, z, w, h, d, st || BX.ink); g.add(b); return b; }
  function circ(c, r, plane, n) {
    n = n || 40; const out = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
      out.push(plane === 'xz' ? [c[0] + u, c[1], c[2] + v] : plane === 'yz' ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2]]);
    }
    return out;
  }
  function ring(g, c, r, o) { g.add(K.line(circ(c, r, (o && o.plane) || 'xy'), Object.assign({ w: 1.4 }, o || {}))); }
  function bez(a, m, b, n) { const c = new T.QuadraticBezierCurve3(K.V(...a), K.V(...m), K.V(...b)); return c.getPoints(n || 28).map((v) => [v.x, v.y, v.z]); }
  function bez3(a, m1, m2, b, n) { const c = new T.CubicBezierCurve3(K.V(...a), K.V(...m1), K.V(...m2), K.V(...b)); return c.getPoints(n || 36).map((v) => [v.x, v.y, v.z]); }
  function arrowHead(g, a, b, o) { g.add(K.arrow(a, b, o)); }
  function setPos(mesh, q) { mesh.position.set(q[0], q[1], q[2]); }
  function along(pts, u) { // point at fraction u along polyline
    u = clamp(u, 0, 1);
    const L = [0]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
    const tgt = u * L[L.length - 1];
    for (let i = 1; i < pts.length; i++) if (L[i] >= tgt) { const f = (tgt - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return lerp3(pts[i - 1], pts[i], f); }
    return pts[pts.length - 1];
  }
  function quad(a, b, c, d, o) {
    const pos = [...a, ...b, ...c, ...a, ...c, ...d];
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    return new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.o, side: T.DoubleSide, depthWrite: false }));
  }
  function ribbon(top, bot, o) { // filled strip between two polylines
    const pos = [];
    for (let i = 0; i < top.length - 1; i++) {
      const a = top[i], b = top[i + 1], c = bot[i], d = bot[i + 1];
      pos.push(...c, ...d, ...b, ...c, ...b, ...a);
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    return new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.o, side: T.DoubleSide, depthWrite: false }));
  }

  /* =====================================================================
     NET
     ===================================================================== */
  function layout(layers, W, sp) {
    const L = layers.length;
    return layers.map((n, l) => { const x = -W / 2 + W * l / (L - 1); return Array.from({ length: n }, (_, i) => [x, ((n - 1) / 2 - i) * sp, 0]); });
  }
  function edges(P, filt) {
    const out = [];
    for (let l = 0; l < P.length - 1; l++) for (let i = 0; i < P[l].length; i++) for (let j = 0; j < P[l + 1].length; j++) if (!filt || filt(l, i, j)) out.push([P[l][i], P[l + 1][j]]);
    return out;
  }
  function plates(g, P, sp, o) {
    P.forEach((col) => {
      const h = (col.length - 1) * sp + 0.7;
      const x = col[0][0], hh = h / 2;
      g.add(K.rect(x, 0, 0, h, 1.0, 'yz', { o: o == null ? 0.12 : o }));
      g.add(quad([x, -hh, -0.5], [x, -hh, 0.5], [x, hh, 0.5], [x, hh, -0.5], { o: 0.025 }));
    });
  }
  function spOf(layers) { const m = Math.max(...layers); return m > 9 ? 0.46 : m > 6 ? 0.58 : 0.7; }
  const NET = {};

  NET.mlp = function (p, g) {
    const layers = p.layers || [4, 6, 6, 3], sp = spOf(layers), W = layers.length > 3 ? 7.6 : 6.4;
    const P = layout(layers, W, sp);
    plates(g, P, sp);
    g.add(K.segs(edges(P), { o: 0.16 }));
    const r = K.rng(5);
    const path = layers.map((n, l) => (l === 0 ? 1 : r.int(0, n - 1)));
    const pe = []; for (let l = 0; l < layers.length - 1; l++) pe.push([P[l][path[l]], P[l + 1][path[l + 1]]]);
    // the fan-in to each path neuron, lightly
    const fan = []; for (let l = 0; l < layers.length - 1; l++) P[l].forEach((q) => fan.push([q, P[l + 1][path[l + 1]]]));
    g.add(K.segs(fan, { c: 'acc', o: 0.28 }));
    g.add(K.segs(pe, { c: 'acc', w: 2.6 }));
    P.forEach((col, l) => g.add(K.dots(col.filter((_, i) => i !== path[l]), { r: 0.09 })));
    g.add(K.dots(P.map((col, l) => col[path[l]]), { r: 0.13, c: 'acc' }));
    const L = layers.length, top = (Math.max(...layers) - 1) / 2 * sp + 0.75;
    lab(g, 'x', [P[0][0][0] - 0.75, 0, 0], { size: 0.42, o: 0.75 });
    lab(g, 'ŷ', [P[L - 1][0][0] + 0.75, 0, 0], { size: 0.42, o: 0.75 });
    if (L === 3) {
      lab(g, 'd', [P[0][0][0], (layers[0] - 1) / 2 * sp + 0.65, 0], { size: 0.3, o: 0.55 });
      lab(g, '4d', [P[1][0][0], top, 0], { size: 0.3, o: 0.55 });
      lab(g, 'd', [P[2][0][0], (layers[2] - 1) / 2 * sp + 0.65, 0], { size: 0.3, o: 0.55 });
      lab(g, 'W₁', [(P[0][0][0] + P[1][0][0]) / 2, top * 0.82, 0], { size: 0.3, o: 0.6 });
      lab(g, 'W₂', [(P[1][0][0] + P[2][0][0]) / 2, top * 0.82, 0], { size: 0.3, o: 0.6 });
    }
    return [{ c: 'acc', t: 'Activation path' }];
  };

  NET.neuron = function (p, g) {
    const ins = [[-4.2, 1.7, -1.0], [-4.4, 0.25, 0.2], [-4.0, -1.2, 1.2]];
    const ws = [1.4, -0.6, 0.9];
    const S = [0, 0, 0];
    ins.forEach((q, i) => {
      const d = [S[0] - q[0], S[1] - q[1], S[2] - q[2]], L = Math.hypot(...d);
      const e = [S[0] - d[0] / L * 0.55, S[1] - d[1] / L * 0.55, S[2] - d[2] / L * 0.55];
      g.add(K.arrow(q, e, { c: 'acc', w: 1.4 + Math.abs(ws[i]) * 1.4, head: 0.22 }));
      lab(g, 'x' + '₁₂₃'[i], [q[0] - 0.55, q[1], q[2]], { size: 0.46, o: 0.85 });
      const m = lerp3(q, S, 0.45);
      lab(g, 'w' + '₁₂₃'[i], [m[0], m[1] + 0.38, m[2]], { size: 0.4, c: 'acc' });
    });
    g.add(K.dots(ins, { r: 0.12 }));
    // bias
    const bp = [-1.4, -2.2, 0.0];
    g.add(K.arrow(bp, [-0.3, -0.45, 0], { o: 0.55, w: 1.2, head: 0.18 }));
    g.add(K.dots([bp], { r: 0.09, o: 0.6 }));
    lab(g, 'b', [bp[0] - 0.4, bp[1], bp[2]], { size: 0.42, o: 0.6 });
    // Σ node
    g.add(K.dots([S], { r: 0.42, c: 'acc', o: 0.85 }));
    lab(g, 'Σ', [0, 0.85, 0], { size: 0.5, c: 'acc', weight: 600 });
    // activation
    const A = [2.3, 0, 0], s = 0.62;
    g.add(K.arrow([0.55, 0, 0], [A[0] - s - 0.05, 0, 0], { w: 1.6, head: 0.2 }));
    g.add(K.rect(A[0], A[1], A[2], 2 * s, 2 * s, 'xy', { o: 0.7, w: 1.2, fill: 0.04, fc: 'ink' }));
    const sig = []; for (let i = 0; i <= 40; i++) { const u = -1 + 2 * i / 40; sig.push([A[0] + u * s * 0.8, A[1] + (1 / (1 + Math.exp(-u * 5)) - 0.5) * s * 1.5, A[2] + 0.001]); }
    g.add(K.line(sig, { w: 2 }));
    lab(g, 'σ', [A[0], A[1] + s + 0.35, 0], { size: 0.4, o: 0.75 });
    g.add(K.arrow([A[0] + s + 0.05, 0, 0], [4.6, 0, 0], { w: 1.6, head: 0.22 }));
    lab(g, 'y', [4.95, 0, 0], { size: 0.44 });
    return [{ c: 'acc', t: 'Weighted sum' }];
  };

  NET.dropout = function (p, g) {
    const layers = p.layers || [4, 7, 7, 3], sp = spOf(layers), W = 7.4, rate = p.rate == null ? 0.4 : +p.rate;
    const P = layout(layers, W, sp);
    plates(g, P, sp);
    const r = K.rng(21);
    const U = P.map((col) => col.map(() => r()));
    U[1][2] = 0.05; U[2][4] = 0.08; U[1][5] = 0.9; // keep the picture stable
    const drop = (l, i) => l > 0 && l < layers.length - 1 && U[l][i] < rate;
    g.add(K.segs(edges(P, (l, i, j) => !drop(l, i) && !drop(l + 1, j)), { o: 0.42 }));
    g.add(K.segs(edges(P, (l, i, j) => drop(l, i) || drop(l + 1, j)), { o: 0.05 }));
    const kept = [], dropped = [];
    P.forEach((col, l) => col.forEach((q, i) => (drop(l, i) ? dropped : kept).push(q)));
    g.add(K.dots(kept, { r: 0.1 }));
    if (dropped.length) {
      g.add(K.dots(dropped, { r: 0.15, c: 'acc', hollow: true }));
      g.add(K.segs(dropped.flatMap((q) => [[[q[0] - 0.09, q[1] - 0.09, q[2]], [q[0] + 0.09, q[1] + 0.09, q[2]]], [[q[0] - 0.09, q[1] + 0.09, q[2]], [q[0] + 0.09, q[1] - 0.09, q[2]]]]), { c: 'acc', o: 0.9 }));
    }
    lab(g, 'x', [P[0][0][0] - 0.75, 0, 0], { size: 0.42, o: 0.75 });
    lab(g, 'ŷ', [P[3][0][0] + 0.75, 0, 0], { size: 0.42, o: 0.75 });
    return { legend: [{ c: 'acc', t: 'Dropped neurons' }, { c: 'ink', t: 'Active neurons' }], ctl: [{ key: 'rate', label: 'p', min: 0, max: 0.7, step: 0.1, value: rate }] };
  };

  NET.backprop = function (p, g) {
    const layers = p.layers || [3, 5, 5, 2], sp = 0.78, W = 6.6;
    const P = layout(layers, W, sp);
    plates(g, P, sp);
    g.add(K.segs(edges(P), { o: 0.14 }));
    const r = K.rng(8);
    // gradient arrows along every edge, pointing backward; magnitude -> width/opacity
    for (let l = layers.length - 2; l >= 0; l--) {
      P[l].forEach((a) => P[l + 1].forEach((b) => {
        const m = 0.25 + 0.75 * r();
        const s = lerp3(b, a, 0.08), e = lerp3(b, a, 0.86);
        g.add(K.arrow(s, e, { c: 'acc', o: 0.2 + 0.55 * m, w: 0.8 + 1.0 * m, head: 0.13 }));
      }));
    }
    P.forEach((col) => g.add(K.dots(col, { r: 0.1 })));
    // loss
    const Lp = [W / 2 + 1.5, 0, 0];
    P[layers.length - 1].forEach((q) => g.add(K.line([q, Lp], { o: 0.45, w: 1 })));
    g.add(K.dots([Lp], { r: 0.17, c: 'acc' }));
    lab(g, 'L', [Lp[0] + 0.45, 0.05, 0], { size: 0.46, c: 'acc', weight: 600 });
    // forward / backward direction cues
    const yT = (Math.max(...layers) - 1) / 2 * sp + 0.8, yB = -yT;
    g.add(K.arrow([-W / 2, yT, 0], [W / 2, yT, 0], { o: 0.45, w: 1.2, head: 0.22 }));
    lab(g, 'x → ŷ', [0, yT + 0.38, 0], { size: 0.32, o: 0.55 });
    g.add(K.arrow([W / 2 + 1.0, yB, 0], [-W / 2, yB, 0], { c: 'acc', w: 2.2, head: 0.28 }));
    lab(g, '∂L/∂w', [0, yB - 0.42, 0], { size: 0.36, c: 'acc' });
    return [{ c: 'acc', t: 'Gradient flow' }, { c: 'ink', t: 'Forward pass' }];
  };

  NET.vanish = function (p, g) {
    const layers = p.layers || [3, 4, 4, 4, 4, 4, 2], sp = 0.6, W = 8.4, gam = p.gamma == null ? 0.6 : +p.gamma;
    const P = layout(layers, W, sp), L = layers.length;
    plates(g, P, sp);
    const mag = layers.map((_, l) => Math.pow(gam, L - 1 - l));
    const mmax = Math.max(...mag);
    for (let l = 0; l < L - 1; l++) {
      const m = mag[l] / mmax;
      g.add(K.segs(edges([P[l], P[l + 1]]), { c: 'acc', o: 0.06 + 0.6 * m }));
    }
    P.forEach((col) => g.add(K.dots(col, { r: 0.09 })));
    const y0 = (Math.max(...layers) - 1) / 2 * sp + 0.55, Hm = 3.0, base = 0.9;
    let clipped = false;
    P.forEach((col, l) => {
      let h = base * mag[l]; if (h > Hm) { h = Hm; clipped = true; }
      bx(g, col[0][0], y0 + h / 2, 0, 0.42, Math.max(h, 0.02), 0.42, BX.acc);
      if (base * mag[l] > Hm) g.add(K.line([[col[0][0], y0 + Hm + 0.1, 0], [col[0][0], y0 + Hm + 0.5, 0]], { c: 'acc', dash: true, w: 1.4 }));
    });
    g.add(K.line([[-W / 2 - 0.5, y0, 0], [W / 2 + 0.5, y0, 0]], { o: 0.35, w: 1 }));
    g.add(K.arrow([W / 2 + 0.3, -y0 - 0.1, 0], [-W / 2 - 0.3, -y0 - 0.1, 0], { o: 0.55, w: 1.2, head: 0.22 }));
    lab(g, '∂L/∂h', [-W / 2 - 1.0, y0 + 0.5, 0], { size: 0.32, c: 'acc' });
    lab(g, 'γ=' + gam.toFixed(1), [W / 2 + 0.4, y0 + Math.min(Hm, base * mag[L - 1]) + 0.4, 0], { size: 0.32, o: 0.6 });
    lab(g, 'L', [W / 2 + 0.9, 0, 0], { size: 0.4, o: 0.7 });
    void clipped;
    return { legend: [{ c: 'acc', t: 'Gradient magnitude' }], ctl: [{ key: 'gamma', label: 'γ', min: 0.5, max: 1.5, step: 0.1, value: gam }] };
  };

  NET.residual = function (p, g) {
    const layers = p.layers || [3, 4, 4, 4, 4, 3], sp = 0.62, W = 8;
    const P = layout(layers, W, sp), L = layers.length;
    plates(g, P, sp);
    g.add(K.segs(edges(P), { o: 0.2 }));
    P.forEach((col) => g.add(K.dots(col, { r: 0.09 })));
    const top = (Math.max(...layers) - 1) / 2 * sp + 0.5;
    [[1, 3], [3, 5]].forEach(([a, b], k) => {
      if (b >= L) return;
      const A = [P[a][0][0], top, 0], B = [P[b][0][0] - 0.0, top, 0];
      const pts = bez3(A, [A[0] + 0.3, top + 1.9, 0], [B[0] - 0.3, top + 1.9, 0], B, 40);
      g.add(K.line(pts, { c: 'acc', w: 2.4 }));
      g.add(K.dots([A], { r: 0.08, c: 'acc' }));
      // ⊕ at merge
      ring(g, [B[0], top, 0], 0.2, { c: 'acc', w: 2 });
      g.add(K.segs([[[B[0] - 0.13, top, 0], [B[0] + 0.13, top, 0]], [[B[0], top - 0.13, 0], [B[0], top + 0.13, 0]]], { c: 'acc', w: 2 }));
      g.add(K.line([[B[0], top - 0.2, 0], [B[0], P[b][0][1] + 0.12, 0]], { c: 'acc', w: 1.6 }));
      g.add(K.line([[A[0], top, 0], [A[0], P[a][0][1] + 0.12, 0]], { c: 'acc', w: 1.6 }));
      lab(g, 'x', [(A[0] + B[0]) / 2, top + 1.75, 0], { size: 0.36, c: 'acc' });
      lab(g, 'F(x)', [(A[0] + B[0]) / 2, -top + 0.05, 0], { size: 0.32, o: 0.6 });
      void k;
    });
    return [{ c: 'acc', t: 'Skip connection' }];
  };

  NET.prune = function (p, g) {
    const layers = p.layers || [4, 7, 7, 3], sp = spOf(layers), W = 7.4, s = p.sparsity == null ? 0.8 : +p.sparsity;
    const P = layout(layers, W, sp);
    plates(g, P, sp, 0.08);
    const r = K.rng(31);
    const E = [];
    for (let l = 0; l < P.length - 1; l++) for (let i = 0; i < P[l].length; i++) for (let j = 0; j < P[l + 1].length; j++) E.push({ a: P[l][i], b: P[l + 1][j], l, i, j, w: Math.abs(r.n()) });
    const sorted = E.map((e) => e.w).sort((a, b) => a - b);
    const th = s <= 0 ? -1 : sorted[Math.min(sorted.length - 1, Math.floor(s * sorted.length))];
    const kept = E.filter((e) => e.w >= th), gone = E.filter((e) => e.w < th);
    const wmax = sorted[sorted.length - 1];
    // removed small-magnitude weights: barely-there ghosts
    g.add(K.segs(gone.map((e) => [e.a, e.b]), { o: 0.07 }));
    // surviving large weights: accent, width by magnitude (two strokes only)
    const strong = kept.filter((e) => e.w / wmax >= 0.62), mid = kept.filter((e) => e.w / wmax < 0.62);
    if (mid.length) g.add(K.segs(mid.map((e) => [e.a, e.b]), { c: 'acc', w: 1.6, o: 0.85 }));
    if (strong.length) g.add(K.segs(strong.map((e) => [e.a, e.b]), { c: 'acc', w: 2.8 }));
    const alive = new Set(); kept.forEach((e) => { alive.add(e.l + ':' + e.i); alive.add((e.l + 1) + ':' + e.j); });
    const on = [], off = [];
    P.forEach((col, l) => col.forEach((q, i) => (alive.has(l + ':' + i) ? on : off).push(q)));
    g.add(K.dots(on, { r: 0.1 }));
    if (off.length) g.add(K.dots(off, { r: 0.12, hollow: true, o: 0.4 }));
    // magnitude histogram on the floor-plane below: |w| sorted, cut at the threshold
    const yb = -((Math.max(...layers) - 1) / 2 * sp) - 1.0, NB = 14, Hh = 1.3, bw = W / NB;
    const cnt = new Array(NB).fill(0); E.forEach((e) => { cnt[Math.min(NB - 1, Math.floor(e.w / wmax * NB))]++; });
    const cmax = Math.max(...cnt);
    cnt.forEach((c, b) => {
      if (!c) return;
      const h = Math.max(0.05, c / cmax * Hh), x = -W / 2 + (b + 0.5) * bw, cut = (b + 0.5) * wmax / NB >= th;
      bx(g, x, yb - Hh + h / 2, 0, bw * 0.78, h, 0.3, cut ? BX.acc : { fill: 0.04, o: 0.4 });
    });
    g.add(K.line([[-W / 2 - 0.2, yb - Hh, 0], [W / 2 + 0.2, yb - Hh, 0]], { o: 0.4, w: 1 }));
    if (s > 0) {
      const xt = -W / 2 + th / wmax * W;
      g.add(K.line([[xt, yb - Hh - 0.15, 0], [xt, yb + 0.15, 0]], { c: 'acc', w: 1.6, dash: true }));
      lab(g, 'τ', [xt, yb + 0.42, 0], { size: 0.38, c: 'acc' });
    }
    lab(g, '|w|', [W / 2 + 0.6, yb - Hh, 0], { size: 0.34, o: 0.6 });
    lab(g, (Math.round(s * 100)) + '%', [-W / 2 - 0.7, yb - Hh / 2, 0], { size: 0.34, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Remaining weights' }, { c: 'ink', t: 'Pruned weights' }], ctl: [{ key: 'sparsity', label: 's', min: 0, max: 0.9, step: 0.1, value: s }] };
  };

  NET.ckpt = function (p, g) {
    const layers = p.layers || [3, 4, 4, 4, 4, 4, 3], sp = 0.62, W = 8.4;
    const P = layout(layers, W, sp), L = layers.length;
    const ck = new Set([0, 3, 6]);
    g.add(K.segs(edges(P), { o: 0.16 }));
    P.forEach((col, l) => {
      if (ck.has(l)) g.add(K.dots(col, { r: 0.12, c: 'acc' }));
      else g.add(K.dots(col, { r: 0.12, hollow: true, o: 0.6 }));
    });
    const yb = -((Math.max(...layers) - 1) / 2 * sp) - 0.75;
    // memory slots under checkpointed layers
    P.forEach((col, l) => {
      const x = col[0][0];
      if (ck.has(l)) bx(g, x, yb - 0.35, 0, 0.5, 0.5, 0.5, BX.acc);
      else bx(g, x, yb - 0.35, 0, 0.5, 0.5, 0.5, BX.ghost);
    });
    // recompute arcs: from each checkpoint forward to the dropped layers
    [[0, [1, 2]], [3, [4, 5]]].forEach(([c, ts]) => {
      ts.forEach((t) => {
        const a = [P[c][0][0], yb - 0.75, 0], b = [P[t][0][0], yb - 0.75, 0];
        const pts = bez(a, [(a[0] + b[0]) / 2, yb - 0.75 - 0.5 - 0.35 * (t - c), 0], b);
        g.add(K.line(pts, { o: 0.5, w: 1.2, dash: true }));
        g.add(K.arrow(pts[pts.length - 3], b, { o: 0.5, w: 1.2, head: 0.16 }));
      });
    });
    lab(g, '↻', [P[1][0][0] + 0.7, yb - 1.85, 0], { size: 0.4, o: 0.55 });
    lab(g, '↻', [P[4][0][0] + 0.7, yb - 1.85, 0], { size: 0.4, o: 0.55 });
    void L;
    return [{ c: 'acc', t: 'Stored activations' }, { c: 'ink', t: 'Recomputed activations' }];
  };

  NET.kan = function (p, g) {
    const layers = p.layers || [3, 5, 2], sp = 0.95, W = 6.4;
    const P = layout(layers, W, sp);
    const r = K.rng(17);
    let hero = null;
    for (let l = 0; l < P.length - 1; l++) P[l].forEach((a, i) => P[l + 1].forEach((b, j) => {
      const c1 = r.range(-1, 1), c2 = r.range(-1, 1), c3 = r.range(-0.6, 0.6);
      const d = [b[0] - a[0], b[1] - a[1]], Ld = Math.hypot(d[0], d[1]), nrm = [-d[1] / Ld, d[0] / Ld];
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40, env = Math.sin(Math.PI * t);
        const f = env * (c1 * Math.sin(2 * Math.PI * t) + c2 * Math.sin(3 * Math.PI * t + 1) + c3);
        const amp = 0.22;
        pts.push([a[0] + d[0] * t + nrm[0] * f * amp, a[1] + d[1] * t + nrm[1] * f * amp, f * 0.35]);
      }
      const isHero = l === 0 && i === 0 && j === 1;
      g.add(K.line(pts, { c: 'acc', w: isHero ? 2.6 : 1.4, o: isHero ? 1 : 0.75 }));
      if (isHero) hero = pts;
    }));
    P.forEach((col) => g.add(K.dots(col, { r: 0.11 })));
    P[0].forEach((q, i) => lab(g, 'x' + '₁₂₃'[i], [q[0] - 0.55, q[1], 0], { size: 0.36, o: 0.8 }));
    P[2].forEach((q, i) => lab(g, 'y' + '₁₂'[i], [q[0] + 0.55, q[1], 0], { size: 0.36, o: 0.8 }));
    if (hero) { const m = hero[14]; lab(g, 'φ', [m[0], m[1] + 0.42, m[2]], { size: 0.42, c: 'acc', weight: 600 }); }
    lab(g, 'Σ', [P[1][0][0], P[1][0][1] + 0.5, 0], { size: 0.34, o: 0.55 });
    return [{ c: 'acc', t: 'Learnable edge functions' }];
  };

  NET.circuit = function (p, g) {
    const layers = p.layers || [4, 6, 6, 6, 3], sp = 0.6, W = 8;
    const P = layout(layers, W, sp);
    plates(g, P, sp, 0.07);
    g.add(K.segs(edges(P), { o: 0.07 }));
    const C = [[1], [1, 4], [2], [0, 3], [1]];
    const inC = (l, i) => C[l] && C[l].indexOf(i) >= 0;
    P.forEach((col, l) => g.add(K.dots(col.filter((_, i) => !inC(l, i)), { r: 0.08, o: 0.3 })));
    g.add(K.segs(edges(P, (l, i, j) => inC(l, i) && inC(l + 1, j)), { c: 'acc', w: 2.6 }));
    g.add(K.dots(P.flatMap((col, l) => col.filter((_, i) => inC(l, i))), { r: 0.13, c: 'acc' }));
    // a soft halo around the circuit
    const hp = P.flatMap((col, l) => col.filter((_, i) => inC(l, i)));
    hp.forEach((q) => g.add(K.line(circ(q, 0.26, 'xy', 28), { c: 'acc', o: 0.35, w: 1 })));
    return [{ c: 'acc', t: 'Circuit' }];
  };

  NET.sparse = function (p, g) {
    const layers = p.layers || [4, 12, 4];
    const W = 6.4, spIO = 0.7, spH = 0.46;
    const P = [
      Array.from({ length: layers[0] }, (_, i) => [-W / 2, ((layers[0] - 1) / 2 - i) * spIO, 0]),
      Array.from({ length: layers[1] }, (_, i) => [0, ((layers[1] - 1) / 2 - i) * spH, 0]),
      Array.from({ length: layers[2] }, (_, i) => [W / 2, ((layers[2] - 1) / 2 - i) * spIO, 0]),
    ];
    const act = { 2: 0.9, 7: 1.4, 9: 0.6 };
    const on = (i) => act[i] != null;
    g.add(K.segs(edges(P, (l, i, j) => (l === 0 ? !on(j) : !on(i))), { o: 0.05 }));
    g.add(K.segs(edges(P, (l, i, j) => (l === 0 ? on(j) : on(i))), { o: 0.4 }));
    g.add(K.dots(P[0], { r: 0.1 })); g.add(K.dots(P[2], { r: 0.1 }));
    P[1].forEach((q, i) => {
      if (on(i)) {
        g.add(K.dots([q], { r: 0.13, c: 'acc' }));
        const a = act[i];
        g.add(K.box(q[0] + 0.25 + a * 0.5, q[1], 0, a, 0.2, 0.2, BX.acc));
      } else g.add(K.dots([q], { r: 0.11, hollow: true, o: 0.45 }));
    });
    plates(g, [P[1]], spH, 0.14);
    lab(g, 'x', [-W / 2 - 0.6, 0, 0], { size: 0.42, o: 0.75 });
    lab(g, 'x̂', [W / 2 + 0.6, 0, 0], { size: 0.42, o: 0.75 });
    lab(g, 'f', [0, (layers[1] - 1) / 2 * spH + 0.55, 0], { size: 0.4, c: 'acc' });
    return [{ c: 'acc', t: 'Active features' }, { c: 'ink', t: 'Inactive features' }];
  };

  VIZ.net = wrap(function (p, g) {
    const fn = NET[p.mode] || NET.mlp;
    return fn(p, g);
  }, 0.45);

  /* =====================================================================
     CONV
     ===================================================================== */
  function oplus(g, c, r, o) {
    o = Object.assign({ c: 'acc', w: 2 }, o || {});
    ring(g, c, r, o);
    g.add(K.segs([[[c[0] - r * 0.65, c[1], c[2]], [c[0] + r * 0.65, c[1], c[2]]], [[c[0], c[1] - r * 0.65, c[2]], [c[0], c[1] + r * 0.65, c[2]]]], { c: o.c, w: o.w, o: o.o }));
  }
  function slab(g, x, S, th, n, st) { // feature map: box + channel slices (yz planes)
    bx(g, x, 0, 0, th, S, S, st || BX.ink);
    const pairs = [];
    for (let k = 1; k < n; k++) { const xx = x - th / 2 + th * k / n; pairs.push([[xx, -S / 2, S / 2], [xx, S / 2, S / 2]], [[xx, S / 2, S / 2], [xx, S / 2, -S / 2]]); }
    if (pairs.length) g.add(K.segs(pairs, { o: 0.22 }));
  }
  const CONV = {};
  CONV.conv = function (p, g) {
    const L = [{ S: 3.4, th: 0.12, n: 3, c: '3' }, { S: 2.5, th: 0.45, n: 8, c: '16' }, { S: 1.7, th: 0.8, n: 12, c: '32' }, { S: 1.0, th: 1.2, n: 16, c: '64' }];
    let x = -4.4; const xs = [];
    L.forEach((l, i) => { if (i) x += L[i - 1].th / 2 + 1.25 + l.th / 2; xs.push(x); slab(g, x, l.S, l.th, l.n); lab(g, l.c, [x, -l.S / 2 - 0.45, l.S / 2], { size: 0.32, o: 0.6 }); });
    // flatten + classifier
    const xf = xs[3] + L[3].th / 2 + 1.1, fv = Array.from({ length: 9 }, (_, i) => [xf, (4 - i) * 0.2, 0]);
    g.add(K.dots(fv, { r: 0.06, o: 0.8 }));
    const xo = xf + 1.0, ov = Array.from({ length: 3 }, (_, i) => [xo, (1 - i) * 0.35, 0]);
    g.add(K.segs(fv.flatMap((a) => ov.map((b) => [a, b])), { o: 0.15 }));
    g.add(K.dots(ov, { r: 0.08 }));
    g.add(K.arrow([xs[3] + L[3].th / 2 + 0.15, 0, 0], [xf - 0.2, 0, 0], { o: 0.5, w: 1.2, head: 0.16 }));
    // receptive-field chain (accent): window on layer i -> one cell on layer i+1
    const win = [0.9, 0.8, 0.6], cell = [0.3, 0.3, 0.25];
    let cy = 0.55, cz = 0.5;
    for (let i = 0; i < 3; i++) {
      const xa = xs[i] + L[i].th / 2 + 0.002, xb = xs[i + 1] - L[i + 1].th / 2 - 0.002;
      const w = win[i], c = cell[i];
      const ny = cy * L[i + 1].S / L[i].S * 0.75, nz = cz * L[i + 1].S / L[i].S * 0.75;
      const A = [[xa, cy - w / 2, cz - w / 2], [xa, cy + w / 2, cz - w / 2], [xa, cy + w / 2, cz + w / 2], [xa, cy - w / 2, cz + w / 2]];
      const B = [[xb, ny - c / 2, nz - c / 2], [xb, ny + c / 2, nz - c / 2], [xb, ny + c / 2, nz + c / 2], [xb, ny - c / 2, nz + c / 2]];
      g.add(K.line([...A, A[0]], { c: 'acc', w: 2 }));
      g.add(quad(A[0], A[1], A[2], A[3], { c: 'acc', o: 0.3 }));
      g.add(quad(B[0], B[1], B[2], B[3], { c: 'acc', o: 0.85 }));
      g.add(K.segs(A.map((a, k) => [a, B[k]]), { c: 'acc', o: 0.7 }));
      cy = ny; cz = nz;
    }
    return [{ c: 'acc', t: 'Receptive field' }];
  };

  CONV.kernel = function (p, g) {
    const N = 7, M = 5, cs = 0.62, Y = 2.7;
    const val = (i, j) => clamp(0.5 + 0.5 * Math.tanh((i - j) * 0.9) + 0.15 * Math.sin(i * 1.7 + j), 0, 1);
    const cx = (i, n) => (i - (n - 1) / 2) * cs;
    // input grid
    const gp = [];
    for (let k = 0; k <= N; k++) { const t = (k - N / 2) * cs; gp.push([[t, 0, -N / 2 * cs], [t, 0, N / 2 * cs]], [[-N / 2 * cs, 0, t], [N / 2 * cs, 0, t]]); }
    g.add(K.segs(gp, { o: 0.35 }));
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const v = val(i, j); if (v < 0.08) continue;
      g.add(K.rect(cx(i, N), -0.002, cx(j, N), cs * 0.96, cs * 0.96, 'xz', { fill: 0.03 + 0.15 * v, fc: 'ink', edge: false }));
    }
    // output grid
    const op = [];
    for (let k = 0; k <= M; k++) { const t = (k - M / 2) * cs; op.push([[t, Y, -M / 2 * cs], [t, Y, M / 2 * cs]], [[-M / 2 * cs, Y, t], [M / 2 * cs, Y, t]]); }
    g.add(K.segs(op, { o: 0.4 }));
    const outs = [];
    for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
      let s = 0; for (let di = -1; di <= 1; di++) s += val(a + 1 + di, b + 1 - di) - val(a + 1 - di, b + 1 + di) * 0.2;
      const r = K.rect(cx(a, M), Y, cx(b, M), cs * 0.96, cs * 0.96, 'xz', { fill: 0.06 + 0.2 * clamp(Math.abs(s) / 2, 0, 1), fc: 'ink', edge: false });
      g.add(r); outs.push(r);
    }
    // moving window group
    const win = new T.Group(); g.add(win);
    const w3 = cs * 3, h = w3 / 2;
    win.add(K.rect(0, 0.01, 0, w3, w3, 'xz', { c: 'acc', w: 2.2, fill: 0.28, fc: 'acc' }));
    const sub = []; for (let k = 1; k < 3; k++) { const t = -h + cs * k; sub.push([[t, 0.012, -h], [t, 0.012, h]], [[-h, 0.012, t], [h, 0.012, t]]); }
    win.add(K.segs(sub, { c: 'acc', o: 0.6 }));
    const oc = cs / 2;
    win.add(K.rect(0, Y + 0.01, 0, cs, cs, 'xz', { c: 'acc', w: 2.2, fill: 0.85, fc: 'acc' }));
    const C = [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h]], D = [[-oc, Y, -oc], [oc, Y, -oc], [oc, Y, oc], [-oc, Y, oc]];
    win.add(K.segs(C.map((c, k) => [c, D[k]]), { c: 'acc', o: 0.75, w: 1.4 }));
    win.add(K.label('∗', [h + 0.7, Y * 0.42, h + 0.2], { size: 0.55, c: 'acc' }));
    const place = (idx) => {
      const a = Math.floor(idx / M), b = idx % M;
      win.position.set(cx(a, M), 0, cx(b, M));
      outs.forEach((r, k) => { r.visible = k <= idx; });
    };
    place(7);
    lab(g, 'X', [-N / 2 * cs - 0.5, 0, N / 2 * cs], { size: 0.42, o: 0.7 });
    lab(g, 'Y', [-M / 2 * cs - 0.5, Y, M / 2 * cs], { size: 0.42, o: 0.7 });
    const tick = (t) => { place(Math.floor(((t + 1.68) % 6) / 6 * M * M)); };
    return { legend: [{ c: 'acc', t: 'Kernel window → output' }], tick };
  };

  CONV.pool = function (p, g) {
    const cs = 0.75, r = K.rng(4);
    const V = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => r.int(1, 9)));
    V[0][1] = 9; V[2][3] = 8; V[3][0] = 7; V[1][2] = 6;
    const X0 = -2.4, hb = 0.12;
    const pos = (i, j) => [X0 + (i - 1.5) * cs, (j - 1.5) * cs];
    // floor grid
    const gp = []; for (let k = 0; k <= 4; k++) { const t = (k - 2) * cs; gp.push([[X0 + t, 0, -2 * cs], [X0 + t, 0, 2 * cs]], [[X0 - 2 * cs, 0, t], [X0 + 2 * cs, 0, t]]); }
    g.add(K.segs(gp, { o: 0.3 }));
    g.add(K.segs([[[X0, 0.002, -2 * cs], [X0, 0.002, 2 * cs]], [[X0 - 2 * cs, 0.002, 0], [X0 + 2 * cs, 0.002, 0]]], { o: 0.8, w: 1.8 }));
    const X1 = 2.4, cs2 = 1.0;
    const og = []; for (let k = 0; k <= 2; k++) { const t = (k - 1) * cs2; og.push([[X1 + t, 0, -cs2], [X1 + t, 0, cs2]], [[X1 - cs2, 0, t], [X1 + cs2, 0, t]]); }
    g.add(K.segs(og, { o: 0.45 }));
    for (let bi = 0; bi < 2; bi++) for (let bj = 0; bj < 2; bj++) {
      let mi = 0, mj = 0, mv = -1;
      for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) { const v = V[bi * 2 + di][bj * 2 + dj]; if (v > mv) { mv = v; mi = bi * 2 + di; mj = bj * 2 + dj; } }
      for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) {
        const i = bi * 2 + di, j = bj * 2 + dj, v = V[i][j], [x, z] = pos(i, j), hh = v * hb;
        const isM = i === mi && j === mj;
        bx(g, x, hh / 2, z, cs * 0.62, hh, cs * 0.62, isM ? BX.acc : BX.faint);
      }
      const [x, z] = pos(mi, mj), hh = mv * hb;
      const ox = X1 + (bi - 0.5) * cs2, oz = (bj - 0.5) * cs2;
      bx(g, ox, hh / 2, oz, cs * 0.62, hh, cs * 0.62, BX.acc);
      g.add(K.line([[x, hh, z], [ox, hh, oz]], { c: 'acc', o: 0.55, w: 1.2, dash: true }));
    }
    lab(g, 'max', [0, 1.75, 0], { size: 0.4, c: 'acc' });
    lab(g, '4×4', [X0, -0.45, 2 * cs + 0.4], { size: 0.32, o: 0.55 });
    lab(g, '2×2', [X1, -0.45, cs2 + 0.4], { size: 0.32, o: 0.55 });
    return [{ c: 'acc', t: 'Max in each window' }];
  };

  CONV.resnet = function (p, g) {
    const S = 2.0, th = 0.28, nb = 3, bw = 2.4, gap = 0.9;
    const x0 = -((nb * bw + (nb - 1) * gap) / 2);
    const top = S / 2 + 0.25;
    for (let b = 0; b < nb; b++) {
      const xa = x0 + b * (bw + gap), xb = xa + bw;
      const c1 = xa + 0.55, c2 = xa + 1.45;
      slab(g, c1, S, th, 4); slab(g, c2, S, th, 4);
      g.add(K.arrow([xa, 0, 0], [c1 - th / 2 - 0.02, 0, 0], { o: 0.6, w: 1.2, head: 0.15 }));
      g.add(K.arrow([c1 + th / 2, 0, 0], [c2 - th / 2 - 0.02, 0, 0], { o: 0.6, w: 1.2, head: 0.15 }));
      g.add(K.line([[c2 + th / 2, 0, 0], [xb - 0.2, 0, 0]], { o: 0.6, w: 1.2 }));
      oplus(g, [xb, 0, 0], 0.2);
      if (b < nb - 1) g.add(K.arrow([xb + 0.2, 0, 0], [xb + gap, 0, 0], { o: 0.6, w: 1.2, head: 0.15 }));
      else g.add(K.arrow([xb + 0.2, 0, 0], [xb + 0.9, 0, 0], { o: 0.6, w: 1.2, head: 0.15 }));
      const pts = bez3([xa, 0, 0], [xa, top + 1.0, 0], [xb, top + 1.0, 0], [xb, 0.2, 0], 40);
      g.add(K.line(pts, { c: 'acc', w: 2.4 }));
      g.add(K.dots([[xa, 0, 0]], { r: 0.08, c: 'acc' }));
      if (b === 0) {
        lab(g, 'x', [(xa + xb) / 2, top + 1.05, 0], { size: 0.4, c: 'acc' });
        lab(g, 'F(x)', [(c1 + c2) / 2, -S / 2 - 0.45, S / 2], { size: 0.34, o: 0.6 });
      }
    }
    return [{ c: 'acc', t: 'Skip connection' }];
  };

  CONV.unet = function (p, g) {
    const lv = [{ S: 1.7, th: 0.18 }, { S: 1.25, th: 0.32 }, { S: 0.9, th: 0.5 }, { S: 0.62, th: 0.75 }];
    const yl = (k) => 2.2 - k * 1.45;
    const xe = (k) => -4.4 + k * 1.15, xd = (k) => 4.4 - k * 1.15;
    lv.forEach((l, k) => {
      if (k < 3) {
        bx(g, xe(k), yl(k), 0, l.th, l.S, l.S, BX.ink);
        // decoder: copied (accent) + upsampled (ink) halves
        bx(g, xd(k) - l.th / 2, yl(k), 0, l.th, l.S, l.S, BX.accL);
        bx(g, xd(k) + l.th / 2, yl(k), 0, l.th, l.S, l.S, BX.ink);
        // skip
        g.add(K.arrow([xe(k) + l.th / 2 + 0.05, yl(k), 0], [xd(k) - l.th - 0.05, yl(k), 0], { c: 'acc', w: 2.2, head: 0.24 }));
        // down / up
        const n = lv[k + 1];
        const nx = k + 1 < 3 ? xe(k + 1) : 0;
        g.add(K.arrow([xe(k), yl(k) - l.S / 2 - 0.05, 0], [nx - 0.02, yl(k + 1) + n.S / 2 + 0.06, 0], { o: 0.55, w: 1.2, head: 0.16 }));
        const ux = k + 1 < 3 ? xd(k + 1) + n.th / 2 : 0;
        g.add(K.arrow([ux + 0.02, yl(k + 1) + n.S / 2 + 0.06, 0], [xd(k) + l.th / 2, yl(k) - l.S / 2 - 0.05, 0], { o: 0.55, w: 1.2, head: 0.16 }));
      } else bx(g, 0, yl(k), 0, l.th, l.S, l.S, BX.ink);
    });
    // input image / output mask
    const S0 = lv[0].S;
    g.add(K.rect(-5.6, yl(0), 0, S0, S0, 'yz', { o: 0.6 }));
    g.add(K.arrow([-5.5, yl(0), 0], [xe(0) - lv[0].th / 2 - 0.05, yl(0), 0], { o: 0.55, w: 1.2, head: 0.16 }));
    g.add(K.rect(5.6, yl(0), 0, S0, S0, 'yz', { o: 0.6 }));
    const blob = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = 0.42 + 0.1 * Math.sin(3 * a); blob.push([5.6, yl(0) + rr * Math.sin(a), rr * Math.cos(a) * 1.2]); }
    g.add(K.line(blob, { w: 1.6 }));
    g.add(K.arrow([xd(0) + lv[0].th + 0.05, yl(0), 0], [5.5, yl(0), 0], { o: 0.55, w: 1.2, head: 0.16 }));
    return [{ c: 'acc', t: 'Skip connections' }];
  };

  VIZ.conv = wrap(function (p, g) {
    const fn = CONV[p.kind] || CONV.conv;
    const r = fn(p, g);
    if (p.kind === 'kernel' || p.kind === 'pool') { const o = Array.isArray(r) ? { legend: r } : r; o.rot = p.kind === 'pool' ? 0.5 : 0.1; return o; }
    return r;
  }, 0.45);

  /* =====================================================================
     SEQ
     ===================================================================== */
  function tokBox(g, x, y, z, st, w) { w = w || 0.62; return bx(g, x, y, z, w, w * 0.62, w * 0.62, st || BX.ink); }
  function stateVec(g, x, y, z, vals, c) { // small stacked vector glyph
    const n = vals.length, h = 0.16;
    vals.forEach((v, i) => g.add(K.box(x, y + (i - (n - 1) / 2) * (h + 0.03), z, 0.16, h, 0.16, { fill: 0.2 + 0.7 * v, fc: c || 'acc', c: c || 'acc', o: 0.9 })));
  }
  const SEQ = {};
  SEQ.rnn = function (p, g) {
    const n = 4, sx = 2.6, cw = 1.25, r = K.rng(3);
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx + 0.3);
    xs.forEach((x, i) => {
      bx(g, x, 0, 0, cw, cw, cw, BX.ink);
      lab(g, 'x' + '₁₂₃₄'[i], [x, -2.15, 0], { size: 0.42, o: 0.8 });
      g.add(K.arrow([x, -1.8, 0], [x, -cw / 2 - 0.04, 0], { o: 0.55, w: 1.3, head: 0.18 }));
      g.add(K.arrow([x, cw / 2 + 0.04, 0], [x, 1.75, 0], { o: 0.55, w: 1.3, head: 0.18 }));
      lab(g, 'y' + '₁₂₃₄'[i], [x, 2.08, 0], { size: 0.38, o: 0.6 });
    });
    // the hidden state is handed from step to step (accent)
    const xh0 = xs[0] - sx * 0.8;
    g.add(K.arrow([xh0, 0, 0], [xs[0] - cw / 2 - 0.04, 0, 0], { c: 'acc', w: 3, head: 0.26 }));
    lab(g, 'h₀', [xh0 - 0.4, 0, 0], { size: 0.42, c: 'acc' });
    for (let i = 0; i < n - 1; i++) {
      g.add(K.arrow([xs[i] + cw / 2 + 0.04, 0, 0], [xs[i + 1] - cw / 2 - 0.04, 0, 0], { c: 'acc', w: 3, head: 0.26 }));
      const v = [r(), r(), r(), r()], m = (xs[i] + xs[i + 1]) / 2;
      v.forEach((u, k) => g.add(K.box(m, 0.55 + k * 0.27, 0, 0.24, 0.23, 0.24, { fill: 0.2 + 0.7 * u, fc: 'acc', c: 'acc', o: 0.9 })));
      lab(g, 'h' + '₁₂₃'[i], [m, 1.75, 0], { size: 0.38, c: 'acc' });
    }
    g.add(K.arrow([xs[n - 1] + cw / 2 + 0.04, 0, 0], [xs[n - 1] + sx * 0.7, 0, 0], { c: 'acc', w: 3, head: 0.26, o: 0.5 }));
    return { legend: [{ c: 'acc', t: 'Hidden state' }], rot: 0.42 };
  };

  // small helpers for gated cells
  function xMark(g, c, r, o) { ring(g, c, r, Object.assign({ c: 'acc', w: 1.8 }, o || {})); const d = r * 0.6; g.add(K.segs([[[c[0] - d, c[1] - d, c[2]], [c[0] + d, c[1] + d, c[2]]], [[c[0] - d, c[1] + d, c[2]], [c[0] + d, c[1] - d, c[2]]]], Object.assign({ c: 'acc', w: 1.8 }, o || {}))); }
  function gate(g, x, y, t, showLab, z) { bx(g, x, y, z || 0, 0.58, 0.5, 0.5, BX.ink); if (showLab) lab(g, t, [x, y, (z || 0) + 0.3], { size: 0.4, o: 0.9, weight: 600 }); }

  SEQ.lstm = function (p, g) {
    // two time steps; c (top, accent) runs straight through: × forget, + write; h (bottom) feeds the gates
    const xs = [-2.45, 2.45], cw = 4.3, ch = 3.3, yc = 1.25, yh = -1.35, yg = -0.35;
    g.add(K.line([[-5.3, yc, 0], [5.0, yc, 0]], { c: 'acc', w: 3.2 }));
    g.add(K.arrow([4.9, yc, 0], [5.6, yc, 0], { c: 'acc', w: 3.2, head: 0.28 }));
    xs.forEach((x0, s) => {
      bx(g, x0, 0, 0, cw, ch, 1.1, BX.faint);
      const xf = x0 - 1.45, xi = x0 - 0.65, xg = x0 + 0.15, xo = x0 + 1.05, xp = (xi + xg) / 2, xt = x0 + 1.65;
      const show = s === 1;
      // gates (σ, σ, tanh, σ)
      gate(g, xf, yg, 'f', show); gate(g, xi, yg, 'i', show); gate(g, xg, yg, 'g', show); gate(g, xo, yg, 'o', show);
      // on the cell-state line: forget (×) then write (+)
      xMark(g, [xf, yc, 0], 0.17);
      oplus(g, [xp, yc, 0], 0.17, { w: 1.8 });
      g.add(K.line([[xf, yg + 0.25, 0], [xf, yc - 0.17, 0]], { o: 0.55, w: 1.2 }));
      xMark(g, [xp, yc - 0.75, 0], 0.13, { c: 'ink', o: 0.7, w: 1.3 });
      g.add(K.segs([[[xi, yg + 0.25, 0], [xp - 0.1, yc - 0.85, 0]], [[xg, yg + 0.25, 0], [xp + 0.1, yc - 0.85, 0]], [[xp, yc - 0.62, 0], [xp, yc - 0.17, 0]]], { o: 0.55, w: 1.2 }));
      // output: o × tanh(c) → new h
      xMark(g, [xt, yc - 1.15, 0], 0.13, { c: 'ink', o: 0.7, w: 1.3 });
      g.add(K.segs([[[xt, yc, 0], [xt, yc - 1.02, 0]], [[xo, yg + 0.25, 0], [xt - 0.1, yc - 1.25, 0]]], { o: 0.55, w: 1.2 }));
      g.add(K.dots([[xt, yc, 0]], { r: 0.07, c: 'acc' }));
      if (show) lab(g, 'tanh', [xt + 0.48, yc - 0.6, 0], { size: 0.26, o: 0.6 });
      // h bus into the gates
      const hin = s === 0 ? -5.3 : xs[0] + 1.65 + 0.35;
      g.add(K.line([[hin, yh, 0], [xo, yh, 0]], { w: 1.6, o: 0.75 }));
      g.add(K.segs([xf, xi, xg, xo].map((x) => [[x, yh, 0], [x, yg - 0.25, 0]]), { o: 0.55, w: 1.2 }));
      g.add(K.line([[xt, yc - 1.28, 0], [xt, yh, 0], [s === 0 ? xt + 0.35 : 5.0, yh, 0]], { w: 1.6, o: 0.75 }));
      // input x
      g.add(K.arrow([x0 - 0.25, -2.45, 0], [x0 - 0.25, yh - 0.03, 0], { o: 0.6, w: 1.3, head: 0.16 }));
      lab(g, 'x' + '₁₂'[s], [x0 - 0.25, -2.8, 0], { size: 0.4, o: 0.8 });
    });
    g.add(K.arrow([4.9, yh, 0], [5.6, yh, 0], { w: 1.6, o: 0.75, head: 0.2 }));
    lab(g, 'c', [-5.7, yc, 0], { size: 0.48, c: 'acc', weight: 600 });
    lab(g, 'h', [-5.7, yh, 0], { size: 0.46, o: 0.8 });
    return { legend: [{ c: 'acc', t: 'Cell state' }, { c: 'ink', t: 'Gates' }], rot: 0.5 };
  };

  SEQ.gru = function (p, g) {
    // h (top, accent) is the only state: h' = (1−z)·h + z·h̃ ; r gates how much of h feeds the candidate h̃
    const xs = [-2.35, 2.35], cw = 4.1, ch = 3.3, yh = 1.25, yb = -1.35, yg = -0.35;
    g.add(K.line([[-5.2, yh, 0], [4.9, yh, 0]], { c: 'acc', w: 3.2 }));
    g.add(K.arrow([4.8, yh, 0], [5.5, yh, 0], { c: 'acc', w: 3.2, head: 0.28 }));
    xs.forEach((x0, s) => {
      bx(g, x0, 0, 0, cw, ch, 1.1, BX.faint);
      const xz = x0 - 1.1, xr = x0 - 0.2, xc = x0 + 0.85, xp = xc, show = s === 1;
      gate(g, xz, yg, 'z', show); gate(g, xr, yg, 'r', show); gate(g, xc, yg, 'h̃', show);
      // keep (1−z)·h on the line, then add z·h̃
      xMark(g, [xz, yh, 0], 0.17);
      oplus(g, [xp, yh, 0], 0.17, { w: 1.8 });
      if (show) lab(g, '1−z', [xz - 0.5, yh - 0.45, 0], { size: 0.28, c: 'acc' });
      g.add(K.line([[xz, yg + 0.25, 0], [xz, yh - 0.17, 0]], { o: 0.55, w: 1.2 }));
      xMark(g, [xp, yh - 0.75, 0], 0.13, { c: 'ink', o: 0.7, w: 1.3 });
      g.add(K.segs([[[xc, yg + 0.25, 0], [xp, yh - 0.88, 0]], [[xz + 0.2, yg + 0.25, 0], [xp - 0.12, yh - 0.8, 0]], [[xp, yh - 0.62, 0], [xp, yh - 0.17, 0]]], { o: 0.55, w: 1.2 }));
      // reset gate scales h before it reaches the candidate
      g.add(K.arrow([xr + 0.3, yg, 0], [xc - 0.3, yg, 0], { o: 0.6, w: 1.2, head: 0.13 }));
      // h branches down into a bus that feeds the gates
      const xd = x0 - 1.7;
      g.add(K.line([[xd, yh, 0], [xd, yb, 0], [xc, yb, 0]], { w: 1.4, o: 0.6 }));
      g.add(K.dots([[xd, yh, 0]], { r: 0.07, c: 'acc' }));
      g.add(K.segs([xz, xr, xc].map((x) => [[x, yb, 0], [x, yg - 0.25, 0]]), { o: 0.55, w: 1.2 }));
      g.add(K.arrow([x0 - 0.65, -2.45, 0], [x0 - 0.65, yb - 0.03, 0], { o: 0.6, w: 1.3, head: 0.16 }));
      lab(g, 'x' + '₁₂'[s], [x0 - 0.65, -2.8, 0], { size: 0.4, o: 0.8 });
      // output from the line
      g.add(K.arrow([xp + 0.6, yh, 0], [xp + 0.6, yh + 1.1, 0], { o: 0.5, w: 1.2, head: 0.15 }));
    });
    lab(g, 'h', [-5.6, yh, 0], { size: 0.48, c: 'acc', weight: 600 });
    return { legend: [{ c: 'acc', t: 'Hidden state' }, { c: 'ink', t: 'Gates' }], rot: 0.5 };
  };

  SEQ.bidir = function (p, g) {
    const n = 5, sx = 1.9, cw = 0.7, zf = -0.9, zb = 0.9;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx);
    xs.forEach((x, i) => {
      bx(g, x, 0.6, zf, cw, cw, cw, BX.ink);
      bx(g, x, -0.3, zb, cw, cw, cw, BX.ink);
      const xb = [x, -1.9, 0];
      tokBox(g, x, -1.9, 0, BX.faint, 0.5);
      lab(g, 'x' + '₁₂₃₄₅'[i], [x, -2.4, 0], { size: 0.34, o: 0.7 });
      g.add(K.segs([[[x, -1.75, 0], [x, 0.6 - cw / 2, zf]], [[x, -1.75, 0], [x, -0.3 - cw / 2, zb]]], { o: 0.3 }));
      // concat output
      const yo = 2.1;
      g.add(K.box(x - 0.15, yo, 0, 0.3, 0.3, 0.3, BX.acc));
      g.add(K.box(x + 0.15, yo, 0, 0.3, 0.3, 0.3, BX.b));
      g.add(K.segs([[[x, 0.6 + cw / 2, zf], [x - 0.15, yo - 0.15, 0]], [[x, -0.3 + cw / 2, zb], [x + 0.15, yo - 0.15, 0]]], { o: 0.3 }));
      void xb;
    });
    for (let i = 0; i < n - 1; i++) {
      g.add(K.arrow([xs[i] + cw / 2 + 0.03, 0.6, zf], [xs[i + 1] - cw / 2 - 0.03, 0.6, zf], { c: 'acc', w: 2.4, head: 0.22 }));
      g.add(K.arrow([xs[i + 1] - cw / 2 - 0.03, -0.3, zb], [xs[i] + cw / 2 + 0.03, -0.3, zb], { c: 'b', w: 2.4, head: 0.22 }));
    }
    lab(g, 'h→', [xs[0] - 1.0, 0.6, zf], { size: 0.38, c: 'acc' });
    lab(g, 'h←', [xs[n - 1] + 1.0, -0.3, zb], { size: 0.38, c: 'b' });
    return [{ c: 'acc', t: 'Forward pass' }, { c: 'b', t: 'Backward pass' }];
  };

  SEQ.seq2seq = function (p, g) {
    const ex = [-4.6, -3.3, -2.0], dx = [1.6, 2.9, 4.2, 5.5], cw = 0.75;
    const ein = ['le', 'chat', 'noir'], dout = ['the', 'black', 'cat', '⟨/s⟩'];
    ex.forEach((x, i) => {
      bx(g, x, 0, 0, cw, cw, cw, BX.ink);
      g.add(K.arrow([x, -1.45, 0], [x, -cw / 2 - 0.03, 0], { o: 0.5, w: 1.2, head: 0.15 }));
      lab(g, ein[i], [x, -1.75, 0], { size: 0.34, o: 0.75, mono: true });
      if (i) g.add(K.arrow([ex[i - 1] + cw / 2 + 0.03, 0, 0], [x - cw / 2 - 0.03, 0, 0], { w: 1.6, o: 0.7, head: 0.16 }));
    });
    // context vector
    const cx = -0.2;
    stateVec(g, cx, 0, 0, [0.9, 0.4, 0.7, 0.25, 0.6]);
    lab(g, 'c', [cx, 0.85, 0], { size: 0.44, c: 'acc', weight: 600 });
    g.add(K.arrow([ex[2] + cw / 2 + 0.03, 0, 0], [cx - 0.2, 0, 0], { c: 'acc', w: 2.4, head: 0.2 }));
    g.add(K.arrow([cx + 0.2, 0, 0], [dx[0] - cw / 2 - 0.03, 0, 0], { c: 'acc', w: 2.4, head: 0.2 }));
    dx.forEach((x, i) => {
      bx(g, x, 0, 0, cw, cw, cw, BX.ink);
      g.add(K.arrow([x, cw / 2 + 0.03, 0], [x, 1.35, 0], { o: 0.5, w: 1.2, head: 0.15 }));
      lab(g, dout[i], [x, 1.65, 0], { size: 0.34, o: 0.85, mono: true });
      if (i) {
        g.add(K.arrow([dx[i - 1] + cw / 2 + 0.03, 0, 0], [x - cw / 2 - 0.03, 0, 0], { w: 1.6, o: 0.7, head: 0.16 }));
        // previous output fed back as next input
        const pts = bez3([dx[i - 1] + 0.18, 1.35, 0], [dx[i - 1] + 0.7, 1.2, 0], [x - 0.6, -1.5, 0], [x, -cw / 2 - 0.05, 0], 30);
        g.add(K.line(pts, { o: 0.22, w: 1 }));
      }
    });
    return [{ c: 'acc', t: 'Context vector' }];
  };

  SEQ.ar = function (p, g) {
    const toks = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
    const P0 = 2, rows = toks.length - P0, sx = 1.15, dy = 0.95, dz = -0.55, w = 0.8, hh = 0.42;
    const X = (i) => (i - (toks.length - 1) / 2) * sx;
    const pulses = [];
    for (let s = 0; s < rows; s++) {
      const y = s * dy, z = s * dz, top = s === rows - 1;
      const nIn = P0 + s;
      for (let i = 0; i < nIn; i++) bx(g, X(i), y, z, w, hh, 0.5, BX.ink);
      bx(g, X(nIn), y, z, w, hh, 0.5, BX.acc);
      if (s < rows - 1) {
        const a = [X(nIn), y + hh / 2 + 0.02, z], b = [X(nIn), y + dy - hh / 2 - 0.04, z + dz];
        g.add(K.arrow(a, b, { c: 'acc', w: 2, head: 0.16 }));
        const d = K.dots([[0, 0, 0]], { r: 0.07, c: 'acc' }); d.visible = false; g.add(d); pulses.push({ d, pts: [a, b] });
      }
      if (top) toks.forEach((t, i) => lab(g, t, [X(i), y + 0.6, z], { size: 0.36, mono: true, c: i === nIn ? 'acc' : 'ink', o: i === nIn ? 1 : 0.8 }));
    }
    // causal model arrows on the first row
    lab(g, 'p(xₜ | x<ₜ)', [X(P0) + 1.5, 0, 0], { size: 0.34, c: 'acc' });
    g.add(K.line([[X(0) - 0.7, -0.45, 0.4], [X(toks.length - 1) + 0.6, -0.45, 0.4]], { o: 0 }));
    const tick = (t) => {
      const u = (t % 6) / 6 * (pulses.length + 1);
      pulses.forEach((q, k) => { const f = u - k; q.d.visible = f > 0 && f < 1; if (q.d.visible) setPos(q.d, along(q.pts, f)); });
    };
    return { legend: [{ c: 'acc', t: 'Generated token' }], tick };
  };

  function ssmPic(g, sel) {
    const n = 18, X0 = -4.6, X1 = 4.6, N = 6;
    const X = (t) => X0 + (X1 - X0) * t / (n - 1);
    const r = K.rng(sel ? 12 : 9);
    const xin = Array.from({ length: n }, (_, t) => (t === 2 || t === 7 || t === 12 ? 1 : 0.25 * r.n()));
    if (sel) { xin[4] = 0.7; xin[9] = -0.6; xin[15] = 0.5; xin[10] = 0.02; }
    const keyTok = sel ? new Set([2, 7, 10, 12]) : null;
    const Delta = xin.map((v, t) => (sel ? (keyTok.has(t) ? (t === 10 ? 3.5 : 1.6) : 0.06) : 0.5));
    const lam = Array.from({ length: N }, (_, k) => 0.25 + 0.6 * k / (N - 1));
    const H = lam.map(() => []);
    const hs = lam.map(() => 0);
    for (let t = 0; t < n; t++) lam.forEach((a, k) => {
      const dA = Math.exp(-Delta[t] * a * (sel ? 1.4 : 1)), dB = sel ? Delta[t] * 0.6 : 0.5;
      hs[k] = dA * hs[k] + dB * xin[t] * (k % 2 ? 1 : -0.8);
      H[k].push(hs[k]);
    });
    const yIn = -2.0, yOut = 2.2;
    // input stems
    const stems = [], stemsA = [];
    xin.forEach((v, t) => { const q = [[X(t), yIn, 0], [X(t), yIn + v * 0.9, 0]]; (sel && keyTok.has(t) ? stemsA : stems).push(q); });
    g.add(K.line([[X0 - 0.3, yIn, 0], [X1 + 0.3, yIn, 0]], { o: 0.3, w: 1 }));
    g.add(K.segs(stems, { o: 0.7, w: 1.6 }));
    g.add(K.dots(stems.map((q) => q[1]), { r: 0.06 }));
    if (stemsA.length) { g.add(K.segs(stemsA, { c: 'acc', w: 2.4 })); g.add(K.dots(stemsA.map((q) => q[1]), { r: 0.09, c: 'acc' })); }
    // state ribbon: N channels at different z
    const zs = lam.map((_, k) => -1.3 + 2.6 * k / (N - 1));
    const lines = H.map((hh, k) => hh.map((v, t) => [X(t), v * 0.75, zs[k]]));
    const fine = (pts) => new T.CatmullRomCurve3(pts.map((q) => K.V(...q))).getPoints(n * 6).map((v) => [v.x, v.y, v.z]);
    const L = lines.map(fine);
    L.forEach((pts, k) => g.add(K.line(pts, { c: 'acc', w: k === 0 || k === N - 1 ? 2 : 1.3, o: 0.85 })));
    for (let k = 0; k < N - 1; k++) g.add(ribbon(L[k], L[k + 1], { c: 'acc', o: 0.1 }));
    // cross ribs
    const ribs = []; for (let t = 0; t < n; t++) for (let k = 0; k < N - 1; k++) ribs.push([lines[k][t], lines[k + 1][t]]);
    g.add(K.segs(ribs, { c: 'acc', o: 0.3 }));
    // output
    const yv = H[0].map((_, t) => H.reduce((s, hh, k) => s + hh[t] * (k % 2 ? 0.5 : -0.4), 0));
    const yl = fine(yv.map((v, t) => [X(t), yOut + v * 0.8, 0]));
    g.add(K.line(yl, { w: 1.8 }));
    g.add(K.line([[X0 - 0.3, yOut, 0], [X1 + 0.3, yOut, 0]], { o: 0.3, w: 1 }));
    // B and C couplings at one step
    const tb = 7;
    g.add(K.arrow([X(tb), yIn + 1.0, 0], [X(tb), -0.95, 0], { o: 0.55, w: 1.2, head: 0.16 }));
    g.add(K.arrow([X(tb + 1), 1.0, 0], [X(tb + 1), yOut - 0.35, 0], { o: 0.55, w: 1.2, head: 0.16 }));
    lab(g, sel ? 'B(x)' : 'B', [X(tb) - 0.5, -1.3, 0], { size: 0.32, o: 0.7 });
    lab(g, sel ? 'C(x)' : 'C', [X(tb + 1) + 0.5, 1.45, 0], { size: 0.32, o: 0.7 });
    lab(g, 'A', [X1 + 0.6, 0, 0], { size: 0.38, c: 'acc' });
    lab(g, 'x', [X0 - 0.6, yIn, 0], { size: 0.38, o: 0.7 });
    lab(g, 'h', [X0 - 0.6, 0, 0], { size: 0.4, c: 'acc' });
    lab(g, 'y', [X0 - 0.6, yOut, 0], { size: 0.38, o: 0.7 });
    if (sel) {
      // Δ(x): per-token step size
      const db = [];
      Delta.forEach((d, t) => { db.push([[X(t), -3.0, 0], [X(t), -3.0 + Math.min(d, 1.6) * 0.5, 0]]); });
      g.add(K.segs(db, { o: 0.55, w: 2 }));
      g.add(K.line([[X0 - 0.3, -3.0, 0], [X1 + 0.3, -3.0, 0]], { o: 0.25, w: 1 }));
      lab(g, 'Δ(x)', [X0 - 0.75, -2.85, 0], { size: 0.32, o: 0.7 });
    }
  }
  SEQ.ssm = function (p, g) { ssmPic(g, false); return [{ c: 'acc', t: 'Hidden state h(t)' }]; };
  SEQ.mamba = function (p, g) { ssmPic(g, true); return [{ c: 'acc', t: 'Selected inputs, state' }, { c: 'ink', t: 'Step size Δ' }]; };

  SEQ.rwkv = function (p, g) {
    const n = 8, sx = 1.05, w = 0.6, wd = 0.42;
    const X = (i) => (i - (n - 1) / 2) * sx - 0.6;
    const S = [X(n - 1) + 1.6, 1.4, 0];
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      bx(g, X(i), 0, 0, w, w * 0.6, w * 0.6, last ? BX.ink : BX.faint);
      const d = Math.exp(-wd * (n - 1 - i));
      g.add(K.box(X(i), 0.35 + d * 1.6 / 2, 0, 0.26, d * 1.6, 0.26, BX.acc));
      g.add(K.line(bez([X(i), 0.35 + d * 1.6, 0], [(X(i) + S[0]) / 2, 3.0, 0], [S[0] - 0.3, S[1] + 0.25, 0]), { c: 'acc', o: 0.15 + 0.75 * d, w: 1 + d }));
      if (i < n - 1) g.add(K.arrow([X(i) + w / 2 + 0.02, -0.75, 0], [X(i + 1) - w / 2 - 0.02, -0.75, 0], { o: 0.5, w: 1.2, head: 0.14 }));
      g.add(K.line([[X(i), -0.18, 0], [X(i), -0.75, 0]], { o: 0.25, w: 1 }));
    }
    bx(g, S[0], S[1], 0, 0.6, 0.6, 0.6, BX.ink);
    g.add(K.arrow([X(n - 1) + w / 2 + 0.02, -0.75, 0], [S[0], -0.75, 0], { o: 0.5, w: 1.2, head: 0.14 }));
    g.add(K.line([[S[0], -0.75, 0], [S[0], S[1] - 0.3, 0]], { o: 0.5, w: 1.2 }));
    lab(g, 'wkv', [S[0] + 0.75, S[1], 0], { size: 0.32, o: 0.75 });
    lab(g, 'e⁻ʷᵗ', [X(1), 1.4, 0], { size: 0.38, c: 'acc' });
    lab(g, 'xₜ', [X(n - 1), -0.45, 0.6], { size: 0.32, o: 0.7 });
    lab(g, 'O(n)', [0, -1.2, 0], { size: 0.32, o: 0.55 });
    return [{ c: 'acc', t: 'Time decay' }];
  };

  SEQ.mtp = function (p, g) {
    const toks = ['the', 'cat', 'sat', 'on'], outs = ['the', 'mat', 'with', 'a'];
    const xs = toks.map((_, i) => (i - 1.5) * 1.2);
    xs.forEach((x, i) => { tokBox(g, x, -2.2, 0, BX.faint); lab(g, toks[i], [x, -2.65, 0.3], { size: 0.32, mono: true, o: 0.75 }); g.add(K.line([[x, -2.0, 0], [x, -1.15, 0]], { o: 0.35, w: 1 })); });
    bx(g, 0, -0.35, 0, 5.0, 1.5, 1.2, BX.ink);
    const hx = [-2.4, -0.8, 0.8, 2.4];
    hx.forEach((x, k) => {
      g.add(K.line([[x * 0.6, 0.4, 0], [x, 1.25, 0]], { c: 'acc', w: 2 }));
      bx(g, x, 1.55, 0, 0.9, 0.6, 0.9, BX.accL);
      g.add(K.arrow([x, 1.85, 0], [x, 2.45, 0], { c: 'acc', w: 1.4, head: 0.14 }));
      tokBox(g, x, 2.75, 0, BX.acc, 0.6);
      lab(g, 't+' + (k + 1), [x + 0.68, 2.75, 0], { size: 0.28, c: 'acc' });
      lab(g, outs[k], [x, 3.35, 0], { size: 0.34, mono: true, o: 0.85 });
    });
    return [{ c: 'acc', t: 'Prediction heads' }];
  };

  SEQ.ttt = function (p, g) {
    const n = 4, sx = 2.4;
    const xs = Array.from({ length: n + 1 }, (_, i) => (i - n / 2) * sx);
    const r = K.rng(6);
    const L = [2, 3, 2];
    xs.forEach((x, s) => {
      // mini network = the hidden state W_s
      bx(g, x, 0.6, 0, 1.5, 1.5, 0.6, BX.faint);
      const P = L.map((m, l) => Array.from({ length: m }, (_, i) => [x - 0.45 + 0.45 * l, 0.6 + ((m - 1) / 2 - i) * 0.4, 0]));
      const E = []; for (let l = 0; l < 2; l++) P[l].forEach((a) => P[l + 1].forEach((b) => E.push([a, b, r()])));
      g.add(K.segs(E.filter((e) => e[2] < 0.5).map((e) => [e[0], e[1]]), { o: 0.3 }));
      g.add(K.segs(E.filter((e) => e[2] >= 0.5).map((e) => [e[0], e[1]]), { o: 0.75, w: 1.6 }));
      g.add(K.dots(P.flat(), { r: 0.06 }));
      lab(g, 'W' + '₀₁₂₃₄'[s], [x, 1.7, 0], { size: 0.34, o: 0.7 });
      if (s > 0) {
        tokBox(g, x - sx / 2, -1.6, 0, BX.faint, 0.5);
        lab(g, 'x' + '₁₂₃₄'[s - 1], [x - sx / 2, -2.05, 0], { size: 0.32, o: 0.7 });
        // gradient step on the self-supervised loss of token x_s
        g.add(K.arrow([xs[s - 1] + 0.78, 0.6, 0], [x - 0.78, 0.6, 0], { c: 'acc', w: 2.4, head: 0.2 }));
        g.add(K.line([[x - sx / 2, -1.42, 0], [x - sx / 2, 0.52, 0]], { c: 'acc', w: 1.2, o: 0.6 }));
        if (s === 1) lab(g, '−η∇ℓ', [x - sx / 2, 0.95, 0], { size: 0.32, c: 'acc' });
      }
    });
    return [{ c: 'acc', t: 'Gradient update' }, { c: 'ink', t: 'Hidden state = weights' }];
  };

  VIZ.seq = wrap(function (p, g) {
    const fn = SEQ[p.kind] || SEQ.rnn;
    const r = fn(p, g);
    return r;
  }, 0.45);

  /* =====================================================================
     STACK
     ===================================================================== */
  const STK = {};
  function plateXZ(g, y, w, d, st) { return bx(g, 0, y, 0, w, 0.06, d, st || BX.faint); }
  STK.block = function (p, g) {
    const n = 4, sx = 1.25, xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx);
    const W = n * sx + 0.4, yA = 0.7, yN1 = 1.6, yF = 2.6, yN2 = 3.5, zf = 0.55;
    bx(g, 0, yA, 0, W, 0.8, 1.1, BX.ink);
    // token mixing inside attention
    const mix = []; xs.forEach((a, i) => xs.forEach((b, j) => { if (i !== j) mix.push([[a, yA - 0.35, 0], [b, yA + 0.35, 0]]); }));
    g.add(K.segs(mix, { o: 0.18 }));
    bx(g, 0, yN1, 0, W, 0.12, 1.1, BX.faint);
    bx(g, 0, yN2, 0, W, 0.12, 1.1, BX.faint);
    xs.forEach((x, i) => {
      bx(g, x, yF, 0, 0.8, 0.75, 0.8, BX.ink);
      tokBox(g, x, -0.6, 0, BX.faint, 0.6);
      lab(g, 'x' + '₁₂₃₄'[i], [x, -1.05, 0.35], { size: 0.3, o: 0.65 });
      g.add(K.segs([[[x, -0.42, 0], [x, yA - 0.4, 0]], [[x, yA + 0.4, 0], [x, yN1 - 0.06, 0]], [[x, yN1 + 0.06, 0], [x, yF - 0.38, 0]], [[x, yF + 0.38, 0], [x, yN2 - 0.06, 0]], [[x, yN2 + 0.06, 0], [x, 4.3, 0]]], { o: 0.5, w: 1.2 }));
      // residual bypasses (accent)
      g.add(K.line(bez3([x, 0.0, 0], [x, 0.05, zf + 0.6], [x, yN1 - 0.1, zf + 0.6], [x, yN1, zf]), { c: 'acc', w: 2 }));
      g.add(K.line(bez3([x, yN1 + 0.12, 0], [x, yN1 + 0.2, zf + 0.6], [x, yN2 - 0.1, zf + 0.6], [x, yN2, zf]), { c: 'acc', w: 2 }));
      g.add(K.dots([[x, 0.0, 0], [x, yN1 + 0.12, 0]], { r: 0.06, c: 'acc' }));
      g.add(K.dots([[x, yN1, zf], [x, yN2, zf]], { r: 0.08, c: 'acc' }));
    });
    lab(g, 'MHA', [-W / 2 - 0.65, yA, 0], { size: 0.36, o: 0.75 });
    lab(g, 'FFN', [-W / 2 - 0.65, yF, 0], { size: 0.36, o: 0.75 });
    lab(g, '+ LN', [-W / 2 - 0.65, yN1, 0], { size: 0.3, o: 0.6 });
    lab(g, '+ LN', [-W / 2 - 0.65, yN2, 0], { size: 0.3, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Residual connections' }], rot: 0.3 };
  };

  function tokStack(g, o) { // rows of token nodes with attention edges
    const n = o.n || 5, L = o.L || 4, sx = o.sx || 1.1, dy = o.dy || 1.25, x0 = o.x0 || 0, z = o.z || 0;
    const P = Array.from({ length: L }, (_, l) => Array.from({ length: n }, (_, i) => [x0 + (i - (n - 1) / 2) * sx, l * dy, z]));
    P.forEach((row, l) => { bx(g, x0, l * dy - 0.04, z, n * sx + 0.3, 0.02, 1.1, l ? BX.faint : BX.ghost); });
    const causal = o.causal;
    const E = [];
    for (let l = 0; l < L - 1; l++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!causal || j <= i) E.push([P[l][j], P[l + 1][i], l, i, j]);
    return { P, E };
  }
  STK.encoder = function (p, g, causal) {
    const n = 5, L = 4;
    const { P, E } = tokStack(g, { n, L, causal });
    const tl = L - 2, ti = 2;
    const isT = (e) => e[2] === tl && e[3] === ti;
    g.add(K.segs(E.filter((e) => !isT(e)).map((e) => [e[0], e[1]]), { o: 0.13 }));
    g.add(K.segs(E.filter(isT).map((e) => [e[0], e[1]]), { c: 'acc', w: 2.2 }));
    P.forEach((row, l) => row.forEach((q, i) => {
      const hit = l === tl + 1 && i === ti;
      const src = l === tl && (!causal || i <= ti);
      g.add(K.dots([q], { r: hit ? 0.14 : 0.09, c: hit || src ? 'acc' : 'ink', o: !causal || l === 0 || true ? 1 : 1 }));
    }));
    const toks = causal ? ['the', 'cat', 'sat', 'on', 'the'] : ['[CLS]', 'the', '[MASK]', 'sat', 'down'];
    P[0].forEach((q, i) => lab(g, toks[i], [q[0], -0.5, q[2] + 0.3], { size: 0.3, mono: true, o: 0.75 }));
    if (causal) {
      // masked (future) positions for the target token: ghost dashed links
      for (let j = ti + 1; j < n; j++) g.add(K.line([P[tl][j], P[tl + 1][ti]], { o: 0.25, w: 1, dash: true }));
      const q = P[L - 1][n - 1];
      g.add(K.arrow([q[0], q[1] + 0.12, 0], [q[0] + 0.9, q[1] + 0.9, 0], { o: 0.6, w: 1.2, head: 0.16 }));
      lab(g, 'mat', [q[0] + 1.25, q[1] + 1.1, 0], { size: 0.32, mono: true, o: 0.85 });
    }
    // mask glyph on the side
    const mx = 4.2, my = 1.9, c = 0.24;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const on = !causal || j <= i;
      g.add(K.rect(mx + (j - 2) * c, my + (2 - i) * c, 0, c * 0.9, c * 0.9, 'xy', { edge: false, fill: on ? (i === ti ? 0.7 : 0.25) : 0.03, fc: on && i === ti ? 'acc' : 'ink' }));
    }
    g.add(K.rect(mx, my, 0, c * n, c * n, 'xy', { o: 0.4, w: 1 }));
    return { legend: [{ c: 'acc', t: causal ? 'Causal attention' : 'Bidirectional attention' }], rot: 0.3 };
  };
  STK.decoder = function (p, g) { return STK.encoder(p, g, true); };

  STK.encdec = function (p, g) {
    const n = 4, L = 3, sx = 0.95, dy = 1.3;
    const A = tokStack(g, { n, L, sx, dy, x0: -3.0 });
    const B = tokStack(g, { n, L, sx, dy, x0: 3.0, causal: true });
    g.add(K.segs(A.E.map((e) => [e[0], e[1]]), { o: 0.14 }));
    g.add(K.segs(B.E.map((e) => [e[0], e[1]]), { o: 0.14 }));
    A.P.forEach((row) => g.add(K.dots(row, { r: 0.09 })));
    B.P.forEach((row) => g.add(K.dots(row, { r: 0.09 })));
    // cross-attention: every decoder layer reads the encoder output
    const top = A.P[L - 1];
    for (let l = 1; l < L; l++) {
      const tgt = B.P[l][l === 1 ? 1 : 2];
      top.forEach((q, k) => {
        const pts = bez3(q, [q[0] + 1.2, q[1] + 1.4 + 0.25 * l, -0.6], [tgt[0] - 1.6, tgt[1] + 1.0, -0.6], tgt, 40);
        g.add(K.line(pts, { c: 'acc', w: k === 1 ? 2 : 1.4, o: k === 1 ? 1 : 0.6 }));
      });
      g.add(K.dots([tgt], { r: 0.14, c: 'acc' }));
    }
    g.add(K.dots(top, { r: 0.12, c: 'acc' }));
    ['le', 'chat', 'est', 'noir'].forEach((t, i) => lab(g, t, [A.P[0][i][0], -0.5, 0.3], { size: 0.3, mono: true, o: 0.75 }));
    ['⟨s⟩', 'the', 'cat', 'is'].forEach((t, i) => lab(g, t, [B.P[0][i][0], -0.5, 0.3], { size: 0.3, mono: true, o: 0.75 }));
    return { legend: [{ c: 'acc', t: 'Cross-attention' }], rot: 0.3 };
  };

  STK.prenorm = function (p, g) {
    const col = (x0, pre) => {
      const W = 1.4;
      let y = 0;
      g.add(K.line([[x0, -0.6, 0], [x0, 0, 0]], { o: 0.55, w: 1.4 }));
      for (let b = 0; b < 2; b++) {
        const y0 = y;
        const seq = pre ? ['LN', 'F', '+'] : ['F', '+', 'LN'];
        const ys = [y0 + 0.55, y0 + 1.35, y0 + 2.1];
        seq.forEach((k, i) => {
          const yy = ys[i];
          if (k === 'LN') { bx(g, x0, yy, 0, W, 0.32, 0.8, BX.acc); }
          else if (k === 'F') { bx(g, x0, yy, 0, W, 0.55, 0.8, BX.ink); if (b === 0) lab(g, 'F', [x0 - W / 2 - 0.55, yy, 0.4], { size: 0.34, o: 0.7 }); }
          else oplus(g, [x0, yy, 0], 0.17, { c: 'ink', w: 1.6 });
        });
        // main path
        const pts = [y0, ...ys, y0 + 2.6];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i] + (i === 0 ? 0 : seq[i - 1] === 'F' ? 0.28 : seq[i - 1] === 'LN' ? 0.16 : 0.17);
          const bb = pts[i + 1] - (i === 3 ? 0 : seq[i] === 'F' ? 0.28 : seq[i] === 'LN' ? 0.16 : 0.17);
          if (bb > a) g.add(K.line([[x0, a, 0], [x0, bb, 0]], { o: 0.55, w: 1.4 }));
        }
        // residual bypass to the + node
        const yp = ys[seq.indexOf('+')];
        g.add(K.line([[x0, y0 + 0.1, 0], [x0 + W / 2 + 0.45, y0 + 0.25, 0], [x0 + W / 2 + 0.45, yp, 0], [x0 + 0.17, yp, 0]], { w: 1.6, o: 0.85 }));
        g.add(K.dots([[x0, y0 + 0.1, 0]], { r: 0.06 }));
        y = y0 + 2.6;
      }
      g.add(K.arrow([x0, y, 0], [x0, y + 0.5, 0], { o: 0.55, w: 1.4, head: 0.16 }));
      if (!pre) bx(g, x0, y + 0.0, 0, 0.0001, 0.0001, 0.0001, BX.ghost);
      if (pre) { bx(g, x0, y + 0.85, 0, W, 0.32, 0.8, BX.acc); }
      lab(g, pre ? 'Pre-LN' : 'Post-LN', [x0, -1.05, 0], { size: 0.38, o: 0.85 });
    };
    col(-1.9, false); col(1.9, true);
    lab(g, 'LN', [-1.9 - 1.3, 2.1, 0.4], { size: 0.32, c: 'acc' });
    lab(g, 'LN', [1.9 - 1.3, 0.55, 0.4], { size: 0.32, c: 'acc' });
    return { legend: [{ c: 'acc', t: 'Layer norm placement' }, { c: 'ink', t: 'Residual path' }], rot: 0.3 };
  };

  STK.vit = function (p, g) {
    const np = 3, pp = 4, cs = 0.22, S = np * pp * cs, gapP = 0.12;
    const ix = -4.6, iy = 0.9;
    // image: a simple disc + bar pattern in ink, split into patches with gaps (exploded)
    const patchC = [];
    for (let a = 0; a < np; a++) for (let b = 0; b < np; b++) {
      const cx = ix + (b - 1) * (pp * cs + gapP), cy = iy + (1 - a) * (pp * cs + gapP);
      patchC.push([cx, cy, 0]);
      for (let u = 0; u < pp; u++) for (let v = 0; v < pp; v++) {
        const X = (b * pp + v + 0.5) / (np * pp) - 0.5, Y = (a * pp + u + 0.5) / (np * pp) - 0.5;
        const d = Math.hypot(X + 0.05, Y + 0.08), val = d < 0.3 ? 0.55 : (Y > 0.33 ? 0.25 : 0.04);
        g.add(K.rect(cx + (v - 1.5) * cs, cy + (1.5 - u) * cs, 0, cs * 0.96, cs * 0.96, 'xy', { edge: false, fill: val, fc: 'ink' }));
      }
      g.add(K.rect(cx, cy, 0.01, pp * cs, pp * cs, 'xy', { c: 'acc', w: 1.6 }));
    }
    void S;
    // tokens
    const nt = np * np + 1, tx0 = -1.9, tsx = 0.6, ty = -1.2;
    const tX = (k) => tx0 + k * tsx;
    for (let k = 0; k < nt; k++) {
      g.add(K.box(tX(k), ty, 0, 0.42, 0.42, 0.16, k === 0 ? BX.ink : BX.accL));
      g.add(K.line([[tX(k), ty + 0.24, 0], [tX(k), 0.15, 0]], { o: 0.35, w: 1 }));
    }
    patchC.forEach((c, k) => {
      const t = [tX(k + 1), ty - 0.24, 0];
      g.add(K.line(bez3([c[0], c[1] - pp * cs / 2, 0], [c[0], ty - 1.0, 0.4], [t[0], ty - 1.0, 0.4], t, 30), { c: 'acc', o: 0.45, w: 1.1 }));
    });
    lab(g, 'CLS', [tX(0), ty - 0.55, 0.3], { size: 0.28, o: 0.7, mono: true });
    lab(g, '+ pos', [tX(nt - 1) + 0.9, ty, 0], { size: 0.3, o: 0.6 });
    // encoder
    const ew = (nt - 1) * tsx + 0.8, ecx = tX(0) + (nt - 1) * tsx / 2;
    bx(g, ecx, 1.0, 0, ew, 1.7, 1.2, BX.ink);
    const pairs = []; for (let k = 0; k < nt; k++) for (let j = 0; j < nt; j++) if (k !== j && (k + j) % 3 === 0) pairs.push([[tX(k), 0.3, 0], [tX(j), 1.7, 0]]);
    g.add(K.segs(pairs, { o: 0.12 }));
    lab(g, '×L', [ecx + ew / 2 + 0.4, 1.0, 0], { size: 0.32, o: 0.6 });
    g.add(K.arrow([tX(0), 1.85, 0], [tX(0), 2.75, 0], { w: 1.6, head: 0.18 }));
    lab(g, 'ŷ', [tX(0), 3.05, 0], { size: 0.4 });
    return { legend: [{ c: 'acc', t: 'Patches → tokens' }], rot: 0.35 };
  };

  STK.adapter = function (p, g) {
    const W = 3.6, D = 1.4, ys = [0, 1.9, 3.8];
    g.add(K.line([[0, -0.9, 0], [0, 5.3, 0]], { o: 0.5, w: 1.4 }));
    ys.forEach((y, i) => {
      bx(g, 0, y, 0, W, 0.7, D, { fill: 0.06, o: 0.55 });
      // hatch to read as frozen
      const h = []; for (let k = -4; k <= 4; k++) h.push([[k * 0.4 - 0.25, y - 0.35, D / 2 + 0.001], [k * 0.4 + 0.25, y + 0.35, D / 2 + 0.001]]);
      g.add(K.segs(h.filter((q) => Math.abs(q[0][0]) < W / 2 && Math.abs(q[1][0]) < W / 2), { o: 0.2 }));
      lab(g, 'W' + '₁₂₃'[i], [-W / 2 - 0.45, y, 0], { size: 0.32, o: 0.6 });
      // adapter bottleneck (in series, with its own skip)
      const ya = y + 0.95;
      bx(g, 0, ya - 0.17, 0, 1.3, 0.13, 0.7, BX.acc);
      bx(g, 0, ya, 0, 0.35, 0.13, 0.35, BX.acc);
      bx(g, 0, ya + 0.17, 0, 1.3, 0.13, 0.7, BX.acc);
      g.add(K.line([[0.75, ya - 0.28, 0], [1.05, ya - 0.2, 0], [1.05, ya + 0.2, 0], [0.75, ya + 0.28, 0]], { c: 'acc', w: 1.4 }));
    });
    lab(g, 'r ≪ d', [1.9, ys[2] + 0.95, 0], { size: 0.3, c: 'acc' });
    return { legend: [{ c: 'acc', t: 'Trainable adapters' }, { c: 'ink', t: 'Frozen layers' }], rot: 0.3 };
  };

  STK.hybrid = function (p, g) {
    const kinds = ['M', 'M', 'M', 'A', 'M', 'M', 'M', 'A'], W = 4.4, D = 1.2, dy = 0.85, n = 6;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.7);
    kinds.forEach((k, l) => {
      const y = l * dy;
      if (k === 'A') {
        bx(g, 0, y, 0, W, 0.34, D, BX.accL);
        xs.forEach((a, i) => { if (i > 0) for (let j = 0; j < i; j++) g.add(K.arc([xs[j], y + 0.17, 0], [a, y + 0.17, 0], 0.12 + 0.05 * (i - j), { c: 'acc', o: 0.55, w: 1 })); });
      } else {
        bx(g, 0, y, 0, W, 0.34, D, BX.ink);
        const wv = []; for (let i = 0; i <= 40; i++) { const x = -W / 2 + 0.2 + (W - 0.4) * i / 40; wv.push([x, y + 0.07 * Math.sin(i * 0.8 + l), D / 2 + 0.002]); }
        g.add(K.line(wv, { o: 0.45, w: 1 }));
      }
      lab(g, k === 'A' ? 'Attn' : 'SSM', [-W / 2 - 0.75, y, D / 2], { size: 0.3, o: k === 'A' ? 1 : 0.55, c: k === 'A' ? 'acc' : 'ink' });
    });
    g.add(K.line([[W / 2 + 0.35, -0.2, 0], [W / 2 + 0.35, 7 * dy + 0.2, 0]], { o: 0.0 }));
    lab(g, '1 : 3', [W / 2 + 0.7, 3.5 * dy, 0], { size: 0.32, o: 0.65 });
    return { legend: [{ c: 'acc', t: 'Attention layers' }, { c: 'ink', t: 'Mamba layers' }], rot: 0.3 };
  };

  STK.mod = function (p, g) {
    // at each layer a router picks the top-k tokens: only those pass through the block (accent);
    // the rest skip it on the residual path (faint straight line around the block)
    const toks = ['the', 'cat', 'sat', 'on', 'the', 'mat'], n = toks.length, L = 4, sx = 1.15, dy = 1.5, bh = 0.62, zS = 0.8;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx);
    const proc = [[0, 2, 3], [1, 2, 5], [0, 3, 4], [2, 3, 5]];
    const Y = (l) => 0.5 + l * dy, gapY = (l) => Y(l) - dy / 2; // gap below layer l
    const thru = [], skip = [], stream = [];
    xs.forEach((x) => {
      for (let l = 0; l <= L; l++) { // stream pieces between layers
        const a = l === 0 ? -0.45 : Y(l - 1) + bh / 2 + 0.18, b = l === L ? Y(L - 1) + dy * 0.75 : Y(l) - bh / 2 - 0.18;
        stream.push([[x, a, 0], [x, b, 0]]);
      }
    });
    g.add(K.segs(stream, { o: 0.35, w: 1 }));
    for (let l = 0; l < L; l++) {
      const y = Y(l), ya = y - bh / 2 - 0.18, yb = y + bh / 2 + 0.18;
      bx(g, 0, y, 0, n * sx + 0.25, bh, 0.8, BX.faint);
      xs.forEach((x, i) => {
        if (proc[l].indexOf(i) >= 0) {
          thru.push([[x, ya, 0], [x, y - 0.24, 0]], [[x, y + 0.24, 0], [x, yb, 0]]);
          bx(g, x, y, 0, 0.5, 0.48, 0.48, BX.acc);
        } else {
          skip.push([[x, ya, 0], [x, ya + 0.1, zS]], [[x, ya + 0.1, zS], [x, yb - 0.1, zS]], [[x, yb - 0.1, zS], [x, yb, 0]]);
        }
      });
      void gapY;
    }
    g.add(K.segs(thru, { c: 'acc', w: 2.4 }));
    g.add(K.segs(skip, { o: 0.4, w: 1 }));
    xs.forEach((x) => g.add(K.arrow([x, Y(L - 1) + dy * 0.6, 0], [x, Y(L - 1) + dy * 0.85, 0], { o: 0.45, w: 1, head: 0.14 })));
    xs.forEach((x, i) => { tokBox(g, x, -0.7, 0, BX.ink, 0.62); lab(g, toks[i], [x, -1.2, 0.15], { size: 0.34, mono: true, o: 0.8 }); });
    const xr = -(n * sx) / 2 - 0.85;
    for (let l = 0; l < L; l++) lab(g, 'L' + '₁₂₃₄'[l], [xr, Y(l), 0], { size: 0.32, o: 0.55 });
    lab(g, 'k=3', [(n * sx) / 2 + 0.9, Y(0), 0], { size: 0.32, c: 'acc' });
    return { legend: [{ c: 'acc', t: 'Processed tokens' }, { c: 'ink', t: 'Tokens skipping layer' }], rot: 0.35 };
  };
  STK.nbeats = function (p, g) {
    const nb = 3, bw = 1.2, gap = 1.1, yR = -1.0, yF = 2.4;
    const x0 = -2.4;
    const X = (b) => x0 + b * (bw + gap);
    // history and forecast plots (plane behind)
    const r = K.rng(5);
    const hist = []; for (let i = 0; i <= 40; i++) { const t = i / 40; hist.push([-6.6 + 2.4 * t, 0.55 + 0.45 * Math.sin(t * 9) + 0.25 * t + 0.05 * r.n(), 0]); }
    g.add(K.line(hist, { w: 1.8 }));
    lab(g, 'x', [-6.9, 0.6, 0], { size: 0.4, o: 0.75 });
    g.add(K.line([[-4.0, 0.6, 0], [-4.0, yR, 0], [X(0) - bw / 2 - 0.2, yR, 0]], { o: 0.55, w: 1.4 }));
    for (let b = 0; b < nb; b++) {
      const x = X(b);
      bx(g, x, 0.6, 0, bw, 2.0, 1.0, BX.ink);
      const sl = []; for (let k = 1; k < 4; k++) { const yy = -0.4 + k * 0.5; sl.push([[x - bw / 2, yy, 0.5], [x + bw / 2, yy, 0.5]]); }
      g.add(K.segs(sl, { o: 0.3 }));
      // input from residual bus
      g.add(K.arrow([x - 0.3, yR, 0], [x - 0.3, -0.42, 0], { o: 0.55, w: 1.2, head: 0.14 }));
      // backcast down to ⊖
      const xm = x + bw / 2 + gap / 2;
      g.add(K.line([[x + 0.3, -0.4, 0], [x + 0.3, yR + 0.5, 0], [xm, yR + 0.5, 0], [xm, yR + 0.17, 0]], { o: 0.55, w: 1.2 }));
      ring(g, [xm, yR, 0], 0.17, { w: 1.4, o: 0.8 });
      g.add(K.line([[xm - 0.1, yR, 0], [xm + 0.1, yR, 0]], { w: 1.4 }));
      // forecast up to ⊕
      g.add(K.line([[x, 1.6, 0], [x, yF - 0.17, 0]], { c: 'acc', w: 2 }));
      oplus(g, [x, yF, 0], 0.17, { w: 1.8 });
    }
    g.add(K.line([[X(0) - bw / 2 - 0.2, yR, 0], [X(nb - 1) + bw / 2 + gap / 2 - 0.17, yR, 0]], { o: 0.55, w: 1.4 }));
    for (let b = 0; b < nb - 1; b++) { /* segments between nodes drawn by the bus above */ }
    g.add(K.line([[X(0) + 0.17, yF, 0], [X(nb - 1) - 0.17, yF, 0]], { c: 'acc', w: 2.2 }));
    g.add(K.arrow([X(nb - 1) + 0.17, yF, 0], [X(nb - 1) + 1.2, yF, 0], { c: 'acc', w: 2.2, head: 0.2 }));
    // forecast curve
    const fc = []; for (let i = 0; i <= 24; i++) { const t = i / 24; fc.push([X(nb - 1) + 1.45 + 1.6 * t, yF + 0.45 * Math.sin((1 + t * 0.6) * 9) * 0.8, 0]); }
    g.add(K.line(fc, { c: 'acc', w: 2.4 }));
    lab(g, 'ŷ', [X(nb - 1) + 3.4, yF, 0], { size: 0.42, c: 'acc' });
    lab(g, '−', [X(0) + bw / 2 + gap / 2, yR - 0.45, 0], { size: 0.34, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Forecast' }, { c: 'ink', t: 'Backcast residual' }], rot: 0.3 };
  };

  STK.tft = function (p, g) {
    const n = 6, sx = 1.15, xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx - 0.6);
    // variable selection (per step: 4 input variables -> weights)
    const wv = [0.15, 0.55, 0.1, 0.2];
    xs.forEach((x, t) => {
      wv.forEach((w, k) => {
        const z = -0.6 + k * 0.4, ww = clamp(w + 0.08 * Math.sin(t + k), 0.05, 0.7);
        bx(g, x, -1.9 + ww / 2 * 1.4, z, 0.16, ww * 1.4, 0.16, k === 1 ? BX.acc : BX.faint);
      });
      g.add(K.arrow([x, -1.05, 0], [x, -0.4, 0], { o: 0.45, w: 1.1, head: 0.13 }));
      bx(g, x, 0, 0, 0.6, 0.6, 0.6, BX.ink);
      if (t) g.add(K.arrow([xs[t - 1] + 0.31, 0, 0], [x - 0.31, 0, 0], { o: 0.7, w: 1.4, head: 0.14 }));
      g.add(K.line([[x, 0.31, 0], [x, 1.25, 0]], { o: 0.4, w: 1 }));
    });
    lab(g, 'LSTM', [xs[0] - 0.95, 0, 0], { size: 0.3, o: 0.6 });
    lab(g, 'VSN', [xs[0] - 0.95, -1.6, 0], { size: 0.3, o: 0.6 });
    // attention over time from the last step
    bx(g, (xs[0] + xs[n - 1]) / 2, 1.45, 0, (n - 1) * sx + 0.9, 0.35, 0.9, BX.faint);
    const aw = [0.08, 0.35, 0.1, 0.55, 0.2, 0.3];
    const q = [xs[n - 1], 1.65, 0];
    xs.forEach((x, t) => { if (t < n - 1) g.add(K.arc([x, 1.65, 0], q, 0.4 + 0.15 * (n - t), { c: 'acc', w: 0.8 + 2.6 * aw[t], o: 0.35 + aw[t] })); });
    lab(g, 'α', [xs[3], 2.7, 0], { size: 0.38, c: 'acc' });
    // quantile forecast
    const xf = xs[n - 1] + 0.8;
    const fm = [], fl = [], fh = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20, x = xf + 2.2 * t, m = 1.6 + 0.4 * Math.sin(t * 4); fm.push([x, m, 0]); fl.push([x, m - 0.15 - 0.6 * t, 0]); fh.push([x, m + 0.15 + 0.6 * t, 0]); }
    g.add(ribbon(fh, fl, { o: 0.07 }));
    g.add(K.line(fl, { o: 0.4, w: 1, dash: true })); g.add(K.line(fh, { o: 0.4, w: 1, dash: true }));
    g.add(K.line(fm, { w: 2 }));
    g.add(K.line([[xs[n - 1] + 0.3, 1.45, 0], [xf, 1.6, 0]], { o: 0.4, w: 1 }));
    lab(g, 'q₅₀', [xf + 2.6, fm[20][1], 0], { size: 0.28, o: 0.7 });
    lab(g, 'q₉₀', [xf + 2.6, fh[20][1], 0], { size: 0.28, o: 0.5 });
    return { legend: [{ c: 'acc', t: 'Variable & time weights' }, { c: 'ink', t: 'Quantile forecast' }], rot: 0.35 };
  };

  VIZ.stack = wrap(function (p, g) {
    const fn = STK[p.kind] || STK.block;
    return fn(p, g);
  }, 0.35);

  /* =====================================================================
     ATTN
     ===================================================================== */
  function softmax(a, T0) { const m = Math.max(...a); const e = a.map((v) => Math.exp((v - m) / (T0 || 1))); const s = e.reduce((x, y) => x + y, 0); return e.map((v) => v / s); }
  function attnArcs(g, P, wts, qi, o) {
    o = o || {};
    const grp = new T.Group();
    P.forEach((k, j) => {
      const w = wts[j];
      if (j !== qi) {
        const h = 0.5 + 0.42 * Math.abs(j - qi) * (o.hs || 1);
        grp.add(K.arc([P[qi][0], P[qi][1] + 0.2, P[qi][2]], [k[0], k[1] + 0.2, k[2]], 2 * h, { c: 'acc', w: 0.8 + 4.2 * w, o: 0.3 + 0.7 * Math.min(1, w * 2.2) }));
      }
      if (o.bars !== false) grp.add(K.box(k[0], (o.by || -0.55) - w * 1.4 / 2, k[2] + (o.bz || 0), 0.32, w * 1.4, 0.32, BX.acc));
    });
    grp.add(K.box(P[qi][0], P[qi][1], P[qi][2], 0.72, 0.4, 0.4, BX.acc));
    g.add(grp);
    return grp;
  }
  const ATT = {};
  ATT.self = function (p, g) {
    const toks = ['the', 'cat', 'sat', 'on', 'the', 'mat'], n = toks.length, sx = 1.4;
    const P = toks.map((_, i) => [(i - (n - 1) / 2) * sx, 0, 0]);
    const S = [[3, 1, 0, 0, 0.5, 0], [1.4, 3, 1.5, 0, 0, 0.5], [0.3, 2.6, 1.0, 0.4, 0.2, 1.3], [0, 0.6, 2.2, 1, 0.5, 1.6], [0.6, 0.2, 0.3, 1.2, 1.4, 2.6], [0.3, 1.3, 1.4, 1.6, 1.2, 1.5]];
    // faint all-pairs links
    const all = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = P[i], b = P[j]; const m = [(a[0] + b[0]) / 2, 0.2 + 2 * (0.5 + 0.42 * (j - i)), 0]; bez([a[0], 0.2, 0], m, [b[0], 0.2, 0], 16).forEach((q, k, arr) => { if (k) all.push([arr[k - 1], q]); }); }
    g.add(K.segs(all, { o: 0.07 }));
    P.forEach((q) => bx(g, q[0], q[1], q[2], 0.7, 0.38, 0.38, BX.ink));
    toks.forEach((t, i) => lab(g, t, [P[i][0], 0.0, 0.62], { size: 0.36, mono: true, o: 0.85 }));
    g.add(K.line([[P[0][0] - 0.5, -0.55, 0], [P[n - 1][0] + 0.5, -0.55, 0]], { o: 0.3, w: 1 }));
    const grps = S.map((row, qi) => { const gr = attnArcs(g, P, softmax(row), qi, { by: -0.6 }); gr.visible = qi === 2; return gr; });
    lab(g, 'α', [P[n - 1][0] + 0.8, -1.0, 0], { size: 0.4, c: 'acc' });
    lab(g, 'q', [P[2][0] - 0.55, 0.45, 0], { size: 0.38, c: 'acc' });
    const tick = (t) => { const k = (Math.floor((t + 3) / 1.5) % n); grps.forEach((gr, i) => { gr.visible = i === k; }); };
    return { legend: [{ c: 'acc', t: 'Attention weights' }], tick };
  };

  ATT.multi = function (p, g) {
    // X feeds H heads; each head = its own attention map on its own plane; outputs concatenated, then W^O
    const H = Math.min(p.heads || 4, 6), n = 5, cs = 0.4, S = n * cs, hi = 1;
    const pats = [
      (i, j) => (i === j ? 3.2 : 0),                                // diagonal: itself
      (i, j) => (j === i - 1 || (i === 0 && j === 0) ? 3.4 : 0),    // previous token
      (i, j) => (j === 0 ? 2.8 : 0),                                // first token
      (i, j) => -Math.abs(i - j) * 0.45,                            // broad local window
      (i, j) => (j === n - 1 ? 2.6 : 0),
      (i, j) => ((i + j) % 2 ? 1.5 : 0),
    ];
    const gap = 2.45, yH = 0.9;
    const C = (h) => [(h - (H - 1) / 2) * gap, yH, 0.75 - h * 0.5];
    // input X: a bar above all heads
    const yX = yH + S / 2 + 1.35, xw = (H - 1) * gap + S;
    bx(g, 0, yX, C((H - 1) / 2)[2], xw * 0.55, 0.32, 0.32, BX.ink);
    lab(g, 'X', [-xw * 0.275 - 0.45, yX, C((H - 1) / 2)[2]], { size: 0.46, o: 0.85 });
    // concat bar below, one slot per head
    const yC = yH - S / 2 - 1.5, zC = C((H - 1) / 2)[2] + 0.6, sw = 0.62;
    const slotX = (h) => (h - (H - 1) / 2) * sw;
    for (let h = 0; h < H; h++) {
      const c = C(h), on = h === hi;
      const x0 = c[0] - S / 2, y0 = c[1] + S / 2;
      g.add(quad([x0, c[1] - S / 2, c[2]], [x0 + S, c[1] - S / 2, c[2]], [x0 + S, y0, c[2]], [x0, y0, c[2]], { o: 0.045 }));
      g.add(K.rect(c[0], c[1], c[2], S, S, 'xy', { c: on ? 'acc' : 'ink', o: on ? 0.95 : 0.45, w: on ? 1.8 : 1 }));
      for (let i = 0; i < n; i++) {
        const w = softmax(Array.from({ length: n }, (_, j) => pats[h % pats.length](i, j)));
        for (let j = 0; j < n; j++) {
          if (w[j] < 0.04) continue;
          g.add(K.rect(x0 + (j + 0.5) * cs, y0 - (i + 0.5) * cs, c[2] + 0.01, cs * 0.84, cs * 0.84, 'xy', { edge: false, fill: 0.1 + 0.8 * Math.min(1, w[j] * 1.4), fc: on ? 'acc' : 'ink' }));
        }
      }
      lab(g, 'h' + '₁₂₃₄₅₆'[h], [x0 - 0.32, y0 - 0.15, c[2]], { size: 0.36, c: on ? 'acc' : 'ink', o: on ? 1 : 0.7 });
      g.add(K.arrow([c[0] * 0.55, yX - 0.17, C((H - 1) / 2)[2]], [c[0], y0 + 0.05, c[2]], { o: 0.4, w: 1, head: 0.14 }));
      g.add(K.line([[c[0], c[1] - S / 2 - 0.04, c[2]], [slotX(h), yC + 0.39, zC]], on ? { c: 'acc', w: 2.2 } : { o: 0.4, w: 1 }));
      bx(g, slotX(h), yC, zC, sw * 0.92, 0.75, 0.42, on ? BX.acc : BX.ink);
    }
    // W^O projection and output
    const x1 = slotX(H - 1) + sw / 2, wx = x1 + 1.35;
    g.add(K.arrow([x1 + 0.05, yC, zC], [wx - 0.42, yC, zC], { w: 1.4, o: 0.75, head: 0.16 }));
    bx(g, wx, yC, zC, 0.75, 0.9, 0.75, BX.ink);
    lab(g, 'Wᴼ', [wx, yC + 0.85, zC], { size: 0.42, o: 0.85 });
    g.add(K.arrow([wx + 0.4, yC, zC], [wx + 1.4, yC, zC], { w: 1.6, head: 0.2 }));
    return { legend: [{ c: 'acc', t: 'Per-head attention' }], rot: 0.5 };
  };

  ATT.cross = function (p, g) {
    const enc = ['le', 'chat', 'noir', 'dort'], dec = ['the', 'black', 'cat'], yE = 2.8, yD = 0, sx = 1.5;
    const PE = enc.map((_, i) => [(i - (enc.length - 1) / 2) * sx, yE, 0]);
    const PD = dec.map((_, i) => [(i - (dec.length - 1) / 2) * sx, yD, 0]);
    PE.forEach((q) => bx(g, q[0], q[1], 0, 0.75, 0.4, 0.4, BX.ink));
    PD.forEach((q) => bx(g, q[0], q[1], 0, 0.75, 0.4, 0.4, BX.ink));
    enc.forEach((t, i) => lab(g, t, [PE[i][0], yE + 0.0, 0.62], { size: 0.36, mono: true, o: 0.85 }));
    dec.forEach((t, i) => lab(g, t, [PD[i][0], yD - 0.0, 0.62], { size: 0.36, mono: true, o: 0.85 }));
    const S = [[2.5, 0.3, 0.2, 0.1], [0.2, 0.5, 2.8, 0.2], [0.2, 2.8, 0.6, 0.3]];
    const link = (d, e, o) => K.line(bez3([d[0], d[1] + 0.22, 0], [d[0], d[1] + 1.2, 0.9], [e[0], e[1] - 1.2, 0.9], [e[0], e[1] - 0.22, 0], 30), o);
    PD.forEach((d) => PE.forEach((e) => g.add(link(d, e, { o: 0.08, w: 1 }))));
    const grps = S.map((row, qi) => {
      const w = softmax(row), gr = new T.Group();
      PE.forEach((e, j) => { gr.add(link(PD[qi], e, { c: 'acc', w: 0.8 + 4 * w[j], o: 0.3 + 0.7 * Math.min(1, w[j] * 2) })); gr.add(K.box(e[0], yE + 0.3 + w[j] * 0.8, 0, 0.3, w[j] * 1.6, 0.3, BX.acc)); });
      gr.add(K.box(PD[qi][0], yD, 0, 0.77, 0.42, 0.42, BX.acc));
      gr.visible = qi === 1; g.add(gr); return gr;
    });
    lab(g, 'Q', [PD[dec.length - 1][0] + 1.0, yD, 0], { size: 0.42, c: 'acc' });
    lab(g, 'K, V', [PE[enc.length - 1][0] + 1.15, yE, 0], { size: 0.4, o: 0.75 });
    const tick = (t) => { const k = Math.floor((t + 2) / 2) % 3; grps.forEach((gr, i) => { gr.visible = i === k; }); };
    return { legend: [{ c: 'acc', t: 'Cross-attention weights' }], tick, rot: 0.4 };
  };

  ATT.linear = function (p, g) {
    const n = 8, sx = 0.95, xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx), d = 4, c = 0.36;
    xs.forEach((x) => { bx(g, x, -1.6, 0, 0.5, 0.3, 0.3, BX.ink); });
    // fixed-size state S = Σ φ(k) vᵀ
    const Sy = 1.0, r = K.rng(4);
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) g.add(K.box((b - (d - 1) / 2) * c, Sy + ((d - 1) / 2 - a) * c, 0, c * 0.9, c * 0.9, 0.12, { fill: 0.25 + 0.6 * r(), fc: 'acc', c: 'acc', o: 0.9 }));
    xs.forEach((x) => g.add(K.line(bez([x, -1.42, 0], [x * 0.6, -0.3, 0], [x * 0.08, Sy - d * c / 2 - 0.05, 0], 20), { c: 'acc', o: 0.55, w: 1.3 })));
    // readout for a query
    const qx = xs[n - 1];
    g.add(K.arrow([d * c / 2 + 0.05, Sy, 0], [qx - 0.1, Sy + 1.2, 0], { w: 1.6, head: 0.18 }));
    bx(g, qx, Sy + 1.45, 0, 0.5, 0.3, 0.3, BX.ink);
    lab(g, 'φ(q)ᵀS', [qx, Sy + 1.95, 0], { size: 0.32, o: 0.8 });
    lab(g, 'S = Σ φ(k)vᵀ', [0, Sy + d * c / 2 + 0.45, 0], { size: 0.34, c: 'acc' });
    lab(g, 'd×d', [-d * c / 2 - 0.6, Sy, 0], { size: 0.3, c: 'acc' });
    // ghost of the n×n map it replaces
    const gx = -0.5, gz = -3.0, cc = 0.3, pairs = [];
    for (let k = 0; k <= n; k++) { const t = (k - n / 2) * cc; pairs.push([[gx + t, Sy - n / 2 * cc, gz], [gx + t, Sy + n / 2 * cc, gz]], [[gx - n / 2 * cc, Sy + t, gz], [gx + n / 2 * cc, Sy + t, gz]]); }
    g.add(K.segs(pairs, { o: 0.12 }));
    lab(g, 'n×n', [gx - n / 2 * cc - 0.55, Sy + n / 2 * cc, gz], { size: 0.3, o: 0.4 });
    lab(g, 'O(n)', [xs[0] - 0.9, -1.6, 0], { size: 0.3, o: 0.6 });
    return [{ c: 'acc', t: 'Fixed-size state' }];
  };

  VIZ.attn = wrap(function (p, g) {
    const fn = ATT[p.mode] || ATT.self;
    return fn(p, g);
  }, 0.4);

  /* =====================================================================
     QKV
     ===================================================================== */
  function panel(g, x, y, z, rows, cols, cs, vals, o) {
    o = o || {};
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const v = vals ? vals[i][j] : 0.3;
      g.add(K.rect(x + (j - (cols - 1) / 2) * cs, y + ((rows - 1) / 2 - i) * cs, z, cs * 0.92, cs * 0.92, 'xy', { edge: false, fill: 0.05 + 0.4 * v, fc: o.c || 'ink' }));
    }
    g.add(K.rect(x, y, z, cols * cs, rows * cs, 'xy', { c: o.c, o: o.o || 0.5, w: 1 }));
  }
  VIZ.qkv = wrap(function (p, g) {
    // X -> W_Q, W_K, W_V -> Q, K, V ; QKᵀ/√d -> softmax -> A ; A × V -> Z
    const r = K.rng(9), n = 4, cs = 0.42;
    const M = (rr, cc) => Array.from({ length: rr }, () => Array.from({ length: cc }, () => r()));
    const pw = (c) => c * cs, ph = n * cs;
    const xX = -5.4, xW = -3.55, xP = -1.9, ys = { Q: 2.45, K: 0, V: -2.45 }, sub = { Q: 'q', K: 'k', V: 'v' };
    panel(g, xX, 0, 0, n, 4, cs, M(n, 4));
    lab(g, 'X', [xX, ph / 2 + 0.42, 0], { size: 0.5, o: 0.85, weight: 600 });
    Object.keys(ys).forEach((k) => {
      const y = ys[k];
      g.add(K.line([[xX + pw(4) / 2 + 0.05, 0, 0], [xW - 0.4, y, 0]], { o: 0.4, w: 1.2 }));
      bx(g, xW, y, 0, 0.72, 0.72, 0.72, BX.ink);
      lab(g, 'W' + sub[k], [xW, y + 0.7, 0], { size: 0.34, o: 0.7 });
      g.add(K.arrow([xW + 0.38, y, 0], [xP - pw(3) / 2 - 0.08, y, 0], { o: 0.55, w: 1.3, head: 0.15 }));
      panel(g, xP, y, 0, n, 3, cs, M(n, 3));
      lab(g, k, [xP, y + ph / 2 + 0.38, 0], { size: 0.5, o: 0.9, weight: 600 });
    });
    // raw scores S = QKᵀ/√d (ink) -> softmax -> A (accent)
    const yS = 1.2, xS = 0.65, xA = 3.25;
    const Sm = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1.2 : 0) + 2.2 * r()));
    const Sn = Sm.map((row) => { const lo = Math.min(...row), hi = Math.max(...row); return row.map((v) => (v - lo) / ((hi - lo) || 1)); });
    panel(g, xS, yS, 0, n, n, cs, Sn);
    lab(g, 'QKᵀ/√d', [xS, yS + ph / 2 + 0.4, 0], { size: 0.38, o: 0.85 });
    g.add(K.line([[xP + pw(3) / 2 + 0.05, ys.Q, 0], [xS - ph / 2 - 0.08, yS + 0.45, 0]], { o: 0.45, w: 1.2 }));
    g.add(K.line([[xP + pw(3) / 2 + 0.05, ys.K, 0], [xS - ph / 2 - 0.08, yS - 0.45, 0]], { o: 0.45, w: 1.2 }));
    const A = Sm.map((row) => softmax(row.map((v) => v * 1.6)));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.add(K.rect(xA + (j - (n - 1) / 2) * cs, yS + ((n - 1) / 2 - i) * cs, 0, cs * 0.9, cs * 0.9, 'xy', { edge: false, fill: 0.06 + 0.85 * Math.min(1, A[i][j] * 1.5), fc: 'acc' }));
    }
    g.add(K.rect(xA, yS, 0, ph, ph, 'xy', { c: 'acc', o: 0.85, w: 1.4 }));
    g.add(K.arrow([xS + ph / 2 + 0.08, yS, 0], [xA - ph / 2 - 0.1, yS, 0], { c: 'acc', w: 2, head: 0.18 }));
    lab(g, 'softmax', [xA, yS + ph / 2 + 0.4, 0], { size: 0.38, c: 'acc' });
    // A × V -> Z
    const yM = ys.V, xM = xA;
    g.add(K.arrow([xA, yS - ph / 2 - 0.06, 0], [xM, yM + 0.3, 0], { c: 'acc', w: 2, head: 0.18 }));
    g.add(K.line([[xP + pw(3) / 2 + 0.05, ys.V, 0], [xM - 0.27, yM, 0]], { o: 0.55, w: 1.3 }));
    ring(g, [xM, yM, 0], 0.24, { w: 1.6, o: 0.85 });
    g.add(K.segs([[[xM - 0.12, yM - 0.12, 0], [xM + 0.12, yM + 0.12, 0]], [[xM - 0.12, yM + 0.12, 0], [xM + 0.12, yM - 0.12, 0]]], { w: 1.6, o: 0.85 }));
    const xZ = 5.3;
    g.add(K.arrow([xM + 0.27, yM, 0], [xZ - pw(3) / 2 - 0.1, yM, 0], { c: 'acc', w: 2, head: 0.18 }));
    panel(g, xZ, yM, 0, n, 3, cs, M(n, 3), { c: 'acc', o: 0.8 });
    lab(g, 'Z', [xZ, yM + ph / 2 + 0.4, 0], { size: 0.5, o: 0.9, weight: 600 });
    return { legend: [{ c: 'acc', t: 'Attention weights' }], rot: 0.6 };
  }, 0.35);

  /* =====================================================================
     HEADS (MQA / GQA / MLA)
     ===================================================================== */
  VIZ.heads = wrap(function (p, g) {
    const kind = p.kind || 'gqa', H = 8, sx = 0.85, T0 = 6, cz = 0.42;
    const hx = (h) => (h - (H - 1) / 2) * sx;
    const yQ = 2.6, yKV = 0.9, yC = -0.9;
    for (let h = 0; h < H; h++) bx(g, hx(h), yQ, 0, 0.5, 0.42, 0.42, BX.ink);
    lab(g, 'Q', [hx(0) - 0.75, yQ, 0], { size: 0.42, o: 0.8, weight: 600 });
    // cache floor: ghost of the full multi-head KV cache (H columns × T tokens)
    const ghost = []; for (let h = 0; h <= H; h++) ghost.push([[hx(0) - sx / 2 + h * sx, yC, 0.3], [hx(0) - sx / 2 + h * sx, yC, 0.3 - T0 * cz]]);
    for (let t = 0; t <= T0; t++) ghost.push([[hx(0) - sx / 2, yC, 0.3 - t * cz], [hx(H - 1) + sx / 2, yC, 0.3 - t * cz]]);
    g.add(K.segs(ghost, { o: 0.14 }));
    const cacheCol = (x, w) => { for (let t = 0; t < T0; t++) g.add(K.box(x, yC + 0.09, 0.3 - (t + 0.5) * cz, w, 0.18, cz * 0.82, BX.acc)); };
    let ratio;
    if (kind === 'mla') {
      // latent c: down-projected from h, up-projected into per-head K,V on the fly
      const cy = yKV - 0.25;
      bx(g, 0, cy, 0, 0.9, 0.28, 0.42, BX.acc);
      lab(g, 'c', [0.75, cy, 0], { size: 0.42, c: 'acc', weight: 600 });
      bx(g, -3.9, cy, 0, 0.45, 0.45, 0.45, BX.ink);
      lab(g, 'h', [-4.45, cy, 0], { size: 0.38, o: 0.75 });
      g.add(K.arrow([-3.65, cy, 0], [-0.5, cy, 0], { c: 'acc', w: 2, head: 0.18 }));
      lab(g, 'W↓', [-2.1, cy + 0.32, 0], { size: 0.3, c: 'acc' });
      for (let h = 0; h < H; h++) {
        const x = hx(h), y = yKV + 0.75;
        g.add(K.box(x - 0.11, y, 0, 0.2, 0.32, 0.32, { fill: 0.0, o: 0.45 }));
        g.add(K.box(x + 0.11, y, 0, 0.2, 0.32, 0.32, { fill: 0.0, o: 0.45 }));
        g.add(K.line([[0, cy + 0.14, 0], [x, y - 0.17, 0]], { c: 'acc', o: 0.5, w: 1.1 }));
        g.add(K.line([[x, y + 0.17, 0], [x, yQ - 0.21, 0]], { o: 0.35, w: 1 }));
      }
      lab(g, 'W↑', [hx(H - 1) + 0.8, yKV + 0.2, 0], { size: 0.3, c: 'acc' });
      lab(g, 'K V', [hx(H - 1) + 0.8, yKV + 0.75, 0], { size: 0.3, o: 0.6 });
      cacheCol(0, 0.36);
      g.add(K.line([[0, cy - 0.14, 0], [0, yC + 0.2, 0.3 - 0.2]], { c: 'acc', o: 0.6, w: 1.2, dash: true }));
      ratio = '≈ 1/16';
    } else {
      const G = kind === 'mqa' ? 1 : 2, per = H / G;
      for (let k = 0; k < G; k++) {
        const x = (hx(k * per) + hx(k * per + per - 1)) / 2;
        g.add(K.box(x - 0.24, yKV, 0, 0.42, 0.42, 0.42, BX.acc));
        g.add(K.box(x + 0.24, yKV, 0, 0.42, 0.42, 0.42, BX.accL));
        for (let h = k * per; h < (k + 1) * per; h++) g.add(K.line([[hx(h), yQ - 0.21, 0], [x, yKV + 0.22, 0]], { c: 'acc', w: 1.6, o: 0.85 }));
        cacheCol(x, 0.62);
        g.add(K.line([[x, yKV - 0.22, 0], [x, yC + 0.2, 0.3 - 0.2]], { c: 'acc', o: 0.6, w: 1.2, dash: true }));
        if (k === G - 1) lab(g, 'K V', [x + 0.95, yKV, 0], { size: 0.34, c: 'acc' });
      }
      ratio = G === 1 ? '1/8' : '1/4';
      // group brackets for GQA
      if (G > 1) for (let k = 0; k < G; k++) g.add(K.line([[hx(k * per) - 0.3, yQ + 0.38, 0], [hx(k * per) - 0.3, yQ + 0.48, 0], [hx(k * per + per - 1) + 0.3, yQ + 0.48, 0], [hx(k * per + per - 1) + 0.3, yQ + 0.38, 0]], { o: 0.5, w: 1.2 }));
    }
    lab(g, 'KV', [hx(0) - 0.85, yC, 0.3 - T0 * cz / 2], { size: 0.34, o: 0.7 });
    lab(g, ratio, [hx(H - 1) + 0.95, yC, 0.3 - T0 * cz / 2], { size: 0.36, c: 'acc' });
    return [{ c: 'acc', t: kind === 'mla' ? 'Compressed latent KV' : 'Shared K/V heads' }, { c: 'ink', t: 'Full KV cache' }];
  }, 0.35);

  /* =====================================================================
     POSENC
     ===================================================================== */
  const PE = {};
  PE.sin = function (p, g) {
    const D = 8, X0 = -4.5, X1 = 4.5, NP = 64, ps = 18, A = 0.32;
    const X = (pos) => X0 + (X1 - X0) * pos / NP;
    const ys = Array.from({ length: D }, (_, i) => i * 0.72), zs = Array.from({ length: D }, (_, i) => -i * 0.32);
    const om = (i) => 1.0 / Math.pow(2.1, Math.floor(i / 2));
    const f = (pos, i) => (i % 2 ? Math.cos(pos * om(i)) : Math.sin(pos * om(i))) * A;
    ys.forEach((y, i) => {
      const pts = []; for (let k = 0; k <= 240; k++) { const pos = NP * k / 240; pts.push([X(pos), y + f(pos, i), zs[i]]); }
      g.add(K.line(pts, { w: 1.4, o: 0.7 }));
      g.add(K.line([[X0, y, zs[i]], [X1, y, zs[i]]], { o: 0.1, w: 1 }));
    });
    const xs = X(ps), vec = ys.map((y, i) => [xs, y + f(ps, i), zs[i]]);
    const y0 = -0.6, y1 = ys[D - 1] + 0.6;
    g.add(quad([xs, y0, 0.3], [xs, y0, zs[D - 1] - 0.3], [xs, y1, zs[D - 1] - 0.3], [xs, y1, 0.3], { c: 'acc', o: 0.07 }));
    g.add(K.line([[xs, y0, 0.3], [xs, y0, zs[D - 1] - 0.3], [xs, y1, zs[D - 1] - 0.3], [xs, y1, 0.3], [xs, y0, 0.3]], { c: 'acc', o: 0.45, w: 1 }));
    g.add(K.line(vec, { c: 'acc', w: 2.4 }));
    g.add(K.dots(vec, { r: 0.09, c: 'acc' }));
    lab(g, 'PE(pos)', [xs, y1 + 0.4, zs[D - 1] - 0.3], { size: 0.36, c: 'acc' });
    lab(g, 'pos', [X1 + 0.6, 0, 0], { size: 0.34, o: 0.65 });
    lab(g, 'i', [X0 - 0.5, ys[D - 1] / 2, zs[D / 2]], { size: 0.38, o: 0.65 });
    lab(g, 'sin', [X0 - 0.6, ys[0], zs[0]], { size: 0.28, o: 0.5 });
    lab(g, 'cos', [X0 - 0.6, ys[1], zs[1]], { size: 0.28, o: 0.5 });
    return { legend: [{ c: 'acc', t: 'Encoding of one position' }], rot: 0.4 };
  };

  PE.rope = function (p, g) {
    // top: one 2-D (x₁,x₂) pair of q rotated by m·θ at each position m (positions recede in depth)
    // bottom: two (q at m, k at n) pairs with the same gap n−m → the same angle, whatever the absolute position
    const th = 0.5, a0 = 0.25, NM = 7, R0 = 0.55, sx = 1.32, yT = 1.5;
    const P = (m) => [(m - (NM - 1) / 2) * sx, yT, -m * 0.35];
    const dir = (a) => [Math.cos(a), Math.sin(a)];
    for (let m = 0; m < NM; m++) {
      const c = P(m), a = a0 + m * th, d = dir(a);
      g.add(K.line(circ(c, R0, 'xy', 40), { o: 0.25, w: 1 }));
      g.add(K.line([c, [c[0] + R0 + 0.12, c[1], c[2]]], { o: 0.2, w: 1 }));
      g.add(K.arrow(c, [c[0] + d[0] * R0, c[1] + d[1] * R0, c[2]], { c: 'acc', w: 2, head: 0.14 }));
      if (m) { // swept angle m·θ, faint
        const sw = []; for (let k = 0; k <= 24; k++) { const u = a0 + m * th * k / 24; sw.push([c[0] + Math.cos(u) * R0 * 0.38, c[1] + Math.sin(u) * R0 * 0.38, c[2]]); }
        g.add(K.line(sw, { c: 'acc', o: 0.45, w: 1 }));
      }
    }
    g.add(K.dots(Array.from({ length: NM }, (_, m) => P(m)), { r: 0.05, o: 0.7 }));
    g.add(K.arrow([P(0)[0] - 0.2, yT - R0 - 0.35, P(0)[2]], [P(NM - 1)[0] + 0.5, yT - R0 - 0.35, P(NM - 1)[2] - 0.17], { o: 0.45, w: 1.1, head: 0.16 }));
    lab(g, '0', [P(0)[0], yT - R0 - 0.65, P(0)[2]], { size: 0.3, o: 0.6 });
    lab(g, 'm', [P(NM - 1)[0] + 0.85, yT - R0 - 0.35, P(NM - 1)[2] - 0.2], { size: 0.36, o: 0.7 });
    lab(g, 'mθ', [P(0)[0] - 0.95, yT, P(0)[2]], { size: 0.38, c: 'acc' });
    // bottom: two pairs, both with n − m = 2
    const R1 = 1.05, yB = -1.55, pairs = [[1, 3, -2.3], [4, 6, 2.3]];
    pairs.forEach(([m, n, x]) => {
      const c = [x, yB, 0.6];
      g.add(K.line(circ(c, R1, 'xy', 64), { o: 0.3, w: 1 }));
      g.add(K.line([c, [c[0] + R1 + 0.15, c[1], c[2]]], { o: 0.2, w: 1 }));
      const aq = a0 + m * th, ak = a0 + n * th, dq = dir(aq), dk = dir(ak);
      // relative angle wedge
      const wedge = [c]; for (let k = 0; k <= 30; k++) { const u = aq + (ak - aq) * k / 30; wedge.push([c[0] + Math.cos(u) * R1 * 0.55, c[1] + Math.sin(u) * R1 * 0.55, c[2]]); }
      for (let k = 1; k < wedge.length - 1; k++) g.add(quad(c, wedge[k], wedge[k + 1], wedge[k + 1], { c: 'acc', o: 0.22 }));
      g.add(K.line(wedge.slice(1), { c: 'acc', w: 1.8 }));
      g.add(K.arrow(c, [c[0] + dq[0] * R1, c[1] + dq[1] * R1, c[2]], { c: 'acc', w: 2.6, head: 0.2 }));
      g.add(K.arrow(c, [c[0] + dk[0] * R1, c[1] + dk[1] * R1, c[2]], { w: 2.6, head: 0.2 }));
      lab(g, 'q' + '₀₁₂₃₄₅₆'[m], [c[0] + dq[0] * (R1 + 0.32), c[1] + dq[1] * (R1 + 0.32), c[2]], { size: 0.36, c: 'acc' });
      lab(g, 'k' + '₀₁₂₃₄₅₆'[n], [c[0] + dk[0] * (R1 + 0.32), c[1] + dk[1] * (R1 + 0.32), c[2]], { size: 0.36, o: 0.85 });
      const am = (aq + ak) / 2;
      lab(g, '2θ', [c[0] + Math.cos(am) * R1 * 0.8, c[1] + Math.sin(am) * R1 * 0.8, c[2] + 0.02], { size: 0.3, c: 'acc', weight: 600 });
      // faint drop lines from the dials above to this pair
      g.add(K.line([[P(m)[0], yT - R0, P(m)[2]], [c[0] - 0.35, c[1] + R1 + 0.05, c[2]]], { o: 0.18, w: 1, dash: true }));
      g.add(K.line([[P(n)[0], yT - R0, P(n)[2]], [c[0] + 0.35, c[1] + R1 + 0.05, c[2]]], { o: 0.18, w: 1, dash: true }));
    });
    return { legend: [{ c: 'acc', t: 'Rotated query' }, { c: 'ink', t: 'Rotated key' }], rot: 0.6 };
  };

  PE.interp = function (p, g) {
    const s = p.s == null ? 4 : +p.s, Lw = 2.0, x0 = -4.2, yA = 2.4, yB = 0, om = 2 * Math.PI * 1.5 / Lw, A = 0.3, wy = 0.55;
    const XA = (u) => x0 + u * Lw;
    // trained range: a band through both rows
    g.add(quad([x0, yB - 0.4, 0], [x0 + Lw, yB - 0.4, 0], [x0 + Lw, yA + 1.1, 0], [x0, yA + 1.1, 0], { o: 0.05 }));
    g.add(K.segs([[[x0, yB - 0.4, 0], [x0, yA + 1.1, 0]], [[x0 + Lw, yB - 0.4, 0], [x0 + Lw, yA + 1.1, 0]]], { o: 0.35 }));
    g.add(K.line([[x0, yA, 0], [XA(s) + 0.3, yA, 0]], { o: 0.45, w: 1 }));
    g.add(K.line([[x0, yB, 0], [x0 + Lw + 0.3, yB, 0]], { o: 0.45, w: 1 }));
    const wa = [], wb = [];
    for (let k = 0; k <= 300; k++) { const u = s * k / 300, x = XA(u); (u <= 1 ? wa : wb).push([x, yA + wy + A * Math.sin(om * (x - x0)), 0]); }
    g.add(K.line(wa, { w: 1.8, o: 0.85 }));
    if (wb.length > 1) g.add(K.line([wa[wa.length - 1], ...wb], { w: 1.2, o: 0.35, dash: true }));
    const wi = []; for (let k = 0; k <= 200; k++) { const x = XA(k / 200); wi.push([x, yB + wy + A * Math.sin(om * (x - x0)), 0]); }
    g.add(K.line(wi, { c: 'acc', w: 2.2 }));
    const N = Math.round(s * 6), da = [], db = [], links = [];
    for (let m = 0; m <= N; m++) { const u = m / 6, a = [XA(u), yA, 0], b = [XA(u / s), yB, 0]; da.push(a); db.push(b); links.push([[a[0], a[1] - 0.05, 0], [b[0], b[1] + 0.05, 0]]); }
    g.add(K.segs(links, { c: 'acc', o: 0.35 }));
    g.add(K.dots(da, { r: 0.06, o: 0.7 }));
    g.add(K.dots(db, { r: 0.07, c: 'acc' }));
    lab(g, '0', [x0, yA - 0.35, 0], { size: 0.3, o: 0.55 });
    lab(g, 'L', [x0 + Lw, yA - 0.35, 0], { size: 0.34, o: 0.75 });
    if (s > 1) lab(g, s + 'L', [XA(s), yA - 0.35, 0], { size: 0.34, o: 0.6 });
    lab(g, 'm', [x0 - 0.5, yA, 0], { size: 0.36, o: 0.7 });
    lab(g, 'm/s', [x0 - 0.6, yB, 0], { size: 0.36, c: 'acc' });
    return { legend: [{ c: 'acc', t: 'Interpolated positions' }, { c: 'ink', t: 'Trained range' }], ctl: [{ key: 's', label: 's', min: 1, max: 4, step: 0.5, value: s }], rot: 0.4 };
  };

  VIZ.posenc = wrap(function (p, g) {
    const fn = PE[p.kind] || PE.sin;
    return fn(p, g);
  }, 0.3);

  /* =====================================================================
     MOE — experts on a ring, router below, combine above
     ===================================================================== */
  VIZ.moe = wrap(function (p, g) {
    // bottom → top: token x → router G(x) (one score bar under each expert) → top-k experts → weighted sum → y
    const n = p.n || 8, shared = !!p.shared, focus = p.focus === 'router';
    const kmax = Math.max(1, Math.min(n / 2, 6));
    const k = clamp(Math.round(p.k == null ? 2 : +p.k), 1, kmax);
    const span = shared ? 8.4 : 7.6, ex = span / (n - 1), ew = Math.min(0.7, ex * 0.72), eh = shared ? 1.0 : 1.2;
    const xs0 = shared ? 0.9 : 0; // routed experts shift right to leave room for the shared one
    const EX = Array.from({ length: n }, (_, i) => xs0 + (i - (n - 1) / 2) * ex);
    const yR = focus ? -2.4 : -2.2, yE = focus ? 1.4 : 0.6, yO = yE + eh / 2 + 1.7, zR = 0;
    const barH = focus ? 2.4 : 1.15;
    const toks = ['the', 'cat', 'sat', 'on'], nt = toks.length;
    const r = K.rng(shared ? 41 : 7);
    const logits = toks.map(() => Array.from({ length: n }, () => r.n() * 0.25));
    const pref = [[1, 6, 3, 5, 0, 4], [7, 2, 4, 0, 6, 1], [3, 0, 5, 6, 2, 7], [5, 2, 7, 1, 3, 0]];
    pref.forEach((pl, t) => pl.forEach((e, j) => { const i = Math.floor(e * n / 8) + (n > 8 && j % 2 ? 1 : 0); logits[t][i % n] += 2.6 - j * 0.42; }));
    const probs = logits.map((l) => softmax(l));
    const tops = probs.map((pr) => pr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map((q) => q[1]));

    // ---- scaffold (ink) ----
    // router plate
    const pw = (n - 1) * ex + ew + 0.5, pc = xs0;
    bx(g, pc, yR - 0.06, zR, pw, 0.12, 1.0, { fill: 0.05, o: 0.55 });
    lab(g, 'G(x)', [pc - pw / 2 - 0.75, yR, zR], { size: 0.4, o: 0.85 });
    // experts
    EX.forEach((x) => bx(g, x, yE, 0, ew, eh, ew, focus ? { fill: 0.02, o: 0.25 } : { fill: 0.04, o: 0.45 }));
    if (!focus) g.add(K.segs(EX.map((x) => [[x, yR + 0.02, 0], [x, yE - eh / 2, 0]]), { o: 0.08 }));
    // combine node and output
    oplus(g, [0, yO, 0], 0.24, { c: 'ink', w: 1.6 });
    g.add(K.arrow([0, yO + 0.24, 0], [0, yO + 1.0, 0], { w: 1.6, head: 0.18 }));
    lab(g, 'y', [0.4, yO + 0.85, 0], { size: 0.42 });
    // tokens below the router
    const ty = yR - 1.5, tsx = 1.15;
    const TP = toks.map((_, i) => [(i - (nt - 1) / 2) * tsx + pc, ty, 0]);
    TP.forEach((q, i) => { bx(g, q[0], q[1], q[2], 0.72, 0.36, 0.36, BX.faint); lab(g, toks[i], [q[0], q[1] - 0.5, q[2]], { size: 0.36, mono: true, o: 0.75 }); });
    // shared expert: always on, bypasses the router (blue)
    if (shared) {
      const sx = EX[0] - 1.7;
      bx(g, sx, yE, 0, 0.9, eh + 0.2, 0.9, BX.b);
      g.add(K.line([[pc - pw / 2 - 0.05, yR - 0.9, 0], [sx, yR - 0.9, 0], [sx, yE - eh / 2 - 0.1, 0]], { c: 'b', w: 2.2 }));
      g.add(K.line(bez([sx, yE + eh / 2 + 0.1, 0], [sx, yO, 0], [-0.25, yO, 0], 24), { c: 'b', w: 2.2 }));
    }

    // ---- per-token routing (one token at a time) ----
    const groups = [], pulses = [];
    toks.forEach((_, t) => {
      const gr = new T.Group(); gr.visible = t === 1; g.add(gr); groups.push(gr);
      const tp = TP[t];
      gr.add(K.box(tp[0], tp[1], tp[2], 0.76, 0.4, 0.4, BX.acc));
      const inP = [[tp[0], tp[1] + 0.2, 0], [tp[0], yR - 0.6, 0], [pc, yR - 0.6, 0], [pc, yR - 0.12, 0]];
      gr.add(K.line(inP, { w: 1.6, o: 0.7 }));
      if (shared) gr.add(K.line([[tp[0], yR - 0.6, 0], [tp[0], yR - 0.9, 0], [pc - pw / 2 - 0.05, yR - 0.9, 0]], { c: 'b', w: 1.6, o: 0.8 }));
      const pr = probs[t], top = tops[t], mx = Math.max(...pr);
      const hOf = (v) => Math.max(0.04, v / mx * barH);
      const bwid = Math.min(0.36, ex * 0.5);
      pr.forEach((v, i) => {
        const on = top.indexOf(i) >= 0, h = hOf(v);
        gr.add(K.box(EX[i], yR + h / 2, zR, bwid, h, bwid, on ? BX.acc : (focus ? { fill: 0.12, o: 0.6 } : { fill: 0.06, o: 0.35 })));
        if (focus && on) gr.add(K.label(v.toFixed(2), [EX[i], yR + h + 0.3, zR], { size: 0.3, c: 'acc' }));
      });
      if (focus) { // the top-k cut: k-th largest score
        const kth = pr.slice().sort((a, b) => b - a)[k - 1], hc = hOf(kth) - 0.02;
        gr.add(K.line([[pc - pw / 2, yR + hc, zR], [pc + pw / 2, yR + hc, zR]], { c: 'acc', w: 1.2, dash: true, o: 0.8 }));
        gr.add(K.label('top-' + k, [pc + pw / 2 + 0.7, yR + hc, zR], { size: 0.32, c: 'acc' }));
      }
      const wsum = top.reduce((s, i) => s + pr[i], 0);
      top.forEach((i) => {
        const v = pr[i], h = hOf(v), x = EX[i];
        const disp = [[x, yR + h + (focus ? 0.55 : 0.04), zR], [x, yE - eh / 2 - 0.03, 0]];
        gr.add(K.line(disp, { c: 'acc', w: 2.2 }));
        gr.add(K.box(x, yE, 0, ew + 0.02, eh + 0.02, ew + 0.02, BX.acc));
        const o0 = [x, yE + eh / 2 + 0.03, 0], o1 = [0, yO - 0.24, 0];
        const comb = bez(o0, [x, yO - 0.2, 0], o1, 30);
        gr.add(K.line(comb, { c: 'acc', w: 1.2 + 2.4 * v / wsum, o: 0.85 }));
        const d = K.dots([[0, 0, 0]], { r: 0.075, c: 'acc' }); d.visible = false; gr.add(d);
        pulses.push({ t, d, pts: [...inP, ...disp, ...comb] });
      });
    });
    const per = 6 / nt;
    const tick = (tt) => {
      const u = (tt % 6) / per, cur = (Math.floor(u) + 1) % nt, f = u - Math.floor(u);
      groups.forEach((gr, i) => { gr.visible = i === cur; });
      pulses.forEach((q) => { const on = q.t === cur && f > 0.06 && f < 0.94; q.d.visible = on; if (on) setPos(q.d, along(q.pts, (f - 0.06) / 0.88)); });
    };
    const legend = shared
      ? [{ c: 'acc', t: 'Routed experts (top-k)' }, { c: 'b', t: 'Shared expert' }]
      : focus ? [{ c: 'acc', t: 'Top-k gate scores' }, { c: 'ink', t: 'Gate scores' }] : [{ c: 'acc', t: 'Selected experts (top-k)' }, { c: 'ink', t: 'Idle experts' }];
    return { legend, tick, rot: 0.42, ctl: [{ key: 'k', label: 'k', min: 1, max: kmax, step: 1, value: k }] };
  }, 0.0);
})();
