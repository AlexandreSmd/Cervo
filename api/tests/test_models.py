import pytest
from pydantic import ValidationError

from cervo.domain.models import Question
from cervo.services.bank import public_view, reveal

BASE = {"id": "x-1", "difficulty": 2, "prompt": "Une question ?", "explanation": "Une explication assez longue."}


def test_order_question_needs_dates_for_chronology():
    base = {**BASE, "category": "chronologie", "type": "order", "correct_answer": ["Rome", "Oxford", "Aztèques"]}
    q = Question.model_validate({**base, "order_details": ["753 av. J.-C.", "1096", "1325"]})
    view = public_view(q.model_dump(), 0)
    assert sorted(view["items"]) == ["Aztèques", "Oxford", "Rome"] and "correct_answer" not in view
    assert reveal(q.model_dump())["order_details"] == ["753 av. J.-C.", "1096", "1325"]
    with pytest.raises(ValidationError):
        Question.model_validate(base)  # dates manquantes
    with pytest.raises(ValidationError):
        Question.model_validate({**base, "order_details": ["1", "2"]})  # une date par élément


def test_answer_type_must_fit_the_kind():
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "category": "vocabulaire", "type": "binary", "correct_answer": True})
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "category": "histoire", "type": "binary", "correct_answer": True})


def test_size_question():
    size = {"reference": {"label": "Tasse", "emoji": "☕"}, "target": {"label": "Assiette", "emoji": "🍽️"}, "min": 0.5, "max": 8}
    q = Question.model_validate({**BASE, "category": "taille", "type": "size", "correct_answer": 3.4, "size_config": size})
    assert public_view(q.model_dump(), 0)["size"]["target"]["label"] == "Assiette"
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "category": "taille", "type": "size", "correct_answer": 12, "size_config": size})


def test_dictation_two_sentences_no_timer_text_hidden():
    base = {**BASE, "category": "dictee", "type": "dictation"}
    q = Question.model_validate({**base, "correct_answer": "Demain, dès l'aube, je partirai. Je marcherai."})
    view = public_view(q.model_dump(), 0)
    assert view["time_limit"] is None and "speech" in view and "Demain" not in str(view)
    with pytest.raises(ValidationError):
        Question.model_validate({**base, "correct_answer": "Une seule phrase ici, sans plus."})


def test_riddle_clues_are_revealed_one_by_one():
    q = Question.model_validate(
        {
            **BASE,
            "category": "devinette",
            "type": "riddle",
            "correct_answer": "koala",
            "clues": ["Je dors beaucoup.", "Je mange de l'eucalyptus.", "Je vis en Australie."],
        }
    ).model_dump()
    first = public_view(q, 0)
    assert first["clues"] == ["Je dors beaucoup."] and first["clue_total"] == 3 and "koala" not in str(first)
    assert len(public_view(q, 0, clues_seen=2)["clues"]) == 2
    assert reveal(q)["clues"] == q["clues"]
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "category": "devinette", "type": "riddle", "correct_answer": "x", "clues": ["un", "deux"]})


def test_recall_and_memorize():
    q = Question.model_validate(
        {
            **BASE,
            "category": "memoire",
            "type": "recall",
            "memorize": {"items": ["4", "8", "1", "5"]},
            "correct_answer": ["4", "8", "1", "5"],
            "recall_ordered": True,
        }
    ).model_dump()
    view = public_view(q, 0)
    assert view["recall"] == {"count": 4, "ordered": True, "single_chars": True}
    assert view["memorize"]["seconds"] >= 3  # durée calculée
    with pytest.raises(ValidationError):  # une question de mémoire sans mémorisation
        Question.model_validate({**BASE, "category": "memoire", "type": "mcq", "choices": list("abcd"), "correct_answer": "a"})


def test_percent():
    q = Question.model_validate({**BASE, "category": "stat", "type": "percent", "correct_answer": 71})
    assert public_view(q.model_dump(), 0)["type"] == "percent"
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "category": "stat", "type": "percent", "correct_answer": 140})
