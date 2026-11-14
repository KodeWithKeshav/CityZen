"""
DistilBERT Emotion / Sentiment Service  (LOCAL inference  +  SHAP explanations)
================================================================================
Runs distilbert-base-uncased-finetuned-sst-2-english on this machine with
``transformers`` + ``torch``.  No Hugging Face Inference API call and therefore
**no API credits** are needed; the free, one-off download of the model weights
is the only network use (see emotion_engine.py).

Backend selection (env ``DISTILBERT_BACKEND``)
  auto   (default)  local model first; if it cannot run, fall back to the HF
                    Inference API when an HF token is configured.
  local             local model only.
  hf                HF Inference API only (the previous behaviour; needs credits).

Crash isolation
  Native crashes (SIGBUS / SIGSEGV / illegal instruction inside PyTorch's CPU
  kernels) cannot be caught from Python and would kill the whole service.  So
  before loading the model in-process we run ONE real forward pass in a CHILD
  process (``--selftest``).  If the child dies or errors, the local backend is
  switched off, the reason is reported by ``/health``, and the service keeps
  running (HF fallback, or 503 so the Node backend uses its keyword analysis).
  Set DISTILBERT_SKIP_SELFTEST=1 to skip it once you know your machine is fine.

Endpoints
  GET  /health    -> { status, backend, model, device, shap, ... }   (503 if no backend)
  POST /predict   { "text": "..." }
                  -> [[ { "label": "NEGATIVE", "score": 0.98 }, ... ]]   (HF-compatible shape)
  POST /explain   { "text": "...", "target": "NEGATIVE", "max_evals": 300, "top_k": 8 }
                  -> SHAP word-level attribution (local backend only)

Environment
  DISTILBERT_HOST / DISTILBERT_PORT       bind address (default 127.0.0.1:5001)
  DISTILBERT_MODEL                        model id or local folder
  DISTILBERT_DEVICE                       auto | cpu | cuda | mps   (default auto)
  DISTILBERT_THREADS                      torch CPU threads
  DISTILBERT_SELFTEST_TIMEOUT             seconds (default 600 -- first run downloads the model)
  SHAP_MAX_EVALS                          default model calls per explanation (default 300)
  DISTILBERT_SKIP_SHAP_WARMUP=1           don't pre-import SHAP in a background thread at start-up
  HF_TOKEN / HUGGING_FACE_API_KEY / HUGGINGFACE_API_TOKEN   only for the 'hf' backend
  HF_HUB_OFFLINE=1                        never touch the network (model must already be cached)
"""

import json
import os
import subprocess
import sys
import threading

# Load environment variables from ../.env (same convention as the Node backend)
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

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

MAX_TEXT_LENGTH = 5000
MODEL_NAME = os.environ.get("DISTILBERT_MODEL", "distilbert/distilbert-base-uncased-finetuned-sst-2-english")


# ---------------------------------------------------------------------------
# --selftest : executed in a CHILD process, never in the server process
# ---------------------------------------------------------------------------
def _run_selftest():
    """Load the model and do one real forward pass; print one JSON line."""
    import emotion_engine
    info = emotion_engine.probe()
    print(json.dumps({"ok": True, **info}))


if __name__ == "__main__" and "--selftest" in sys.argv:
    try:
        _run_selftest()
        sys.exit(0)
    except Exception as exc:  # reported to the parent; a native crash never gets here
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}))
        sys.exit(2)


from flask import Flask, jsonify, request  # noqa: E402  (after the --selftest fast path)
from flask_cors import CORS  # noqa: E402

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


class ServiceState:
    """Everything the routes need; kept in one object so tests can swap it."""

    def __init__(self):
        self.mode = (os.environ.get("DISTILBERT_BACKEND", "auto") or "auto").strip().lower()
        self.active = None          # "local" | "hf" | None
        self.engine = None          # emotion_engine.LocalSentimentEngine
        self.hf_client = None
        self.local_error = None     # why the local backend is off (None = fine / not tried)
        self.selftest = None        # dict from the child process


STATE = ServiceState()


def _hf_token():
    return (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGING_FACE_API_KEY")
        or os.environ.get("HUGGINGFACE_API_TOKEN")
        or ""
    ).strip()


