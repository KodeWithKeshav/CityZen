"""
Integration tests against the REAL local model (downloads ~270 MB on first use).

Opt-in so a plain `pytest` stays instant and offline:

    RUN_MODEL_TESTS=1 python -m pytest tests/test_engine_model.py -v
"""
import os

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_MODEL_TESTS", "").strip() not in ("1", "true", "True"),
    reason="set RUN_MODEL_TESTS=1 to run tests that load the real DistilBERT model",
)

NEGATIVE_TEXT = "The road is dangerous, children fall into the pothole every day and nobody is fixing it."
POSITIVE_TEXT = "Thank you, the new park is wonderful and the staff were very helpful."


@pytest.fixture(scope="module")
def engine():
    import emotion_engine
    return emotion_engine.LocalSentimentEngine()


def test_predict_matches_the_wire_format_and_picks_the_right_side(engine):
    neg = engine.predict(NEGATIVE_TEXT)
    pos = engine.predict(POSITIVE_TEXT)
    assert [r["label"] for r in neg][0] == "NEGATIVE" and neg[0]["score"] > 0.9
    assert [r["label"] for r in pos][0] == "POSITIVE" and pos[0]["score"] > 0.9
    assert sum(r["score"] for r in neg) == pytest.approx(1.0, abs=1e-4)
    assert neg[0]["score"] >= neg[1]["score"]                      # sorted, highest first


def test_long_input_is_truncated_not_crashed(engine):
    assert engine.predict("pothole " * 2000)[0]["label"] in engine.labels


def test_shap_values_are_additive_and_point_at_the_distress_words(engine):
    pytest.importorskip("shap")
    result = engine.explain(NEGATIVE_TEXT, target="NEGATIVE", max_evals=400)

    # Additivity: base + sum(contributions) reproduces the model output (SHAP's guarantee).
    assert result["base_value"] + result["attribution_sum"] == pytest.approx(result["output_value"], abs=0.05)

    # Offsets map back onto the original text exactly.
    for w in result["words"]:
        assert NEGATIVE_TEXT[w["start"]:w["end"]] == w["text"]

    # The words a human would call distressing should be among the strongest positive drivers.
    drivers = {w["text"].lower() for w in result["top_positive"]}
    assert drivers & {"dangerous", "fall", "nobody", "pothole", "children"}


def test_explaining_the_opposite_target_flips_the_sign(engine):
    pytest.importorskip("shap")
    neg = engine.explain(NEGATIVE_TEXT, target="NEGATIVE", max_evals=300)
    pos = engine.explain(NEGATIVE_TEXT, target="POSITIVE", max_evals=300)
    neg_by = {w["text"]: w["shap"] for w in neg["words"]}
    pos_by = {w["text"]: w["shap"] for w in pos["words"]}
    strongest = max(neg_by, key=lambda k: abs(neg_by[k]))
    assert neg_by[strongest] * pos_by[strongest] < 0


def test_explanations_are_cached(engine):
    pytest.importorskip("shap")
    engine.explain(POSITIVE_TEXT, max_evals=200)
    assert engine.explain(POSITIVE_TEXT, max_evals=200)["cached"] is True


def test_bad_target_is_a_value_error(engine):
    pytest.importorskip("shap")
    with pytest.raises(ValueError):
        engine.explain(NEGATIVE_TEXT, target="ANGRY")
