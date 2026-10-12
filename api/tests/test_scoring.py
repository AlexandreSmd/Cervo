import pytest

from cervo.domain.scoring import (
    day_score,
    normalize_text,
    parse_number,
    score_answer,
    score_numeric,
    score_short_text,
)

LOG3 = {"scale": "log", "factor": 3}


def test_log_example_from_spec():
    assert score_numeric(500, 634, LOG3) == 78
    assert score_numeric(200, 634, LOG3) == 0


@pytest.mark.parametrize("answer", [0, -5, "abc", None, "", "inf", "nan"])
def test_log_absurd_answers_score_zero(answer):
    assert score_numeric(answer, 634, LOG3) == 0


def test_exact_and_within_one_percent():
    assert score_numeric(634, 634, LOG3) == 100
    assert score_numeric(630, 634, LOG3) == 100  # < 1 %
    assert score_numeric(1989, 1989, {"scale": "linear", "tolerance": 50}) == 100
    assert score_numeric(1990, 1989, {"scale": "linear", "tolerance": 50}) == 98


def test_exact_margin():
    cfg = {"scale": "linear", "tolerance": 50, "exact_margin": 2}
    assert score_numeric(1991, 2000, cfg) == 82
    assert score_numeric(1998, 2000, cfg) == 100


def test_log_symmetry_and_far_answers():
    assert score_numeric(634 * 2, 634, LOG3) == score_numeric(634 / 2, 634, LOG3)
    assert score_numeric(634 * 1000, 634, LOG3) == 0


def test_log_default_factor_is_three():
    assert score_numeric(500, 634, {"scale": "log"}) == 78


def test_linear_formula():
    cfg = {"scale": "linear", "tolerance": 50}
    assert score_numeric(1964, 1989, cfg) == 50
    assert score_numeric(1939, 1989, cfg) == 0
    assert score_numeric(2100, 1989, cfg) == 0
    assert score_numeric(-1000, 1989, cfg) == 0


def test_linear_negative_truth_allowed():
    assert score_numeric(-40, -50, {"scale": "linear", "tolerance": 20}) == 50


def test_parse_number_formats():
    assert parse_number("384 400") == 384400
    assert parse_number("1,5") == 1.5
    assert parse_number("1,234,567") == 1234567
    assert parse_number("1e3") == 1000
    assert parse_number(True) is None


def test_scores_always_between_0_and_100():
    for answer in [-1e9, -1, 0, 0.001, 1, 50, 633, 634, 1e6, 1e12]:
        for cfg in (LOG3, {"scale": "linear", "tolerance": 100}, {"scale": "log", "factor": 10}):
            s = score_numeric(answer, 634, cfg)
            assert isinstance(s, int) and 0 <= s <= 100


def test_normalize_text():
    assert normalize_text("  Élève-Œuf !") == "eleveoeuf"


def test_short_text_with_aliases():
    q = {"type": "short_text", "correct_answer": "Léonard de Vinci", "accepted_aliases": ["Vinci", "Leonardo da Vinci"]}
    assert score_answer(q, "leonard de vinci") == 100
    assert score_answer(q, "VINCI") == 100
    assert score_answer(q, "Michel-Ange") == 0
    assert score_answer(q, "") == 0


def test_short_text_numeric_exact():
    assert score_short_text("162", 162) == 100
    assert score_short_text("161", 162) == 0
    assert score_short_text("162,0", 162) == 100


def test_binary():
    q = {"type": "binary", "correct_answer": True}
    assert score_answer(q, True) == 100
    assert score_answer(q, "vrai") == 100
    assert score_answer(q, False) == 0
    assert score_answer(q, "peut-être") == 0


def test_mcq():
    q = {"type": "mcq", "correct_answer": "Ottawa", "choices": ["Toronto", "Ottawa", "Montréal", "Vancouver"]}
    assert score_answer(q, "Ottawa") == 100
    assert score_answer(q, "Toronto") == 0
    assert score_answer(q, None) == 0


def test_day_score():
    assert day_score([100, 0, 50, 51]) == 50
    assert day_score([]) == 0
    assert day_score([100] * 9 + [5]) == 91


