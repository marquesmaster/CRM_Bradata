"""Chat interno entre users (DM 1-on-1 e grupos).

Modelo:
- ChatChannel: representa uma conversa (kind=dm | group). Para DM, o nome é
  derivado dos 2 participantes; para grupo, é definido pelo criador.
- ChatMembership: relação user ↔ channel + last_read_at (pra unread badge)
- ChatMessage: mensagens, com soft delete (deleted_at) e edição (edited_at)
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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ChatChannelKind(str, Enum):
    dm = "dm"
    group = "group"


class ChatChannel(Base):
    __tablename__ = "chat_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[ChatChannelKind] = mapped_column(
        SqlEnum(ChatChannelKind, name="chat_channel_kind"), nullable=False, index=True
    )
    nome: Mapped[str | None] = mapped_column(String(180))   # null em DM
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    members: Mapped[list["ChatMembership"]] = relationship(
        "ChatMembership", back_populates="channel", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="channel", cascade="all, delete-orphan"
    )


class ChatMembership(Base):
    __tablename__ = "chat_memberships"
    __table_args__ = (
        UniqueConstraint("channel_id", "user_id", name="uq_chat_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(
        ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    channel: Mapped["ChatChannel"] = relationship("ChatChannel", back_populates="members")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(
        ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    channel: Mapped["ChatChannel"] = relationship("ChatChannel", back_populates="messages")
