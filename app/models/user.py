from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, Enum):
    admin = "admin"
    gestor = "gestor"
    bdr = "bdr"
    vendedor = "vendedor"
    leitor = "leitor"


class UserStatus(str, Enum):
    ativo = "ativo"
    inativo = "inativo"
    pendente = "pendente"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role"), default=UserRole.bdr, nullable=False
    )
    status: Mapped[UserStatus] = mapped_column(
        SqlEnum(UserStatus, name="user_status"),
        default=UserStatus.ativo,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    team: Mapped[str | None] = mapped_column(String(60), index=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ----- Google Workspace OAuth (envio de e-mail como o próprio user) -----
    google_email: Mapped[str | None] = mapped_column(String(180))
    google_access_token: Mapped[str | None] = mapped_column(String(2048))      # criptografado (Fernet)
    google_refresh_token: Mapped[str | None] = mapped_column(String(2048))     # criptografado (Fernet)
    google_token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    google_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
