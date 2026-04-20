from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LeadStatus(str, Enum):
    novo = "novo"
    em_contato = "em_contato"
    qualificado = "qualificado"
    desqualificado = "desqualificado"
    convertido = "convertido"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contato_id: Mapped[int | None] = mapped_column(ForeignKey("contatos.id", ondelete="SET NULL"))

    origem: Mapped[str] = mapped_column(String(60), default="manual", index=True)
    status: Mapped[LeadStatus] = mapped_column(
        SqlEnum(LeadStatus, name="lead_status"), default=LeadStatus.novo, nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    motivo_desqualificacao: Mapped[str | None] = mapped_column(Text)

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    qualificado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    convertido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    oportunidade_id: Mapped[int | None] = mapped_column(
        ForeignKey("oportunidades.id", ondelete="SET NULL")
    )

    observacoes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empresa: Mapped["Empresa"] = relationship("Empresa", back_populates="leads")  # noqa: F821
