"""empresa: socios, situacao_cadastral, regime_tributario

Revision ID: 0013_empresa_socios
Revises: 0012_atividade_gmail
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013_empresa_socios"
down_revision = "0012_atividade_gmail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("empresas")}
    if "socios" not in cols:
        op.add_column("empresas", sa.Column("socios", postgresql.JSON(astext_type=sa.Text()), nullable=True))
    if "situacao_cadastral" not in cols:
        op.add_column("empresas", sa.Column("situacao_cadastral", sa.String(40), nullable=True))
    if "regime_tributario" not in cols:
        op.add_column("empresas", sa.Column("regime_tributario", sa.String(80), nullable=True))


def downgrade() -> None:
    pass
