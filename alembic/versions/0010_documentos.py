"""tabelas de documentos: templates DOCX + gerados

Revision ID: 0010_documentos
Revises: 0009_soft_delete
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_documentos"
down_revision = "0009_soft_delete"
branch_labels = None
depends_on = None

KINDS = ("contrato", "proposta", "aditivo", "nda", "outro")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if not bind.execute(sa.text("SELECT 1 FROM pg_type WHERE typname='template_kind'")).first():
        postgresql.ENUM(*KINDS, name="template_kind").create(bind, checkfirst=True)

    if "documento_templates" not in existing:
        op.create_table(
            "documento_templates",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("nome", sa.String(180), nullable=False),
            sa.Column("descricao", sa.Text),
            sa.Column("kind", postgresql.ENUM(*KINDS, name="template_kind", create_type=False), nullable=False),
            sa.Column("file_path", sa.String(500), nullable=False),
            sa.Column("file_name_original", sa.String(255), nullable=False),
            sa.Column("variaveis_disponiveis", postgresql.JSON(astext_type=sa.Text())),
            sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
            sa.Column("deleted_by_id", sa.Integer),
        )
        op.create_index("ix_documento_templates_kind", "documento_templates", ["kind"])
        op.create_index("ix_documento_templates_ativo", "documento_templates", ["ativo"])
        op.create_index("ix_documento_templates_deleted_at", "documento_templates", ["deleted_at"])

    if "documentos_gerados" not in existing:
        op.create_table(
            "documentos_gerados",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("template_id", sa.Integer, sa.ForeignKey("documento_templates.id"), nullable=False),
            sa.Column("nome", sa.String(255), nullable=False),
            sa.Column("file_path", sa.String(500), nullable=False),
            sa.Column("variables_used", postgresql.JSON(astext_type=sa.Text())),
            sa.Column("oportunidade_id", sa.Integer, sa.ForeignKey("oportunidades.id", ondelete="SET NULL")),
            sa.Column("proposta_id", sa.Integer, sa.ForeignKey("propostas.id", ondelete="SET NULL")),
            sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id", ondelete="SET NULL")),
            sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
            sa.Column("deleted_by_id", sa.Integer),
        )
        op.create_index("ix_documentos_gerados_template_id", "documentos_gerados", ["template_id"])
        op.create_index("ix_documentos_gerados_oportunidade_id", "documentos_gerados", ["oportunidade_id"])
        op.create_index("ix_documentos_gerados_created_at", "documentos_gerados", ["created_at"])


def downgrade() -> None:
    pass
