"""
Local DistilBERT sentiment engine + SHAP explanations
======================================================
Runs ``distilbert-base-uncased-finetuned-sst-2-english`` **in-process** with
``transformers`` + ``torch`` -- no Hugging Face Inference API call, so no API
credits are needed.  The only network use is the one-off, free download of the
~270 MB model weights from the Hugging Face Hub (cached afterwards; set
``HF_HUB_OFFLINE=1`` to forbid any network access once cached).

This module is import-light on purpose: ``torch`` / ``transformers`` / ``shap``
are imported lazily so that ``--selftest`` (see distilbert_emotion_service.py)
can probe them in a child process, and so a missing optional dependency (SHAP)
never prevents plain sentiment prediction from working.

Public surface
--------------
* ``LocalSentimentEngine.predict(text)``   -> ``[{"label", "score"}, ...]`` (sorted desc)
* ``LocalSentimentEngine.explain(text)``   -> SHAP word-level attribution dict
* ``probe()``                              -> tiny end-to-end forward pass (used by the self-test)
"""

import os
import re
import threading
import time
from collections import OrderedDict

# Cosmetic: Windows cannot create the symlinks the HF cache prefers (works fine, just
# warns on every start), and fast-tokenizer thread pools warn when the process forks.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

DEFAULT_MODEL = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"

# Hard caps so one request can never monopolise the CPU.
MAX_TOKENS = 512            # DistilBERT's positional limit
SHAP_MAX_CHARS = 1200       # explanation is O(evals x tokens); keep it bounded
SHAP_DEFAULT_EVALS = 300    # model calls SHAP may spend on one explanation
SHAP_MAX_EVALS = 1500
PREDICT_BATCH = 32
EXPLAIN_CACHE_SIZE = 64


class EngineUnavailable(RuntimeError):
    """Raised when an optional capability (e.g. SHAP) is not installed."""


def _pick_device(requested, torch):
    requested = (requested or "auto").strip().lower()
    if requested == "cpu":
        return "cpu"
    if requested in ("cuda", "gpu"):
        return "cuda" if torch.cuda.is_available() else "cpu"
    if requested == "mps":
        mps = getattr(torch.backends, "mps", None)
        return "mps" if mps is not None and mps.is_available() else "cpu"
    # auto: DistilBERT is tiny, so CPU is always fine; only use CUDA if present.
    return "cuda" if torch.cuda.is_available() else "cpu"


