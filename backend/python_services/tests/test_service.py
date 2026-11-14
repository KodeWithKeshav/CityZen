"""
Route / start-up tests for distilbert_emotion_service.py.

They use a FakeEngine, so they need neither torch nor the model download and run
in well under a second. The real model is exercised in test_engine_model.py
(opt-in, RUN_MODEL_TESTS=1).
"""
import subprocess

import pytest

import distilbert_emotion_service as svc
import emotion_engine


class FakeEngine:
    device = "cpu"
    labels = ["NEGATIVE", "POSITIVE"]

    shap_ready = False

    def __init__(self, shap=True):
        self._shap = shap
        self.explain_calls = []

    def shap_available(self):
        return self._shap

    def predict(self, text):
        return [{"label": "NEGATIVE", "score": 0.97}, {"label": "POSITIVE", "score": 0.03}]

    def explain(self, text, target=None, max_evals=None, top_k=8):
        self.explain_calls.append({"text": text, "target": target, "max_evals": max_evals, "top_k": top_k})
        if text == "boom-value":
            raise ValueError("unknown target label 'X'")
        if text == "boom-shap":
            raise emotion_engine.EngineUnavailable("shap is not available: ImportError")
        if text == "boom-crash":
            raise RuntimeError("kaboom")
        return {"label": "NEGATIVE", "score": 0.97, "target": target or "NEGATIVE", "words": [], "elapsed_ms": 5}


@pytest.fixture()
def client():
    state = svc.ServiceState()
    svc.STATE = state
    svc.app.config["TESTING"] = True
    yield svc.app.test_client(), state


def make_local(state, **kw):
    state.engine = FakeEngine(**kw)
    state.active = "local"


# ---------------------------------------------------------------- /health
def test_health_is_503_and_explains_why_when_no_backend(client):
    c, state = client
    state.local_error = "local self-test failed: killed by signal SIGBUS"
    res = c.get("/health")
    assert res.status_code == 503
    body = res.get_json()
    assert body["status"] == "unavailable"
    assert "SIGBUS" in body["error"]


def test_health_reports_local_backend_device_and_shap(client):
    c, state = client
    make_local(state)
    body = c.get("/health").get_json()
    assert body["status"] == "ok"
    assert body["backend"] == "local"
    assert body["device"] == "cpu"
    assert body["shap"] is True
    assert body["shap_ready"] is False       # explainer not built yet (warm-up still running)
    assert body["labels"] == ["NEGATIVE", "POSITIVE"]


def test_health_flags_missing_shap_without_failing(client):
    c, state = client
    make_local(state, shap=False)
    res = c.get("/health")
    assert res.status_code == 200
    assert res.get_json()["shap"] is False


# ---------------------------------------------------------------- /predict
def test_predict_returns_the_nested_array_shape_the_node_backend_expects(client):
    c, state = client
    make_local(state)
    res = c.post("/predict", json={"text": "The road is dangerous"})
    assert res.status_code == 200
    body = res.get_json()
    assert isinstance(body, list) and isinstance(body[0], list)
    assert body[0][0] == {"label": "NEGATIVE", "score": 0.97}


def test_predict_accepts_the_hf_style_inputs_key(client):
    c, state = client
    make_local(state)
    assert c.post("/predict", json={"inputs": "hello there"}).status_code == 200


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": "   "}, {"text": 42}, [], "just a string"])
def test_predict_rejects_bad_payloads_with_400(client, payload):
    c, state = client
    make_local(state)
    assert c.post("/predict", json=payload).status_code == 400


def test_predict_is_503_when_nothing_is_configured(client):
    c, _ = client
    assert c.post("/predict", json={"text": "x"}).status_code == 503


def test_predict_hides_internal_errors(client):
    c, state = client
    make_local(state)
    state.engine.predict = lambda text: (_ for _ in ()).throw(RuntimeError("secret internals"))
    res = c.post("/predict", json={"text": "x"})
    assert res.status_code == 500
    assert "secret" not in res.get_data(as_text=True)


# ---------------------------------------------------------------- /explain
def test_explain_needs_the_local_backend(client):
    c, state = client
    state.active = "hf"
    state.local_error = "local self-test failed: exit code 2"
    res = c.post("/explain", json={"text": "x"})
    assert res.status_code == 503
    assert "exit code 2" in res.get_json()["detail"]


def test_explain_passes_options_through_and_clamps_top_k(client):
    c, state = client
    make_local(state)
    res = c.post("/explain", json={"text": "dangerous road", "target": "NEGATIVE", "max_evals": 120, "top_k": 999})
    assert res.status_code == 200
    call = state.engine.explain_calls[0]
    assert call == {"text": "dangerous road", "target": "NEGATIVE", "max_evals": 120, "top_k": 25}


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": 7}])
def test_explain_validates_text(client, payload):
    c, state = client
    make_local(state)
    assert c.post("/explain", json=payload).status_code == 400


