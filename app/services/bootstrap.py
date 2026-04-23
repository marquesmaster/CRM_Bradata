"""Inicializações idempotentes executadas no startup."""
from __future__ import annotations

import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.oportunidade import Pipeline, PipelineEstagio
from app.models.user import User, UserRole

log = logging.getLogger("bootstrap")

DEFAULT_PIPELINE_NAME = "Comercial - Bradata"
DEFAULT_ESTAGIOS = [
    {"nome": "Prospecção", "ordem": 1, "probabilidade": 5, "color": "#3B82F6"},
    {"nome": "Qualificação", "ordem": 2, "probabilidade": 15, "color": "#06B6D4"},
    {"nome": "Descoberta / Diagnóstico", "ordem": 3, "probabilidade": 30, "color": "#8B5CF6"},
    {"nome": "Proposta", "ordem": 4, "probabilidade": 50, "color": "#F59E0B"},
    {"nome": "Negociação", "ordem": 5, "probabilidade": 75, "color": "#EF6C00"},
    {"nome": "Ganho", "ordem": 6, "probabilidade": 100, "color": "#10B981", "is_ganho": True},
    {"nome": "Perda", "ordem": 7, "probabilidade": 0, "color": "#EF4444", "is_perda": True},
]


def ensure_default_admin(db: Session) -> None:
    """Cria o admin default se não existir. Tolerante a race (múltiplos workers)."""
    email = settings.default_admin_email.lower()
    if (
        db.query(User).filter(User.email == email).first()
        or db.query(User).filter(User.role == UserRole.admin).first()
    ):
        return
    user = User(
        nome="Admin Bradata",
        email=email,
        senha_hash=hash_password(settings.default_admin_password),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
        log.info("Admin default criado: %s", user.email)
    except IntegrityError:
        db.rollback()
        log.info("Admin default já existia (race): %s", email)


def ensure_default_pipeline(db: Session) -> None:
    """Cria o pipeline default se não existir. Tolerante a race."""
    existing = db.query(Pipeline).filter(Pipeline.nome == DEFAULT_PIPELINE_NAME).first()
    if existing:
        return
    pipeline = Pipeline(nome=DEFAULT_PIPELINE_NAME, descricao="Pipeline comercial padrão")
    for e in DEFAULT_ESTAGIOS:
        pipeline.estagios.append(PipelineEstagio(**e))
    db.add(pipeline)
    try:
        db.commit()
        log.info("Pipeline default criado: %s", DEFAULT_PIPELINE_NAME)
    except IntegrityError:
        db.rollback()
        log.info("Pipeline default já existia (race): %s", DEFAULT_PIPELINE_NAME)