class LocalSentimentEngine:
    def __init__(self, model_name=None, device=None, local_files_only=None):
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self._torch = torch
        self.model_name = model_name or os.environ.get("DISTILBERT_MODEL", DEFAULT_MODEL)
        self.device = _pick_device(device or os.environ.get("DISTILBERT_DEVICE"), torch)
        if local_files_only is None:
            local_files_only = os.environ.get("HF_HUB_OFFLINE", "").strip() in ("1", "true", "True")

        threads = os.environ.get("DISTILBERT_THREADS", "").strip()
        if threads.isdigit() and int(threads) > 0:
            torch.set_num_threads(int(threads))

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, local_files_only=local_files_only)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name, local_files_only=local_files_only
        )
        self.model.to(self.device).eval()

        id2label = self.model.config.id2label
        self.labels = [str(id2label[i]) for i in range(len(id2label))]

        # torch modules are not safe to call concurrently from Flask's threads.
        self._lock = threading.RLock()
        # SHAP explainers keep internal state, so explanations run one at a time -- but on
        # their OWN lock: predict_proba() takes `_lock` per batch, so a 1-3 s explanation
        # never stalls the /predict calls made while a complaint is being submitted.
        self._explain_lock = threading.Lock()
        self._explainer = None
        self._explain_cache = OrderedDict()

    # ------------------------------------------------------------------ predict
    def predict_proba(self, texts):
        """Softmax probabilities, shape (len(texts), num_labels), as a numpy array."""
        import numpy as np

        texts = [str(t) for t in texts]
        if not texts:
            return np.zeros((0, len(self.labels)), dtype="float64")

        out = []
        with self._lock, self._torch.inference_mode():
            for i in range(0, len(texts), PREDICT_BATCH):
                batch = texts[i:i + PREDICT_BATCH]
                enc = self.tokenizer(
                    batch,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=MAX_TOKENS,
                ).to(self.device)
                logits = self.model(**enc).logits
                out.append(self._torch.softmax(logits.float(), dim=-1).cpu().numpy())
        return np.concatenate(out, axis=0).astype("float64")

    def predict(self, text):
        probs = self.predict_proba([text])[0]
        results = [{"label": lab, "score": round(float(p), 6)} for lab, p in zip(self.labels, probs)]
        results.sort(key=lambda r: r["score"], reverse=True)
        return results

    # ------------------------------------------------------------------ SHAP
    def shap_available(self):
        """Is SHAP installed?  Deliberately does NOT import it: a cold `import shap`
        (scikit-learn + scipy + pandas) can take a minute, and /health must answer
        within the Node backend's 3-second probe timeout."""
        import importlib.util
        try:
            return importlib.util.find_spec("shap") is not None
        except Exception:
            return False

    @property
    def shap_ready(self):
        """True once SHAP is imported and the explainer is built (first /explain is then fast)."""
        return self._explainer is not None

    def warm_up_explainer(self):
        """
        Import SHAP, build the explainer and run one tiny explanation.  Meant for a
        background thread at start-up so the first admin click does not pay the
        cold-import cost.  Never raises.
        """
        try:
            started = time.time()
            self.explain("The road is dangerous.", max_evals=50)
            print(f"[OK] SHAP warmed up in {time.time() - started:.1f}s")
            return True
        except Exception as exc:
            print(f"[WARN] SHAP warm-up failed: {type(exc).__name__}: {exc}")
            return False

    def _get_explainer(self):
        if self._explainer is not None:
            return self._explainer
        try:
            import shap
        except Exception as exc:  # ImportError, or a broken numba/numpy pairing
            raise EngineUnavailable(f"shap is not available: {type(exc).__name__}: {exc}") from exc

        masker = shap.maskers.Text(self.tokenizer, mask_token="[MASK]", collapse_mask_token=True)
        self._explainer = shap.Explainer(
            lambda texts: self.predict_proba(list(texts)),
            masker,
            output_names=self.labels,
        )
        return self._explainer

    def _resolve_target(self, target, predicted):
        if not target:
            return predicted
        wanted = str(target).strip().lower()
        for idx, lab in enumerate(self.labels):
            if lab.lower() == wanted:
                return idx
        raise ValueError(f"unknown target label '{target}'; expected one of {self.labels}")

    def explain(self, text, target=None, max_evals=None, top_k=8):
        """
        Word-level SHAP attribution for the probability of ``target``
        (default: the model's predicted label).

        Values are *additive*: ``base_value + sum(word.shap) == output_value``
        (up to SHAP's sampling error).  A positive value pushes the probability
        of ``target`` UP, a negative one pushes it DOWN.  Sub-word pieces are
        merged back into whole words (additivity makes summing them exact).
        """
        text = (text or "").strip()[:SHAP_MAX_CHARS]
        if not text:
            raise ValueError("text must be a non-empty string")

        evals = int(max_evals or os.environ.get("SHAP_MAX_EVALS", SHAP_DEFAULT_EVALS))
        evals = max(50, min(evals, SHAP_MAX_EVALS))

        probs = self.predict_proba([text])[0]
        predicted_idx = int(probs.argmax())
        target_idx = self._resolve_target(target, predicted_idx)

        cache_key = (text, target_idx, evals)
        with self._lock:
            hit = self._explain_cache.get(cache_key)
            if hit is not None:
                self._explain_cache.move_to_end(cache_key)
                return {**hit, "cached": True}

        started = time.time()
        with self._explain_lock:
            explainer = self._get_explainer()
            sv = explainer([text], max_evals=evals, batch_size=PREDICT_BATCH, silent=True)

        values = sv.values[0][:, target_idx]            # (n_tokens,)
        pieces = [str(p) for p in sv.data[0]]            # token strings as SHAP segmented them
        base_value = float(sv.base_values[0][target_idx])

        words = _merge_pieces_into_words(text, pieces, values)

        ranked = sorted(words, key=lambda w: w["shap"])
        top_down = [w for w in ranked if w["shap"] < 0][:top_k]
        top_up = [w for w in reversed(ranked) if w["shap"] > 0][:top_k]

        result = {
            "text": text,
            "label": self.labels[predicted_idx],
            "score": round(float(probs[predicted_idx]), 6),
            "target": self.labels[target_idx],
            "target_probability": round(float(probs[target_idx]), 6),
            "base_value": round(base_value, 6),
            "output_value": round(float(probs[target_idx]), 6),
            "attribution_sum": round(float(sum(w["shap"] for w in words)), 6),
            "words": words,
            "top_positive": [_brief(w) for w in top_up],
            "top_negative": [_brief(w) for w in top_down],
            "method": "shap.Explainer(partition, text masker)",
            "unit": f"change in P({self.labels[target_idx]})",
            "max_evals": evals,
            "elapsed_ms": int((time.time() - started) * 1000),
            "cached": False,
        }

        with self._lock:
            self._explain_cache[cache_key] = result
            while len(self._explain_cache) > EXPLAIN_CACHE_SIZE:
                self._explain_cache.popitem(last=False)
        return result


