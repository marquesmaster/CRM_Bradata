from datetime import datetime
from enum import Enum

from sqlalchemy import (
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


class EtlRunStatus(str, Enum):
    running = "running"
    done = "done"
    error = "error"
    canceled = "canceled"


class EtlRun(Base):
    """Histórico de execuções do ETL PNCP (para tela /execucoes)."""

    __tablename__ = "etl_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(40), default="pncp_full", index=True)

    status: Mapped[EtlRunStatus] = mapped_column(
        SqlEnum(EtlRunStatus, name="etl_run_status"),
        default=EtlRunStatus.running,
        nullable=False,
        index=True,
    )

    iniciado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    finalizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duracao_seg: Mapped[float | None] = mapped_column(Float)

    payload: Mapped[dict | None] = mapped_column(JSON)
    resumo: Mapped[dict | None] = mapped_column(JSON)

    # Progresso (para a barra em tempo real)
    contratos_a_processar: Mapped[int] = mapped_column(Integer, default=0)
    contratos_ok: Mapped[int] = mapped_column(Integer, default=0)
    contratos_com_erro: Mapped[int] = mapped_column(Integer, default=0)
    itens_novos: Mapped[int] = mapped_column(Integer, default=0)
    empresas_sincronizadas: Mapped[int] = mapped_column(Integer, default=0)
    ai_processados: Mapped[int] = mapped_column(Integer, default=0)

    mensagem_erro: Mapped[str | None] = mapped_column(Text)

    triggered_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
