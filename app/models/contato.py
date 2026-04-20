from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Contato(Base):
    __tablename__ = "contatos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True
    )

    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    cargo: Mapped[str | None] = mapped_column(String(180), index=True)
    departamento: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(180), index=True)
    telefone: Mapped[str | None] = mapped_column(String(40))
    celular: Mapped[str | None] = mapped_column(String(40))
    linkedin_url: Mapped[str | None] = mapped_column(String(255))

    decisor: Mapped[bool] = mapped_column(Boolean, default=False)
    principal: Mapped[bool] = mapped_column(Boolean, default=False)

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    empresa: Mapped["Empresa"] = relationship("Empresa", back_populates="contatos")  # noqa: F821