def _brief(word):
    return {"text": word["text"], "shap": word["shap"]}


_WORD_RE = re.compile(r"\w+(?:['’-]\w+)*|[^\w\s]", re.UNICODE)


def _merge_pieces_into_words(text, pieces, values):
    """
    SHAP segments the text into tokenizer pieces (e.g. ``pot`` + ``holes``).  For
    a human-readable result we want whole words with exact character offsets in
    the ORIGINAL text, summing the (additive) SHAP values of the pieces that make
    each word up.

    Strategy: walk the pieces left-to-right and locate each in ``text``
    (case-insensitively, since the uncased tokenizer lower-cases the pieces),
    giving every piece a char span.  Then assign each piece to the word whose
    regex span contains the piece's start.
    """
    lowered = text.lower()
    spans = []
    cursor = 0
    for piece, val in zip(pieces, values):
        token = piece.strip()
        if token.startswith("##"):
            token = token[2:]
        if not token:                       # [CLS]/[SEP]/empty segments carry no text
            if float(val) != 0.0:           # keep any (rare) non-zero mass so the sum stays honest
                spans.append((None, None, float(val)))
            continue
        pos = lowered.find(token.lower(), cursor)
        if pos < 0:                         # tokenizer normalised the text (accents etc.)
            spans.append((None, None, float(val)))
            continue
        spans.append((pos, pos + len(token), float(val)))
        cursor = pos + len(token)

    words = []
    for m in _WORD_RE.finditer(text):
        words.append({"text": m.group(0), "start": m.start(), "end": m.end(), "shap": 0.0})

    orphan = 0.0
    for start, end, val in spans:
        if start is None:
            orphan += val
            continue
        for w in words:
            if w["start"] <= start < w["end"]:
                w["shap"] += val
                break
        else:
            orphan += val

    # Spread any unattributable mass evenly so additivity still holds.
    if orphan and words:
        share = orphan / len(words)
        for w in words:
            w["shap"] += share

    for w in words:
        w["shap"] = round(w["shap"], 6)
    return words


def probe(model_name=None):
    """One real forward pass.  Used by the child-process self-test."""
    engine = LocalSentimentEngine(model_name=model_name)
    top = engine.predict("The road is dangerous and nobody is fixing it.")[0]
    return {"device": engine.device, "labels": engine.labels, "top": top}
