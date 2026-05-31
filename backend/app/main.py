import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers import auth, coordinador, operador, solicitudes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SiGES", description="Sistema de Gestión de Solicitudes Estudiantiles", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(solicitudes.router)
app.include_router(operador.router)
app.include_router(coordinador.router)


@app.get("/health")
def health():
    return {"status": "ok"}
