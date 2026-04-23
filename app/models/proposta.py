from datetime import date, datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PropostaStatus(str, Enum):
    rascunho = "rascunho"
    enviada = "enviada"
    em_analise = "em_analise"
    aceita = "aceita"
    rejeitada = "rejeitada"
    expirada = "expirada"


class Proposta(Base):
    """Proposta comercial vinculada a uma oportunidade (deal).

    Uma oportunidade pode ter N propostas (versionamento).
    """

    __tablename__ = "propostas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    oportunidade_id: Mapped[int] = mapped_column(
        ForeignKey("oportunidades.id", ondelete="CASCADE"), nullable=False, index=True
    )

    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    numero: Mapped[str | None] = mapped_column(String(60), index=True)
    versao: Mapped[int] = mapped_column(Integer, default=1)

    status: Mapped[PropostaStatus] = mapped_column(
        SqlEnum(PropostaStatus, name="proposta_status"),
        default=PropostaStatus.rascunho,
        nullable=False,
        index=True,
    )

    valor_total: Mapped[float | None] = mapped_column(Float)
    desconto_percentual: Mapped[float | None] = mapped_column(Float)

    escopo: Mapped[str | None] = mapped_column(Text)
    condicoes_pagamento: Mapped[str | None] = mapped_column(Text)
    prazo_execucao: Mapped[str | None] = mapped_column(String(120))
    perfis: Mapped[list | None] = mapped_column(JSON)  # [{cargo, qtd, horas, valor_hora}]

    pdf_url: Mapped[str | None] = mapped_column(String(500))

    enviada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    validade_em: Mapped[date | None] = mapped_column(Date)
    aceita_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejeitada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    motivo_rejeicao: Mapped[str | None] = mapped_column(Text)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
