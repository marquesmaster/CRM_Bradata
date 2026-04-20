"""Inicializações idempotentes executadas no startup."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.oportunidade import Pipeline, PipelineEstagio
from app.models.user import User, UserRole

log = logging.getLogger("bootstrap")

DEFAULT_PIPELINE_NAME = "Comercial - Bradata"
DEFAULT_ESTAGIOS = [
    {"nome": "Prospecção", "ordem": 1, "probabilidade": 5},
    {"nome": "Qualificação", "ordem": 2, "probabilidade": 15},
    {"nome": "Descoberta / Diagnóstico", "ordem": 3, "probabilidade": 30},
    {"nome": "Proposta", "ordem": 4, "probabilidade": 50},
    {"nome": "Negociação", "ordem": 5, "probabilidade": 75},
    {"nome": "Fechamento - Ganho", "ordem": 6, "probabilidade": 100, "is_ganho": True},
    {"nome": "Fechamento - Perda", "ordem": 7, "probabilidade": 0, "is_perda": True},
]


def ensure_default_admin(db: Session) -> None:
    existing = db.query(User).filter(User.role == UserRole.admin).first()
    if existing:
        return
    user = User(
        nome="Admin Bradata",
        email=settings.default_admin_email.lower(),
        senha_hash=hash_password(settings.default_admin_password),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    log.info("Admin default criado: %s", user.email)


def ensure_default_pipeline(db: Session) -> None:
    existing = db.query(Pipeline).filter(Pipeline.nome == DEFAULT_PIPELINE_NAME).first()
    if existing:
        return
    pipeline = Pipeline(nome=DEFAULT_PIPELINE_NAME, descricao="Pipeline comercial padrão")
    for e in DEFAULT_ESTAGIOS:
        pipeline.estagios.append(PipelineEstagio(**e))
    db.add(pipeline)
    db.commit()
    log.info("Pipeline default criado: %s", DEFAULT_PIPELINE_NAME)
