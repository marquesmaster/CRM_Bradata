"""tabelas de chat interno

Revision ID: 0007_chat
Revises: 0006_user_google_oauth
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_chat"
down_revision = "0006_user_google_oauth"
branch_labels = None
depends_on = None

CHANNEL_KIND = ("dm", "group")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # Enum (criar manualmente pra ser idempotente)
    if "chat_channel_kind" not in [t["name"] for t in bind.execute(sa.text(
        "SELECT typname AS name FROM pg_type WHERE typname='chat_channel_kind'"
    )).mappings().all()]:
        kind_enum = postgresql.ENUM(*CHANNEL_KIND, name="chat_channel_kind")
        kind_enum.create(bind, checkfirst=True)

    if "chat_channels" not in existing:
        op.create_table(
            "chat_channels",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column(
                "kind",
                postgresql.ENUM(*CHANNEL_KIND, name="chat_channel_kind", create_type=False),
                nullable=False,
            ),
            sa.Column("nome", sa.String(180), nullable=True),
            sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("last_message_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_chat_channels_kind", "chat_channels", ["kind"])
        op.create_index("ix_chat_channels_last_message_at", "chat_channels", ["last_message_at"])

    if "chat_memberships" not in existing:
        op.create_table(
            "chat_memberships",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("channel_id", sa.Integer, sa.ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("last_read_at", sa.DateTime(timezone=True)),
            sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("channel_id", "user_id", name="uq_chat_member"),
        )
        op.create_index("ix_chat_memberships_channel_id", "chat_memberships", ["channel_id"])
        op.create_index("ix_chat_memberships_user_id", "chat_memberships", ["user_id"])

    if "chat_messages" not in existing:
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("channel_id", sa.Integer, sa.ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("conteudo", sa.Text, nullable=False),
            sa.Column("edited_at", sa.DateTime(timezone=True)),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_chat_messages_channel_id", "chat_messages", ["channel_id"])
        op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])
        op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])


def downgrade() -> None:
    pass
