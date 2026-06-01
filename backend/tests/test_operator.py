"""Tests for /operator endpoints: inbox, open, release, action."""
import pytest

from app.models.solicitud import EstadoEnum
from app.models.usuario import RolEnum
from tests.conftest import (
    auth_headers,
    make_pending_request,
    make_request_type,
    make_user,
)


def _operator_headers(client, db, email="op@test.com"):
    make_user(db, national_id="V-11111111", email=email, role=RolEnum.operator)
    return auth_headers(client, email=email)


# ── GET /operator/inbox ───────────────────────────────────────────────────────

def test_inbox_empty(client, db):
    headers = _operator_headers(client, db)
    r = client.get("/operator/inbox", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


def test_inbox_shows_pending_requests(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    r = client.get("/operator/inbox", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["status"] == "pending"


def test_inbox_filter_by_status(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    r = client.get("/operator/inbox?status=in_progress", headers=headers)
    assert r.json() == []

    r = client.get("/operator/inbox?status=pending", headers=headers)
    assert len(r.json()) == 1


def test_inbox_student_cannot_access(client, db):
    make_user(db)
    r = client.get("/operator/inbox", headers=auth_headers(client))
    assert r.status_code == 403


# ── POST /operator/requests/{id}/open ────────────────────────────────────────

def test_open_request_changes_status(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    r = client.post(f"/operator/requests/{req.id}/open", headers=headers)
    assert r.status_code == 200

    # Verify in inbox it now shows in_progress
    inbox = client.get("/operator/inbox", headers=headers).json()
    assert inbox[0]["status"] == "in_progress"


def test_open_request_conflict_different_operator(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)

    make_user(db, national_id="V-11111111", email="op1@test.com", role=RolEnum.operator)
    make_user(db, national_id="V-22222222", email="op2@test.com", role=RolEnum.operator)
    op1_headers = auth_headers(client, email="op1@test.com")
    op2_headers = auth_headers(client, email="op2@test.com")

    client.post(f"/operator/requests/{req.id}/open", headers=op1_headers)

    r = client.post(f"/operator/requests/{req.id}/open", headers=op2_headers)
    assert r.status_code == 409


def test_open_request_not_found(client, db):
    headers = _operator_headers(client, db)
    r = client.post("/operator/requests/9999/open", headers=headers)
    assert r.status_code == 404


# ── POST /operator/requests/{id}/release ─────────────────────────────────────

def test_release_returns_to_pending(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    client.post(f"/operator/requests/{req.id}/open", headers=headers)
    r = client.post(f"/operator/requests/{req.id}/release", headers=headers)
    assert r.status_code == 200

    inbox = client.get("/operator/inbox", headers=headers).json()
    assert inbox[0]["status"] == "pending"


def test_release_already_pending_is_noop(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    r = client.post(f"/operator/requests/{req.id}/release", headers=headers)
    assert r.status_code == 200


# ── POST /operator/requests/{id}/action ──────────────────────────────────────

def test_action_approve(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    client.post(f"/operator/requests/{req.id}/open", headers=headers)
    r = client.post(f"/operator/requests/{req.id}/action", json={
        "action": "approve",
        "comment": None,
        "is_internal": False,
    }, headers=headers)
    assert r.status_code == 200

    # Should no longer appear in inbox
    inbox = client.get("/operator/inbox", headers=headers).json()
    assert len(inbox) == 0


def test_action_reject_requires_comment(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    client.post(f"/operator/requests/{req.id}/open", headers=headers)
    r = client.post(f"/operator/requests/{req.id}/action", json={
        "action": "reject",
        "comment": None,
        "is_internal": False,
    }, headers=headers)
    assert r.status_code == 400


def test_action_reject_with_comment(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    client.post(f"/operator/requests/{req.id}/open", headers=headers)
    r = client.post(f"/operator/requests/{req.id}/action", json={
        "action": "reject",
        "comment": "Missing documentation",
        "is_internal": False,
    }, headers=headers)
    assert r.status_code == 200


def test_action_escalate(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    client.post(f"/operator/requests/{req.id}/open", headers=headers)
    r = client.post(f"/operator/requests/{req.id}/action", json={
        "action": "escalate",
        "comment": "Needs coordinator review",
        "is_internal": False,
    }, headers=headers)
    assert r.status_code == 200


def test_action_internal_comment_does_not_close_request(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    client.post(f"/operator/requests/{req.id}/open", headers=headers)
    r = client.post(f"/operator/requests/{req.id}/action", json={
        "action": "comment",
        "comment": "Contacted student by phone",
        "is_internal": True,
    }, headers=headers)
    assert r.status_code == 200

    # Request still in inbox
    inbox = client.get("/operator/inbox", headers=headers).json()
    assert len(inbox) == 1


def test_action_unknown_action(client, db):
    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    r = client.post(f"/operator/requests/{req.id}/action", json={
        "action": "invalid_action",
        "comment": "test",
        "is_internal": False,
    }, headers=headers)
    assert r.status_code == 400


# ── GET /operator/requests/{id} ───────────────────────────────────────────────

def test_get_full_request_includes_internal_history(client, db):
    from app.models.solicitud import HistorialEstado

    student = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    headers = _operator_headers(client, db)

    db.add(HistorialEstado(
        request_id=req.id,
        previous_status="pending",
        new_status="pending",
        comment="Internal note",
        is_internal=True,
    ))
    db.commit()

    r = client.get(f"/operator/requests/{req.id}", headers=headers)
    assert r.status_code == 200
    history = r.json()["history"]
    internal = [h for h in history if h["is_internal"]]
    assert len(internal) == 1
    assert internal[0]["comment"] == "Internal note"