def describe_exit(returncode):
    """Human-readable reason for a child that died."""
    if returncode is None:
        return "timed out"
    if returncode < 0:  # POSIX: killed by a signal
        try:
            import signal
            return f"killed by signal {signal.Signals(-returncode).name}"
        except Exception:
            return f"killed by signal {-returncode}"
    if returncode >= 0xC0000000:  # Windows NTSTATUS error range, e.g. 0xC0000005 access violation
        return f"native crash (exit code 0x{returncode:08X})"
    if returncode == 3 and os.name == "nt":
        # The Windows C runtime exits with 3 after abort() / an unhandled SIGSEGV or SIGABRT.
        # (Our own --selftest uses exit code 2 for ordinary Python errors, never 3.)
        return "crashed (abnormal termination, exit code 3)"
    return f"exit code {returncode}"


def run_selftest_subprocess(timeout=None):
    """Probe the local model in a child process. Returns (ok, detail_dict)."""
    timeout = timeout or float(os.environ.get("DISTILBERT_SELFTEST_TIMEOUT", "600"))
    cmd = [sys.executable, os.path.abspath(__file__), "--selftest"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, {"reason": f"self-test timed out after {int(timeout)}s"}
    except Exception as exc:
        return False, {"reason": f"could not start self-test: {type(exc).__name__}: {exc}"}

    payload = None
    for line in reversed((proc.stdout or "").strip().splitlines()):
        try:
            payload = json.loads(line)
            break
        except ValueError:
            continue

    if proc.returncode == 0 and isinstance(payload, dict) and payload.get("ok"):
        return True, payload

    reason = describe_exit(proc.returncode)
    if isinstance(payload, dict) and payload.get("error"):
        reason = f"{reason}: {payload['error']}"
    tail = (proc.stderr or "").strip().splitlines()[-3:]
    return False, {"reason": reason, "stderr_tail": tail}


def initialise(state=None):
    """Decide which backend to use. Safe to call once at start-up."""
    state = state or STATE

    if state.mode in ("auto", "local"):
        ok = True
        if os.environ.get("DISTILBERT_SKIP_SELFTEST", "").strip() not in ("1", "true", "True"):
            print("[INIT] Self-test: running one real DistilBERT forward pass in a child process...")
            ok, detail = run_selftest_subprocess()
            state.selftest = detail
            if ok:
                print(f"[OK] Self-test passed (device={detail.get('device')}, top={detail.get('top')})")
            else:
                state.local_error = f"local self-test failed: {detail.get('reason')}"
                print(f"[WARN] {state.local_error}")
        if ok:
            try:
                import emotion_engine
                state.engine = emotion_engine.LocalSentimentEngine()
                state.active = "local"
                shap_ok = state.engine.shap_available()
                print(f"[OK] Local DistilBERT ready on {state.engine.device} "
                      f"(SHAP {'available' if shap_ok else 'NOT installed'})")
                if shap_ok and os.environ.get("DISTILBERT_SKIP_SHAP_WARMUP", "").strip() not in ("1", "true", "True"):
                    # `import shap` alone can take ~1 min cold; do it off the request path.
                    threading.Thread(target=state.engine.warm_up_explainer, name="shap-warmup", daemon=True).start()
            except Exception as exc:
                state.local_error = f"local model failed to load: {type(exc).__name__}: {exc}"
                print(f"[WARN] {state.local_error}")

    if state.active is None and state.mode in ("auto", "hf"):
        token = _hf_token()
        if token:
            from huggingface_hub import InferenceClient
            state.hf_client = InferenceClient(provider="auto", api_key=token)
            state.active = "hf"
            print("[OK] Using the Hugging Face Inference API (needs credits).")
        elif state.mode == "hf":
            print("[WARN] DISTILBERT_BACKEND=hf but no HF token is configured.")

    if state.active is None:
        print("[WARN] No usable backend: /health will report 503 and the Node backend "
              "will fall back to keyword analysis.")
    return state


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _json_text_or_error():
    """Parse {"text": ...}; returns (text, None) or (None, (response, status))."""
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return None, (jsonify({"error": "Invalid JSON payload; expected an object"}), 400)
    raw = data.get("text")
    if raw is None:
        raw = data.get("inputs", "")
    if not isinstance(raw, str) or not raw.strip():
        return None, (jsonify({"error": "text must be a non-empty string"}), 400)
    return (raw.strip()[:MAX_TEXT_LENGTH], data), None


def _predict_hf(text):
    result = STATE.hf_client.text_classification(text, model=MODEL_NAME)
    results = []
    for item in result or []:
        label = item.get("label") if isinstance(item, dict) else getattr(item, "label", None)
        score = item.get("score") if isinstance(item, dict) else getattr(item, "score", None)
        if label is None or score is None:
            continue
        results.append({"label": str(label), "score": round(float(score), 6)})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    if STATE.active is None:
        return jsonify({
            "status": "unavailable",
            "model": MODEL_NAME,
            "mode": STATE.mode,
            "error": STATE.local_error or "No backend configured (no local model and no Hugging Face token)",
            "selftest": STATE.selftest,
        }), 503

    body = {"status": "ok", "model": MODEL_NAME, "backend": STATE.active, "mode": STATE.mode}
    if STATE.active == "local" and STATE.engine is not None:
        body.update({
            "device": STATE.engine.device,
            "labels": STATE.engine.labels,
            "shap": STATE.engine.shap_available(),
            "shap_ready": STATE.engine.shap_ready,
            "method": "transformers (in-process, no API credits)",
        })
    else:
        body["method"] = "huggingface_hub.InferenceClient"
        body["shap"] = False
        if STATE.local_error:
            body["local_error"] = STATE.local_error
    return jsonify(body)


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts: { "text": "some complaint text" }
    Returns: [[ { "label": "NEGATIVE", "score": 0.987 }, { "label": "POSITIVE", "score": 0.013 } ]]
    """
    if STATE.active is None:
        return jsonify({"error": "Service is not configured", "detail": STATE.local_error}), 503

    parsed, err = _json_text_or_error()
    if err:
        return err
    text, _ = parsed

    try:
        results = STATE.engine.predict(text) if STATE.active == "local" else _predict_hf(text)
        if not results:
            return jsonify({"error": "Model returned no predictions"}), 502
        print(f"[PREDICT] {STATE.active}: {len(text)}-char input -> {results[0]['label']} ({results[0]['score']:.4f})")
        return jsonify([results])
    except Exception as exc:
        print(f"[ERROR] Prediction error: {type(exc).__name__}: {exc}")
        return jsonify({"error": "Emotion prediction failed"}), 500


@app.route("/explain", methods=["POST"])
def explain():
    """
    SHAP word-level explanation.
    Accepts: { "text": "...", "target": "NEGATIVE" (optional), "max_evals": 300, "top_k": 8 }
    """
    if STATE.active != "local" or STATE.engine is None:
        return jsonify({
            "error": "SHAP explanations need the local DistilBERT backend",
            "detail": STATE.local_error or "local backend is not active",
        }), 503

    parsed, err = _json_text_or_error()
    if err:
        return err
    text, data = parsed

    try:
        top_k = max(1, min(int(data.get("top_k", 8)), 25))
        max_evals = data.get("max_evals")
        max_evals = int(max_evals) if max_evals is not None else None
        result = STATE.engine.explain(text, target=data.get("target"), max_evals=max_evals, top_k=top_k)
        print(f"[EXPLAIN] {len(text)} chars, target={result['target']}, "
              f"{result['elapsed_ms']} ms{' (cached)' if result.get('cached') else ''}")
        return jsonify(result)
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        import emotion_engine
        if isinstance(exc, emotion_engine.EngineUnavailable):
            return jsonify({"error": "SHAP is not installed", "detail": str(exc)}), 501
        print(f"[ERROR] Explain error: {type(exc).__name__}: {exc}")
        return jsonify({"error": "Explanation failed"}), 500


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
    initialise(STATE)
    host = os.environ.get("DISTILBERT_HOST", "127.0.0.1")
    port = _parse_port(os.environ.get("DISTILBERT_PORT", 5001))
    print(f"DistilBERT service starting on {host}:{port} (backend={STATE.active or 'none'})")
    app.run(host=host, port=port, debug=False, threaded=True)
