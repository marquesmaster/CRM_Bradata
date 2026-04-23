from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DBSession
from app.models.oportunidade import Oportunidade
from app.models.proposta import Proposta, PropostaStatus
from app.schemas.proposta import PropostaCreate, PropostaOut, PropostaUpdate

router = APIRouter()


@router.get("", response_model=list[PropostaOut])
def list_propostas(
    db: DBSession,
    _: CurrentUser,
    oportunidade_id: int | None = None,
    status_: PropostaStatus | None = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
):
    q = db.query(Proposta)
    if oportunidade_id:
        q = q.filter(Proposta.oportunidade_id == oportunidade_id)
    if status_:
        q = q.filter(Proposta.status == status_)
    return q.order_by(Proposta.created_at.desc()).limit(limit).all()


@router.get("/{proposta_id}", response_model=PropostaOut)
def get_proposta(proposta_id: int, db: DBSession, _: CurrentUser):
    p = db.get(Proposta, proposta_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    return p


@router.post("", response_model=PropostaOut, status_code=status.HTTP_201_CREATED)
def create_proposta(payload: PropostaCreate, db: DBSession, current: CurrentUser):
    if not db.get(Oportunidade, payload.oportunidade_id):
        raise HTTPException(status_code=400, detail="Oportunidade inexistente")
    p = Proposta(**payload.model_dump(), created_by_id=current.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{proposta_id}", response_model=PropostaOut)
def update_proposta(proposta_id: int, payload: PropostaUpdate, db: DBSession, _: CurrentUser):
    p = db.get(Proposta, proposta_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    for k, v in data.items():
        setattr(p, k, v)
    if new_status == PropostaStatus.enviada and p.enviada_em is None:
        p.enviada_em = datetime.now(timezone.utc)
    if new_status == PropostaStatus.aceita and p.aceita_em is None:
        p.aceita_em = datetime.now(timezone.utc)
    if new_status == PropostaStatus.rejeitada and p.rejeitada_em is None:
        p.rejeitada_em = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{proposta_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proposta(proposta_id: int, db: DBSession, _: CurrentUser):
    p = db.get(Proposta, proposta_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    db.delete(p)
    db.commit()
