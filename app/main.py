from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import (
    atividades,
    auth,
    automacoes,
    contatos,
    empresas,
    etl_runs,
    leads,
    notas,
    notifications,
    oportunidades,
    pipelines,
    pncp,
    propostas,
    relatorios,
    users,
)
from app.services.bootstrap import ensure_default_admin, ensure_default_pipeline
from app.workers.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    with SessionLocal() as db:
        ensure_default_admin(db)
        ensure_default_pipeline(db)
    if settings.scheduler_enabled:
        start_scheduler()
    yield
    if settings.scheduler_enabled:
        stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="API do CRM Bradata: integração PNCP + gestão comercial (leads, empresas, oportunidades).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": __version__}


API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{API_PREFIX}/users", tags=["users"])
app.include_router(empresas.router, prefix=f"{API_PREFIX}/empresas", tags=["empresas"])
app.include_router(contatos.router, prefix=f"{API_PREFIX}/contatos", tags=["contatos"])
app.include_router(leads.router, prefix=f"{API_PREFIX}/leads", tags=["leads"])
app.include_router(pipelines.router, prefix=f"{API_PREFIX}/pipelines", tags=["pipelines"])
app.include_router(oportunidades.router, prefix=f"{API_PREFIX}/oportunidades", tags=["oportunidades"])
app.include_router(atividades.router, prefix=f"{API_PREFIX}/atividades", tags=["atividades"])
app.include_router(notas.router, prefix=f"{API_PREFIX}/notas", tags=["notas"])
app.include_router(notifications.router, prefix=f"{API_PREFIX}/notifications", tags=["notifications"])
app.include_router(pncp.router, prefix=f"{API_PREFIX}/pncp", tags=["pncp"])
app.include_router(etl_runs.router, prefix=f"{API_PREFIX}/etl/runs", tags=["etl"])
app.include_router(automacoes.router, prefix=f"{API_PREFIX}/automacoes", tags=["automacoes"])
app.include_router(propostas.router, prefix=f"{API_PREFIX}/propostas", tags=["propostas"])
app.include_router(relatorios.router, prefix=f"{API_PREFIX}/relatorios", tags=["relatorios"])

# Servir o frontend (SPA) estaticamente
import os
from fastapi.staticfiles import StaticFiles

WEB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
