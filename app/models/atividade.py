from datetime import datetime
from enum import Enum

from sqlalchemy import (
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TipoAtividade(str, Enum):
    ligacao = "ligacao"
    email = "email"
    reuniao = "reuniao"
    whatsapp = "whatsapp"
    visita = "visita"
    linkedin = "linkedin"
    tarefa = "tarefa"
    outro = "outro"


class AtividadeStatus(str, Enum):
    pendente = "pendente"
    em_andamento = "em_andamento"
    concluida = "concluida"
    cancelada = "cancelada"


class AtividadePrioridade(str, Enum):
    baixa = "baixa"
    media = "media"
    alta = "alta"
    urgente = "urgente"


class Atividade(Base):
    __tablename__ = "atividades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    tipo: Mapped[TipoAtividade] = mapped_column(
        SqlEnum(TipoAtividade, name="tipo_atividade"), nullable=False, index=True
    )
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)

    status: Mapped[AtividadeStatus] = mapped_column(
        SqlEnum(AtividadeStatus, name="atividade_status"),
        default=AtividadeStatus.concluida,
        nullable=False,
        index=True,
    )
    prioridade: Mapped[AtividadePrioridade] = mapped_column(
        SqlEnum(AtividadePrioridade, name="atividade_prioridade"),
        default=AtividadePrioridade.media,
        nullable=False,
    )

    data_atividade: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    concluida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duracao_min: Mapped[int | None] = mapped_column(Integer)
    resultado: Mapped[str | None] = mapped_column(Text)

    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), index=True
    )
    contato_id: Mapped[int | None] = mapped_column(ForeignKey("contatos.id", ondelete="SET NULL"))
    oportunidade_id: Mapped[int | None] = mapped_column(
        ForeignKey("oportunidades.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
