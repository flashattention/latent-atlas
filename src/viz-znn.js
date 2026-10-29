/* Latent Atlas — appendix figures for the 'znn' chapter. One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------- grid helpers ---------- */
  // centre of cell (i = column, j = row) of a cols x rows grid of cell size s centred at c, in plane 'xy' or 'xz'
  function cell(c, cols, rows, s, plane, i, j) {
    const u = c[0] + (i - (cols - 1) / 2) * s;
    const v = ((rows - 1) / 2 - j) * s;
    return plane === 'xy' ? [u, c[1] + v, c[2]] : [u, c[1], c[2] - v];
  }
  function grid(c, cols, rows, s, plane, o = {}) {
    const pairs = [], hw = cols * s / 2, hh = rows * s / 2;
    const P = (u, v) => (plane === 'xy' ? [c[0] + u, c[1] + v, c[2]] : [c[0] + u, c[1], c[2] - v]);
    for (let i = 0; i <= cols; i++) { const u = -hw + i * s; pairs.push([P(u, -hh), P(u, hh)]); }
    for (let j = 0; j <= rows; j++) { const v = -hh + j * s; pairs.push([P(-hw, v), P(hw, v)]); }
    return K.segs(pairs, { c: o.c, o: o.o == null ? 0.35 : o.o, w: o.w });
  }
  function fillCell(c, cols, rows, s, plane, i, j, o = {}) {
    const p = cell(c, cols, rows, s, plane, i, j), k = o.k == null ? 0.9 : o.k;
    return K.rect(p[0], p[1], p[2], s * k, s * k, plane, { fill: o.fill == null ? 0.5 : o.fill, c: o.c, fc: o.fc, edge: false });
  }
  // outline of a block of cells (i0..i1, j0..j1 inclusive)
  function block(c, cols, rows, s, plane, i0, j0, i1, j1, o = {}) {
    const a = cell(c, cols, rows, s, plane, i0, j0), b = cell(c, cols, rows, s, plane, i1, j1);
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, cz = (a[2] + b[2]) / 2;
    const w = (i1 - i0 + 1) * s, h = (j1 - j0 + 1) * s;
    return K.rect(cx, cy, cz, w, h, plane, { c: o.c, o: o.o, w: o.w == null ? 2 : o.w, fill: o.fill, fc: o.fc });
  }
  function blockCorners(c, cols, rows, s, plane, i0, j0, i1, j1) {
    const a = cell(c, cols, rows, s, plane, i0, j0), b = cell(c, cols, rows, s, plane, i1, j1);
    const h = s / 2;
    if (plane === 'xy') return [[a[0] - h, a[1] + h, a[2]], [b[0] + h, a[1] + h, a[2]], [b[0] + h, b[1] - h, a[2]], [a[0] - h, b[1] - h, a[2]]];
    return [[a[0] - h, a[1], a[2] - h], [b[0] + h, a[1], a[2] - h], [b[0] + h, a[1], b[2] + h], [a[0] - h, a[1], b[2] + h]];
  }
  const LBL = (g, t, p, o = {}) => g.add(K.label(t, p, Object.assign({ size: 0.36, o: 0.8 }, o)));

  /* ---------- figures ---------- */
  const B = {};

  B.activation = function (p, g) {
    const fns = {
      relu: (z) => Math.max(0, z),
      sigmoid: (z) => 1 / (1 + Math.exp(-z)),
      tanh: (z) => Math.tanh(z),
      gelu: (z) => 0.5 * z * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z))),
    };
    const names = { relu: 'ReLU', sigmoid: 'σ', tanh: 'tanh', gelu: 'GELU' };
    const sel = fns[p.f] ? p.f : 'relu';
    // neuron: inputs -> Σ
    const sx = -3.2, sy = 0.4;
    const ins = [[-5.2, 1.6, 0], [-5.2, 0.4, 0], [-5.2, -0.8, 0]];
    ins.forEach((q) => g.add(K.line([q, [sx - 0.25, sy, 0]], { o: 0.4, w: 1 })));
    g.add(K.dots(ins, { r: 0.1 }));
    g.add(K.dots([[sx, sy, 0]], { r: 0.25, hollow: true }));
    LBL(g, 'Σ', [sx, sy + 0.55, 0], { size: 0.42 });
    LBL(g, 'x', [-5.6, 0.4, 0], { size: 0.38 });
    g.add(K.arrow([sx + 0.3, sy, 0], [-1.6, sy, 0], { o: 0.6, w: 1.2 }));
    LBL(g, 'z', [-2.2, sy + 0.35, 0], { size: 0.36 });
    // stacked panels: selected in front, the others behind
    const order = [sel].concat(Object.keys(fns).filter((k) => k !== sel));
    const zr = 3, xs = 0.75, ys = 1.05, x0 = 1.3, y0 = -0.6;
    order.forEach((k, idx) => {
      const z = -idx * 1.5, front = idx === 0;
      g.add(K.line([[x0 - zr * xs, y0, z], [x0 + zr * xs, y0, z]], { o: front ? 0.5 : 0.2, w: 1 }));
      g.add(K.line([[x0, y0 - 1.3, z], [x0, y0 + 3.4, z]], { o: front ? 0.5 : 0.2, w: 1 }));
      const pts = [];
      for (let i = 0; i <= 80; i++) { const t = -zr + 2 * zr * i / 80; pts.push([x0 + t * xs, y0 + fns[k](t) * ys, z]); }
      g.add(K.line(pts, front ? { c: 'acc', w: 2.6 } : { o: 0.3, w: 1.4 }));
      LBL(g, names[k], [x0 + zr * xs + 0.6, y0 + fns[k](zr) * ys, z], { size: front ? 0.42 : 0.32, o: front ? 0.9 : 0.4, c: front ? 'acc' : undefined });
    });
    // identity line (no activation) for contrast on the front panel
    g.add(K.line([[x0 - 1.2 * xs, y0 - 1.2 * ys, 0.001], [x0 + 3 * xs, y0 + 3 * ys, 0.001]], { o: 0.3, w: 1, dash: true }));
    LBL(g, 'f(z)', [x0 - 0.1, y0 + 3.75, 0], { size: 0.36 });
    return {
      legend: [{ c: 'acc', t: 'Activation f(x)' }],
      ctl: [{ key: 'f', label: 'f', options: [{ value: 'relu', label: 'ReLU' }, { value: 'gelu', label: 'GELU' }, { value: 'sigmoid', label: 'sigmoid' }, { value: 'tanh', label: 'tanh' }], value: sel }],
    };
  };

  B.hiddenlayer = function (p, g) {
    const layers = [
      { x: -4.5, n: [2, 2], hid: false, l: 'x' },
      { x: -1.5, n: [3, 3], hid: true, l: 'h₁' },
      { x: 1.5, n: [3, 3], hid: true, l: 'h₂' },
      { x: 4.5, n: [1, 2], hid: false, l: 'ŷ' },
    ];
    const pos = layers.map((L) => {
      const P = [], [ny, nz] = L.n, s = 1.15;
      for (let a = 0; a < ny; a++) for (let b = 0; b < nz; b++) P.push([L.x, (a - (ny - 1) / 2) * s, (b - (nz - 1) / 2) * s]);
      return P;
    });
    for (let l = 0; l < layers.length - 1; l++) {
      const pairs = [];
      pos[l].forEach((a) => pos[l + 1].forEach((b) => pairs.push([a, b])));
      g.add(K.segs(pairs, { o: 0.16 }));
    }
    layers.forEach((L, l) => {
      g.add(K.dots(pos[l], { r: 0.16, c: L.hid ? 'acc' : undefined }));
      if (L.hid) g.add(K.rect(L.x, 0, 0, 3.0, 3.0, 'yz', { c: 'acc', o: 0.55, w: 1.2, fill: 0.06, fc: 'acc' }));
      const top = L.hid ? 1.95 : (L.n[0] - 1) / 2 * 1.15 + 0.6;
      LBL(g, L.l, [L.x, top + 0.25, 0], { size: 0.42, c: L.hid ? 'acc' : undefined });
    });
    return { legend: [{ c: 'acc', t: 'Hidden layers' }, { c: 'ink', t: 'Input and output' }] };
  };

  B.hiddenstate = function (p, g, ret) {
    const toks = ['the', 'cat', 'sat', 'on', 'mat'], n = toks.length, dx = 2.3, x0 = -dx * (n - 1) / 2;
    const r = K.rng(7);
    const H = [];
    toks.forEach((tk, i) => {
      const x = x0 + i * dx;
      g.add(K.box(x, 0, 0, 1, 1, 1, { fill: 0.05, o: 0.75 }));
      g.add(K.arrow([x, -1.75, 0], [x, -0.55, 0], { o: 0.45, w: 1.1 }));
      LBL(g, tk, [x, -2.1, 0], { size: 0.38, o: 0.85, mono: true });
      // hidden state vector leaving this cell
      const hx = x + dx / 2;
      g.add(K.arrow([x + 0.5, 0, 0], [i < n - 1 ? hx + dx / 2 - 0.55 : hx + 0.7, 0, 0], { c: 'acc', w: 2.2 }));
      for (let k = 0; k < 4; k++) {
        const v = 0.25 + 0.6 * r();
        g.add(K.box(hx, 0.85 + k * 0.3, 0, 0.26, 0.26, 0.26, { c: 'acc', fill: v, fc: 'acc', o: 0.9 }));
      }
      g.add(K.line([[hx, 0.04, 0], [hx, 0.68, 0]], { c: 'acc', o: 0.5, w: 1 }));
      LBL(g, 'h' + '₁₂₃₄₅'[i], [hx, 2.25, 0], { size: 0.36, c: 'acc' });
      H.push(hx);
    });
    g.add(K.arrow([x0 - 1.4, 0, 0], [x0 - 0.55, 0, 0], { c: 'acc', o: 0.5, w: 1.6 }));
    // pulse travelling along the chain
    const pulse = K.dots([[0, 0, 0]], { r: 0.11, c: 'acc' });
    const holder = new T.Group(); holder.add(pulse); g.add(holder);
    const xa = x0 - 1.2, xb = H[n - 1] + 0.6;
    holder.position.set(xa, 0, 0);
    ret.tick = (t) => { const u = (t % 5) / 5; holder.position.x = xa + (xb - xa) * u; };
    return { legend: [{ c: 'acc', t: 'Hidden state h(t)' }] };
  };

  B.logits = function (p, g) {
    const cls = ['cat', 'dog', 'fox', 'owl', 'cow'], z = [2.4, 1.1, -0.7, 0.3, -1.6];
    const mx = Math.max(...z), ex = z.map((v) => Math.exp(v - mx)), S = ex.reduce((a, b) => a + b, 0), pr = ex.map((v) => v / S);
    const w = 0.55, sp = 0.85;
    // logits panel (left, front)
    const lx = -3, lz = 0.6;
    g.add(K.line([[lx - 2.3, 0, lz], [lx + 2.3, 0, lz]], { o: 0.55, w: 1 }));
    cls.forEach((c, i) => {
      const x = lx + (i - 2) * sp, h = z[i] * 0.9;
      g.add(K.box(x, h / 2, lz, w, Math.abs(h), w, { c: 'acc', fill: 0.65, fc: 'acc', o: 0.9 }));
      LBL(g, c, [x, -1.95, lz + 0.5], { size: 0.32, mono: true, o: 0.75 });
    });
    LBL(g, 'z', [lx - 2.7, 1.8, lz], { size: 0.44, c: 'acc' });
    LBL(g, '0', [lx - 2.6, 0, lz], { size: 0.3, o: 0.6 });
    // softmax
    g.add(K.arrow([lx + 2.5, 0.9, lz - 0.4], [1.0, 0.9, -0.9], { o: 0.55, w: 1.2 }));
    LBL(g, 'softmax', [-0.25, 1.45, -0.2], { size: 0.32, mono: true, o: 0.75 });
    // probability panel (right, behind)
    const px = 3.2, pz = -1.4;
    g.add(K.line([[px - 2.3, 0, pz], [px + 2.3, 0, pz]], { o: 0.55, w: 1 }));
    g.add(K.line([[px - 2.3, 2.9, pz], [px + 2.3, 2.9, pz]], { o: 0.2, w: 1, dash: true }));
    LBL(g, '1', [px - 2.6, 2.9, pz], { size: 0.3, o: 0.6 });
    cls.forEach((c, i) => {
      const x = px + (i - 2) * sp, h = Math.max(0.02, pr[i] * 2.9);
      g.add(K.box(x, h / 2, pz, w, h, w, { fill: 0.12, o: 0.7 }));
    });
    LBL(g, 'p', [px + 2.7, 1.5, pz], { size: 0.44 });
    return { legend: [{ c: 'acc', t: 'Logits' }, { c: 'ink', t: 'Probabilities' }] };
  };

  // 8x8 input with a bright square; feature maps from 3x3 kernels
  function sampleImage() {
    const n = 8, img = [];
    for (let j = 0; j < n; j++) { img.push([]); for (let i = 0; i < n; i++) img[j].push(i >= 2 && i <= 5 && j >= 2 && j <= 5 ? 1 : 0); }
    img[1][3] = 1; img[1][4] = 1;
    return img;
  }
  function conv(img, k) {
    const n = img.length, m = n - 2, out = [];
    for (let j = 0; j < m; j++) { out.push([]); for (let i = 0; i < m; i++) { let s = 0; for (let b = 0; b < 3; b++) for (let a = 0; a < 3; a++) s += img[j + b][i + a] * k[b][a]; out[j].push(s); } }
    return out;
  }

  B.featuremap = function (p, g) {
    const img = sampleImage(), s = 0.5;
    const ic = [-3.2, 0, 0.6];
    g.add(grid(ic, 8, 8, s, 'xy', { o: 0.3 }));
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (img[j][i]) g.add(fillCell(ic, 8, 8, s, 'xy', i, j, { fill: 0.55 }));
    const kv = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]]; // vertical edge detector
    const out = conv(img, kv).map((r) => r.map(Math.abs)), mx = 3;
    const maps = 4;
    for (let k = maps - 1; k >= 0; k--) {
      const c = [2.0 + k * 0.45, 0.2 * k, -1.2 * k];
      g.add(grid(c, 6, 6, s, 'xy', { o: k === 0 ? 0.5 : 0.18, c: k === 0 ? 'acc' : undefined }));
      if (k === 0) {
        for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
          const v = out[j][i] / mx;
          if (v > 0.01) g.add(fillCell(c, 6, 6, s, 'xy', i, j, { fill: 0.12 + 0.68 * v, fc: 'acc' }));
        }
      } else g.add(K.rect(c[0], c[1], c[2], 6 * s, 6 * s, 'xy', { fill: 0.04, edge: false }));
    }
    // one window -> one output cell
    const fc = [2.0, 0, 0];
    const wc = blockCorners(ic, 8, 8, s, 'xy', 1, 2, 3, 4), oc = cell(fc, 6, 6, s, 'xy', 1, 2);
    g.add(block(ic, 8, 8, s, 'xy', 1, 2, 3, 4, { c: 'acc', w: 2 }));
    g.add(K.segs(wc.map((q) => [q, oc]), { c: 'acc', o: 0.45 }));
    LBL(g, 'x', [ic[0], 2.45, ic[2]], { size: 0.4 });
    LBL(g, 'C', [3.9, 2.4, -2.2], { size: 0.38, o: 0.6 });
    return { legend: [{ c: 'acc', t: 'Feature map' }, { c: 'ink', t: 'Input image' }] };
  };

  B.kernelfilter = function (p, g, ret) {
    const n = 7, s = 0.58, ic = [-1.6, 0, 0], m = n - 2, oc = [3.6, 0, -1.2];
    const img = []; const r = K.rng(3);
    for (let j = 0; j < n; j++) { img.push([]); for (let i = 0; i < n; i++) img[j].push(r()); }
    g.add(grid(ic, n, n, s, 'xy', { o: 0.3 }));
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.add(fillCell(ic, n, n, s, 'xy', i, j, { fill: 0.04 + 0.22 * img[j][i] }));
    g.add(grid(oc, m, m, s, 'xy', { o: 0.35 }));
    const kv = [[1, 0, -1], [2, 0, -2], [1, 0, -1]];
    const states = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const sg = new T.Group();
      sg.add(block(ic, n, n, s, 'xy', i, j, i + 2, j + 2, { c: 'acc', w: 2.2, fill: 0.12, fc: 'acc' }));
      const wc0 = blockCorners(ic, n, n, s, 'xy', i, j, i + 2, j + 2);
      const o = cell(oc, m, m, s, 'xy', i, j);
      sg.add(fillCell(oc, m, m, s, 'xy', i, j, { fill: 0.75, fc: 'acc', k: 0.86 }));
      sg.add(K.segs(wc0.map((q) => [q, o]), { c: 'acc', o: 0.3 }));
      sg.visible = false; g.add(sg); states.push(sg);
    }
    // kernel weights (static, drawn beside the stack so labels never move)
    const kc2 = [-1.6, 3.3, 0];
    g.add(grid(kc2, 3, 3, 0.5, 'xy', { c: 'acc', o: 0.9 }));
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) LBL(g, String(kv[j][i]), cell(kc2, 3, 3, 0.5, 'xy', i, j), { size: 0.3, mono: true, c: 'acc', o: 1 });
    LBL(g, 'W', [kc2[0] - 1.1, kc2[1], kc2[2]], { size: 0.42, c: 'acc' });
    const start = 6;
    states[start].visible = true;
    let cur = start;
    ret.tick = (t) => {
      const k = (start + Math.floor(t / 0.24)) % states.length;
      if (k !== cur) { states[cur].visible = false; states[k].visible = true; cur = k; }
    };
    return { legend: [{ c: 'acc', t: 'Kernel window → output' }] };
  };

  B.stridepad = function (p, g, ret) {
    const st = Math.max(1, Math.min(3, Math.round(p.stride || 2))), pad = 1, n = 5, N = n + 2 * pad, s = 0.6;
    const m = Math.floor((n + 2 * pad - 3) / st) + 1;
    const ic = [-2.0, 0, 0], oc = [3.4, 0, -1.4];
    // padding ring
    const ringPairs = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const inner = i >= pad && i < N - pad && j >= pad && j < N - pad;
      if (inner) g.add(fillCell(ic, N, N, s, 'xy', i, j, { fill: 0.1 }));
      else ringPairs.push(cell(ic, N, N, s, 'xy', i, j));
    }
    g.add(K.rect(ic[0], ic[1], ic[2], N * s, N * s, 'xy', { o: 0.35, w: 1.2, dash: true }));
    g.add(K.rect(ic[0], ic[1], ic[2], n * s, n * s, 'xy', { o: 0.8, w: 1.4 }));
    g.add(grid(ic, N, N, s, 'xy', { o: 0.14 }));
    g.add(K.dots(ringPairs, { r: 0.045, o: 0.35 }));
    // positions of the window
    const states = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const sg = new T.Group();
      const a = i * st, b = j * st;
      sg.add(block(ic, N, N, s, 'xy', a, b, a + 2, b + 2, { c: 'acc', w: 2.4, fill: 0.14, fc: 'acc' }));
      const oc1 = cell(oc, m, m, s, 'xy', i, j);
      sg.add(fillCell(oc, m, m, s, 'xy', i, j, { fill: 0.75, fc: 'acc', k: 0.86 }));
      sg.add(K.segs(blockCorners(ic, N, N, s, 'xy', a, b, a + 2, b + 2).map((q) => [q, oc1]), { c: 'acc', o: 0.3 }));
      sg.visible = false; g.add(sg); states.push(sg);
    }
    // stride jump: dashed outline of the next window and an arrow between them
    if (m > 1) {
      g.add(block(ic, N, N, s, 'xy', st, 0, st + 2, 2, { c: 'acc', w: 1.2, o: 0.6 }));
      const c0 = cell(ic, N, N, s, 'xy', 1, 0), c1 = cell(ic, N, N, s, 'xy', 1 + st, 0);
      g.add(K.arrow([c0[0], c0[1] + 0.75, 0.05], [c1[0], c1[1] + 0.75, 0.05], { c: 'acc', w: 1.8 }));
    }
    LBL(g, 's = ' + st, [cell(ic, N, N, s, 'xy', 1, 0)[0] + st * s * 0.5, ic[1] + N * s / 2 + 0.75, 0], { size: 0.4, c: 'acc' });
    LBL(g, 'p = ' + pad, [ic[0] - N * s / 2 - 0.85, ic[1] - N * s / 2 + 0.3, 0], { size: 0.36, o: 0.75 });
    g.add(grid(oc, m, m, s, 'xy', { o: 0.4 }));
    LBL(g, m + '×' + m, [oc[0], oc[1] - m * s / 2 - 0.45, oc[2]], { size: 0.36, o: 0.75 });
    states[0].visible = true;
    let cur = 0;
    ret.tick = (t) => {
      const k = Math.floor(t / 0.6) % states.length;
      if (k !== cur) { states[cur].visible = false; states[k].visible = true; cur = k; }
    };
    return {
      legend: [{ c: 'acc', t: 'Kernel window → output' }, { c: 'ink', t: 'Zero padding' }],
      ctl: [{ key: 'stride', label: 's', min: 1, max: 3, step: 1, value: st }],
    };
  };

  B.receptive = function (p, g) {
    const s = 0.5, L = [{ n: 9, y: 0 }, { n: 7, y: 1.4 }, { n: 5, y: 2.8 }, { n: 3, y: 4.2 }];
    const ctr = (n) => (n - 1) / 2;
    L.forEach((l, k) => {
      const c = [0, l.y, 0];
      g.add(grid(c, l.n, l.n, s, 'xz', { o: 0.25 }));
      g.add(K.rect(0, l.y, 0, l.n * s, l.n * s, 'xz', { fill: 0.03, edge: false }));
      // receptive field of the centre neuron of the top layer
      const rf = 1 + 2 * (L.length - 1 - k), a = ctr(l.n) - (rf - 1) / 2, b = a + rf - 1;
      for (let j = a; j <= b; j++) for (let i = a; i <= b; i++) g.add(fillCell(c, l.n, l.n, s, 'xz', i, j, { fill: 0.15 + 0.15 * k, fc: 'acc' }));
      g.add(block(c, l.n, l.n, s, 'xz', a, a, b, b, { c: 'acc', w: 1.8 }));
      if (k < L.length - 1) LBL(g, rf + '×' + rf, [l.n * s / 2 + 0.85, l.y, 0], { size: 0.34, c: 'acc' });
    });
    // pyramid edges
    const corners = L.map((l, k) => {
      const rf = 1 + 2 * (L.length - 1 - k), a = ctr(l.n) - (rf - 1) / 2, b = a + rf - 1;
      return blockCorners([0, l.y, 0], l.n, l.n, s, 'xz', a, a, b, b);
    });
    const pairs = [];
    for (let k = 0; k < L.length - 1; k++) for (let q = 0; q < 4; q++) pairs.push([corners[k][q], corners[k + 1][q]]);
    g.add(K.segs(pairs, { c: 'acc', o: 0.45 }));
    g.add(K.dots([[0, 4.2, 0]], { r: 0.14, c: 'acc' }));
    return { legend: [{ c: 'acc', t: 'Receptive field' }] };
  };

  B.channels = function (p, g) {
    // input: H x W x 3
    const s = 0.4, H = 7, W = 7, ic = [-3.4, 0, 0];
    const rgb = ['R', 'G', 'B'];
    for (let k = 0; k < 3; k++) {
      const z = 0.8 - k * 0.8;
      g.add(grid([ic[0], ic[1], z], W, H, s, 'xy', { o: k === 0 ? 0.3 : 0.15 }));
      g.add(K.rect(ic[0], ic[1], z, W * s, H * s, 'xy', { fill: 0.05, o: 0.6 }));
      LBL(g, rgb[k], [ic[0] - W * s / 2 + 0.2, ic[1] + H * s / 2 + 0.3, z], { size: 0.3, o: 0.7 });
    }
    // output: H' x W' x C
    const C = 10, s2 = 0.42, H2 = 5, W2 = 5, oc = [2.0, 0, 0], dz = 0.36;
    const z0 = (C - 1) * dz / 2;
    for (let k = 0; k < C; k++) {
      const z = z0 - k * dz;
      g.add(K.rect(oc[0], oc[1], z, W2 * s2, H2 * s2, 'xy', { fill: 0.04, o: k === 0 ? 0.7 : 0.3 }));
    }
    g.add(grid([oc[0], oc[1], z0], W2, H2, s2, 'xy', { o: 0.25 }));
    // one pixel's channel vector
    const pc = cell([oc[0], oc[1], 0], W2, H2, s2, 'xy', 3, 1);
    for (let k = 0; k < C; k++) g.add(K.box(pc[0], pc[1], z0 - k * dz, s2 * 0.85, s2 * 0.85, dz * 0.7, { c: 'acc', fill: 0.25 + 0.5 * ((k * 37) % 10) / 10, fc: 'acc', o: 0.9 }));
    // channel axis
    const ax = oc[0] + W2 * s2 / 2 + 0.15, ay = oc[1] - H2 * s2 / 2 - 0.15;
    g.add(K.arrow([ax, ay, z0 + 0.1], [ax, ay, -z0 - 0.4], { c: 'acc', w: 2 }));
    LBL(g, 'C', [ax + 0.35, ay - 0.1, -z0 - 0.7], { size: 0.46, c: 'acc' });
    LBL(g, 'H', [oc[0] - W2 * s2 / 2 - 0.4, oc[1], z0], { size: 0.36, o: 0.7 });
    LBL(g, 'W', [oc[0], oc[1] + H2 * s2 / 2 + 0.4, z0], { size: 0.36, o: 0.7 });
    g.add(K.arrow([-1.6, 0, 0], [0.5, 0, 0], { o: 0.5, w: 1.2 }));
    LBL(g, 'conv', [-0.55, 0.4, 0], { size: 0.3, mono: true, o: 0.65 });
    return { legend: [{ c: 'acc', t: 'Channel dimension' }] };
  };

  B.latentspace = function (p, g) {
    const r = K.rng(11);
    // high-dimensional input column
    const n = 14, s = 0.32, x0 = -5;
    for (let i = 0; i < n; i++) g.add(K.box(x0, (i - (n - 1) / 2) * s, 0, s * 0.9, s * 0.9, s * 0.9, { fill: 0.05 + 0.3 * r(), o: 0.55 }));
    LBL(g, 'x ∈ ℝ⁷⁸⁴', [x0, (n / 2) * s + 0.45, 0], { size: 0.34, o: 0.8 });
    // encoder trapezoid
    const ex0 = -4.3, ex1 = -2.3;
    g.add(K.line([[ex0, 2.2, 0], [ex1, 0.7, 0], [ex1, -0.7, 0], [ex0, -2.2, 0], [ex0, 2.2, 0]], { o: 0.6, w: 1.2 }));
    LBL(g, 'E', [(ex0 + ex1) / 2, 0, 0], { size: 0.42 });
    // latent frame
    const c = [1.8, -1.6, 0], A = 2.7;
    g.add(K.arrow(c, [c[0] + A * 1.2, c[1], c[2]], { o: 0.5, w: 1 }));
    g.add(K.arrow(c, [c[0], c[1] + A * 1.25, c[2]], { o: 0.5, w: 1 }));
    g.add(K.arrow(c, [c[0], c[1], c[2] + A * 1.1], { o: 0.5, w: 1 }));
    LBL(g, 'z₁', [c[0] + A * 1.2 + 0.3, c[1], c[2]], { size: 0.34, o: 0.7 });
    LBL(g, 'z₂', [c[0], c[1] + A * 1.25 + 0.3, c[2]], { size: 0.34, o: 0.7 });
    LBL(g, 'z₃', [c[0], c[1], c[2] + A * 1.1 + 0.35], { size: 0.34, o: 0.7 });
    const cents = [[0.7, 0.8, 2.2], [2.7, 0.8, 0.6], [1.0, 2.5, 0.7]];
    const pts = [];
    cents.forEach((m) => { for (let i = 0; i < 26; i++) pts.push([c[0] + m[0] + 0.22 * r.n(), c[1] + m[1] + 0.22 * r.n(), c[2] + m[2] + 0.22 * r.n()]); });
    g.add(K.dots(pts, { r: 0.07, c: 'acc', o: 0.85 }));
    // one input lands at one latent point
    const tgt = [c[0] + cents[0][0], c[1] + cents[0][1], c[2] + cents[0][2]];
    g.add(K.dots([tgt], { r: 0.15, c: 'acc' }));
    g.add(K.arc([ex1 + 0.1, 0, 0], tgt, 1.2, { o: 0.5, w: 1.2, dash: true }));
    // interpolation between two codes
    const t2 = [c[0] + cents[1][0], c[1] + cents[1][1], c[2] + cents[1][2]];
    g.add(K.line([tgt, t2], { c: 'acc', w: 2, o: 0.7 }));
    g.add(K.dots([t2], { r: 0.15, c: 'acc' }));
    LBL(g, 'z ∈ ℝ³', [c[0] + 1.5, c[1] + A * 1.25 + 0.35, c[2]], { size: 0.34, c: 'acc' });
    return { legend: [{ c: 'acc', t: 'Points in latent space' }, { c: 'ink', t: 'Raw input' }] };
  };

  B.representation = function (p, g) {
    const r = K.rng(5);
    const inner = [], outer = [];
    for (let i = 0; i < 46; i++) {
      const isIn = i % 2 === 0, a = r() * 2 * Math.PI;
      const rad = isIn ? 0.25 + 0.6 * Math.sqrt(r()) : 1.45 + 0.35 * r();
      (isIn ? inner : outer).push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    // left: raw space (flat, tangled: not linearly separable)
    const lx = -3.3;
    g.add(K.rect(lx, 0, 0, 4.2, 4.2, 'xz', { o: 0.35, w: 1, fill: 0.03 }));
    g.add(K.dots(inner.map(([a, b]) => [lx + a, 0, b]), { r: 0.09, c: 'acc' }));
    g.add(K.dots(outer.map(([a, b]) => [lx + a, 0, b]), { r: 0.09, c: 'b', hollow: true }));
    LBL(g, 'x', [lx - 2.4, 0, 2.2], { size: 0.38, o: 0.7 });
    // tiny encoder
    const nx = [-0.6, 0, 0.6], ny = [[-0.5, 0.5], [-0.8, 0, 0.8], [-0.5, 0.5]];
    const P = nx.map((x, k) => ny[k].map((y) => [x, 1.4 + y, 0]));
    const pairs = [];
    for (let k = 0; k < 2; k++) P[k].forEach((a) => P[k + 1].forEach((b) => pairs.push([a, b])));
    g.add(K.segs(pairs, { o: 0.3 }));
    g.add(K.dots(P.flat(), { r: 0.08 }));
    LBL(g, 'f_θ', [0, 2.6, 0], { size: 0.4 });
    g.add(K.arrow([-1.0, 0.3, 0], [1.0, 0.3, 0], { o: 0.5, w: 1.2 }));
    // right: learned representation where a plane separates them
    const rx = 3.3, lift = (a, b) => 2.6 * Math.exp(-(a * a + b * b) / 1.1);
    g.add(K.rect(rx, 0, 0, 4.2, 4.2, 'xz', { o: 0.35, w: 1, fill: 0.03 }));
    g.add(K.dots(inner.map(([a, b]) => [rx + a, lift(a, b), b]), { r: 0.09, c: 'acc' }));
    g.add(K.dots(outer.map(([a, b]) => [rx + a, lift(a, b), b]), { r: 0.09, c: 'b', hollow: true }));
    g.add(K.rect(rx, 1.05, 0, 4.2, 4.2, 'xz', { o: 0.55, w: 1.2, fill: 0.06 }));
    LBL(g, 'h', [rx + 2.4, 1.05, -2.1], { size: 0.38, o: 0.7 });
    return { legend: [{ c: 'acc', t: 'Inner class' }, { c: 'b', t: 'Outer class' }, { c: 'ink', t: 'Separating plane' }] };
  };

  B.weightshare = function (p, g) {
    const n = 10, s = 0.5, ic = [0, 0, 0];
    const r = K.rng(9);
    g.add(grid(ic, n, n, s, 'xz', { o: 0.25 }));
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.add(fillCell(ic, n, n, s, 'xz', i, j, { fill: 0.02 + 0.12 * r() }));
    const kc = [0, 3.4, 0];
    g.add(grid(kc, 3, 3, s, 'xz', { c: 'acc', o: 0.95, w: 1.6 }));
    g.add(K.rect(kc[0], kc[1], kc[2], 3 * s, 3 * s, 'xz', { fill: 0.3, fc: 'acc', edge: false }));
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.add(fillCell(kc, 3, 3, s, 'xz', i, j, { fill: 0.15 + 0.5 * ((i * 5 + j * 3) % 7) / 7, fc: 'acc' }));
    LBL(g, 'W', [kc[0] - 1.25, kc[1] + 0.15, kc[2]], { size: 0.46, c: 'acc' });
    const kcs = blockCorners(kc, 3, 3, s, 'xz', 0, 0, 2, 2);
    const pos = [[0, 0], [6, 1], [1, 6], [7, 7], [4, 3]];
    const pairs = [];
    pos.forEach(([i, j]) => {
      g.add(block(ic, n, n, s, 'xz', i, j, i + 2, j + 2, { c: 'acc', w: 2, fill: 0.18, fc: 'acc' }));
      const wc = blockCorners(ic, n, n, s, 'xz', i, j, i + 2, j + 2);
      // one line per window from the kernel centre to the window centre, plus faint corner lines
      const a = cell(ic, n, n, s, 'xz', i + 1, j + 1);
      wc.forEach((q, k) => pairs.push([kcs[k], q]));
    });
    g.add(K.segs(pairs, { c: 'acc', o: 0.22 }));
    return { legend: [{ c: 'acc', t: 'One shared kernel' }, { c: 'ink', t: 'Input positions' }] };
  };

  B.paramcount = function (p, g) {
    const sz = [4, 6, 3], X = [-4.4, 0, 4.4], yN = 2.6, sp = 0.5;
    const P = sz.map((n, l) => Array.from({ length: n }, (_, i) => [X[l], yN + (i - (n - 1) / 2) * sp, 0]));
    for (let l = 0; l < 2; l++) {
      const pairs = []; P[l].forEach((a) => P[l + 1].forEach((b) => pairs.push([a, b])));
      g.add(K.segs(pairs, { o: 0.22 }));
    }
    g.add(K.dots(P.flat(), { r: 0.11 }));
    // weight matrices below each gap: rows = outputs, cols = inputs, plus a bias column
    const c = 0.34;
    const mats = [{ i: 4, o: 6, x: -2.2 }, { i: 6, o: 3, x: 2.2 }];
    mats.forEach((M, k) => {
      const y0 = -0.4, w = M.i * c;
      for (let r = 0; r < M.o; r++) {
        const y = y0 + ((M.o - 1) / 2 - r) * c;
        for (let q = 0; q < M.i; q++) g.add(K.box(M.x - w / 2 + (q + 0.5) * c, y, 0, c * 0.86, c * 0.86, c * 0.86, { c: 'acc', fill: 0.55, fc: 'acc', o: 0.8 }));
        g.add(K.box(M.x + w / 2 + 0.3 + c / 2, y, 0, c * 0.86, c * 0.86, c * 0.86, { c: 'acc', fill: 0.18, fc: 'acc', o: 0.8 }));
      }
      LBL(g, 'W', [M.x, y0 + (M.o / 2) * c + 0.3, 0], { size: 0.34, c: 'acc' });
      LBL(g, 'b', [M.x + w / 2 + 0.3 + c / 2, y0 + (M.o / 2) * c + 0.3, 0], { size: 0.34, c: 'acc' });
      const tot = M.i * M.o + M.o;
      LBL(g, M.i + '×' + M.o + ' + ' + M.o + ' = ' + tot, [M.x, -2.25, 0], { size: 0.36 });
    });
    LBL(g, 'Σ = 51', [0, -3.0, 0], { size: 0.46, c: 'acc', weight: 600 });
    return { legend: [{ c: 'acc', t: 'Weights and biases' }, { c: 'ink', t: 'Neurons' }] };
  };

  B.flops = function (p, g) {
    const m = 4, n = 5, kk = 6, s = 0.62;
    // j -> x, i -> y (top row i=0), k -> z
    const X = (j) => (j - (n - 1) / 2) * s, Y = (i) => ((m - 1) / 2 - i) * s, Z = (k) => ((kk - 1) / 2 - k) * s;
    const W = n * s, H = m * s, D = kk * s, gap = 0.55;
    const hi = 1, hj = 2;
    // A (m x k) on the left
    const ax = -W / 2 - gap;
    for (let i = 0; i < m; i++) for (let k = 0; k < kk; k++) g.add(K.box(ax, Y(i), Z(k), 0.08, s * 0.88, s * 0.88, { fill: i === hi ? 0.6 : 0.06, fc: i === hi ? 'acc' : undefined, c: i === hi ? 'acc' : undefined, o: i === hi ? 0.9 : 0.35 }));
    // B (k x n) on top
    const by = H / 2 + gap;
    for (let k = 0; k < kk; k++) for (let j = 0; j < n; j++) g.add(K.box(X(j), by, Z(k), s * 0.88, 0.08, s * 0.88, { fill: j === hj ? 0.6 : 0.06, fc: j === hj ? 'acc' : undefined, c: j === hj ? 'acc' : undefined, o: j === hj ? 0.9 : 0.35 }));
    // C (m x n) on the front
    const cz = D / 2 + gap;
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      const on = i === hi && j === hj;
      g.add(K.box(X(j), Y(i), cz, s * 0.88, s * 0.88, 0.08, { fill: on ? 0.85 : 0.06, fc: on ? 'acc' : undefined, c: on ? 'acc' : undefined, o: on ? 1 : 0.35 }));
    }
    // volume of multiply-adds
    const pts = [], hot = [];
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) for (let k = 0; k < kk; k++) (i === hi && j === hj ? hot : pts).push([X(j), Y(i), Z(k)]);
    g.add(K.dots(pts, { r: 0.05, o: 0.3 }));
    g.add(K.dots(hot, { r: 0.1, c: 'acc' }));
    g.add(K.line([[X(hj), Y(hi), Z(kk - 1)], [X(hj), Y(hi), cz]], { c: 'acc', w: 2 }));
    g.add(K.box(0, 0, 0, W, H, D, { o: 0.18 }));
    LBL(g, 'A', [ax, -H / 2 - 0.45, -D / 2], { size: 0.42 });
    LBL(g, 'B', [W / 2 + 0.45, by + 0.2, -D / 2], { size: 0.42 });
    LBL(g, 'C', [W / 2 + 0.45, -H / 2, cz], { size: 0.42 });
    LBL(g, 'm', [ax, 0, D / 2 + 0.45], { size: 0.34, o: 0.7, mono: true });
    LBL(g, 'n', [0, by + 0.05, D / 2 + 0.45], { size: 0.34, o: 0.7, mono: true });
    LBL(g, 'k', [-W / 2 - 0.4, by + 0.05, 0], { size: 0.34, o: 0.7, mono: true });
    LBL(g, '2·m·n·k', [0, -H / 2 - 0.9, cz], { size: 0.46, c: 'acc', weight: 600 });
    return { legend: [{ c: 'acc', t: 'Multiply-adds for one output' }, { c: 'ink', t: 'All multiply-adds' }] };
  };

  B.floatfmt = function (p, g) {
    const F = [['FP32', 8, 23], ['BF16', 8, 7], ['FP16', 5, 10], ['FP8', 4, 3]];
    const w = 0.25, x0 = -4.1;
    F.forEach(([nm, e, mt], r) => {
      const y = 1.9 - r * 1.25, z = -r * 0.5, tot = 1 + e + mt;
      for (let b = 0; b < tot; b++) {
        const kind = b === 0 ? 's' : b <= e ? 'e' : 'm';
        const c = kind === 'e' ? 'acc' : kind === 'm' ? 'b' : undefined;
        g.add(K.box(x0 + (b + 0.5) * w, y, z, w * 0.84, 0.55, 0.3, { c, fill: kind === 's' ? 0.75 : 0.55, fc: c, o: 0.85 }));
      }
      LBL(g, nm, [x0 - 0.85, y, z], { size: 0.36, mono: true, weight: 600 });
      LBL(g, String(tot), [x0 + tot * w + 0.45, y, z], { size: 0.32, o: 0.6, mono: true });
    });
    return { legend: [{ c: 'acc', t: 'Exponent bits (range)' }, { c: 'b', t: 'Mantissa bits (precision)' }, { c: 'ink', t: 'Sign bit' }] };
  };

  B.sparsity = function (p, g) {
    const sp = Math.max(0.5, Math.min(0.95, p.sparsity == null ? 0.8 : +p.sparsity));
    const n = 12, s = 0.45, r = K.rng(21);
    const vals = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vals.push({ i, j, v: Math.abs(r.n()) });
    const sorted = vals.map((o) => o.v).sort((a, b) => a - b), thr = sorted[Math.floor(sp * vals.length)];
    const c = [0, 0, 0];
    g.add(grid(c, n, n, s, 'xz', { o: 0.18 }));
    let nz = 0;
    vals.forEach(({ i, j, v }) => {
      const q = cell(c, n, n, s, 'xz', i, j);
      if (v >= thr) {
        nz++;
        const h = 0.15 + v * 0.75;
        g.add(K.box(q[0], h / 2, q[2], s * 0.55, h, s * 0.55, { c: 'acc', fill: 0.6, fc: 'acc', o: 0.85 }));
      } else g.add(K.rect(q[0], 0.005, q[2], s * 0.5, s * 0.5, 'xz', { fill: 0.1, edge: false }));
    });
    LBL(g, Math.round(sp * 100) + '% = 0', [-n * s / 2 - 0.5, 0.1, n * s / 2 + 0.6], { size: 0.4, o: 0.8 });
    return {
      legend: [{ c: 'acc', t: 'Nonzero weights' }, { c: 'ink', t: 'Zeros' }],
      ctl: [{ key: 'sparsity', label: 'sparsity', min: 0.5, max: 0.95, step: 0.05, value: sp }],
    };
  };

  VIZ.znn = function (p, k) {
    K = k; T = k.THREE;
    const g = new T.Group();
    const f = B[p.kind];
    const ret = {};
    if (!f) { g.add(K.box(0, 0, 0, 3, 3, 3, { o: 0.3 })); return { g, legend: [] }; }
    const out = f(p, g, ret) || {};
    const TURN = { activation: 0.5, hiddenlayer: 0.25, hiddenstate: 0.5, logits: 0.5, featuremap: 0.55, kernelfilter: 0.55, stridepad: 0.6, receptive: 0, channels: 0.5, latentspace: 0.45, representation: 0.45, weightshare: 0.15, paramcount: 0.6, flops: 1.3, floatfmt: 0.6, sparsity: 0.25 };
    const root = new T.Group(); g.rotation.y = TURN[p.kind] || 0; root.add(g);
    return Object.assign({ g: root, legend: out.legend || [] }, out.ctl ? { ctl: out.ctl } : {}, ret.tick ? { tick: ret.tick } : {});
  };
})();
