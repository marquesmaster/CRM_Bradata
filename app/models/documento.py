"""Templates de documento (DOCX) e documentos gerados.

Fluxo:
1. Admin sobe um .docx com placeholders Jinja: {{ empresa.razao_social }}, etc
2. Sistema lista variáveis disponíveis (do schema ou explícitas)
3. User clica "Gerar contrato" num Deal → escolhe template → preenche extras
4. Sistema renderiza, salva como DocumentoGerado, retorna URL de download
"""
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TemplateKind(str, Enum):
    contrato = "contrato"
    proposta = "proposta"
    aditivo = "aditivo"
    nda = "nda"
    outro = "outro"


class DocumentoTemplate(Base):
    """Template DOCX salvo pelo admin (ex: Contrato Bodyshop padrão Bradata)."""
    __tablename__ = "documento_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[TemplateKind] = mapped_column(
        SqlEnum(TemplateKind, name="template_kind"), nullable=False, index=True
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)   # caminho relativo em storage/
    file_name_original: Mapped[str] = mapped_column(String(255), nullable=False)

    variaveis_disponiveis: Mapped[list | None] = mapped_column(JSON)  # lista de {nome, label, exemplo}
    ativo: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)


class DocumentoGerado(Base):
    """Documento criado a partir de um template (com variáveis aplicadas)."""
    __tablename__ = "documentos_gerados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("documento_templates.id"), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    variables_used: Mapped[dict | None] = mapped_column(JSON)

    # Vínculos opcionais — pra rastrear o que originou o doc
    oportunidade_id: Mapped[int | None] = mapped_column(ForeignKey("oportunidades.id", ondelete="SET NULL"), index=True)
    proposta_id: Mapped[int | None] = mapped_column(ForeignKey("propostas.id", ondelete="SET NULL"))
    empresa_id: Mapped[int | None] = mapped_column(ForeignKey("empresas.id", ondelete="SET NULL"))

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[int | None] = mapped_column(Integer)
