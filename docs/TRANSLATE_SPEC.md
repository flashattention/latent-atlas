# Latent Atlas — translation spec

Latent Atlas is a premium learning website about ML, deep learning and LLMs. You translate English source content into ONE target language for one chunk of concepts.

## Source
- English content: `../content/en/part1.json` … `part6.json`, each an object keyed by concept id with fields `n` (name), `d` (explanation, paragraphs separated by `\n\n`), `f` (formula — do NOT translate, ignore), `u` (array of 3 use-case phrases), `x` (industry example), `c` (code — do NOT translate, ignore).
- Your chunk is given as a list of part files in your task.

## Output
Write `../content/<lang>/items<k>.json` (k given in your task): an object keyed by the same ids, each with exactly `n`, `d`, `u`, `x` translated. Every id from your source parts must be present. Keep `u` the same length. Keep the `\n\n` paragraph breaks.

If your task says you also own the UI, translate `../content/en/ui.json` and the 18 category names below into `../content/<lang>/ui.json` with the shape `{"ui": {...same keys...}, "cats": {"found": "...", ...}}`. Keep placeholders like `{n}`, `{i}`, `{q}` exactly. Keep the brand name "Latent Atlas" untranslated. Keep `←` and `→` in "keys".

Category ids and English names: found Foundations; prep Preprocessing & Features; reg Regularization; lin Linear & Classic Models; tree Trees & Ensembles; eval Evaluation & Metrics; xai Interpretability; unsup Unsupervised Learning; ts Time Series; opt Optimization; nn Neural Network Basics; arch Deep Architectures; gen Generative Models; tf Transformers; llm LLM Training & Alignment; inf Inference & Efficiency; app LLM Systems & Reasoning; front Frontier Trends.

## How to translate
- Write as a skilled technical writer native in the target language would, for engineers and students. Fluent, natural, precise; not word-for-word.
- Terminology: use the terms practitioners in that language actually use. Where the community normally keeps the English term or acronym (e.g. "LoRA", "KV cache", "RAG", "SHAP", "PCA", "Transformer" in many languages), keep it, optionally with the native term. Names of concepts (`n`) should be what a practitioner would call it (Korean: 랜덤 포레스트, 과적합, 경사 하강법; Japanese: ランダムフォレスト, 過学習, 勾配降下法; Chinese: 随机森林, 过拟合, 梯度下降; etc.). Keep acronyms in parentheses where the English name had them.
- Never translate code identifiers, function/parameter names (`max_depth`, `subsample`), library or product names (scikit-learn, PyTorch, LightGBM, Prophet, BERT, GPT), math symbols or formulas.
- Keep technical meaning exact; do not add or drop facts.
- Arabic: Modern Standard Arabic. Hindi: Devanagari, with common English technical terms kept in Latin script where Hindi-speaking engineers normally do. Chinese: Simplified. Portuguese: Brazilian. Spanish: neutral international.
- Korean: use 합니다/입니다 체 consistently, natural spacing.
- Japanese: です・ます調.

## Process
Translate in batches and write the output incrementally with a small Python script (load existing JSON, add entries, save) so nothing is truncated. At the end validate: JSON parses, all ids present, every `u` has the same length as the source, no empty strings. Reply only "done" plus anything you were unsure about.

## IMPORTANT: private working folder
Many translators run at the same time. Never use the shared scratchpad or generic file names. Keep all intermediate files only in `/home/claude/work/<lang>-part<k>/` (create it). Before finishing, re-open your output file and confirm the text is in YOUR target language.