def test_dictation_counts_words_and_accents():
    text = "Longtemps, je me suis couché de bonne heure."
    q = {"type": "dictation", "correct_answer": text}
    assert score_answer(q, "longtemps je me suis couché de bonne heure") == 100  # ponctuation et majuscules ignorées
    assert score_answer(q, "Longtemps, je me suis couche de bonne heure.") == 88  # accent oublié : 1 faute sur 8
    assert score_answer(q, "Longtemps je me suis couché de bonne") == 88  # mot oublié
    assert score_answer(q, "") == 0
    assert score_answer(q, "rien à voir du tout") == 0


def test_dictation_apostrophes():
    q = {"type": "dictation", "correct_answer": "Il faut qu’il parte à l’aube."}
    assert score_answer(q, "Il faut qu'il parte à l'aube") == 100


def test_order_partial_credit():
    q = {"type": "order", "correct_answer": ["A", "B", "C", "D"]}
    assert score_answer(q, ["A", "B", "C", "D"]) == 100
    assert score_answer(q, ["D", "C", "B", "A"]) == 0
    assert score_answer(q, ["B", "A", "C", "D"]) == 83  # 5 paires sur 6
    assert score_answer(q, ["A", "B", "C"]) == 0  # incomplet
    assert score_answer(q, ["A", "B", "C", "X"]) == 0


def test_size_is_log_scored():
    q = {"type": "size", "correct_answer": 3.4, "numeric_config": None}
    assert score_answer(q, 3.4) == 100
    assert score_answer(q, 6.8) == 0  # facteur 2 par défaut
    assert 40 < score_answer(q, 2.4) < 60


def test_timeout_scores_zero():
    assert score_answer({"type": "binary", "correct_answer": True}, None) == 0


def test_mcq_is_accent_sensitive():
    q = {"type": "mcq", "correct_answer": "Hypothèse", "choices": ["Hypothèse", "Hypothése", "Hypotèse", "Hipothèse"]}
    assert score_answer(q, "Hypothèse") == 100
    assert score_answer(q, "hypothèse") == 100
    assert score_answer(q, "Hypothése") == 0


def test_percent_scored_in_points_not_proportion():
    q = {"type": "percent", "correct_answer": 10}
    assert score_answer(q, 10) == 100
    assert score_answer(q, 11) == 100  # à 1 point près
    assert score_answer(q, 20) == 50  # 10 points d'écart sur 20
    assert score_answer(q, 35) == 0
    assert score_answer(q, 120) == 0
    assert score_answer({**q, "numeric_config": {"tolerance": 40}}, 30) == 50


def test_recall_ordered_and_unordered():
    digits = list("7294183")
    ordered = {"type": "recall", "correct_answer": digits, "recall_ordered": True}
    assert score_answer(ordered, "7294183") == 100
    assert score_answer(ordered, "7 2 9 4 1 8 3") == 100
    assert score_answer(ordered, digits) == 100
    assert score_answer(ordered, "7294138") == 71  # deux chiffres inversés : 2 erreurs sur 7
    assert score_answer(ordered, "") == 0
    words = {"type": "recall", "correct_answer": ["Citron", "Vélo", "Tortue", "Cactus"], "recall_ordered": False}
    assert score_answer(words, "cactus, tortue, velo, citron") == 100
    assert score_answer(words, ["tortue", "cactus"]) == 50
    assert score_answer(words, ["tortue", "cactus", "chien", "chat"]) == 25  # inventer coûte des points


def test_riddle_costs_points_per_clue_and_ignores_articles():
    q = {"type": "riddle", "correct_answer": "koala", "accepted_aliases": ["koalas"]}
    assert score_answer(q, "Koala", clues_seen=1) == 100
    assert score_answer(q, "le koala", clues_seen=2) == 75
    assert score_answer(q, "un koala", clues_seen=3) == 50
    assert score_answer(q, "koalas", clues_seen=4) == 30
    assert score_answer(q, "panda", clues_seen=1) == 0
    country = {"type": "riddle", "correct_answer": "Islande", "accepted_aliases": []}
    assert score_answer(country, "l'Islande") == 100
    assert score_answer({"type": "riddle", "correct_answer": "Marie Curie"}, "marie curie") == 100
