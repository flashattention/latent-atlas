# Latent Atlas — appendix spec

The site's prose (`d`, `u`, `x` of every page) links technical terms: hovering a term highlights it, clicking opens its page. Terms that are already one of the 286 concepts link to that concept. Supporting terms that are not concepts (histogram, correlation matrix, variance, token, latency…) get their own pages in seven appendix chapters at the end of the table of contents. Appendix pages have the same parts as concept pages: a 3D figure, `n`, `d`, `f`, `u`, `x`, `c`.

- The 159 appendix terms, their ids, English names and chapters: `docs/appendix_terms.json`. They are also rows in `src/registry.js` (category and figure type are the chapter id, params are `{kind:'<id>'}`).
- Existing concepts: the other rows of `src/registry.js`; their English text is in `content/en/part1.json` … `part6.json`, translations in `content/<lang>/items1.json` … `items6.json`.

Only write the files your task names. Never edit `src/app.js`, `index.html`, `build.py`, `src/registry.js` or another task's files, and never run git. Keep intermediate files in a private folder under `/private/tmp/claude-501/-Users-louisjeon-dev-latent-atlas/b7d781a2-7cf3-4b57-89c1-e7dc58cc464c/scratchpad/work/<your task name>/`.

## Parts

| part | chapters | file (English) | file (translation) |
|---|---|---|---|
| 7 | zstat | `content/en/part7.json` | `content/<lang>/items7.json` |
| 8 | zdata, zmath | `content/en/part8.json` | `content/<lang>/items8.json` |
| 9 | ztrain, znn | `content/en/part9.json` | `content/<lang>/items9.json` |
| 10 | zlang, zprod | `content/en/part10.json` | `content/<lang>/items10.json` |

## 1. English content

Follow `docs/CONTENT_SPEC.md` (fields, tone, quality bar), with these differences for appendix terms:

- `d`: 100–150 words. Open with a plain one-sentence definition. Then the intuition or mechanism, then where the term shows up in machine-learning work (which methods, metrics or steps rely on it; mention the related concept by its usual name, e.g. "logistic regression", "PCA", "gradient descent", so it becomes a link), then one common pitfall or misconception. Readers meet this page by clicking the term inside another page, so it must stand alone and be exact.
- `f`: the defining formula when there is one (`σ² = (1/n) Σ (xᵢ − μ)²`, `P(A|B) = P(B|A)·P(A) / P(B)`), else `""`.
- `u`: 3 phrases, 4–10 words each, naming where practitioners use it.
- `x`: 2–3 sentences, a realistic production scenario (no invented statistics).
- `c`: 6–20 lines of correct Python (numpy, pandas, scipy, scikit-learn, PyTorch, transformers…) that computes or shows the term. Short comments.
- Use the English name from `docs/appendix_terms.json` as `n` (you may tidy it).

Validate the JSON and that every id of your part is present, no extras.

## 2. Translation

Follow `docs/TRANSLATE_SPEC.md` (except its private-folder path: use the folder above). Translate `n`, `d`, `u`, `x` of one English part into one language and write `content/<lang>/items<part>.json`.

Terminology must match the existing translations of that language: before naming a term, grep `content/<lang>/items1.json` … `items6.json` for how the existing pages already say it (for example how Korean pages say "correlation matrix", "variance", "token") and use exactly that wording in `n` and `d`, so the term links in the prose match the page names. If the existing pages use two spellings, pick the more frequent one for `n` and mention nothing about it.

Validate: JSON parses, all ids present, `u` lengths match, text is in the target language.

## 3. Term forms (link matching)

One file per language: `content/terms/<lang>.json` (`en` included), an object keyed by EVERY id in `src/registry.js` (all 445: concepts and appendix terms) mapping to a list of surface forms that should become a link to that page when they appear in that language's prose:

```json
{ "pca": ["PCA", "principal component analysis"], "corrmatrix": ["correlation matrix", "correlation matrices"], "mean": ["mean", "means of"] }
```

How the site matches (in `d`, `u`, `x` of every page of that language):

- Longest form first; matches never overlap; every occurrence is linked, except links to the page being viewed.
- Case: a form that contains an uppercase letter after its first character, or is all caps (`PCA`, `ReLU`, `KL`, `GPT`), matches case-sensitively. All other forms match case-insensitively.
- Latin, Cyrillic, Greek, Devanagari and Arabic script: a form matches only as whole words (not inside a longer word). So list every inflected or plural form that occurs (en `histogram`, `histograms`; de `Histogramm`, `Histogramme`, `Histogramms`; ru `гистограмма`, `гистограммы`, `гистограмму`, `гистограммой`; fr `matrice de corrélation`, `matrices de corrélation`).
- Arabic: one leading clitic (و ف ب ل ك) before a form is allowed automatically; list forms with and without ال when both occur.
- Korean: a form must start at a word start (not right after another Hangul syllable) and may be followed by anything (particles such as 을, 의, 에서). List spaced and unspaced spellings that occur (`상관 행렬`, `상관행렬`).
- Japanese and Chinese: forms match anywhere. Avoid forms that are part of unrelated common words.

What to include for each id:

1. The page name `n` in that language, the name without its parenthetical part, and the acronym when it is used in prose (acronyms such as `PCA`, `SHAP`, `RAG` usually also appear inside non-English prose; include them for that language too).
2. Synonyms and inflected forms that actually occur in that language's prose. Search the text (`d`, `u`, `x` of `content/<lang>/items*.json`, or `content/en/part*.json` for English) to see how each term is written; prefer forms that really occur over invented ones.
3. Leave out forms that are ordinary words whose meaning in most occurrences is not the term (English `mean` as a verb is rare, so `mean` is fine; `state` or `policy` in a business sense, `label` as a verb, `feature` meaning "functionality" — judge from the actual sentences). Leave out forms shorter than 2 characters. An id may have an empty list.
4. A form belongs to one id only. When two ids could claim it, give it to the more specific page.

Generic but genuine terms (feature, token, gradient, layer, matrix) should be included: the reader asked for every occurrence of important terms to be linked.

Validate: JSON parses, all 445 ids present, no form listed under two ids. Then run a quick count of how many matches your forms produce in your language's prose and spot-check 20 random matches for false positives.

## 4. Figures

Follow `docs/VIZ_SPEC.md` (contract, colour rule, kit, style). Each appendix chapter has one builder, `VIZ.<chapter>` in `src/viz-<chapter>.js` (a stub exists; replace it), branching on `p.kind`, which is the term id. Implement every term of your chapter as a distinct figure that makes the term obvious at a glance (a histogram page shows a histogram with the key idea in accent; a covariance matrix page a matrix of cells; latency vs throughput a pipeline over time…).

Test with the project venv:

```
cd test && .venv/bin/python run.py <chapter>
```

Screenshots go to `test/shots/<id>.png`; look at them with the Read tool and iterate until each figure is error-free, well framed, clean and clear. Do not edit `test/run.py`, `test/harness.html` or other `viz-*.js` files.

## 5. Legends

After all figures exist: `cd test && .venv/bin/python legend.py` rewrites `content/legend_en.json` with every legend string. For each language, add translations for strings that are missing from `content/legend_<lang>.json` (an object `{english: translated}`), keeping existing entries and matching the existing terminology.
