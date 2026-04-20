from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.tarefa import Tarefa, TarefaStatus
from app.schemas.common import Page
from app.schemas.tarefa import TarefaCreate, TarefaOut, TarefaUpdate

router = APIRouter()


@router.get("", response_model=Page[TarefaOut])
def list_tarefas(
    db: DBSession,
    _: CurrentUser,
    assignee_id: int | None = None,
    status_: TarefaStatus | None = Query(None, alias="status"),
    empresa_id: int | None = None,
    oportunidade_id: int | None = None,
    overdue: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    query = db.query(Tarefa)
    if assignee_id:
        query = query.filter(Tarefa.assignee_id == assignee_id)
    if status_:
        query = query.filter(Tarefa.status == status_)
    if empresa_id:
        query = query.filter(Tarefa.empresa_id == empresa_id)
    if oportunidade_id:
        query = query.filter(Tarefa.oportunidade_id == oportunidade_id)
    if overdue:
        now = datetime.now(timezone.utc)
        query = query.filter(Tarefa.due_date < now, Tarefa.status != TarefaStatus.concluida)
    total = query.with_entities(func.count(Tarefa.id)).scalar() or 0
    items = query.order_by(Tarefa.due_date.asc().nullslast()).offset((page - 1) * size).limit(size).all()
    return Page[TarefaOut](items=items, total=total, page=page, size=size)


@router.post("", response_model=TarefaOut, status_code=status.HTTP_201_CREATED)
def create_tarefa(payload: TarefaCreate, db: DBSession, current: CurrentUser):
    t = Tarefa(**payload.model_dump(), created_by_id=current.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{tarefa_id}", response_model=TarefaOut)
def update_tarefa(tarefa_id: int, payload: TarefaUpdate, db: DBSession, _: CurrentUser):
    t = db.get(Tarefa, tarefa_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    for k, v in data.items():
        setattr(t, k, v)
    if new_status == TarefaStatus.concluida and t.concluida_em is None:
        t.concluida_em = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{tarefa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tarefa(tarefa_id: int, db: DBSession, _: CurrentUser):
    t = db.get(Tarefa, tarefa_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    db.delete(t)
    db.commit()
