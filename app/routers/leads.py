from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.empresa import Empresa
from app.models.lead import Lead, LeadStatus
from app.models.oportunidade import Oportunidade, OportunidadeStatus, PipelineEstagio
from app.schemas.common import Page
from app.schemas.lead import LeadConvert, LeadCreate, LeadOut, LeadUpdate
from app.schemas.oportunidade import OportunidadeOut
from app.services.historico import log_event
from app.services.permissions import (
    assert_not_readonly,
    assert_owner_or_admin,
    filter_by_owner,
)
from app.services.soft_delete import filter_active, restore, soft_delete

router = APIRouter()


@router.get("", response_model=Page[LeadOut])
def list_leads(
    db: DBSession,
    current: CurrentUser,
    status_: LeadStatus | None = Query(None, alias="status"),
    owner_id: int | None = None,
    empresa_id: int | None = None,
    score_min: int | None = None,
    origem: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
):
    query = db.query(Lead)
    if not include_deleted:
        query = filter_active(query, Lead)
    query = filter_by_owner(query, Lead, current)
    if status_:
        query = query.filter(Lead.status == status_)
    if owner_id:
        query = query.filter(Lead.owner_id == owner_id)
    if empresa_id:
        query = query.filter(Lead.empresa_id == empresa_id)
    if score_min is not None:
        query = query.filter(Lead.score >= score_min)
    if origem:
        query = query.filter(Lead.origem == origem)
    total = query.with_entities(func.count(Lead.id)).scalar() or 0
    items = query.order_by(Lead.score.desc(), Lead.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return Page[LeadOut](items=items, total=total, page=page, size=size)


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: DBSession, _: CurrentUser):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: DBSession, current: CurrentUser):
    assert_not_readonly(current)
    if not db.get(Empresa, payload.empresa_id):
        raise HTTPException(status_code=400, detail="Empresa inexistente")
    lead = Lead(**payload.model_dump())
    if lead.owner_id is None:
        lead.owner_id = current.id
    db.add(lead)
    db.flush()
    log_event(db, current.id, "lead", lead.id, "criou",
              {"empresa_id": lead.empresa_id, "score": lead.score})
    db.commit()
    db.refresh(lead)
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: DBSession, current: CurrentUser):
    assert_not_readonly(current)
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    assert_owner_or_admin(lead, current)
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    before_status = lead.status
    for k, v in data.items():
        setattr(lead, k, v)
    if new_status == LeadStatus.qualificado and lead.qualificado_em is None:
        lead.qualificado_em = datetime.now(timezone.utc)
    if new_status and before_status != lead.status:
        log_event(db, current.id, "lead", lead.id, f"status_{lead.status.value}",
                  {"de": before_status.value, "para": lead.status.value})
    elif data:
        log_event(db, current.id, "lead", lead.id, "atualizou", {"campos": list(data.keys())})
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: DBSession, current: CurrentUser):
    assert_not_readonly(current)
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    assert_owner_or_admin(lead, current)
    log_event(db, current.id, "lead", lead.id, "excluiu", None)
    soft_delete(db, current.id, lead)
    db.commit()


@router.post("/{lead_id}/restore", response_model=LeadOut)
def restore_lead(lead_id: int, db: DBSession, current: CurrentUser):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    restore(lead)
    log_event(db, current.id, "lead", lead.id, "restaurou", None)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/converter", response_model=OportunidadeOut)
def converter_lead(lead_id: int, payload: LeadConvert, db: DBSession, current: CurrentUser):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    if lead.status == LeadStatus.convertido:
        raise HTTPException(status_code=400, detail="Lead já convertido")

    estagio = db.get(PipelineEstagio, payload.estagio_id)
    if not estagio or estagio.pipeline_id != payload.pipeline_id:
        raise HTTPException(status_code=400, detail="Estágio inválido para o pipeline")

    op = Oportunidade(
        titulo=payload.titulo_oportunidade,
        empresa_id=lead.empresa_id,
        contato_id=payload.contato_id or lead.contato_id,
        pipeline_id=payload.pipeline_id,
        estagio_id=payload.estagio_id,
        valor_estimado=payload.valor_estimado,
        owner_id=lead.owner_id or current.id,
        status=OportunidadeStatus.aberta,
    )
    db.add(op)
    db.flush()

    lead.status = LeadStatus.convertido
    lead.convertido_em = datetime.now(timezone.utc)
    lead.oportunidade_id = op.id
    db.commit()
    db.refresh(op)
    return op
