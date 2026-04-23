"""lusha fields em contatos (fonte, lusha_person_id, lusha_raw, lusha_fetched_at)

Revision ID: 0005_lusha_contatos
Revises: 0004_etl_runs_automacoes
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_lusha_contatos"
down_revision = "0004_etl_runs_automacoes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("contatos")}

    if "fonte" not in cols:
        op.add_column("contatos", sa.Column("fonte", sa.String(40), nullable=True))
        op.create_index("ix_contatos_fonte", "contatos", ["fonte"])
    if "lusha_person_id" not in cols:
        op.add_column("contatos", sa.Column("lusha_person_id", sa.String(120), nullable=True))
        op.create_index("ix_contatos_lusha_person_id", "contatos", ["lusha_person_id"])
    if "lusha_raw" not in cols:
        op.add_column(
            "contatos",
            sa.Column("lusha_raw", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        )
    if "lusha_fetched_at" not in cols:
        op.add_column(
            "contatos",
            sa.Column("lusha_fetched_at", sa.DateTime(timezone=True), nullable=True),
        )

    # Unique (empresa_id, lusha_person_id)
    existing_uqs = {u["name"] for u in inspector.get_unique_constraints("contatos")}
    if "uq_contato_lusha" not in existing_uqs:
        try:
            op.create_unique_constraint(
                "uq_contato_lusha", "contatos", ["empresa_id", "lusha_person_id"]
            )
        except Exception:
            pass


def downgrade() -> None:
    pass
