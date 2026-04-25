from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_

from app.core.deps import CurrentUser, DBSession
from app.models.atividade import Atividade, AtividadeStatus, TipoAtividade
from app.schemas.atividade import AtividadeCreate, AtividadeOut, AtividadeUpdate
from app.schemas.common import Page
from app.models.notification import NotificationKind
from app.services.historico import log_event
from app.services import notify
from app.services.soft_delete import soft_delete, restore, filter_active

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
    assignee_id: int | None = None,
    status_: AtividadeStatus | None = Query(None, alias="status"),
    overdue: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
):
    query = db.query(Atividade)
    if not include_deleted:
        query = filter_active(query, Atividade)
    if empresa_id:
        query = query.filter(Atividade.empresa_id == empresa_id)
    if oportunidade_id:
        query = query.filter(Atividade.oportunidade_id == oportunidade_id)
    if contato_id:
        query = query.filter(Atividade.contato_id == contato_id)
    if tipo:
        query = query.filter(Atividade.tipo == tipo)
    if user_id:
        query = query.filter(or_(Atividade.user_id == user_id, Atividade.assignee_id == user_id))
    if assignee_id:
        query = query.filter(Atividade.assignee_id == assignee_id)
    if status_:
        query = query.filter(Atividade.status == status_)
    if overdue:
        now = datetime.now(timezone.utc)
        query = query.filter(Atividade.due_date < now, Atividade.status != AtividadeStatus.concluida)

    total = query.with_entities(func.count(Atividade.id)).scalar() or 0
    items = (
        query.order_by(
            Atividade.due_date.asc().nullslast(),
            Atividade.data_atividade.desc().nullslast(),
        )
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return Page[AtividadeOut](items=items, total=total, page=page, size=size)


@router.post("", response_model=AtividadeOut, status_code=status.HTTP_201_CREATED)
def create_atividade(payload: AtividadeCreate, db: DBSession, current: CurrentUser):
    at = Atividade(**payload.model_dump(), user_id=current.id)
    if at.assignee_id is None:
        at.assignee_id = current.id
    if at.status == AtividadeStatus.concluida and at.concluida_em is None:
        at.concluida_em = datetime.now(timezone.utc)
    db.add(at)
    db.flush()
    log_event(db, current.id, "atividade", at.id, "criou", {
        "tipo": at.tipo.value, "titulo": at.titulo, "due_date": str(at.due_date) if at.due_date else None,
    })
    # Notifica assignee se for outro user
    if at.assignee_id and at.assignee_id != current.id:
        notify.push(db, at.assignee_id, NotificationKind.mention,
                    f"Atividade atribuída: {at.titulo}",
                    f"De {current.nome} · {at.tipo.value}",
                    link=f"atividade:{at.id}")
    db.commit()
    db.refresh(at)
    return at


@router.patch("/{atividade_id}", response_model=AtividadeOut)
def update_atividade(atividade_id: int, payload: AtividadeUpdate, db: DBSession, current: CurrentUser):
    at = db.get(Atividade, atividade_id)
    if not at:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    before_status = at.status
    for k, v in data.items():
        setattr(at, k, v)
    if new_status == AtividadeStatus.concluida and at.concluida_em is None:
        at.concluida_em = datetime.now(timezone.utc)
    if new_status and before_status != at.status:
        log_event(db, current.id, "atividade", at.id, f"status_{at.status.value}",
                  {"de": before_status.value, "para": at.status.value})
    elif data:
        log_event(db, current.id, "atividade", at.id, "atualizou", {"campos": list(data.keys())})
    db.commit()
    db.refresh(at)
    return at


@router.delete("/{atividade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_atividade(atividade_id: int, db: DBSession, current: CurrentUser):
    at = db.get(Atividade, atividade_id)
    if not at:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    log_event(db, current.id, "atividade", at.id, "excluiu", {"titulo": at.titulo})
    soft_delete(db, current.id, at)
    db.commit()


@router.post("/{atividade_id}/restore", response_model=AtividadeOut)
def restore_atividade(atividade_id: int, db: DBSession, current: CurrentUser):
    at = db.get(Atividade, atividade_id)
    if not at:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    restore(at)
    log_event(db, current.id, "atividade", at.id, "restaurou", None)
    db.commit()
    db.refresh(at)
    return at
