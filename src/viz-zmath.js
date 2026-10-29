/* Latent Atlas — appendix figures for the 'zmath' chapter (linear algebra & calculus).
   One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K, T;

  /* ---------------- helpers ---------------- */
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const v3 = (a) => (a.isVector3 ? a : V3(a[0], a[1], a[2] || 0));
  const L = (g, t, pos, o = {}) => g.add(K.label(t, pos, Object.assign({ size: 0.36 }, o)));

  /* three faint axes from origin, length s */
  function axes(g, s = 3, o = {}) {
    const op = o.o == null ? 0.4 : o.o;
    g.add(K.line([[0, 0, 0], [s, 0, 0]], { o: op, w: 1 }));
    g.add(K.line([[0, 0, 0], [0, s * (o.hy || 0.8), 0]], { o: op, w: 1 }));
    g.add(K.line([[0, 0, 0], [0, 0, s]], { o: op, w: 1 }));
    if (o.grid) {
      const pairs = [], n = 6;
      for (let i = 0; i <= n; i++) { const t = s * i / n; pairs.push([[t, 0, 0], [t, 0, s]]); pairs.push([[0, 0, t], [s, 0, t]]); }
      g.add(K.segs(pairs, { o: 0.08 }));
    }
  }
  /* small right-angle marker at corner c between unit directions u, v */
  function rightAngle(c, u, v, s = 0.28, o = {}) {
    c = v3(c); u = v3(u).clone().normalize().multiplyScalar(s); v = v3(v).clone().normalize().multiplyScalar(s);
    return K.line([c.clone().add(u), c.clone().add(u).add(v), c.clone().add(v)], { c: o.c, o: o.o == null ? 0.8 : o.o, w: o.w || 1.4 });
  }
  /* arc for angle between directions u and v around centre c, radius r */
  function angleArc(c, u, v, r, o = {}) {
    c = v3(c); u = v3(u).clone().normalize(); v = v3(v).clone().normalize();
    const P = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32; const d = u.clone().multiplyScalar(1 - t).add(v.clone().multiplyScalar(t)).normalize();
      P.push(c.clone().addScaledVector(d, r));
    }
    return K.line(P, { c: o.c, o: o.o, w: o.w || 2 });
  }
  /* tile in the xy plane (matrix cell), top-left origin, row r col c */
  function tile(cx, cy, z, s, o = {}) {
    return K.rect(cx, cy, z, s, s, 'xy', { fill: o.fill == null ? 0.05 : o.fill, fc: o.fc || o.c, c: o.c, o: o.o == null ? 0.55 : o.o, w: 1 });
  }
  function polyFill(pts, o = {}) { // planar polygon from 3D points (fan)
    const P = pts.map(v3), arr = [];
    for (let i = 1; i < P.length - 1; i++) arr.push(P[0], P[i], P[i + 1]);
    const geo = new T.BufferGeometry().setFromPoints(arr);
    return new T.Mesh(geo, new T.MeshBasicMaterial({ color: K.colorOf(o.c), transparent: true, opacity: o.fill == null ? 0.15 : o.fill, side: T.DoubleSide, depthWrite: false }));
  }
  function circ(c, r, n = 64, plane = 'xz') {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const a = 2 * Math.PI * i / n;
      P.push(plane === 'xz' ? [c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)] : [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]]);
    }
    return P;
  }
  /* marching-squares contour pairs of f(x,z)=lvl, drawn at height y */
  function iso(f, lvl, xr, zr, n, y) {
    const pairs = [], dx = (xr[1] - xr[0]) / n, dz = (zr[1] - zr[0]) / n, val = [];
    for (let i = 0; i <= n; i++) { val.push([]); for (let j = 0; j <= n; j++) val[i].push(f(xr[0] + i * dx, zr[0] + j * dz) - lvl); }
    const P = (i0, j0, i1, j1) => { const a = val[i0][j0], b = val[i1][j1], t = a / (a - b); return [xr[0] + (i0 + (i1 - i0) * t) * dx, y, zr[0] + (j0 + (j1 - j0) * t) * dz]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
      for (let k = 0; k < 4; k++) { const [a0, a1] = c[k], [b0, b1] = c[(k + 1) % 4]; if ((val[a0][a1] < 0) !== (val[b0][b1] < 0)) pts.push(P(a0, a1, b0, b1)); }
      if (pts.length >= 2) pairs.push([pts[0], pts[1]]);
      if (pts.length === 4) pairs.push([pts[2], pts[3]]);
    }
    return pairs;
  }

  const B = {};
  const YAW = 0.55; // turns an xy-plane figure towards the default camera
  /* a 2D "board": content drawn in the local xy plane, leaned back slightly and turned to the camera */
  function board(g, lean = 0.3) {
    const s = new T.Group(); s.rotation.x = -lean; g.add(s); g.rotation.y = YAW; return s;
  }
  function grid2(s, x0, x1, y0, y1, step = 1, o = 0.07) {
    const pairs = [];
    for (let x = x0; x <= x1 + 1e-6; x += step) pairs.push([[x, y0, 0], [x, y1, 0]]);
    for (let y = y0; y <= y1 + 1e-6; y += step) pairs.push([[x0, y, 0], [x1, y, 0]]);
    s.add(K.segs(pairs, { o }));
  }

  /* ---------------- vectors ---------------- */
  B.vector = (g) => {
    // axes: x 0..3.8, y 0..3.4, z -3.2..1.2 (z runs away from the viewer so the vector lies across the view)
    const pairs = [];
    for (let i = 0; i <= 6; i++) { const x = -0.6 + 4.4 * i / 6, z = -3.2 + 4.4 * i / 6; pairs.push([[x, 0, -3.2], [x, 0, 1.2]]); pairs.push([[-0.6, 0, z], [3.8, 0, z]]); }
    g.add(K.segs(pairs, { o: 0.08 }));
    g.add(K.line([[-0.6, 0, 0], [3.8, 0, 0]], { o: 0.45, w: 1 }));
    g.add(K.line([[0, 0, 0], [0, 3.4, 0]], { o: 0.45, w: 1 }));
    g.add(K.line([[0, 0, -3.2], [0, 0, 1.2]], { o: 0.45, w: 1 }));
    L(g, 'x', [4.1, 0, 0], { size: 0.3, o: 0.55 });
    L(g, 'y', [0, 3.7, 0], { size: 0.3, o: 0.55 });
    L(g, 'z', [0, 0, -3.5], { size: 0.3, o: 0.55 });
    const v = [3.0, 2.5, -2.2];
    g.add(K.arrow([0, 0, 0], v, { c: 'acc', w: 3, head: 0.4 }));
    // dashed component guides
    g.add(K.line([v, [v[0], 0, v[2]]], { o: 0.45, w: 1.2, dash: true }));
    g.add(K.line([[v[0], 0, 0], [v[0], 0, v[2]], [0, 0, v[2]]], { o: 0.45, w: 1.2, dash: true }));
    g.add(K.dots([[v[0], 0, 0], [0, 0, v[2]]], { r: 0.08 }));
    L(g, 'v', [v[0] + 0.3, v[1] + 0.35, v[2]], { c: 'acc', size: 0.55 });
    L(g, 'v₁', [v[0] + 0.1, -0.4, 0.4], { size: 0.34, o: 0.8 });
    L(g, 'v₃', [-0.45, -0.3, v[2]], { size: 0.34, o: 0.8 });
    L(g, 'v₂', [v[0] + 0.45, v[1] / 2, v[2]], { size: 0.34, o: 0.8 });
    L(g, 'v = [v₁, v₂, v₃]', [0.6, 3.3, -1.6], { size: 0.38, c: 'acc' });
    return [{ c: 'acc', t: 'Vector' }];
  };

  B.matrix = (g, p) => {
    const R = 4, C = 5, s = 0.9, rng = K.rng(7);
    const x0 = -(C - 1) * s / 2, y0 = (R - 1) * s / 2;
    const ri = 1, ci = 3;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const x = x0 + c * s, y = y0 - r * s, hit = r === ri && c === ci;
      const inLine = r === ri || c === ci;
      g.add(K.rect(x, y, 0, s * 0.9, s * 0.9, 'xy', { fill: hit ? 0.75 : inLine ? 0.14 : 0.04, fc: hit || inLine ? 'acc' : null, c: hit ? 'acc' : null, o: hit ? 1 : 0.45, w: hit ? 1.6 : 1 }));
      const val = (rng() * 9 - 3).toFixed(0);
      if (!hit) L(g, val, [x, y, 0.02], { size: 0.3, mono: true, o: inLine ? 0.7 : 0.4 });
    }
    L(g, 'aᵢⱼ', [x0 + ci * s, y0 - ri * s, 0.05], { size: 0.34, c: 'ink' });
    // brackets
    const hw = C * s / 2 + 0.15, hh = R * s / 2 + 0.1;
    g.add(K.line([[-hw + 0.2, hh, 0], [-hw, hh, 0], [-hw, -hh, 0], [-hw + 0.2, -hh, 0]], { w: 1.6 }));
    g.add(K.line([[hw - 0.2, hh, 0], [hw, hh, 0], [hw, -hh, 0], [hw - 0.2, -hh, 0]], { w: 1.6 }));
    L(g, 'm = 4', [-hw - 0.9, 0, 0], { size: 0.32, o: 0.7, mono: true });
    L(g, 'n = 5', [0, hh + 0.45, 0], { size: 0.32, o: 0.7, mono: true });
    L(g, 'i', [-hw - 0.35, y0 - ri * s, 0], { size: 0.32, c: 'acc' });
    L(g, 'j', [x0 + ci * s, -hh - 0.35, 0], { size: 0.32, c: 'acc' });
    g.rotation.y = YAW;
    return [{ c: 'acc', t: 'Entry aᵢⱼ' }];
  };

  B.tensor = (g) => {
    const s = 0.5, gap = 0.06, cell = (x, y, z, o) => g.add(K.box(x, y, z, s - gap, s - gap, s - gap, o));
    const ink = { fill: 0.07, o: 0.6 }, acc = { fill: 0.12, fc: 'acc', c: 'acc', o: 0.85 };
    // scalar
    cell(-5.2, 0, 0, ink);
    // vector (4)
    for (let i = 0; i < 4; i++) cell(-4.0, (1.5 - i) * s, 0, ink);
    // matrix (4x4)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) cell(-2.8 + j * s, (1.5 - i) * s, 0, ink);
    // 3D tensor (4x4x4)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) cell(0.4 + j * s, (1.5 - i) * s, (0.75 - k) * s - 0.4, acc);
    const y = -1.5;
    L(g, '()', [-5.2, y, 0], { size: 0.32, o: 0.7, mono: true });
    L(g, '(4)', [-4.0, y, 0], { size: 0.32, o: 0.7, mono: true });
    L(g, '(4, 4)', [-2.05, y, 0], { size: 0.32, o: 0.7, mono: true });
    L(g, '(4, 4, 4)', [1.15, y, 0.3], { size: 0.36, c: 'acc', mono: true });
    g.rotation.y = YAW;
    return [{ c: 'acc', t: 'Rank-3 tensor' }];
  };

  B.dotproduct = (g) => {
    const s = board(g);
    const a = V3(1.5, 2.7, 0), bdir = V3(4.4, 0.7, 0), bn = bdir.clone().normalize();
    const pl = a.dot(bn), pr = bn.clone().multiplyScalar(pl);
    grid2(s, -0.5, 5.5, -1, 3.5, 0.5);
    s.add(K.arrow([0, 0, 0], a, { w: 2.2 }));
    s.add(K.arrow([0, 0, 0], bdir, { w: 2.2 }));
    s.add(K.line([V3(0, 0, 0.03), pr.clone().setZ(0.03)], { c: 'acc', w: 6 }));
    s.add(K.line([a, pr], { o: 0.5, w: 1.2, dash: true }));
    s.add(rightAngle(pr, bn.clone().negate(), a.clone().sub(pr), 0.28, { o: 0.6, w: 1 }));
    s.add(angleArc([0, 0, 0], bn, a, 0.85, { o: 0.75, w: 1.4 }));
    const mid = bn.clone().add(a.clone().normalize()).normalize();
    L(s, 'θ', mid.multiplyScalar(1.15).toArray(), { size: 0.34 });
    L(s, 'a', [a.x - 0.25, a.y + 0.3, 0], { size: 0.45 });
    L(s, 'b', [bdir.x + 0.35, bdir.y + 0.15, 0], { size: 0.45 });
    const nrm = V3(bn.y, -bn.x, 0);
    L(s, '|a| cos θ', pr.clone().multiplyScalar(0.5).addScaledVector(nrm, 0.5).toArray(), { size: 0.34, c: 'acc' });
    // the scalar result as a bar: a·b = (|a| cos θ)·|b|
    const H = a.dot(bdir) / 3;
    s.add(K.box(6.6, H / 2 - 1, 0.2, 0.45, H, 0.4, { fill: 0.6, fc: 'acc', c: 'acc' }));
    s.add(K.line([[6.2, -1, 0], [7.0, -1, 0]], { o: 0.45, w: 1 }));
    L(s, 'a·b', [6.6, H - 1 + 0.4, 0.2], { size: 0.42, c: 'acc' });
    return [{ c: 'acc', t: 'Projection of a on b' }];
  };

  B.matmul = (g) => {
    // C = A B laid out: A on left (m x k), B on top (k x n), C bottom-right
    const s = 0.62, m = 3, k = 4, n = 3, ri = 1, cj = 2;
    const cx0 = 0.6, cy0 = 0; // C top-left cell centre
    const cell = (x, y, o) => g.add(tile(x, y, 0, s * 0.88, o));
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      const hit = i === ri && j === cj;
      cell(cx0 + j * s, cy0 - i * s, hit ? { fill: 0.75, fc: 'acc', c: 'acc', o: 1 } : {});
    }
    for (let i = 0; i < m; i++) for (let q = 0; q < k; q++) {
      const hit = i === ri;
      cell(cx0 - (k - q) * s - 0.4, cy0 - i * s, hit ? { fill: 0.35, fc: 'acc', c: 'acc', o: 0.9 } : {});
    }
    for (let q = 0; q < k; q++) for (let j = 0; j < n; j++) {
      const hit = j === cj;
      cell(cx0 + j * s, cy0 + (k - q) * s + 0.4, hit ? { fill: 0.35, fc: 'acc', c: 'acc', o: 0.9 } : {});
    }
    // guide lines from row and column to the cell
    const tgt = V3(cx0 + cj * s, cy0 - ri * s, 0);
    g.add(K.line([[cx0 - 0.4 - 0.5 * s, tgt.y, 0.02], [tgt.x - 0.35 * s, tgt.y, 0.02]], { c: 'acc', o: 0.6, w: 1.2, dash: true }));
    g.add(K.line([[tgt.x, cy0 + 0.4 + 0.5 * s, 0.02], [tgt.x, tgt.y + 0.35 * s, 0.02]], { c: 'acc', o: 0.6, w: 1.2, dash: true }));
    L(g, 'A', [cx0 - 0.4 - k * s / 2 - 0.5 * s, cy0 + 0.75, 0], { size: 0.5 });
    L(g, 'B', [cx0 - 0.95, cy0 + 0.4 + k * s / 2 + 0.5 * s, 0], { size: 0.5 });
    L(g, 'C = AB', [cx0 + s, cy0 - m * s - 0.15, 0], { size: 0.4 });
    L(g, 'm×k', [cx0 - 0.4 - k * s / 2 - 0.5 * s, cy0 - m * s - 0.15, 0], { size: 0.3, o: 0.6, mono: true });
    L(g, 'k×n', [cx0 + n * s + 0.35, cy0 + 0.4 + k * s / 2 + 0.5 * s, 0], { size: 0.3, o: 0.6, mono: true });
    L(g, 'cᵢⱼ = Σ aᵢₖ bₖⱼ', [cx0 + 3.4, cy0 - ri * s, 0], { size: 0.34, c: 'acc' });
    g.rotation.y = YAW;
    return [{ c: 'acc', t: 'Row · column' }];
  };

  B.vecnorm = (g) => {
    const s = board(g);
    const v = V3(3.0, 2.0, 0), n2 = v.length(), n1 = Math.abs(v.x) + Math.abs(v.y);
    grid2(s, -5, 5, -5, 5, 1, 0.06);
    s.add(K.line([[-5.3, 0, 0], [5.3, 0, 0]], { o: 0.4, w: 1 }));
    s.add(K.line([[0, -5.3, 0], [0, 5.3, 0]], { o: 0.4, w: 1 }));
    // every point at the same norm as v: circle (L2) and diamond (L1)
    s.add(K.line(circ([0, 0, 0], n2, 96, 'xy'), { c: 'acc', o: 0.45, w: 1.2 }));
    s.add(K.line([[n1, 0, 0], [0, n1, 0], [-n1, 0, 0], [0, -n1, 0], [n1, 0, 0]], { c: 'b', o: 0.45, w: 1.2 }));
    // L1 path along the axes, L2 straight
    s.add(K.line([[0, 0, 0.02], [v.x, 0, 0.02], [v.x, v.y, 0.02]], { c: 'b', w: 2.8 }));
    s.add(K.arrow([0, 0, 0.04], [v.x, v.y, 0.04], { c: 'acc', w: 3, head: 0.34 }));
    s.add(K.dots([v], { r: 0.11 }));
    L(s, 'v', [v.x + 0.4, v.y + 0.45, 0], { size: 0.6 });
    L(s, '|v₁|', [v.x / 2, -0.5, 0], { size: 0.44, c: 'b' });
    L(s, '|v₂|', [v.x + 0.75, v.y / 2, 0], { size: 0.44, c: 'b' });
    // norms as bars
    const k = 0.75, bx = 6.6, y0 = -3;
    s.add(K.line([[bx - 0.8, y0, 0], [bx + 0.8, y0, 0]], { o: 0.45, w: 1 }));
    s.add(K.box(bx - 0.35, y0 + n2 * k / 2, 0.2, 0.42, n2 * k, 0.4, { fill: 0.6, fc: 'acc', c: 'acc' }));
    s.add(K.box(bx + 0.35, y0 + n1 * k / 2, 0.2, 0.42, n1 * k, 0.4, { fill: 0.6, fc: 'b', c: 'b' }));
    L(s, '‖v‖₂', [bx - 0.5, y0 + n2 * k + 0.5, 0.2], { size: 0.46, c: 'acc' });
    L(s, '‖v‖₁', [bx + 0.5, y0 + n1 * k + 0.5, 0.2], { size: 0.46, c: 'b' });
    return [{ c: 'acc', t: 'L2 norm' }, { c: 'b', t: 'L1 norm' }];
  };

  B.euclidean = (g) => {
    axes(g, 4, { grid: true, o: 0.3 });
    const P = V3(0.8, 0.6, 3.2), Q = V3(3.4, 2.8, 0.9);
    // box legs dx, dz, dy
    const c1 = V3(Q.x, P.y, P.z), c2 = V3(Q.x, P.y, Q.z);
    g.add(K.line([P, c1, c2, Q], { o: 0.55, w: 1.2, dash: true }));
    g.add(rightAngle(c1, V3(-1, 0, 0), V3(0, 0, -1), 0.22, { o: 0.5, w: 1 }));
    g.add(rightAngle(c2, V3(0, 0, 1), V3(0, 1, 0), 0.22, { o: 0.5, w: 1 }));
    g.add(K.line([P, Q], { c: 'acc', w: 3 }));
    g.add(K.dots([P, Q], { r: 0.13 }));
    // drop lines to floor
    g.add(K.line([P, [P.x, 0, P.z]], { o: 0.2, w: 1 }));
    g.add(K.line([Q, [Q.x, 0, Q.z]], { o: 0.2, w: 1 }));
    L(g, 'p', [P.x - 0.35, P.y + 0.35, P.z], { size: 0.45 });
    L(g, 'q', [Q.x + 0.3, Q.y + 0.35, Q.z], { size: 0.45 });
    L(g, 'Δx', [(P.x + Q.x) / 2, P.y - 0.35, P.z + 0.2], { size: 0.3, o: 0.7 });
    L(g, 'Δz', [Q.x + 0.4, P.y - 0.3, (P.z + Q.z) / 2], { size: 0.3, o: 0.7 });
    L(g, 'Δy', [Q.x + 0.45, (P.y + Q.y) / 2, Q.z], { size: 0.3, o: 0.7 });
    const m = P.clone().add(Q).multiplyScalar(0.5);
    L(g, 'd = √(Δx²+Δy²+Δz²)', [m.x - 1.2, m.y + 1.2, m.z], { size: 0.32, c: 'acc' });
    return [{ c: 'acc', t: 'Straight-line distance' }];
  };

  B.cosine = (g) => {
    const s = board(g);
    grid2(s, -0.5, 5, -0.5, 4.5, 0.5);
    const a = V3(4.3, 1.1, 0), b = V3(1.3, 2.4, 0), b2 = b.clone().multiplyScalar(1.75);
    const an = a.clone().normalize(), bn = b.clone().normalize(), R = 1.3;
    const quarter = []; for (let i = 0; i <= 40; i++) { const t = Math.PI / 2 * i / 40; quarter.push([R * Math.cos(t), R * Math.sin(t), 0]); }
    s.add(K.line(quarter, { o: 0.3, w: 1 }));
    s.add(K.line([b, b2], { o: 0.35, w: 1.2, dash: true }));
    s.add(K.dots([b2], { r: 0.08, o: 0.4 }));
    s.add(K.arrow([0, 0, 0], a, { w: 2.2 }));
    s.add(K.arrow([0, 0, 0], b, { w: 2.2 }));
    const wedge = [V3(0, 0, 0.01)];
    for (let i = 0; i <= 24; i++) { const t = i / 24; wedge.push(an.clone().multiplyScalar(1 - t).add(bn.clone().multiplyScalar(t)).normalize().multiplyScalar(R).setZ(0.01)); }
    s.add(polyFill(wedge, { c: 'acc', fill: 0.3 }));
    s.add(angleArc([0, 0, 0.02], an, bn, R, { c: 'acc', w: 3 }));
    const mid = an.clone().add(bn).normalize();
    L(s, 'θ', mid.clone().multiplyScalar(R + 0.35).toArray(), { size: 0.42, c: 'acc' });
    L(s, 'a', [a.x + 0.35, a.y + 0.1, 0], { size: 0.46 });
    L(s, 'b', [b.x + 0.35, b.y - 0.2, 0], { size: 0.46 });
    L(s, '1.75 b', [b2.x + 0.75, b2.y, 0], { size: 0.32, o: 0.5 });
    // cosine gauge in [−1, 1]
    const cs = an.dot(bn), gx = 6.3, gy = 1.8, H = 1.8;
    s.add(K.line([[gx, gy - H, 0], [gx, gy + H, 0]], { o: 0.45, w: 1 }));
    s.add(K.segs([[[gx - 0.15, gy + H, 0], [gx + 0.15, gy + H, 0]], [[gx - 0.15, gy, 0], [gx + 0.15, gy, 0]], [[gx - 0.15, gy - H, 0], [gx + 0.15, gy - H, 0]]], { o: 0.45 }));
    s.add(K.box(gx, gy + cs * H / 2, 0.15, 0.36, cs * H, 0.3, { fill: 0.6, fc: 'acc', c: 'acc' }));
    L(s, '1', [gx + 0.45, gy + H, 0], { size: 0.28, o: 0.6 });
    L(s, '0', [gx + 0.45, gy, 0], { size: 0.28, o: 0.6 });
    L(s, '−1', [gx + 0.5, gy - H, 0], { size: 0.28, o: 0.6 });
    L(s, 'cos θ', [gx, gy + H + 0.5, 0], { size: 0.38, c: 'acc' });
    return [{ c: 'acc', t: 'Angle between vectors' }];
  };

  B.distmetric = (g) => {
    const s = board(g);
    grid2(s, -4, 4, -2, 4, 1);
    const P = V3(-3.2, -1.2, 0), Q = V3(-0.6, 3.2, 0), R = V3(3.2, -0.6, 0);
    s.add(K.line([P, Q, R], { o: 0.75, w: 1.8, dash: true }));
    s.add(K.line([P, R], { c: 'acc', w: 3.2 }));
    s.add(K.dots([P, Q, R], { r: 0.13 }));
    L(s, 'p', [P.x - 0.4, P.y - 0.3, 0], { size: 0.46 });
    L(s, 'q', [Q.x, Q.y + 0.45, 0], { size: 0.46 });
    L(s, 'r', [R.x + 0.4, R.y - 0.3, 0], { size: 0.46 });
    L(s, 'd(p,r)', [0, (P.y + R.y) / 2 - 0.5, 0], { size: 0.34, c: 'acc' });
    // lengths compared: direct ≤ detour (triangle inequality)
    const dpr = P.distanceTo(R), dpq = P.distanceTo(Q), dqr = Q.distanceTo(R), k = 0.5, bx = 5.8, y0 = -1.6;
    s.add(K.line([[bx - 0.8, y0, 0], [bx + 0.9, y0, 0]], { o: 0.45, w: 1 }));
    s.add(K.box(bx - 0.35, y0 + dpr * k / 2, 0.2, 0.42, dpr * k, 0.4, { fill: 0.6, fc: 'acc', c: 'acc' }));
    s.add(K.box(bx + 0.35, y0 + dpq * k / 2, 0.2, 0.42, dpq * k, 0.4, { fill: 0.06, o: 0.7 }));
    s.add(K.box(bx + 0.35, y0 + dpq * k + dqr * k / 2, 0.2, 0.42, dqr * k, 0.4, { fill: 0.2, o: 0.7 }));
    L(s, 'd(p,q)', [bx + 1.35, y0 + dpq * k / 2, 0.2], { size: 0.34, o: 0.75 });
    L(s, 'd(q,r)', [bx + 1.35, y0 + dpq * k + dqr * k / 2, 0.2], { size: 0.34, o: 0.75 });
    L(s, '≤', [bx - 0.4, y0 + dpr * k + 0.55, 0.6], { size: 0.6, c: 'acc' });
    return [{ c: 'acc', t: 'Direct distance' }];
  };

  B.projection = (g) => {
    const S = 3.2;
    g.add(K.rect(0, 0, 0, 2 * S, 2 * S, 'xz', { fill: 0.06, o: 0.35 }));
    const pairs = [];
    for (let i = -4; i <= 4; i++) { const t = i * S / 4; pairs.push([[t, 0, -S], [t, 0, S]]); pairs.push([[-S, 0, t], [S, 0, t]]); }
    g.add(K.segs(pairs, { o: 0.07 }));
    const v = V3(2.5, 2.9, -2.0), pv = V3(v.x, 0, v.z);
    g.add(K.arrow([0, 0, 0], v, { w: 2.4 }));
    g.add(K.arrow([0, 0.01, 0], pv, { c: 'acc', w: 3.2, head: 0.34 }));
    g.add(K.line([v, pv], { o: 0.55, w: 1.2, dash: true }));
    g.add(rightAngle(pv, V3(0, 1, 0), pv.clone().negate(), 0.32, { o: 0.75, w: 1.2 }));
    L(g, 'v', [v.x - 0.1, v.y + 0.4, v.z], { size: 0.5 });
    L(g, 'proj(v)', [pv.x * 0.5 + 0.3, -0.35, pv.z * 0.5 + 0.5], { size: 0.38, c: 'acc' });
    L(g, 'v − proj(v)', [v.x + 1.05, v.y * 0.5, v.z], { size: 0.32, o: 0.6 });
    L(g, 'W', [-S + 0.5, 0.2, S - 0.5], { size: 0.44, o: 0.6 });
    return [{ c: 'acc', t: 'Projection' }];
  };

  B.orthogonal = (g) => {
    const s = 2.8;
    const u = V3(s, 0, 0), v = V3(0, s, 0), w = V3(0, 0, s);
    const q = new T.Quaternion().setFromEuler(new T.Euler(0.1, -0.12, 0.05));
    [u, v, w].forEach((x) => x.applyQuaternion(q));
    const pairs = [];
    for (let i = -3; i <= 3; i++) { pairs.push([[i, -0.5, -3], [i, -0.5, 3]]); pairs.push([[-3, -0.5, i], [3, -0.5, i]]); }
    g.add(K.segs(pairs, { o: 0.06 }));
    [u, v, w].forEach((x) => g.add(K.arrow([0, 0, 0], x, { w: 2.4 })));
    g.add(rightAngle([0, 0, 0], u, v, 0.5, { c: 'acc', o: 1, w: 2.4 }));
    g.add(rightAngle([0, 0, 0], v, w, 0.5, { c: 'acc', o: 1, w: 2.4 }));
    g.add(rightAngle([0, 0, 0], u, w, 0.5, { c: 'acc', o: 1, w: 2.4 }));
    L(g, 'u', u.clone().multiplyScalar(1.14).toArray(), { size: 0.46 });
    L(g, 'v', v.clone().multiplyScalar(1.12).toArray(), { size: 0.46 });
    L(g, 'w', w.clone().multiplyScalar(1.14).toArray(), { size: 0.46 });
    L(g, 'u·v = u·w = v·w = 0', [1.2, 3.6, -1.2], { size: 0.36, c: 'acc' });
    return [{ c: 'acc', t: 'Right angle' }];
  };

  B.eigen = (g) => {
    const s = board(g, 0.3);
    const th = 0.45, l1 = 1.9, l2 = 0.5, c = Math.cos(th), sn = Math.sin(th);
    const e1 = V3(c, sn, 0), e2 = V3(-sn, c, 0);
    const A = (p) => { const p1 = p.dot(e1), p2 = p.dot(e2); return e1.clone().multiplyScalar(l1 * p1).addScaledVector(e2, l2 * p2); };
    const r = 1.8, circle = [], ell = [];
    for (let i = 0; i <= 96; i++) { const a = 2 * Math.PI * i / 96, p = V3(r * Math.cos(a), r * Math.sin(a), 0); circle.push(p); ell.push(A(p)); }
    grid2(s, -4, 4, -3, 3, 1, 0.06);
    s.add(K.line(circle, { o: 0.4, w: 1.2, dash: true }));
    s.add(K.line(ell, { w: 1.8 }));
    // ordinary vectors get turned: v → Av
    const moves = [];
    for (let i = 0; i < 16; i++) {
      const a = 2 * Math.PI * (i + 0.5) / 16, p = V3(r * Math.cos(a), r * Math.sin(a), 0);
      moves.push([p, A(p)]);
    }
    s.add(K.segs(moves, { o: 0.3 }));
    s.add(K.dots(moves.map((m) => m[0]), { r: 0.045, o: 0.35 }));
    // eigenvectors stay on their own line, only scaled
    [[e1, l1], [e2, l2]].forEach(([e, l]) => {
      s.add(K.line([e.clone().multiplyScalar(-4.4), e.clone().multiplyScalar(4.4)], { c: 'acc', o: 0.3, w: 1 }));
      s.add(K.arrow([0, 0, 0.03], e.clone().multiplyScalar(r * l).setZ(0.03), { c: 'acc', w: 3, head: 0.3 }));
      s.add(K.dots([e.clone().multiplyScalar(r)], { r: 0.1 }));
    });
    L(s, 'v₁', e1.clone().multiplyScalar(r).addScaledVector(e2, -0.45).toArray(), { size: 0.4 });
    L(s, 'λ₁v₁', e1.clone().multiplyScalar(r * l1 + 0.75).toArray(), { size: 0.44, c: 'acc' });
    L(s, 'v₂', e2.clone().multiplyScalar(r + 0.45).toArray(), { size: 0.4 });
    L(s, 'λ₂v₂', e2.clone().multiplyScalar(r * l2 * 0.6).addScaledVector(e1, -0.85).toArray(), { size: 0.4, c: 'acc' });
    L(s, 'Av = λv', [-3, 2.6, 0], { size: 0.42, c: 'acc' });
    return [{ c: 'acc', t: 'Eigenvectors' }];
  };

  B.matrank = (g) => {
    const para = (O, a, b, c) => {
      const P = (i, j, k) => O.clone().addScaledVector(a, i).addScaledVector(b, j).addScaledVector(c, k);
      const e = [];
      for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) { e.push([P(i, j, 0), P(i, j, 1)]); e.push([P(i, 0, j), P(i, 1, j)]); e.push([P(0, i, j), P(1, i, j)]); }
      g.add(K.segs(e, { o: 0.3 }));
    };
    // rank 3: three independent columns span a solid
    const a = V3(2.2, 0.2, -0.9), b = V3(0.2, 2.1, 0.1), c = V3(0.3, 0.2, 1.9);
    const O1 = V3(-4.6, 0, 1.6);
    para(O1, a, b, c);
    [a, b, c].forEach((v) => g.add(K.arrow(O1, O1.clone().add(v), { w: 2.6 })));
    L(g, 'r = 3', [O1.x + 1.2, -0.7, O1.z + 1.6], { size: 0.46 });
    // rank 2: the third column lies in the plane of the first two
    const a2 = V3(2.4, 0.2, -1.0), b2 = V3(0.4, 2.0, 0.9), c2 = a2.clone().multiplyScalar(0.6).addScaledVector(b2, 0.75);
    const O2 = V3(1.4, 0, -0.8);
    const P = (i, j) => O2.clone().addScaledVector(a2, i).addScaledVector(b2, j);
    const quad = [P(-0.2, -0.2), P(1.3, -0.2), P(1.3, 1.3), P(-0.2, 1.3)];
    g.add(polyFill(quad, { c: 'acc', fill: 0.16 }));
    g.add(K.line([...quad, quad[0]], { c: 'acc', o: 0.5, w: 1 }));
    g.add(K.arrow(O2, O2.clone().add(a2), { w: 2.2 }));
    g.add(K.arrow(O2, O2.clone().add(b2), { w: 2.2 }));
    g.add(K.arrow(O2, O2.clone().add(c2), { c: 'acc', w: 2.8 }));
    L(g, 'a₁', O2.clone().add(a2).add(V3(0.3, -0.3, 0)).toArray(), { size: 0.34 });
    L(g, 'a₂', O2.clone().add(b2).add(V3(-0.2, 0.35, 0)).toArray(), { size: 0.34 });
    L(g, 'a₃ = 0.6a₁ + 0.75a₂', O2.clone().add(c2).add(V3(0.6, 0.45, 0)).toArray(), { size: 0.32, c: 'acc' });
    L(g, 'r = 2', [O2.x + 1.4, -0.7, O2.z + 1.0], { size: 0.46, c: 'acc' });
    return [{ c: 'acc', t: 'Dependent column' }];
  };

  B.covmatrix = (g) => {
    const C = [[1.0, 0.7, -0.4, 0.1], [0.7, 1.2, -0.3, 0.2], [-0.4, -0.3, 0.8, -0.5], [0.1, 0.2, -0.5, 0.9]];
    const n = 4, s = 1.05, H = 1.7, half = n * s / 2;
    const x0 = -(n - 1) * s / 2;
    g.add(K.rect(0, 0, 0, n * s, n * s, 'xz', { o: 0.35, w: 1 }));
    const pairs = [];
    for (let i = 1; i < n; i++) { const t = -half + i * s; pairs.push([[t, 0, -half], [t, 0, half]]); pairs.push([[-half, 0, t], [half, 0, t]]); }
    g.add(K.segs(pairs, { o: 0.15 }));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = C[i][j], h = Math.abs(v) * H, x = x0 + j * s, z = x0 + i * s;
      const st = i === j ? { fill: 0.7, fc: 'acc', c: 'acc' } : v < 0 ? { fill: 0, o: 0.4 } : { fill: 0.14, o: 0.75 };
      g.add(K.box(x, h / 2, z, s * 0.55, h, s * 0.55, st));
    }
    const lab = ['x₁', 'x₂', 'x₃', 'x₄'];
    for (let i = 0; i < n; i++) {
      L(g, lab[i], [x0 + i * s, 0, half + 0.5], { size: 0.34, o: 0.7 });
      L(g, lab[i], [-half - 0.5, 0, x0 + i * s], { size: 0.34, o: 0.7 });
    }
    L(g, 'Var(x₂)', [x0 + s, C[1][1] * H + 0.45, x0 + s], { size: 0.36, c: 'acc' });
    L(g, 'Σ = Σᵀ', [half + 1.3, 0.3, half + 0.4], { size: 0.38, o: 0.7 });
    g.rotation.y = Math.PI / 2; // diagonal runs across the view instead of into it
    return [{ c: 'acc', t: 'Variances (diagonal)' }];
  };

  /* ---------------- calculus ---------------- */
  B.derivative = (g) => {
    const f = (x) => 1.9 + 0.9 * Math.sin(0.9 * x) + 0.1 * x * x;
    const df = (x) => (f(x + 1e-4) - f(x - 1e-4)) / 2e-4;
    const pts = []; for (let i = 0; i <= 120; i++) { const x = -4 + 8 * i / 120; pts.push([x, f(x), 0]); }
    g.add(K.line([[-4.3, 0, 0], [4.3, 0, 0]], { o: 0.45, w: 1 }));
    g.add(K.line([[-4.3, 0, 0], [-4.3, 4.6, 0]], { o: 0.45, w: 1 }));
    g.add(K.line(pts, { w: 2 }));
    const x0 = 0.2, y0 = f(x0), m = df(x0);
    // secants shrinking towards the tangent (faint)
    [2.4, 1.2].forEach((h, k) => {
      const m2 = (f(x0 + h) - y0) / h;
      g.add(K.line([[x0 - 1.2, y0 - 1.2 * m2, 0], [x0 + h + 0.6, y0 + (h + 0.6) * m2, 0]], { o: 0.22 + 0.12 * k, w: 1.2, dash: true }));
      g.add(K.dots([[x0 + h, f(x0 + h), 0]], { r: 0.06, o: 0.35 + 0.15 * k }));
    });
    g.add(K.line([[x0 - 2.0, y0 - 2.0 * m, 0], [x0 + 2.0, y0 + 2.0 * m, 0]], { c: 'acc', w: 2.8 }));
    const dx = 1.0;
    g.add(K.line([[x0, y0, 0], [x0 + dx, y0, 0], [x0 + dx, y0 + dx * m, 0]], { c: 'acc', o: 0.8, w: 1.4 }));
    g.add(K.dots([[x0, y0, 0]], { r: 0.12, c: 'acc' }));
    g.add(K.line([[x0, 0, 0], [x0, y0, 0]], { o: 0.3, w: 1, dash: true }));
    L(g, 'dx', [x0 + dx / 2, y0 - 0.32, 0], { size: 0.32, c: 'acc' });
    L(g, 'dy', [x0 + dx + 0.35, y0 + dx * m / 2, 0], { size: 0.32, c: 'acc' });
    L(g, 'f′(x) = dy/dx', [x0 - 1.9, y0 + 0.2, 0], { size: 0.38, c: 'acc' });
    L(g, 'f(x)', [4.3, f(4) + 0.2, 0], { size: 0.36 });
    L(g, 'x', [x0, -0.35, 0], { size: 0.32, o: 0.7 });
    g.rotation.y = YAW;
    return [{ c: 'acc', t: 'Tangent slope' }];
  };

  B.partialderiv = (g) => {
    const f = (x, z) => 0.6 + 0.13 * x * x - 0.08 * z * z + 0.25 * Math.sin(0.8 * x + 0.3 * z);
    g.add(K.surface(f, { xr: [-3.5, 3.5], zr: [-3.5, 3.5], n: 22, o: 0.2 }));
    const z0 = 1.2, x0 = -2.1;
    g.add(K.rect(0, 1.2, z0, 7.2, 3.6, 'xy', { fill: 0.07, fc: 'acc', c: 'acc', o: 0.35, w: 1 }));
    const sl = []; for (let i = 0; i <= 80; i++) { const x = -3.5 + 7 * i / 80; sl.push([x, f(x, z0) + 0.01, z0]); }
    g.add(K.line(sl, { c: 'acc', w: 2.8 }));
    const y0 = f(x0, z0), m = (f(x0 + 1e-4, z0) - f(x0 - 1e-4, z0)) / 2e-4;
    g.add(K.line([[x0 - 1.0, y0 - 1.0 * m, z0 + 0.02], [x0 + 1.1, y0 + 1.1 * m, z0 + 0.02]], { w: 3.2 }));
    g.add(K.dots([[x0, y0, z0]], { r: 0.12 }));
    L(g, '∂f/∂x', [x0 + 1.3, y0 + 0.5, z0 + 0.1], { size: 0.44, c: 'acc' });
    L(g, 'z = z₀', [-2.9, 2.7, z0], { size: 0.34, c: 'acc', o: 0.85 });
    L(g, 'x', [4.0, f(3.5, -3.5), -3.5], { size: 0.32, o: 0.6 });
    L(g, 'z', [-3.5, f(-3.5, 3.5), 4.0], { size: 0.32, o: 0.6 });
    return [{ c: 'acc', t: 'Slice at fixed z' }];
  };

  B.gradient = (g) => {
    const pk = [0.4, -0.6];
    const f = (x, z) => 1.7 * Math.exp(-((x - pk[0]) ** 2 + (z - pk[1]) ** 2) / 5);
    const ys = 1.3, lift = 0.9, fl = -0.8;
    g.add(K.surface(f, { xr: [-4, 4], zr: [-4, 4], n: 24, ys, o: 0.2 }).translateY(lift));
    const pr = [];
    [0.2, 0.45, 0.75, 1.05, 1.35].forEach((lv) => pr.push(...iso(f, lv, [-4, 4], [-4, 4], 48, fl)));
    g.add(K.segs(pr, { o: 0.4 }));
    g.add(K.rect(0, fl, 0, 8, 8, 'xz', { o: 0.15, w: 1 }));
    const gr = (x, z) => { const h = 1e-4; return [(f(x + h, z) - f(x - h, z)) / (2 * h), (f(x, z + h) - f(x, z - h)) / (2 * h)]; };
    // the point sits on the screen-right side of the peak, so its gradient points across the view
    const P = [pk[0] + 2.2, pk[1] - 1.75], d = gr(P[0], P[1]), m = Math.hypot(d[0], d[1]), sc = 1.9 / m;
    const A0 = [P[0], fl + 0.01, P[1]], A1 = [P[0] + d[0] * sc, fl + 0.01, P[1] + d[1] * sc];
    g.add(K.arrow(A0, A1, { c: 'acc', w: 3.2, head: 0.34 }));
    const yS = f(P[0], P[1]) * ys + lift;
    g.add(K.dots([[P[0], yS, P[1]]], { r: 0.11, c: 'acc' }));
    g.add(K.dots([A0], { r: 0.08, c: 'acc' }));
    g.add(K.line([[P[0], yS, P[1]], A0], { o: 0.35, w: 1, dash: true }));
    const up = []; for (let i = 0; i <= 24; i++) { const t = i / 24, x = P[0] + d[0] * sc * t, z = P[1] + d[1] * sc * t; up.push([x, f(x, z) * ys + lift + 0.02, z]); }
    g.add(K.line(up, { c: 'acc', w: 2.4 }));
    L(g, '∇f', [A1[0] + 0.1, fl - 0.45, A1[2] + 0.2], { size: 0.46, c: 'acc' });
    L(g, 'f(x, z)', [-4.2, lift + 0.4, 4.2], { size: 0.36, o: 0.6 });
    return [{ c: 'acc', t: 'Steepest ascent' }];
  };

  B.jacobian = (g) => {
    // input grid at left (xy plane, z=0), warped output grid at right
    const F = (u, v) => [u + 0.25 * v * v - 0.15 * u * v, v + 0.3 * Math.sin(1.1 * u) + 0.12 * u * u];
    const n = 8, R = 1.6, pairsA = [], pairsB = [], ox = -3.4, oxB = 2.6;
    const P = (u, v) => [ox + u, v, 0];
    const Q = (u, v) => { const w = F(u, v); return [oxB + w[0], w[1], 0]; };
    for (let i = 0; i <= n; i++) {
      const t = -R + 2 * R * i / n;
      for (let j = 0; j < 16; j++) {
        const s0 = -R + 2 * R * j / 16, s1 = -R + 2 * R * (j + 1) / 16;
        pairsA.push([P(t, s0), P(t, s1)]); pairsA.push([P(s0, t), P(s1, t)]);
        pairsB.push([Q(t, s0), Q(t, s1)]); pairsB.push([Q(s0, t), Q(s1, t)]);
      }
    }
    g.add(K.segs(pairsA, { o: 0.3 }));
    g.add(K.segs(pairsB, { o: 0.3 }));
    // the small cell at (u0,v0) and its image
    const u0 = 0.4, v0 = 0.4, h = 2 * R / n;
    const cellA = [P(u0, v0), P(u0 + h, v0), P(u0 + h, v0 + h), P(u0, v0 + h)];
    const cellB = []; for (let k = 0; k <= 8; k++) cellB.push(Q(u0 + h * k / 8, v0)); for (let k = 0; k <= 8; k++) cellB.push(Q(u0 + h, v0 + h * k / 8));
    for (let k = 0; k <= 8; k++) cellB.push(Q(u0 + h - h * k / 8, v0 + h)); for (let k = 0; k <= 8; k++) cellB.push(Q(u0, v0 + h - h * k / 8));
    g.add(polyFill(cellA, { c: 'acc', fill: 0.5 }));
    g.add(polyFill(cellB, { c: 'acc', fill: 0.5 }));
    g.add(K.line([...cellA, cellA[0]], { c: 'acc', w: 1.8 }));
    g.add(K.line(cellB, { c: 'acc', w: 1.8 }));
    // Jacobian columns: images of the unit steps
    const e = 1e-4, c = Q(u0, v0);
    const Ju = [(Q(u0 + e, v0)[0] - c[0]) / e, (Q(u0 + e, v0)[1] - c[1]) / e];
    const Jv = [(Q(u0, v0 + e)[0] - c[0]) / e, (Q(u0, v0 + e)[1] - c[1]) / e];
    const k = 1.0;
    g.add(K.arrow(P(u0, v0), P(u0 + k, v0), { w: 1.8 }));
    g.add(K.arrow(P(u0, v0), P(u0, v0 + k), { w: 1.8 }));
    g.add(K.arrow(c, [c[0] + Ju[0] * k, c[1] + Ju[1] * k, 0], { w: 1.8 }));
    g.add(K.arrow(c, [c[0] + Jv[0] * k, c[1] + Jv[1] * k, 0], { w: 1.8 }));
    // mapping arc
    g.add(K.arc([ox + 1.9, 1.9, 0], [oxB - 1.6, 2.1, 0], 0.9, { o: 0.5, w: 1.2 }));
    g.add(K.arrow([oxB - 1.75, 2.25, 0], [oxB - 1.55, 2.1, 0], { o: 0.5, w: 1.2, head: 0.2 }));
    L(g, 'f', [(ox + oxB) / 2, 3.25, 0], { size: 0.45 });
    L(g, 'J = ∂f/∂x', [(ox + oxB) / 2, -2.4, 0], { size: 0.38, c: 'acc' });
    L(g, 'x', [ox, -2.15, 0], { size: 0.38, o: 0.7 });
    L(g, 'f(x)', [oxB + 0.4, -2.15, 0], { size: 0.38, o: 0.7 });
    L(g, 'det J', [c[0] + 1.4, c[1] - 0.25, 0], { size: 0.3, c: 'acc' });
    g.rotation.y = YAW;
    return [{ c: 'acc', t: 'Local area change' }];
  };

  B.hessian = (g) => {
    // saddle: curvature + along one eigen-direction, − along the other
    const a = 0.22, b = 0.16;
    const f = (x, z) => a * x * x - b * z * z;
    g.add(K.surface(f, { xr: [-3.5, 3.5], zr: [-3.5, 3.5], n: 22, o: 0.22 }));
    const cx = []; for (let i = 0; i <= 60; i++) { const x = -3.5 + 7 * i / 60; cx.push([x, f(x, 0) + 0.02, 0]); }
    const cz = []; for (let i = 0; i <= 60; i++) { const z = -3.5 + 7 * i / 60; cz.push([0, f(0, z) + 0.02, z]); }
    g.add(K.line(cx, { c: 'acc', w: 2.8 }));
    g.add(K.line(cz, { c: 'b', w: 2.8 }));
    g.add(K.dots([[0, 0.02, 0]], { r: 0.12 }));
    // 2x2 Hessian tiles above
    const s = 0.62, hx = 3.6, hy = 3.4, hz = -2.6;
    const cells = [[0, 0, 'acc'], [0, 1, null], [1, 0, null], [1, 1, 'b']];
    cells.forEach(([i, j, c]) => g.add(K.rect(hx + j * s, hy - i * s, hz, s * 0.9, s * 0.9, 'xy', { fill: c ? 0.6 : 0.04, fc: c, c: c, o: c ? 1 : 0.5, w: 1 })));
    L(g, '0', [hx + s, hy, hz + 0.02], { size: 0.28, o: 0.6 });
    L(g, '0', [hx, hy - s, hz + 0.02], { size: 0.28, o: 0.6 });
    L(g, 'H', [hx - 0.75, hy - s / 2, hz], { size: 0.45 });
    L(g, '∂²f/∂x² > 0', [3.6, f(3.5, 0) + 0.45, 0.5], { size: 0.32, c: 'acc' });
    L(g, '∂²f/∂z² < 0', [0.4, f(0, 3.5) - 0.5, 3.9], { size: 0.32, c: 'b' });
    return [{ c: 'acc', t: 'Curves up' }, { c: 'b', t: 'Curves down' }];
  };

  B.logsumexp = (g) => {
    const x = [1000.5, 1002, 1001.2, 1003, 1002.4];
    const M = Math.max(...x), n = x.length, s = 0.62;
    const CEIL = 3.2, Hs = 2.4;
    // left: naive exp(x) — every value overflows the float range
    const lx = -2.6;
    g.add(K.line([[lx - 1.8, 0, 0], [lx + 1.8, 0, 0]], { o: 0.45, w: 1 }));
    g.add(K.line([[lx - 1.8, CEIL, 0], [lx + 1.8, CEIL, 0]], { o: 0.7, w: 1.4, dash: true }));
    x.forEach((v, i) => {
      const bx = lx + (i - (n - 1) / 2) * s;
      g.add(K.box(bx, CEIL / 2, 0, s * 0.6, CEIL, 0.3, { fill: 0.08, o: 0.45 }));
      g.add(K.line([[bx, CEIL, 0], [bx, CEIL + 0.7, 0]], { o: 0.35, w: 1, dash: true }));
    });
    L(g, 'inf', [lx + 2.3, CEIL, 0], { size: 0.36, mono: true, o: 0.8 });
    L(g, 'exp(x)', [lx, -0.5, 0], { size: 0.38, mono: true, o: 0.8 });
    L(g, 'x ≈ 1000', [lx, -1.15, 0], { size: 0.38, mono: true, o: 0.6 });
    // right: exp(x − max) — every value in (0, 1]
    const rx = 2.6;
    g.add(K.line([[rx - 1.8, 0, 0], [rx + 1.8, 0, 0]], { o: 0.45, w: 1 }));
    g.add(K.line([[rx - 1.8, Hs, 0], [rx + 1.8, Hs, 0]], { o: 0.3, w: 1, dash: true }));
    x.forEach((v, i) => {
      const bx = rx + (i - (n - 1) / 2) * s, e = Math.exp(v - M), h = e * Hs;
      g.add(K.box(bx, h / 2, 0, s * 0.6, h, 0.3, { fill: v === M ? 0.8 : 0.5, fc: 'acc', c: 'acc' }));
    });
    L(g, '1', [rx + 2.1, Hs, 0], { size: 0.34, o: 0.6 });
    L(g, 'exp(x − max)', [rx, -0.5, 0], { size: 0.38, mono: true, c: 'acc' });
    L(g, 'log Σ eˣ = max + log Σ eˣ⁻ᵐᵃˣ', [0, 4.4, 0], { size: 0.36, c: 'acc' });
    g.rotation.y = YAW;
    return [{ c: 'acc', t: 'Shifted by max' }];
  };

  B.nonlinearity = (g) => {
    const lin = (x, z) => 0.3 * x - 0.45 * z + 0.2;
    const non = (x, z) => 1.1 * Math.tanh(1.6 * x) + 0.25 * z * z - 0.6;
    const gL = new T.Group(), gR = new T.Group();
    gL.add(K.surface(lin, { xr: [-2, 2], zr: [-2, 2], n: 12, o: 0.5 }));
    gR.add(K.surface(non, { xr: [-2, 2], zr: [-2, 2], n: 22, c: 'acc', o: 0.6 }));
    gL.position.set(-2.6, 0, 0); gR.position.set(2.6, 0, 0);
    [gL, gR].forEach((gg) => { gg.add(K.rect(0, -1.9, 0, 4, 4, 'xz', { o: 0.25, w: 1 })); g.add(gg); });
    // front cross-sections: straight vs bent
    const cl = [], cn = [];
    for (let i = 0; i <= 50; i++) { const x = -2 + 4 * i / 50; cl.push([x, lin(x, 2) + 0.01, 2]); cn.push([x, non(x, 2) + 0.01, 2]); }
    gL.add(K.line(cl, { w: 2.6 }));
    gR.add(K.line(cn, { c: 'acc', w: 3 }));
    L(g, 'Wx + b', [-2.6, 2.1, -1.2], { size: 0.4 });
    L(g, 'σ(Wx + b)', [2.6, 2.1, -1.2], { size: 0.4, c: 'acc' });
    g.rotation.y = 0.3;
    return [{ c: 'acc', t: 'Nonlinear function' }];
  };

  B.highdim = (g) => {
    // pairwise distances between random points, divided by √d: they bunch up as d grows
    const dims = [2, 20, 500], rng = K.rng(11), N = 500, bins = 30, lo = 0, hi = 0.9;
    const W = 7.2, Hm = 2.2, dz = 2.2, dy = 0.9;
    dims.forEach((d, k) => {
      const hist = new Array(bins).fill(0);
      for (let t = 0; t < N; t++) {
        let s = 0; for (let i = 0; i < d; i++) { const u = rng() - rng(); s += u * u; }
        const b = Math.floor((Math.sqrt(s / d) - lo) / (hi - lo) * bins);
        if (b >= 0 && b < bins) hist[b]++;
      }
      const mx = Math.max(...hist), last = k === dims.length - 1;
      const z = (k - 1) * dz, y0 = (dims.length - 1 - k) * dy, bw = W / bins;
      hist.forEach((c, i) => {
        if (!c) return;
        const h = c / mx * Hm, x = -W / 2 + (i + 0.5) * bw;
        g.add(K.box(x, y0 + h / 2, z, bw * 0.78, h, 0.2, last ? { fill: 0.65, fc: 'acc', c: 'acc', o: 0.9 } : { fill: 0.1, o: 0.55 }));
      });
      g.add(K.line([[-W / 2, y0, z], [W / 2, y0, z]], { o: 0.45, w: 1 }));
      L(g, 'd = ' + d, [W / 2 + 1.0, y0 + 0.2, z], { size: 0.36, mono: true, c: last ? 'acc' : 'ink', o: last ? 1 : 0.75 });
    });
    L(g, '0', [-W / 2, -0.35, dz], { size: 0.28, o: 0.6 });
    L(g, '‖x − y‖ / √d', [0, -0.55, dz + 0.2], { size: 0.32, o: 0.7 });
    g.rotation.y = 0.35;
    return [{ c: 'acc', t: 'Distances concentrate' }];
  };

  VIZ.zmath = function (p, KK) {
    K = KK; T = K.THREE;
    const g = new T.Group();
    const fn = B[p.kind];
    const legend = fn ? fn(g, p) : (g.add(K.box(0, 0, 0, 3, 3, 3, { o: 0.3 })), []);
    return { g, legend };
  };
})();
