"""etl_runs + automacoes + propostas

Revision ID: 0004_etl_runs_automacoes
Revises: 0003_pncp_ai_fields
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_etl_runs_automacoes"
down_revision = "0003_pncp_ai_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "etl_runs" not in existing:
        etl_status = sa.Enum("running", "done", "error", "canceled", name="etl_run_status")
        etl_status.create(bind, checkfirst=True)
        op.create_table(
            "etl_runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tipo", sa.String(40), nullable=False, server_default="pncp_full"),
            sa.Column("status", etl_status, nullable=False, server_default="running"),
            sa.Column("iniciado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("finalizado_em", sa.DateTime(timezone=True), nullable=True),
            sa.Column("duracao_seg", sa.Float(), nullable=True),
            sa.Column("payload", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("resumo", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("contratos_a_processar", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("contratos_ok", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("contratos_com_erro", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("itens_novos", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("empresas_sincronizadas", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ai_processados", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("mensagem_erro", sa.Text(), nullable=True),
            sa.Column("triggered_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_etl_runs_tipo", "etl_runs", ["tipo"])
        op.create_index("ix_etl_runs_status", "etl_runs", ["status"])
        op.create_index("ix_etl_runs_iniciado_em", "etl_runs", ["iniciado_em"])
        op.create_index("ix_etl_runs_triggered_by_id", "etl_runs", ["triggered_by_id"])

    if "automacoes" not in existing:
        auto_kind = sa.Enum(
            "template_email", "template_whatsapp", "alerta_inatividade",
            "alerta_sla", "cadencia_followup", "regra_score_empresa",
            name="automacao_kind",
        )
        auto_kind.create(bind, checkfirst=True)
        op.create_table(
            "automacoes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("nome", sa.String(180), nullable=False),
            sa.Column("kind", auto_kind, nullable=False),
            sa.Column("descricao", sa.Text(), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("config", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("assunto", sa.String(255), nullable=True),
            sa.Column("corpo", sa.Text(), nullable=True),
            sa.Column("executada_n_vezes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ultima_execucao", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_automacoes_kind", "automacoes", ["kind"])
        op.create_index("ix_automacoes_ativo", "automacoes", ["ativo"])

    if "propostas" not in existing:
        prop_status = sa.Enum(
            "rascunho", "enviada", "em_analise", "aceita", "rejeitada", "expirada",
            name="proposta_status",
        )
        prop_status.create(bind, checkfirst=True)
        op.create_table(
            "propostas",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("oportunidade_id", sa.Integer(), sa.ForeignKey("oportunidades.id", ondelete="CASCADE"), nullable=False),
            sa.Column("titulo", sa.String(255), nullable=False),
            sa.Column("numero", sa.String(60), nullable=True),
            sa.Column("versao", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("status", prop_status, nullable=False, server_default="rascunho"),
            sa.Column("valor_total", sa.Float(), nullable=True),
            sa.Column("desconto_percentual", sa.Float(), nullable=True),
            sa.Column("escopo", sa.Text(), nullable=True),
            sa.Column("condicoes_pagamento", sa.Text(), nullable=True),
            sa.Column("prazo_execucao", sa.String(120), nullable=True),
            sa.Column("perfis", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("pdf_url", sa.String(500), nullable=True),
            sa.Column("enviada_em", sa.DateTime(timezone=True), nullable=True),
            sa.Column("validade_em", sa.Date(), nullable=True),
            sa.Column("aceita_em", sa.DateTime(timezone=True), nullable=True),
            sa.Column("rejeitada_em", sa.DateTime(timezone=True), nullable=True),
            sa.Column("motivo_rejeicao", sa.Text(), nullable=True),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_propostas_oportunidade_id", "propostas", ["oportunidade_id"])
        op.create_index("ix_propostas_status", "propostas", ["status"])
        op.create_index("ix_propostas_numero", "propostas", ["numero"])


def downgrade() -> None:
    pass
