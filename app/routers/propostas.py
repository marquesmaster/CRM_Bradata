from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DBSession
from app.models.oportunidade import Oportunidade
from app.models.proposta import Proposta, PropostaStatus
from app.schemas.proposta import PropostaCreate, PropostaOut, PropostaUpdate
from app.models.notification import NotificationKind
from app.services.historico import log_event
from app.services import notify

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
    db.flush()
    log_event(db, current.id, "proposta", p.id, "criou",
              {"titulo": p.titulo, "valor_total": p.valor_total, "oportunidade_id": p.oportunidade_id})
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{proposta_id}", response_model=PropostaOut)
def update_proposta(proposta_id: int, payload: PropostaUpdate, db: DBSession, current: CurrentUser):
    p = db.get(Proposta, proposta_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    before_status = p.status
    for k, v in data.items():
        setattr(p, k, v)
    if new_status == PropostaStatus.enviada and p.enviada_em is None:
        p.enviada_em = datetime.now(timezone.utc)
    if new_status == PropostaStatus.aceita and p.aceita_em is None:
        p.aceita_em = datetime.now(timezone.utc)
    if new_status == PropostaStatus.rejeitada and p.rejeitada_em is None:
        p.rejeitada_em = datetime.now(timezone.utc)
    if new_status and before_status != p.status:
        log_event(db, current.id, "proposta", p.id, f"status_{p.status.value}",
                  {"de": before_status.value, "para": p.status.value, "motivo": getattr(p, "motivo_rejeicao", None)})
        # Notifica owner do deal quando proposta muda de status
        from app.models.oportunidade import Oportunidade as _Op
        op = db.get(_Op, p.oportunidade_id) if p.oportunidade_id else None
        if op and op.owner_id and op.owner_id != current.id:
            if p.status == PropostaStatus.aceita:
                notify.push(db, op.owner_id, NotificationKind.deal_moved,
                            f"✓ Proposta aceita: {p.titulo}",
                            f"Deal: {op.titulo}", link=f"deal:{op.id}")
            elif p.status == PropostaStatus.rejeitada:
                notify.push(db, op.owner_id, NotificationKind.deal_moved,
                            f"Proposta rejeitada: {p.titulo}",
                            f"Motivo: {getattr(p,'motivo_rejeicao',None) or 'sem motivo'}", link=f"deal:{op.id}")
            elif p.status == PropostaStatus.enviada:
                notify.push(db, op.owner_id, NotificationKind.sistema,
                            f"Proposta enviada: {p.titulo}",
                            f"Aguardando resposta do cliente", link=f"deal:{op.id}")
    elif data:
        log_event(db, current.id, "proposta", p.id, "atualizou", {"campos": list(data.keys())})
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{proposta_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proposta(proposta_id: int, db: DBSession, current: CurrentUser):
    p = db.get(Proposta, proposta_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    log_event(db, current.id, "proposta", p.id, "excluiu", {"titulo": p.titulo})
    db.delete(p)
    db.commit()
