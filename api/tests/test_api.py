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
    req = urllib.request.Request(url, data=json.dumps(payload or {}).encode(), method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        body = res.read()
        return json.loads(body) if body else {}


def anon_token():
    data = _post(f"{AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {"returnSecureToken": True})
    return data["idToken"]


def custom_to_id(custom):
    data = _post(f"{AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo",
                 {"token": custom, "returnSecureToken": True})
    return data["idToken"]


@pytest.fixture(scope="module")
def client():
    _post(f"{FS}/emulator/v1/projects/{PROJECT}/databases/(default)/documents", method="DELETE")
    from fastapi.testclient import TestClient

    from cervo import questions
    from cervo.main import app
    from cervo.tools.seed import seed

    questions.invalidate_cache()
    assert seed() >= 120
    return TestClient(app)


def h(token):
    return {"Authorization": f"Bearer {token}"}


def answer_for(q):
    return {"binary": True, "mcq": (q["choices"] or [""])[0], "numeric": 100, "short_text": "abc"}[q["type"]]


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
    skip = client.post("/api/answer", headers=h(token), json={"date": today["date"], "question_id": today["questions"][1]["id"], "answer": True})
    assert skip.status_code == 409

    for q in today["questions"]:
        res = client.post("/api/answer", headers=h(token), json={"date": today["date"], "question_id": q["id"], "answer": answer_for(q)})
        assert res.status_code == 200, res.text
        body = res.json()
        assert 0 <= body["score"] <= 100 and "correct_answer" in body
    assert body["completed"] and body["score_total"] is not None

    # Pas de deuxième participation
    again = client.post("/api/answer", headers=h(token), json={"date": today["date"], "question_id": today["questions"][0]["id"], "answer": True})
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
    assert len(listing) >= 120
    new_q = {
        "type": "binary", "category": "vrai_faux", "difficulty": 1, "prompt": "Le test d'import fonctionne.",
        "correct_answer": True, "explanation": "Question créée par les tests automatiques.", "status": "draft",
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
