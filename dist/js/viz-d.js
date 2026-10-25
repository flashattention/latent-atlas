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
    const layers = p.layers || [4, 7, 7, 3], sp = spOf(layers), W = 7.4, s = p.sparsity == null ? 0.6 : +p.sparsity;
    const P = layout(layers, W, sp);
    plates(g, P, sp);
    const r = K.rng(31);
    const E = [];
    for (let l = 0; l < P.length - 1; l++) for (let i = 0; i < P[l].length; i++) for (let j = 0; j < P[l + 1].length; j++) E.push({ a: P[l][i], b: P[l + 1][j], l, i, j, w: Math.abs(r.n()) });
    const sorted = E.map((e) => e.w).sort((a, b) => a - b);
    const th = s <= 0 ? -1 : sorted[Math.min(sorted.length - 1, Math.floor(s * sorted.length))];
    const kept = E.filter((e) => e.w >= th), gone = E.filter((e) => e.w < th);
    g.add(K.segs(gone.map((e) => [e.a, e.b]), { o: 0.06 }));
    const wmax = Math.max(...E.map((e) => e.w));
    [[0, 0.45, 1], [0.45, 0.7, 1.6], [0.7, 1.01, 2.4]].forEach(([lo, hi, w]) => {
      const set = kept.filter((e) => e.w / wmax >= lo && e.w / wmax < hi);
      if (set.length) g.add(K.segs(set.map((e) => [e.a, e.b]), { c: 'acc', w, o: w > 1 ? 0.9 : 0.7 }));
    });
    const alive = new Set(); kept.forEach((e) => { alive.add(e.l + ':' + e.i); alive.add((e.l + 1) + ':' + e.j); });
    const on = [], off = [];
    P.forEach((col, l) => col.forEach((q, i) => (alive.has(l + ':' + i) ? on : off).push(q)));
    g.add(K.dots(on, { r: 0.1 }));
    if (off.length) g.add(K.dots(off, { r: 0.12, hollow: true, o: 0.4 }));
    lab(g, (Math.round(s * 100)) + '%', [0, -((Math.max(...layers) - 1) / 2 * sp + 0.75), 0], { size: 0.34, o: 0.55 });
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
    const n = 5, sx = 2.05, cw = 0.95, r = K.rng(3);
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx);
    xs.forEach((x, i) => {
      bx(g, x, 0, 0, cw, cw, cw, BX.ink);
      lab(g, 'x' + '₁₂₃₄₅'[i], [x, -2.2, 0], { size: 0.38, o: 0.75 });
      g.add(K.arrow([x, -1.85, 0], [x, -cw / 2 - 0.04, 0], { o: 0.55, w: 1.2, head: 0.16 }));
      g.add(K.arrow([x, cw / 2 + 0.04, 0], [x, 1.55, 0], { o: 0.55, w: 1.2, head: 0.16 }));
      lab(g, 'y' + '₁₂₃₄₅'[i], [x, 1.85, 0], { size: 0.34, o: 0.55 });
    });
    // recurrent hidden state (accent)
    const xh0 = xs[0] - sx * 0.85;
    g.add(K.arrow([xh0, 0, 0], [xs[0] - cw / 2 - 0.04, 0, 0], { c: 'acc', w: 2.6, head: 0.22 }));
    lab(g, 'h₀', [xh0 - 0.35, 0, 0], { size: 0.36, c: 'acc' });
    for (let i = 0; i < n - 1; i++) {
      g.add(K.arrow([xs[i] + cw / 2 + 0.04, 0, 0], [xs[i + 1] - cw / 2 - 0.04, 0, 0], { c: 'acc', w: 2.6, head: 0.22 }));
      stateVec(g, (xs[i] + xs[i + 1]) / 2, 0.62, 0, [r(), r(), r(), r()]);
    }
    g.add(K.arrow([xs[n - 1] + cw / 2 + 0.04, 0, 0], [xs[n - 1] + sx * 0.75, 0, 0], { c: 'acc', w: 2.6, head: 0.22, o: 0.5 }));
    lab(g, 'hₜ', [(xs[1] + xs[2]) / 2, 1.3, 0], { size: 0.38, c: 'acc' });
    return [{ c: 'acc', t: 'Hidden state' }];
  };

  function gateCell(g, x, cw, ch, gates, showLab) {
    bx(g, x, 0, 0, cw, ch, 0.9, BX.faint);
    const gx = gates.map((_, k) => x + (k - (gates.length - 1) / 2) * 0.42);
    gx.forEach((xx, k) => {
      bx(g, xx, -0.3, 0, 0.3, 0.3, 0.3, BX.ink);
      if (showLab) lab(g, gates[k], [xx, -0.72, 0.5], { size: 0.32, o: 0.8 });
    });
    return gx;
  }
  SEQ.lstm = function (p, g) {
    const xs = [-3.7, 0, 3.7], cw = 2.3, ch = 2.0, yc = 0.7, yh = -0.7;
    // cell-state highway (accent)
    g.add(K.line([[-5.6, yc, 0], [5.4, yc, 0]], { c: 'acc', w: 3 }));
    g.add(K.arrow([5.0, yc, 0], [5.8, yc, 0], { c: 'acc', w: 3, head: 0.26 }));
    g.add(K.line([[-5.6, yh, 0], [5.4, yh, 0]], { w: 1.4, o: 0.55 }));
    g.add(K.arrow([5.0, yh, 0], [5.8, yh, 0], { w: 1.4, o: 0.55, head: 0.2 }));
    xs.forEach((x, i) => {
      const gx = gateCell(g, x, cw, ch, ['f', 'i', 'g', 'o'], i === 1);
      // × (forget) and + (write) on the highway
      const xm = gx[0], xp = (gx[1] + gx[2]) / 2;
      ring(g, [xm, yc, 0], 0.15, { c: 'acc', w: 1.8 });
      g.add(K.segs([[[xm - 0.09, yc - 0.09, 0], [xm + 0.09, yc + 0.09, 0]], [[xm - 0.09, yc + 0.09, 0], [xm + 0.09, yc - 0.09, 0]]], { c: 'acc', w: 1.8 }));
      oplus(g, [xp, yc, 0], 0.15, { w: 1.8 });
      g.add(K.segs([[[gx[0], -0.15, 0], [xm, yc - 0.15, 0]], [[gx[1], -0.15, 0], [xp, yc - 0.15, 0]], [[gx[2], -0.15, 0], [xp, yc - 0.15, 0]], [[gx[3], -0.15, 0], [gx[3], yh + 0.02, 0]], [[gx[3] + 0.25, yc, 0], [gx[3], yh + 0.02, 0]]], { o: 0.4 }));
      g.add(K.arrow([x, -2.0, 0], [x, -ch / 2 - 0.03, 0], { o: 0.55, w: 1.2, head: 0.16 }));
      lab(g, 'x' + '₁₂₃'[i], [x, -2.35, 0], { size: 0.36, o: 0.75 });
    });
    lab(g, 'c', [-6.0, yc, 0], { size: 0.44, c: 'acc', weight: 600 });
    lab(g, 'h', [-6.0, yh, 0], { size: 0.42, o: 0.7 });
    return [{ c: 'acc', t: 'Cell state' }, { c: 'ink', t: 'Gates' }];
  };

  SEQ.gru = function (p, g) {
    const xs = [-3.6, 0, 3.6], cw = 2.0, ch = 1.9, yc = 0.6;
    g.add(K.line([[-5.4, yc, 0], [5.2, yc, 0]], { c: 'acc', w: 3 }));
    g.add(K.arrow([4.9, yc, 0], [5.7, yc, 0], { c: 'acc', w: 3, head: 0.26 }));
    xs.forEach((x, i) => {
      const gx = gateCell(g, x, cw, ch, ['r', 'z', 'h̃'], i === 1);
      const xm = gx[0] - 0.1, xp = gx[2] + 0.15;
      lab(g, '1−z', [xm, yc + 0.42, 0], { size: 0.26, c: 'acc', o: i === 1 ? 1 : 0 });
      ring(g, [xm, yc, 0], 0.15, { c: 'acc', w: 1.8 });
      g.add(K.segs([[[xm - 0.09, yc - 0.09, 0], [xm + 0.09, yc + 0.09, 0]], [[xm - 0.09, yc + 0.09, 0], [xm + 0.09, yc - 0.09, 0]]], { c: 'acc', w: 1.8 }));
      oplus(g, [xp, yc, 0], 0.15, { w: 1.8 });
      g.add(K.segs([[[gx[1], -0.15, 0], [xm, yc - 0.15, 0]], [[gx[2], -0.15, 0], [xp, yc - 0.15, 0]], [[gx[1], -0.15, 0], [xp - 0.1, yc - 0.12, 0]], [[gx[0], -0.15, 0], [gx[0] - 0.3, yc - 0.02, 0]]], { o: 0.4 }));
      g.add(K.arrow([x, -1.9, 0], [x, -ch / 2 - 0.03, 0], { o: 0.55, w: 1.2, head: 0.16 }));
      lab(g, 'x' + '₁₂₃'[i], [x, -2.25, 0], { size: 0.36, o: 0.75 });
      g.add(K.arrow([xp + 0.35, yc, 0], [xp + 0.35, 1.75, 0], { o: 0.5, w: 1.2, head: 0.16 }));
    });
    lab(g, 'h', [-5.8, yc, 0], { size: 0.44, c: 'acc', weight: 600 });
    return [{ c: 'acc', t: 'Hidden state' }, { c: 'ink', t: 'Gates' }];
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
    const n = 6, L = 4, sx = 0.9, dy = 1.25;
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sx);
    const proc = [[0, 2, 3], [1, 2, 5], [0, 3, 4], [2, 3, 5]];
    for (let l = 0; l < L; l++) {
      const y = l * dy + 0.6;
      // block (only processed tokens enter)
      bx(g, 0, y, 0, n * sx + 0.3, 0.42, 1.0, BX.faint);
      // router score bars
      xs.forEach((x, i) => {
        const on = proc[l].indexOf(i) >= 0;
        if (on) { bx(g, x, y, 0, 0.42, 0.42, 0.42, BX.ink); g.add(K.line([[x, y - dy + 0.22 + (l ? 0 : 0.0), 0], [x, y - 0.21, 0]], { o: 0.6, w: 1.4 })); g.add(K.line([[x, y + 0.21, 0], [x, y + dy - 0.62, 0]], { o: 0.6, w: 1.4 })); }
        else {
          const a = [x, y - dy + 0.62, 0], b = [x, y + dy - 0.62, 0];
          g.add(K.line(bez3(a, [x, y - 0.3, 1.2], [x, y + 0.3, 1.2], b, 30), { c: 'acc', w: 2 }));
        }
      });
      // router glyph
      g.add(K.dots([[-(n * sx) / 2 - 0.55, y, 0]], { r: 0.08, o: 0.7 }));
      lab(g, 'R', [-(n * sx) / 2 - 0.95, y, 0], { size: 0.3, o: 0.6 });
    }
    xs.forEach((x, i) => { tokBox(g, x, -0.4, 0, BX.faint, 0.5); g.add(K.line([[x, -0.25, 0], [x, 0.0, 0]], { o: 0.5, w: 1.2 })); });
    lab(g, 'top-k', [(n * sx) / 2 + 0.8, 0.6, 0], { size: 0.3, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Tokens skipping layer' }, { c: 'ink', t: 'Processed tokens' }], rot: 0.35 };
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
    const H = p.heads || 4, toks = ['the', 'cat', 'sat', 'on', 'the', 'mat'], n = toks.length, sx = 1.25, dz = 1.9, qi = 3;
    const pats = [
      (j) => (j === qi - 1 ? 3 : 0),
      (j) => 0.6,
      (j) => (j === 1 ? 3 : j === 5 ? 1.6 : 0),
      (j) => -Math.abs(j - qi) * 1.2,
      (j) => (j === 0 ? 2.5 : 0),
      (j) => (j === 5 ? 2.5 : 0),
    ];
    const zs = Array.from({ length: H }, (_, h) => -((H - 1) / 2) * dz + h * dz);
    zs.forEach((z, h) => {
      const P = toks.map((_, i) => [(i - (n - 1) / 2) * sx, 0, z]);
      bx(g, 0, -0.25, z, n * sx + 0.2, 0.02, 1.0, BX.ghost);
      P.forEach((q) => bx(g, q[0], q[1], q[2], 0.55, 0.3, 0.3, BX.ink));
      const w = softmax(toks.map((_, j) => pats[h % pats.length](j)));
      attnArcs(g, P, w, qi, { bars: false, hs: 0.8 });
      lab(g, 'h' + '₁₂₃₄₅₆₇₈'[h], [P[0][0] - 0.75, 0, z], { size: 0.32, o: 0.7 });
      // per-head output into concat
      const out = [P[n - 1][0] + 1.3, 0.0, z];
      g.add(K.line([[P[qi][0], 0.2, z], [P[qi][0], 0.2 + 1.1, z], [out[0], 0.2 + 1.1, z], [out[0], 0.15, z]], { o: 0.0001 }));
      g.add(K.box(out[0], 0, z, 0.3, 0.3, 0.3, BX.accL));
      g.add(K.line([[out[0], 0.15, z], [out[0] + 0.7, 0.9, 0]], { o: 0.4, w: 1 }));
    });
    const front = zs[H - 1];
    toks.forEach((t, i) => lab(g, t, [(i - (n - 1) / 2) * sx, -0.5, front + 0.45], { size: 0.3, mono: true, o: 0.8 }));
    const ox = (n - 1) / 2 * sx + 2.0;
    bx(g, ox, 0.9, 0, 0.5, 0.5, H * dz * 0.6, BX.ink);
    lab(g, 'Wᴼ', [ox, 1.5, 0], { size: 0.34, o: 0.75 });
    return [{ c: 'acc', t: 'Per-head attention' }];
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
    const r = K.rng(9), n = 4, cs = 0.3;
    const M = (rr, cc) => Array.from({ length: rr }, () => Array.from({ length: cc }, () => r()));
    const xX = -5.0;
    panel(g, xX, 0, 0, n, 6, cs, M(n, 6));
    lab(g, 'X', [xX, n * cs / 2 + 0.4, 0], { size: 0.44, o: 0.8 });
    const ys = { Q: 1.9, K: 0, V: -1.9 }, xW = -3.0, xP = -1.5, sub = { Q: 'q', K: 'k', V: 'v' };
    Object.keys(ys).forEach((k) => {
      const y = ys[k];
      g.add(K.line([[xX + 0.95, 0, 0], [xW - 0.36, y, 0]], { o: 0.4, w: 1.2 }));
      bx(g, xW, y, 0, 0.6, 0.6, 0.6, BX.ink);
      lab(g, 'W' + sub[k], [xW, y + 0.6, 0], { size: 0.32, o: 0.65 });
      g.add(K.arrow([xW + 0.32, y, 0], [xP - 0.5, y, 0], { o: 0.5, w: 1.2, head: 0.14 }));
      panel(g, xP, y, 0, n, 3, cs, M(n, 3));
      lab(g, k, [xP, y + n * cs / 2 + 0.35, 0], { size: 0.42, o: 0.85, weight: 600 });
    });
    // score matrix: bars extruded towards the viewer (attention weights)
    const sx0 = 1.3, sy0 = 0.95, sc = 0.5;
    const W = Array.from({ length: n }, (_, i) => softmax(Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0) + 2.4 * r())));
    g.add(K.rect(sx0, sy0, 0, n * sc, n * sc, 'xy', { c: 'acc', o: 0.6, w: 1 }));
    for (let i = 0; i < n; i++) {
      const mx = Math.max(...W[i]);
      for (let j = 0; j < n; j++) {
        const v = W[i][j] / mx, h = 0.05 + W[i][j] * 0.9;
        g.add(K.box(sx0 + (j - (n - 1) / 2) * sc, sy0 + ((n - 1) / 2 - i) * sc, h / 2, sc * 0.9, sc * 0.9, h, { fill: 0.08 + 0.75 * v, fc: 'acc', c: 'acc', o: 0.25 + 0.6 * v }));
      }
    }
    g.add(K.line([[xP + 0.5, ys.Q, 0], [sx0 - n * sc / 2 - 0.05, sy0 + 0.4, 0]], { o: 0.4, w: 1.2 }));
    g.add(K.line([[xP + 0.5, ys.K, 0], [sx0 - n * sc / 2 - 0.05, sy0 - 0.4, 0]], { o: 0.4, w: 1.2 }));
    lab(g, 'softmax(QKᵀ/√d)', [sx0, sy0 + n * sc / 2 + 0.45, 0], { size: 0.34, c: 'acc' });
    // output Z = A V
    const xZ = 4.3, yZ = -0.9;
    panel(g, xZ, yZ, 0, n, 3, cs, M(n, 3));
    lab(g, 'Z', [xZ, yZ + n * cs / 2 + 0.4, 0], { size: 0.44, o: 0.85, weight: 600 });
    g.add(K.arrow([sx0 + n * sc / 2 + 0.05, sy0 - 0.3, 0], [xZ - 0.55, yZ + 0.2, 0], { c: 'acc', w: 2, head: 0.18 }));
    g.add(K.line([[xP + 0.5, ys.V, 0], [xZ - 0.55, yZ - 0.2, 0]], { o: 0.4, w: 1.2 }));
    lab(g, '×', [2.9, -1.0, 0], { size: 0.4, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Attention weights' }] };
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
    const n = 12, th = 0.52, R = 1.6, x0 = -4.4, dx = 0.82;
    const X = (m) => x0 + m * dx;
    const tip = (m, r, a) => [X(m), r * Math.cos(m * a), r * Math.sin(m * a)];
    g.add(K.line([[x0 - 0.4, 0, 0], [X(n - 1) + 0.6, 0, 0]], { o: 0.5, w: 1.2 }));
    const hel = []; for (let k = 0; k <= 200; k++) { const m = (n - 1) * k / 200; hel.push(tip(m, R, th)); }
    g.add(K.line(hel, { o: 0.25, w: 1 }));
    const hel2 = []; for (let k = 0; k <= 200; k++) { const m = (n - 1) * k / 200; hel2.push(tip(m, R * 0.5, th / 4)); }
    g.add(K.line(hel2, { o: 0.2, w: 1 }));
    const qm = 2, kn = 7;
    for (let m = 0; m < n; m++) {
      const hi = m === qm || m === kn;
      g.add(K.arrow([X(m), 0, 0], tip(m, R, th), { c: 'acc', w: hi ? 3.2 : 1.5, o: hi ? 1 : 0.5, head: hi ? 0.26 : 0.16 }));
      g.add(K.arrow([X(m), 0, 0], tip(m, R * 0.5, th / 4), { w: 1, o: 0.3, head: 0.1 }));
      if (hi) g.add(K.line(circ([X(m), 0, 0], R, 'yz', 48), { o: 0.22, w: 1 }));
    }
    // angle between q (pos m) and k (pos n): (n−m)θ, drawn in q's plane
    const arc = []; for (let k = 0; k <= 40; k++) { const a = qm * th + (kn - qm) * th * k / 40; arc.push([X(qm), 0.9 * Math.cos(a), 0.9 * Math.sin(a)]); }
    g.add(K.line(arc, { c: 'acc', w: 1.6, dash: true }));
    g.add(K.line([[X(qm), 0, 0], [X(qm), R * Math.cos(kn * th), R * Math.sin(kn * th)]], { c: 'acc', o: 0.4, w: 1, dash: true }));
    lab(g, 'Rₘq', [tip(qm, R, th)[0], tip(qm, R, th)[1] + 0.35, tip(qm, R, th)[2]], { size: 0.34, c: 'acc' });
    lab(g, 'Rₙk', [tip(kn, R, th)[0], tip(kn, R, th)[1] + 0.35, tip(kn, R, th)[2]], { size: 0.34, c: 'acc' });
    lab(g, '(n−m)θ', [X(qm) - 0.2, -1.15, 0.9], { size: 0.32, c: 'acc' });
    lab(g, 'm', [X(qm), -0.35, -0.6], { size: 0.3, o: 0.6 });
    lab(g, 'n', [X(kn), -0.35, -0.6], { size: 0.3, o: 0.6 });
    lab(g, 'pos', [X(n - 1) + 1.0, 0, 0], { size: 0.32, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Rotated query/key pairs' }, { c: 'ink', t: 'Slower frequency pair' }], rot: 0.15 };
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
    const n = p.n || 8, shared = !!p.shared, focus = p.focus === 'router';
    const kmax = Math.max(1, Math.min(n / 2, 6));
    const k = clamp(Math.round(p.k == null ? 2 : +p.k), 1, kmax);
    const R = shared ? 4.3 : 4.2, eh = shared ? 0.85 : 1.1, ew = shared ? 0.42 : 0.7;
    const yE = 0, yR = -2.3, yO = shared ? 2.6 : 2.2, rb = shared ? 1.25 : 1.15;
    const ang = (i) => Math.PI * 2 * i / n + 0.28;
    const EP = Array.from({ length: n }, (_, i) => [R * Math.sin(ang(i)), yE, R * Math.cos(ang(i))]);
    const toks = ['the', 'cat', 'sat', 'on'], nt = toks.length;
    const r = K.rng(shared ? 41 : 7);
    const logits = toks.map(() => Array.from({ length: n }, () => r.n() * 0.15));
    // designed preferences (on an 8-ring) so each token's routes spread around the ring
    const pref = [[1, 6, 3, 5, 0, 4], [7, 2, 4, 0, 6, 1], [3, 0, 5, 6, 2, 7], [5, 2, 7, 1, 3, 0]];
    pref.forEach((pl, t) => pl.forEach((e, j) => { const i = Math.floor(e * n / 8) + (n > 8 && j % 2 ? 1 : 0); logits[t][i % n] += 3.0 - j * 0.5; }));
    const probs = logits.map((l) => softmax(l));
    const tops = probs.map((pr) => pr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map((q) => q[1]));

    // ---- static scaffold (ink) ----
    g.add(K.line(circ([0, yE - eh / 2, 0], R, 'xz', 96), { o: 0.16, w: 1 }));
    EP.forEach((q) => bx(g, q[0], q[1], q[2], ew, eh, ew, focus ? { fill: 0.03, o: 0.28 } : { fill: 0.04, o: 0.4 }));
    // potential routes: faint spokes from the gate ring to every expert
    g.add(K.segs(EP.map((q, i) => [[(rb + 0.25) * Math.sin(ang(i)), yR, (rb + 0.25) * Math.cos(ang(i))], [q[0], q[1] - eh / 2, q[2]]]), { o: 0.12 }));
    // router: a flat disc with its gate ring
    g.add(K.line(circ([0, yR, 0], 0.55, 'xz', 48), { w: 1.6, o: 0.85 }));
    g.add(K.line(circ([0, yR, 0], rb + 0.25, 'xz', 72), { o: 0.15, w: 1 }));
    g.add(quad([-0.39, yR, -0.39], [0.39, yR, -0.39], [0.39, yR, 0.39], [-0.39, yR, 0.39], { o: 0.06 }));
    lab(g, 'G(x)', [-1.75, yR, 0.6], { size: 0.34, o: 0.75 });
    // combine node
    oplus(g, [0, yO, 0], 0.22, { c: 'ink', w: 1.6 });
    g.add(K.arrow([0, yO + 0.22, 0], [0, yO + 1.0, 0], { w: 1.6, head: 0.18 }));
    lab(g, 'y', [0.38, yO + 0.9, 0], { size: 0.4 });
    // token row on the floor in front
    const tz = 0.0, ty = -5.0, tsx = 1.1;
    const TP = toks.map((_, i) => [(i - (nt - 1) / 2) * tsx, ty, tz]);
    TP.forEach((q, i) => { bx(g, q[0], q[1], q[2], 0.66, 0.34, 0.34, BX.faint); lab(g, toks[i], [q[0], q[1] - 0.45, q[2] + 0.15], { size: 0.36, mono: true, o: 0.75 }); });
    // shared expert(s): always on, bypass the router
    if (shared) {
      const sy = 0.6;
      bx(g, 0, sy, 0, 0.95, 1.05, 0.95, BX.b);
      g.add(K.line([[0, yR + 0.02, 0], [0, sy - 0.53, 0]], { c: 'b', w: 2.2 }));
      g.add(K.line([[0, sy + 0.53, 0], [0, yO - 0.22, 0]], { c: 'b', w: 2.2 }));
    }

    // ---- per-token routing (only one visible at a time) ----
    const barH = focus ? 3.2 : 1.6;
    const groups = [], pulses = [];
    toks.forEach((_, t) => {
      const gr = new T.Group(); gr.visible = t === 0; g.add(gr); groups.push(gr);
      const tp = TP[t];
      gr.add(K.box(tp[0], tp[1], tp[2], 0.7, 0.37, 0.37, BX.acc));
      const inP = bez3([tp[0], tp[1] + 0.17, tp[2]], [tp[0], tp[1] + 1.2, tp[2]], [0, yR - 1.2, 0], [0, yR - 0.02, 0], 30);
      gr.add(K.line(inP, { w: 1.6, o: 0.75 }));
      // gate scores as bars on a ring around the router, aligned with their experts
      const pr = probs[t], top = tops[t], mx = Math.max(...pr);
      pr.forEach((v, i) => {
        const a = ang(i), x = rb * Math.sin(a), z = rb * Math.cos(a), h = Math.max(0.03, v / mx * barH * 0.5);
        const on = top.indexOf(i) >= 0;
        gr.add(K.box(x, yR + h / 2, z, focus ? 0.2 : 0.15, h, focus ? 0.2 : 0.15, on ? BX.acc : (focus ? BX.ink : BX.faint)));
        if (focus && on) gr.add(K.label(v.toFixed(2), [x * 1.28, yR + h + 0.28, z * 1.28], { size: 0.28, c: 'acc' }));
      });
      top.forEach((i) => {
        const q = EP[i], a = ang(i), v = pr[i], h = Math.max(0.03, v / mx * barH * 0.5);
        const b0 = [rb * Math.sin(a), yR + h, rb * Math.cos(a)];
        const b1 = [q[0], q[1] - eh / 2 - 0.02, q[2]];
        const disp = bez(b0, [b1[0] * 0.78, b0[1] + 0.15, b1[2] * 0.78], b1, 36);
        const wv = 1.4 + 2.6 * v / mx;
        gr.add(K.line(disp, { c: 'acc', w: wv }));
        gr.add(K.box(q[0], q[1], q[2], ew + 0.02, eh + 0.02, ew + 0.02, BX.acc));
        const o0 = [q[0], q[1] + eh / 2 + 0.02, q[2]], o1 = [0, yO - 0.2, 0];
        const comb = bez3(o0, [q[0], o0[1] + 1.1, q[2]], [q[0] * 0.35, yO + 0.2, q[2] * 0.35], o1, 36);
        gr.add(K.line(comb, { c: 'acc', w: 1.2 + 1.2 * v / mx, o: 0.75 }));
        if (!shared || true) {
          const d = K.dots([[0, 0, 0]], { r: 0.075, c: 'acc' }); d.visible = false; gr.add(d);
          pulses.push({ t, d, pts: [...inP, ...disp, ...comb] });
        }
      });
    });
    const per = 6 / nt;
    const tick = (tt) => {
      const u = (tt % 6) / per, cur = Math.floor(u), f = u - cur;
      groups.forEach((gr, i) => { gr.visible = i === cur; });
      pulses.forEach((q) => { const on = q.t === cur && f > 0.06 && f < 0.94; q.d.visible = on; if (on) setPos(q.d, along(q.pts, (f - 0.06) / 0.88)); });
    };
    const legend = shared
      ? [{ c: 'acc', t: 'Routed experts (top-k)' }, { c: 'b', t: 'Shared expert' }]
      : focus ? [{ c: 'acc', t: 'Top-k gate scores' }, { c: 'ink', t: 'Gate scores' }] : [{ c: 'acc', t: 'Selected experts (top-k)' }, { c: 'ink', t: 'Idle experts' }];
    // tilt the whole figure slightly towards the default camera so the ring opens up
    const outer = new T.Group(); outer.add(g);
    g.quaternion.setFromAxisAngle(new T.Vector3(1.25, 0, -1).normalize(), MOE_TILT);
    return { g: outer, legend, tick, ctl: [{ key: 'k', label: 'k', min: 1, max: kmax, step: 1, value: k }] };
  }, 0.0);
  const MOE_TILT = 0.22;
})();
