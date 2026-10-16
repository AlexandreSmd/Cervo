from cervo.domain.leaderboard import leaderboard_view, month_of, standings

TODAY = "2026-10-16"


def entry(name, total, days, last_day, last_score):
    return {"username": name, "total": total, "days": days, "last_day": last_day, "last_score": last_score}


def test_month_of():
    assert month_of(TODAY) == "2026-10"


def test_ties_share_rank_and_today_changes_ranks():
    rows = standings(
        {
            "a": entry("Ana", 300, 4, TODAY, 90),  # 210 avant aujourd'hui : 3e, puis 1re
            "b": entry("Bob", 250, 3, "2026-10-15", 80),
            "c": entry("Cid", 250, 3, "2026-10-14", 80),
            "d": entry("Dan", 70, 1, TODAY, 70),  # premier quiz du mois : pas de rang avant
        },
        TODAY,
    )
    by_name = {r["username"]: r for r in rows}
    assert [r["username"] for r in rows] == ["Ana", "Bob", "Cid", "Dan"]
    assert by_name["Ana"]["rank"] == 1
    assert (by_name["Ana"]["previous_rank"], by_name["Ana"]["change"]) == (3, 2)
    assert by_name["Bob"]["rank"] == by_name["Cid"]["rank"] == 2
    assert by_name["Bob"]["change"] == -1
    assert by_name["Dan"]["rank"] == 4 and by_name["Dan"]["change"] is None


def test_my_row_is_shown_outside_the_top_and_uids_stay_private():
    entries = {f"u{i}": entry(f"J{i:02d}", 1000 - i, 5, "2026-10-15", 80) for i in range(10)}
    view = leaderboard_view(entries, "u9", TODAY, top=3)
    assert view["players"] == 10 and len(view["rows"]) == 3
    assert view["me"]["rank"] == 10 and view["me"]["is_me"]
    assert all("uid" not in r for r in view["rows"]) and "uid" not in view["me"]
    assert leaderboard_view({}, "x", TODAY)["me"] is None
