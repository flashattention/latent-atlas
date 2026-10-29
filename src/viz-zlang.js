/* Latent Atlas — appendix figures for the 'zlang' chapter (language models & RL). One builder, branching on p.kind (the term id). */
(function () {
  const VIZ = window.VIZ;
  let K;

  /* ---------- helpers ---------- */
  const lab = (g, t, pos, o) => g.add(K.label(t, pos, Object.assign({ size: 0.36 }, o || {})));
  /* token box: edged box with optional fill and a label just in front of it */
  function tok(g, x, y, z, w, t, o = {}) {
    const h = o.h || 0.62, d = o.d || 0.3;
    g.add(K.box(x, y, z, w, h, d, { fill: o.fill == null ? 0.06 : o.fill, fc: o.fc || o.c, c: o.c, o: o.o == null ? 0.85 : o.o }));
    if (t != null) lab(g, t, [x, y, z + d / 2 + 0.02], { size: o.size || 0.32, mono: o.mono, c: o.lc, o: o.lo == null ? 1 : o.lo });
  }
  function bar(g, x, z, w, d, h, o = {}) {
    if (Math.abs(h) < 1e-3) { g.add(K.rect(x, 0, z, w, d, 'xz', { o: o.o == null ? 0.35 : o.o, c: o.c })); return; }
    g.add(K.box(x, h / 2, z, w, Math.abs(h), d, { fill: o.fill == null ? 0.1 : o.fill, fc: o.fc || o.c, c: o.c, o: o.o == null ? 0.8 : o.o }));
  }
  function ring(c, r, n = 48) {
    const P = [];
    for (let i = 0; i <= n; i++) { const a = 2 * Math.PI * i / n; P.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]); }
    return P;
  }
  function floorGrid(g, x0, x1, z0, z1, n, y = 0, o = 0.09) {
    const P = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      P.push([[x, y, z0], [x, y, z1]]); P.push([[x0, y, z], [x1, y, z]]);
    }
    g.add(K.segs(P, { o }));
  }

  const B = {};

  /* Token: text is cut into sub-word pieces, each mapped to an integer id */
  B.token = (g) => {
    const toks = ['The', ' cat', ' un', 'believ', 'able', '!'];
    const ids = [464, 3797, 555, 6667, 540, 0];
    const ws = [1.1, 1.15, 0.95, 1.35, 1.1, 0.7];
    const gap = 0.4, tot = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
    let x = -tot / 2;
    const raw = [], cuts = [];
    toks.forEach((t, i) => {
      const cx = x + ws[i] / 2, sub = i >= 2 && i <= 4;
      tok(g, cx, 1.4, 0, ws[i], t.trim(), { c: sub ? 'acc' : null, fill: sub ? 0.18 : 0.05, size: 0.34 });
      g.add(K.line([[cx, 1.08, 0], [cx, 0.32, 0]], { o: 0.35, w: 1 }));
      lab(g, String(ids[i]), [cx, 0.05, 0], { size: 0.3, mono: true, c: sub ? 'acc' : null });
      raw.push(x, x + ws[i]); cuts.push(x + ws[i] + gap / 2);
      x += ws[i] + gap;
    });
    // the raw character stream behind, with the cut points marked
    const zb = -1.4;
    g.add(K.line([[-tot / 2, 2.6, zb], [tot / 2, 2.6, zb]], { o: 0.4, w: 1 }));
    cuts.slice(0, -1).forEach((c, i) => {
      g.add(K.line([[c, 2.45, zb], [c, 2.75, zb]], { c: i >= 1 && i <= 3 ? 'acc' : null, o: i >= 1 && i <= 3 ? 1 : 0.5, w: 1.6 }));
    });
    toks.forEach((t, i) => {
      const cx = raw[2 * i] / 2 + raw[2 * i + 1] / 2;
      g.add(K.line([[cx, 2.6, zb], [cx, 1.72, 0]], { o: 0.15, w: 1 }));
    });
    return [{ c: 'acc', t: 'Sub-word tokens' }, { c: 'ink', t: 'Token ids' }];
  };

  /* Vocabulary: a fixed, finite table of entries; a token is looked up as one row */
  B.vocab = (g) => {
    const n = 11, hRow = 0.5, w = 2.6, top = (n - 1) * hRow;
    const hit = 6;
    const named = { 0: '<eos>', 2: 'the', 4: 'ing', [hit]: 'cat', 10: 'zebra' };
    const idOf = { 0: 0, 2: 262, 4: 278, [hit]: 3797, 10: 50256 };
    for (let i = 0; i < n; i++) {
      const y = top - i * hRow, on = i === hit;
      g.add(K.box(0, y, 0, w, 0.38, 0.3, { fill: on ? 0.5 : 0.04, fc: on ? 'acc' : null, c: on ? 'acc' : null, o: on ? 1 : 0.35 }));
      if (named[i] != null) {
        lab(g, named[i], [0, y, 0.17], { size: 0.28, mono: true, o: on ? 1 : 0.8 });
        lab(g, String(idOf[i]), [w / 2 + 0.55, y, 0], { size: 0.24, mono: true, c: on ? 'acc' : null, o: on ? 1 : 0.55 });
      }
    }
    lab(g, '⋮', [0, top - 8 * hRow, 0.17], { size: 0.3, o: 0.6 });
    // size bracket
    const xb = w / 2 + 1.3;
    g.add(K.line([[xb - 0.15, top + 0.1, 0], [xb, top + 0.1, 0], [xb, -0.1, 0], [xb - 0.15, -0.1, 0]], { o: 0.6, w: 1 }));
    lab(g, '|V|', [xb + 0.55, top / 2, 0], { size: 0.4 });
    // incoming token
    const y = top - hit * hRow;
    tok(g, -3.4, y, 0, 1.1, 'cat', { c: 'acc', fill: 0.15, size: 0.32 });
    g.add(K.arrow([-2.75, y, 0], [-w / 2 - 0.1, y, 0], { c: 'acc', w: 1.8 }));
    return [{ c: 'acc', t: 'Looked-up entry' }, { c: 'ink', t: 'Vocabulary entries' }];
  };

  /* Context window: the model sees only the last n tokens */
  B.contextwin = (g) => {
    const N = 15, W = 8, s = 0.66, x0 = -(N - 1) * s / 2;
    const xs = Array.from({ length: N }, (_, i) => x0 + i * s);
    for (let i = 0; i < N; i++) {
      const inW = i >= N - W;
      g.add(K.box(xs[i], 0, 0, 0.46, 0.46, 0.46, { fill: inW ? 0.1 : 0.03, o: inW ? 0.85 : 0.22 }));
    }
    // next-token slot
    const xn = x0 + N * s;
    g.add(K.box(xn, 0, 0, 0.46, 0.46, 0.46, { o: 0.5 }));
    lab(g, '?', [xn, 0, 0.25], { size: 0.34, o: 0.7 });
    // window frame
    const a = xs[N - W] - 0.34, b = xs[N - 1] + 0.34;
    g.add(K.box((a + b) / 2, 0, 0, b - a, 0.85, 0.85, { c: 'acc', o: 1, fill: 0.05, fc: 'acc' }));
    g.add(K.line([[a, -0.62, 0.42], [a, -0.75, 0.42], [b, -0.75, 0.42], [b, -0.62, 0.42]], { c: 'acc', w: 1.6 }));
    lab(g, 'n_ctx', [(a + b) / 2, -1.12, 0.42], { size: 0.36, mono: true, c: 'acc' });
    // attention arcs from the newest token to every token inside the window
    const last = xs[N - 1];
    for (let i = N - W; i < N - 1; i++) g.add(K.arc([last, 0.25, 0], [xs[i], 0.25, 0], 0.5 + 0.22 * (N - 1 - i), { c: 'acc', o: 0.55, w: 1.2 }));
    // tokens that fell out: a broken arc
    g.add(K.arc([last, 0.25, 0], [xs[3], 0.25, 0], 3.0, { o: 0.2, w: 1, dash: true }));
    return [{ c: 'acc', t: 'Visible context' }, { c: 'ink', t: 'Out of window' }];
  };

  /* Prompt: the input tokens that condition the model's continuation */
  B.prompt = (g) => {
    const P = ['Q:', 'capital', 'of', 'France', '?'], ws = [0.7, 1.35, 0.7, 1.25, 0.55];
    let x = -5.2;
    const cs = [];
    P.forEach((t, i) => { const cx = x + ws[i] / 2; tok(g, cx, 0, 0, ws[i], t, { c: 'acc', fill: 0.18, size: 0.3 }); cs.push(cx); x += ws[i] + 0.3; });
    g.add(K.line([[-5.2, -0.5, 0.3], [-5.2, -0.6, 0.3], [x - 0.3, -0.6, 0.3], [x - 0.3, -0.5, 0.3]], { c: 'acc', w: 1.4 }));
    const mx = x + 1.6;
    g.add(K.arrow([x, 0, 0], [mx - 1.0, 0, 0], { c: 'acc', w: 1.8 }));
    g.add(K.box(mx, 0, 0, 1.8, 1.5, 1.0, { fill: 0.05, o: 0.9 }));
    lab(g, 'LLM', [mx, 0, 0.52], { size: 0.42, weight: 600 });
    const ox = mx + 2.15;
    g.add(K.arrow([mx + 0.95, 0, 0], [ox - 0.6, 0, 0], { w: 1.6 }));
    tok(g, ox, 0, 0, 1.0, 'Paris', { size: 0.3 });
    // the prompt stays as the context the output is read against: faint stack of earlier prompts behind
    return [{ c: 'acc', t: 'Prompt tokens' }, { c: 'ink', t: 'Generated output' }];
  };

  /* Fine-tuning: start from pretrained weights θ₀ and nudge them with a small task dataset */
  B.finetuning = (g, r) => {
    const n = 5, s = 0.9, off = -(n - 1) * s / 2;
    const base = (i, j) => 0.8 + 0.6 * Math.sin(i * 0.9 + 0.4) * Math.cos(j * 0.7);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = off + i * s, z = off + j * s, h = Math.max(0.15, base(i, j) + 0.6);
      g.add(K.box(x, h / 2, z, 0.46, h, 0.46, { fill: 0.05, o: 0.35 }));
      const d = 0.08 + 0.16 * Math.abs(r.n());
      g.add(K.box(x, h + d / 2, z, 0.46, d, 0.46, { fill: 0.75, fc: 'acc', c: 'acc', o: 0.9 }));
    }
    lab(g, 'θ₀', [off - 0.9, 0.9, off + (n - 1) * s], { size: 0.42 });
    lab(g, 'Δθ', [off + (n - 1) * s + 0.75, 2.2, off + (n - 1) * s], { size: 0.42, c: 'acc' });
    // small task dataset feeding the update
    const dx = off - 3.0, pts = [];
    for (let k = 0; k < 9; k++) pts.push([dx + 0.35 * r.n(), 3.0 + 0.3 * r.n(), 0.35 * r.n()]);
    g.add(K.dots(pts, { r: 0.09, c: 'acc' }));
    g.add(K.arrow([dx + 0.8, 3.0, 0], [off - 0.3, 2.5, 0], { c: 'acc', w: 1.6 }));
    return [{ c: 'acc', t: 'Weight update' }, { c: 'ink', t: 'Pretrained weights' }];
  };

  /* Foundation model: one large pretrained model under many downstream tasks */
  B.foundation = (g, r) => {
    // broad pretraining data
    const pts = [];
    for (let k = 0; k < 260; k++) pts.push([r.range(-4.6, 4.6), -1.6 + 0.12 * r.n(), r.range(-1.6, 1.6)]);
    g.add(K.dots(pts, { r: 0.045, o: 0.35 }));
    g.add(K.arrow([0, -1.25, 0], [0, -0.55, 0], { o: 0.5, w: 1.2 }));
    // the foundation slab
    g.add(K.box(0, 0, 0, 8.2, 0.9, 3.0, { fill: 0.22, fc: 'acc', c: 'acc' }));
    lab(g, 'FM', [-3.4, 0, 1.55], { size: 0.42, c: 'acc', weight: 600 });
    // downstream tasks on top
    const T = [[-3, -0.7], [-1, 0.7], [1, -0.7], [3, 0.7]];
    T.forEach(([x, z]) => {
      g.add(K.box(x, 1.75, z, 1.1, 0.8, 0.8, { fill: 0.05, o: 0.85 }));
      g.add(K.line([[x, 0.47, z], [x, 1.33, z]], { c: 'acc', w: 1.6 }));
    });
    return [{ c: 'acc', t: 'Shared base model' }, { c: 'ink', t: 'Downstream tasks' }];
  };

  /* Perplexity: confident model (peaked next-token distributions) vs uncertain model (flat) */
  B.perplexity = (g, r) => {
    const V = 8, P = 5, s = 0.34, zs = 0.62, H = 3.2;
    const panel = (cx, sharp, seed) => {
      const rr = K.rng(seed);
      let nll = 0;
      const xo = cx - (V - 1) * s / 2, zo = -(P - 1) * zs / 2;
      for (let p = 0; p < P; p++) {
        const tr = rr.int(0, V - 1);
        const lg = Array.from({ length: V }, (_, v) => (v === tr ? sharp : 0) + 0.6 * rr.n());
        const m = Math.max(...lg), e = lg.map((l) => Math.exp(l - m)), S = e.reduce((a, b) => a + b, 0);
        const pr = e.map((x) => x / S);
        nll -= Math.log(pr[tr]);
        pr.forEach((q, v) => {
          const on = v === tr;
          bar(g, xo + v * s, zo + p * zs, 0.24, 0.24, q * H, { fill: on ? 0.75 : 0.06, fc: on ? 'acc' : null, c: on ? 'acc' : null, o: on ? 1 : 0.45 });
        });
      }
      g.add(K.rect(cx, 0, 0, V * s + 0.3, P * zs + 0.2, 'xz', { o: 0.25 }));
      lab(g, 'PPL ' + Math.exp(nll / P).toFixed(1), [cx, -0.55, (P - 1) * zs / 2 + 0.6], { size: 0.4, mono: true });
    };
    panel(-2.3, 3.4, 11);
    panel(2.3, 0.6, 29);
    return [{ c: 'acc', t: 'p(true next token)' }, { c: 'ink', t: 'Other tokens' }];
  };

  /* Log-probability: log p is ≤ 0, and per-token log-probs add up to the sequence log-prob */
  B.logprob = (g) => {
    const X = (p) => -4.5 + 5 * p; // p in [0,1] -> x
    const pts = [];
    for (let i = 0; i <= 80; i++) { const p = 0.025 + (1 - 0.025) * i / 80; pts.push([X(p), Math.log(p), 0]); }
    g.add(K.line([[X(0), 0, 0], [X(1) + 0.4, 0, 0]], { o: 0.5, w: 1 }));
    g.add(K.line([[X(0), 0.4, 0], [X(0), -3.9, 0]], { o: 0.5, w: 1 }));
    g.add(K.line(pts, { w: 2 }));
    lab(g, 'p', [X(1) + 0.75, 0, 0], { size: 0.4 });
    lab(g, '1', [X(1), 0.32, 0], { size: 0.3, mono: true, o: 0.7 });
    lab(g, '0', [X(0) - 0.3, 0, 0], { size: 0.3, mono: true, o: 0.7 });
    lab(g, 'log p', [X(0) + 0.75, -3.75, 0], { size: 0.36 });
    const ps = [0.9, 0.6, 0.3, 0.1];
    let acc = 0;
    const xs = 2.6, zs = 1.2;
    ps.forEach((p, k) => {
      const y = Math.log(p);
      g.add(K.line([[X(p), 0, 0], [X(p), y, 0]], { c: 'acc', w: 2.2 }));
      g.add(K.dots([[X(p), y, 0]], { r: 0.09, c: 'acc' }));
      // stacked total, offset in depth
      g.add(K.line([[xs, acc, zs], [xs, acc + y, zs]], { c: 'acc', w: 3 }));
      g.add(K.line([[xs - 0.14, acc + y, zs], [xs + 0.14, acc + y, zs]], { o: 0.7, w: 1 }));
      g.add(K.line([[X(p), y, 0], [xs, acc + y, zs]], { o: 0.12, w: 1 }));
      acc += y;
    });
    g.add(K.line([[xs - 0.14, 0, zs], [xs + 0.14, 0, zs]], { o: 0.7, w: 1 }));
    lab(g, 'Σ log p', [xs + 1.0, acc / 2, zs], { size: 0.38, c: 'acc' });
    lab(g, acc.toFixed(2), [xs + 0.75, acc, zs], { size: 0.3, mono: true, o: 0.75 });
    return [{ c: 'acc', t: 'Log-probability' }];
  };

  /* N-gram: every run of n consecutive tokens */
  B.ngram = (g, r, p) => {
    const n = Math.round(p.n == null ? 3 : p.n);
    const W = ['the', 'cat', 'sat', 'on', 'the', 'mat'], s = 1.5, x0 = -(W.length - 1) * s / 2;
    W.forEach((w, i) => tok(g, x0 + i * s, 0, 0, 1.15, w, { size: 0.32 }));
    const m = W.length - n + 1, hl = Math.min(1, m - 1);
    for (let i = 0; i < m; i++) {
      const on = i === hl, z = 0, y = -0.6 - 0.32 * i;
      const a = x0 + i * s - 0.65, b = x0 + (i + n - 1) * s + 0.65;
      g.add(K.line([[a, y + 0.14, z], [a, y, z], [b, y, z], [b, y + 0.14, z]], { c: on ? 'acc' : null, o: on ? 1 : 0.4, w: on ? 2 : 1 }));
      if (on) g.add(K.box((a + b) / 2, 0, 0, b - a, 0.85, 0.55, { c: 'acc', fill: 0.07, fc: 'acc' }));
    }
    lab(g, 'n = ' + n, [x0 + (W.length - 1) * s + 1.5, 0, 0], { size: 0.38, mono: true, c: 'acc' });
    return [{ c: 'acc', t: 'One n-gram' }, { c: 'ink', t: 'All windows' }];
  };

  /* TF-IDF: raw counts (ghost) vs counts reweighted by rarity (filled) */
  B.tfidf = (g) => {
    const terms = ['the', 'model', 'loss', 'GPU', 'cat'];
    const tf = [[5, 2, 1, 0, 0], [6, 1, 0, 3, 0], [4, 2, 2, 0, 0], [5, 0, 0, 0, 3]];
    const N = tf.length, df = terms.map((_, j) => tf.filter((d) => d[j] > 0).length);
    const idf = df.map((d) => Math.log(N / d));
    const s = 1.3, zs = 1.05, x0 = -(terms.length - 1) * s / 2, z0 = -(N - 1) * zs / 2, ht = 0.42;
    tf.forEach((d, i) => d.forEach((c, j) => {
      const x = x0 + j * s, z = z0 + i * zs;
      const h = c * ht, w = c * idf[j] * ht * 1.2;
      if (c > 0) g.add(K.box(x, h / 2, z, 0.6, h, 0.5, { o: 0.28 }));
      if (w > 1e-3) g.add(K.box(x, w / 2, z, 0.6, w, 0.5, { fill: 0.65, fc: 'acc', c: 'acc' }));
      else g.add(K.rect(x, 0, z, 0.6, 0.5, 'xz', { o: c > 0 ? 0.5 : 0.18 }));
    }));
    terms.forEach((t, j) => lab(g, t, [x0 + j * s, -0.35, z0 + (N - 1) * zs + 0.75], { size: 0.32, mono: true }));
    tf.forEach((_, i) => lab(g, 'd' + '₁₂₃₄'[i], [x0 - 1.0, 0, z0 + i * zs], { size: 0.32, o: 0.7 }));
    floorGrid(g, x0 - 0.65, x0 + (terms.length - 1) * s + 0.65, z0 - 0.5, z0 + (N - 1) * zs + 0.5, 1);
    return [{ c: 'acc', t: 'TF-IDF weight' }, { c: 'ink', t: 'Raw term count' }];
  };

  /* Bag of words: word order is thrown away, only counts remain */
  B.bagofwords = (g) => {
    const vocab = ['cat', 'dog', 'bites', 'man', 'sat', 'mat'], vs = 1.05, vx0 = -(vocab.length - 1) * vs / 2;
    const S = [['dog', 'bites', 'man'], ['man', 'bites', 'dog']];
    const zf = 1.6;
    S.forEach((sent, k) => {
      const z = -2.2, y = 3.6 - 1.0 * k, s = 1.5;
      sent.forEach((w, i) => {
        const x = -s + i * s;
        tok(g, x, y, z, 1.15, w, { size: 0.3 });
        const j = vocab.indexOf(w);
        g.add(K.line([[x, y - 0.32, z], [vx0 + j * vs, 1.05, zf]], { o: 0.14, w: 1 }));
      });
    });
    vocab.forEach((w, j) => {
      const x = vx0 + j * vs, c = S[0].includes(w) ? 1 : 0;
      bar(g, x, zf, 0.55, 0.55, c, { fill: 0.7, fc: 'acc', c: 'acc', o: c ? 1 : 0.35 });
      lab(g, String(c), [x, -0.35, zf + 0.35], { size: 0.3, mono: true, c: c ? 'acc' : null, o: c ? 1 : 0.5 });
    });
    floorGrid(g, vx0 - 0.5, vx0 + (vocab.length - 1) * vs + 0.5, zf - 0.4, zf + 0.4, 1);
    return [{ c: 'acc', t: 'Word counts' }, { c: 'ink', t: 'Word order (lost)' }];
  };

  /* Hallucination: a fluent token with no support in the source */
  B.hallucination = (g) => {
    const T = ['Paris', 'capital', 'France', 'pop.', '90M'], ws = [1.15, 1.35, 1.25, 0.9, 1.0];
    const y = 2.4, z = 0.6, zf = -1.4, cx = [];
    let x = -3.6;
    T.forEach((t, i) => { cx.push(x + ws[i] / 2); x += ws[i] + 0.3; });
    // source document on the floor: evidence under the first three tokens only
    g.add(K.rect((cx[0] + cx[4]) / 2, 0, zf, cx[4] - cx[0] + 1.8, 1.4, 'xz', { o: 0.35, fill: 0.03 }));
    T.forEach((t, i) => {
      const hl = i === 4;
      tok(g, cx[i], y, z, ws[i], t, { c: hl ? 'acc' : null, fill: hl ? 0.25 : 0.05, size: 0.3 });
      if (i < 3) {
        g.add(K.box(cx[i], 0.15, zf, ws[i] * 0.9, 0.3, 0.6, { fill: 0.12, o: 0.7 }));
        g.add(K.line([[cx[i], y - 0.32, z], [cx[i], 0.3, zf]], { o: 0.45, w: 1.2 }));
      }
      if (hl) {
        g.add(K.line([[cx[i], y - 0.32, z], [cx[i], 0.45, zf]], { c: 'acc', w: 1.6, dash: true }));
        lab(g, '?', [cx[i], 0.2, zf], { size: 0.5, c: 'acc', weight: 600 });
      }
    });
    return [{ c: 'acc', t: 'Unsupported claim' }, { c: 'ink', t: 'Grounded in source' }];
  };

  /* Alignment: shifting a model's outputs into the region people intend */
  B.alignment = (g, r) => {
    const tc = [2.0, 0, 0.3], R = 1.25, bc = [-1.8, 0, -0.2];
    floorGrid(g, -4.8, 4.2, -2.8, 2.8, 8, 0, 0.07);
    g.add(K.line(ring(tc, R), { w: 1.4, dash: true, o: 0.8 }));
    const base = [], al = [];
    for (let k = 0; k < 80; k++) base.push([bc[0] + 1.15 * r.n(), 0.07, bc[2] + 0.9 * r.n()]);
    for (let k = 0; k < 40; k++) { const a = r() * 2 * Math.PI, d = Math.sqrt(r()) * R * 0.8; al.push([tc[0] + d * Math.cos(a), 0.08, tc[2] + d * Math.sin(a)]); }
    g.add(K.dots(base, { r: 0.065, o: 0.35 }));
    g.add(K.dots(al, { r: 0.08, c: 'acc' }));
    g.add(K.arc([bc[0] + 0.4, 0.1, bc[2]], [tc[0] - R - 0.15, 0.1, tc[2]], 1.4, { c: 'acc', w: 2 }));
    g.add(K.arrow([tc[0] - R - 0.55, 0.32, tc[2] - 0.02], [tc[0] - R - 0.12, 0.1, tc[2]], { c: 'acc', w: 2, head: 0.26 }));
    return [{ c: 'acc', t: 'Aligned outputs' }, { c: 'ink', t: 'Base model outputs' }];
  };

  /* MDP: states, actions, stochastic transitions with probabilities and rewards */
  B.mdp = (g) => {
    const S = { s0: [-4.4, 0, 0.4], s1: [1.0, 0, -1.8], s2: [0.4, 0, 2.6], s3: [4.0, 0, 0.6] };
    const name = { s0: 's₀', s1: 's₁', s2: 's₂', s3: 's₃' };
    Object.keys(S).forEach((k) => {
      g.add(K.line(ring(S[k], 0.45), { w: 1.6 }));
      lab(g, name[k], [S[k][0], 0.05, S[k][2]], { size: 0.36 });
    });
    const A = [-2.0, 0, 0.4];
    g.add(K.arrow([-3.9, 0, 0.4], [-2.2, 0, 0.4], { c: 'acc', w: 2 }));
    g.add(K.dots([A], { r: 0.16, c: 'acc' }));
    lab(g, 'a', [A[0] - 0.2, 0.45, A[2] - 0.45], { size: 0.38, c: 'acc' });
    const tr = (to, h, pr, rw, lo) => {
      const b = S[to], d = [b[0] - A[0], b[2] - A[2]], L = Math.hypot(...d), e = [b[0] - 0.5 * d[0] / L, 0, b[2] - 0.5 * d[1] / L];
      g.add(K.arc(A, e, h, { c: 'acc', w: 1.8 }));
      g.add(K.arrow([e[0] - 0.25 * d[0] / L, 0.08, e[2] - 0.25 * d[1] / L], e, { c: 'acc', w: 1.8, head: 0.22 }));
      const m = [(A[0] + e[0]) / 2 + lo[0], h * 0.5 + lo[1], (A[2] + e[2]) / 2 + lo[2]];
      lab(g, pr, m, { size: 0.3, mono: true, c: 'acc' });
      if (rw) lab(g, rw, [b[0] + 1.25, 0.1, b[2]], { size: 0.32, mono: true });
    };
    tr('s1', 1.3, '0.8', 'r=+1', [0.3, 0.45, 0]);
    tr('s2', 1.0, '0.2', 'r=0', [-0.7, 0.1, 0.2]);
    // other transitions faint
    g.add(K.arc([1.4, 0, -1.6], [3.6, 0, 0.35], 0.7, { o: 0.3, w: 1 }));
    g.add(K.arc([0.85, 0, 2.4], [3.6, 0, 0.85], 0.7, { o: 0.3, w: 1 }));
    g.add(K.arc([0.5, 0, 2.15], [0.95, 0, -1.35], 0.9, { o: 0.3, w: 1 }));
    floorGrid(g, -5.2, 5.2, -2.6, 3.4, 1, -0.01, 0.12);
    return [{ c: 'acc', t: 'Action and transitions' }, { c: 'ink', t: 'States' }];
  };

  /* shared grid world: 6x6 with a goal and two walls */
  const GW = { n: 6, s: 1.0, goal: [5, 0], walls: [[2, 1], [2, 2], [3, 4]] };
  function gwDist() {
    const { n, goal, walls } = GW, D = Array.from({ length: n }, () => Array(n).fill(Infinity));
    const isW = (i, j) => walls.some((w) => w[0] === i && w[1] === j);
    D[goal[0]][goal[1]] = 0;
    const q = [goal];
    while (q.length) {
      const [i, j] = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => {
        const u = i + a, v = j + b;
        if (u < 0 || v < 0 || u >= n || v >= n || isW(u, v) || D[u][v] <= D[i][j] + 1) return;
        D[u][v] = D[i][j] + 1; q.push([u, v]);
      });
    }
    return { D, isW };
  }
  const gwX = (i) => (i - (GW.n - 1) / 2) * GW.s;

  /* Policy: a rule mapping every state to an action (arrows in each cell) */
  B.policy = (g) => {
    const { n, s, goal } = GW, { D, isW } = gwDist(), h = n * s / 2;
    floorGrid(g, -h, h, -h, h, n, 0, 0.25);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = gwX(i), z = gwX(j);
      if (isW(i, j)) { g.add(K.box(x, 0.3, z, s * 0.9, 0.6, s * 0.9, { fill: 0.35, o: 0.8 })); continue; }
      if (i === goal[0] && j === goal[1]) { g.add(K.rect(x, 0.01, z, s * 0.8, s * 0.8, 'xz', { w: 2, fill: 0.1 })); lab(g, '+1', [x, 0.35, z], { size: 0.38, mono: true }); continue; }
      let best = null;
      [[1, 0], [0, -1], [-1, 0], [0, 1]].forEach(([a, b]) => {
        const u = i + a, v = j + b;
        if (u < 0 || v < 0 || u >= n || v >= n || isW(u, v)) return;
        if (D[u][v] < D[i][j] && !best) best = [a, b];
      });
      if (best) g.add(K.arrow([x - best[0] * 0.3, 0.05, z - best[1] * 0.3], [x + best[0] * 0.32, 0.05, z + best[1] * 0.32], { c: 'acc', w: 2, head: 0.24 }));
    }
    lab(g, 'π(s)', [-h - 0.8, 0.4, -h], { size: 0.42, c: 'acc' });
    return [{ c: 'acc', t: 'Chosen action' }, { c: 'ink', t: 'Goal and walls' }];
  };

  /* Reward: a scalar signal per time step; the agent maximises the sum */
  B.reward = (g) => {
    const R = [0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0, 0, 2];
    const n = R.length, s = 0.6, x0 = -(n - 1) * s / 2, H = 1.5;
    g.add(K.line([[x0 - 0.4, 0, 0], [x0 + (n - 1) * s + 0.5, 0, 0]], { o: 0.5, w: 1 }));
    lab(g, 't', [x0 + (n - 1) * s + 0.85, 0, 0], { size: 0.36 });
    lab(g, 'r', [x0 + 3 * s, H + 0.45, 0], { size: 0.45, c: 'acc' });
    R.forEach((v, i) => {
      const x = x0 + i * s;
      if (v === 0) g.add(K.dots([[x, 0, 0]], { r: 0.06, o: 0.5 }));
      else g.add(K.box(x, v * H / 2, 0, 0.36, Math.abs(v) * H, 0.36, v > 0 ? { fill: 0.75, fc: 'acc', c: 'acc' } : { fill: 0.25, o: 0.8 }));
    });
    // cumulative return, behind
    const zb = -1.6, pts = [];
    let c = 0;
    R.forEach((v, i) => { c += v; pts.push([x0 + i * s, c * 0.7, zb]); });
    g.add(K.line([[x0 - 0.4, 0, zb], [x0 + (n - 1) * s + 0.5, 0, zb]], { o: 0.3, w: 1 }));
    g.add(K.line(pts.flatMap((p, i) => (i ? [[p[0], pts[i - 1][1], zb], p] : [p])), { w: 1.6, o: 0.75 }));
    lab(g, 'Σr', [x0 + (n - 1) * s + 0.75, c * 0.7, zb], { size: 0.36, o: 0.8 });
    return [{ c: 'acc', t: 'Positive reward' }, { c: 'ink', t: 'Penalty and total' }];
  };

  /* State & action: the trajectory s₀ a₀ s₁ a₁ … with untaken actions faded */
  B.stateaction = (g) => {
    const n = 4, s = 3.0, x0 = -(n - 1) * s / 2;
    const sub = '₀₁₂₃';
    for (let k = 0; k < n; k++) {
      const x = x0 + k * s;
      g.add(K.dots([[x, 0, 0]], { r: 0.3, hollow: true }));
      g.add(K.dots([[x, 0, 0]], { r: 0.07 }));
      lab(g, 's' + sub[k], [x, 0.72, 0], { size: 0.38 });
      if (k === n - 1) break;
      const ax = x + s / 2;
      g.add(K.arrow([x + 0.36, 0, 0], [ax - 0.24, 0, 0], { c: 'acc', w: 2, head: 0.2 }));
      g.add(K.box(ax, 0, 0, 0.36, 0.36, 0.36, { fill: 0.75, fc: 'acc', c: 'acc' }));
      lab(g, 'a' + sub[k], [ax, -0.55, 0.1], { size: 0.36, c: 'acc' });
      g.add(K.arrow([ax + 0.22, 0, 0], [x + s - 0.38, 0, 0], { w: 1.4, head: 0.2 }));
      // alternatives not taken
      [-1.3, 1.3].forEach((dz) => {
        g.add(K.line([[x + 0.3, 0, dz * 0.2], [ax - 0.1, 0, dz]], { o: 0.25, w: 1 }));
        g.add(K.box(ax, 0, dz, 0.3, 0.3, 0.3, { o: 0.3, fill: 0.04 }));
      });
    }
    floorGrid(g, x0 - 0.8, x0 + (n - 1) * s + 0.8, -1.8, 1.8, 1, -0.5, 0.12);
    return [{ c: 'acc', t: 'Action taken' }, { c: 'ink', t: 'States' }];
  };

  /* Value function: V(s) as height over the grid world, highest near the goal */
  B.valuefn = (g) => {
    const { n, s, goal } = GW, { D, isW } = gwDist(), h = n * s / 2, gam = 0.8, H = 3.2;
    floorGrid(g, -h, h, -h, h, n, 0, 0.18);
    const top = [];
    for (let i = 0; i < n; i++) {
      top.push([]);
      for (let j = 0; j < n; j++) {
        const x = gwX(i), z = gwX(j);
        if (isW(i, j)) { g.add(K.rect(x, 0.005, z, s * 0.8, s * 0.8, 'xz', { fill: 0.22, o: 0.5 })); top[i].push(null); continue; }
        const v = H * Math.pow(gam, D[i][j]), gl = i === goal[0] && j === goal[1];
        g.add(K.box(x, v / 2, z, s * 0.5, v, s * 0.5, { fill: gl ? 0.2 : 0.05, o: gl ? 0.9 : 0.3 }));
        top[i].push([x, v, z]);
      }
    }
    const pr = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (!top[i][j]) continue;
      if (i + 1 < n && top[i + 1][j]) pr.push([top[i][j], top[i + 1][j]]);
      if (j + 1 < n && top[i][j + 1]) pr.push([top[i][j], top[i][j + 1]]);
    }
    g.add(K.segs(pr, { c: 'acc', w: 2, o: 1 }));
    g.add(K.dots(top.flat().filter(Boolean), { r: 0.07, c: 'acc' }));
    lab(g, 'V(s)', [-h - 0.6, 1.6, -h], { size: 0.42, c: 'acc' });
    lab(g, '+1', [gwX(goal[0]) + 0.7, H + 0.35, gwX(goal[1])], { size: 0.34, mono: true });
    return [{ c: 'acc', t: 'State value' }, { c: 'ink', t: 'Goal and walls' }];
  };

  /* Exploration vs exploitation: best-known arm vs uncertain arm with a higher upper bound */
  B.explore = (g, r) => {
    const arms = [ // mean estimate, half-width of uncertainty, pulls
      [1.2, 0.35, 9], [2.3, 0.25, 16], [0.9, 0.4, 7], [1.6, 1.3, 2], [0.7, 0.5, 5]];
    const s = 1.6, x0 = -(arms.length - 1) * s / 2, EXP = 1, EXR = 3;
    arms.forEach(([m, u, k], i) => {
      const x = x0 + i * s, c = i === EXP ? 'acc' : i === EXR ? 'b' : null, hl = c != null;
      g.add(K.box(x, m / 2, 0, 0.7, m, 0.5, { fill: hl ? 0.6 : 0.08, fc: c, c, o: hl ? 1 : 0.5 }));
      g.add(K.line([[x, m - u, 0.35], [x, m + u, 0.35]], { c, o: hl ? 1 : 0.5, w: hl ? 2 : 1.2 }));
      [m - u, m + u].forEach((y) => g.add(K.line([[x - 0.18, y, 0.35], [x + 0.18, y, 0.35]], { c, o: hl ? 1 : 0.5, w: hl ? 2 : 1.2 })));
      // pull count: dots in a row toward the viewer
      const pts = [];
      for (let q = 0; q < k; q++) pts.push([x + ((q % 4) - 1.5) * 0.17, 0.06, 0.8 + Math.floor(q / 4) * 0.17]);
      g.add(K.dots(pts, { r: 0.06, c, o: hl ? 1 : 0.5 }));
      lab(g, 'a' + '₁₂₃₄₅'[i], [x, -0.4, -0.1], { size: 0.32, o: 0.75 });
    });
    lab(g, 'Q(a)', [x0 - 1.2, 1.6, 0], { size: 0.42 });
    floorGrid(g, x0 - 0.7, x0 + (arms.length - 1) * s + 0.7, -0.5, 1.7, 1);
    return [{ c: 'acc', t: 'Exploit best estimate' }, { c: 'b', t: 'Explore uncertain arm' }];
  };

  const FACE = ['token', 'contextwin', 'prompt', 'logprob', 'ngram', 'bagofwords', 'hallucination', 'reward', 'stateaction', 'vocab'];
  VIZ.zlang = function (p, k) {
    K = k;
    const g = new K.THREE.Group();
    const f = B[p.kind];
    if (!f) { g.add(K.box(0, 0, 0, 3, 3, 3, { o: 0.3 })); return { g, legend: [] }; }
    const legend = f(g, K.rng(7 + p.kind.length * 13), p);
    if (FACE.includes(p.kind)) g.rotation.y = 0.42;
    const out = { g, legend };
    if (p.kind === 'ngram') out.ctl = [{ key: 'n', label: 'n', min: 1, max: 4, step: 1, value: p.n == null ? 3 : p.n }];
    return out;
  };
})();
