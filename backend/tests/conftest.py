import os

os.environ["SIGES_TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-32ch"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models.solicitud import EstadoEnum, HistorialEstado, Solicitud
from app.models.tramite import TipoTramite
from app.models.usuario import PreguntaSeguridad, RespuestaSeguridad, RolEnum, Usuario
from app.utils.security import hash_answer, hash_password


# ── Per-test isolated SQLite DB ───────────────────────────────────────────────

@pytest.fixture
def client(tmp_path):
    """
    Creates an isolated SQLite file per test.
    Both test-setup code (via `db` fixture) and FastAPI routes
    share the exact same Session instance, avoiding connection conflicts.
    """
    db_file = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    # Store session on client object so the `db` fixture can retrieve it
    tc = TestClient(app)
    tc._test_session = session

    yield tc

    session.close()
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db(client):
    """Returns the same Session instance used by FastAPI routes in this test."""
    return client._test_session


# ── Factory helpers ───────────────────────────────────────────────────────────

def make_user(
    db,
    national_id="V-00000001",
    first_name="Test",
    last_name="User",
    email="test@test.com",
    password="password123",
    role=RolEnum.student,
    active=True,
):
    user = Usuario(
        national_id=national_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=None,
        password_hash=hash_password(password),
        role=role,
        active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_questions(db):
    questions = [
        PreguntaSeguridad(question="¿Nombre de tu primera mascota?"),
        PreguntaSeguridad(question="¿Ciudad donde naciste?"),
        PreguntaSeguridad(question="¿Nombre de tu escuela primaria?"),
    ]
    for q in questions:
        db.add(q)
    db.commit()
    for q in questions:
        db.refresh(q)
    return questions


def make_user_with_questions(db, **kwargs):
    user = make_user(db, **kwargs)
    questions = make_questions(db)
    for q in questions[:2]:
        db.add(RespuestaSeguridad(
            user_id=user.id,
            question_id=q.id,
            answer_hash=hash_answer("test_answer"),
        ))
    db.commit()
    return user, questions


def make_request_type(
    db,
    name="Account Unlock",
    description="Unlock a blocked account",
    required_docs=None,
    deadline_days=None,
    requires_account=True,
    active=True,
):
    rt = TipoTramite(
        name=name,
        description=description,
        required_docs=required_docs or [],
        deadline_days=deadline_days,
        requires_account=requires_account,
        active=active,
    )
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


def make_pending_request(db, user, request_type):
    req = Solicitud(
        ticket="SIG-202601-00001",
        user_id=user.id,
        request_type_id=request_type.id,
        status=EstadoEnum.pending,
        description="Test request",
    )
    db.add(req)
    db.flush()
    db.add(HistorialEstado(
        request_id=req.id,
        previous_status=None,
        new_status=EstadoEnum.pending,
        comment="Created",
    ))
    db.commit()
    db.refresh(req)
    return req


def auth_headers(client, email="test@test.com", password="password123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed ({r.status_code}): {r.json()}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
