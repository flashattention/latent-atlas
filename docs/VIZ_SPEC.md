# Latent Atlas — 3D visual builder spec

Latent Atlas is a learning website with ~286 ML / deep learning / LLM concepts. Every concept page shows ONE rotatable 3D figure (three.js r128) on a solid warm-ivory background (#EEECE6), plus prose. The user's priorities, in order:

1. **The figure must make the core idea of the concept obvious at a glance.**
2. It can be rotated in 3D with the mouse (handled by the stage; you only build the scene). Use depth meaningfully (layers, stacking, a third variable on an axis), so rotating reveals structure.
3. **Colour rule (strict, from the user): everything is black ink EXCEPT the part that explains the core idea.** That part is coloured with the accent `'acc'` (clay). A second colour (`'b'` blue, or `'g'` green / `'y'` gold) is allowed ONLY when the core idea is itself a contrast (two classes, before vs after, chosen vs rejected, kept vs dropped). Never more than 2 colours besides ink. De-emphasise with ink at low opacity (`o: 0.2–0.45`), never with extra colours. No rainbows, no gradients.
4. Clean and premium: thin precise lines, generous spacing, few labels, nothing cluttered. Think "museum diagram", not "dashboard".

## Files

- Kit: `../src/core.js` (read it — it is short). Exposes `window.ATLAS_K` (passed to you as `K`).
- Registry: `../src/registry.js` — every concept: `[id, category, English name, vizType, params]`.
- You write ONLY your own file `../src/viz-<letter>.js`, wrapped in an IIFE, registering builders on `window.VIZ`:
  ```js
  (function(){ const VIZ = window.VIZ;
    VIZ.surface = function (p, K) { const g = new K.THREE.Group(); ... return { g, legend:[...], tick, ctl }; };
  })();
  ```

## Builder contract

`VIZ[type](p, K)` → `{ g, legend, tick?, ctl? }`

- `p` = the registry params for the concept (e.g. `{kind:'roc', fill:true}`) merged with any control values. One builder serves all `kind`/`mode` variants of its type; branch on them. Every variant listed in the registry for your types MUST be implemented distinctly — e.g. `curves {kind:'roc'}` and `{kind:'pr'}` are different pictures. Variants that share a kind but differ in a flag (e.g. `fill:true`, `hl:'prec'`, `prune:true`, `leafwise:true`) must visibly reflect that flag, since they are different concept pages (ROC curve vs ROC-AUC: AUC fills the area under the curve in accent).
- `g` = THREE.Group with the scene. Fit roughly within 10 (x) × 6 (y) × 8 (z) world units, y up. The stage centres and frames it automatically; the default camera looks from direction (1, 0.62, 1.25) — make sure it reads well from there AND when orbited.
- `legend` = 1–3 entries `{c:'acc'|'b'|'g'|'y'|'ink', t:'Short English label'}` naming what the colour(s) mean. `t` ≤ 4 words, sentence case (e.g. `'Decision boundary'`, `'Support vectors'`, `'Gradient path'`). Always include an entry for every non-ink colour used. These strings get translated later, so reuse identical wording across your builders when the meaning is the same.
- `tick(t, dt)` optional. Only for motion that reveals the mechanism (a ball descending the path, tokens flowing through a router, noise turning into structure). Loop ≤ 6 s, subtle. **The figure must already be complete and readable at t = 0** (stills and thumbnails use that frame). Mutate existing objects (positions, opacity, `visible`, `scale`); never create geometry in tick.
- `ctl` optional and **secondary** — at most ONE control, and only when changing it directly demonstrates the key idea (e.g. `temperature` on the temperature page, `λ` on ridge, `k` on k-means). Format: `[{key:'temperature', label:'temperature', min:0.2, max:2, step:0.1, value:1}]` or a select `[{key:'opt', label:'optimizer', options:[{value:'sgd',label:'SGD'},...], value:'sgd'}]`. Labels must be code identifiers or math symbols (language-neutral). Read the current value from `p[key]` with a default. Rebuilding on change must be cheap (< 30 ms).

## Kit (K) quick reference — see core.js for details

- `K.rng(seed)` deterministic RNG: `r()`, `r.n()` normal, `r.range(a,b)`, `r.int(a,b)`, `r.pick(arr)`. Always use it (no Math.random) so figures are stable.
- `K.line(pts, {c, o, w, dash})` polyline; `w` = px width (default 1.6; ≤1 uses cheap 1px lines). `pts` = arrays `[x,y,z]` or Vector3.
- `K.segs(pairs, {c,o,w})` many segments in one draw call (use for grids/wireframes/edges).
- `K.dots(pts, {r, c, o, hollow, rs})` instanced spheres (r default 0.07). `hollow:true` = billboard rings (use for "the other class" when shape must differ from filled dots — always pair colour with a shape cue).
- `K.box(x,y,z,w,h,d,{fill, fc, c, o, edge})` edged box centred at x,y,z; `fill` = fill opacity.
- `K.rect(cx,cy,cz,w,h,axis('xz'|'xy'|'yz'),{fill,c,o,w})` flat rectangle.
- `K.surface(f(x,z)→y, {xr, zr, n, ys, c, o, fill, fc})` wireframe surface.
- `K.label(text, pos, {size, c, mono, weight, o})` text sprite. ONLY language-neutral text: math symbols (x₁, θ, λ, ∇L, Q, K, V), variable names, acronyms (LLM, RM, KV), example tokens ("the", "cat"), digits. ≤ 12 labels per figure, size 0.3–0.55. No English sentences or words that would need translation (except example tokens).
- `K.arrow(a, b, {c,o,w,head,dash})`, `K.curve(pts,{...})` Catmull-Rom, `K.arc(a,b,h,{...})` lifted arc, `K.frame({s, y, h, grid, axes, n})` faint floor grid + axes, `K.plot2d(ys, {w,h,z,lo,hi,y0,c,o,lw,dash})` a series drawn on the vertical plane at depth z.
- `K.PAL`, `K.colorOf`, `K.ease(t)`, `K.V(x,y,z)`, `K.THREE`.
- Colours: pass `c:'acc'` (clay — the key idea), `'b'`, `'g'`, `'y'` (second colour only for contrasts), default is ink. Ink at reduced `o` for context.

## Style guide

- Lines: primary strokes `w` 1.6–2.4, structural/context strokes `w:1` at `o` 0.25–0.5, grids `o` ≈ 0.08–0.12.
- Prefer a faint floor (`K.frame`) or axis lines to anchor 2D-ish data in 3D; lay several related 2D panels at different depths (z) so orbiting shows layers (e.g. a raw histogram behind its log-transformed version; ROC of several models stacked).
- Bars: thin edged boxes, light fill (`fill:0.06–0.15` ink) or accent fill (`fill:0.5–0.8`, `fc:'acc'`) for the highlighted ones.
- Networks: small dots for neurons, 1px edges at low opacity; highlight the flow that matters in accent.
- Boxes for modules (LLM, encoder, router): edged boxes with very faint fill; a few language-neutral labels (`LLM`, `RM`, `π`, `Q`, `K`, `V`, `+`, `×`, `σ`).
- Never put text over lines; keep labels in clear space.
- Performance: ≤ ~20k segments, ≤ ~3k dots, build < 50 ms.

## Testing (required)

```
cd ../test && python3 run.py <yourTypesCommaSeparated> --ctl
```
It loads every registry item of those types, builds it, exercises controls, prints `ok` or errors, and saves `shots/<id>.png` (900×600, default camera, t = 0). Look at the screenshots with the Read tool and iterate until every figure (a) has no errors, (b) is well framed, (c) shows the core idea clearly with colour only on the key part, (d) looks clean. Fix anything clipped, cluttered, empty, or ambiguous. The harness loads all five viz files; missing sibling files are fine.

When done, reply with: your types, a one-line note per type about what the figure shows, and any concept you think is weak.
