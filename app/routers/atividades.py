from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.atividade import Atividade, TipoAtividade
from app.schemas.atividade import AtividadeCreate, AtividadeOut, AtividadeUpdate
from app.schemas.common import Page

router = APIRouter()


@router.get("", response_model=Page[AtividadeOut])
def list_atividades(
    db: DBSession,
    _: CurrentUser,
    empresa_id: int | None = None,
    oportunidade_id: int | None = None,
    contato_id: int | None = None,
    tipo: TipoAtividade | None = None,
    user_id: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    query = db.query(Atividade)
    if empresa_id:
        query = query.filter(Atividade.empresa_id == empresa_id)
    if oportunidade_id:
        query = query.filter(Atividade.oportunidade_id == oportunidade_id)
    if contato_id:
        query = query.filter(Atividade.contato_id == contato_id)
    if tipo:
        query = query.filter(Atividade.tipo == tipo)
    if user_id:
        query = query.filter(Atividade.user_id == user_id)
    total = query.with_entities(func.count(Atividade.id)).scalar() or 0
    items = query.order_by(Atividade.data_atividade.desc()).offset((page - 1) * size).limit(size).all()
    return Page[AtividadeOut](items=items, total=total, page=page, size=size)


@router.post("", response_model=AtividadeOut, status_code=status.HTTP_201_CREATED)
def create_atividade(payload: AtividadeCreate, db: DBSession, current: CurrentUser):
    at = Atividade(**payload.model_dump(), user_id=current.id)
    db.add(at)
    db.commit()
    db.refresh(at)
    return at


@router.patch("/{atividade_id}", response_model=AtividadeOut)
def update_atividade(atividade_id: int, payload: AtividadeUpdate, db: DBSession, _: CurrentUser):
    at = db.get(Atividade, atividade_id)
    if not at:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(at, k, v)
    db.commit()
    db.refresh(at)
    return at


@router.delete("/{atividade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_atividade(atividade_id: int, db: DBSession, _: CurrentUser):
    at = db.get(Atividade, atividade_id)
    if not at:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    db.delete(at)
    db.commit()
