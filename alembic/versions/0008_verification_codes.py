"""tabela verification_codes

Revision ID: 0008_verification_codes
Revises: 0007_chat
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_verification_codes"
down_revision = "0007_chat"
branch_labels = None
depends_on = None

KINDS = ("first_access", "password_reset")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # Enum (idempotente)
    if not bind.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname='verification_kind'"
    )).first():
        postgresql.ENUM(*KINDS, name="verification_kind").create(bind, checkfirst=True)

    if "verification_codes" not in existing:
        op.create_table(
            "verification_codes",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("email", sa.String(180), nullable=False),
            sa.Column("code", sa.String(12), nullable=False),
            sa.Column(
                "kind",
                postgresql.ENUM(*KINDS, name="verification_kind", create_type=False),
                nullable=False,
            ),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True)),
            sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_verification_codes_email", "verification_codes", ["email"])


def downgrade() -> None:
    pass
