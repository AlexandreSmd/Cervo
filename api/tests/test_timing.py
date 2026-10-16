from cervo.domain.timing import memorize_seconds, time_limit


def q(**kw):
    return {"category": "vocabulaire", "type": "mcq", "difficulty": 2, "prompt": "Quel mot ?", "choices": ["a", "b", "c", "d"], **kw}


def test_base_time_grows_with_difficulty():
    assert time_limit(q(difficulty=1)) <= time_limit(q(difficulty=2)) <= time_limit(q(difficulty=3))
    assert time_limit({**q(), "category": "enigme", "type": "short_text", "difficulty": 3}) >= 90


def test_rounded_to_five_seconds():
    for d in (1, 2, 3):
        assert time_limit(q(difficulty=d)) % 5 == 0


def test_long_prompt_and_choices_give_reading_time():
    short = time_limit(q())
    long_prompt = time_limit(q(prompt=" ".join(["mot"] * 45)))
    assert long_prompt >= short + 10
    long_choices = time_limit(q(choices=["un choix assez long à lire"] * 4))
    assert long_choices > short


def test_order_and_recall_get_time_per_item():
    base = {"category": "chronologie", "type": "order", "difficulty": 2, "prompt": "Classe."}
    assert time_limit({**base, "correct_answer": list("abcdef")}) > time_limit({**base, "correct_answer": list("abcd")})
    recall = {"category": "memoire", "type": "recall", "difficulty": 2, "prompt": "Retape."}
    assert time_limit({**recall, "correct_answer": list("1234567")}) > time_limit({**recall, "correct_answer": list("123")})


def test_dictation_has_no_timer_and_override_wins():
    assert time_limit({"category": "dictee", "type": "dictation", "difficulty": 2, "prompt": "Écoute."}) is None
    assert time_limit(q(time_limit=42)) == 42


def test_memorize_seconds():
    base = {"difficulty": 2, "memorize": {"items": ["a"] * 6}}
    assert memorize_seconds({**base, "difficulty": 1}) > memorize_seconds({**base, "difficulty": 3})
    assert memorize_seconds({"memorize": {"items": ["a"] * 6, "seconds": 4}}) == 4
    assert memorize_seconds({"difficulty": 1, "memorize": {"items": ["a"] * 12}}) == 15
    assert memorize_seconds({}) is None


def test_comfort_factor_applies_to_computed_time_only():
    from cervo.domain.timing import TIME_FACTOR

    assert TIME_FACTOR > 1
    # Vocabulaire facile : base 12 s, sans lecture en plus.
    assert time_limit(q(difficulty=1)) >= 12 * TIME_FACTOR
    assert time_limit(q(time_limit=30)) == 30
