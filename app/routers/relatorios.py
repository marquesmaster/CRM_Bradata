from datetime import datetime, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.atividade import Atividade, AtividadeStatus
from app.models.empresa import Empresa
from app.models.lead import Lead, LeadStatus
from app.models.oportunidade import Oportunidade, OportunidadeStatus, Pipeline, PipelineEstagio
from app.models.pncp import PncpContrato, PncpResultado
from app.models.user import User
from app.services.analytics import compute_analytics

router = APIRouter()


@router.get("/analytics")
def analytics(db: DBSession, _: CurrentUser):
    """ROI, CAC, LTV, comissão, clientes por recência, deals."""
    return compute_analytics(db)


@router.get("/dashboard")
def dashboard(db: DBSession, _: CurrentUser):
    total_empresas = db.query(func.count(Empresa.id)).scalar() or 0
    total_empresas_icp = db.query(func.count(Empresa.id)).filter(Empresa.is_icp.is_(True)).scalar() or 0
    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    leads_por_status = dict(
        db.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all()
    )
    total_oportunidades_abertas = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.status == OportunidadeStatus.aberta)
        .scalar()
        or 0
    )
    pipeline_valor_aberto = (
        db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
        .filter(Oportunidade.status == OportunidadeStatus.aberta)
        .scalar()
    )
    total_contratos_pncp = db.query(func.count(PncpContrato.id)).scalar() or 0
    total_fornecedores = (
        db.query(func.count(func.distinct(PncpResultado.ni_fornecedor)))
        .filter(PncpResultado.ni_fornecedor.isnot(None))
        .scalar()
        or 0
    )
    tarefas_abertas = (
        db.query(func.count(Atividade.id))
        .filter(Atividade.status != AtividadeStatus.concluida, Atividade.due_date.isnot(None))
        .scalar()
        or 0
    )
    return {
        "empresas": {"total": total_empresas, "icp": total_empresas_icp},
        "leads": {"total": total_leads, "por_status": {k.value if hasattr(k, "value") else str(k): v for k, v in leads_por_status.items()}},
        "oportunidades": {
            "abertas": total_oportunidades_abertas,
            "valor_aberto": float(pipeline_valor_aberto or 0),
        },
        "pncp": {"contratos": total_contratos_pncp, "fornecedores_distintos": total_fornecedores},
        "tarefas_abertas": tarefas_abertas,
    }


@router.get("/funil")
def funil_por_pipeline(db: DBSession, _: CurrentUser, pipeline_id: int | None = None):
    query = (
        db.query(
            Pipeline.id,
            Pipeline.nome,
            PipelineEstagio.id,
            PipelineEstagio.nome,
            PipelineEstagio.ordem,
            func.count(Oportunidade.id),
            func.coalesce(func.sum(Oportunidade.valor_estimado), 0),
        )
        .join(PipelineEstagio, PipelineEstagio.pipeline_id == Pipeline.id)
        .outerjoin(
            Oportunidade,
            (Oportunidade.estagio_id == PipelineEstagio.id)
            & (Oportunidade.status == OportunidadeStatus.aberta),
        )
        .group_by(Pipeline.id, Pipeline.nome, PipelineEstagio.id, PipelineEstagio.nome, PipelineEstagio.ordem)
        .order_by(Pipeline.id, PipelineEstagio.ordem)
    )
    if pipeline_id:
        query = query.filter(Pipeline.id == pipeline_id)

    pipelines: dict = {}
    for pid, pnome, eid, enome, eordem, qtd, valor in query.all():
        pipelines.setdefault(pid, {"id": pid, "nome": pnome, "estagios": []})
        pipelines[pid]["estagios"].append(
            {"id": eid, "nome": enome, "ordem": eordem, "qtd": int(qtd or 0), "valor": float(valor or 0)}
        )
    return list(pipelines.values())


@router.get("/bdr")
def por_bdr(db: DBSession, _: CurrentUser):
    users = db.query(User).filter(User.is_active.is_(True)).all()
    out = []
    for u in users:
        leads = db.query(func.count(Lead.id)).filter(Lead.owner_id == u.id).scalar() or 0
        leads_q = (
            db.query(func.count(Lead.id))
            .filter(Lead.owner_id == u.id, Lead.status == LeadStatus.qualificado)
            .scalar()
            or 0
        )
        ops_abertas = (
            db.query(func.count(Oportunidade.id))
            .filter(Oportunidade.owner_id == u.id, Oportunidade.status == OportunidadeStatus.aberta)
            .scalar()
            or 0
        )
        ops_ganhas = (
            db.query(func.count(Oportunidade.id))
            .filter(Oportunidade.owner_id == u.id, Oportunidade.status == OportunidadeStatus.ganha)
            .scalar()
            or 0
        )
        valor_ganho = (
            db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
            .filter(Oportunidade.owner_id == u.id, Oportunidade.status == OportunidadeStatus.ganha)
            .scalar()
            or 0
        )
        atividades_30d = (
            db.query(func.count(Atividade.id))
            .filter(Atividade.user_id == u.id)
            .scalar()
            or 0
        )
        out.append(
            {
                "user_id": u.id,
                "nome": u.nome,
                "role": u.role.value,
                "leads": int(leads),
                "leads_qualificados": int(leads_q),
                "oportunidades_abertas": int(ops_abertas),
                "oportunidades_ganhas": int(ops_ganhas),
                "valor_ganho": float(valor_ganho),
                "atividades": int(atividades_30d),
            }
        )
    return out


@router.get("/icp")
def empresas_icp(
    db: DBSession,
    _: CurrentUser,
    min_score: int = Query(40, ge=0, le=100),
    limit: int = Query(100, ge=1, le=500),
):
    empresas = (
        db.query(Empresa)
        .filter(Empresa.icp_score.isnot(None), Empresa.icp_score >= min_score)
        .order_by(Empresa.icp_score.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "cnpj": e.cnpj,
            "razao_social": e.razao_social,
            "cnae_principal": e.cnae_principal,
            "faturamento_estimado": e.faturamento_estimado,
            "porte": e.porte,
            "uf": e.uf,
            "is_icp": e.is_icp,
            "icp_score": e.icp_score,
            "icp_motivo": e.icp_motivo,
        }
        for e in empresas
    ]


@router.get("/pncp/top-fornecedores")
def top_fornecedores_pncp(db: DBSession, _: CurrentUser, limit: int = Query(50, ge=1, le=500)):
    rows = (
        db.query(
            PncpResultado.ni_fornecedor,
            PncpResultado.nome_razao_social_fornecedor,
            func.count(PncpResultado.id),
            func.coalesce(func.sum(PncpResultado.valor_total_homologado), 0),
        )
        .filter(PncpResultado.ni_fornecedor.isnot(None))
        .group_by(PncpResultado.ni_fornecedor, PncpResultado.nome_razao_social_fornecedor)
        .order_by(func.coalesce(func.sum(PncpResultado.valor_total_homologado), 0).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "cnpj": cnpj,
            "razao_social": razao,
            "qtd_contratos": int(qtd or 0),
            "valor_total_homologado": float(valor or 0),
        }
        for cnpj, razao, qtd, valor in rows
    ]


@router.get("/saude")
def saude(db: DBSession, _: CurrentUser):
    return {
        "now": datetime.now(timezone.utc).isoformat(),
        "empresas": db.query(func.count(Empresa.id)).scalar() or 0,
        "pncp_contratos": db.query(func.count(PncpContrato.id)).scalar() or 0,
    }
