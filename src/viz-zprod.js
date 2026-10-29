/* Latent Atlas — appendix figures for the 'zprod' chapter (ML in production). One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------------- helpers ---------------- */
  function lab(g, t, p, o) { g.add(K.label(t, p, Object.assign({ size: 0.36 }, o || {}))); }
  function mod(g, x, y, z, w, h, d, t, o) {
    o = o || {};
    const c = o.c;
    g.add(K.box(x, y, z, w, h, d, { fill: o.fill == null ? (c ? 0.14 : 0.045) : o.fill, fc: c, c: c, o: o.o == null ? (c ? 0.95 : 0.7) : o.o }));
    if (t) g.add(K.label(t, [x, y, z + (o.lz || 0)], { size: o.size || 0.42, c: o.lc !== undefined ? o.lc : c, o: o.lo == null ? 1 : o.lo }));
  }
  function arr(g, a, b, o) { g.add(K.arrow(a, b, Object.assign({ w: 1.5, o: 0.7, head: 0.22 }, o || {}))); }
  function carr(g, ctrl, o) {
    o = o || {};
    const c = new T.CatmullRomCurve3(ctrl.map((p) => K.V(p[0], p[1], p[2])));
    const P = c.getPoints(48);
    const hl = o.head || 0.22;
    const end = P[P.length - 1];
    let k = P.length - 2;
    while (k > 0 && P[k].distanceTo(end) < hl * 1.05) k--;
    g.add(K.line(P.slice(0, k + 1), { c: o.c, o: o.o == null ? 0.75 : o.o, w: o.w == null ? 1.5 : o.w, dash: o.dash }));
    g.add(K.arrow(P[k], end, { c: o.c, o: o.o == null ? 0.75 : o.o, w: o.w == null ? 1.5 : o.w, head: hl }));
    return P;
  }
  /* a dot that travels along a polyline; returns set(u) */
  function mover(g, pts, o) {
    o = o || {};
    const h = new T.Group();
    h.add(K.dots([[0, 0, 0]], { r: o.r || 0.11, c: o.c || 'acc', o: o.o }));
    g.add(h);
    const P = pts.map((p) => (p.isVector3 ? p : K.V(p[0], p[1], p[2])));
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
    const tot = L[L.length - 1] || 1;
    const set = (u) => {
      const d = Math.max(0, Math.min(1, u)) * tot;
      let i = 1; while (i < L.length - 1 && L[i] < d) i++;
      const a = P[i - 1], b = P[i], t = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
      h.position.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
    };
    set(o.u0 || 0);
    return { set, obj: h };
  }
  /* filled polygon on the vertical xy plane at depth z (pts: [[x,y],...]) */
  function vfill(pts, z, o) {
    const sh = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
    const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.fill == null ? 0.2 : o.fill, side: T.DoubleSide, depthWrite: false }));
    m.position.z = z;
    return m;
  }
  function bar(g, x, z, w, d, h, y0, o) {
    o = o || {};
    if (h <= 0.001) return;
    g.add(K.box(x, y0 + h / 2, z, w, h, d, o.c ? { fill: o.fill == null ? 0.65 : o.fill, fc: o.c, c: o.c, o: o.o == null ? 0.95 : o.o } : { fill: o.fill == null ? 0.08 : o.fill, o: o.o == null ? 0.45 : o.o }));
  }
  function floorGrid(g, xr, zr, y, n) {
    const pairs = [];
    for (let i = 0; i <= n; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / n, z = zr[0] + (zr[1] - zr[0]) * i / n;
      pairs.push([[x, y, zr[0]], [x, y, zr[1]]]); pairs.push([[xr[0], y, z], [xr[1], y, z]]);
    }
    g.add(K.segs(pairs, { o: 0.08 }));
  }
  function gauss(x, m, s) { return Math.exp(-0.5 * ((x - m) / s) * ((x - m) / s)); }

  /* ---------------- figures ---------------- */
  const F = {
    /* trained, frozen model: new inputs go forward only, predictions come out */
    inference(g) {
      mod(g, 0, 0, 0, 2.4, 2.2, 2.2, 'f_θ', { size: 0.56 });
      lab(g, '❄', [0, 1.5, 0], { size: 0.42, o: 0.55 });
      // incoming inputs (new, unseen)
      const ins = [];
      for (let i = 0; i < 4; i++) {
        const x = -5.4 + i * 0.75;
        g.add(K.box(x, 0, 0, 0.42, 0.42, 0.42, { fill: 0.06, o: 0.35 + 0.15 * i }));
        ins.push(x);
      }
      lab(g, 'x', [-4.3, -0.65, 0], { size: 0.42 });
      const path = [[-2.6, 0, 0], [-1.3, 0, 0], [1.3, 0, 0], [2.7, 0, 0]];
      arr(g, [-2.85, 0, 0], [-1.3, 0, 0], { c: 'acc', w: 2.2, o: 1 });
      arr(g, [1.3, 0, 0], [2.75, 0, 0], { c: 'acc', w: 2.2, o: 1 });
      // predictions out
      g.add(K.box(3.3, 0, 0, 0.5, 0.5, 0.5, { fill: 0.6, fc: 'acc', c: 'acc' }));
      lab(g, 'ŷ', [3.3, 0.75, 0], { size: 0.44, c: 'acc' });
      // no backward pass: faded, crossed gradient arrow
      carr(g, [[3.3, 0.5, 0], [2.0, 2.3, 0], [-2.0, 2.3, 0], [-3.15, 0.5, 0]], { dash: true, o: 0.25, w: 1.2 });
      lab(g, '∇', [-0.75, 2.75, 0], { size: 0.4, o: 0.35 });
      g.add(K.segs([[[-0.3, 2.0, 0], [0.3, 2.6, 0]], [[-0.3, 2.6, 0], [0.3, 2.0, 0]]], { o: 0.6, w: 1.8 }));
      const m = mover(g, [[-5.4, 0, 0], ...path, [3.3, 0, 0]], { r: 0.12 });
      return { legend: [{ c: 'acc', t: 'Forward pass only' }, { c: 'ink', t: 'Frozen weights' }], tick: (t) => m.set((t % 3) / 3) };
    },

    /* Gantt of requests over time: one request's duration = latency; completions per second = throughput */
    latency(g) {
      const r = K.rng(11), lanes = 5, x0 = -4.5, x1 = 4.5;
      floorGrid(g, [x0, x1], [-2.4, 2.4], -0.01, 9);
      g.add(K.line([[x0, 0, 2.6], [x1 + 0.3, 0, 2.6]], { o: 0.5, w: 1 }));
      g.add(K.arrow([x1, 0, 2.6], [x1 + 0.5, 0, 2.6], { o: 0.5, w: 1, head: 0.2 }));
      lab(g, 't', [x1 + 0.85, 0, 2.6], { size: 0.38, o: 0.75 });
      const win = [0.5, 3.0];
      g.add(K.rect((win[0] + win[1]) / 2, 0.005, 0, win[1] - win[0], 4.8, 'xz', { fill: 0.1, fc: 'b', c: 'b', o: 0.7 }));
      let hiBar = null;
      for (let l = 0; l < lanes; l++) {
        const z = -2 + l;
        let x = x0 + r.range(0, 0.5);
        while (x < x1 - 0.6) {
          const len = r.range(0.9, 1.5);
          const xe = Math.min(x + len, x1);
          const hl = l === 4 && !hiBar && x > -3.6 && xe < win[0] - 0.2;
          if (hl) hiBar = [x, xe, z];
          g.add(K.box((x + xe) / 2, 0.18, z, xe - x, 0.36, 0.5, hl ? { fill: 0.6, fc: 'acc', c: 'acc' } : { fill: 0.06, o: 0.4 }));
          if (xe >= win[0] && xe <= win[1]) g.add(K.dots([[xe, 0.42, z]], { r: 0.09, c: 'b' }));
          x = xe + r.range(0.1, 0.35);
        }
      }
      // latency bracket above highlighted request
      const [a, b, z] = hiBar || [-3, -1.8, 2], yb = 0.9;
      g.add(K.line([[a, 0.4, z], [a, yb, z]], { c: 'acc', o: 0.8, w: 1 }));
      g.add(K.line([[b, 0.4, z], [b, yb, z]], { c: 'acc', o: 0.8, w: 1 }));
      g.add(K.line([[a, yb, z], [b, yb, z]], { c: 'acc', w: 2 }));
      lab(g, 'ms', [(a + b) / 2, yb + 0.38, z], { size: 0.46, c: 'acc' });
      lab(g, 'req/s', [(win[0] + win[1]) / 2, 0.75, -2.9], { size: 0.42, c: 'b' });
      return { legend: [{ c: 'acc', t: 'Latency (one request)' }, { c: 'b', t: 'Throughput (per second)' }] };
    },

    /* GPU die with thousands of parallel cores, fed from VRAM that holds the weights */
    gpu(g) {
      g.add(K.box(0, -0.1, 0, 8.4, 0.2, 5.4, { fill: 0.04, o: 0.35 }));
      // die with a grid of many small cores
      const dx = 0.6, dz = 1.0, nx = 18, nz = 10, sx = 4.6 / nx, sz = 2.6 / nz;
      g.add(K.box(dx, 0.1, dz, 5.0, 0.2, 3.0, { fill: 0.06, o: 0.6 }));
      const pairs = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = dx - 2.3 + sx * (i + 0.5), z = dz - 1.3 + sz * (j + 0.5), h = sx * 0.34, y = 0.21;
        pairs.push([[x - h, y, z - h], [x + h, y, z - h]], [[x + h, y, z - h], [x + h, y, z + h]], [[x + h, y, z + h], [x - h, y, z + h]], [[x - h, y, z + h], [x - h, y, z - h]]);
      }
      g.add(K.segs(pairs, { o: 0.45 }));
      lab(g, 'GPU', [dx, 0.25, dz + 1.95], { size: 0.4, o: 0.8 });
      // VRAM stacks along the back: capacity outline, weights filled
      const H = 1.8, used = 0.72;
      [-2.4, -0.8, 0.8, 2.4].forEach((x) => {
        const z = -1.75;
        g.add(K.box(x, H / 2, z, 1.0, H, 1.0, { o: 0.5 }));
        const nl = 4, hu = H * used;
        for (let l = 0; l < nl; l++) {
          const hh = hu / nl;
          g.add(K.box(x, hh * (l + 0.5), z, 0.9, hh * 0.8, 0.9, { fill: 0.5, fc: 'acc', c: 'acc', o: 0.85 }));
        }
        arr(g, [x, 0.15, z + 0.55], [x * 0.75 + dx * 0.25, 0.25, dz - 1.4], { c: 'acc', o: 0.8, w: 1.4, head: 0.18 });
      });
      lab(g, 'VRAM', [-2.4, H + 0.4, -1.75], { size: 0.38 });
      lab(g, 'θ', [2.4, H + 0.4, -1.75], { size: 0.44, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Weights in VRAM' }, { c: 'ink', t: 'Parallel cores' }] };
    },

    /* clients -> API endpoint -> load balancer -> model replicas -> responses */
    serving(g) {
      const cl = [-1.8, -0.6, 0.6, 1.8];
      cl.forEach((z) => g.add(K.dots([[-5.0, 0, z]], { r: 0.17, o: 0.85 })));
      mod(g, -2.6, 0, 0, 0.5, 1.6, 4.6, 'API', { size: 0.34, lz: 0 });
      cl.forEach((z) => { if (z !== 0.6) arr(g, [-4.75, 0, z], [-2.9, 0, z], { o: 0.35, w: 1, head: 0.16 }); });
      const reps = [-2.1, 0, 2.1];
      reps.forEach((z) => {
        mod(g, 1.6, 0, z, 1.2, 1.1, 1.1, 'f_θ', { size: 0.38 });
        if (z !== 0) arr(g, [-2.3, 0, z * 0.5], [0.95, 0, z], { o: 0.3, w: 1, head: 0.16 });
      });
      // one request travels in, the response travels back (accent)
      const req = [[-4.75, 0.15, 0.6], [-2.3, 0.15, 0.6], [0.95, 0.15, 0.1]];
      g.add(K.line(req.slice(0, 2), { c: 'acc', w: 2.2 }));
      arr(g, req[1], req[2], { c: 'acc', w: 2.2, o: 1 });
      const resp = [[0.95, -0.3, 0.1], [-2.3, -0.3, 0.6], [-4.75, -0.3, 0.6]];
      g.add(K.line(resp.slice(0, 2), { c: 'acc', w: 1.8, dash: true }));
      arr(g, resp[1], resp[2], { c: 'acc', w: 1.8, o: 1, dash: true });
      lab(g, 'x', [-3.7, 0.55, 0.6], { size: 0.4, c: 'acc' });
      lab(g, 'ŷ', [-3.7, -0.75, 0.6], { size: 0.42, c: 'acc' });
      const m = mover(g, req.concat([[1.6, 0, 0]], resp), { r: 0.12 });
      return { legend: [{ c: 'acc', t: 'Request and response' }, { c: 'ink', t: 'Model replicas' }], tick: (t) => m.set((t % 4) / 4) };
    },

    /* live metric over time with an alert threshold; input distribution drifting behind */
    monitoring(g) {
      const n = 80, W = 9, x0 = -4.5, ys = [], r = K.rng(4);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        ys.push(2.6 - (u > 0.6 ? (u - 0.6) * 4.0 : 0) + 0.08 * r.n());
      }
      const X = (i) => x0 + W * i / (n - 1);
      g.add(K.line([[x0, 0, 0], [x0 + W, 0, 0]], { o: 0.5, w: 1 }));
      g.add(K.line([[x0, 0, 0], [x0, 3.2, 0]], { o: 0.5, w: 1 }));
      lab(g, 't', [x0 + W + 0.4, 0, 0], { size: 0.36, o: 0.75 });
      const th = 1.8;
      g.add(K.line([[x0, th, 0], [x0 + W, th, 0]], { dash: true, o: 0.6, w: 1.4 }));
      lab(g, 'τ', [x0 - 0.4, th, 0], { size: 0.42, o: 0.8 });
      let cross = n - 1;
      for (let i = Math.floor(n * 0.6); i < n; i++) if (ys[i] < th) { cross = i; break; }
      g.add(K.line(ys.slice(0, cross + 1).map((y, i) => [X(i), y, 0]), { w: 2 }));
      g.add(K.line(ys.slice(cross).map((y, i) => [X(i + cross), y, 0]), { c: 'acc', w: 2.4 }));
      g.add(K.dots([[X(cross), ys[cross], 0]], { r: 0.14, c: 'acc' }));
      lab(g, '!', [X(cross) + 0.05, ys[cross] + 0.55, 0], { size: 0.55, c: 'acc', weight: 700 });
      // input distribution per time window on a back panel: reference (dashed) vs live
      const zb = -1.2, yb = 3.7, sh = [0, 0.05, 0.3, 0.75];
      sh.forEach((m, k) => {
        const xc = x0 + W * (0.12 + 0.25 * k), ref = [], live = [];
        for (let i = 0; i <= 30; i++) {
          const xx = -0.95 + 1.9 * i / 30;
          ref.push([xc + xx, yb + 1.2 * gauss(xx, -0.15, 0.3), zb]);
          live.push([xc + xx, yb + 1.2 * gauss(xx, -0.15 + m, 0.3), zb]);
        }
        g.add(K.line([[xc - 0.95, yb, zb], [xc + 0.95, yb, zb]], { o: 0.3, w: 1 }));
        g.add(K.line(ref, { o: 0.35, w: 1, dash: true }));
        g.add(K.line(live, k === 3 ? { c: 'acc', w: 2 } : { o: 0.7, w: 1.4 }));
      });
      lab(g, 'p(x)', [x0 - 0.5, yb + 0.5, zb], { size: 0.34, o: 0.75 });
      return { legend: [{ c: 'acc', t: 'Drift alert' }, { c: 'ink', t: 'Live metric' }] };
    },

    /* sawtooth: accuracy decays, each retrain on fresh data restores it */
    retraining(g) {
      const x0 = -4.5, W = 9, segs = 3, H = 3;
      g.add(K.line([[x0, 0, 0], [x0 + W, 0, 0]], { o: 0.5, w: 1 }));
      g.add(K.line([[x0, 0, 0], [x0, H + 0.4, 0]], { o: 0.5, w: 1 }));
      lab(g, 't', [x0 + W + 0.4, 0, 0], { size: 0.36, o: 0.75 });
      // without retraining: faint continued decay
      const decay = (u) => H - 0.2 - 1.9 * (1 - Math.exp(-u * 1.6));
      const dead = [];
      for (let i = 0; i <= 60; i++) { const u = i / 60; dead.push([x0 + W * u, decay(u * 3), 0]); }
      g.add(K.line(dead, { o: 0.25, w: 1.2, dash: true }));
      const sw = W / segs;
      for (let s = 0; s < segs; s++) {
        const P = [];
        for (let i = 0; i <= 20; i++) { const u = i / 20; P.push([x0 + s * sw + sw * u, decay(u), 0]); }
        g.add(K.line(P, { w: 2 }));
        if (s > 0) {
          const xr = x0 + s * sw;
          g.add(K.line([[xr, decay(1), 0], [xr, decay(0), 0]], { c: 'acc', w: 2.4 }));
          g.add(K.dots([[xr, decay(0), 0]], { r: 0.12, c: 'acc' }));
          lab(g, 'v' + (s + 1), [xr + 0.35, decay(0) + 0.4, 0], { size: 0.34, c: 'acc' });
          // fresh data window used for this retrain (floor, behind)
          g.add(K.box(xr - 0.9, 0.12, -1.6, 1.6, 0.24, 1.0, { fill: 0.45, fc: 'acc', c: 'acc', o: 0.8 }));
          carr(g, [[xr - 0.9, 0.3, -1.6], [xr - 0.5, 1.0, -0.8], [xr - 0.02, decay(0.5) - 0.2, -0.1]], { c: 'acc', o: 0.55, w: 1.2, head: 0.16 });
        }
      }
      lab(g, 'v1', [x0 + 0.35, decay(0) + 0.4, 0], { size: 0.34, o: 0.7 });
      // all-data timeline on the floor
      g.add(K.box(0, 0.06, -1.6, W, 0.12, 1.0, { fill: 0.04, o: 0.3 }));
      return { legend: [{ c: 'acc', t: 'Retrain on fresh data' }, { c: 'ink', t: 'Model accuracy' }] };
    },

    /* raw sources -> feature table -> same features to batch training and online lookup */
    featurestore(g) {
      // raw sources, spread in depth on the left
      [-1.6, 0, 1.6].forEach((z) => {
        const cy = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.8, 24, 1, true), new T.MeshBasicMaterial({ color: K.colorOf('ink'), transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false }));
        cy.position.set(-5.8, 0, z); g.add(cy);
        [-0.4, 0.4].forEach((y) => {
          const P = []; for (let i = 0; i <= 32; i++) { const a = 2 * Math.PI * i / 32; P.push([-5.8 + 0.4 * Math.cos(a), y, z + 0.4 * Math.sin(a)]); }
          g.add(K.line(P, { o: 0.5, w: 1 }));
        });
        arr(g, [-5.3, 0, z], [-2.75, 0, z * 0.3], { o: 0.35, w: 1, head: 0.16 });
      });
      // the store: entity rows x feature columns (a thin slab facing the viewer)
      const R = 7, C = 5, cw = 0.6, rh = 0.42, x0 = -2.5, y0 = -R * rh / 2;
      g.add(K.box(x0 + cw * C / 2, 0, 0, cw * C + 0.3, R * rh + 0.3, 0.5, { fill: 0.04, o: 0.45 }));
      for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) {
        const hl = j === 2;
        g.add(K.rect(x0 + (i + 0.5) * cw, y0 + (j + 0.5) * rh, 0.26, cw * 0.82, rh * 0.72, 'xy', hl ? { fill: 0.6, fc: 'acc', c: 'acc', o: 0.9 } : { fill: 0.1, o: 0.3 }));
      }
      lab(g, 'φ₁ … φₖ', [x0 + cw * C / 2, y0 + R * rh + 0.5, 0], { size: 0.36, o: 0.85 });
      const xr = x0 + C * cw + 0.2;
      // offline: the whole table becomes the training matrix
      arr(g, [xr, 0.9, 0], [2.4, 1.6, 0], { o: 0.6, w: 1.5 });
      for (let j = 0; j < 5; j++) g.add(K.box(3.2, 1.0 + j * 0.28, 0, 1.2, 0.2, 0.5, { fill: 0.1, o: 0.5 }));
      lab(g, 'X', [3.2, 2.75, 0], { size: 0.42 });
      arr(g, [3.9, 1.55, 0], [4.6, 1.55, 0], { o: 0.5, w: 1.2, head: 0.16 });
      lab(g, 'θ', [5.0, 1.55, 0], { size: 0.44 });
      // online: one row lookup feeds the live model
      arr(g, [xr, y0 + 2.5 * rh, 0], [2.5, -1.6, 0], { c: 'acc', w: 2.2, o: 1 });
      g.add(K.box(3.2, -1.6, 0, 1.2, 0.24, 0.5, { fill: 0.6, fc: 'acc', c: 'acc' }));
      lab(g, 'x', [3.2, -1.15, 0], { size: 0.42, c: 'acc' });
      arr(g, [3.9, -1.6, 0], [4.6, -1.6, 0], { c: 'acc', o: 0.9, w: 1.6, head: 0.16 });
      lab(g, 'f_θ', [5.15, -1.6, 0], { size: 0.4, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Online feature lookup' }, { c: 'ink', t: 'Shared feature table' }] };
    },

    /* DAG of stages: data -> features -> train -> evaluate -> deploy, with a packet flowing */
    mlpipeline(g) {
      const names = ['D', 'φ', 'θ', 'ℒ', 'API'];
      const st = names.map((t, i) => [t, -4.4 + 2.2 * i, 0, 1.8 - 0.9 * i]);
      st.forEach(([t, x, y, z]) => mod(g, x, y, z, 1.0, 1.0, 1.0, t, { size: t === 'API' ? 0.3 : 0.46 }));
      const P = st.map(([, x, y, z]) => K.V(x, y, z));
      for (let i = 0; i < P.length - 1; i++) {
        const d = P[i + 1].clone().sub(P[i]).normalize();
        arr(g, P[i].clone().addScaledVector(d, 0.72), P[i + 1].clone().addScaledVector(d, -0.72), { c: 'acc', w: 2, o: 0.95 });
      }
      // evaluation can send the run back to training
      carr(g, [[P[3].x, 0.6, P[3].z], [(P[2].x + P[3].x) / 2, 1.6, (P[2].z + P[3].z) / 2], [P[2].x, 0.65, P[2].z]], { dash: true, o: 0.35, w: 1.2, head: 0.16 });
      lab(g, '⟳', [P[0].x, 0.95, P[0].z], { size: 0.5, o: 0.55 });
      const m = mover(g, P, { r: 0.13 });
      return { legend: [{ c: 'acc', t: 'Pipeline flow' }, { c: 'ink', t: 'Automated steps' }], tick: (t) => m.set((t % 4) / 4) };
    },

    /* models x tasks score grid on one fixed test suite, with the average leaderboard in front */
    benchmark(g) {
      const M = 5, Tn = 6, r = K.rng(21);
      const skill = [0.55, 0.72, 0.9, 0.64, 0.45];
      const sx = 1.3, sz = 0.7;
      const X = (i) => (i - (M - 1) / 2) * sx;
      floorGrid(g, [-3.4, 3.4], [-3.6, 2.4], -0.01, 8);
      const avg = [], sc = [];
      for (let i = 0; i < M; i++) {
        let s = 0; sc.push([]);
        for (let t = 0; t < Tn; t++) { const v = Math.max(0.15, Math.min(1, skill[i] + 0.14 * r.n())); s += v; sc[i].push(v); }
        avg.push(s / Tn);
      }
      const best = avg.indexOf(Math.max(...avg));
      for (let i = 0; i < M; i++) for (let t = 0; t < Tn; t++) {
        const z = -3.3 + t * sz;
        bar(g, X(i), z, 0.32, 0.32, sc[i][t] * 1.8, 0, i === best ? { c: 'acc', fill: 0.25, o: 0.6 } : { fill: 0.05, o: 0.28 });
      }
      for (let i = 0; i < M; i++) {
        bar(g, X(i), 1.5, 0.75, 0.75, avg[i] * 3.4, 0, i === best ? { c: 'acc' } : { fill: 0.12, o: 0.6 });
        lab(g, 'M' + (i + 1), [X(i), 0, 2.55], { size: 0.32, o: 0.75, c: i === best ? 'acc' : undefined });
      }
      lab(g, '#1', [X(best), avg[best] * 3.4 + 0.4, 1.5], { size: 0.4, c: 'acc' });
      lab(g, 'T₁…T₆', [-3.9, 0, -1.55], { size: 0.3, o: 0.6 });
      return { legend: [{ c: 'acc', t: 'Top average score' }, { c: 'ink', t: 'Per-task scores' }] };
    },

    /* dense normal cloud on the floor, rare outliers far away with tall score stems */
    anomaly(g) {
      const r = K.rng(7), pts = [];
      for (let i = 0; i < 260; i++) {
        const c = i % 2 ? [-1.0, 0.6] : [1.1, -0.5];
        pts.push([c[0] + 0.75 * r.n(), 0.02, c[1] + 0.55 * r.n()]);
      }
      floorGrid(g, [-4.5, 4.5], [-3.5, 3.5], -0.01, 9);
      g.add(K.dots(pts, { r: 0.055, o: 0.55 }));
      // density contours
      const dens = (x, z) => gauss(x, -1.0, 0.75) * gauss(z, 0.6, 0.55) + gauss(x, 1.1, 0.75) * gauss(z, -0.5, 0.55);
      [0.12].forEach((L) => {
        const pairs = [], n = 70, xr = [-4.5, 4.5], zr = [-3.5, 3.5], dx = 9 / n, dz = 7 / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], P = [];
          const v = (a, b) => dens(xr[0] + a * dx, zr[0] + b * dz) - L;
          for (let k = 0; k < 4; k++) {
            const [a0, a1] = c[k], [b0, b1] = c[(k + 1) % 4], va = v(a0, a1), vb = v(b0, b1);
            if ((va < 0) !== (vb < 0)) { const t = va / (va - vb); P.push([xr[0] + (a0 + (b0 - a0) * t) * dx, 0.02, zr[0] + (a1 + (b1 - a1) * t) * dz]); }
          }
          if (P.length >= 2) pairs.push([P[0], P[1]]);
        }
        g.add(K.segs(pairs, { o: 0.5, w: 1.4 }));
      });
      const out = [[-3.8, -2.6], [3.7, 2.4], [3.9, -2.9], [-3.4, 2.9]];
      const hs = [2.2, 2.6, 1.8, 1.6];
      out.forEach(([x, z], k) => {
        const h = hs[k];
        g.add(K.line([[x, 0.02, z], [x, h, z]], { c: 'acc', w: 1.8 }));
        g.add(K.dots([[x, 0.02, z]], { r: 0.12, c: 'acc' }));
        g.add(K.dots([[x, h, z]], { r: 0.07, c: 'acc' }));
      });
      lab(g, 's(x)', [3.7, 3.05, 2.4], { size: 0.36, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Anomalies' }, { c: 'ink', t: 'Normal data' }] };
    },

    /* funnel: catalogue -> candidates -> ranked top-k for one user */
    recsys(g) {
      const r = K.rng(3);
      // user
      g.add(K.dots([[-5.6, 0, 0]], { r: 0.22 }));
      lab(g, 'u', [-5.6, 0.6, 0], { size: 0.42 });
      // catalogue plane (many items)
      const cat = [];
      for (let i = 0; i < 18; i++) for (let j = 0; j < 12; j++) cat.push([-3.2, -1.65 + j * 0.3, -2.55 + i * 0.3]);
      g.add(K.dots(cat, { r: 0.05, o: 0.35 }));
      g.add(K.rect(-3.2, 0, 0, 5.6, 3.8, 'yz', { o: 0.25 }));
      // candidates
      const cand = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) cand.push([-0.6, -0.5 + j * 0.34, -0.9 + i * 0.36]);
      g.add(K.dots(cand, { r: 0.07, o: 0.6 }));
      g.add(K.rect(-0.6, 0, 0, 2.5, 1.7, 'yz', { o: 0.3 }));
      // funnel edges
      const f = [[-3.2, 1.9, 2.8], [-3.2, -1.9, 2.8], [-3.2, 1.9, -2.8], [-3.2, -1.9, -2.8]];
      const c = [[-0.6, 0.85, 1.25], [-0.6, -0.85, 1.25], [-0.6, 0.85, -1.25], [-0.6, -0.85, -1.25]];
      g.add(K.segs(f.map((a, i) => [a, c[i]]), { o: 0.18 }));
      arr(g, [-5.3, 0, 0], [-3.4, 0, 0], { o: 0.5, w: 1.2 });
      // ranked list
      const sc = [0.95, 0.82, 0.7, 0.6, 0.5];
      sc.forEach((v, k) => {
        const y = 1.4 - k * 0.7;
        g.add(K.box(2.4, y, 0, 0.55, 0.5, 0.55, { fill: 0.6, fc: 'acc', c: 'acc' }));
        g.add(K.box(2.95 + v * 1.0, y, 0, v * 2.0, 0.16, 0.16, { fill: 0.18, o: 0.5 }));
      });
      arr(g, [-0.3, 0, 0], [1.95, 0, 0], { c: 'acc', o: 0.85, w: 1.6 });
      lab(g, 'top-k', [2.4, 2.25, 0], { size: 0.36, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Recommended items' }, { c: 'ink', t: 'Item catalogue' }] };
    },

    /* 10 x 10 impressions, a few clicked; CTR = clicks / impressions */
    ctr(g) {
      const clicked = new Set([13, 47, 72, 88]);
      const s = 0.62, n = 10;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const k = i * n + j, x = (j - 4.5) * s, z = (i - 4.5) * s;
        if (clicked.has(k)) {
          g.add(K.box(x, 0.55, z, 0.46, 1.1, 0.46, { fill: 0.65, fc: 'acc', c: 'acc' }));
        } else g.add(K.box(x, 0.04, z, 0.46, 0.08, 0.46, { fill: 0.06, o: 0.35 }));
      }
      // ratio column at the side
      const xc = 4.3;
      g.add(K.box(xc, 1.6, 0, 0.6, 3.2, 0.6, { fill: 0.04, o: 0.5 }));
      g.add(K.box(xc, 0.064, 0, 0.6, 0.128, 0.6, { fill: 0.7, fc: 'acc', c: 'acc' }));
      lab(g, '4 / 100', [xc, 3.65, 0], { size: 0.36, o: 0.8 });
      lab(g, '4%', [xc + 0.75, 0.15, 0.6], { size: 0.38, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Clicks' }, { c: 'ink', t: 'Impressions' }] };
    },

    /* user x item rating bars; a new user row and a new item column with no history */
    coldstart(g) {
      const U = 6, I = 8, s = 0.75, r = K.rng(9);
      const X = (j) => (j - (I - 1) / 2) * s, Z = (i) => (i - (U - 1) / 2) * s;
      const newU = U - 1, newI = I - 1;
      for (let i = 0; i < U; i++) for (let j = 0; j < I; j++) {
        const x = X(j), z = Z(i);
        if (i === newU || j === newI) continue;
        if (r() < 0.55) bar(g, x, z, 0.45, 0.45, 0.25 + r() * 1.0, 0, { fill: 0.1, o: 0.5 });
        else g.add(K.rect(x, 0.01, z, 0.45, 0.45, 'xz', { o: 0.15 }));
      }
      // empty row and column, outlined in accent
      for (let j = 0; j < I; j++) g.add(K.rect(X(j), 0.01, Z(newU), 0.5, 0.5, 'xz', { c: 'acc', o: 0.9, w: 1.4, fill: 0.08, fc: 'acc' }));
      for (let i = 0; i < U - 1; i++) g.add(K.rect(X(newI), 0.01, Z(i), 0.5, 0.5, 'xz', { c: 'acc', o: 0.9, w: 1.4, fill: 0.08, fc: 'acc' }));
      lab(g, '?', [0, 0.45, Z(newU)], { size: 0.5, c: 'acc' });
      lab(g, '?', [X(newI), 0.45, Z(1)], { size: 0.5, c: 'acc' });
      lab(g, 'u_new', [X(0) - 1.0, 0.05, Z(newU)], { size: 0.32, c: 'acc' });
      lab(g, 'i_new', [X(newI), 0.05, Z(0) - 0.85], { size: 0.32, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'No history yet' }, { c: 'ink', t: 'Known ratings' }] };
    },

    /* sparse rating matrix R completed from user factors U and item factors V */
    collabfilter(g) {
      const U = 5, I = 7, k = 2, s = 0.78, r = K.rng(17);
      const X = (j) => (j - (I - 1) / 2) * s, Z = (i) => (i - (U - 1) / 2) * s;
      const u = [], v = [];
      for (let i = 0; i < U; i++) u.push([r.range(0.3, 1), r.range(0.1, 1)]);
      for (let j = 0; j < I; j++) v.push([r.range(0.2, 1), r.range(0.1, 1)]);
      for (let i = 0; i < U; i++) for (let j = 0; j < I; j++) {
        const val = (u[i][0] * v[j][0] + u[i][1] * v[j][1]) * 1.1;
        const known = r() < 0.55;
        bar(g, X(j), Z(i), 0.4, 0.4, val, 0, known ? { fill: 0.1, o: 0.5 } : { c: 'acc', fill: 0.4, o: 0.85 });
        g.add(K.rect(X(j), 0.005, Z(i), 0.5, 0.5, 'xz', { o: 0.15 }));
      }
      lab(g, 'R', [X(I - 1) + 0.85, 0, Z(U - 1) + 0.5], { size: 0.46 });
      // factors as flat tiles: U (users x k) on the left, Vᵀ (k x items) behind
      for (let i = 0; i < U; i++) for (let c = 0; c < k; c++) g.add(K.box(X(0) - 1.3 - c * 0.5, u[i][c] * 0.3, Z(i), 0.38, u[i][c] * 0.6, 0.4, { fill: 0.15, o: 0.5 }));
      lab(g, 'U', [X(0) - 1.55, 0, Z(U - 1) + 0.75], { size: 0.44 });
      for (let j = 0; j < I; j++) for (let c = 0; c < k; c++) g.add(K.box(X(j), v[j][c] * 0.3, Z(0) - 1.2 - c * 0.5, 0.4, v[j][c] * 0.6, 0.38, { fill: 0.15, o: 0.5 }));
      lab(g, 'Vᵀ', [X(I - 1) + 0.9, 0, Z(0) - 1.45], { size: 0.44 });
      lab(g, 'R ≈ U Vᵀ', [X(0) - 1.0, 1.9, Z(0) - 1.2], { size: 0.42, o: 0.85 });
      return { legend: [{ c: 'acc', t: 'Predicted ratings' }, { c: 'ink', t: 'Known ratings' }] };
    },

    /* transaction stream: fraud score per transaction, a few cross the threshold */
    fraud(g) {
      const r = K.rng(29), n = 70, W = 9, x0 = -4.5, D = 2.6;
      const flag = new Set([12, 37, 58]);
      const th = 1.9;
      floorGrid(g, [x0, x0 + W], [-D / 2, D / 2], -0.01, 9);
      for (let i = 0; i < n; i++) {
        const x = x0 + W * (i + 0.5) / n, z = r.range(-D / 2 + 0.2, D / 2 - 0.2);
        const h = flag.has(i) ? r.range(2.4, 3.1) : Math.max(0.12, 0.35 + 0.28 * r.n());
        const c = flag.has(i) ? 'acc' : undefined;
        g.add(K.line([[x, 0, z], [x, h, z]], c ? { c, w: 2 } : { o: 0.35, w: 1 }));
        g.add(K.dots([[x, h, z]], { r: c ? 0.11 : 0.05, c, o: c ? 1 : 0.6 }));
      }
      // threshold plane
      g.add(K.rect(0, th, 0, W, D, 'xz', { o: 0.55, w: 1.2, fill: 0.05 }));
      lab(g, 'τ', [x0 - 0.45, th, D / 2], { size: 0.42, o: 0.8 });
      lab(g, 't', [x0 + W + 0.4, 0, D / 2], { size: 0.36, o: 0.75 });
      return { legend: [{ c: 'acc', t: 'Flagged transactions' }, { c: 'ink', t: 'Legitimate transactions' }] };
    },

    /* activity of each customer over time; declining ones get high churn risk */
    churn(g) {
      const r = K.rng(5), C = 7, x0 = -4.5, W = 6.2, n = 40;
      const risky = new Set([1, 4]);
      const now = x0 + W;
      for (let c = 0; c < C; c++) {
        const z = (c - (C - 1) / 2) * 0.85;
        const base = r.range(1.0, 1.8), P = [];
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          let y = base + 0.15 * r.n();
          if (risky.has(c)) y = base * Math.max(0.05, 1 - Math.max(0, u - 0.35) * 1.5) + 0.06 * r.n();
          P.push([x0 + W * u, Math.max(0.03, y), z]);
        }
        const hl = risky.has(c);
        g.add(K.line(P, hl ? { c: 'acc', w: 2.2 } : { o: 0.45, w: 1.3 }));
        g.add(K.line([[x0, 0, z], [now, 0, z]], { o: 0.12, w: 1 }));
        // predicted churn probability bar beyond 'now'
        const pr = hl ? r.range(0.75, 0.9) : r.range(0.05, 0.2);
        g.add(K.box(now + 0.9 + pr * 1.1, 0.12, z, pr * 2.2, 0.24, 0.42, hl ? { fill: 0.65, fc: 'acc', c: 'acc' } : { fill: 0.1, o: 0.45 }));
      }
      const zb = 3.3;
      g.add(K.line([[now, 0, -zb], [now, 0, zb]], { o: 0.6, w: 1.2, dash: true }));
      g.add(K.line([[now, 0, -zb], [now, 2.3, -zb]], { o: 0.4, w: 1, dash: true }));
      lab(g, 't', [now - 0.3, 0, zb + 0.5], { size: 0.36, o: 0.75 });
      lab(g, 'P(churn)', [now + 1.3, 0.75, -zb - 0.1], { size: 0.32, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'High churn risk' }, { c: 'ink', t: 'Active customers' }] };
    },

    /* seasonal history with a forecast and widening uncertainty band; product series in depth */
    demandfc(g) {
      const x0 = -4.8, Wh = 6.0, Wf = 3.4, nh = 72, nf = 40;
      const f = (u, a, ph) => a * (1 + 0.35 * Math.sin(2 * Math.PI * u * 4 + ph) + 0.25 * u);
      const r = K.rng(13);
      const series = [{ z: 0, a: 1.5, ph: 0, main: true }];
      series.forEach((s) => {
        const H = [];
        for (let i = 0; i < nh; i++) { const u = i / (nh - 1); H.push([x0 + Wh * u, f(u * 1.0, s.a, s.ph) + 0.05 * s.a * r.n(), s.z]); }
        g.add(K.line(H, s.main ? { w: 1.8 } : { o: 0.3, w: 1.1 }));
        const Fc = [], up = [], lo = [];
        for (let i = 0; i <= nf; i++) {
          const u = 1 + (i / nf) * (Wf / Wh), x = x0 + Wh * u, y = f(u, s.a, s.ph), band = 0.12 + 0.55 * i / nf;
          Fc.push([x, y, s.z]); up.push([x, y + band * s.a * 0.6]); lo.push([x, y - band * s.a * 0.6]);
        }
        g.add(K.line(Fc, s.main ? { c: 'acc', w: 2.4, dash: false } : { o: 0.3, w: 1.1, dash: true }));
        if (s.main) {
          g.add(vfill(up.concat(lo.slice().reverse()), s.z, { c: 'acc', fill: 0.18 }));
          g.add(K.line(up.map(([x, y]) => [x, y, s.z]), { c: 'acc', o: 0.5, w: 1 }));
          g.add(K.line(lo.map(([x, y]) => [x, y, s.z]), { c: 'acc', o: 0.5, w: 1 }));
        }
        g.add(K.line([[x0, 0, s.z], [x0 + Wh + Wf, 0, s.z]], { o: s.main ? 0.45 : 0.15, w: 1 }));
      });
      const xn = x0 + Wh;
      g.add(K.line([[xn, 0, 0.3], [xn, 3.4, 0.3]], { dash: true, o: 0.5, w: 1.2 }));
      lab(g, 'ŷ', [x0 + Wh + Wf + 0.4, f(1 + Wf / Wh, 1.5, 0), 0], { size: 0.44, c: 'acc' });
      lab(g, 't', [x0 + Wh + Wf + 0.4, 0, 0], { size: 0.36, o: 0.75 });
      return { legend: [{ c: 'acc', t: 'Forecast with interval' }, { c: 'ink', t: 'Past demand' }] };
    },

    /* score distributions of repayers vs defaulters on the 300-850 scale, with a cutoff */
    creditscore(g) {
      const lo = 300, hi = 850, W = 9, x0 = -4.5;
      const X = (s) => x0 + W * (s - lo) / (hi - lo);
      const nb = 22, bw = (hi - lo) / nb;
      const cut = 620;
      for (let b = 0; b < nb; b++) {
        const s = lo + bw * (b + 0.5);
        const good = 3.0 * gauss(s, 710, 60), bad = 2.0 * gauss(s, 560, 65);
        if (good > 0.03) g.add(K.box(X(s), good / 2, -0.6, W / nb * 0.82, good, 0.6, { fill: 0.55, fc: 'b', c: 'b', o: 0.9 }));
        if (bad > 0.03) g.add(K.box(X(s), bad / 2, 0.6, W / nb * 0.82, bad, 0.6, { fill: 0.6, fc: 'acc', c: 'acc', o: 0.9 }));
      }
      g.add(K.line([[x0, 0, 1.3], [x0 + W, 0, 1.3]], { o: 0.5, w: 1 }));
      [300, 500, 700, 850].forEach((s) => {
        g.add(K.line([[X(s), 0, 1.3], [X(s), 0, 1.5]], { o: 0.5, w: 1 }));
        lab(g, String(s), [X(s), -0.05, 1.95], { size: 0.32, o: 0.7 });
      });
      // cutoff plane
      g.add(K.rect(X(cut), 1.5, 0, 3.0, 3.0, 'yz', { o: 0.6, w: 1.2, fill: 0.05 }));
      lab(g, String(cut), [X(cut), 3.35, -1.5], { size: 0.36, o: 0.85 });
      return { legend: [{ c: 'acc', t: 'Defaulted' }, { c: 'b', t: 'Repaid' }] };
    },
  };

  const ROT = { latency: 0.3, monitoring: 0.55, retraining: 0.55, fraud: 0.5, churn: 0.45, demandfc: 0.55, creditscore: 0.6, featurestore: 0.6, serving: 0.15 };
  VIZ.zprod = function (p, KK) {
    K = KK; T = K.THREE;
    const g = new T.Group();
    const fn = F[p.kind] || F.inference;
    // long time / score axes read better turned toward the default camera
    const inner = new T.Group();
    inner.rotation.y = ROT[p.kind] || 0;
    g.add(inner);
    const res = fn(inner, p) || {};
    return { g, legend: res.legend || [], tick: res.tick, ctl: res.ctl };
  };
})();
