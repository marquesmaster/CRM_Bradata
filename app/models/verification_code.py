"""Códigos de verificação por e-mail (primeiro acesso, reset de senha).

TTL curto (15 min). Marcamos `used_at` no primeiro uso pra evitar replay.
"""
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    DateTime,
    Enum as SqlEnum,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VerificationKind(str, Enum):
    first_access = "first_access"
    password_reset = "password_reset"


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(12), nullable=False)
    kind: Mapped[VerificationKind] = mapped_column(
        SqlEnum(VerificationKind, name="verification_kind"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
