from collections import Counter
from datetime import UTC, date, datetime, timedelta

import pytest

from cervo.domain.catalog import DAILY_ORDER
from cervo.domain.daily import build_daily_quiz, stable_choices, today_str


def make_bank(n_per_kind=6):
    """n questions par type, difficultés 1, 2, 3 en alternance."""
    return [
        {"id": f"{kind}-{i:03d}", "category": kind, "type": "mcq", "difficulty": 1 + i % 3, "status": "published"}
        for kind in DAILY_ORDER
        for i in range(n_per_kind)
    ]


def kinds_of(ids, bank):
    by_id = {q["id"]: q for q in bank}
    return [by_id[i]["category"] for i in ids]


def plan_days(bank, start="2026-03-01", days=30):
    planned: dict[str, list[str]] = {}
    first = date.fromisoformat(start)
    for offset in range(days):
        day = (first + timedelta(days=offset)).isoformat()
        planned[day] = build_daily_quiz(day, bank, planned)
    return planned


def test_one_question_of_each_kind_in_fixed_order():
    bank = make_bank()
    ids = build_daily_quiz("2026-10-10", bank)
    assert kinds_of(ids, bank) == list(DAILY_ORDER)
    assert len(set(ids)) == 10


def test_same_date_same_quiz_whatever_the_bank_order():
    bank = make_bank()
    assert build_daily_quiz("2026-10-10", bank) == build_daily_quiz("2026-10-10", list(reversed(bank)))


def test_different_dates_differ():
    bank = make_bank()
    assert build_daily_quiz("2026-10-10", bank) != build_daily_quiz("2026-10-11", bank)


def test_difficulty_balanced_when_possible():
    bank = make_bank(n_per_kind=9)
    for day, ids in plan_days(bank, days=3).items():
        by_id = {q["id"]: q for q in bank}
        counts = Counter(by_id[i]["difficulty"] for i in ids)
        assert counts == {1: 3, 2: 4, 3: 3}, day


def test_rotation_least_recently_used():
    """Avec 3 questions par type, chacune revient exactement tous les 3 jours."""
    bank = make_bank(n_per_kind=3)
    planned = plan_days(bank, days=9)
    days = sorted(planned)
    for i, day in enumerate(days[3:], start=3):
        assert planned[day] == planned[days[i - 3]]
    assert not set(planned[days[0]]) & set(planned[days[1]])


def test_no_repeat_until_bank_exhausted():
    bank = make_bank(n_per_kind=6)
    planned = plan_days(bank, days=6)
    all_ids = [i for ids in planned.values() for i in ids]
    assert len(all_ids) == len(set(all_ids)) == 60


def test_future_planned_days_are_avoided():
    bank = make_bank(n_per_kind=2)
    tomorrow = build_daily_quiz("2026-05-02", bank)
    today = build_daily_quiz("2026-05-01", bank, {"2026-05-02": tomorrow})
    assert not set(today) & set(tomorrow)


def test_only_published_and_current_kinds():
    bank = make_bank()
    for q in bank[::2]:
        q["status"] = "draft"
    bank.append({"id": "old-1", "category": "histoire", "type": "mcq", "difficulty": 1, "status": "published"})
    ids = build_daily_quiz("2026-10-10", bank)
    by_id = {q["id"]: q for q in bank}
    assert all(by_id[i]["status"] == "published" and by_id[i]["category"] in DAILY_ORDER for i in ids)


def test_empty_kind_is_replaced_by_another_question():
    bank = [q for q in make_bank() if q["category"] != "dictee"]
    ids = build_daily_quiz("2026-10-10", bank)
    assert len(ids) == len(set(ids)) == 10
    assert "dictee" not in kinds_of(ids, bank)


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


def test_real_bank_gives_a_full_quiz_every_day():
    from cervo.services.bank import load_files

    bank = [{k: v for k, v in q.items() if not k.startswith("_")} for q in load_files()]
    planned = plan_days(bank, days=30)
    for ids in planned.values():
        assert kinds_of(ids, bank) == list(DAILY_ORDER)
