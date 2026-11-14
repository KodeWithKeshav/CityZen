"""
Unit tests for the SHAP post-processing (emotion_engine._merge_pieces_into_words).
Pure Python: no torch / shap / model needed.
"""
import pytest

from emotion_engine import _merge_pieces_into_words


def total(words):
    return round(sum(w["shap"] for w in words), 6)


def test_wordpieces_are_merged_into_whole_words_and_their_values_add_up():
    text = "Dangerous potholes everywhere"
    pieces = ["", "dangerous", " pot", "##holes", " everywhere", ""]
    values = [0.0, 0.30, 0.10, 0.05, 0.02, 0.0]
    words = _merge_pieces_into_words(text, pieces, values)

    assert [w["text"] for w in words] == ["Dangerous", "potholes", "everywhere"]
    by_text = {w["text"]: w["shap"] for w in words}
    assert by_text["potholes"] == pytest.approx(0.15)     # 0.10 + 0.05
    assert by_text["Dangerous"] == pytest.approx(0.30)
    assert total(words) == pytest.approx(sum(values))     # additivity is preserved


def test_offsets_point_at_the_exact_word_in_the_ORIGINAL_text():
    text = "The road, near the SCHOOL, is unsafe!"
    pieces = ["the", " road", ",", " near", " the", " school", ",", " is", " un", "##safe", "!"]
    values = [0.0] * len(pieces)
    words = _merge_pieces_into_words(text, pieces, values)
    for w in words:
        assert text[w["start"]:w["end"]] == w["text"]
    assert [w["text"] for w in words] == ["The", "road", ",", "near", "the", "SCHOOL", ",", "is", "unsafe", "!"]


def test_matching_is_case_insensitive_because_the_tokenizer_is_uncased():
    words = _merge_pieces_into_words("BROKEN Pole", ["broken", " pole"], [0.4, 0.1])
    assert {w["text"]: w["shap"] for w in words} == {"BROKEN": pytest.approx(0.4), "Pole": pytest.approx(0.1)}


def test_punctuation_is_its_own_unit():
    words = _merge_pieces_into_words("No action, again.", ["no", " action", ",", " again", "."], [0.1, 0.2, 0.0, 0.3, 0.05])
    assert [w["text"] for w in words] == ["No", "action", ",", "again", "."]


def test_apostrophes_stay_inside_a_word():
    words = _merge_pieces_into_words("Don't ignore", ["don", "'", "t", " ignore"], [0.1, 0.05, 0.05, 0.3])
    assert [w["text"] for w in words] == ["Don't", "ignore"]
    assert words[0]["shap"] == pytest.approx(0.2)


def test_special_token_mass_is_not_lost_it_is_spread_so_the_total_still_matches():
    text = "bad road"
    pieces = ["[CLS]", "bad", " road", "[SEP]"]          # unmatched specials carrying non-zero mass
    values = [0.04, 0.2, 0.1, 0.02]
    words = _merge_pieces_into_words(text, pieces, values)
    assert total(words) == pytest.approx(sum(values), abs=1e-5)


def test_pieces_that_cannot_be_located_do_not_crash_and_keep_the_total():
    words = _merge_pieces_into_words("cafe closed", ["café", " closed"], [0.3, 0.1])   # normalised accents
    assert [w["text"] for w in words] == ["cafe", "closed"]
    assert total(words) == pytest.approx(0.4, abs=1e-5)


def test_unicode_and_empty_edge_cases():
    assert _merge_pieces_into_words("", [], []) == []
    words = _merge_pieces_into_words("2 children 🚸", ["2", " children"], [0.0, 0.2])
    assert any(w["text"] == "children" for w in words)


def test_values_are_rounded_floats():
    words = _merge_pieces_into_words("danger", ["danger"], [0.123456789])
    assert words[0]["shap"] == 0.123457
