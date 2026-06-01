"""Tests for request types, student requests, enrollment, and document upload."""
import pytest

from tests.conftest import (
    auth_headers,
    make_pending_request,
    make_request_type,
    make_user,
)
from app.models.usuario import RolEnum


# ── GET /request-types ────────────────────────────────────────────────────────

def test_get_request_types_empty(client):
    r = client.get("/request-types")
    assert r.status_code == 200
    assert r.json() == []


def test_get_request_types_returns_active_only(client, db):
    make_request_type(db, name="Active", active=True)
    make_request_type(db, name="Inactive", active=False)
    r = client.get("/request-types")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Active" in names
    assert "Inactive" not in names


def test_get_request_types_shape(client, db):
    make_request_type(db, name="Unlock", required_docs=["ID copy"], deadline_days=5)
    r = client.get("/request-types")
    t = r.json()[0]
    assert t["name"] == "Unlock"
    assert t["required_docs"] == ["ID copy"]
    assert t["deadline_days"] == 5
    assert t["requires_account"] is True


# ── POST /requests ────────────────────────────────────────────────────────────

def test_create_request_success(client, db):
    user = make_user(db)
    rt = make_request_type(db)
    headers = auth_headers(client)

    r = client.post("/requests", json={
        "request_type_id": rt.id,
        "description": "My account is blocked",
        "document_ids": [],
    }, headers=headers)

    assert r.status_code == 201
    body = r.json()
    assert body["ticket"].startswith("SIG-")
    assert body["status"] == "pending"


def test_create_request_requires_auth(client, db):
    rt = make_request_type(db)
    r = client.post("/requests", json={"request_type_id": rt.id, "document_ids": []})
    assert r.status_code == 403


def test_create_request_operator_cannot_create(client, db):
    make_user(db, role=RolEnum.operator)
    rt = make_request_type(db)
    headers = auth_headers(client)

    r = client.post("/requests", json={
        "request_type_id": rt.id,
        "document_ids": [],
    }, headers=headers)
    assert r.status_code == 403


def test_create_request_nonexistent_type(client, db):
    make_user(db)
    headers = auth_headers(client)
    r = client.post("/requests", json={"request_type_id": 9999, "document_ids": []}, headers=headers)
    assert r.status_code == 404


# ── GET /requests/my-requests ─────────────────────────────────────────────────

def test_my_requests_empty(client, db):
    make_user(db)
    r = client.get("/requests/my-requests", headers=auth_headers(client))
    assert r.status_code == 200
    assert r.json() == []


def test_my_requests_returns_own_only(client, db):
    user = make_user(db, email="user1@test.com")
    other = make_user(db, national_id="V-99999999", email="user2@test.com")
    rt = make_request_type(db)

    # Create request for user1
    make_pending_request(db, user, rt)

    # Login as user1
    headers = auth_headers(client, email="user1@test.com")
    r = client.get("/requests/my-requests", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Login as user2 sees nothing
    headers2 = auth_headers(client, email="user2@test.com")
    r2 = client.get("/requests/my-requests", headers=headers2)
    assert r2.json() == []


# ── GET /requests/{ticket} ────────────────────────────────────────────────────

def test_get_request_by_ticket(client, db):
    user = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, user, rt)
    headers = auth_headers(client)

    r = client.get(f"/requests/{req.ticket}", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["ticket"] == req.ticket
    assert body["status"] == "pending"
    assert body["request_type"]["name"] == rt.name


def test_get_request_not_found(client, db):
    make_user(db)
    r = client.get("/requests/SIG-000000-00000", headers=auth_headers(client))
    assert r.status_code == 404


def test_get_request_student_cannot_see_others(client, db):
    user1 = make_user(db, email="user1@test.com")
    user2 = make_user(db, national_id="V-99999999", email="user2@test.com")
    rt = make_request_type(db)
    req = make_pending_request(db, user1, rt)

    headers2 = auth_headers(client, email="user2@test.com")
    r = client.get(f"/requests/{req.ticket}", headers=headers2)
    assert r.status_code == 403


def test_get_request_internal_history_hidden_from_student(client, db):
    from app.models.solicitud import HistorialEstado
    user = make_user(db)
    rt = make_request_type(db)
    req = make_pending_request(db, user, rt)

    # Add internal note
    db.add(HistorialEstado(
        request_id=req.id,
        previous_status="pending",
        new_status="pending",
        comment="Internal only",
        is_internal=True,
    ))
    db.commit()

    r = client.get(f"/requests/{req.ticket}", headers=auth_headers(client))
    history = r.json()["history"]
    assert all(not h["is_internal"] for h in history)


# ── POST /requests/enrollment ─────────────────────────────────────────────────

def test_enrollment_success(client, db, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.solicitudes.settings.uploads_dir", str(tmp_path))
    make_request_type(db, name="Enrollment", requires_account=False)

    r = client.post(
        "/requests/enrollment",
        data={"national_id": "V-12345678"},
        files=[
            ("archivos", ("grades.pdf", b"content", "application/pdf")),
            ("archivos", ("diploma.pdf", b"content", "application/pdf")),
        ],
    )
    assert r.status_code == 201
    assert r.json()["ticket"].startswith("SIG-")


def test_enrollment_no_type_configured(client, db, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.solicitudes.settings.uploads_dir", str(tmp_path))
    # No enrollment type in DB
    r = client.post(
        "/requests/enrollment",
        data={"national_id": "V-12345678"},
        files=[("archivos", ("file.pdf", b"content", "application/pdf"))],
    )
    assert r.status_code == 404


def test_enrollment_sogac_rejects(client, db, tmp_path, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setattr("app.routers.solicitudes.settings.uploads_dir", str(tmp_path))
    make_request_type(db, name="Enrollment", requires_account=False)

    with patch("app.routers.solicitudes.verify_student", return_value=False):
        r = client.post(
            "/requests/enrollment",
            data={"national_id": "V-00000000"},
            files=[("archivos", ("file.pdf", b"content", "application/pdf"))],
        )
    assert r.status_code == 400


# ── POST /documents/upload ────────────────────────────────────────────────────

def test_upload_document(client, db, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.solicitudes.settings.uploads_dir", str(tmp_path))
    make_user(db)
    headers = auth_headers(client)

    r = client.post(
        "/documents/upload",
        files={"archivo": ("cedula.pdf", b"pdf content", "application/pdf")},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["filename"] == "cedula.pdf"
    assert "id" in r.json()


def test_upload_document_requires_auth(client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.solicitudes.settings.uploads_dir", str(tmp_path))
    r = client.post(
        "/documents/upload",
        files={"archivo": ("file.pdf", b"content", "application/pdf")},
    )
    assert r.status_code == 403
