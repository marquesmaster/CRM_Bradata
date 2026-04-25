from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OportunidadeStatus(str, Enum):
    aberta = "aberta"
    ganha = "ganha"
    perdida = "perdida"
    cancelada = "cancelada"


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    estagios: Mapped[list["PipelineEstagio"]] = relationship(
        "PipelineEstagio",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="PipelineEstagio.ordem",
    )


class PipelineEstagio(Base):
    __tablename__ = "pipeline_estagios"
    __table_args__ = (UniqueConstraint("pipeline_id", "ordem", name="uq_pipeline_ordem"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False
    )
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)
    probabilidade: Mapped[int] = mapped_column(Integer, default=10)
    color: Mapped[str | None] = mapped_column(String(20))
    is_ganho: Mapped[bool] = mapped_column(default=False)
    is_perda: Mapped[bool] = mapped_column(default=False)

    pipeline: Mapped["Pipeline"] = relationship("Pipeline", back_populates="estagios")


class Oportunidade(Base):
    __tablename__ = "oportunidades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contato_id: Mapped[int | None] = mapped_column(ForeignKey("contatos.id", ondelete="SET NULL"))
    pipeline_id: Mapped[int] = mapped_column(ForeignKey("pipelines.id"), nullable=False)
    estagio_id: Mapped[int] = mapped_column(ForeignKey("pipeline_estagios.id"), nullable=False)

    valor_estimado: Mapped[float | None] = mapped_column(Float)
    probabilidade: Mapped[int | None] = mapped_column(Integer)
    data_fechamento_prevista: Mapped[datetime | None] = mapped_column(Date)
    data_fechamento_real: Mapped[datetime | None] = mapped_column(Date)

    status: Mapped[OportunidadeStatus] = mapped_column(
        SqlEnum(OportunidadeStatus, name="oportunidade_status"),
        default=OportunidadeStatus.aberta,
        nullable=False,
        index=True,
    )
    motivo_perda: Mapped[str | None] = mapped_column(Text)

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    descricao: Mapped[str | None] = mapped_column(Text)

    pncp_numero_controle: Mapped[str | None] = mapped_column(String(60), index=True)
    tags: Mapped[list | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)
    empresa: Mapped["Empresa"] = relationship("Empresa", back_populates="oportunidades")  # noqa: F821
