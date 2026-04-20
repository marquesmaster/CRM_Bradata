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


class TarefaStatus(str, Enum):
    pendente = "pendente"
    em_andamento = "em_andamento"
    concluida = "concluida"
    cancelada = "cancelada"


class TarefaPrioridade(str, Enum):
    baixa = "baixa"
    media = "media"
    alta = "alta"
    urgente = "urgente"


class Tarefa(Base):
    __tablename__ = "tarefas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    status: Mapped[TarefaStatus] = mapped_column(
        SqlEnum(TarefaStatus, name="tarefa_status"),
        default=TarefaStatus.pendente,
        nullable=False,
        index=True,
    )
    prioridade: Mapped[TarefaPrioridade] = mapped_column(
        SqlEnum(TarefaPrioridade, name="tarefa_prioridade"),
        default=TarefaPrioridade.media,
        nullable=False,
    )

    assignee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    empresa_id: Mapped[int | None] = mapped_column(ForeignKey("empresas.id", ondelete="CASCADE"))
    oportunidade_id: Mapped[int | None] = mapped_column(
        ForeignKey("oportunidades.id", ondelete="CASCADE")
    )
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))

    concluida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
