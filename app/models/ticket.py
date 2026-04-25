"""Tickets / Chamados — suporte, follow-up, problemas.

Modelo enxuto pra rastrear demandas que não são oportunidades nem atividades:
problemas de cliente, pedidos internos, follow-ups longos, etc.
"""
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TicketStatus(str, Enum):
    aberto = "aberto"
    em_andamento = "em_andamento"
    aguardando_cliente = "aguardando_cliente"
    resolvido = "resolvido"
    fechado = "fechado"


class TicketPrioridade(str, Enum):
    baixa = "baixa"
    media = "media"
    alta = "alta"
    urgente = "urgente"


class TicketKind(str, Enum):
    suporte = "suporte"
    duvida = "duvida"
    problema = "problema"
    melhoria = "melhoria"
    interno = "interno"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)

    status: Mapped[TicketStatus] = mapped_column(
        SqlEnum(TicketStatus, name="ticket_status"),
        default=TicketStatus.aberto, nullable=False, index=True,
    )
    prioridade: Mapped[TicketPrioridade] = mapped_column(
        SqlEnum(TicketPrioridade, name="ticket_prioridade"),
        default=TicketPrioridade.media, nullable=False,
    )
    kind: Mapped[TicketKind] = mapped_column(
        SqlEnum(TicketKind, name="ticket_kind"),
        default=TicketKind.suporte, nullable=False, index=True,
    )

    # Vínculos
    empresa_id: Mapped[int | None] = mapped_column(ForeignKey("empresas.id", ondelete="SET NULL"), index=True)
    contato_id: Mapped[int | None] = mapped_column(ForeignKey("contatos.id", ondelete="SET NULL"))
    oportunidade_id: Mapped[int | None] = mapped_column(ForeignKey("oportunidades.id", ondelete="SET NULL"))

    requester_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assignee_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)

    comments: Mapped[list["TicketComment"]] = relationship(
        "TicketComment", back_populates="ticket", cascade="all, delete-orphan",
        order_by="TicketComment.created_at",
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)

    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="comments")
