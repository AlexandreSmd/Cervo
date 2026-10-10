"""Droits d'accès : seul un e-mail listé ET vérifié ouvre l'espace fondateur."""

from cervo.web.deps import is_admin


def test_admin_requires_listed_and_verified_email():
    assert is_admin({"email": "admin@cervo.test", "email_verified": True})
    assert is_admin({"email": "ADMIN@cervo.test", "email_verified": True})  # casse ignorée


def test_unverified_email_is_not_admin():
    assert not is_admin({"email": "admin@cervo.test", "email_verified": False})
    assert not is_admin({"email": "admin@cervo.test"})


def test_other_or_anonymous_users_are_not_admin():
    assert not is_admin({"email": "ami@exemple.fr", "email_verified": True})
    assert not is_admin({"firebase": {"sign_in_provider": "anonymous"}})


def test_dev_routes_are_hidden_outside_local(monkeypatch):
    import pytest
    from fastapi import HTTPException

    from cervo.web import deps

    class Prod:
        is_local = False

    monkeypatch.setattr(deps, "get_settings", lambda: Prod())
    with pytest.raises(HTTPException) as exc:
        deps.local_only()
    assert exc.value.status_code == 404
