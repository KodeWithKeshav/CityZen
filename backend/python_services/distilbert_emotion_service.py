"""
DistilBERT Emotion / Sentiment Analysis Service (HF Inference API)
===================================================================
Uses huggingface_hub InferenceClient to call the hosted
distilbert-base-uncased-finetuned-sst-2-english model.

NOTE: a local-inference version of this service (loading the model
in-process via `transformers`, no HF API call) was tried and reverted --
on this machine, every real forward pass through the model crashed with
a native SIGBUS, reproduced identically across multiple torch versions
(2.6.0, 2.15.0), with single-threaded execution, with numpy pinned to the
1.x line, and with optimized ARM CPU kernels disabled
(ATEN_CPU_CAPABILITY=default). Tokenizing and loading the model both
work fine; only the actual matrix-multiply forward pass crashes. That
points to a deep incompatibility between this Python 3.13 (Homebrew)
build, Apple Silicon, and PyTorch's CPU backend here, not something a
dependency-version change fixes from inside this file. If revisited, try
a non-Homebrew Python (python.org installer or a conda env), since that's
the next real lever to pull.

This HF Inference API approach still works correctly via
services/EmotionAnalysisService.js's existing fallback chain even when
the HF API itself is unavailable (e.g. no token, or the account's
Inference Providers credits are exhausted) -- see that file's
analyzeWithAI() -> analyzeWithEnhancedKeywords() fallback, which degrades
gracefully to rule-based multilingual keyword scoring instead of crashing.

Endpoint:
  POST /predict   { "text": "..." }  →  [[{ "label": "NEGATIVE", "score": 0.98 }, ...]]
  GET  /health                        →  { "status": "ok", "model": "..." }
"""

import os
import sys

# Load environment variables from ../.env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, val = line.split('=', 1)
            key = key.strip()
            if key.startswith('export '):
                key = key[7:].strip()
            val = val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
                val = val[1:-1]
            if key and key not in os.environ:
                os.environ[key] = val

from flask import Flask, request, jsonify
from flask_cors import CORS
from huggingface_hub import InferenceClient

app = Flask(__name__)
cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001",
    ).split(",")
    if origin.strip()
]
CORS(app, origins=cors_origins)

# ---------------------------------------------------------------------------
# HF Inference Client setup
# ---------------------------------------------------------------------------
MODEL_NAME = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"
MAX_TEXT_LENGTH = 5000
HF_TOKEN = (
    os.environ.get("HF_TOKEN")
    or os.environ.get("HUGGING_FACE_API_KEY")
    or os.environ.get("HUGGINGFACE_API_TOKEN")
    or ""
).strip()

client = None
if HF_TOKEN:
    print(f"[INIT] Initializing InferenceClient for: {MODEL_NAME}")
    client = InferenceClient(provider="auto", api_key=HF_TOKEN)
    print("[OK] InferenceClient ready!")
else:
    print("[WARN] No HF token found. Set HF_TOKEN, HUGGING_FACE_API_KEY, or HUGGINGFACE_API_TOKEN.")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    if client is None:
        return jsonify({
            "status": "unconfigured",
            "model": MODEL_NAME,
            "error": "Hugging Face token is not configured",
        }), 503
    return jsonify({
        "status": "ok",
        "model": MODEL_NAME,
        "method": "huggingface_hub.InferenceClient",
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts: { "text": "some complaint text" }
    Returns: [[ { "label": "NEGATIVE", "score": 0.987 }, { "label": "POSITIVE", "score": 0.013 } ]]
    """
    if client is None:
        return jsonify({"error": "Service is not configured"}), 503

    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON payload; expected an object"}), 400

    raw_text = data.get("text")
    if raw_text is None:
        raw_text = data.get("inputs", "")

    if not isinstance(raw_text, str) or not raw_text.strip():
        return jsonify({"error": "text must be a non-empty string"}), 400

    text = raw_text.strip()[:MAX_TEXT_LENGTH]

    try:
        result = client.text_classification(
            text,
            model=MODEL_NAME,
        )

        # result is a list of ClassificationOutput objects (or dicts)
        # Convert to the nested-array format the Node.js code expects
        results = []
        for item in result or []:
            label = item.get("label") if isinstance(item, dict) else getattr(item, "label", None)
            score = item.get("score") if isinstance(item, dict) else getattr(item, "score", None)
            if label is None or score is None:
                continue
            results.append({
                "label": str(label),
                "score": round(float(score), 6),
            })

        if not results:
            print("[ERROR] Empty classification response from InferenceClient")
            return jsonify({"error": "Upstream model returned no predictions"}), 502

        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)

        print(f"[PREDICT] Prediction for {len(text)}-char input: {results[0]['label']} ({results[0]['score']:.4f})")

        # Return in nested array format to match HF Inference API
        return jsonify([results])

    except Exception as e:
        print(f"[ERROR] Prediction error: {type(e).__name__}: {e}")
        return jsonify({"error": "Emotion prediction failed"}), 500


def _parse_port(raw_port, default=5001):
    try:
        port = int(raw_port)
        if 1 <= port <= 65535:
            return port
    except (TypeError, ValueError):
        pass
    print(f"[WARN] Invalid DISTILBERT_PORT '{raw_port}', falling back to {default}")
    return default


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if client is None:
        print("[ERROR] Cannot start service without HF_TOKEN, HUGGING_FACE_API_KEY, or HUGGINGFACE_API_TOKEN.")
        sys.exit(1)
    host = os.environ.get("DISTILBERT_HOST", "127.0.0.1")
    port = _parse_port(os.environ.get("DISTILBERT_PORT", 5001))
    print(f"DistilBERT service starting on {host}:{port}")
    app.run(host=host, port=port, debug=False)
