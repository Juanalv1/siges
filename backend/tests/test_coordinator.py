"""Tests for /coordinator endpoints: request types CRUD, escalated, users."""
import pytest

from app.models.solicitud import EstadoEnum
from app.models.usuario import RolEnum
from tests.conftest import (
    auth_headers,
    make_pending_request,
    make_request_type,
    make_user,
)


def _coord_headers(client, db, email="coord@test.com"):
    make_user(db, national_id="V-22222222", email=email, role=RolEnum.coordinator)
    return auth_headers(client, email=email)


def _escalated_request(db, client_fixture=None):
    """Helper: creates a student + request type + escalated request."""
    student = make_user(db, national_id="V-33333333", email="stu@test.com")
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)
    req.status = EstadoEnum.escalated
    db.commit()
    db.refresh(req)
    return req


# ── POST /coordinator/request-types ──────────────────────────────────────────

def test_create_request_type(client, db):
    headers = _coord_headers(client, db)
    r = client.post("/coordinator/request-types", json={
        "name": "Grade Freeze",
        "description": "Freeze grades for a period",
        "required_docs": ["Enrollment certificate"],
        "deadline_days": 10,
        "active": True,
        "requires_account": True,
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["name"] == "Grade Freeze"


def test_create_request_type_requires_coordinator(client, db):
    make_user(db, role=RolEnum.operator)
    headers = auth_headers(client)
    r = client.post("/coordinator/request-types", json={"name": "X"}, headers=headers)
    assert r.status_code == 403


# ── GET /coordinator/request-types ───────────────────────────────────────────

def test_list_request_types_includes_inactive(client, db):
    make_request_type(db, name="Active", active=True)
    make_request_type(db, name="Inactive", active=False)
    headers = _coord_headers(client, db)

    r = client.get("/coordinator/request-types", headers=headers)
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Active" in names
    assert "Inactive" in names


# ── PUT /coordinator/request-types/{id} ──────────────────────────────────────

def test_update_request_type(client, db):
    rt = make_request_type(db, name="Old Name")
    headers = _coord_headers(client, db)

    r = client.put(f"/coordinator/request-types/{rt.id}", json={
        "name": "New Name",
        "active": False,
    }, headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"
    assert r.json()["active"] is False


def test_update_request_type_not_found(client, db):
    headers = _coord_headers(client, db)
    r = client.put("/coordinator/request-types/9999", json={"name": "X"}, headers=headers)
    assert r.status_code == 404


# ── DELETE /coordinator/request-types/{id} ───────────────────────────────────

def test_delete_request_type(client, db):
    rt = make_request_type(db)
    headers = _coord_headers(client, db)

    r = client.delete(f"/coordinator/request-types/{rt.id}", headers=headers)
    assert r.status_code == 204

    r2 = client.get("/coordinator/request-types", headers=headers)
    assert r2.json() == []


# ── GET /coordinator/escalated-requests ──────────────────────────────────────

def test_escalated_requests_empty(client, db):
    headers = _coord_headers(client, db)
    r = client.get("/coordinator/escalated-requests", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


def test_escalated_requests_shows_escalated_only(client, db):
    _escalated_request(db)
    headers = _coord_headers(client, db)

    r = client.get("/coordinator/escalated-requests", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["status"] == "escalated"


# ── POST /coordinator/requests/{id}/resolve ───────────────────────────────────

def test_resolve_escalated_approve(client, db):
    req = _escalated_request(db)
    headers = _coord_headers(client, db)

    r = client.post(f"/coordinator/requests/{req.id}/resolve", json={
        "action": "approve",
        "comment": "Approved after review",
    }, headers=headers)
    assert r.status_code == 200

    escalated = client.get("/coordinator/escalated-requests", headers=headers).json()
    assert escalated == []


def test_resolve_escalated_reject(client, db):
    req = _escalated_request(db)
    headers = _coord_headers(client, db)

    r = client.post(f"/coordinator/requests/{req.id}/resolve", json={
        "action": "reject",
        "comment": "Does not meet requirements",
    }, headers=headers)
    assert r.status_code == 200


def test_resolve_non_escalated_request_fails(client, db):
    student = make_user(db, national_id="V-33333333", email="stu@test.com")
    rt = make_request_type(db)
    req = make_pending_request(db, student, rt)  # still pending, not escalated
    headers = _coord_headers(client, db)

    r = client.post(f"/coordinator/requests/{req.id}/resolve", json={
        "action": "approve",
        "comment": "Trying to resolve non-escalated",
    }, headers=headers)
    assert r.status_code == 400


# ── GET /coordinator/users ────────────────────────────────────────────────────

def test_list_users_excludes_students(client, db):
    make_user(db, national_id="V-55555555", email="stu2@test.com", role=RolEnum.student)
    make_user(db, national_id="V-66666666", email="op@test.com", role=RolEnum.operator)
    headers = _coord_headers(client, db)

    r = client.get("/coordinator/users", headers=headers)
    assert r.status_code == 200
    roles = [u["role"] for u in r.json()]
    assert "student" not in roles
    assert "operator" in roles or "coordinator" in roles


# ── POST /coordinator/users/{id}/toggle-active ───────────────────────────────

def test_toggle_active_deactivates_operator(client, db):
    op = make_user(db, national_id="V-77777777", email="op@test.com", role=RolEnum.operator)
    headers = _coord_headers(client, db)

    r = client.post(f"/coordinator/users/{op.id}/toggle-active", headers=headers)
    assert r.status_code == 200
    assert r.json()["active"] is False

    # Toggle back
    r = client.post(f"/coordinator/users/{op.id}/toggle-active", headers=headers)
    assert r.json()["active"] is True


def test_toggle_active_student_fails(client, db):
    student = make_user(db, national_id="V-88888888", email="stu@test.com", role=RolEnum.student)
    headers = _coord_headers(client, db)

    r = client.post(f"/coordinator/users/{student.id}/toggle-active", headers=headers)
    assert r.status_code == 400


def test_toggle_active_user_not_found(client, db):
    headers = _coord_headers(client, db)
    r = client.post("/coordinator/users/9999/toggle-active", headers=headers)
    assert r.status_code == 404
