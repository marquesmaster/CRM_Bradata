from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Nota(Base):
    __tablename__ = "notas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)

    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), index=True
    )
    contato_id: Mapped[int | None] = mapped_column(ForeignKey("contatos.id", ondelete="CASCADE"))
    oportunidade_id: Mapped[int | None] = mapped_column(
        ForeignKey("oportunidades.id", ondelete="CASCADE")
    )
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)
