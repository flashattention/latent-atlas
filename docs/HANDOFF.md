# Handoff notes for continuing work

Read README.md first, then this file.

## Specs used to build the site
- docs/VIZ_SPEC.md: how 3D figure builders work (contract, colour rule: everything ink except the core idea in accent clay, kit reference, style).
- docs/CONTENT_SPEC.md: format and quality bar for the English text (n, d, f, u, x, c).
- docs/TRANSLATE_SPEC.md: translation rules for the 11 other languages.
- docs/APPENDIX_SPEC.md: the appendix chapters and the term links in the prose (content/terms/<lang>.json matching rules).

## Testing figures
```bash
cd test
npm install            # installs three@0.128.0 used by the harness
python3 run.py all     # or: python3 run.py moe,attn --ctl
```
Requires Python Playwright (`pip install playwright && playwright install chromium`).
Screenshots go to test/shots/<id>.png. Every line should print `ok`.
`python3 legend.py` collects all legend strings into content/legend_en.json (re-run after changing figures, then translate new strings into content/legend_<lang>.json).
`python3 test/check_lang.py` (run from the repo root) checks that every translation file covers every id and is in the right language.

## Known weak spots
- Figures that render small or dense: rope, neuron, elasticnet, qkv, mha, em.
- The moe figure can overlap at the front from the default camera.
- Some code examples depend on fast-moving library APIs (pytorch_forecasting, TRL, dice_ml, neuralforecast); they were syntax-checked, not executed.
- core.js `K.rect(..., 'yz', {fill})` draws the fill with width and height swapped.
