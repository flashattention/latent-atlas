# Latent Atlas

**Live site: https://latent-atlas-pied.vercel.app/**

![Latent Atlas home page](static/main-screenshot.png)

An illustrated atlas of machine learning: 294 concepts in 18 chapters, from linear regression to Mamba, each drawn as a rotatable 3D figure, with an explanation, typical use cases, an industry example and a Python code example. An appendix of 150 supporting terms in 7 chapters (statistics, data, linear algebra, training, network building blocks, language models and RL, production) uses the same page format.

Technical terms in the prose are links: hovering one highlights it, clicking it opens that concept or appendix page. An appendix page has a close button that returns to the page and scroll position the visit started from.

The interface and all text are available in 12 languages (ko, en, es, zh, ja, fr, de, pt, ru, ar, hi, it). The default language follows the browser; the flag in the top-right corner switches it. Light and dark themes follow the system setting, and the button in the top bar switches them.

## Run locally

The site is static. Serve the `dist/` folder with any static server:

```bash
cd dist
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `dist/index.html` directly from the file system also works in most browsers. three.js and the fonts load from public CDNs, so an internet connection is needed.

## Deploy

The site is hosted on Vercel at https://latent-atlas-pied.vercel.app/, connected to this repository. Every push to `main` redeploys it. `vercel.json` tells Vercel to serve `dist/` with no build command, so run `python3 build.py` and commit `dist/` before pushing.

Any other static host works the same way with `dist` as the publish directory.

## Project layout

```
index.html            page shell and styles
src/core.js           3D drawing kit (lines, dots, boxes, surfaces, labels)
src/stage.js          WebGL renderer, orbit controls, auto-framing
src/viz-a.js … viz-e.js   one builder per figure type
src/viz-z*.js         appendix figures, one builder per appendix chapter (branches on params.kind)
src/registry.js       chapters (appendix chapter ids start with 'z') and all pages: id, chapter, name, figure type, parameters
src/app.js            routing, language switching, search and autocomplete, concept pages
src/flags.js          flag icons and language list
content/en/part*.json English text, formulas and code
content/<lang>/       translations (items*.json) and interface strings (ui.json)
content/terms/<lang>.json   per language, the surface forms that link to each page
content/legend_*.json translated figure legends
docs/                 specs for figures, content, translation and the appendix / term links
test/                 figure harness and checks (see Testing)
static/               favicons (copied to the root of dist/) and the README screenshot
build.py              assembles dist/ from src/, content/ and static/
dist/                 the built site
```

## Rebuild after editing

```bash
python3 build.py
```

## Adding a concept or appendix term

1. Add a row to `src/registry.js`: `['id','chapter','English name','figureType',{params}]`. Use an appendix chapter id (`zstat`, `zdata`, …) for a supporting term.
2. Add its English entry to one of `content/en/part*.json` (`n`, `d`, `f`, `u`, `x`, `c`).
3. Add translations to `content/<lang>/items*.json`.
4. Add the forms that should link to it in each `content/terms/<lang>.json` (matching rules in `docs/APPENDIX_SPEC.md`, section 3).
5. Run `python3 build.py`.

Moving a page between the main chapters and the appendix only needs its chapter changed in `src/registry.js`.

## Testing

```bash
cd test
python3 -m venv .venv && .venv/bin/pip install playwright && .venv/bin/python -m playwright install chromium
npm install                              # three@0.128.0 for the harness
.venv/bin/python run.py zstat,bars --ctl # build every page of these figure types; screenshots in test/shots/
.venv/bin/python legend.py               # collect legend strings into content/legend_en.json
cd .. && python3 test/check_lang.py      # every translation covers its part and is in the right language
```
