from collections import Counter
from datetime import UTC, datetime

import pytest

from cervo.domain.catalog import CATEGORIES, THINKING_PILLARS, pillar_of
from cervo.domain.daily import build_daily_quiz, candidate_pool, stable_choices, today_str


def make_bank(n_per_cat=12):
    bank = []
    types = ["binary", "mcq", "numeric", "short_text"]
    for c_index, cat in enumerate(CATEGORIES):
        for i in range(n_per_cat):
            bank.append(
                {
                    "id": f"{cat}-{i:03d}",
                    "category": cat,
                    "type": types[(i + c_index) % 4],
                    "difficulty": [1, 2, 2, 3, 3][i % 5],
                    "images": [{"url": "/questions/x.svg", "alt": "x"}] if i % 7 == 0 else [],
                    "status": "published",
                }
            )
    return bank


def check_constraints(ids, bank):
    by_id = {q["id"]: q for q in bank}
    qs = [by_id[i] for i in ids]
    assert len(ids) == 10 and len(set(ids)) == 10
    cats = Counter(q["category"] for q in qs)
    assert len(cats) >= 5
    assert max(cats.values()) <= 3
    assert sum(q["type"] == "numeric" for q in qs) >= 2
    assert sum(bool(q.get("images")) for q in qs) >= 1
    assert Counter(q["difficulty"] for q in qs) == {1: 2, 2: 4, 3: 4}
    assert sum(pillar_of(q["category"]) in THINKING_PILLARS for q in qs) >= 4


def test_same_date_same_quiz():
    bank = make_bank()
    assert build_daily_quiz("2026-10-10", bank) == build_daily_quiz("2026-10-10", list(reversed(bank)))


def test_different_dates_differ():
    bank = make_bank()
    assert build_daily_quiz("2026-10-10", bank) != build_daily_quiz("2026-10-11", bank)


@pytest.mark.parametrize("day", ["2026-01-01", "2026-10-10", "2027-02-28", "2030-12-31"])
def test_constraints_respected(day):
    bank = make_bank()
    check_constraints(build_daily_quiz(day, bank), bank)


def test_sorted_by_difficulty():
    bank = make_bank()
    by_id = {q["id"]: q for q in bank}
    diffs = [by_id[i]["difficulty"] for i in build_daily_quiz("2026-10-10", bank)]
    assert diffs == sorted(diffs)


def test_only_published_questions():
    bank = make_bank()
    for q in bank[::2]:
        q["status"] = "draft"
    ids = build_daily_quiz("2026-10-10", bank)
    assert all(q["status"] == "published" for q in bank if q["id"] in ids)


def test_no_repeat_until_bank_exhausted():
    bank = make_bank()  # 12 par catégorie
    history: list[list[str]] = []
    seen: set[str] = set()
    for day in range(1, 10):
        ids = build_daily_quiz(f"2026-03-{day:02d}", bank, history)
        assert not seen & set(ids)
        seen |= set(ids)
        history.insert(0, ids)


def test_history_ignored_when_pool_too_small():
    bank = make_bank(n_per_cat=5)  # 5 par catégorie
    history = [[q["id"] for q in bank[:30]]]
    assert len(candidate_pool(bank, history)) == len(bank)  # exclure 30 laisserait moins de 40
    assert len(build_daily_quiz("2026-03-01", bank, history)) == 10


def test_relaxation_with_tiny_bank():
    bank = [{"id": f"q{i}", "category": "culture", "type": "mcq", "difficulty": 1, "images": [], "status": "published"} for i in range(10)]
    assert sorted(build_daily_quiz("2026-10-10", bank)) == sorted(q["id"] for q in bank)


def test_bank_too_small_raises():
    with pytest.raises(ValueError):
        build_daily_quiz("2026-10-10", make_bank()[:5])


def test_stable_choices():
    choices = ["A", "B", "C", "D"]
    assert stable_choices("q1", choices) == stable_choices("q1", choices)
    assert sorted(stable_choices("q1", choices)) == choices


def test_today_in_paris_changes_at_midnight_paris():
    # 22:30 UTC le 10 octobre = 00:30 à Paris le 11 (heure d'été)
    assert today_str("Europe/Paris", datetime(2026, 10, 10, 22, 30, tzinfo=UTC)) == "2026-10-11"
    assert today_str("Europe/Paris", datetime(2026, 10, 10, 21, 30, tzinfo=UTC)) == "2026-10-10"


def test_real_bank_respects_constraints_for_a_month():
    from cervo.services.bank import load_files

    bank = [{k: v for k, v in q.items() if not k.startswith("_")} for q in load_files()]
    history: list[list[str]] = []
    for day in range(1, 31):
        ids = build_daily_quiz(f"2026-11-{day:02d}", bank, history)
        check_constraints(ids, bank)
        assert not set(ids) & {i for d in history for i in d}
        history.insert(0, ids)


def test_special_types_are_capped():
    bank = make_bank()
    for q in bank[::2]:
        q["type"] = "dictation"
    for day in range(1, 8):
        ids = build_daily_quiz(f"2026-05-{day:02d}", bank)
        by_id = {q["id"]: q for q in bank}
        assert sum(by_id[i]["type"] == "dictation" for i in ids) <= 1
