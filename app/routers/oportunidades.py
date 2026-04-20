from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.empresa import Empresa
from app.models.oportunidade import Oportunidade, OportunidadeStatus, PipelineEstagio
from app.schemas.common import Page
from app.schemas.oportunidade import (
    OportunidadeCloseRequest,
    OportunidadeCreate,
    OportunidadeOut,
    OportunidadeUpdate,
)

router = APIRouter()


@router.get("", response_model=Page[OportunidadeOut])
def list_oportunidades(
    db: DBSession,
    _: CurrentUser,
    status_: OportunidadeStatus | None = Query(None, alias="status"),
    pipeline_id: int | None = None,
    estagio_id: int | None = None,
    owner_id: int | None = None,
    empresa_id: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    query = db.query(Oportunidade)
    if status_:
        query = query.filter(Oportunidade.status == status_)
    if pipeline_id:
        query = query.filter(Oportunidade.pipeline_id == pipeline_id)
    if estagio_id:
        query = query.filter(Oportunidade.estagio_id == estagio_id)
    if owner_id:
        query = query.filter(Oportunidade.owner_id == owner_id)
    if empresa_id:
        query = query.filter(Oportunidade.empresa_id == empresa_id)

    total = query.with_entities(func.count(Oportunidade.id)).scalar() or 0
    items = query.order_by(Oportunidade.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return Page[OportunidadeOut](items=items, total=total, page=page, size=size)


@router.get("/{op_id}", response_model=OportunidadeOut)
def get_oportunidade(op_id: int, db: DBSession, _: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    return op


@router.post("", response_model=OportunidadeOut, status_code=status.HTTP_201_CREATED)
def create_oportunidade(payload: OportunidadeCreate, db: DBSession, current: CurrentUser):
    if not db.get(Empresa, payload.empresa_id):
        raise HTTPException(status_code=400, detail="Empresa inexistente")
    estagio = db.get(PipelineEstagio, payload.estagio_id)
    if not estagio or estagio.pipeline_id != payload.pipeline_id:
        raise HTTPException(status_code=400, detail="Estágio inválido para o pipeline")
    op = Oportunidade(**payload.model_dump())
    if op.owner_id is None:
        op.owner_id = current.id
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


@router.patch("/{op_id}", response_model=OportunidadeOut)
def update_oportunidade(op_id: int, payload: OportunidadeUpdate, db: DBSession, _: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "estagio_id" in data:
        estagio = db.get(PipelineEstagio, data["estagio_id"])
        if not estagio or estagio.pipeline_id != op.pipeline_id:
            raise HTTPException(status_code=400, detail="Estágio inválido para o pipeline")
    for k, v in data.items():
        setattr(op, k, v)
    db.commit()
    db.refresh(op)
    return op


@router.post("/{op_id}/fechar", response_model=OportunidadeOut)
def fechar_oportunidade(op_id: int, payload: OportunidadeCloseRequest, db: DBSession, _: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    if payload.status == OportunidadeStatus.aberta:
        raise HTTPException(status_code=400, detail="Para reabrir, use PATCH")
    op.status = payload.status
    op.motivo_perda = payload.motivo_perda
    op.data_fechamento_real = date.today()
    db.commit()
    db.refresh(op)
    return op


@router.delete("/{op_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_oportunidade(op_id: int, db: DBSession, _: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    db.delete(op)
    db.commit()
