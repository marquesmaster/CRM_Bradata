"""soft-delete universal: adiciona deleted_at em entidades de negócio

Revision ID: 0009_soft_delete
Revises: 0008_verification_codes
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_soft_delete"
down_revision = "0008_verification_codes"
branch_labels = None
depends_on = None


TABLES = [
    "empresas",
    "contatos",
    "oportunidades",
    "propostas",
    "atividades",
    "notas",
    "leads",
    "automacoes",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for tbl in TABLES:
        if tbl not in inspector.get_table_names():
            continue
        cols = {c["name"] for c in inspector.get_columns(tbl)}
        if "deleted_at" not in cols:
            op.add_column(tbl, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
            op.create_index(f"ix_{tbl}_deleted_at", tbl, ["deleted_at"])
        if "deleted_by_id" not in cols:
            op.add_column(tbl, sa.Column("deleted_by_id", sa.Integer, nullable=True))


def downgrade() -> None:
    pass
