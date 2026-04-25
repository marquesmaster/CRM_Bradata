from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DBSession
from app.models.nota import Nota
from app.schemas.nota import NotaCreate, NotaOut
from app.services.soft_delete import soft_delete, filter_active

router = APIRouter()


@router.get("", response_model=list[NotaOut])
def list_notas(
    db: DBSession,
    _: CurrentUser,
    empresa_id: int | None = None,
    oportunidade_id: int | None = None,
    contato_id: int | None = None,
    lead_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    query = filter_active(db.query(Nota), Nota)
    if empresa_id:
        query = query.filter(Nota.empresa_id == empresa_id)
    if oportunidade_id:
        query = query.filter(Nota.oportunidade_id == oportunidade_id)
    if contato_id:
        query = query.filter(Nota.contato_id == contato_id)
    if lead_id:
        query = query.filter(Nota.lead_id == lead_id)
    return query.order_by(Nota.created_at.desc()).limit(limit).all()


@router.post("", response_model=NotaOut, status_code=status.HTTP_201_CREATED)
def create_nota(payload: NotaCreate, db: DBSession, current: CurrentUser):
    nota = Nota(**payload.model_dump(), user_id=current.id)
    db.add(nota)
    db.commit()
    db.refresh(nota)
    return nota


@router.delete("/{nota_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nota(nota_id: int, db: DBSession, current: CurrentUser):
    nota = db.get(Nota, nota_id)
    if not nota:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    if nota.user_id != current.id:
        raise HTTPException(status_code=403, detail="Apenas o autor pode remover a nota")
    soft_delete(db, current.id, nota)
    db.commit()
