from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.contato import Contato
from app.models.empresa import Empresa
from app.schemas.common import Page
from app.schemas.contato import ContatoCreate, ContatoOut, ContatoUpdate

router = APIRouter()


@router.get("", response_model=Page[ContatoOut])
def list_contatos(
    db: DBSession,
    _: CurrentUser,
    empresa_id: int | None = None,
    decisor: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    query = db.query(Contato)
    if empresa_id:
        query = query.filter(Contato.empresa_id == empresa_id)
    if decisor is not None:
        query = query.filter(Contato.decisor == decisor)
    total = query.with_entities(func.count(Contato.id)).scalar() or 0
    items = query.order_by(Contato.nome).offset((page - 1) * size).limit(size).all()
    return Page[ContatoOut](items=items, total=total, page=page, size=size)


@router.get("/{contato_id}", response_model=ContatoOut)
def get_contato(contato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    return c


@router.post("", response_model=ContatoOut, status_code=status.HTTP_201_CREATED)
def create_contato(payload: ContatoCreate, db: DBSession, current: CurrentUser):
    if not db.get(Empresa, payload.empresa_id):
        raise HTTPException(status_code=400, detail="Empresa inexistente")
    contato = Contato(**payload.model_dump(), created_by_id=current.id)
    if contato.owner_id is None:
        contato.owner_id = current.id
    db.add(contato)
    db.commit()
    db.refresh(contato)
    return contato


@router.patch("/{contato_id}", response_model=ContatoOut)
def update_contato(contato_id: int, payload: ContatoUpdate, db: DBSession, _: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{contato_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contato(contato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    db.delete(c)
    db.commit()
