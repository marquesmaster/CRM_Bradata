from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SqlEnum,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AutomacaoKind(str, Enum):
    template_email = "template_email"
    template_whatsapp = "template_whatsapp"
    alerta_inatividade = "alerta_inatividade"
    alerta_sla = "alerta_sla"
    cadencia_followup = "cadencia_followup"
    regra_score_empresa = "regra_score_empresa"


class Automacao(Base):
    __tablename__ = "automacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    kind: Mapped[AutomacaoKind] = mapped_column(
        SqlEnum(AutomacaoKind, name="automacao_kind"), nullable=False, index=True
    )
    descricao: Mapped[str | None] = mapped_column(Text)

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Configuração da automação (trigger, condicao, acao) como JSON flexível
    config: Mapped[dict | None] = mapped_column(JSON)

    # Template de mensagem (para kinds de e-mail/whatsapp)
    assunto: Mapped[str | None] = mapped_column(String(255))
    corpo: Mapped[str | None] = mapped_column(Text)

    executada_n_vezes: Mapped[int] = mapped_column(Integer, default=0)
    ultima_execucao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)
