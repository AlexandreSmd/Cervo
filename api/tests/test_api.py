"""Tests d'intégration de l'API avec les émulateurs Firebase (ignorés s'ils ne tournent pas)."""

import json
import os
import urllib.request

import pytest

PROJECT = os.environ["FIRESTORE_PROJECT_ID"]
FS = f"http://{os.environ['FIRESTORE_EMULATOR_HOST']}"
AUTH = f"http://{os.environ['FIREBASE_AUTH_EMULATOR_HOST']}"


def _up(url):
    try:
        urllib.request.urlopen(url, timeout=1)
        return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not (_up(FS) and _up(AUTH)), reason="émulateurs Firebase absents")


def _post(url, payload=None, method="POST"):
    req = urllib.request.Request(url, data=json.dumps(payload or {}).encode(), method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        body = res.read()
        return json.loads(body) if body else {}


def anon_token():
    data = _post(f"{AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {"returnSecureToken": True})
    return data["idToken"]


def custom_to_id(custom):
    data = _post(
        f"{AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo", {"token": custom, "returnSecureToken": True}
    )
    return data["idToken"]


@pytest.fixture(scope="module")
def client():
    _post(f"{FS}/emulator/v1/projects/{PROJECT}/databases/(default)/documents", method="DELETE")
    from fastapi.testclient import TestClient

    from cervo.main import app
    from cervo.services import bank, quiz
    from cervo.tools.seed import seed

    bank.invalidate_cache()
    quiz.invalidate_cache()
    assert seed() >= 30
    return TestClient(app)


def h(token):
    return {"Authorization": f"Bearer {token}"}


def answer_for(q):
    return {
        "binary": True,
        "mcq": (q["choices"] or [""])[0],
        "numeric": 100,
        "short_text": "abc",
        "order": q.get("items"),
        "size": 2,
        "dictation": "une phrase dictée",
        "recall": "1234",
        "percent": 50,
        "riddle": "je ne sais pas",
    }[q["type"]]


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_auth_required(client):
    assert client.get("/api/today").status_code == 401
    assert client.get("/api/today", headers=h("nimportequoi")).status_code == 401


def test_full_day_flow(client):
    token = anon_token()
    today = client.get("/api/today", headers=h(token)).json()
    assert len(today["questions"]) == 10
    raw = json.dumps(today["questions"])
    assert "correct_answer" not in raw and "explanation" not in raw

    # Deux visiteurs voient les mêmes questions
    other = client.get("/api/today", headers=h(anon_token())).json()
    assert [q["id"] for q in other["questions"]] == [q["id"] for q in today["questions"]]

    # On ne peut pas sauter une question
    skip = client.post(
        "/api/answer", headers=h(token), json={"date": today["date"], "question_id": today["questions"][1]["id"], "answer": True}
    )
    assert skip.status_code == 409

    for q in today["questions"]:
        res = client.post("/api/answer", headers=h(token), json={"date": today["date"], "question_id": q["id"], "answer": answer_for(q)})
        assert res.status_code == 200, res.text
        body = res.json()
        assert 0 <= body["score"] <= 100 and "correct_answer" in body
    assert body["completed"] and body["score_total"] is not None

    # Pas de deuxième participation
    again = client.post(
        "/api/answer", headers=h(token), json={"date": today["date"], "question_id": today["questions"][0]["id"], "answer": True}
    )
    assert again.status_code == 409

    # Reprise : l'état est conservé côté serveur
    state = client.get("/api/today", headers=h(token)).json()
    assert state["completed"] and len(state["answers"]) == 10 and state["streak"] == 1

    results = client.get(f"/api/results/{today['date']}", headers=h(token)).json()
    assert len(results["items"]) == 10 and results["score_total"] == body["score_total"]

    profile = client.get("/api/profile", headers=h(token)).json()
    assert profile["days_played"] == 1 and profile["is_anonymous"] is True
    days = client.get("/api/profile/days", headers=h(token)).json()["days"]
    assert days[0]["date"] == today["date"] and len(days[0]["answers"]) == 10


def test_answer_creates_profile(client):
    """Répondre sans être passé par /today crée quand même un profil complet (même transaction)."""
    token = anon_token()
    q = client.get("/api/today", headers=h(anon_token())).json()["questions"][0]
    day = client.get("/api/health").json()["today"]
    res = client.post("/api/answer", headers=h(token), json={"date": day, "question_id": q["id"], "answer": answer_for(q)})
    assert res.status_code == 200, res.text
    profile = client.get("/api/profile", headers=h(token)).json()
    assert profile["username"].startswith("Vif-") and profile["is_anonymous"] is True
    state = client.get("/api/today", headers=h(token)).json()
    assert len(state["answers"]) == 1


def test_wrong_date_rejected(client):
    token = anon_token()
    q = client.get("/api/today", headers=h(token)).json()["questions"][0]
    res = client.post("/api/answer", headers=h(token), json={"date": "2000-01-01", "question_id": q["id"], "answer": True})
    assert res.status_code == 409


def test_username_unique(client):
    a, b = anon_token(), anon_token()
    assert client.patch("/api/profile", headers=h(a), json={"username": "Neurone"}).status_code == 200
    assert client.patch("/api/profile", headers=h(b), json={"username": "neurone"}).status_code == 409
    assert client.get("/api/profile", headers=h(a)).json()["username"] == "Neurone"


def test_report(client):
    token = anon_token()
    q = client.get("/api/today", headers=h(token)).json()["questions"][0]
    assert client.post("/api/report", headers=h(token), json={"question_id": q["id"], "reason": "Réponse douteuse"}).status_code == 200


def test_admin(client):
    anon = anon_token()
    assert client.get("/api/admin/questions", headers=h(anon)).status_code == 403
    admin = custom_to_id(client.post("/api/dev/login", json={"role": "admin"}).json()["token"])
    listing = client.get("/api/admin/questions", headers=h(admin)).json()["questions"]
    assert len(listing) >= 30
    new_q = {
        "type": "binary",
        "category": "fait",
        "difficulty": 1,
        "prompt": "Le test d'import fonctionne.",
        "correct_answer": True,
        "explanation": "Question créée par les tests automatiques.",
        "status": "draft",
    }
    res = client.post("/api/admin/questions/import", headers=h(admin), json={"questions": [new_q, {"type": "mcq"}]}).json()
    assert len(res["created"]) == 1 and len(res["errors"]) == 1
    qid = res["created"][0]
    assert client.patch(f"/api/admin/questions/{qid}", headers=h(admin), json={"status": "published"}).json()["status"] == "published"


def test_dev_tools_and_delete(client):
    demo = custom_to_id(client.post("/api/dev/login", json={"role": "demo"}).json()["token"])
    created = client.post("/api/dev/seed-history", headers=h(demo)).json()["created"]
    assert created >= 10
    profile = client.get("/api/profile", headers=h(demo)).json()
    assert profile["days_played"] == created and profile["email"] == "demo@cervo.test"
    assert client.delete("/api/account", headers=h(demo)).status_code == 200


def admin_token(client):
    return custom_to_id(client.post("/api/dev/login", json={"role": "admin"}).json()["token"])


def test_schedule_fill_edit_and_lock(client):
    from cervo.domain.catalog import DAILY_ORDER

    admin = admin_token(client)
    client.post("/api/admin/schedule/fill", headers=h(admin), json={"days": 10})
    sched = client.get("/api/admin/schedule?days=10", headers=h(admin)).json()
    assert all(d["planned"] for d in sched["days"])
    future = sched["days"][3]
    assert len(future["questions"]) == 10 and not future["locked"]
    # Chaque jour : une question de chaque type, dans l'ordre du quiz
    for day in sched["days"]:
        assert [q["category"] for q in day["questions"]] == list(DAILY_ORDER)
    # Trois jours de suite n'ont aucune question en commun (3 questions par type)
    window = [q["id"] for d in sched["days"][1:4] for q in d["questions"]]
    assert len(window) == len(set(window))

    # L'ordre est imposé par les types : une liste mélangée est rangée par le serveur
    ids = [q["id"] for q in future["questions"]]
    res = client.put(f"/api/admin/schedule/{future['date']}", headers=h(admin), json={"question_ids": list(reversed(ids))})
    assert res.status_code == 200 and res.json()["question_ids"] == ids
    # Remplacer la question d'un type par une autre du même type
    other = next(q["id"] for d in sched["days"] for q in d["questions"] if q["category"] == "taille" and q["id"] not in ids)
    swapped = [other if q["category"] == "taille" else q["id"] for q in future["questions"]]
    assert client.put(f"/api/admin/schedule/{future['date']}", headers=h(admin), json={"question_ids": swapped}).status_code == 200
    # Refus : doublon, type manquant
    assert (
        client.put(f"/api/admin/schedule/{future['date']}", headers=h(admin), json={"question_ids": [*ids[:9], ids[0]]}).status_code == 400
    )
    assert client.put(f"/api/admin/schedule/{future['date']}", headers=h(admin), json={"question_ids": ids[:9]}).status_code == 400

    # Régénérer et vider
    assert len(client.post(f"/api/admin/schedule/{future['date']}/regenerate", headers=h(admin)).json()["question_ids"]) == 10
    assert client.delete(f"/api/admin/schedule/{future['date']}", headers=h(admin)).status_code == 200

    # Aujourd'hui a déjà des joueurs (test_full_day_flow) : verrouillé
    today_day = sched["days"][0]
    assert today_day["is_today"] and today_day["locked"]
    assert client.post(f"/api/admin/schedule/{today_day['date']}/regenerate", headers=h(admin)).status_code == 409
    # Un jour passé est verrouillé
    assert client.put("/api/admin/schedule/2020-01-01", headers=h(admin), json={"question_ids": ids}).status_code == 409


def test_planned_quiz_is_served_to_players(client):
    admin = admin_token(client)
    sched = client.get("/api/admin/schedule?days=1", headers=h(admin)).json()["days"][0]
    player = client.get("/api/today", headers=h(anon_token())).json()
    assert [q["id"] for q in player["questions"]] == [q["id"] for q in sched["questions"]]


def test_overview_counts_answers(client):
    admin = admin_token(client)
    data = client.get("/api/admin/overview", headers=h(admin)).json()
    assert data["kpis"]["players_today"] >= 1
    assert data["today"]["completed"] >= 1
    assert len(data["today"]["questions"]) == 10
    assert data["today"]["questions"][0]["answers"] >= 1
    assert sum(data["today"]["distribution"]) == data["today"]["completed"]
    assert len(data["series"]) == 30


def test_media_upload_and_question_update(client):
    import base64

    admin = admin_token(client)
    svg = base64.b64encode(b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').decode()
    url = client.post("/api/admin/media", headers=h(admin), json={"data_url": f"data:image/svg+xml;base64,{svg}"}).json()["url"]
    res = client.get(url)
    assert res.status_code == 200 and res.headers["content-type"].startswith("image/svg")
    assert client.post("/api/admin/media", headers=h(admin), json={"data_url": "data:text/plain;base64,aGVsbG8="}).status_code == 400

    q = {
        "type": "short_text",
        "category": "enigme",
        "difficulty": 2,
        "prompt": "Qui est sur cette photo ?",
        "images": [{"url": url, "alt": "Portrait"}],
        "correct_answer": "Marie Curie",
        "accepted_aliases": ["Curie"],
        "explanation": "Physicienne et chimiste, double prix Nobel.",
        "status": "draft",
    }
    qid = client.post("/api/admin/questions/import", headers=h(admin), json={"questions": [q]}).json()["created"][0]
    updated = {**q, "difficulty": 3, "images": [{"url": url, "alt": "A"}, {"url": url, "alt": "B"}]}
    assert client.put(f"/api/admin/questions/{qid}", headers=h(admin), json=updated).status_code == 200
    listing = {x["id"]: x for x in client.get("/api/admin/questions", headers=h(admin)).json()["questions"]}
    assert listing[qid]["difficulty"] == 3 and listing[qid]["input_format"] == "images2"
    assert (
        client.put(f"/api/admin/questions/{qid}", headers=h(admin), json={**q, "images": [{"url": url, "alt": "x"}] * 3}).status_code == 422
    )


def test_timer_started_once_and_late_answer_scores_zero(client, monkeypatch):
    from cervo.services import play

    token = anon_token()
    today_data = client.get("/api/today", headers=h(token)).json()
    q = today_data["questions"][0]
    first = client.post("/api/question-start", headers=h(token), json={"date": today_data["date"], "question_id": q["id"]}).json()
    again = client.post("/api/question-start", headers=h(token), json={"date": today_data["date"], "question_id": q["id"]}).json()
    assert first["started_at"] == again["started_at"]  # recharger ne relance pas le chrono
    assert client.get("/api/today", headers=h(token)).json()["current"]["started_at"] == first["started_at"]
    # On simule une réponse arrivée bien après la fin du chrono
    monkeypatch.setattr(play, "seconds_since", lambda _: 999)
    res = client.post("/api/answer", headers=h(token), json={"date": today_data["date"], "question_id": q["id"], "answer": True}).json()
    assert res["timed_out"] is True and res["score"] == 0


def test_timeout_without_answer(client):
    token = anon_token()
    data = client.get("/api/today", headers=h(token)).json()
    res = client.post(
        "/api/answer", headers=h(token), json={"date": data["date"], "question_id": data["questions"][0]["id"], "answer": None}
    ).json()
    assert res["timed_out"] and res["score"] == 0


def _answer_until(client, token, data, position):
    """Répond (n'importe quoi) aux questions jusqu'à `position` exclue."""
    for q in data["questions"][:position]:
        res = client.post("/api/answer", headers=h(token), json={"date": data["date"], "question_id": q["id"], "answer": answer_for(q)})
        assert res.status_code == 200, res.text


def test_riddle_clues_cost_points(client):
    from cervo.firebase import db
    from cervo.services import bank

    token = anon_token()
    data = client.get("/api/today", headers=h(token)).json()
    position = next(i for i, q in enumerate(data["questions"]) if q["type"] == "riddle")
    riddle = data["questions"][position]
    assert len(riddle["clues"]) == 1 and riddle["clue_total"] >= 3
    _answer_until(client, token, data, position)

    body = {"date": data["date"], "question_id": riddle["id"]}
    assert client.post("/api/clue", headers=h(token), json=body).status_code == 409  # chrono pas lancé
    client.post("/api/question-start", headers=h(token), json=body)
    assert len(client.post("/api/clue", headers=h(token), json=body).json()["clues"]) == 2
    assert len(client.post("/api/clue", headers=h(token), json=body).json()["clues"]) == 3
    # Recharger la page garde les indices déjà vus
    again = client.get("/api/today", headers=h(token)).json()["questions"][position]
    assert len(again["clues"]) == 3

    truth = bank.by_id(db())[riddle["id"]]["correct_answer"]
    res = client.post("/api/answer", headers=h(token), json={**body, "answer": truth}).json()
    assert res["score"] == 50 and res["clues_seen"] == 3 and len(res["clues"]) == riddle["clue_total"]


def test_dictation_has_no_timer(client, monkeypatch):
    from cervo.services import play

    token = anon_token()
    data = client.get("/api/today", headers=h(token)).json()
    position = next(i for i, q in enumerate(data["questions"]) if q["type"] == "dictation")
    dictation = data["questions"][position]
    assert dictation["time_limit"] is None
    _answer_until(client, token, data, position)
    body = {"date": data["date"], "question_id": dictation["id"]}
    client.post("/api/question-start", headers=h(token), json=body)
    monkeypatch.setattr(play, "seconds_since", lambda _: 3600)  # une heure plus tard
    res = client.post("/api/answer", headers=h(token), json={**body, "answer": "Les enfants sont partis."}).json()
    assert res["timed_out"] is False and res["score"] > 0 and res["completed"]


def test_legacy_questions_are_retired_and_future_days_recomposed(client):
    from cervo.clock import today
    from cervo.firebase import db
    from cervo.services import bank
    from cervo.services import collections as col
    from cervo.tools.migrate import retire_legacy

    client_db = db()
    legacy = {"id": "histoire-old", "type": "binary", "category": "histoire", "difficulty": 1, "prompt": "Ancienne ?"}
    client_db.collection(col.QUESTIONS).document("histoire-old").set({**legacy, "correct_answer": True, "status": "published"})
    future = "2099-01-01"
    client_db.collection(col.DAILY_QUIZZES).document(future).set({"question_ids": ["histoire-old"]})
    bank.bump_version(client_db)

    retired, cleared = retire_legacy(client_db, today())
    assert retired >= 1 and cleared >= 1
    assert bank.by_id(client_db)["histoire-old"]["status"] == "retired"
    assert not client_db.collection(col.DAILY_QUIZZES).document(future).get().exists
    assert retire_legacy(client_db, today()) == (0, 0)  # idempotent