def test_explain_maps_engine_errors_to_sensible_statuses(client):
    c, state = client
    make_local(state)
    assert c.post("/explain", json={"text": "boom-value"}).status_code == 400
    assert c.post("/explain", json={"text": "boom-shap"}).status_code == 501
    crash = c.post("/explain", json={"text": "boom-crash"})
    assert crash.status_code == 500
    assert "kaboom" not in crash.get_data(as_text=True)


# ---------------------------------------------------------------- crash isolation
class _Done:
    def __init__(self, returncode, stdout="", stderr=""):
        self.returncode, self.stdout, self.stderr = returncode, stdout, stderr


def test_describe_exit_names_native_crashes():
    assert "timed out" in svc.describe_exit(None)
    assert "signal" in svc.describe_exit(-7)                    # POSIX SIGBUS on macOS = 10, Linux = 7
    assert "native crash" in svc.describe_exit(0xC0000005)      # Windows access violation
    assert svc.describe_exit(2) == "exit code 2"                # an ordinary failure is NOT a "crash"
    assert svc.describe_exit(1) == "exit code 1"


def test_describe_exit_treats_windows_exit_code_3_as_an_abort_but_only_on_windows(monkeypatch):
    monkeypatch.setattr(svc.os, "name", "nt")
    assert "crashed" in svc.describe_exit(3)
    monkeypatch.setattr(svc.os, "name", "posix")
    assert svc.describe_exit(3) == "exit code 3"


def test_selftest_success_is_parsed_from_the_last_json_line(monkeypatch):
    out = 'loading...\n{"ok": true, "device": "cpu", "top": {"label": "NEGATIVE", "score": 0.99}}\n'
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _Done(0, out))
    ok, detail = svc.run_selftest_subprocess(timeout=5)
    assert ok is True and detail["device"] == "cpu"


def test_selftest_reports_a_child_that_died_without_taking_the_server_down(monkeypatch):
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _Done(-10, "", "Bus error\n"))
    ok, detail = svc.run_selftest_subprocess(timeout=5)
    assert ok is False
    assert "signal" in detail["reason"]
    assert detail["stderr_tail"] == ["Bus error"]


def test_selftest_reports_python_level_failures_with_their_message(monkeypatch):
    out = '{"ok": false, "error": "OSError: no internet and model not cached"}\n'
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _Done(2, out))
    ok, detail = svc.run_selftest_subprocess(timeout=5)
    assert ok is False
    assert "exit code 2" in detail["reason"] and "not cached" in detail["reason"]


def test_selftest_timeout_is_reported(monkeypatch):
    def boom(*a, **k):
        raise subprocess.TimeoutExpired(cmd="x", timeout=5)
    monkeypatch.setattr(subprocess, "run", boom)
    ok, detail = svc.run_selftest_subprocess(timeout=5)
    assert ok is False and "timed out" in detail["reason"]


def test_initialise_disables_local_but_keeps_serving_when_selftest_fails(monkeypatch):
    monkeypatch.delenv("DISTILBERT_SKIP_SELFTEST", raising=False)
    for k in ("HF_TOKEN", "HUGGING_FACE_API_KEY", "HUGGINGFACE_API_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setattr(svc, "run_selftest_subprocess", lambda: (False, {"reason": "killed by signal SIGBUS"}))
    state = svc.ServiceState()
    state.mode = "auto"
    svc.initialise(state)
    assert state.active is None
    assert "SIGBUS" in state.local_error


def test_initialise_falls_back_to_hf_when_local_is_broken_and_a_token_exists(monkeypatch):
    monkeypatch.delenv("DISTILBERT_SKIP_SELFTEST", raising=False)
    monkeypatch.setenv("HF_TOKEN", "hf_dummy_token_for_test_only")
    monkeypatch.setattr(svc, "run_selftest_subprocess", lambda: (False, {"reason": "exit code 2"}))

    class DummyClient:
        def __init__(self, **kw):
            self.kw = kw
    import huggingface_hub
    monkeypatch.setattr(huggingface_hub, "InferenceClient", DummyClient)

    state = svc.ServiceState()
    state.mode = "auto"
    svc.initialise(state)
    assert state.active == "hf"
    assert state.local_error and "exit code 2" in state.local_error


def test_local_only_mode_never_falls_back_to_hf(monkeypatch):
    monkeypatch.setenv("HF_TOKEN", "hf_dummy_token_for_test_only")
    monkeypatch.setattr(svc, "run_selftest_subprocess", lambda: (False, {"reason": "exit code 2"}))
    state = svc.ServiceState()
    state.mode = "local"
    svc.initialise(state)
    assert state.active is None
