from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from sqlalchemy import func, or_

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.core.database import SessionLocal
from app.models.pncp import (
    PncpCompra,
    PncpCompraItem,
    PncpContrato,
    PncpResultado,
)
from app.schemas.common import Page
from app.schemas.pncp import (
    EtlRunRequest,
    PncpCompraItemOut,
    PncpCompraOut,
    PncpContratoOut,
    PncpResultadoOut,
)
from app.services.ai_classifier import classificar_contrato
from app.services.pncp.compra import (
    ingest_compra_by_contrato,
    ingest_compra_itens,
    ingest_compra_resultados,
)
from app.services.pncp.contrato import ingest_contrato_detalhe
from app.services.pncp.etl import run_full_etl

router = APIRouter()


@router.get("/contratos", response_model=Page[PncpContratoOut])
def list_contratos(
    db: DBSession,
    _: CurrentUser,
    q: str | None = None,
    uf: str | None = None,
    orgao_cnpj: str | None = None,
    processado: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    query = db.query(PncpContrato)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(PncpContrato.titulo.ilike(like), PncpContrato.descricao.ilike(like)))
    if uf:
        query = query.filter(PncpContrato.uf == uf.upper())
    if orgao_cnpj:
        query = query.filter(PncpContrato.orgao_cnpj == orgao_cnpj)
    if processado is not None:
        query = query.filter(PncpContrato.resultados_processados == processado)

    total = query.with_entities(func.count(PncpContrato.id)).scalar() or 0
    items = query.order_by(PncpContrato.data_publicacao_pncp.desc().nullslast()).offset((page - 1) * size).limit(size).all()
    return Page[PncpContratoOut](items=items, total=total, page=page, size=size)


@router.get("/contratos/{contrato_id}", response_model=PncpContratoOut)
def get_contrato(contrato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(PncpContrato, contrato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato PNCP não encontrado")
    return c


@router.post("/contratos/{contrato_id}/detalhe", response_model=PncpContratoOut)
def processar_detalhe(contrato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(PncpContrato, contrato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato PNCP não encontrado")
    ingest_contrato_detalhe(db, c)
    return c


@router.post("/contratos/{contrato_id}/compra", response_model=PncpCompraOut)
def processar_compra(contrato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(PncpContrato, contrato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato PNCP não encontrado")
    compra = ingest_compra_by_contrato(db, c)
    if not compra:
        raise HTTPException(status_code=400, detail="Não foi possível resolver a compra do contrato")
    ingest_compra_itens(db, compra)
    ingest_compra_resultados(db, compra)
    return compra


@router.get("/compras/{compra_id}", response_model=PncpCompraOut)
def get_compra(compra_id: int, db: DBSession, _: CurrentUser):
    c = db.get(PncpCompra, compra_id)
    if not c:
        raise HTTPException(status_code=404, detail="Compra PNCP não encontrada")
    return c


@router.get("/compras/{compra_id}/itens", response_model=list[PncpCompraItemOut])
def list_itens(compra_id: int, db: DBSession, _: CurrentUser):
    return (
        db.query(PncpCompraItem)
        .filter(PncpCompraItem.compra_id == compra_id)
        .order_by(PncpCompraItem.numero_item)
        .all()
    )


@router.get("/itens/{item_id}/resultados", response_model=list[PncpResultadoOut])
def list_resultados(item_id: int, db: DBSession, _: CurrentUser):
    return (
        db.query(PncpResultado)
        .filter(PncpResultado.item_id == item_id)
        .order_by(PncpResultado.sequencial_resultado)
        .all()
    )


def _run_etl_job(payload: EtlRunRequest, triggered_by_id: int | None = None) -> None:
    with SessionLocal() as db:
        run_full_etl(
            db,
            tipos_documento=payload.tipos_documento,
            keywords=payload.keywords or None,
            ufs=payload.ufs or None,
            status=payload.status,
            max_paginas=payload.max_paginas,
            max_workers=payload.max_workers,
            detalhe_limit=payload.detalhe_limit,
            classify_with_ai=payload.classify_with_ai,
            enrich_contacts=payload.enrich_contacts,
            triggered_by_id=triggered_by_id,
        )


@router.post("/etl/run")
def run_etl(payload: EtlRunRequest, bg: BackgroundTasks, current: AdminUser):
    """Dispara o ETL completo em background."""
    bg.add_task(_run_etl_job, payload, current.id)
    return {"message": "ETL PNCP agendado em background", "payload": payload.model_dump()}


@router.post("/contratos/{contrato_id}/classificar-ia")
def classificar_contrato_ia(contrato_id: int, db: DBSession, _: CurrentUser):
    """Roda o classificador IA bodyshop sob demanda."""
    from datetime import datetime, timezone
    c = db.get(PncpContrato, contrato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contrato PNCP não encontrado")
    res = classificar_contrato(c.titulo or "", c.descricao or "", c.valor_global)
    if not res:
        raise HTTPException(status_code=502, detail="Classificador IA indisponível ou sem API key")
    c.ai_classificacao = (res.get("classificacao") or "").upper() or None
    c.ai_confianca = res.get("confianca")
    c.ai_motivo = res.get("motivo")
    c.ai_tipo_servico = res.get("tipo_servico")
    c.ai_oportunidade = res.get("oportunidade_bodyshop")
    c.ai_processado_em = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return {
        "id": c.id,
        "ai_classificacao": c.ai_classificacao,
        "ai_confianca": c.ai_confianca,
        "ai_motivo": c.ai_motivo,
        "ai_tipo_servico": c.ai_tipo_servico,
        "ai_oportunidade": c.ai_oportunidade,
    }
