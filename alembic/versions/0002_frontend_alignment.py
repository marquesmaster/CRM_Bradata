"""frontend alignment: enums, columns, drop tarefas, add notifications

Revision ID: 0002_frontend_alignment
Revises: 0001_initial
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_frontend_alignment"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # ===== USERS =====
    if "users" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("users")}
        if "team" not in cols:
            op.add_column("users", sa.Column("team", sa.String(60), nullable=True))
            op.create_index("ix_users_team", "users", ["team"])
        if "last_seen_at" not in cols:
            op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
        if "status" not in cols:
            user_status = sa.Enum("ativo", "inativo", "pendente", name="user_status")
            user_status.create(bind, checkfirst=True)
            op.add_column(
                "users",
                sa.Column("status", user_status, nullable=False, server_default="ativo"),
            )
            op.create_index("ix_users_status", "users", ["status"])

    # ===== EMPRESAS =====
    if "empresas" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("empresas")}
        for name, col in [
            ("sector", sa.Column("sector", sa.String(80), nullable=True)),
            ("ativos_gov", sa.Column("ativos_gov", sa.Integer(), nullable=True)),
            ("ticket_medio", sa.Column("ticket_medio", sa.Float(), nullable=True)),
            ("stack", sa.Column("stack", postgresql.JSON(astext_type=sa.Text()), nullable=True)),
        ]:
            if name not in cols:
                op.add_column("empresas", col)
        if "sector" not in cols:
            op.create_index("ix_empresas_sector", "empresas", ["sector"])
        if "icp_score" in cols:
            try:
                op.create_index("ix_empresas_icp_score", "empresas", ["icp_score"])
            except Exception:
                pass
        if "status" not in cols:
            empresa_status = sa.Enum("prospect", "lead", "cliente", "inativo", name="empresa_status")
            empresa_status.create(bind, checkfirst=True)
            op.add_column(
                "empresas",
                sa.Column("status", empresa_status, nullable=False, server_default="prospect"),
            )
            op.create_index("ix_empresas_status", "empresas", ["status"])

    # ===== OPORTUNIDADES =====
    if "oportunidades" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("oportunidades")}
        if "tags" not in cols:
            op.add_column("oportunidades", sa.Column("tags", postgresql.JSON(astext_type=sa.Text()), nullable=True))

    # ===== PIPELINE_ESTAGIOS =====
    if "pipeline_estagios" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("pipeline_estagios")}
        if "color" not in cols:
            op.add_column("pipeline_estagios", sa.Column("color", sa.String(20), nullable=True))

    # ===== ATIVIDADES — unificação com tarefas =====
    if "atividades" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("atividades")}

        atividade_status = sa.Enum("pendente", "em_andamento", "concluida", "cancelada", name="atividade_status")
        atividade_prio = sa.Enum("baixa", "media", "alta", "urgente", name="atividade_prioridade")
        atividade_status.create(bind, checkfirst=True)
        atividade_prio.create(bind, checkfirst=True)

        if "status" not in cols:
            op.add_column("atividades", sa.Column("status", atividade_status, nullable=False, server_default="concluida"))
            op.create_index("ix_atividades_status", "atividades", ["status"])
        if "prioridade" not in cols:
            op.add_column("atividades", sa.Column("prioridade", atividade_prio, nullable=False, server_default="media"))
        if "due_date" not in cols:
            op.add_column("atividades", sa.Column("due_date", sa.DateTime(timezone=True), nullable=True))
            op.create_index("ix_atividades_due_date", "atividades", ["due_date"])
        if "concluida_em" not in cols:
            op.add_column("atividades", sa.Column("concluida_em", sa.DateTime(timezone=True), nullable=True))
        if "assignee_id" not in cols:
            op.add_column("atividades", sa.Column("assignee_id", sa.Integer(), nullable=True))
            op.create_foreign_key(None, "atividades", "users", ["assignee_id"], ["id"])
            op.create_index("ix_atividades_assignee_id", "atividades", ["assignee_id"])
        if "updated_at" not in cols:
            op.add_column(
                "atividades",
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            )

        # Tornar data_atividade nullable
        try:
            op.alter_column("atividades", "data_atividade", nullable=True)
        except Exception:
            pass

        # Adicionar 'tarefa' ao enum tipo_atividade (Postgres-only)
        if bind.dialect.name == "postgresql":
            op.execute("ALTER TYPE tipo_atividade ADD VALUE IF NOT EXISTS 'tarefa'")

    # ===== Migrar tarefas → atividades e dropar tarefas =====
    if "tarefas" in existing_tables:
        op.execute(
            """
            INSERT INTO atividades
                (tipo, titulo, descricao, status, prioridade, due_date,
                 concluida_em, empresa_id, oportunidade_id, lead_id,
                 user_id, assignee_id, created_at, updated_at)
            SELECT
                'tarefa'::tipo_atividade,
                titulo,
                descricao,
                status::text::atividade_status,
                prioridade::text::atividade_prioridade,
                due_date,
                concluida_em,
                empresa_id,
                oportunidade_id,
                lead_id,
                COALESCE(created_by_id, assignee_id),
                assignee_id,
                created_at,
                updated_at
            FROM tarefas
            """
        )
        op.drop_table("tarefas")
        for enum in ("tarefa_status", "tarefa_prioridade"):
            try:
                sa.Enum(name=enum).drop(bind, checkfirst=True)
            except Exception:
                pass

    # ===== NOTIFICATIONS (nova tabela) =====
    if "notifications" not in existing_tables:
        notif_kind = sa.Enum(
            "pncp_match", "deal_moved", "mention", "sla_risk", "ai_summary", "sistema",
            name="notification_kind",
        )
        notif_kind.create(bind, checkfirst=True)
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("kind", notif_kind, nullable=False),
            sa.Column("titulo", sa.String(180), nullable=False),
            sa.Column("mensagem", sa.Text(), nullable=True),
            sa.Column("link", sa.String(255), nullable=True),
            sa.Column("lida", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
        op.create_index("ix_notifications_lida", "notifications", ["lida"])
        op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    pass
