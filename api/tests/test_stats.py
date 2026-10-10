from cervo.stats import apply_answer, apply_completion, displayed_streak, empty_stats, profile_summary, recompute

Q = {"id": "q1", "category": "logique", "type": "short_text"}
QN = {"id": "q2", "category": "estimation", "type": "numeric"}


def attempt(day, score, answers=None):
    return {"date": day, "score_total": score, "completed_at": "x", "answers": answers or []}


def test_apply_answer_buckets():
    s = apply_answer(empty_stats(), Q, 100)
    s = apply_answer(s, Q, 0)
    assert s["category_stats"]["logique"] == {"sum": 100, "count": 2, "correct": 1}
    assert s["pillar_stats"]["raisonnement"]["count"] == 2
    assert s["type_stats"]["short_text"]["correct"] == 1


def test_streaks():
    s = empty_stats()
    s = apply_completion(s, "2026-10-01", 50)
    s = apply_completion(s, "2026-10-02", 70)
    s = apply_completion(s, "2026-10-03", 90)
    assert s["current_streak"] == 3 and s["best_streak"] == 3
    s = apply_completion(s, "2026-10-05", 40)
    assert s["current_streak"] == 1 and s["best_streak"] == 3
    assert s["days_played"] == 4 and s["score_sum"] == 250


def test_completion_idempotent_same_day():
    s = apply_completion(empty_stats(), "2026-10-01", 50)
    assert apply_completion(s, "2026-10-01", 50) == s


def test_displayed_streak_resets_after_missed_day():
    s = apply_completion(empty_stats(), "2026-10-01", 50)
    assert displayed_streak(s, "2026-10-01") == 1
    assert displayed_streak(s, "2026-10-02") == 1
    assert displayed_streak(s, "2026-10-03") == 0


def test_recompute_matches_incremental():
    answers = [
        {"question_id": "q1", "score": 100, "category": "logique"},
        {"question_id": "q2", "score": 40, "category": "estimation"},
    ]
    attempts = [attempt("2026-10-02", 70, answers), attempt("2026-10-01", 50, answers)]
    s = recompute(attempts, {"q1": Q, "q2": QN})
    assert s["days_played"] == 2 and s["current_streak"] == 2
    assert s["category_stats"]["estimation"]["sum"] == 80


def test_profile_summary():
    answers_old = [{"question_id": "q1", "score": 0, "category": "logique"}]
    answers_new = [{"question_id": "q1", "score": 100, "category": "logique"}]
    attempts = [attempt("2026-09-20", 30, answers_old), attempt("2026-10-09", 90, answers_new)]
    s = recompute(attempts, {"q1": Q})
    p = profile_summary(s, attempts, "2026-10-10")
    assert p["days_played"] == 2
    assert p["average"] == 60
    assert p["best_day"] == {"date": "2026-10-09", "score": 90}
    assert p["worst_day"]["score"] == 30
    assert len(p["last_30_days"]) == 30 and p["last_30_days"][-1]["date"] == "2026-10-10"
    assert p["current_streak"] == 1
    raisonnement = next(x for x in p["pillars"] if x["pillar"] == "raisonnement")
    assert raisonnement["trend"] == 100
    assert p["correct_rate"] == 50


def test_profile_summary_empty():
    p = profile_summary(empty_stats(), [], "2026-10-10")
    assert p["days_played"] == 0 and p["average"] is None and p["best_day"] is None
