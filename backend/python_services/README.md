# DistilBERT emotion service — local inference + SHAP

Runs `distilbert-base-uncased-finetuned-sst-2-english` **on your own machine**
(`transformers` + `torch`). It does **not** call the Hugging Face Inference API, so
it needs **no API credits**. The only network use is the free, one-off download of
the ~270 MB model weights (cached in `~/.cache/huggingface`).

It also explains its predictions with **SHAP** (word-level attribution) — shown to
admins on the complaint page ("Emotion Model Explanation") via
`POST /api/emotion/explain`.

```
Node backend ──HTTP──▶  distilbert_emotion_service.py  (Flask, 127.0.0.1:5001)
 EmotionAnalysisService        └─ emotion_engine.py     (torch + transformers + shap)
```

## Quick start

From `backend/` (Windows, macOS, Linux — Python 3.10–3.12):

```bash
npm run setup:python    # once: creates python_services/venv and installs requirements.txt
npm run start:python    # starts the service on http://127.0.0.1:5001
```

Check it:

```bash
curl http://127.0.0.1:5001/health
curl -X POST http://127.0.0.1:5001/predict -H "Content-Type: application/json" \
     -d '{"text":"The road is dangerous and nobody is fixing it"}'
curl -X POST http://127.0.0.1:5001/explain -H "Content-Type: application/json" \
     -d '{"text":"The road is dangerous and nobody is fixing it","target":"NEGATIVE"}'
```

The Node backend finds the service at `DISTILBERT_SERVICE_URL` (default
`http://127.0.0.1:5001`) and falls back to keyword analysis whenever it is down.

## What to expect on a first run

| Step | Typical time |
|---|---|
| `npm run setup:python` (downloads PyTorch, SHAP, …) | a few minutes |
| First start: Python compiles the big libraries once, model download (~270 MB) | 2–5 min (Windows + antivirus can be slower) |
| Later starts: self-test child process + model load + SHAP warm-up in the background | ~30–60 s |
| `/predict` | ~10–50 ms on CPU |
| `/explain` (300 model calls) | ~1–3 s (cached for repeats) |

`import shap` alone pulls in scikit-learn, SciPy and pandas and can take about a
minute on a cold machine, so the service imports it in a background thread right
after start-up (`/health` shows `"shap_ready": true` when done).

## Crash isolation (why the service survives a broken PyTorch)

A native crash inside PyTorch (e.g. `SIGBUS` on Apple Silicon with a very new Python)
can't be caught by Python and would normally kill the service. So on start-up the
service first runs **one real forward pass in a child process** (`--selftest`). If that
child crashes or errors:

* the local backend is switched off and the reason is reported by `GET /health` and
  by the admin-only `GET /api/emotion/model-status` of the Node backend;
* the service **keeps running** — it uses the Hugging Face Inference API if a token is
  configured (`DISTILBERT_BACKEND=auto`), otherwise it answers `503` and the Node
  backend uses its keyword analysis.

If you see `local self-test failed: killed by signal SIGBUS` (or `native crash`):
create the venv with a python.org / conda **Python 3.11 or 3.12** instead of Homebrew's
3.13, delete `python_services/venv`, and run `npm run setup:python` again.

## Configuration

See `docs/ENVIRONMENT.md` ("Local DistilBERT + SHAP"). The important ones:
`DISTILBERT_BACKEND` (`auto` | `local` | `hf`), `DISTILBERT_DEVICE`, `DISTILBERT_PORT`,
`SHAP_MAX_EVALS`, `HF_HUB_OFFLINE`.

## Reading a SHAP result

`POST /explain` returns, for the label you ask about (default `NEGATIVE`):

```jsonc
{
  "label": "NEGATIVE", "score": 0.9991,        // what the model predicted
  "target": "NEGATIVE",
  "base_value": 0.42,                          // P(target) with every word masked
  "output_value": 0.9991,                      // P(target) for the real text
  "words": [ { "text": "dangerous", "start": 12, "end": 21, "shap": 0.18 }, ... ],
  "top_positive": [...], "top_negative": [...]
}
```

`base_value + Σ words.shap ≈ output_value` — each word's `shap` is how much it moved
the probability of `target` (positive = pushes towards it). Sub-word tokens
(`pot` + `##holes`) are merged back into whole words with exact character offsets in
the original text. The model is an **English** sentiment classifier, so explanations
are only meaningful for English text (the admin UI says so for Hindi/Tamil/… complaints).

## Tests

```bash
python -m pytest tests                       # fast, no model needed (fake engine)
RUN_MODEL_TESTS=1 python -m pytest tests     # also loads the real model and checks SHAP additivity
```
