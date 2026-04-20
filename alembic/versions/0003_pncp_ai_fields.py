"""campos AI no pncp_contratos

Revision ID: 0003_pncp_ai_fields
Revises: 0002_frontend_alignment
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = "0003_pncp_ai_fields"
down_revision = "0002_frontend_alignment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "pncp_contratos" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("pncp_contratos")}
    additions = [
        ("ai_classificacao", sa.Column("ai_classificacao", sa.String(10), nullable=True)),
        ("ai_confianca", sa.Column("ai_confianca", sa.Float(), nullable=True)),
        ("ai_motivo", sa.Column("ai_motivo", sa.Text(), nullable=True)),
        ("ai_tipo_servico", sa.Column("ai_tipo_servico", sa.String(60), nullable=True)),
        ("ai_oportunidade", sa.Column("ai_oportunidade", sa.Text(), nullable=True)),
        ("ai_processado_em", sa.Column("ai_processado_em", sa.DateTime(timezone=True), nullable=True)),
    ]
    for name, col in additions:
        if name not in cols:
            op.add_column("pncp_contratos", col)
    if "ai_classificacao" not in cols:
        op.create_index("ix_pncp_contratos_ai_classificacao", "pncp_contratos", ["ai_classificacao"])
    if "ai_tipo_servico" not in cols:
        op.create_index("ix_pncp_contratos_ai_tipo_servico", "pncp_contratos", ["ai_tipo_servico"])


def downgrade() -> None:
    pass
