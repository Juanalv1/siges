"""Tests for /auth endpoints: register, login, password recovery."""
from unittest.mock import patch

import pytest

from tests.conftest import auth_headers, make_questions, make_user, make_user_with_questions


# ── GET /auth/security-questions ─────────────────────────────────────────────

def test_get_security_questions_seeds_on_first_call(client):
    r = client.get("/auth/security-questions")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 5
    assert all("id" in q and "question" in q for q in data)


def test_get_security_questions_idempotent(client):
    client.get("/auth/security-questions")
    r = client.get("/auth/security-questions")
    assert len(r.json()) == 5


# ── POST /auth/register ───────────────────────────────────────────────────────

def _register_payload(client, national_id="V-12345678", email="student@test.com"):
    questions = client.get("/auth/security-questions").json()
    return {
        "national_id": national_id,
        "first_name": "Ana",
        "last_name": "Pérez",
        "email": email,
        "password": "securepass1",
        "security_questions": [
            {"question_id": questions[0]["id"], "answer": "Firulais"},
            {"question_id": questions[1]["id"], "answer": "Caracas"},
        ],
    }


def test_register_success(client):
    r = client.post("/auth/register", json=_register_payload(client))
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "student@test.com"
    assert "id" in body


def test_register_duplicate_national_id(client):
    payload = _register_payload(client)
    client.post("/auth/register", json=payload)
    r = client.post("/auth/register", json={**payload, "email": "other@test.com"})
    assert r.status_code == 400
    assert "national_id" in r.json()["detail"].lower() or "registered" in r.json()["detail"].lower()


def test_register_duplicate_email(client):
    payload = _register_payload(client)
    client.post("/auth/register", json=payload)
    r = client.post("/auth/register", json={**payload, "national_id": "V-99999999"})
    assert r.status_code == 400
    assert "email" in r.json()["detail"].lower() or "registered" in r.json()["detail"].lower()


def test_register_same_question_twice(client):
    questions = client.get("/auth/security-questions").json()
    payload = {
        "national_id": "V-12345678",
        "first_name": "Ana",
        "last_name": "Pérez",
        "email": "student@test.com",
        "password": "securepass1",
        "security_questions": [
            {"question_id": questions[0]["id"], "answer": "answer"},
            {"question_id": questions[0]["id"], "answer": "answer"},  # same question
        ],
    }
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 400


def test_register_sogac_invalid_national_id(client):
    with patch("app.routers.auth.verify_student", return_value=False):
        r = client.post("/auth/register", json=_register_payload(client))
    assert r.status_code == 400
    assert "national id" in r.json()["detail"].lower() or "not found" in r.json()["detail"].lower()


# ── POST /auth/login ──────────────────────────────────────────────────────────

def test_login_success(client, db):
    make_user(db)
    r = client.post("/auth/login", json={"email": "test@test.com", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert r.json()["token_type"] == "bearer"


def test_login_wrong_password(client, db):
    make_user(db)
    r = client.post("/auth/login", json={"email": "test@test.com", "password": "wrongpass"})
    assert r.status_code == 401


def test_login_nonexistent_email(client):
    r = client.post("/auth/login", json={"email": "nobody@test.com", "password": "pass"})
    assert r.status_code == 401


def test_login_inactive_user(client, db):
    make_user(db, active=False)
    r = client.post("/auth/login", json={"email": "test@test.com", "password": "password123"})
    assert r.status_code == 403


def test_login_jwt_contains_role(client, db):
    import base64, json as _json
    make_user(db)
    r = client.post("/auth/login", json={"email": "test@test.com", "password": "password123"})
    token = r.json()["access_token"]
    payload = _json.loads(base64.b64decode(token.split(".")[1] + "=="))
    assert payload["role"] == "student"
    assert payload["scope"] == "access"


# ── Password recovery flow ────────────────────────────────────────────────────

def test_recover_start_not_found(client):
    r = client.post("/auth/recover/start", json={"national_id": "V-00000000"})
    assert r.status_code == 404


def test_recover_full_flow(client, db):
    user, questions = make_user_with_questions(db)

    # Step 1: get questions
    r = client.post("/auth/recover/start", json={"national_id": user.national_id})
    assert r.status_code == 200
    returned_questions = r.json()["questions"]
    assert len(returned_questions) == 2

    # Step 2: verify answers
    r = client.post("/auth/recover/verify", json={
        "national_id": user.national_id,
        "answers": [
            {"question_id": q["question_id"], "answer": "test_answer"}
            for q in returned_questions
        ],
    })
    assert r.status_code == 200
    recovery_token = r.json()["recovery_token"]

    # Step 3: change password
    r = client.post(
        "/auth/recover/change-password",
        json={"new_password": "newpass456"},
        headers={"Authorization": f"Bearer {recovery_token}"},
    )
    assert r.status_code == 200

    # Verify new password works
    r = client.post("/auth/login", json={"email": user.email, "password": "newpass456"})
    assert r.status_code == 200


def test_recover_wrong_answers(client, db):
    user, questions = make_user_with_questions(db)
    client.post("/auth/recover/start", json={"national_id": user.national_id})
    r = client.post("/auth/recover/verify", json={
        "national_id": user.national_id,
        "answers": [
            {"question_id": questions[0].id, "answer": "WRONG"},
            {"question_id": questions[1].id, "answer": "WRONG"},
        ],
    })
    assert r.status_code == 400


def test_recover_change_password_requires_recovery_scope(client, db):
    make_user(db)
    access_token = client.post("/auth/login", json={
        "email": "test@test.com", "password": "password123"
    }).json()["access_token"]

    r = client.post(
        "/auth/recover/change-password",
        json={"new_password": "newpass456"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 401
