"""Analytics financeiro e de relacionamento.

Métricas produzidas:
- Pipeline: aberto, ganho YTD, valor ponderado
- Receita ganha: total + últimos 30/90 dias
- CAC (env), LTV (ticket médio × retenção), LTV/CAC ratio
- ROI estimado (ganho vs CAC acumulado)
- Comissão a pagar (% configurável × receita ganha)
- Clientes por recência de última atividade: 30/60/90/180/+180 (inativos)
- Deals: abertos, ganhos, perdidos, ticket médio, win rate, ciclo médio
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.atividade import Atividade
from app.models.empresa import Empresa, EmpresaStatus
from app.models.oportunidade import Oportunidade, OportunidadeStatus


def _pct(num: float, den: float) -> float:
    return round((num / den) * 100, 1) if den else 0.0


def compute_analytics(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    d60 = now - timedelta(days=60)
    d90 = now - timedelta(days=90)
    d180 = now - timedelta(days=180)

    # ---- Pipeline ----
    pipeline_aberto = (
        db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
        .filter(Oportunidade.status == OportunidadeStatus.aberta)
        .scalar()
    ) or 0.0
    pipeline_ponderado = (
        db.query(
            func.coalesce(
                func.sum(Oportunidade.valor_estimado * Oportunidade.probabilidade / 100.0), 0
            )
        )
        .filter(Oportunidade.status == OportunidadeStatus.aberta)
        .scalar()
    ) or 0.0
    receita_ganha_total = (
        db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
        .filter(Oportunidade.status == OportunidadeStatus.ganha)
        .scalar()
    ) or 0.0
    receita_ganha_30d = (
        db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
        .filter(
            Oportunidade.status == OportunidadeStatus.ganha,
            Oportunidade.data_fechamento_real >= d30.date(),
        )
        .scalar()
    ) or 0.0
    receita_ganha_90d = (
        db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
        .filter(
            Oportunidade.status == OportunidadeStatus.ganha,
            Oportunidade.data_fechamento_real >= d90.date(),
        )
        .scalar()
    ) or 0.0

    # ---- Deals counts ----
    deals_total = db.query(func.count(Oportunidade.id)).scalar() or 0
    deals_abertos = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.status == OportunidadeStatus.aberta)
        .scalar()
        or 0
    )
    deals_ganhos = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.status == OportunidadeStatus.ganha)
        .scalar()
        or 0
    )
    deals_perdidos = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.status == OportunidadeStatus.perdida)
        .scalar()
        or 0
    )
    ticket_medio = (
        db.query(func.coalesce(func.avg(Oportunidade.valor_estimado), 0))
        .filter(Oportunidade.status == OportunidadeStatus.ganha)
        .scalar()
    ) or 0.0
    # Ciclo médio (dias entre criação e fechamento real)
    ciclo_rows = (
        db.query(
            func.avg(
                func.extract(
                    "epoch",
                    func.coalesce(Oportunidade.data_fechamento_real, func.now())
                    - Oportunidade.created_at,
                )
            )
        )
        .filter(Oportunidade.status.in_([OportunidadeStatus.ganha, OportunidadeStatus.perdida]))
        .scalar()
    )
    ciclo_medio_dias = (ciclo_rows or 0) / 86400.0 if ciclo_rows else 0
    closed = deals_ganhos + deals_perdidos
    win_rate = _pct(deals_ganhos, closed)

    # ---- CAC / LTV / ROI / Comissão ----
    cac = float(settings.cac_mensal)
    meses_ativos = (
        db.query(func.count(func.distinct(func.date_trunc("month", Oportunidade.created_at))))
        .scalar()
        or 1
    )
    cac_acumulado = cac * max(meses_ativos, 1)
    ltv = float(ticket_medio or 0) * float(settings.ltv_meses_retencao) / 12.0  # anual proxy
    ltv_cac_ratio = round(ltv / cac, 2) if cac > 0 else 0.0
    roi_estimado = round(
        (float(receita_ganha_total) - cac_acumulado) / cac_acumulado, 2
    ) if cac_acumulado > 0 else 0.0
    comissao_rate = float(settings.commission_rate_percent) / 100.0
    comissao_total = float(receita_ganha_total) * comissao_rate
    comissao_90d = float(receita_ganha_90d) * comissao_rate

    # ---- Clientes por recência ----
    last_activity_subq = (
        db.query(
            Atividade.empresa_id.label("emp_id"),
            func.max(
                func.coalesce(Atividade.data_atividade, Atividade.created_at)
            ).label("last_ts"),
        )
        .filter(Atividade.empresa_id.isnot(None))
        .group_by(Atividade.empresa_id)
        .subquery()
    )

    clientes_total = db.query(func.count(Empresa.id)).scalar() or 0
    clientes_status_cliente = (
        db.query(func.count(Empresa.id))
        .filter(Empresa.status == EmpresaStatus.cliente)
        .scalar()
        or 0
    )

    # buckets de recência (clientes/empresas com status != inativo, que tiveram atividade)
    def _bucket(since_days: int | None, until_days: int | None) -> int:
        q = (
            db.query(func.count(Empresa.id))
            .outerjoin(last_activity_subq, Empresa.id == last_activity_subq.c.emp_id)
            .filter(Empresa.status != EmpresaStatus.inativo)
        )
        if since_days is not None:
            q = q.filter(last_activity_subq.c.last_ts >= now - timedelta(days=since_days))
        if until_days is not None:
            q = q.filter(last_activity_subq.c.last_ts < now - timedelta(days=until_days))
        return q.scalar() or 0

    ativos_30d = _bucket(30, None)
    ativos_60d = _bucket(60, 30)
    ativos_90d = _bucket(90, 60)
    ativos_180d = _bucket(180, 90)
    inativos_count = (
        db.query(func.count(Empresa.id))
        .outerjoin(last_activity_subq, Empresa.id == last_activity_subq.c.emp_id)
        .filter(
            (Empresa.status == EmpresaStatus.inativo)
            | (last_activity_subq.c.last_ts < now - timedelta(days=180))
            | (last_activity_subq.c.last_ts.is_(None))
        )
        .scalar()
        or 0
    )

    return {
        "pipeline": {
            "aberto": float(pipeline_aberto),
            "ponderado": float(pipeline_ponderado),
            "receita_ganha_total": float(receita_ganha_total),
            "receita_ganha_30d": float(receita_ganha_30d),
            "receita_ganha_90d": float(receita_ganha_90d),
        },
        "deals": {
            "total": int(deals_total),
            "abertos": int(deals_abertos),
            "ganhos": int(deals_ganhos),
            "perdidos": int(deals_perdidos),
            "ticket_medio": float(ticket_medio),
            "win_rate_pct": win_rate,
            "ciclo_medio_dias": round(ciclo_medio_dias, 1),
        },
        "financeiro": {
            "cac": cac,
            "cac_acumulado_estimado": cac_acumulado,
            "meses_ativos": int(meses_ativos),
            "ltv": round(ltv, 2),
            "ltv_cac_ratio": ltv_cac_ratio,
            "roi_estimado": roi_estimado,
            "comissao_rate_pct": float(settings.commission_rate_percent),
            "comissao_total": round(comissao_total, 2),
            "comissao_90d": round(comissao_90d, 2),
        },
        "clientes": {
            "total": int(clientes_total),
            "clientes_ativos": int(clientes_status_cliente),
            "ativos_30d": int(ativos_30d),
            "ativos_60d": int(ativos_60d),
            "ativos_90d": int(ativos_90d),
            "ativos_180d": int(ativos_180d),
            "inativos": int(inativos_count),
        },
    }
