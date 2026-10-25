/* Latent Atlas — 3D core kit.
   Every visual builder receives (p, K) and returns { g: THREE.Group, tick?: (t, dt) => void }.
   World units: content should fit roughly inside a 10 x 7 x 10 box centred on the origin, y is up.
   The camera auto-frames the group's bounding box, so exact scale is not critical. */
(function () {
  const INK = 0x141413;      // all primary strokes and dots
  const ACC = 0xc96442;      // the single accent, used sparingly for "the thing to look at"
  const MUTE = 0x8a877d;     // secondary strokes

  let RES = new THREE.Vector2(1, 1); // fat-line material resolution, kept in sync by the stage
  const fatMats = new Set();

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    r.n = () => { let u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const toV = (p) => (p.isVector3 ? p : V(p[0], p[1], p[2] || 0));

  /* Semantic palette. Base structure is ink; colour only marks meaning.
     'acc' clay  = the key idea / focus / positive class / the path or element the eye should follow
     'b'   blue  = the contrasting group / negative class / second series / "before"
     'g'   green = result / chosen / correct / "after" / the good outcome
     'y'   gold  = secondary highlight / warning / threshold / boundary
     'mute' warm grey = context, faded, discarded */
  const PAL = { acc: ACC, a: ACC, b: 0x2e5e8c, g: 0x5e7d32, y: 0xb8892b, mute: MUTE, ink: INK };
  function colorOf(c) { return c == null ? INK : (typeof c === 'string' ? (PAL[c] != null ? PAL[c] : c) : c); }

  /* Thick polyline (screen-space width in px). opts: {c, o, w, dash} */
  function line(pts, o = {}) {
    const P = pts.map(toV);
    if (P.length < 2) return new THREE.Group();
    const w = o.w == null ? 1.6 : o.w;
    if (w <= 1.05 && !o.dash) {
      const geo = new THREE.BufferGeometry().setFromPoints(P);
      const m = new THREE.LineBasicMaterial({ color: colorOf(o.c), transparent: true, opacity: o.o == null ? 1 : o.o });
      return new THREE.Line(geo, m);
    }
    const geo = new THREE.LineGeometry();
    const arr = []; P.forEach((v) => arr.push(v.x, v.y, v.z));
    geo.setPositions(arr);
    const m = new THREE.LineMaterial({
      color: colorOf(o.c), linewidth: w, transparent: true, opacity: o.o == null ? 1 : o.o,
      dashed: !!o.dash, dashSize: 0.18, gapSize: 0.12,
    });
    m.resolution.copy(RES); fatMats.add(m);
    const l = new THREE.Line2(geo, m);
    if (o.dash) l.computeLineDistances();
    return l;
  }

  /* Many independent segments in one draw call. pairs: [[a,b],...] */
  function segs(pairs, o = {}) {
    const w = o.w == null ? 1 : o.w;
    if (w <= 1.05) {
      const pos = [];
      pairs.forEach(([a, b]) => { a = toV(a); b = toV(b); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.LineBasicMaterial({ color: colorOf(o.c), transparent: true, opacity: o.o == null ? 1 : o.o });
      return new THREE.LineSegments(geo, m);
    }
    const geo = new THREE.LineSegmentsGeometry();
    const pos = [];
    pairs.forEach(([a, b]) => { a = toV(a); b = toV(b); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); });
    geo.setPositions(pos);
    const m = new THREE.LineMaterial({ color: colorOf(o.c), linewidth: w, transparent: true, opacity: o.o == null ? 1 : o.o });
    m.resolution.copy(RES); fatMats.add(m);
    return new THREE.LineSegments2(geo, m);
  }

  /* Dots as instanced spheres. opts: {r, c, o, hollow} — hollow draws a ring sprite-like torus facing camera-agnostic */
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
  const ringGeo = new THREE.TorusGeometry(1, 0.18, 6, 20);
  function dots(pts, o = {}) {
    const P = pts.map(toV);
    const r = o.r == null ? 0.07 : o.r;
    const mat = new THREE.MeshBasicMaterial({ color: colorOf(o.c), transparent: o.o != null && o.o < 1, opacity: o.o == null ? 1 : o.o });
    if (o.hollow) {
      const g = new THREE.Group();
      P.forEach((v) => {
        const m = new THREE.Mesh(ringGeo, mat); m.position.copy(v); m.scale.setScalar(r);
        m.userData.billboard = true; g.add(m);
      });
      return g;
    }
    const mesh = new THREE.InstancedMesh(sphereGeo, mat, Math.max(1, P.length));
    const M = new THREE.Matrix4();
    const rs = o.rs; // optional per-dot radius array
    P.forEach((v, i) => { const s = rs ? rs[i] : r; M.makeScale(s, s, s); M.setPosition(v); mesh.setMatrixAt(i, M); });
    mesh.count = P.length;
    return mesh;
  }

  /* Box: edges always; optional faint fill. opts {fill (0..1 opacity), c, o, w} */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxEdges = new THREE.EdgesGeometry(boxGeo);
  function box(x, y, z, w, h, d, o = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.scale.set(Math.max(w, 1e-3), Math.max(h, 1e-3), Math.max(d, 1e-3));
    if (o.fill) {
      const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: colorOf(o.fc || o.c), transparent: true, opacity: o.fill, depthWrite: o.fill > 0.9 }));
      g.add(m);
    }
    if (o.edge !== false) {
      const e = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: colorOf(o.c), transparent: true, opacity: o.o == null ? 1 : o.o }));
      g.add(e);
    }
    return g;
  }

  /* Flat rectangle in a plane. axis: 'xy' | 'xz' | 'yz' */
  function rect(cx, cy, cz, w, h, axis = 'xz', o = {}) {
    const hw = w / 2, hh = h / 2;
    let c;
    if (axis === 'xz') c = [[-hw, 0, -hh], [hw, 0, -hh], [hw, 0, hh], [-hw, 0, hh], [-hw, 0, -hh]];
    else if (axis === 'xy') c = [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0], [-hw, -hh, 0]];
    else c = [[0, -hw, -hh], [0, hw, -hh], [0, hw, hh], [0, -hw, hh], [0, -hw, -hh]];
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    if (o.fill) {
      const geo = new THREE.PlaneGeometry(w, h);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorOf(o.fc || o.c), transparent: true, opacity: o.fill, side: THREE.DoubleSide, depthWrite: false }));
      if (axis === 'xz') m.rotation.x = -Math.PI / 2; else if (axis === 'yz') m.rotation.y = Math.PI / 2;
      g.add(m);
    }
    if (o.edge !== false) g.add(line(c, { c: o.c, o: o.o, w: o.w == null ? 1 : o.w }));
    return g;
  }

  /* Wireframe surface y = f(x, z). opts {xr:[a,b], zr:[a,b], n, ys (y scale), c, o, fill} */
  function surface(f, o = {}) {
    const [x0, x1] = o.xr || [-4, 4], [z0, z1] = o.zr || [-4, 4], n = o.n || 28, ys = o.ys == null ? 1 : o.ys;
    const pairs = [];
    const P = (i, j) => { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * j / n; return [x, f(x, z) * ys, z]; };
    for (let i = 0; i <= n; i++) for (let j = 0; j < n; j++) { pairs.push([P(i, j), P(i, j + 1)]); pairs.push([P(j, i), P(j + 1, i)]); }
    const g = new THREE.Group();
    g.add(segs(pairs, { c: o.c, o: o.o == null ? 0.55 : o.o }));
    if (o.fill) {
      const geo = new THREE.PlaneGeometry(1, 1, n, n);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const u = pos.getX(k) + 0.5, v = pos.getY(k) + 0.5;
        const x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * v;
        pos.setXYZ(k, x, f(x, z) * ys, z);
      }
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorOf(o.fc), transparent: true, opacity: o.fill, side: THREE.DoubleSide, depthWrite: false })));
    }
    return g;
  }

  /* Text sprite (keep text short and language-neutral: symbols, tokens, acronyms). opts {size, c, weight, mono} */
  function label(text, pos, o = {}) {
    const size = o.size || 0.42;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const px = 96;
    const font = `${o.weight || 500} ${px}px ${o.mono ? '"JetBrains Mono", ui-monospace, monospace' : '"Hanken Grotesk", system-ui, sans-serif'}`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(String(text)).width) + 24;
    cv.width = w; cv.height = px + 32;
    ctx.font = font; ctx.fillStyle = '#' + new THREE.Color(colorOf(o.c)).getHexString();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(String(text), w / 2, cv.height / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4; tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: o.o == null ? 1 : o.o }));
    sp.scale.set(size * cv.width / cv.height, size, 1);
    sp.position.copy(toV(pos));
    sp.renderOrder = 10;
    return sp;
  }

  function arrow(a, b, o = {}) {
    a = toV(a); b = toV(b);
    const g = new THREE.Group();
    const dir = b.clone().sub(a); const len = dir.length(); if (len < 1e-6) return g;
    dir.normalize();
    const hl = o.head || Math.min(0.28, len * 0.3);
    const tip = b.clone();
    const base = b.clone().sub(dir.clone().multiplyScalar(hl));
    g.add(line([a, base], { c: o.c, o: o.o, w: o.w == null ? 1.6 : o.w, dash: o.dash }));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(hl * 0.38, hl, 12), new THREE.MeshBasicMaterial({ color: colorOf(o.c), transparent: true, opacity: o.o == null ? 1 : o.o }));
    cone.position.copy(base.clone().add(tip).multiplyScalar(0.5));
    cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    g.add(cone);
    return g;
  }

  /* Smooth curve through control points (Catmull-Rom). */
  function curve(pts, o = {}) {
    const c = new THREE.CatmullRomCurve3(pts.map(toV));
    return line(c.getPoints(o.n || 80), o);
  }

  /* Arc between two points that lifts by h (for attention links etc.) */
  function arc(a, b, h, o = {}) {
    a = toV(a); b = toV(b);
    const m = a.clone().add(b).multiplyScalar(0.5); m.y += h;
    const c = new THREE.QuadraticBezierCurve3(a, m, b);
    return line(c.getPoints(o.n || 32), o);
  }

  /* Faint reference frame: floor grid + 3 axes. opts {s (half size), y (floor y), grid (bool)} */
  function frame(o = {}) {
    const s = o.s || 4, y = o.y == null ? -0.001 : o.y;
    const g = new THREE.Group();
    if (o.grid !== false) {
      const pairs = []; const n = o.n || 8;
      for (let i = 0; i <= n; i++) { const t = -s + 2 * s * i / n; pairs.push([[t, y, -s], [t, y, s]]); pairs.push([[-s, y, t], [s, y, t]]); }
      g.add(segs(pairs, { o: 0.09 }));
    }
    if (o.axes !== false) {
      g.add(line([[-s, y, -s], [s, y, -s]], { o: 0.5, w: 1 }));
      g.add(line([[-s, y, -s], [-s, y + (o.h || s * 0.9), -s]], { o: 0.5, w: 1 }));
      g.add(line([[-s, y, -s], [-s, y, s]], { o: 0.5, w: 1 }));
    }
    return g;
  }

  /* Plot a 2D function or series on a vertical plane at depth z. xs in [x0,x1] mapped to world [-w/2,w/2]. */
  function plot2d(ys, o = {}) {
    const w = o.w || 8, h = o.h || 4, z = o.z || 0, n = ys.length;
    const lo = o.lo == null ? Math.min(...ys) : o.lo, hi = o.hi == null ? Math.max(...ys) : o.hi;
    const pts = ys.map((v, i) => [-w / 2 + w * i / (n - 1), (o.y0 || 0) + h * (v - lo) / ((hi - lo) || 1), z]);
    return line(pts, { c: o.c, o: o.o, w: o.lw == null ? 2 : o.lw, dash: o.dash });
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  window.ATLAS_K = { THREE, INK, ACC, MUTE, PAL, colorOf, rng, V, line, segs, dots, box, rect, surface, label, arrow, curve, arc, frame, plot2d, ease,
    setRes(w, h) { RES.set(w, h); fatMats.forEach((m) => m.resolution.set(w, h)); },
    forget() { fatMats.clear(); } };
  window.VIZ = window.VIZ || {};
})();
