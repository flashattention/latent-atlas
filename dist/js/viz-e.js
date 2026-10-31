/* Latent Atlas — viz-e: embed, gen, tokens, flow, manifold, lowrank, graph */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------- shared helpers ---------- */
  function G() { return new T.Group(); }
  function lab(g, t, p, o) { g.add(K.label(t, p, Object.assign({ size: 0.36 }, o || {}))); }
  /* module: edged box with faint fill + optional centred label */
  function mod(g, x, y, z, w, h, d, t, o) {
    o = o || {};
    const c = o.c;
    g.add(K.box(x, y, z, w, h, d, { fill: o.fill == null ? (c ? 0.14 : 0.045) : o.fill, fc: c, c: c, o: o.o == null ? (c ? 0.95 : 0.7) : o.o }));
    if (t) g.add(K.label(t, [x, y, z + (o.lz || 0)], { size: o.size || 0.42, c: o.lc !== undefined ? o.lc : c, mono: o.mono, o: o.lo == null ? 1 : o.lo }));
  }
  function arr(g, a, b, o) { g.add(K.arrow(a, b, Object.assign({ w: 1.5, o: 0.7, head: 0.22 }, o || {}))); }
  /* curved arrow through control points; returns sampled points */
  function carr(g, ctrl, o) {
    o = o || {};
    const c = new T.CatmullRomCurve3(ctrl.map((p) => K.V(p[0], p[1], p[2])));
    const P = c.getPoints(48);
    const hl = o.head || 0.24;
    // find last index where distance to end > hl
    const end = P[P.length - 1];
    let k = P.length - 2;
    while (k > 0 && P[k].distanceTo(end) < hl * 1.05) k--;
    g.add(K.line(P.slice(0, k + 1), { c: o.c, o: o.o == null ? 0.75 : o.o, w: o.w == null ? 1.5 : o.w, dash: o.dash }));
    g.add(K.arrow(P[k], end, { c: o.c, o: o.o == null ? 0.75 : o.o, w: o.w == null ? 1.5 : o.w, head: hl }));
    return P;
  }
  /* token block */
  function tok(g, x, y, z, w, t, o) {
    o = o || {};
    const c = o.c;
    g.add(K.box(x, y, z, w, o.h || 0.55, o.d || 0.55, { fill: o.fill == null ? (c ? 0.5 : 0.06) : o.fill, fc: c, c: c, o: o.o == null ? (c ? 0.95 : 0.6) : o.o }));
    if (t) g.add(K.label(t, [x, y, z + (o.d || 0.55) / 2 + 0.02], { size: o.size || 0.32, mono: o.mono, c: o.lc, o: o.lo == null ? 1 : o.lo }));
  }
  /* column vector of cells (stacked in y) */
  function vec(g, x, y, z, n, o) {
    o = o || {};
    const s = o.s || 0.26;
    for (let i = 0; i < n; i++) g.add(K.box(x, y + (i - (n - 1) / 2) * s * 1.08, z, s, s, s, { fill: o.fill == null ? (o.c ? 0.55 : 0.08) : o.fill, fc: o.c, c: o.c, o: o.o == null ? (o.c ? 0.9 : 0.55) : o.o }));
  }
  /* funnel (encoder/decoder) along x: squares in yz plane */
  function funnel(g, x0, x1, s0, s1, o) {
    o = o || {};
    const n = o.n || 4;
    const sq = (x, s) => [[x, -s / 2, -s / 2], [x, s / 2, -s / 2], [x, s / 2, s / 2], [x, -s / 2, s / 2], [x, -s / 2, -s / 2]];
    const y = o.y || 0;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = x0 + (x1 - x0) * t, s = s0 + (s1 - s0) * t;
      const pts = sq(x, s).map((p) => [p[0], p[1] + y, p[2]]);
      g.add(K.line(pts, { c: o.c, o: (i === 0 || i === n - 1) ? (o.o || 0.6) : (o.o || 0.6) * 0.45, w: 1 }));
    }
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    g.add(K.segs(corners.map(([a, b]) => [[x0, y + a * s0 / 2, b * s0 / 2], [x1, y + a * s1 / 2, b * s1 / 2]]), { c: o.c, o: (o.o || 0.6) * 0.7 }));
    if (o.t) lab(g, o.t, [(x0 + x1) / 2, y + Math.max(s0, s1) / 2 + 0.35, 0], { size: 0.4, c: o.c });
  }
  /* small pixel image in xy plane centred at (cx,cy,cz); f(i,j)->0..1 */
  function pix(g, cx, cy, cz, n, size, f, o) {
    o = o || {};
    const c = size / n;
    g.add(K.rect(cx, cy, cz, size, size, 'xy', { o: 0.55, w: 1 }));
    const pairs = [];
    for (let i = 1; i < n; i++) {
      const t = -size / 2 + i * c;
      pairs.push([[cx + t, cy - size / 2, cz], [cx + t, cy + size / 2, cz]]);
      pairs.push([[cx - size / 2, cy + t, cz], [cx + size / 2, cy + t, cz]]);
    }
    g.add(K.segs(pairs, { o: 0.12 }));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = f(i, j);
      if (v > 0.05) g.add(K.rect(cx - size / 2 + (i + 0.5) * c, cy - size / 2 + (j + 0.5) * c, cz, c * 0.92, c * 0.92, 'xy', { fill: v * (o.op || 0.55), fc: o.c, edge: false }));
    }
  }
  const sunImg = (n) => (i, j) => { const x = (i + 0.5) / n - 0.5, y = (j + 0.5) / n - 0.5; const r = Math.hypot(x, y); return r < 0.3 ? 1 : (r < 0.38 ? 0.35 : 0); };
  /* wire sphere */
  function wsphere(g, R, o) {
    o = o || {};
    const pairs = [], n = 48;
    const lat = o.lat || [-60, -30, 0, 30, 60], lon = o.lon || 8;
    lat.forEach((d) => {
      const a = d * Math.PI / 180, y = R * Math.sin(a), r = R * Math.cos(a);
      for (let i = 0; i < n; i++) { const t0 = 2 * Math.PI * i / n, t1 = 2 * Math.PI * (i + 1) / n; pairs.push([[r * Math.cos(t0), y, r * Math.sin(t0)], [r * Math.cos(t1), y, r * Math.sin(t1)]]); }
    });
    for (let k = 0; k < lon; k++) {
      const ph = Math.PI * k / lon;
      for (let i = 0; i < n; i++) {
        const t0 = 2 * Math.PI * i / n, t1 = 2 * Math.PI * (i + 1) / n;
        const P = (t) => [R * Math.cos(t) * Math.cos(ph), R * Math.sin(t), R * Math.cos(t) * Math.sin(ph)];
        pairs.push([P(t0), P(t1)]);
      }
    }
    g.add(K.segs(pairs, { o: o.o || 0.08 }));
  }
  /* ellipse ring */
  function ring(cx, cy, cz, a, b, plane, n) {
    const pts = []; n = n || 64;
    for (let i = 0; i <= n; i++) {
      const t = 2 * Math.PI * i / n, u = a * Math.cos(t), v = b * Math.sin(t);
      if (plane === 'xy') pts.push([cx + u, cy + v, cz]);
      else if (plane === 'xz') pts.push([cx + u, cy, cz + v]);
      else pts.push([cx, cy + u, cz + v]);
    }
    return pts;
  }
  function slerpArc(u, v, r, n) {
    u = u.clone().normalize(); v = v.clone().normalize();
    const om = Math.acos(Math.max(-1, Math.min(1, u.dot(v)))), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = Math.sin((1 - t) * om) / Math.sin(om), b = Math.sin(t * om) / Math.sin(om);
      pts.push(u.clone().multiplyScalar(a).add(v.clone().multiplyScalar(b)).multiplyScalar(r));
    }
    return pts;
  }
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function knn(P, k) {
    const E = [];
    P.forEach((p, i) => {
      const ds = P.map((q, j) => [d3(p, q), j]).filter((x) => x[1] !== i).sort((a, b) => a[0] - b[0]);
      for (let m = 0; m < k; m++) { const j = ds[m][1]; if (i < j || !E.some((e) => e[0] === j && e[1] === i)) E.push([i, j]); }
    });
    return E;
  }

  /* =====================================================================
     EMBED
     ===================================================================== */
  VIZ.embed = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'w2v', r = K.rng(31);
    let legend;
    if (kind === 'w2v') {
      g.rotation.y = 0.35;
      g.add(K.frame({ s: 2.8, y: 0, n: 6, h: 3.6 }));
      // parallelogram laid out roughly facing the default camera
      const man = [-2.0, 0.7, 0.8], gender = [3.6, 0.15, -0.7], royal = [0.25, 2.7, -0.4];
      const woman = add3(man, gender), king = add3(man, royal), queen = add3(king, gender);
      const pred = add3(queen, [0.22, -0.2, 0.18]);
      const cloud = [];
      for (let i = 0; i < 34; i++) cloud.push([r.range(-2.7, 2.7), r.range(0.3, 4.0), r.range(-2.7, 2.7)]);
      g.add(K.dots(cloud, { r: 0.04, o: 0.18 }));
      // faint drops to the floor anchor the points in 3D
      g.add(K.segs([man, woman, king, queen].map((v) => [v, [v[0], 0, v[2]]]), { o: 0.12 }));
      g.add(K.dots([man, woman, king, queen], { r: 0.13 }));
      // parallel sides: the same offset
      g.add(K.line([man, king], { o: 0.4, w: 1.2, dash: true }));
      g.add(K.line([woman, queen], { o: 0.4, w: 1.2, dash: true }));
      arr(g, man, woman, { c: 'acc', o: 1, w: 2.6, head: 0.34 });
      arr(g, king, pred, { c: 'acc', o: 1, w: 2.6, head: 0.34 });
      g.add(K.dots([pred], { r: 0.24, c: 'acc', hollow: true }));
      lab(g, 'man', add3(man, [-0.55, -0.42, 0]), { size: 0.55 });
      lab(g, 'woman', add3(woman, [0.35, -0.45, 0]), { size: 0.55 });
      lab(g, 'king', add3(king, [-0.6, 0.4, 0]), { size: 0.55 });
      lab(g, 'queen', add3(queen, [0.5, 0.5, 0]), { size: 0.55 });
      lab(g, 'king − man + woman ≈ queen', [0.2, 4.6, 0], { size: 0.5, c: 'acc' });
      legend = [{ c: 'acc', t: 'Analogy offset' }, { c: 'ink', t: 'Word vectors' }];
    } else if (kind === 'clip') {
      const D = K.V(1, 0.62, 1.25).normalize(), Rt = K.V(1.25, 0, -1).normalize(), Up = D.clone().cross(Rt).normalize();
      const R = 2.4, C = K.V(-1.2, 0, 0.6);
      const sph = G(); sph.position.copy(C); g.add(sph);
      wsphere(sph, R, { o: 0.08 });
      const ab = [[-0.62, 0.42], [0.55, 0.5], [-0.45, -0.5], [0.5, -0.42]];
      const img = [], txt = [];
      ab.forEach(([a, b]) => {
        const d = D.clone().multiplyScalar(0.75).add(Rt.clone().multiplyScalar(a)).add(Up.clone().multiplyScalar(b)).normalize();
        const t = Rt.clone().multiplyScalar(0.7).add(Up.clone().multiplyScalar(0.3)).normalize().multiplyScalar(0.2);
        img.push(d.clone().sub(t).normalize().multiplyScalar(R).add(C));
        txt.push(d.clone().add(t).normalize().multiplyScalar(R).add(C));
      });
      img.forEach((v, i) => {
        g.add(K.line([v, txt[i]], { c: 'acc', w: 2.8 }));
        g.add(K.box(v.x, v.y, v.z, 0.3, 0.3, 0.3, { fill: 0.75, fc: 'b', c: 'b' }));
      });
      g.add(K.dots(txt, { r: 0.17 }));
      lab(g, 'I₁', img[0].clone().add(Rt.clone().multiplyScalar(-0.45)), { size: 0.42, c: 'b' });
      lab(g, 'T₁', txt[0].clone().add(Rt.clone().multiplyScalar(0.45)).add(Up.clone().multiplyScalar(0.2)), { size: 0.42 });
      // I x T similarity matrix, turned to face the viewer
      const M = G(); M.position.set(3.6, 0.1, -1.4); M.rotation.y = Math.atan2(1, 1.25); g.add(M);
      const n = 4, cs = 0.66;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = (j - 1.5) * cs, y = (1.5 - i) * cs;
        M.add(K.rect(x, y, 0, cs * 0.9, cs * 0.9, 'xy', i === j ? { fill: 0.75, fc: 'acc', c: 'acc', o: 0.9 } : { fill: r.range(0.03, 0.12), o: 0.2 }));
      }
      for (let i = 0; i < n; i++) {
        M.add(K.label('I' + ['₁', '₂', '₃', '₄'][i], [-2.55 * cs, (1.5 - i) * cs, 0], { size: 0.36, c: 'b' }));
        M.add(K.label('T' + ['₁', '₂', '₃', '₄'][i], [(i - 1.5) * cs, 2.45 * cs, 0], { size: 0.36 }));
      }
      legend = [{ c: 'acc', t: 'Matching pairs' }, { c: 'b', t: 'Image embeddings' }, { c: 'ink', t: 'Text embeddings' }];
    } else if (kind === 'contrastive') {
      const R = 2.8;
      wsphere(g, R, { o: 0.07 });
      const cam = K.V(1, 0.62, 1.25).normalize();
      const a = cam.clone().add(K.V(-0.1, 0.05, 0)).normalize().multiplyScalar(R);
      const pPrev = cam.clone().add(K.V(0.45, -0.4, -0.25)).normalize().multiplyScalar(R);
      const pNow = a.clone().lerp(pPrev, 0.35).normalize().multiplyScalar(R);
      g.add(K.dots([a], { r: 0.16 }));
      g.add(K.dots([pPrev], { r: 0.12, c: 'acc', hollow: true, o: 0.6 }));
      g.add(K.dots([pNow], { r: 0.14, c: 'acc' }));
      g.add(K.line(slerpArc(pPrev, pNow, R * 1.01, 16), { c: 'acc', w: 2.2 }));
      arr(g, slerpArc(pPrev, pNow, R * 1.01, 16)[13], pNow.clone().multiplyScalar(1.0), { c: 'acc', w: 2.2, o: 1, head: 0.26 });
      const negs = [];
      const offs = [[-1.1, 0.5, 0.3], [-0.7, -0.8, 0.6], [0.2, 0.9, -0.9], [0.9, 0.6, -0.4], [-0.4, 1.1, 0.1], [0.6, -0.9, 0.2], [-1.0, -0.1, -0.6]];
      offs.forEach((o) => {
        const n0 = cam.clone().add(K.V(o[0] * 0.7, o[1] * 0.7, o[2] * 0.7)).normalize();
        const n1 = n0.clone().sub(a.clone().normalize().multiplyScalar(0.25)).normalize();
        negs.push(n0.clone().multiplyScalar(R));
        arr(g, n0.clone().multiplyScalar(R), n1.clone().multiplyScalar(R), { o: 0.55, w: 1.2, head: 0.18 });
      });
      g.add(K.dots(negs, { r: 0.12, hollow: true, o: 0.85 }));
      lab(g, 'x', a.clone().add(K.V(-0.15, 0.38, 0)), { size: 0.44 });
      lab(g, 'x⁺', pNow.clone().add(K.V(0.3, -0.3, 0.1)), { size: 0.44, c: 'acc' });
      lab(g, 'x⁻', negs[0].clone().add(K.V(-0.35, 0.3, 0)), { size: 0.44, o: 0.75 });
      legend = [{ c: 'acc', t: 'Positive pulled closer' }, { c: 'ink', t: 'Negatives pushed away' }];
    } else if (kind === 'retrieval') {
      const W = 7, D = 5, ys = [0, 1.5, 3];
      const N = 46, P = [];
      for (let i = 0; i < N; i++) P.push([r.range(-W / 2 + 0.3, W / 2 - 0.3), r.range(-D / 2 + 0.3, D / 2 - 0.3)]);
      const lvl = P.map((_, i) => (i < 5 ? 2 : i < 15 ? 1 : 0));
      const q = [1.9, 1.1];
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      let entry = 0, path = [];
      for (let L = 2; L >= 0; L--) {
        const ids = P.map((_, i) => i).filter((i) => lvl[i] >= L);
        const kk = L === 0 ? 3 : 2;
        const E = [];
        ids.forEach((i) => {
          ids.filter((j) => j !== i).sort((a, b) => dist(P[i], P[a]) - dist(P[i], P[b])).slice(0, kk).forEach((j) => E.push([i, j]));
        });
        const y = ys[L];
        g.add(K.rect(0, y, 0, W, D, 'xz', { o: 0.22, w: 1, fill: 0.025 }));
        g.add(K.segs(E.map(([i, j]) => [[P[i][0], y, P[i][1]], [P[j][0], y, P[j][1]]]), { o: 0.22 }));
        g.add(K.dots(ids.map((i) => [P[i][0], y, P[i][1]]), { r: L === 0 ? 0.06 : 0.085, o: 0.75 }));
        // greedy search
        const nb = (i) => E.filter((e) => e[0] === i).map((e) => e[1]).concat(E.filter((e) => e[1] === i).map((e) => e[0]));
        let cur = entry; const seg = [cur];
        for (let s = 0; s < 20; s++) {
          let best = cur;
          nb(cur).forEach((j) => { if (dist(P[j], q) < dist(P[best], q)) best = j; });
          if (best === cur) break;
          cur = best; seg.push(cur);
        }
        path.push({ L, seg, y });
        entry = cur;
        lab(g, 'L' + ['₀', '₁', '₂'][L], [-W / 2 - 0.5, y, D / 2], { size: 0.34, o: 0.6 });
      }
      // draw path
      const pts = [];
      path.forEach(({ seg, y }) => seg.forEach((i) => pts.push([P[i][0], y, P[i][1]])));
      g.add(K.line(pts, { c: 'acc', w: 2.4 }));
      // vertical drops
      const drops = [];
      for (let L = 2; L >= 1; L--) P.forEach((pp, i) => { if (lvl[i] >= L) drops.push([[pp[0], ys[L], pp[1]], [pp[0], ys[L - 1], pp[1]]]); });
      g.add(K.segs(drops, { o: 0.12 }));
      // query
      const qTop = [q[0], 4.5, q[1]];
      g.add(K.line([qTop, [q[0], 0, q[1]]], { c: 'acc', o: 0.35, w: 1, dash: true }));
      g.add(K.dots([qTop], { r: 0.15, c: 'acc' }));
      lab(g, 'q', [q[0] + 0.35, 4.75, q[1]], { size: 0.46, c: 'acc' });
      ys.forEach((y) => g.add(K.dots([[q[0], y, q[1]]], { r: 0.1, c: 'acc', hollow: true, o: 0.6 })));
      // hits
      const hits = P.map((_, i) => i).sort((a, b) => dist(P[a], q) - dist(P[b], q)).slice(0, 4);
      const rr = dist(P[hits[3]], q) + 0.12;
      g.add(K.line(ring(q[0], 0.01, q[1], rr, rr, 'xz'), { c: 'acc', w: 1.4, o: 0.8 }));
      g.add(K.dots(hits.map((i) => [P[i][0], 0, P[i][1]]), { r: 0.12, c: 'acc' }));
      legend = [{ c: 'acc', t: 'Search path & hits' }, { c: 'ink', t: 'Layered graph' }];
    } else { // sem
      const D = K.V(1, 0.62, 1.25).normalize(), Rt = K.V(1.25, 0, -1).normalize(), Up = D.clone().cross(Rt).normalize();
      const O = K.V(0, -1.6, 0), R = 3.4;
      const at = (deg, rad, dz) => { const a = deg * Math.PI / 180; return O.clone().add(Rt.clone().multiplyScalar(Math.cos(a) * rad)).add(Up.clone().multiplyScalar(Math.sin(a) * rad)).add(D.clone().multiplyScalar(dz || 0)); };
      // faint unit arc: embeddings are normalised, only direction matters
      const arcP = []; for (let k = 0; k <= 48; k++) arcP.push(at(180 * k / 48, R));
      g.add(K.line(arcP, { o: 0.15, w: 1 }));
      g.add(K.line([at(180, R + 0.3), at(0, R + 0.3)], { o: 0.15, w: 1 }));
      const cl = [158, 88, 18], pts = [];
      cl.forEach((c, ci) => {
        const offs = ci === 1 ? [-17, -13, 13, 18, -21, 22] : [-14, -9, -4, 4, 9, 14, -11, 11];
        offs.forEach((o) => pts.push(at(c + o + r.n() * 1.5, R + r.n() * 0.3, r.n() * 0.5)));
      });
      g.add(K.dots(pts, { r: 0.09, o: 0.7 }));
      g.add(K.dots([O], { r: 0.09 }));
      const q = at(88, R), n1 = at(80, R - 0.1, 0.25), n2 = at(96, R + 0.1, -0.25), far = at(18, R);
      arr(g, O, q, { c: 'acc', o: 1, w: 2.6, head: 0.3 });
      g.add(K.line([O, n1], { c: 'acc', o: 0.6, w: 1.2 }));
      g.add(K.line([O, n2], { c: 'acc', o: 0.6, w: 1.2 }));
      g.add(K.line([O, far], { o: 0.5, w: 1.2, dash: true }));
      g.add(K.dots([q], { r: 0.2, c: 'acc' }));
      g.add(K.dots([n1, n2], { r: 0.14, c: 'acc' }));
      g.add(K.dots([far], { r: 0.13 }));
      const a1 = []; for (let k = 0; k <= 12; k++) a1.push(at(80 + 16 * k / 12, 2.4));
      g.add(K.line(a1, { c: 'acc', w: 2 }));
      const a2 = []; for (let k = 0; k <= 30; k++) a2.push(at(18 + 70 * k / 30, 1.3));
      g.add(K.line(a2, { o: 0.5, w: 1.2, dash: true }));
      lab(g, 'q', at(88, R + 0.55), { size: 0.5, c: 'acc' });
      lab(g, 'cos ≈ 0.99', at(100, 2.4).add(Rt.clone().multiplyScalar(-1.05)), { size: 0.42, c: 'acc' });
      lab(g, 'cos ≈ 0.3', at(45, 1.3).add(Rt.clone().multiplyScalar(0.95)).add(Up.clone().multiplyScalar(-0.1)), { size: 0.38, o: 0.65 });
      legend = [{ c: 'acc', t: 'High cosine similarity' }, { c: 'ink', t: 'Sentence embeddings' }];
    }
    return { g, legend };
  };

  /* =====================================================================
     GEN
     ===================================================================== */
  VIZ.gen = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'gan', r = K.rng(7);
    let legend, tick;
    if (kind === 'gan') {
      // data panel
      const px0 = -0.6, px1 = 4.8;
      g.add(K.rect((px0 + px1) / 2, 0, 0, px1 - px0, 4.4, 'xz', { o: 0.3, w: 1, fill: 0.02 }));
      const real = [], fake = [], fake1 = [];
      const band = (t) => [2.1 + 1.6 * Math.cos(t), 0.04, 1.2 * Math.sin(t)];
      for (let i = 0; i < 36; i++) { const t = r.range(0.3, 2.9); const b = band(t); real.push([b[0] + r.n() * 0.12, 0.04, b[2] + r.n() * 0.12]); }
      for (let i = 0; i < 18; i++) {
        const t = r.range(0.4, 2.8), b = band(t);
        const off = [r.n() * 0.35 + 0.2, 0, r.n() * 0.4 - 0.9];
        fake.push([b[0] + off[0], 0.04, b[2] + off[2]]);
        fake1.push([b[0] + off[0] * 0.15, 0.04, b[2] + off[2] * 0.15]);
      }
      g.add(K.dots(real, { r: 0.085, c: 'b' }));
      const fg = G(); fg.add(K.dots(fake, { r: 0.1, c: 'acc', hollow: true })); g.add(fg);
      // discriminator boundary (vertical ribbon)
      const bpts = [];
      for (let i = 0; i <= 40; i++) { const t = 0.05 + 3.05 * i / 40; bpts.push([2.1 + 2.15 * Math.cos(t), 0, 1.55 * Math.sin(t) - 0.35]); }
      g.add(K.line(bpts, { w: 2 }));
      g.add(K.line(bpts.map((q) => [q[0], 0.9, q[2]]), { o: 0.3, w: 1 }));
      g.add(K.segs(bpts.filter((_, i) => i % 4 === 0).map((q) => [q, [q[0], 0.9, q[2]]]), { o: 0.18 }));
      // generator
      const zc = [];
      for (let i = 0; i < 40; i++) zc.push([-4.6 + r.n() * 0.25, 1.2 + r.n() * 0.3, r.n() * 0.3]);
      g.add(K.dots(zc, { r: 0.04, o: 0.6 }));
      lab(g, 'z', [-4.6, 2.1, 0], { size: 0.44 });
      mod(g, -2.5, 1.2, 0, 1.3, 1.3, 1.3, 'G', { c: 'acc' });
      arr(g, [-4.1, 1.2, 0], [-3.25, 1.2, 0], { o: 0.6 });
      carr(g, [[-1.8, 1.2, 0], [0.2, 0.9, -0.5], [1.2, 0.25, -0.9]], { c: 'acc', w: 1.8, o: 0.9 });
      mod(g, 2.1, 3.2, -0.3, 1.3, 1.3, 1.3, 'D');
      g.add(K.line([[2.1, 2.5, -0.3], [2.1, 1.0, -0.3]], { o: 0.4, w: 1, dash: true }));
      arr(g, [2.85, 3.2, -0.3], [4.0, 3.2, -0.3], { o: 0.6 });
      lab(g, '0 / 1', [4.6, 3.2, -0.3], { size: 0.36, mono: true });
      tick = (t) => {
        const a = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t % 6) / 6);
        fg.children[0].children.forEach((m, i) => { const q = lerp3(fake[i], fake1[i], a * 0.6); m.position.set(q[0], q[1], q[2]); });
      };
      legend = [{ c: 'acc', t: 'Generated samples' }, { c: 'b', t: 'Real data' }, { c: 'ink', t: 'Discriminator boundary' }];
    } else if (kind === 'vae') {
      pix(g, -5, 0, 0, 7, 2.2, sunImg(7));
      lab(g, 'x', [-5, 1.55, 0], { size: 0.44 });
      funnel(g, -3.8, -1.8, 2.2, 0.8, { t: 'E' });
      const C = [0.2, 0, 0];
      g.add(K.line(ring(C[0], C[1], C[2], 1.0, 1.25, 'xy'), { c: 'acc', w: 2 }));
      g.add(K.line(ring(C[0], C[1], C[2], 1.0, 0.75, 'xz'), { c: 'acc', w: 1.4, o: 0.7 }));
      g.add(K.line(ring(C[0], C[1], C[2], 1.25, 0.75, 'yz'), { c: 'acc', w: 1.4, o: 0.7 }));
      const smp = [];
      for (let i = 0; i < 60; i++) smp.push([C[0] + r.n() * 0.38, C[1] + r.n() * 0.48, C[2] + r.n() * 0.28]);
      g.add(K.dots(smp, { r: 0.04, c: 'acc', o: 0.55 }));
      g.add(K.dots([C], { r: 0.09 }));
      const z = [0.55, 0.42, 0.2];
      g.add(K.dots([z], { r: 0.13, c: 'acc' }));
      g.add(K.line([C, [C[0], C[1] + 1.25, C[2]]], { o: 0.5, w: 1, dash: true }));
      lab(g, 'μ', [C[0] - 0.3, C[1] - 0.25, C[2]], { size: 0.4 });
      lab(g, 'σ', [C[0] - 0.3, C[1] + 0.75, C[2]], { size: 0.4 });
      lab(g, 'z', [z[0] + 0.3, z[1] + 0.3, z[2]], { size: 0.42, c: 'acc' });
      lab(g, 'N(μ, σ²)', [C[0], C[1] + 1.75, C[2]], { size: 0.36, c: 'acc' });
      arr(g, [-1.75, 0, 0], [-0.85, 0, 0], { o: 0.6 });
      arr(g, [1.25, 0.1, 0.1], [2.15, 0, 0], { c: 'acc', o: 0.9 });
      funnel(g, 2.2, 4.2, 0.8, 2.2, { t: 'D' });
      pix(g, 5.4, 0, 0, 7, 2.2, (i, j) => sunImg(7)(i, j) * 0.8, { op: 0.45 });
      lab(g, 'x̂', [5.4, 1.55, 0], { size: 0.44 });
      legend = [{ c: 'acc', t: 'Latent distribution' }, { c: 'ink', t: 'Encoder and decoder' }];
    } else if (kind === 'diffusion' && !p.latent) {
      const shape = [];
      for (let i = 0; i < 150; i++) {
        const t = 2 * Math.PI * i / 150, rr = 0.62 + 0.22 * Math.cos(5 * t);
        shape.push([rr * Math.cos(t), rr * Math.sin(t)]);
      }
      const eps = shape.map(() => [r.n() * 0.42, r.n() * 0.42, r.n() * 0.12]);
      const N = 5, sp = 2.45, S = 2.0;
      for (let k = 0; k < N; k++) {
        const ab = k / (N - 1); // 0 = pure noise (left), 1 = clean (right)
        const a = Math.pow(ab, 1.3), s = Math.sqrt(1 - a * a);
        const cx = -sp * 2 + k * sp;
        g.add(K.rect(cx, 0, 0, S, S, 'xy', { o: 0.25, w: 1 }));
        const pts = shape.map((q, i) => [cx + a * q[0] + s * eps[i][0], a * q[1] + s * eps[i][1], s * eps[i][2]]);
        g.add(K.dots(pts, { r: 0.035, o: 0.85 }));
        if (k < N - 1) {
          carr(g, [[cx + 0.5, 1.15, 0], [cx + sp / 2, 1.55, 0], [cx + sp - 0.5, 1.15, 0]], { c: 'acc', w: 2, o: 1, head: 0.2 });
          carr(g, [[cx + sp - 0.5, -1.15, 0], [cx + sp / 2, -1.45, 0], [cx + 0.5, -1.15, 0]], { o: 0.35, w: 1, dash: true, head: 0.16 });
        }
      }
      lab(g, 'x_T', [-sp * 2, -1.95, 0], { size: 0.4 });
      lab(g, 'x₀', [sp * 2, -1.95, 0], { size: 0.4 });
      lab(g, 'p_θ', [0, 2.1, 0], { size: 0.42, c: 'acc' });
      lab(g, 'q', [0, -1.95, 0], { size: 0.38, o: 0.55 });
      legend = [{ c: 'acc', t: 'Reverse denoising' }, { c: 'ink', t: 'Forward noising' }];
    } else if (kind === 'diffusion') { // latent diffusion
      pix(g, -5.6, 0, 0, 7, 2.0, sunImg(7));
      lab(g, 'x', [-5.6, 1.45, 0], { size: 0.42 });
      funnel(g, -4.4, -3.1, 2.0, 0.9, { t: 'E' });
      g.add(K.box(0, 0, 0, 5.6, 1.6, 1.6, { fill: 0.03, o: 0.55 }));
      const shape = [];
      for (let i = 0; i < 70; i++) { const t = 2 * Math.PI * i / 70, rr = 0.3 + 0.1 * Math.cos(5 * t); shape.push([rr * Math.cos(t), rr * Math.sin(t)]); }
      const eps = shape.map(() => [r.n() * 0.2, r.n() * 0.2, r.n() * 0.08]);
      const N = 4, sp = 1.3;
      for (let k = 0; k < N; k++) {
        const ab = k / (N - 1), a = Math.pow(ab, 1.3), s = Math.sqrt(1 - a * a);
        const cx = -1.95 + k * sp;
        g.add(K.rect(cx, 0, 0, 0.95, 0.95, 'xy', { o: 0.22, w: 1 }));
        g.add(K.dots(shape.map((q, i) => [cx + a * q[0] + s * eps[i][0], a * q[1] + s * eps[i][1], s * eps[i][2]]), { r: 0.025, o: 0.85 }));
        if (k < N - 1) carr(g, [[cx + 0.3, 0.55, 0], [cx + sp / 2, 0.72, 0], [cx + sp - 0.3, 0.55, 0]], { c: 'acc', w: 2, o: 1, head: 0.14 });
      }
      lab(g, 'z_T', [-1.95, -1.15, 0.8], { size: 0.34 });
      lab(g, 'z₀', [1.95, -1.15, 0.8], { size: 0.34 });
      funnel(g, 3.1, 4.4, 0.9, 2.0, { t: 'D' });
      pix(g, 5.6, 0, 0, 7, 2.0, sunImg(7));
      lab(g, 'x̂', [5.6, 1.45, 0], { size: 0.42 });
      lab(g, 'p_θ', [0, 1.25, 0], { size: 0.4, c: 'acc' });
      legend = [{ c: 'acc', t: 'Denoising in latent space' }, { c: 'ink', t: 'Encoder and decoder' }];
    } else if (kind === 'flow') {
      const N = 26, X0 = -4, X1 = 4;
      const noise = [], data = [];
      for (let i = 0; i < N; i++) noise.push([X0, r.n() * 0.75, r.n() * 0.75]);
      for (let i = 0; i < N; i++) {
        const t = 2 * Math.PI * i / N, rr = 1.25;
        data.push([X1, rr * Math.sin(t) * (1 + 0.25 * Math.cos(2 * t)), rr * Math.cos(t)]);
      }
      // pair by angle (straight, near-non-crossing paths)
      const ang = (q) => Math.atan2(q[1], q[2]);
      const ns = noise.slice().sort((a, b) => ang(a) - ang(b)), ds = data.slice().sort((a, b) => ang(a) - ang(b));
      g.add(K.rect(X0, 0, 0, 3.4, 3.4, 'yz', { o: 0.3, w: 1 }));
      g.add(K.rect(X1, 0, 0, 3.4, 3.4, 'yz', { o: 0.3, w: 1 }));
      g.add(K.rect(0, 0, 0, 3.4, 3.4, 'yz', { o: 0.12, w: 1 }));
      g.add(K.segs(ns.map((a, i) => [a, ds[i]]), { c: 'acc', o: 0.45 }));
      ns.forEach((a, i) => { if (i % 3 === 0) arr(g, lerp3(a, ds[i], 0.42), lerp3(a, ds[i], 0.58), { c: 'acc', o: 1, w: 1.6, head: 0.2 }); });
      g.add(K.dots(noise, { r: 0.07, o: 0.8 }));
      g.add(K.dots(data, { r: 0.08 }));
      const mv = K.dots(ns.map((a, i) => lerp3(a, ds[i], 0.2)), { r: 0.06, c: 'acc' });
      g.add(mv);
      lab(g, 'x₀ ~ N(0, I)', [X0, -2.2, 0], { size: 0.36 });
      lab(g, 'x₁ ~ data', [X1, -2.2, 0], { size: 0.36 });
      lab(g, 'v_θ(x, t)', [0, 2.2, 0], { size: 0.4, c: 'acc' });
      g.add(K.arrow([X0, -2.8, 1.7], [X1, -2.8, 1.7], { o: 0.4, w: 1, head: 0.2 }));
      lab(g, 't', [X1 + 0.4, -2.8, 1.7], { size: 0.38, o: 0.6 });
      const M4 = new T.Matrix4();
      tick = (t) => {
        const u = (t % 6) / 6;
        ns.forEach((a, i) => { const q = lerp3(a, ds[i], (0.2 + u) % 1); M4.makeScale(0.06, 0.06, 0.06); M4.setPosition(q[0], q[1], q[2]); mv.setMatrixAt(i, M4); });
        mv.instanceMatrix.needsUpdate = true;
      };
      legend = [{ c: 'acc', t: 'Vector field paths' }, { c: 'ink', t: 'Noise and data samples' }];
    } else { // dlm
      g.rotation.y = 0.45;
      const words = ['the', 'cat', 'sat', 'on', 'mat'];
      const step = [2, 1, 3, 2, 1]; // denoising step at which each position is revealed
      const n = words.length, w = 0.95, sp = 1.15, X = (i) => (i - (n - 1) / 2) * sp;
      const Y = (s) => s * 1.25, Z = (s) => -s * 0.7;
      for (let s = 0; s <= 3; s++) {
        const y = Y(s), z = Z(s);
        g.add(K.rect(0, y - 0.4, z, n * sp + 0.3, 1.0, 'xz', { o: 0.12, w: 1 }));
        for (let i = 0; i < n; i++) {
          const x = X(i);
          if (step[i] > s) { // still masked
            g.add(K.box(x, y, z, w, 0.55, 0.45, { fill: 0.02, o: 0.3 }));
            g.add(K.dots([[x, y, z + 0.23]], { r: 0.05, o: 0.4 }));
          } else if (step[i] === s) { // revealed in parallel at this step
            g.add(K.box(x, y, z, w, 0.55, 0.45, { fill: 0.4, fc: 'acc', c: 'acc' }));
            lab(g, words[i], [x, y, z + 0.25], { size: 0.36, mono: true, c: 'acc' });
            g.add(K.line([[x, Y(s - 1) + 0.3, Z(s - 1)], [x, y - 0.3, z]], { c: 'acc', o: 0.7, w: 1.4 }));
          } else {
            g.add(K.box(x, y, z, w, 0.55, 0.45, { fill: 0.06, o: 0.55 }));
            lab(g, words[i], [x, y, z + 0.25], { size: 0.36, mono: true, o: 0.75 });
          }
        }
      }
      lab(g, '[M]', [X(0) - 1.05, Y(0), Z(0)], { size: 0.34, mono: true, o: 0.6 });
      const ax = X(n - 1) + 0.95;
      g.add(K.arrow([ax, Y(0), Z(0)], [ax, Y(3), Z(3)], { o: 0.4, w: 1, head: 0.22 }));
      legend = [{ c: 'acc', t: 'Newly unmasked tokens' }, { c: 'ink', t: 'Masked tokens' }];
    }
    return { g, legend, tick };
  };

  /* =====================================================================
     TOKENS
     ===================================================================== */
  VIZ.tokens = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'split', r = K.rng(11);
    let legend;
    const cw = 0.24; // width per character
    if (kind === 'split') {
      g.rotation.y = 0.45;
      // pieces: [text, raw chars, id, word index]
      const toks = [['un', 2, 403, 0], ['believ', 6, 12387, 0], ['able', 4, 540, 0], ['▁token', 6, 11241, 1], ['s', 1, 82, 1]];
      const widths = toks.map((t) => Math.max(0.8, t[0].length * 0.2 + 0.4));
      const gaps = [0.3, 0.3, 0.85, 0.3];
      const total = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
      // raw text
      const chW = 0.19, nch = 19, tw = nch * chW + 0.5, yT = 2.7;
      g.add(K.rect(0, yT, 0, tw, 0.7, 'xy', { fill: 0.04, o: 0.45 }));
      lab(g, 'unbelievable tokens', [0, yT, 0.02], { size: 0.42, mono: true });
      let x = -total / 2, ch = 0;
      toks.forEach((t, i) => {
        const w = widths[i], cx = x + w / 2;
        const tx = -nch * chW / 2 + (ch + t[1] / 2) * chW;
        // raw span -> piece
        g.add(K.line([[tx - t[1] * chW / 2 + 0.03, yT - 0.42, 0], [tx + t[1] * chW / 2 - 0.03, yT - 0.42, 0]], { c: 'acc', w: 1.6, o: 0.8 }));
        g.add(K.line([[tx, yT - 0.42, 0], [cx, 1.42, 0]], { c: 'acc', o: 0.45, w: 1 }));
        tok(g, cx, 1.05, 0, w, t[0], { c: 'acc', mono: true, size: 0.4, fill: 0.2, lc: 'acc', h: 0.7, d: 0.3 });
        // piece -> integer id
        arr(g, [cx, 0.62, 0], [cx, 0.0, 0], { o: 0.45, w: 1, head: 0.16 });
        g.add(K.rect(cx, -0.38, 0, w, 0.62, 'xy', { o: 0.5, fill: 0.05 }));
        lab(g, String(t[2]), [cx, -0.38, 0.02], { size: 0.36, mono: true });
        x += w + (gaps[i] || 0); ch += t[1];
      });
      legend = [{ c: 'acc', t: 'Subword pieces' }, { c: 'ink', t: 'Token ids' }];
    } else if (kind === 'selfsup') {
      g.rotation.y = 0.45;
      // one unlabeled sentence produces both the input and its own target
      const words = ['the', 'cat', 'sat', 'on', 'mat'], hid = 1;
      const sp = 1.05, n = words.length, X = (i) => -3.2 + i * sp, yD = 3.0, yI = 1.0;
      g.add(K.rect((X(0) + X(n - 1)) / 2, yD, -0.3, n * sp + 0.3, 0.95, 'xy', { o: 0.3, fill: 0.025 }));
      lab(g, 'x', [X(0) - 0.95, yD, 0], { size: 0.46 });
      words.forEach((w, i) => {
        const h = i === hid;
        tok(g, X(i), yD, 0, 0.88, w, { c: h ? 'acc' : undefined, fill: h ? 0.35 : 0.05, mono: true, size: 0.36, lc: h ? 'acc' : undefined });
        if (!h) g.add(K.line([[X(i), yD - 0.32, 0], [X(i), yI + 0.32, 0]], { o: 0.25, w: 1 }));
        // derived input: same tokens, one hidden
        if (h) {
          g.add(K.box(X(i), yI, 0, 0.88, 0.55, 0.55, { fill: 0.02, c: 'acc', o: 0.6 }));
          lab(g, '[M]', [X(i), yI, 0.3], { size: 0.3, mono: true, c: 'acc' });
        } else tok(g, X(i), yI, 0, 0.88, null, { fill: 0.05, o: 0.45 });
      });
      // model -> prediction
      const fx = X(n - 1) + 1.75;
      g.add(K.line([[X(n - 1) + 0.5, yI, 0], [fx - 0.75, yI, 0]], { o: 0.45, w: 1 }));
      mod(g, fx, yI, 0, 1.3, 1.1, 1.1, 'f', { size: 0.5 });
      arr(g, [fx + 0.7, yI, 0], [fx + 1.5, yI, 0], { o: 0.7, head: 0.2 });
      lab(g, 'ŷ', [fx + 1.85, yI, 0], { size: 0.48 });
      // the target is copied from the data itself
      carr(g, [[X(hid), yD + 0.35, 0], [X(hid) + 1.5, yD + 1.35, 0], [fx + 0.5, yD + 1.25, 0], [fx + 1.75, yD + 0.45, 0]], { c: 'acc', w: 2.2, o: 1, head: 0.24 });
      tok(g, fx + 1.85, yD, 0, 0.88, 'cat', { c: 'acc', fill: 0.4, mono: true, size: 0.36, lc: 'acc' });
      lab(g, 'y', [fx + 2.6, yD, 0], { size: 0.46, c: 'acc' });
      g.add(K.line([[fx + 1.85, yD - 0.35, 0], [fx + 1.85, yI + 0.35, 0]], { c: 'acc', o: 0.6, w: 1.2, dash: true }));
      lab(g, 'ℒ', [fx + 2.25, (yD + yI) / 2, 0], { size: 0.42, c: 'acc' });
      legend = [{ c: 'acc', t: 'Target from the data' }, { c: 'ink', t: 'Unlabeled input' }];
    } else if (kind === 'bpe') {
      const rows = [['h', 'u', 'g', 's'], ['hu', 'g', 's'], ['hug', 's'], ['hugs']];
      const merged = [-1, 0, 0, 0];
      const unit = 0.75, rowH = 1.25;
      rows.forEach((row, ri) => {
        let x = -1.9, y = ri * rowH, z = -ri * 0.35;
        row.forEach((t, k) => {
          const w = t.length * unit - 0.1, cx = x + w / 2;
          const isM = k === merged[ri];
          tok(g, cx, y, z, w, t, { c: isM ? 'acc' : undefined, mono: true, size: 0.36, fill: isM ? 0.4 : 0.06, lc: isM ? 'acc' : undefined });
          if (isM && ri > 0) {
            // connectors to the parts below
            const prev = rows[ri - 1];
            let px = -1.9, a = [];
            prev.forEach((pt, pk) => { const pw = pt.length * unit - 0.1; if (pk <= 1) a.push(px + pw / 2); px += pw + 0.1; });
            a.forEach((ax) => g.add(K.line([[ax, y - rowH + 0.3, z + 0.35], [cx, y - 0.3, z]], { c: 'acc', o: 0.8, w: 1.4 })));
          }
          x += w + 0.1;
        });
      });
      lab(g, '+1 merge', [2.1, 1.85, -0.5], { size: 0.3, mono: true, o: 0 });
      legend = [{ c: 'acc', t: 'Merged pair' }, { c: 'ink', t: 'Current tokens' }];
    } else if (kind === 'mlm') {
      const words = ['the', '[M]', 'sat', 'on', 'the', '[M]'];
      const sp = 1.15, n = words.length;
      const X = (i) => (i - (n - 1) / 2) * sp;
      words.forEach((w, i) => {
        const m = w === '[M]';
        tok(g, X(i), 0, 0, 0.95, w, { c: m ? 'acc' : undefined, fill: m ? 0.25 : 0.06, mono: true, size: m ? 0.28 : 0.32, lc: m ? 'acc' : undefined });
      });
      mod(g, 0, 1.75, -0.2, n * sp + 0.2, 0.9, 1.4, 'BERT', { size: 0.44, lz: 0.75 });
      words.forEach((w, i) => { if (w !== '[M]') g.add(K.line([[X(i), 0.3, 0], [X(i), 1.3, 0]], { o: 0.25, w: 1 })); });
      const preds = { 1: [['cat', 0.7], ['dog', 0.2]], 5: [['mat', 0.6], ['sofa', 0.25]] };
      Object.keys(preds).forEach((k) => {
        const x = X(+k);
        arr(g, [x, 0.3, 0.1], [x, 1.3, 0.1], { c: 'acc', o: 0.9 });
        arr(g, [x, 2.2, 0.1], [x, 3.0, 0.1], { c: 'acc', o: 0.9 });
        const [top, sec] = preds[k];
        tok(g, x, 3.35, 0.1, 0.95, top[0], { c: 'acc', fill: 0.5, mono: true, size: 0.32 });
        // probability bars receding in depth
        [top[1], sec[1], 0.1, 0.05].forEach((v, j) => g.add(K.box(x + 0.75, 2.95 + v * 1.0, -0.5 * j + 0.1, 0.22, v * 2.0, 0.22, j === 0 ? { fill: 0.6, fc: 'acc', c: 'acc' } : { fill: 0.08, o: 0.4 })));
      });
      legend = [{ c: 'acc', t: 'Masked tokens' }, { c: 'ink', t: 'Visible context' }];
    } else if (kind === 'prefix') {
      mod(g, 0.1, 2.5, 0, 7.6, 1.1, 1.6, 'LLM', { size: 0.5, lz: 0.85 });
      lab(g, '❄', [3.5, 2.5, 0.85], { size: 0.42, o: 0.6 });
      const sp = 0.85;
      const nP = 4, words = ['the', 'cat', 'sat', 'on'];
      for (let i = 0; i < nP; i++) {
        const x = -3.1 + i * sp;
        vec(g, x, 0.4, 0, 5, { c: 'acc', s: 0.28 });
        g.add(K.line([[x, 1.25, 0], [x, 1.9, 0]], { c: 'acc', w: 1.4, o: 0.8 }));
      }
      words.forEach((w, i) => {
        const x = 0.7 + i * sp;
        vec(g, x, 0.4, 0, 5, { s: 0.28, fill: 0.05, o: 0.45 });
        g.add(K.line([[x, 1.25, 0], [x, 1.9, 0]], { o: 0.3, w: 1 }));
        lab(g, w, [x, -0.65, 0], { size: 0.3, mono: true });
      });
      lab(g, 'P₁ … P₄', [-1.83, -0.65, 0], { size: 0.32, c: 'acc' });
      carr(g, [[-1.8, 4.3, 0.3], [-1.8, 3.6, 1.6], [-1.8, 1.4, 0.8]], { c: 'acc', dash: true, w: 1.4, head: 0.2 });
      lab(g, '∇', [-1.8, 4.55, 0.3], { size: 0.42, c: 'acc' });
      legend = [{ c: 'acc', t: 'Trainable soft prompt' }, { c: 'ink', t: 'Frozen model & inputs' }];
    } else { // prompt
      const cards = [['<system>', 0, 0.55], ['<instruction>', 0, 0.55], ['Q₁ → A₁', 1, 0.5], ['Q₂ → A₂', 1, 0.5], ['Q₃ → A₃', 1, 0.5], ['Q → ?', 0, 0.55]];
      const W = 4.4;
      cards.forEach((c, i) => {
        const y = 2.8 - i * 0.82, z = 0;
        g.add(K.box(-1.4, y, z, W, 0.62, 0.14, c[1] ? { fill: 0.35, fc: 'acc', c: 'acc' } : { fill: 0.05, o: 0.6 }));
        lab(g, c[0], [-1.4, y, z + 0.1], { size: 0.32, mono: true, c: c[1] ? 'acc' : undefined });
      });
      g.add(K.line([[-3.9, 3.2, 0], [-3.9, -1.5, 0]], { o: 0.3, w: 1 }));
      carr(g, [[0.9, 0.7, 0], [1.6, 0.7, 0], [2.3, 0.7, 0]], { o: 0.7 });
      mod(g, 3.4, 0.7, 0, 1.8, 1.8, 1.8, 'LLM');
      arr(g, [4.35, 0.7, 0], [5.3, 0.7, 0], { o: 0.7 });
      tok(g, 5.75, 0.7, 0, 0.7, 'A', { mono: true, size: 0.34 });
      legend = [{ c: 'acc', t: 'Few-shot examples' }, { c: 'ink', t: 'Prompt sections' }];
    }
    return { g, legend };
  };

  /* =====================================================================
     FLOW (systems)
     ===================================================================== */
  VIZ.flow = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'rl', r = K.rng(5);
    let legend, tick, ctl;
    const fn = FLOW[kind] || FLOW.rl;
    const res = fn(g, p, r) || {};
    legend = res.legend; tick = res.tick; ctl = res.ctl;
    return { g, legend, tick, ctl };
  };

  /* moving marker along a sampled path */
  function mover(g, P, o) {
    const m = K.dots([P[0]], { r: (o && o.r) || 0.1, c: (o && o.c) || 'acc' });
    g.add(m);
    const M4 = new T.Matrix4();
    return (u) => { const k = Math.min(P.length - 1, Math.floor(u * (P.length - 1))); const q = P[k]; M4.makeScale(m.__r || 0.1, m.__r || 0.1, m.__r || 0.1); M4.setPosition(q.x, q.y, q.z); m.setMatrixAt(0, M4); m.instanceMatrix.needsUpdate = true; };
  }

  const FLOW = {
    rl(g) {
      mod(g, -2.8, 0, 0, 1.6, 1.6, 1.6, 'π', { size: 0.6 });
      mod(g, 2.8, 0, 0, 2, 2, 2, 'env', { size: 0.46 });
      carr(g, [[-2.0, 0.9, 0], [0, 2.2, 0], [1.8, 1.05, 0]], { w: 1.8 });
      lab(g, 'aₜ', [0, 2.6, 0], { size: 0.44 });
      carr(g, [[1.8, -0.75, 0.6], [0, -1.8, 0.6], [-2.0, -0.6, 0.6]], { w: 1.4, o: 0.55 });
      lab(g, 'sₜ₊₁', [0, -1.45, 0.75], { size: 0.38, o: 0.7 });
      const P = carr(g, [[1.8, -0.9, -0.5], [0, -2.6, -0.5], [-2.0, -0.75, -0.5]], { c: 'acc', w: 2.4, o: 1 });
      lab(g, 'rₜ₊₁', [0, -3.05, -0.5], { size: 0.44, c: 'acc' });
      const mv = mover(g, P);
      return { legend: [{ c: 'acc', t: 'Reward signal' }, { c: 'ink', t: 'Action and state' }], tick: (t) => mv((t % 3) / 3) };
    },
    stack(g) {
      g.add(K.box(0, -2.2, 0, 6.6, 0.4, 1.4, { fill: 0.06, o: 0.5 }));
      lab(g, 'X', [-3.8, -2.2, 0], { size: 0.42 });
      const xs = [-2.4, 0, 2.4];
      xs.forEach((x, i) => {
        arr(g, [x, -2.0, 0], [x, -0.75, 0], { o: 0.4, w: 1 });
        mod(g, x, 0, 0, 1.4, 1.4, 1.4, 'h' + ['₁', '₂', '₃'][i]);
        g.add(K.box(x, 1.25, 0, 0.32, 0.32, 0.32, { fill: 0.6, fc: 'acc', c: 'acc' }));
        g.add(K.line([[x, 0.7, 0], [x, 1.09, 0]], { o: 0.35, w: 1 }));
        arr(g, [x, 1.42, 0], [x * 0.25, 2.6, 0], { c: 'acc', o: 0.9, w: 1.8 });
      });
      mod(g, 0, 3.3, 0, 1.6, 1.3, 1.4, 'g', { c: 'acc', size: 0.52 });
      arr(g, [0, 3.95, 0], [0, 4.8, 0], { c: 'acc', o: 0.9 });
      lab(g, 'ŷ', [0, 5.15, 0], { size: 0.46, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Meta-model' }, { c: 'ink', t: 'Base models' }] };
    },
    vote(g) {
      const votes = ['A', 'A', 'B', 'A', 'B'];
      votes.forEach((v, i) => {
        const a = (i - 2) * 0.42, x = Math.sin(a) * 4.2, z = Math.cos(a) * 4.2 - 4.2;
        mod(g, x, 0, z, 1.0, 1.0, 1.0, 'h' + ['₁', '₂', '₃', '₄', '₅'][i], { size: 0.36 });
        const c = v === 'A' ? 'acc' : 'b';
        g.add(K.box(x, 1.0, z, 0.36, 0.36, 0.36, { fill: 0.7, fc: c, c }));
        arr(g, [x, 1.25, z], [v === 'A' ? -0.55 : 0.55, 2.75, -1.4], { c, o: 0.55, w: 1.2, head: 0.18 });
      });
      // tallies
      [0, 1, 2].forEach((k) => g.add(K.box(-0.55, 3.0 + k * 0.4, -1.4, 0.36, 0.36, 0.36, { fill: 0.7, fc: 'acc', c: 'acc' })));
      [0, 1].forEach((k) => g.add(K.box(0.55, 3.0 + k * 0.4, -1.4, 0.36, 0.36, 0.36, { fill: 0.7, fc: 'b', c: 'b' })));
      lab(g, 'A', [-1.1, 3.4, -1.4], { size: 0.4, c: 'acc' });
      lab(g, 'B', [1.1, 3.2, -1.4], { size: 0.4, c: 'b' });
      arr(g, [-0.55, 4.3, -1.4], [-0.55, 5.0, -1.4], { c: 'acc', o: 0.9 });
      lab(g, 'ŷ = A', [-0.55, 5.35, -1.4], { size: 0.42, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Majority vote' }, { c: 'b', t: 'Minority vote' }] };
    },
    icl(g) {
      g.add(K.rect(-2.9, -0.36, 0, 5.6, 1.1, 'xz', { o: 0.3, w: 1, fill: 0.03 }));
      const xs = [-5.2, -4.55, -3.75, -3.1, -2.3, -1.65];
      const lb = ['x₁', 'y₁', 'x₂', 'y₂', 'x₃', 'y₃'];
      xs.forEach((x, i) => tok(g, x, 0, 0, 0.58, lb[i], { c: 'acc', fill: i % 2 ? 0.55 : 0.2, size: 0.3, lc: 'acc' }));
      tok(g, -0.6, 0, 0, 0.58, 'x', { size: 0.32 });
      arr(g, [-0.15, 0, 0], [0.75, 0, 0], { o: 0.7 });
      mod(g, 2.0, 0, 0, 2.2, 2.0, 2.0, 'LLM', { size: 0.5 });
      lab(g, '❄', [2.0, 1.35, 0], { size: 0.42, o: 0.6 });
      arr(g, [3.15, 0, 0], [4.1, 0, 0], { o: 0.7 });
      tok(g, 4.5, 0, 0, 0.58, 'ŷ', { size: 0.34 });
      carr(g, [[-3.4, 0.5, 0], [-1.2, 1.7, 0], [0.85, 0.8, 0]], { c: 'acc', w: 1.8, o: 0.85 });
      return { legend: [{ c: 'acc', t: 'In-context examples' }, { c: 'ink', t: 'Frozen model' }] };
    },
    pretrain(g) {
      g.rotation.y = 0.45;
      // massive unlabeled corpus: a tall stack of pages
      const cx = -5.4, nP = 12;
      for (let k = 0; k < nP; k++) {
        const y = -0.55 + k * 0.24;
        g.add(K.box(cx, y, 0, 1.5, 0.05, 1.7, { fill: 0.06, o: 0.25 + 0.35 * k / nP }));
      }
      const top = -0.55 + (nP - 1) * 0.24 + 0.03, lines = [];
      for (let j = 0; j < 5; j++) {
        const z = -0.6 + j * 0.3; let x = cx - 0.6;
        while (x < cx + 0.55) { const w = 0.12 + ((j * 7 + Math.round(x * 10)) % 4) * 0.06; lines.push([[x, top, z], [Math.min(x + w, cx + 0.62), top, z]]); x += w + 0.08; }
      }
      g.add(K.segs(lines, { o: 0.45 }));
      lab(g, '10¹²', [cx, top + 0.5, 0], { size: 0.4, o: 0.7 });
      // a stream of tokens flowing from the corpus into the sequence
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        g.add(K.box(cx + 1.05 + t * 1.05, 0.55 - t * 0.5, 0, 0.22, 0.22, 0.22, { fill: 0.1, o: 0.25 + 0.4 * t }));
      }
      const words = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
      const sp = 1.12, X = (i) => -2.7 + i * sp, n = 5;
      // inputs
      for (let i = 0; i < n; i++) {
        tok(g, X(i), 0, 0, 0.9, words[i], { mono: true, size: 0.36 });
        g.add(K.line([[X(i), 0.3, 0], [X(i), 1.05, 0]], { o: 0.3, w: 1 }));
      }
      const lx = (X(0) + X(n - 1)) / 2;
      mod(g, lx, 1.55, 0, n * sp + 0.3, 0.9, 1.2, 'LLM', { size: 0.46, lz: 0.62 });
      // next-token targets, shifted by one position
      for (let i = 0; i < n; i++) {
        arr(g, [X(i), 2.02, 0], [X(i), 2.75, 0], { c: 'acc', o: 0.9, w: 1.5, head: 0.18 });
        tok(g, X(i), 3.05, 0, 0.9, words[i + 1], { c: 'acc', fill: 0.3, mono: true, size: 0.36, lc: 'acc' });
      }
      // prediction distribution for the last position, receding in depth
      const ps = [0.85, 0.3, 0.18, 0.1, 0.06], bx = X(n - 1) + 0.85;
      ps.forEach((v, j) => g.add(K.box(bx + j * 0.3, 2.78 + v * 0.75, 0, 0.22, v * 1.5, 0.22, j === 0 ? { fill: 0.65, fc: 'acc', c: 'acc' } : { fill: 0.07, o: 0.4 })));
      return { legend: [{ c: 'acc', t: 'Next-token target' }, { c: 'ink', t: 'Token stream' }] };
    },
    sft(g) {
      for (let k = 0; k < 4; k++) {
        const z = -k * 0.5, y = k * 0.18, o = 1 - k * 0.2;
        g.add(K.box(-4.0, y, z, 1.5, 0.7, 0.1, { fill: 0.05, o: 0.6 * o }));
        g.add(K.box(-2.35, y, z, 1.6, 0.7, 0.1, { fill: 0.45 * o, fc: 'acc', c: 'acc', o: 0.95 * o }));
      }
      lab(g, 'x', [-4.0, 0, 0.1], { size: 0.38 });
      lab(g, 'y', [-2.35, 0, 0.1], { size: 0.38, c: 'acc' });
      arr(g, [-1.4, 0.2, 0], [0.0, 0.2, 0], { o: 0.7 });
      mod(g, 1.3, 0.2, 0, 2.2, 2.0, 2.0, 'LLM', { size: 0.5 });
      arr(g, [2.45, 0.2, 0], [3.5, 0.2, 0], { o: 0.7 });
      lab(g, 'ℒ(ŷ, y)', [4.4, 0.2, 0], { size: 0.38 });
      carr(g, [[4.4, -0.25, 0], [3.0, -1.6, 0], [1.3, -0.85, 0]], { c: 'acc', dash: true, w: 1.6 });
      lab(g, '∇', [2.9, -1.95, 0], { size: 0.42, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Target responses' }, { c: 'ink', t: 'Prompts' }] };
    },
    rlhf(g) {
      mod(g, -4.4, 0, 0, 1.3, 1.3, 1.3, 'SFT', { size: 0.36, o: 0.5 });
      arr(g, [-3.7, 0, 0], [-2.2, 0, 0], { o: 0.5 });
      mod(g, -1.3, 0, 0, 1.6, 1.6, 1.6, 'π', { size: 0.56 });
      mod(g, -1.3, 0, -2.8, 1.3, 1.3, 1.3, 'π_ref', { size: 0.34, o: 0.4 });
      g.add(K.line([[-1.3, 0, -2.1], [-1.3, 0, -0.85]], { o: 0.4, w: 1, dash: true }));
      lab(g, 'KL', [-0.85, 0.1, -1.5], { size: 0.32, o: 0.6 });
      arr(g, [-0.45, 0, 0], [0.75, 0, 0], { o: 0.7 });
      tok(g, 1.15, 0, 0, 0.5, 'y', { size: 0.32 });
      arr(g, [1.45, 0, 0], [2.5, 0, 0], { o: 0.7 });
      mod(g, 3.4, 0, 0, 1.6, 1.6, 1.6, 'RM', { size: 0.46, c: 'acc' });
      lab(g, 'y_a ≻ y_b', [3.4, -1.45, 0.4], { size: 0.32, o: 0.6 });
      const P = carr(g, [[3.4, 0.85, 0], [1.1, 2.4, 0], [-1.25, 0.9, 0]], { c: 'acc', w: 2.4, o: 1 });
      lab(g, 'r', [1.1, 2.75, 0], { size: 0.46, c: 'acc' });
      lab(g, 'PPO', [1.1, 1.35, 0], { size: 0.32, c: 'acc', o: 0.8 });
      const mv = mover(g, P);
      return { legend: [{ c: 'acc', t: 'Reward loop' }, { c: 'ink', t: 'Policy model' }], tick: (t) => mv((t % 2.5) / 2.5) };
    },
    dpo(g) {
      g.rotation.y = 0.45;
      // prompt and its preference pair
      tok(g, -5.0, 0, 0, 0.7, 'x', { size: 0.4, mono: true, d: 0.3 });
      tok(g, -3.2, 1.0, 0, 1.1, 'y_w', { c: 'acc', size: 0.38, fill: 0.2, mono: true, lc: 'acc', d: 0.3 });
      tok(g, -3.2, -1.0, 0, 1.1, 'y_l', { c: 'b', size: 0.38, fill: 0.2, mono: true, lc: 'b', d: 0.3 });
      arr(g, [-4.6, 0.2, 0], [-3.7, 0.85, 0], { o: 0.45, w: 1, head: 0.16 });
      arr(g, [-4.6, -0.2, 0], [-3.7, -0.85, 0], { o: 0.45, w: 1, head: 0.16 });
      // trainable policy (front) and frozen reference (above, faint)
      const px = -0.6;
      mod(g, px, -0.2, 0, 1.6, 1.4, 1.4, 'π', { size: 0.56 });
      mod(g, px, 2.0, 0, 1.3, 1.0, 1.0, 'π_ref', { size: 0.38, o: 0.35, lo: 0.6, lz: 0.5 });
      lab(g, '❄', [px + 0.95, 2.45, 0], { size: 0.34, o: 0.55 });
      arr(g, [-2.7, 1.0, 0], [px - 0.85, 0.1, 0], { c: 'acc', o: 0.9, head: 0.18 });
      arr(g, [-2.7, -1.0, 0], [px - 0.85, -0.5, 0], { c: 'b', o: 0.9, head: 0.18 });
      g.add(K.line([[-2.7, 1.15, 0], [px - 0.7, 1.9, 0]], { o: 0.3, w: 1, dash: true }));
      // both feed the log-ratio
      arr(g, [px + 0.85, -0.2, 0], [1.85, 0.25, 0], { o: 0.6, w: 1.2, head: 0.18 });
      g.add(K.line([[px + 0.7, 2.0, 0], [1.4, 2.0, 0], [1.85, 0.55, 0]], { o: 0.3, w: 1, dash: true }));
      // log π/π_ref per response: chosen goes up, rejected goes down
      const bx = 2.9, y0 = 0.4;
      g.add(K.line([[2.2, y0, 0], [4.9, y0, 0]], { o: 0.5, w: 1 }));
      g.add(K.box(bx, y0 + 0.8, 0, 0.6, 1.6, 0.5, { fill: 0.55, fc: 'acc', c: 'acc' }));
      g.add(K.box(bx + 1.2, y0 - 0.7, 0, 0.6, 1.4, 0.5, { fill: 0.55, fc: 'b', c: 'b' }));
      arr(g, [bx - 0.6, y0 + 0.5, 0], [bx - 0.6, y0 + 1.7, 0], { c: 'acc', o: 1, w: 2.2, head: 0.26 });
      arr(g, [bx + 1.8, y0 - 0.4, 0], [bx + 1.8, y0 - 1.6, 0], { c: 'b', o: 1, w: 2.2, head: 0.26 });
      lab(g, 'y_w', [bx, y0 - 0.5, 0], { size: 0.38, c: 'acc', mono: true });
      lab(g, 'y_l', [bx + 1.2, y0 + 0.5, 0], { size: 0.38, c: 'b', mono: true });
      lab(g, 'log π/π_ref', [bx + 0.6, y0 + 2.4, 0], { size: 0.4 });
      return { legend: [{ c: 'acc', t: 'Chosen response' }, { c: 'b', t: 'Rejected response' }] };
    },
    rlvr(g) {
      mod(g, -3.6, 0, 0, 1.8, 1.8, 1.8, 'LLM', { size: 0.46 });
      const ys = [1.5, 0.5, -0.5, -1.5], ok = [1, 0, 1, 0];
      ys.forEach((y, i) => {
        arr(g, [-2.6, y * 0.3, 0], [-1.15, y, 0], { o: 0.35, w: 1, head: 0.16 });
        g.add(K.box(-0.8, y, 0, 0.5, 0.5, 0.5, ok[i] ? { fill: 0.55, fc: 'acc', c: 'acc' } : { fill: 0.06, o: 0.5 }));
        g.add(K.line([[-0.5, y, 0], [0.9, y * 0.35, 0]], { o: 0.3, w: 1 }));
        lab(g, ok[i] ? '✓' : '✗', [3.6, y, 0], { size: 0.44, c: ok[i] ? 'acc' : undefined, o: ok[i] ? 1 : 0.45 });
        g.add(K.line([[2.4, y * 0.35, 0], [3.3, y, 0]], ok[i] ? { c: 'acc', w: 1.4 } : { o: 0.25, w: 1 }));
      });
      mod(g, 1.65, 0, 0, 1.5, 1.5, 1.5, 'assert', { size: 0.32, mono: true });
      carr(g, [[3.6, -2.1, 0], [0, -3.3, 0], [-3.6, -1.0, 0]], { c: 'acc', w: 2.2, o: 1 });
      lab(g, 'r = 1', [0, -2.85, 0], { size: 0.4, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Verified reward' }, { c: 'ink', t: 'Failed checks' }] };
    },
    cai(g) {
      mod(g, -2.6, 0, 0, 1.8, 1.8, 1.8, 'LLM', { size: 0.46 });
      for (let k = 0; k < 3; k++) g.add(K.box(-2.6 + k * 0.1, 2.3 + k * 0.08, -k * 0.12, 1.1, 0.75, 0.04, { fill: 0.06, o: 0.55 }));
      lab(g, '§', [-2.4, 2.45, 0.05], { size: 0.5 });
      arr(g, [-2.6, 1.85, 0], [-2.6, 1.0, 0], { o: 0.6 });
      arr(g, [-1.6, 0.4, 0], [0.6, 1.2, 0], { o: 0.7 });
      tok(g, 1.0, 1.3, 0, 0.7, 'y', { size: 0.36 });
      carr(g, [[1.4, 1.3, 0], [2.6, 0.6, 0], [2.1, -0.75, 0], [1.4, -1.2, 0]], { c: 'acc', w: 2.2, o: 1 });
      lab(g, '✎', [2.95, 0.2, 0], { size: 0.46, c: 'acc' });
      tok(g, 1.0, -1.3, 0, 0.7, 'y′', { c: 'acc', size: 0.36, fill: 0.5 });
      carr(g, [[0.6, -1.3, 0], [-0.6, -1.55, 0], [-1.65, -0.5, 0]], { c: 'acc', dash: true, w: 1.6 });
      lab(g, 'RLAIF', [-0.5, -2.0, 0], { size: 0.32, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'AI feedback' }, { c: 'ink', t: 'Principles' }] };
    },
    distill(g) {
      mod(g, -3.4, 0, 0, 2.5, 2.5, 2.5, 'T', { size: 0.6 });
      const ps = [0.08, 0.6, 0.25, 0.04, 0.03];
      ps.forEach((v, i) => g.add(K.box(-0.8 + i * 0.4, -0.9 + v * 1.2, 0, 0.3, v * 2.4, 0.3, { fill: 0.6, fc: 'acc', c: 'acc' })));
      [0, 1, 0, 0, 0].forEach((v, i) => { if (v) g.add(K.box(-0.8 + i * 0.4, -0.9 + v * 1.2, -1.0, 0.3, v * 2.4, 0.3, { fill: 0.05, o: 0.3 })); });
      g.add(K.line([[-1.1, -0.9, 0], [1.1, -0.9, 0]], { o: 0.4, w: 1 }));
      lab(g, 'τ', [0, 1.2, 0], { size: 0.42, c: 'acc' });
      arr(g, [-2.05, 0, 0], [-1.2, 0, 0], { o: 0.6 });
      arr(g, [1.2, 0, 0], [2.4, 0, 0], { c: 'acc', o: 0.9, w: 1.8 });
      mod(g, 3.2, 0, 0, 1.2, 1.2, 1.2, 'S', { size: 0.5 });
      return { legend: [{ c: 'acc', t: 'Soft labels' }, { c: 'ink', t: 'Hard label' }] };
    },
    synth(g) {
      mod(g, -4.3, 0, 0, 2.2, 2.2, 2.2, 'LLM', { size: 0.5 });
      const keep = [1, 0, 1, 1, 0, 1, 0, 1, 1];
      keep.forEach((k, i) => {
        const x = -2.1 + (i % 3) * 0.6, y = 0.8 - Math.floor(i / 3) * 0.8;
        g.add(K.box(x, y, 0, 0.48, 0.62, 0.06, { fill: 0.06, o: 0.55 }));
      });
      arr(g, [-3.1, 0, 0], [-2.55, 0, 0], { o: 0.6, head: 0.18 });
      // filter funnel
      const fx = 0.6;
      g.add(K.line([[fx - 0.6, 1.3, 0], [fx, 0.3, 0], [fx, -0.3, 0], [fx - 0.6, -1.3, 0]], { w: 1.4, o: 0.7 }));
      g.add(K.line([[fx + 0.6, 1.3, 0], [fx + 0.25, 0.3, 0]], { w: 1.4, o: 0.7 }));
      arr(g, [-0.7, 0, 0], [0.25, 0, 0], { o: 0.5, head: 0.16 });
      [0, 1, 2, 3].forEach((k) => g.add(K.box(fx + 1.0 + k * 0.12, 0.0 + k * 0.08, -k * 0.25, 0.48, 0.62, 0.06, { fill: 0.5, fc: 'acc', c: 'acc' })));
      lab(g, '✓', [fx + 1.15, 0.85, 0], { size: 0.42, c: 'acc' });
      [0, 1, 2].forEach((k) => g.add(K.box(fx - 0.3 + k * 0.3, -2.0 - k * 0.15, 0.2, 0.48, 0.62, 0.06, { fill: 0.03, o: 0.25 })));
      lab(g, '✗', [fx + 0.6, -1.55, 0], { size: 0.4, o: 0.4 });
      arr(g, [fx + 1.5, 0, 0], [3.1, 0, 0], { c: 'acc', o: 0.9, w: 1.8 });
      mod(g, 3.8, 0, 0, 1.2, 1.2, 1.2, 'S', { size: 0.46 });
      return { legend: [{ c: 'acc', t: 'Filtered synthetic data' }, { c: 'ink', t: 'Discarded samples' }] };
    },
    parallel(g, p) {
      const mode = p.mode || 'data';
      const nx = 4, ny = 3, nz = 2, sx = 1.25, sy = 1.15, sz = 1.25, s = 0.72;
      const pos = (i, j, k) => [(i - (nx - 1) / 2) * sx, (j - (ny - 1) / 2) * sy, (k - (nz - 1) / 2) * sz];
      const inGroup = (i, j, k) => (mode === 'data' ? (j === 1 && k === 1) : mode === 'tensor' ? (i === 1 && j === 1) : (i === 1 && k === 1));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
        const q = pos(i, j, k);
        g.add(K.box(q[0], q[1], q[2], s, s * 0.8, s, inGroup(i, j, k) ? { fill: 0.6, fc: 'acc', c: 'acc' } : { fill: 0.04, o: 0.35 }));
      }
      // communication links along the active axis
      const L = [], LA = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
        let n = null;
        if (mode === 'data' && i < nx - 1) n = [i + 1, j, k];
        if (mode === 'tensor' && k < nz - 1) n = [i, j, k + 1];
        if (mode === 'pipeline' && j < ny - 1) n = [i, j + 1, k];
        if (n) (inGroup(i, j, k) ? LA : L).push([pos(i, j, k), pos(n[0], n[1], n[2])]);
      }
      g.add(K.segs(L, { c: 'acc', o: 0.3 }));
      g.add(K.segs(LA, { c: 'acc', w: 2.4 }));
      const lo = pos(0, 0, 0);
      const ax = { data: 'DP', tensor: 'TP', pipeline: 'PP' };
      g.add(K.arrow([lo[0] - 0.6, lo[1] - 0.9, lo[2] + 2.0], [-lo[0] + 0.6, lo[1] - 0.9, lo[2] + 2.0], { o: mode === 'data' ? 1 : 0.35, c: mode === 'data' ? 'acc' : undefined, w: 1.2, head: 0.2 }));
      lab(g, 'DP', [0, lo[1] - 1.3, lo[2] + 2.0], { size: 0.38, c: mode === 'data' ? 'acc' : undefined, o: mode === 'data' ? 1 : 0.5 });
      g.add(K.arrow([lo[0] - 0.9, lo[1] - 0.5, lo[2] + 2.0], [lo[0] - 0.9, -lo[1] + 0.5, lo[2] + 2.0], { o: mode === 'pipeline' ? 1 : 0.35, c: mode === 'pipeline' ? 'acc' : undefined, w: 1.2, head: 0.2 }));
      lab(g, 'PP', [lo[0] - 1.4, 0, lo[2] + 2.0], { size: 0.38, c: mode === 'pipeline' ? 'acc' : undefined, o: mode === 'pipeline' ? 1 : 0.5 });
      g.add(K.arrow([-lo[0] + 0.7, lo[1] - 0.6, lo[2] - 0.4], [-lo[0] + 0.7, lo[1] - 0.6, -lo[2] + 0.9], { o: mode === 'tensor' ? 1 : 0.35, c: mode === 'tensor' ? 'acc' : undefined, w: 1.2, head: 0.2 }));
      lab(g, 'TP', [-lo[0] + 1.2, lo[1] - 0.6, 0.6], { size: 0.38, c: mode === 'tensor' ? 'acc' : undefined, o: mode === 'tensor' ? 1 : 0.5 });
      lab(g, 'GPU', [pos(nx - 1, ny - 1, 1)[0], pos(0, ny - 1, 0)[1] + 0.7, pos(0, 0, 1)[2]], { size: 0.32, o: 0.6 });
      return {
        legend: [{ c: 'acc', t: 'One parallel group' }, { c: 'ink', t: 'GPUs' }],
        ctl: [{ key: 'mode', label: 'mode', options: [{ value: 'data', label: 'DP' }, { value: 'tensor', label: 'TP' }, { value: 'pipeline', label: 'PP' }], value: mode }],
      };
    },
    spec(g) {
      mod(g, -4.6, 1.2, 0, 1.0, 1.0, 1.0, 'M_q', { size: 0.34 });
      const words = ['the', 'cat', 'sat', 'in', 'a'], st = [1, 1, 1, 2, 0];
      const X = (i) => -2.6 + i * 1.15;
      arr(g, [-4.0, 1.2, 0], [-3.25, 1.2, 0], { o: 0.6 });
      words.forEach((w, i) => {
        const c = st[i] === 1 ? 'acc' : st[i] === 2 ? 'b' : undefined;
        tok(g, X(i), 1.2, 0, 0.95, w, { c, fill: c ? 0.45 : 0.03, o: c ? 0.95 : 0.3, mono: true, size: 0.32, lo: st[i] === 0 ? 0.35 : 1 });
        arr(g, [X(i), -0.75, 0], [X(i), 0.8, 0], { c, o: c ? 0.8 : 0.25, w: 1.2, head: 0.18 });
      });
      mod(g, -0.3, -1.4, 0, 6.2, 1.1, 1.6, 'M_p', { size: 0.44, lz: 0.85 });
      lab(g, '✗', [X(3), 2.0, 0], { size: 0.42, c: 'b' });
      tok(g, X(3), 2.75, 0, 0.95, 'on', { mono: true, size: 0.32, fill: 0.08 });
      g.add(K.line([[X(3), 2.3, 0], [X(3), 2.45, 0]], { o: 0.3, w: 1 }));
      lab(g, '✓ ✓ ✓', [X(1), 2.0, 0], { size: 0.36, c: 'acc' });
      return { legend: [{ c: 'acc', t: 'Accepted tokens' }, { c: 'b', t: 'Rejected token' }] };
    },
    cot(g) {
      const pts = [[-4.5, 0, 0], [-2.2, 0.8, 0], [0, 1.6, 0], [2.2, 2.4, 0], [4.5, 1.2, 0]];
      const lb = ['Q', 's₁', 's₂', 's₃', 'A'];
      pts.forEach((q, i) => {
        const step = i > 0 && i < 4;
        mod(g, q[0], q[1], q[2], 1.1, 0.8, 0.8, lb[i], { c: step ? 'acc' : undefined, size: 0.4 });
        if (i < 4) arr(g, [q[0] + 0.6, q[1] + 0.1, 0], [pts[i + 1][0] - 0.6, pts[i + 1][1] + (i === 3 ? 0.2 : 0.1) * 0, 0], { c: 'acc', o: 1, w: 2 });
      });
      carr(g, [[-4.0, -0.5, 0], [0, -1.6, 0], [4.0, 0.7, 0]], { o: 0.3, w: 1, dash: true });
      return { legend: [{ c: 'acc', t: 'Reasoning steps' }, { c: 'ink', t: 'Direct answer' }] };
    },
    selfcons(g, p, r) {
      mod(g, -4.6, 0, 0, 0.9, 0.9, 0.9, 'Q', { size: 0.42 });
      const ans = ['42', '17', '42', '9', '42'];
      const ends = [[1.6, 2.0, -0.6], [1.6, 1.0, 0.6], [1.6, 0, -0.3], [1.6, -1.0, 0.5], [1.6, -2.0, 0]];
      ends.forEach((e, i) => {
        const win = ans[i] === '42';
        const mid1 = [-2.6, e[1] * 0.4 + r.range(-0.4, 0.4), e[2] + r.range(-0.6, 0.6)], mid2 = [-0.6, e[1] * 0.8 + r.range(-0.3, 0.3), e[2]];
        const P = new T.CatmullRomCurve3([K.V(-4.1, 0, 0), K.V(...mid1), K.V(...mid2), K.V(e[0] - 0.4, e[1], e[2])]).getPoints(40);
        g.add(K.line(P, win ? { c: 'acc', w: 1.8 } : { o: 0.35, w: 1.2 }));
        g.add(K.dots([mid1, mid2], { r: 0.06, c: win ? 'acc' : undefined, o: win ? 1 : 0.4 }));
        tok(g, e[0], e[1], e[2], 0.7, ans[i], { c: win ? 'acc' : undefined, fill: win ? 0.4 : 0.03, o: win ? 0.95 : 0.35, size: 0.3, mono: true, lo: win ? 1 : 0.5 });
        if (win) arr(g, [e[0] + 0.4, e[1], e[2]], [3.6, 0, 0], { c: 'acc', o: 0.8, w: 1.4 });
      });
      mod(g, 4.2, 0, 0, 1.1, 1.1, 1.1, '42', { c: 'acc', size: 0.44, mono: true, fill: 0.5 });
      return { legend: [{ c: 'acc', t: 'Majority answer' }, { c: 'ink', t: 'Other reasoning paths' }] };
    },
    rag(g, p, r) {
      tok(g, -4.8, 1.2, 0, 0.7, 'Q', { size: 0.4 });
      // vector store
      for (let k = 0; k < 3; k++) g.add(K.box(-2.4, -1.4 + k * 0.42, 0, 2.0, 0.3, 1.6, { fill: 0.04, o: 0.45 }));
      lab(g, 'DB', [-2.4, -2.25, 0.4], { size: 0.38, o: 0.7 });
      carr(g, [[-4.4, 1.0, 0], [-3.4, 0.6, 0], [-2.6, -0.3, 0]], { c: 'acc', w: 1.8 });
      const dx = [0.2, 0.65, 1.1];
      dx.forEach((x, i) => {
        g.add(K.box(x, 0.6 + i * 0.1, -i * 0.3, 0.55, 0.75, 0.06, { fill: 0.5, fc: 'acc', c: 'acc' }));
      });
      lab(g, 'd₁…d_k', [0.6, 1.5, 0], { size: 0.32, c: 'acc' });
      carr(g, [[-1.3, -0.8, 0], [-0.5, 0, 0], [-0.1, 0.4, 0]], { c: 'acc', w: 1.8 });
      arr(g, [1.5, 0.6, 0], [2.6, 0.6, 0], { c: 'acc', w: 1.8, o: 0.9 });
      mod(g, 3.6, 0.6, 0, 1.8, 1.8, 1.8, 'LLM', { size: 0.46 });
      carr(g, [[-4.4, 1.5, 0], [-0.5, 3.0, 0], [3.4, 1.6, 0]], { o: 0.4, w: 1, dash: true });
      arr(g, [4.55, 0.6, 0], [5.4, 0.6, 0], { o: 0.7 });
      tok(g, 5.8, 0.6, 0, 0.6, 'A', { size: 0.36 });
      return { legend: [{ c: 'acc', t: 'Retrieved documents' }, { c: 'ink', t: 'Generator' }] };
    },
    agent(g) {
      mod(g, 0, 0, 0, 1.9, 1.9, 1.9, 'LLM', { size: 0.5 });
      // tools on the right
      mod(g, 3.8, 1.0, 0, 1.0, 0.7, 0.7, '⚙', { size: 0.42 });
      mod(g, 3.8, 0, 0, 1.0, 0.7, 0.7, '</>', { size: 0.34, mono: true });
      mod(g, 3.8, -1.0, 0, 1.0, 0.7, 0.7, 'API', { size: 0.3 });
      mod(g, 0, -3.0, 0, 3.0, 0.8, 1.6, 'env', { size: 0.4, o: 0.5 });
      lab(g, '✎', [-0.2, 1.55, 0], { size: 0.42 });
      const P1 = carr(g, [[0.95, 0.7, 0], [2.0, 1.6, 0], [3.25, 1.05, 0]], { c: 'acc', w: 2.2, o: 1 });
      lab(g, 'aₜ', [2.0, 2.0, 0], { size: 0.4, c: 'acc' });
      carr(g, [[3.8, -1.4, 0], [3.0, -3.0, 0], [1.6, -3.0, 0]], { c: 'acc', w: 2.2, o: 1 });
      carr(g, [[-1.6, -3.0, 0], [-2.6, -1.5, 0], [-0.95, -0.4, 0]], { c: 'acc', w: 2.2, o: 1 });
      lab(g, 'oₜ', [-2.9, -1.4, 0], { size: 0.4, c: 'acc' });
      const mv = mover(g, P1);
      return { legend: [{ c: 'acc', t: 'Agent loop' }, { c: 'ink', t: 'Tools & environment' }], tick: (t) => mv((t % 2) / 2) };
    },
    tool(g) {
      mod(g, -3.6, 0, 0, 1.9, 1.9, 1.9, 'LLM', { size: 0.5 });
      g.add(K.box(0, 1.5, 0, 3.2, 0.7, 0.12, { fill: 0.4, fc: 'acc', c: 'acc' }));
      lab(g, '{ "fn": "sqrt", "x": 2 }', [0, 1.5, 0.08], { size: 0.27, mono: true });
      carr(g, [[-2.6, 0.6, 0], [-2.0, 1.5, 0], [-1.65, 1.5, 0]], { c: 'acc', w: 2, o: 1, head: 0.2 });
      carr(g, [[1.65, 1.5, 0], [2.4, 1.4, 0], [3.0, 0.65, 0]], { c: 'acc', w: 2, o: 1, head: 0.2 });
      mod(g, 3.6, 0, 0, 1.4, 1.2, 1.2, '⚙', { size: 0.5 });
      g.add(K.box(0, -1.5, 0, 1.8, 0.7, 0.12, { fill: 0.06, o: 0.6 }));
      lab(g, '1.414', [0, -1.5, 0.08], { size: 0.3, mono: true });
      carr(g, [[3.0, -0.65, 0], [2.4, -1.4, 0], [0.95, -1.5, 0]], { o: 0.6, head: 0.2 });
      carr(g, [[-0.95, -1.5, 0], [-2.0, -1.5, 0], [-2.6, -0.6, 0]], { o: 0.6, head: 0.2 });
      return { legend: [{ c: 'acc', t: 'Function call' }, { c: 'ink', t: 'Tool result' }] };
    },
    react(g) {
      mod(g, 0, 2.2, 0, 0.9, 5.6, 0.9, null, { o: 0.4 });
      lab(g, 'env', [0, 5.4, 0], { size: 0.38, o: 0.6 });
      const R = 2.6, pts = [];
      for (let i = 0; i < 9; i++) {
        const a = -0.6 + i * (2 * Math.PI / 3), y = i * 0.6;
        pts.push([R * Math.sin(a), y, R * Math.cos(a)]);
      }
      g.add(K.curve(pts, { o: 0.5, w: 1.4, n: 120 }));
      pts.forEach((q, i) => {
        const t = i % 3;
        if (t === 1) {
          g.add(K.box(q[0], q[1], q[2], 0.6, 0.45, 0.6, { fill: 0.6, fc: 'acc', c: 'acc' }));
          arr(g, q, [q[0] * 0.25, q[1] + 0.15, q[2] * 0.25], { c: 'acc', o: 0.9, w: 1.6, head: 0.2 });
        } else g.add(K.box(q[0], q[1], q[2], 0.6, 0.45, 0.6, { fill: t === 0 ? 0.1 : 0.03, o: t === 0 ? 0.75 : 0.45 }));
        if (t === 2) arr(g, [pts[i - 1][0] * 0.25, pts[i - 1][1] + 0.3, pts[i - 1][2] * 0.25], [q[0] * 0.8, q[1], q[2] * 0.8], { o: 0.45, w: 1, head: 0.16 });
      });
      ['T', 'A', 'O'].forEach((s, i) => { const q = pts[6 + i]; lab(g, s, [q[0] * 1.25, q[1] + 0.25, q[2] * 1.25], { size: 0.4, c: i === 1 ? 'acc' : undefined }); });
      return { legend: [{ c: 'acc', t: 'Actions' }, { c: 'ink', t: 'Thoughts & observations' }] };
    },
    ring(g) {
      const n = 6, R = 3.0, kv = [];
      for (let i = 0; i < n; i++) {
        const a = 2 * Math.PI * i / n, x = R * Math.cos(a), z = R * Math.sin(a);
        mod(g, x, 0, z, 1.1, 0.8, 1.1, null);
        g.add(K.box(x, 0.68, z, 0.36, 0.36, 0.36, { fill: 0.15, o: 0.7 }));
        const a1 = a + 2 * Math.PI / n;
        const P = [];
        for (let k = 0; k <= 20; k++) { const t = a + 0.32 + (a1 - a - 0.64) * k / 20; P.push([R * Math.cos(t), 0, R * Math.sin(t)]); }
        g.add(K.line(P.slice(0, 18), { c: 'acc', w: 2 }));
        g.add(K.arrow(P[17], P[20], { c: 'acc', w: 2, head: 0.22 }));
        kv.push([a, a1]);
      }
      const kvm = K.dots(kv.map(([a]) => [R * Math.cos(a), 0, R * Math.sin(a)]), { r: 0.01 });
      const kb = kv.map(([a]) => { const b = K.box(R * Math.cos(a), -0.68, R * Math.sin(a), 0.36, 0.36, 0.36, { fill: 0.7, fc: 'acc', c: 'acc' }); g.add(b); return b; });
      // long sequence above, split into chunks
      const L = 7.2;
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + (i + 0.5) * L / n;
        g.add(K.box(x, 3.0, 0, L / n - 0.08, 0.4, 0.4, { fill: 0.06, o: 0.5 }));
      }
      const R0 = [R * Math.cos(0), 0, R * Math.sin(0)];
      lab(g, 'Q', [R0[0] + 0.6, 0.75, R0[2]], { size: 0.34 });
      lab(g, 'KV', [R0[0] + 0.75, -0.7, R0[2]], { size: 0.34, c: 'acc' });
      lab(g, 'GPU', [R * Math.cos(Math.PI / 3), 0, R * Math.sin(Math.PI / 3) + 0.95], { size: 0.32, o: 0.6 });
      return {
        legend: [{ c: 'acc', t: 'KV blocks passed' }, { c: 'ink', t: 'Devices with queries' }],
        tick: (t) => {
          const u = K.ease((t % 2) / 2);
          kb.forEach((b, i) => { const [a, a1] = kv[i]; const th = a + (a1 - a) * u; b.position.set(R * Math.cos(th), -0.68, R * Math.sin(th)); });
        },
      };
    },
    mm(g) {
      pix(g, -5.2, 0.6, 0, 6, 2.0, sunImg(6));
      arr(g, [-4.0, 0.6, 0], [-3.4, 0.6, 0], { o: 0.6, head: 0.18 });
      mod(g, -2.6, 0.6, 0, 1.4, 1.4, 1.4, 'ViT', { size: 0.4 });
      arr(g, [-1.85, 0.6, 0], [-1.35, 0.6, 0], { c: 'acc', o: 0.9, head: 0.18 });
      mod(g, -0.9, 0.6, 0, 0.7, 0.9, 0.9, 'W', { c: 'acc', size: 0.4 });
      const xs = [];
      for (let i = 0; i < 8; i++) xs.push(0.6 + i * 0.55);
      xs.forEach((x, i) => {
        const v = i < 4;
        g.add(K.box(x, -1.2, 0, 0.42, 0.42, 0.42, v ? { fill: 0.6, fc: 'acc', c: 'acc' } : { fill: 0.08, o: 0.6 }));
        g.add(K.line([[x, -0.95, 0], [x, -0.2, 0]], v ? { c: 'acc', w: 1.2, o: 0.8 } : { o: 0.3, w: 1 }));
      });
      carr(g, [[-0.9, 0.1, 0], [-0.6, -1.2, 0], [0.3, -1.2, 0]], { c: 'acc', w: 1.6, head: 0.18 });
      mod(g, 2.5, 0.75, 0, 5.0, 1.8, 1.8, 'LLM', { size: 0.5, lz: 0.95 });
      lab(g, 'the  cat  is', [3.25, -1.85, 0], { size: 0.3, mono: true, o: 0.7 });
      return { legend: [{ c: 'acc', t: 'Visual tokens' }, { c: 'ink', t: 'Text tokens' }] };
    },
    vla(g) {
      pix(g, -5.0, 1.3, 0, 6, 1.7, sunImg(6));
      tok(g, -5.45, -0.9, 0, 0.85, 'pick', { mono: true, size: 0.28 });
      tok(g, -4.55, -0.9, 0, 0.85, 'cup', { mono: true, size: 0.28 });
      arr(g, [-4.0, 1.1, 0], [-2.9, 0.5, 0], { o: 0.6 });
      arr(g, [-4.0, -0.7, 0], [-2.9, -0.1, 0], { o: 0.6 });
      mod(g, -1.9, 0.2, 0, 1.8, 1.8, 1.8, 'VLA', { size: 0.46 });
      const ax = [0, 0.55, 1.1];
      ax.forEach((x, i) => tok(g, 0.1 + x, 0.2, 0, 0.45, ['a₁', 'a₂', 'a₃'][i], { c: 'acc', fill: 0.55, size: 0.24 }));
      arr(g, [-0.95, 0.2, 0], [-0.25, 0.2, 0], { c: 'acc', o: 0.9, head: 0.16 });
      arr(g, [1.5, 0.2, 0], [2.4, 0.2, 0], { c: 'acc', o: 0.9, w: 1.8 });
      // robot arm
      const base = [3.4, -1.6, 0];
      g.add(K.box(base[0], base[1], base[2], 1.0, 0.3, 1.0, { fill: 0.08, o: 0.7 }));
      const j1 = [3.4, 0.2, 0], j2 = [4.6, 1.0, 0.2], ee = [5.3, 0.0, 0.3];
      g.add(K.line([[3.4, -1.45, 0], j1, j2, ee], { w: 3 }));
      g.add(K.dots([j1, j2], { r: 0.13 }));
      g.add(K.line([[5.1, -0.1, 0.1], [5.1, -0.45, 0.1]], { w: 2.4 }));
      g.add(K.line([[5.5, -0.1, 0.5], [5.5, -0.45, 0.5]], { w: 2.4 }));
      g.add(K.line([[5.1, -0.1, 0.1], [5.5, -0.1, 0.5]], { w: 2.4 }));
      carr(g, [[5.5, 0.6, 0.3], [6.0, 0.2, 0.3], [5.9, -0.6, 0.3]], { c: 'acc', w: 1.6, dash: true, head: 0.18 });
      return { legend: [{ c: 'acc', t: 'Action tokens' }, { c: 'ink', t: 'Vision and language' }] };
    },
    world(g) {
      pix(g, -5.0, 2.2, 0, 5, 1.3, sunImg(5));
      lab(g, 'o₀', [-5.0, 3.15, 0], { size: 0.36 });
      arr(g, [-5.0, 1.45, 0], [-5.0, 0.5, 0], { o: 0.6 });
      const xs = [-5.0, -2.2, 0.6, 3.4];
      xs.forEach((x, i) => {
        const pred = i > 0;
        g.add(K.box(x, 0, 0, 0.75, 0.75, 0.75, pred ? { fill: 0.55, fc: 'acc', c: 'acc' } : { fill: 0.15, o: 0.8 }));
        lab(g, pred ? 'ẑ' + ['₀', '₁', '₂', '₃'][i] : 'z₀', [x, -0.75, 0.3], { size: 0.36, c: pred ? 'acc' : undefined });
        if (i < 3) {
          const fx = (x + xs[i + 1]) / 2;
          mod(g, fx, 0, 0, 0.75, 0.75, 0.75, 'f', { size: 0.34 });
          arr(g, [x + 0.45, 0, 0], [fx - 0.42, 0, 0], { c: 'acc', o: 0.9, head: 0.16 });
          arr(g, [fx + 0.42, 0, 0], [xs[i + 1] - 0.45, 0, 0], { c: 'acc', o: 0.9, head: 0.16 });
          arr(g, [fx, 1.5, 0], [fx, 0.45, 0], { o: 0.5, w: 1, head: 0.16 });
          lab(g, 'a' + ['₀', '₁', '₂'][i], [fx, 1.8, 0], { size: 0.34 });
        }
        if (pred) pix(g, x, 2.2, -0.6, 5, 1.3, sunImg(5), { c: 'acc', op: 0.3 + 0.0 * i });
        if (pred) g.add(K.line([[x, 0.45, 0], [x, 1.5, -0.6]], { c: 'acc', o: 0.4, w: 1, dash: true }));
      });
      return { legend: [{ c: 'acc', t: 'Predicted future states' }, { c: 'ink', t: 'Observation and actions' }] };
    },
    jepa(g) {
      const masked = (i, j) => i >= 2 && i <= 3 && j >= 2 && j <= 3;
      pix(g, -4.8, 1.3, 0, 5, 1.8, (i, j) => (masked(i, j) ? 0 : 0.35));
      g.add(K.rect(-4.8 + 0.18 * 1.8 / 1, 1.3 + 0.18 * 1.8 / 1, 0.01, 0.72, 0.72, 'xy', { o: 0.7, w: 1.4, dash: true }));
      lab(g, 'x', [-4.8, 2.5, 0], { size: 0.4 });
      pix(g, -4.8, -1.6, 0, 2, 0.8, () => 0.35);
      lab(g, 'y', [-4.8, -0.95, 0], { size: 0.4 });
      mod(g, -2.6, 1.3, 0, 1.2, 1.2, 1.2, 'E', { size: 0.44 });
      mod(g, -2.6, -1.6, 0, 1.2, 1.2, 1.2, 'Ē', { size: 0.44, o: 0.4 });
      arr(g, [-3.8, 1.3, 0], [-3.25, 1.3, 0], { o: 0.6, head: 0.16 });
      arr(g, [-4.3, -1.6, 0], [-3.25, -1.6, 0], { o: 0.6, head: 0.16 });
      vec(g, -1.1, 1.3, 0, 4, { s: 0.24 });
      arr(g, [-1.95, 1.3, 0], [-1.3, 1.3, 0], { o: 0.6, head: 0.16 });
      arr(g, [-0.9, 1.3, 0], [0.0, 1.3, 0], { c: 'acc', o: 0.9, head: 0.18 });
      mod(g, 0.8, 1.3, 0, 1.4, 1.2, 1.2, 'P', { c: 'acc', size: 0.5 });
      arr(g, [1.55, 1.1, 0], [2.85, 0.15, 0], { c: 'acc', o: 0.9 });
      vec(g, 3.2, -0.1, 0, 4, { s: 0.24, c: 'acc' });
      lab(g, 'ŝ_y', [3.75, 0.45, 0], { size: 0.36, c: 'acc' });
      arr(g, [-1.95, -1.6, 0], [2.85, -1.6, 0], { o: 0.45, w: 1 });
      vec(g, 3.2, -1.6, 0, 4, { s: 0.24 });
      lab(g, 's_y', [3.75, -2.1, 0], { size: 0.36 });
      g.add(K.line([[3.6, -0.1, 0], [4.3, -0.85, 0], [3.6, -1.6, 0]], { o: 0.5, w: 1, dash: true }));
      lab(g, 'ℒ', [4.6, -0.85, 0], { size: 0.42 });
      return { legend: [{ c: 'acc', t: 'Predictor in latent space' }, { c: 'ink', t: 'Encoders' }] };
    },
  };

  /* =====================================================================
     MANIFOLD
     ===================================================================== */
  VIZ.manifold = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'roll', r = K.rng(21);
    let legend;
    if (kind === 'roll') {
      const A = [], B = [], fA = [], fB = [];
      const t0 = 1.5 * Math.PI, t1 = 4.3 * Math.PI, mid = (t0 + t1) / 2;
      for (let i = 0; i < 320; i++) {
        const t = r.range(t0, t1), h = r.range(0, 2.8);
        const q = [-2.8 + t * Math.cos(t) / 4.4, h, t * Math.sin(t) / 4.4];
        const f = [1.2 + (t - t0) / (t1 - t0) * 4.2, 0, -1.4 + h];
        (t < mid ? A : B).push(q); (t < mid ? fA : fB).push(f);
      }
      g.add(K.dots(A, { r: 0.06, c: 'acc' }));
      g.add(K.dots(B, { r: 0.06, c: 'b' }));
      // flat (kernel PCA) embedding
      const fy = -0.2;
      g.add(K.rect(3.3, fy, 0, 4.8, 3.4, 'xz', { o: 0.3, w: 1, fill: 0.02 }));
      g.add(K.dots(fA.map((q) => [q[0], fy + 0.02, q[2]]), { r: 0.05, c: 'acc' }));
      g.add(K.dots(fB.map((q) => [q[0], fy + 0.02, q[2]]), { r: 0.05, c: 'b' }));
      g.add(K.line([[3.3, fy + 0.03, -1.7], [3.3, fy + 0.03, 1.7]], { w: 2.2 }));
      g.add(K.line([[3.3, fy, -1.7], [3.3, fy + 1.4, -1.7], [3.3, fy + 1.4, 1.7], [3.3, fy, 1.7]], { o: 0.3, w: 1 }));
      carr(g, [[-0.6, 2.8, 0], [0.6, 3.3, 0], [1.6, 1.8, 0]], { o: 0.6 });
      lab(g, 'φ(x)', [0.6, 3.7, 0], { size: 0.42 });
      legend = [{ c: 'acc', t: 'Class A' }, { c: 'b', t: 'Class B' }];
    } else if (kind === 'flat') {
      const cents3 = [[-1.5, 4.2, -0.8], [1.2, 5.0, 0.6], [0.4, 3.4, 1.4], [-0.6, 5.2, 1.5]];
      const cents2 = [[-2.4, 0, -0.9], [2.2, 0, -0.6], [0.5, 0, 1.4], [-1.6, 0, 1.5]];
      g.add(K.rect(0, 0, 0, 7.4, 4.6, 'xz', { o: 0.3, w: 1, fill: 0.02 }));
      const lines = [];
      cents3.forEach((c, ci) => {
        const P3 = [], P2 = [];
        for (let i = 0; i < 22; i++) {
          const d = [r.n() * 0.38, r.n() * 0.38, r.n() * 0.38];
          P3.push(add3(c, d));
          P2.push([cents2[ci][0] + d[0] * 1.05 + d[1] * 0.3, 0.02, cents2[ci][2] + d[2] * 1.05]);
        }
        const acc = ci === 0;
        g.add(K.dots(P3, { r: 0.06, c: acc ? 'acc' : undefined, o: acc ? 1 : 0.7 }));
        g.add(K.dots(P2, { r: 0.06, c: acc ? 'acc' : undefined, o: acc ? 1 : 0.7 }));
        if (acc) P3.forEach((q, i) => { if (i % 3 === 0) lines.push([q, P2[i]]); });
        else lines.push([c, [cents2[ci][0], 0.02, cents2[ci][2]]]);
      });
      g.add(K.segs(lines.slice(0, 8), { c: 'acc', o: 0.3 }));
      g.add(K.segs(lines.slice(8), { o: 0.15 }));
      g.add(K.box(0, 4.3, 0.4, 4.6, 2.8, 3.4, { o: 0.15 }));
      lab(g, 'ℝᴰ', [2.8, 5.6, 0.4], { size: 0.42 });
      lab(g, 'ℝ²', [3.4, 0.3, 2.2], { size: 0.42 });
      legend = [{ c: 'acc', t: 'Neighbours preserved' }, { c: 'ink', t: 'Other clusters' }];
    } else if (kind === 'graph') {
      const P3 = [], P2 = [];
      for (let i = 0; i < 170; i++) {
        const u = r(), t = 3 * Math.PI * (u - 0.5), h = r.range(0, 2.0);
        P3.push([-3.0 + 1.3 * Math.sin(t), 1.0 + 1.3 * Math.sign(t) * (Math.cos(t) - 1) * 0.9, h - 1.0]);
        P2.push([1.3 + u * 4.2, -1.6, h - 1.0]);
      }
      // S curve is in x,y; rotate a bit for depth
      const E = knn(P3, 4);
      g.add(K.segs(E.map(([i, j]) => [P3[i], P3[j]]), { c: 'acc', o: 0.55 }));
      g.add(K.dots(P3, { r: 0.045, o: 0.85 }));
      g.add(K.rect(3.4, -1.6, 0, 5.0, 2.8, 'xz', { o: 0.3, w: 1, fill: 0.02 }));
      g.add(K.segs(E.map(([i, j]) => [P2[i], P2[j]]), { c: 'acc', o: 0.55 }));
      g.add(K.dots(P2, { r: 0.045, o: 0.85 }));
      carr(g, [[-1.2, 2.2, 0], [0.8, 2.4, 0], [2.0, 0.0, 0]], { o: 0.55 });
      lab(g, 'kNN', [-3.0, 3.6, 0], { size: 0.4, c: 'acc' });
      lab(g, 'ℝ²', [6.2, -1.3, 1.4], { size: 0.42 });
      legend = [{ c: 'acc', t: 'Neighbour graph' }, { c: 'ink', t: 'Data points' }];
    } else { // autoenc
      const layers = [[5, 5], [3, 3], [1, 2], [3, 3], [5, 5]], xs = [-3.2, -1.6, 0, 1.6, 3.2];
      const L = layers.map(([a, b], li) => {
        const pts = [];
        for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) pts.push([xs[li], (i - (a - 1) / 2) * 0.55, (j - (b - 1) / 2) * 0.55]);
        return pts;
      });
      for (let li = 0; li < 4; li++) {
        const pairs = [];
        L[li].forEach((a) => L[li + 1].forEach((b) => pairs.push([a, b])));
        const toB = li === 1 || li === 2;
        g.add(K.segs(pairs, toB ? { c: 'acc', o: 0.3 } : { o: 0.1 }));
      }
      L.forEach((pts, li) => g.add(K.dots(pts, li === 2 ? { r: 0.15, c: 'acc' } : { r: 0.075, o: 0.85 })));
      pix(g, -5.0, 0, 0, 6, 2.4, sunImg(6));
      pix(g, 5.0, 0, 0, 6, 2.4, (i, j) => sunImg(6)(i, j) * 0.85, { op: 0.45 });
      arr(g, [-3.7, 0, 0], [-3.5, 0, 0], { o: 0 });
      lab(g, 'x', [-5.0, 1.6, 0], { size: 0.44 });
      lab(g, 'z', [0, 1.0, 0], { size: 0.46, c: 'acc' });
      lab(g, 'x̂', [5.0, 1.6, 0], { size: 0.44 });
      legend = [{ c: 'acc', t: 'Bottleneck latent' }, { c: 'ink', t: 'Encoder and decoder' }];
    }
    return { g, legend };
  };

  /* =====================================================================
     LOWRANK
     ===================================================================== */
  function grid(g, cx, cy, cz, nr, nc, cs, o) {
    o = o || {};
    const w = nc * cs, h = nr * cs, pairs = [];
    for (let i = 0; i <= nc; i++) pairs.push([[cx - w / 2 + i * cs, cy - h / 2, cz], [cx - w / 2 + i * cs, cy + h / 2, cz]]);
    for (let j = 0; j <= nr; j++) pairs.push([[cx - w / 2, cy - h / 2 + j * cs, cz], [cx + w / 2, cy - h / 2 + j * cs, cz]]);
    g.add(K.segs(pairs, { c: o.c, o: o.o == null ? 0.25 : o.o }));
    if (o.fill) g.add(K.rect(cx, cy, cz, w, h, 'xy', { fill: o.fill, fc: o.c, edge: false }));
    g.add(K.rect(cx, cy, cz, w, h, 'xy', { c: o.c, o: o.eo == null ? 0.8 : o.eo, w: o.ew || 1.2 }));
  }
  VIZ.lowrank = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'svd', r = K.rng(3);
    let legend, ctl;
    if (kind === 'svd') {
      const k = Math.round(p.k == null ? 2 : p.k), n = 6, cs = 0.34, S = n * cs;
      const sig = [1.0, 0.62, 0.38, 0.22, 0.12, 0.06];
      const xA = -4.6, xU = -1.6, xS = 0.9, xV = 3.4;
      // A
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g.add(K.rect(xA - S / 2 + (j + 0.5) * cs, -S / 2 + (i + 0.5) * cs, 0, cs * 0.9, cs * 0.9, 'xy', { fill: r.range(0.04, 0.3), edge: false }));
      grid(g, xA, 0, 0, n, n, cs, { o: 0.15 });
      lab(g, 'A', [xA, S / 2 + 0.45, 0], { size: 0.46 });
      lab(g, '≈', [(xA + xU) / 2, 0, 0], { size: 0.5 });
      // U: columns
      for (let j = 0; j < n; j++) {
        const on = j < k, x = xU - S / 2 + (j + 0.5) * cs;
        g.add(K.box(x, 0, 0, cs * 0.86, S, 0.1, on ? { fill: 0.5, fc: 'acc', c: 'acc' } : { fill: 0.02, o: 0.2 }));
      }
      lab(g, 'U', [xU, S / 2 + 0.45, 0], { size: 0.46 });
      // Sigma diag with bars in z
      grid(g, xS, 0, 0, n, n, cs, { o: 0.1, eo: 0.5 });
      for (let i = 0; i < n; i++) {
        const on = i < k, x = xS - S / 2 + (i + 0.5) * cs, y = S / 2 - (i + 0.5) * cs, h = sig[i] * 2.2;
        g.add(K.box(x, y, h / 2, cs * 0.8, cs * 0.8, h, on ? { fill: 0.6, fc: 'acc', c: 'acc' } : { fill: 0.03, o: 0.3 }));
      }
      lab(g, 'Σ', [xS, S / 2 + 0.45, 0], { size: 0.46 });
      // V^T rows
      for (let i = 0; i < n; i++) {
        const on = i < k, y = S / 2 - (i + 0.5) * cs;
        g.add(K.box(xV, y, 0, S, cs * 0.86, 0.1, on ? { fill: 0.5, fc: 'acc', c: 'acc' } : { fill: 0.02, o: 0.2 }));
      }
      lab(g, 'Vᵀ', [xV, S / 2 + 0.45, 0], { size: 0.46 });
      lab(g, 'σ₁ ≥ σ₂ ≥ …', [xS, -S / 2 - 0.5, 0], { size: 0.32, o: 0.6 });
      legend = [{ c: 'acc', t: 'Top-k singular values' }, { c: 'ink', t: 'Truncated components' }];
      ctl = [{ key: 'k', label: 'k', min: 1, max: 6, step: 1, value: k }];
    } else { // lora / qlora
      const rk = Math.round(p.r == null ? 4 : p.r), d = 16, cs = 0.26, S = d * cs;
      const xW = -2.2;
      if (kind === 'qlora') {
        // quantized heightmap W: bars toward viewer, stepped levels
        const levels = 6;
        for (let i = 0; i < d; i += 1) for (let j = 0; j < d; j += 1) {
          const v = 0.5 + 0.5 * Math.sin(i * 0.7 + r.n() * 0.4) * Math.cos(j * 0.5 + r.n() * 0.3);
          const q = Math.round(v * (levels - 1)) / (levels - 1), h = 0.05 + q * 0.6;
          g.add(K.box(xW - S / 2 + (j + 0.5) * cs, -S / 2 + (i + 0.5) * cs, h / 2, cs * 0.92, cs * 0.92, h, { fill: 0.04 + 0.1 * q, o: 0.18 + 0.2 * q }));
        }
        lab(g, 'W', [xW - 0.4, S / 2 + 0.45, 0], { size: 0.46 });
        lab(g, 'NF4 ❄', [xW + 0.6, S / 2 + 0.45, 0], { size: 0.36, o: 0.65 });
      } else {
        grid(g, xW, 0, 0, d, d, cs, { o: 0.12, fill: 0.05, eo: 0.7 });
        lab(g, 'W ❄', [xW, S / 2 + 0.45, 0], { size: 0.46 });
      }
      lab(g, '+', [0.55, 0, 0], { size: 0.6 });
      // B (d x r) and A (r x d)
      const bw = rk * cs, xB = 1.3 + bw / 2;
      grid(g, xB, 0, 0.0, d, rk, cs, { c: 'acc', o: 0.35, fill: 0.45, eo: 1, ew: 1.6 });
      lab(g, 'B', [xB, -S / 2 - 0.45, 0], { size: 0.46, c: 'acc' });
      const xA = xB + bw / 2 + 0.35 + S / 2, yA = S / 2 - bw / 2;
      grid(g, xA, yA, 0, rk, d, cs, { c: 'acc', o: 0.35, fill: 0.45, eo: 1, ew: 1.6 });
      lab(g, 'A', [xA, yA - bw / 2 - 0.45, 0], { size: 0.46, c: 'acc' });
      lab(g, 'r = ' + rk, [xA, S / 2 + 0.45, 0], { size: 0.36, c: 'acc' });
      legend = [{ c: 'acc', t: 'Trainable adapters' }, { c: 'ink', t: kind === 'qlora' ? 'Frozen 4-bit weights' : 'Frozen weights' }];
      ctl = [{ key: 'r', label: 'r', min: 1, max: 16, step: 1, value: rk }];
    }
    return { g, legend, ctl };
  };

  /* =====================================================================
     GRAPH
     ===================================================================== */
  VIZ.graph = function (p, KK) {
    K = KK; T = K.THREE;
    const g = G(), kind = p.kind || 'spectral', r = K.rng(17);
    let legend;
    if (kind === 'spectral') {
      const n = 22, P = [], cm = [];
      for (let i = 0; i < n; i++) {
        const c = i < n / 2 ? 0 : 1; cm.push(c);
        P.push([(c ? 2.2 : -2.2) + r.n() * 0.9, 0, r.n() * 1.0]);
      }
      const E = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const same = cm[i] === cm[j], dd = Math.hypot(P[i][0] - P[j][0], P[i][2] - P[j][2]);
        if (same && dd < 1.7) E.push([i, j]);
      }
      [[2, 14], [5, 18], [9, 12]].forEach((e) => E.push(e));
      // Laplacian Fiedler vector via power iteration on (c I - L), deflating 1
      const deg = new Array(n).fill(0); E.forEach(([i, j]) => { deg[i]++; deg[j]++; });
      const cmax = 2 * Math.max(...deg) + 1;
      let v = P.map((q) => q[0] + r.n() * 0.1);
      for (let it = 0; it < 400; it++) {
        const m = v.reduce((a, b) => a + b, 0) / n; v = v.map((x) => x - m);
        const Lv = v.map((x, i) => deg[i] * x);
        E.forEach(([i, j]) => { Lv[i] -= v[j]; Lv[j] -= v[i]; });
        v = v.map((x, i) => cmax * x - Lv[i]);
        const nr = Math.hypot(...v); v = v.map((x) => x / nr);
      }
      const mx = Math.max(...v.map(Math.abs));
      if (v[0] < 0) v = v.map((x) => -x);
      P.forEach((q, i) => { q[1] = 1.8 * v[i] / mx; });
      const cut = E.filter(([i, j]) => Math.sign(v[i]) !== Math.sign(v[j]));
      const keep = E.filter(([i, j]) => Math.sign(v[i]) === Math.sign(v[j]));
      g.add(K.segs(keep.map(([i, j]) => [P[i], P[j]]), { o: 0.45 }));
      g.add(K.segs(cut.map(([i, j]) => [P[i], P[j]]), { c: 'acc', w: 2.4 }));
      g.add(K.rect(0, 0, 0, 8.5, 4.6, 'xz', { c: 'acc', o: 0.5, w: 1, fill: 0.07 }));
      g.add(K.segs(P.map((q) => [q, [q[0], 0, q[2]]]), { o: 0.15 }));
      g.add(K.dots(P.filter((_, i) => v[i] > 0), { r: 0.12 }));
      g.add(K.dots(P.filter((_, i) => v[i] <= 0), { r: 0.13, hollow: true }));
      lab(g, 'v₂ > 0', [-3.4, 2.4, -1.5], { size: 0.36 });
      lab(g, 'v₂ < 0', [3.4, -2.3, 1.5], { size: 0.36 });
      legend = [{ c: 'acc', t: 'Spectral cut' }, { c: 'ink', t: 'Two communities' }];
    } else if (kind === 'compute') {
      const N = { x: [-4.4, 1.2, 0], w: [-4.4, -0.6, 0], mul: [-2.2, 0.3, 0], b: [-2.2, -1.6, 0], add: [0, 0.3, 0], sig: [2.2, 0.3, 0], L: [4.4, 0.3, 0] };
      const lb = { x: 'x', w: 'w', mul: '×', b: 'b', add: '+', sig: 'σ', L: 'L' };
      Object.keys(N).forEach((k) => {
        const op = ['mul', 'add', 'sig'].includes(k);
        mod(g, N[k][0], N[k][1], N[k][2], 0.8, 0.8, 0.8, lb[k], { size: 0.44, o: op ? 0.8 : 0.5, fill: op ? 0.06 : 0.02 });
      });
      const fw = [['x', 'mul'], ['w', 'mul'], ['mul', 'add'], ['b', 'add'], ['add', 'sig'], ['sig', 'L']];
      const sh = (a, b, s) => { const d = sub3(b, a), l = Math.hypot(...d); return [a[0] + d[0] / l * s, a[1] + d[1] / l * s, a[2] + d[2] / l * s]; };
      fw.forEach(([a, b]) => arr(g, sh(N[a], N[b], 0.5), sh(N[b], N[a], 0.5), { o: 0.55, w: 1.2, head: 0.18 }));
      // backward gradient arcs (in front, lower)
      const bw = [['L', 'sig'], ['sig', 'add'], ['add', 'mul'], ['add', 'b'], ['mul', 'w'], ['mul', 'x']];
      bw.forEach(([a, b]) => {
        const A = N[a], B = N[b], mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 0.45, 0.9];
        carr(g, [[A[0] - 0.2, A[1] - 0.35, 0.45], mid, [B[0] + 0.2, B[1] - 0.2, 0.45]], { c: 'acc', w: 2, o: 1, head: 0.2 });
      });
      lab(g, '∂L/∂w', [-4.4, -1.4, 0.7], { size: 0.36, c: 'acc' });
      lab(g, '∂L/∂σ', [3.3, -0.75, 0.9], { size: 0.32, c: 'acc' });
      legend = [{ c: 'acc', t: 'Backward gradients' }, { c: 'ink', t: 'Forward operations' }];
    } else { // gnn
      const n = 13, P = [];
      P.push([0, 0, 0]);
      for (let i = 1; i < 5; i++) { const a = i * 2 * Math.PI / 4 + 0.4; P.push([1.5 * Math.cos(a), 0, 1.5 * Math.sin(a)]); }
      for (let i = 5; i < n; i++) { const a = i * 2 * Math.PI / 8 + r.range(-0.2, 0.2); P.push([3.2 * Math.cos(a), 0, 2.3 * Math.sin(a)]); }
      const E = [[0, 1], [0, 2], [0, 3], [0, 4]];
      for (let i = 5; i < n; i++) {
        let best = 1, bd = 1e9; for (let j = 1; j < 5; j++) { const dd = d3(P[i], P[j]); if (dd < bd) { bd = dd; best = j; } }
        E.push([i, best]); if (i > 5) E.push([i, i - 1]);
      }
      const isN = (e) => e[0] === 0 || e[1] === 0;
      const lay = (y) => P.map((q) => [q[0], y, q[2]]);
      const L0 = lay(0), L1 = lay(2.8);
      g.add(K.rect(0, 0, 0, 7.6, 5.6, 'xz', { o: 0.18, w: 1, fill: 0.02 }));
      g.add(K.rect(0, 2.8, 0, 7.6, 5.6, 'xz', { o: 0.12, w: 1 }));
      g.add(K.segs(E.filter((e) => !isN(e)).map(([i, j]) => [L0[i], L0[j]]), { o: 0.35 }));
      g.add(K.segs(E.filter(isN).map(([i, j]) => [L0[i], L0[j]]), { c: 'acc', w: 2.2 }));
      g.add(K.segs(E.map(([i, j]) => [L1[i], L1[j]]), { o: 0.12 }));
      g.add(K.dots(L0.slice(5), { r: 0.11, o: 0.7 }));
      g.add(K.dots(L0.slice(1, 5), { r: 0.13, c: 'acc' }));
      g.add(K.dots([L0[0]], { r: 0.13 }));
      g.add(K.dots(L1.slice(1), { r: 0.08, o: 0.25 }));
      g.add(K.dots([L1[0]], { r: 0.2, c: 'acc' }));
      [0, 1, 2, 3, 4].forEach((i) => arr(g, [L0[i][0], 0.15, L0[i][2]], [L1[0][0] + L0[i][0] * 0.08, 2.6, L1[0][2] + L0[i][2] * 0.08], { c: 'acc', o: i ? 0.8 : 0.4, w: 1.4, head: 0.18 }));
      lab(g, 'h⁽ˡ⁾', [4.4, 0, 2.6], { size: 0.4, o: 0.7 });
      lab(g, 'h⁽ˡ⁺¹⁾', [4.4, 2.8, 2.6], { size: 0.4, o: 0.7 });
      lab(g, 'Σ', [0.55, 1.6, 0], { size: 0.42, c: 'acc' });
      legend = [{ c: 'acc', t: 'Neighbour messages' }, { c: 'ink', t: 'Graph' }];
    }
    return { g, legend };
  };
})();
