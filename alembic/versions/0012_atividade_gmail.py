"""campos Gmail (direcao, thread_id, message_id) em atividades

Revision ID: 0012_atividade_gmail
Revises: 0011_tickets
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_atividade_gmail"
down_revision = "0011_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("atividades")}
    if "direcao" not in cols:
        op.add_column("atividades", sa.Column("direcao", sa.String(10), nullable=True))
        op.create_index("ix_atividades_direcao", "atividades", ["direcao"])
    if "gmail_thread_id" not in cols:
        op.add_column("atividades", sa.Column("gmail_thread_id", sa.String(100), nullable=True))
        op.create_index("ix_atividades_gmail_thread_id", "atividades", ["gmail_thread_id"])
    if "gmail_message_id" not in cols:
        op.add_column("atividades", sa.Column("gmail_message_id", sa.String(100), nullable=True))
        op.create_index("ix_atividades_gmail_message_id", "atividades", ["gmail_message_id"])


def downgrade() -> None:
    pass
