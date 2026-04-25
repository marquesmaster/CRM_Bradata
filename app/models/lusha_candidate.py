"""Lusha candidates — resultados de busca por empresa, pré-revelação.

Diferença pra Contato:
- Candidate é o resultado da busca (gratuito), com nome/cargo + flags
  has_email / has_phone / has_mobile pra mostrar o que existe
- Quando o user clica "Revelar", chamamos `prospecting/contact/enrich`
  (consome crédito) e criamos/atualizamos o Contato real com email/telefones
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LushaCandidate(Base):
    __tablename__ = "lusha_candidates"
    __table_args__ = (
        UniqueConstraint("empresa_id", "lusha_person_id", name="uq_lusha_candidate"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lusha_person_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    nome: Mapped[str | None] = mapped_column(String(180))
    cargo: Mapped[str | None] = mapped_column(String(255))
    departamento: Mapped[str | None] = mapped_column(String(120))
    linkedin_url: Mapped[str | None] = mapped_column(String(255))

    has_email: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_phone: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_mobile: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    n_emails: Mapped[int] = mapped_column(Integer, default=0)
    n_phones: Mapped[int] = mapped_column(Integer, default=0)

    # Bruto da busca, pra debug
    raw_search: Mapped[dict | None] = mapped_column(JSON)

    # Quando revelado
    revelado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revelado_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    contato_id: Mapped[int | None] = mapped_column(ForeignKey("contatos.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
