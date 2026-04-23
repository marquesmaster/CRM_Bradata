"""frontend alignment — no-op em instalações novas

Revision ID: 0002_frontend_alignment
Revises: 0001_initial
Create Date: 2026-04-20

Em instalações limpas, 0001_initial roda Base.metadata.create_all() que já
reflete o schema final dos models (incluindo campos de alinhamento com o
frontend, notifications, AI, sector, status etc.).

Esta migração só é relevante para bancos que foram criados em uma versão
anterior do schema. Para mantê-la idempotente e evitar falhas de duplicate
index/column em instalações novas, mantemos como no-op por padrão. Se você
precisa aplicar os alters num banco legado, use ferramentas manuais ou
restaure esta migration a partir do histórico do git.
"""

revision = "0002_frontend_alignment"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
