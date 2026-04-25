"""tabela lusha_candidates (resultados de busca, pré-revelação)

Revision ID: 0014_lusha_candidates
Revises: 0013_empresa_socios
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0014_lusha_candidates"
down_revision = "0013_empresa_socios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "lusha_candidates" in inspector.get_table_names():
        return
    op.create_table(
        "lusha_candidates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lusha_person_id", sa.String(120), nullable=False),
        sa.Column("nome", sa.String(180)),
        sa.Column("cargo", sa.String(255)),
        sa.Column("departamento", sa.String(120)),
        sa.Column("linkedin_url", sa.String(255)),
        sa.Column("has_email", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("has_phone", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("has_mobile", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("n_emails", sa.Integer, server_default="0"),
        sa.Column("n_phones", sa.Integer, server_default="0"),
        sa.Column("raw_search", postgresql.JSON(astext_type=sa.Text())),
        sa.Column("revelado_em", sa.DateTime(timezone=True)),
        sa.Column("revelado_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("contato_id", sa.Integer, sa.ForeignKey("contatos.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("empresa_id", "lusha_person_id", name="uq_lusha_candidate"),
    )
    op.create_index("ix_lusha_candidates_empresa_id", "lusha_candidates", ["empresa_id"])
    op.create_index("ix_lusha_candidates_lusha_person_id", "lusha_candidates", ["lusha_person_id"])


def downgrade() -> None:
    pass
