import pytest
from pydantic import ValidationError

from cervo.models import Question
from cervo.questions import public_view

BASE = {"id": "x-1", "category": "culture", "difficulty": 2, "prompt": "Une question ?", "explanation": "Une explication assez longue."}


def test_order_question():
    q = Question.model_validate({**BASE, "type": "order", "correct_answer": ["1492", "1789", "1969"]})
    view = public_view(q.model_dump(), 0)
    assert sorted(view["items"]) == ["1492", "1789", "1969"] and "correct_answer" not in view
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "type": "order", "correct_answer": ["a", "b"]})


def test_size_question():
    size = {"reference": {"label": "Tasse", "emoji": "☕"}, "target": {"label": "Assiette", "emoji": "🍽️"}, "min": 0.5, "max": 8}
    q = Question.model_validate({**BASE, "type": "size", "correct_answer": 3.4, "size_config": size})
    assert public_view(q.model_dump(), 0)["size"]["target"]["label"] == "Assiette"
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "type": "size", "correct_answer": 12, "size_config": size})


def test_dictation_and_timer():
    q = Question.model_validate({**BASE, "type": "dictation", "correct_answer": "Demain, dès l'aube, je partirai."})
    view = public_view(q.model_dump(), 0)
    assert view["time_limit"] == 45 and "speech" in view and "Demain" not in str(view)


def test_slider_and_memorize():
    q = Question.model_validate({**BASE, "type": "numeric", "correct_answer": 1450,
                                 "numeric_config": {"scale": "linear", "tolerance": 100, "input": "slider", "min": 1000, "max": 2000, "step": 10},
                                 "memorize": {"items": ["un", "deux"], "seconds": 4}})
    view = public_view(q.model_dump(), 0)
    assert view["slider"] == {"min": 1000, "max": 2000, "step": 10}
    assert view["memorize"]["seconds"] == 4 and view["time_limit"] == 15
    with pytest.raises(ValidationError):
        Question.model_validate({**BASE, "type": "numeric", "correct_answer": 5, "numeric_config": {"input": "slider", "min": 10, "max": 1}})
