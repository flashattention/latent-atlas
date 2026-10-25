# Latent Atlas — English content spec

Latent Atlas is a premium learning website covering ~286 ML, deep learning and LLM concepts. Each concept page shows a rotatable 3D figure, then the concept's name in very large type, then prose. Readers: ML engineers, students and job candidates preparing for interviews; they want precise, practical understanding. The English text is the source for translation into 11 languages, so write clear, plain, unambiguous English (no idioms, no puns, no culture-specific references).

## Output

Write one JSON file: `../content/en/part<N>.json`, an object keyed by concept id, containing EVERY id from your `ids<N>.json` list (same ids, no extras):

```json
{
  "rf": {
    "n": "Random Forest",
    "d": "...",
    "f": "ŷ = (1/B) Σ_b T_b(x)",
    "u": ["...", "...", "..."],
    "x": "...",
    "c": "from sklearn.ensemble import RandomForestClassifier\n..."
  }
}
```

Fields:

- `n` — display name in English. Usually the registry name; you may tidy it (keep the common acronym in parentheses when helpful).
- `d` — the explanation, **110–160 words**, flowing prose in 1–2 paragraphs (use `\n\n` between paragraphs). Open with one sentence stating the core idea plainly. Then how it works (the mechanism, with the key intuition), when to use it or what it is good for, and one important pitfall, limitation or common misconception. Be technically exact. No marketing tone, no filler ("In the world of...", "It is worth noting"), no rhetorical questions, no em-dash asides. Don't refer to "the figure".
- `f` — the single most useful formula or rule in plain Unicode math (e.g. `Gini = 1 − Σ pᵢ²`, `Attention(Q,K,V) = softmax(QKᵀ/√d_k)·V`, `θ ← θ − η∇L(θ)`). Use `""` if the concept truly has no formula.
- `u` — **3 typical use cases**, each a short phrase of 4–10 words (e.g. "Credit default scoring on tabular data").
- `x` — an **industry example**, 2–3 sentences: a concrete, realistic scenario of how a company or team uses it in production (domain, what is predicted or built, why this technique was chosen, a practical detail such as latency, scale, monitoring or a trade-off). Describe the scenario generically ("A ride-hailing company…", "An e-commerce search team…") unless the use is well known and public (e.g. "Google's BERT in Search", "Meta's Prophet library"). Never invent statistics, revenue numbers or quotes.
- `c` — a **Python code example**, 8–25 lines, realistic and correct for current mainstream libraries (scikit-learn, numpy, pandas, PyTorch, torch.nn.functional, Hugging Face transformers / peft / trl / datasets, lightgbm, xgboost, catboost, shap, statsmodels, prophet, umap-learn, sentence-transformers, faiss, vllm…). Prefer the canonical API call that a practitioner would actually write; when a concept is about a mechanism (attention, RoPE, top-p, KV cache, MoE router, Mamba scan…), write a small from-scratch implementation in numpy or PyTorch that shows the mechanism. Short English comments on the key lines. Assume the data variables (`X_train`, `y_train`, …) exist or create tiny toy data. No printing of large outputs, no notebooks magics. Valid JSON string (escape newlines as `\n`, quotes as `\"`).

## Quality bar

- Accuracy first. Nuances that matter, for example: Gini impurity is the probability that two random draws from the node have different labels; PR-AUC's random baseline equals the positive rate; random forest re-samples features at every split, not once per tree; L2 shrinks correlated weights toward equal values rather than to zero; boosting fits the residual / negative gradient of the whole ensemble so far; PCA's PC1 is not the regression line (it minimises orthogonal distance); RF picks the best split among the sampled features (only Extra Trees randomises thresholds); sklearn GradientBoosting and XGBoost default to using all rows (subsample = 1).
- Each entry stands alone; don't say "as mentioned above".
- Vary sentence openings across entries; avoid templated repetition.
- Use American English spelling.

When done, validate with `node -e "JSON.parse(require('fs').readFileSync('<your file>','utf8'))"` and check every id in your list is present. Reply only with "done" plus any concept you were unsure about.
