"""campos Google OAuth na tabela users

Revision ID: 0006_user_google_oauth
Revises: 0005_lusha_contatos
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_user_google_oauth"
down_revision = "0005_lusha_contatos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("users")}

    if "google_email" not in cols:
        op.add_column("users", sa.Column("google_email", sa.String(180), nullable=True))
    if "google_access_token" not in cols:
        op.add_column("users", sa.Column("google_access_token", sa.String(2048), nullable=True))
    if "google_refresh_token" not in cols:
        op.add_column("users", sa.Column("google_refresh_token", sa.String(2048), nullable=True))
    if "google_token_expiry" not in cols:
        op.add_column("users", sa.Column("google_token_expiry", sa.DateTime(timezone=True), nullable=True))
    if "google_connected_at" not in cols:
        op.add_column("users", sa.Column("google_connected_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    pass
