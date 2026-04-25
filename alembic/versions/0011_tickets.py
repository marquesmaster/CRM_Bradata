"""tabelas de tickets/chamados

Revision ID: 0011_tickets
Revises: 0010_documentos
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_tickets"
down_revision = "0010_documentos"
branch_labels = None
depends_on = None

STATUS = ("aberto", "em_andamento", "aguardando_cliente", "resolvido", "fechado")
PRIORIDADE = ("baixa", "media", "alta", "urgente")
KIND = ("suporte", "duvida", "problema", "melhoria", "interno")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    for tname, vals in (("ticket_status", STATUS), ("ticket_prioridade", PRIORIDADE), ("ticket_kind", KIND)):
        if not bind.execute(sa.text(f"SELECT 1 FROM pg_type WHERE typname='{tname}'")).first():
            postgresql.ENUM(*vals, name=tname).create(bind, checkfirst=True)

    if "tickets" not in existing:
        op.create_table(
            "tickets",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("titulo", sa.String(200), nullable=False),
            sa.Column("descricao", sa.Text),
            sa.Column("status", postgresql.ENUM(*STATUS, name="ticket_status", create_type=False), nullable=False, server_default="aberto"),
            sa.Column("prioridade", postgresql.ENUM(*PRIORIDADE, name="ticket_prioridade", create_type=False), nullable=False, server_default="media"),
            sa.Column("kind", postgresql.ENUM(*KIND, name="ticket_kind", create_type=False), nullable=False, server_default="suporte"),
            sa.Column("empresa_id", sa.Integer, sa.ForeignKey("empresas.id", ondelete="SET NULL")),
            sa.Column("contato_id", sa.Integer, sa.ForeignKey("contatos.id", ondelete="SET NULL")),
            sa.Column("oportunidade_id", sa.Integer, sa.ForeignKey("oportunidades.id", ondelete="SET NULL")),
            sa.Column("requester_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("assignee_user_id", sa.Integer, sa.ForeignKey("users.id")),
            sa.Column("sla_due_at", sa.DateTime(timezone=True)),
            sa.Column("resolved_at", sa.DateTime(timezone=True)),
            sa.Column("closed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
            sa.Column("deleted_by_id", sa.Integer),
        )
        op.create_index("ix_tickets_status", "tickets", ["status"])
        op.create_index("ix_tickets_kind", "tickets", ["kind"])
        op.create_index("ix_tickets_empresa_id", "tickets", ["empresa_id"])
        op.create_index("ix_tickets_requester_user_id", "tickets", ["requester_user_id"])
        op.create_index("ix_tickets_assignee_user_id", "tickets", ["assignee_user_id"])
        op.create_index("ix_tickets_sla_due_at", "tickets", ["sla_due_at"])
        op.create_index("ix_tickets_deleted_at", "tickets", ["deleted_at"])

    if "ticket_comments" not in existing:
        op.create_table(
            "ticket_comments",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("ticket_id", sa.Integer, sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("conteudo", sa.Text, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True)),
            sa.Column("deleted_by_id", sa.Integer),
        )
        op.create_index("ix_ticket_comments_ticket_id", "ticket_comments", ["ticket_id"])


def downgrade() -> None:
    pass
