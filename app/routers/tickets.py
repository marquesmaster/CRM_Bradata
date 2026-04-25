"""CRUD de tickets (chamados/suporte) + comentários."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_

from app.core.deps import CurrentUser, DBSession
from app.models.notification import NotificationKind
from app.models.ticket import (
    Ticket,
    TicketComment,
    TicketKind,
    TicketPrioridade,
    TicketStatus,
)
from app.models.user import User
from app.services import notify
from app.services.historico import log_event
from app.services.soft_delete import filter_active, restore, soft_delete

router = APIRouter()


class TicketIn(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    descricao: str | None = None
    kind: TicketKind = TicketKind.suporte
    prioridade: TicketPrioridade = TicketPrioridade.media
    empresa_id: int | None = None
    contato_id: int | None = None
    oportunidade_id: int | None = None
    assignee_user_id: int | None = None
    sla_due_at: datetime | None = None


class TicketUpdate(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    status: TicketStatus | None = None
    prioridade: TicketPrioridade | None = None
    assignee_user_id: int | None = None
    sla_due_at: datetime | None = None


class CommentIn(BaseModel):
    conteudo: str = Field(min_length=1, max_length=4000)


def _serialize(t: Ticket, users: dict[int, User]) -> dict:
    return {
        "id": t.id,
        "titulo": t.titulo,
        "descricao": t.descricao,
        "status": t.status.value,
        "prioridade": t.prioridade.value,
        "kind": t.kind.value,
        "empresa_id": t.empresa_id,
        "contato_id": t.contato_id,
        "oportunidade_id": t.oportunidade_id,
        "requester": users.get(t.requester_user_id) and {
            "id": users[t.requester_user_id].id,
            "nome": users[t.requester_user_id].nome,
        },
        "assignee": users.get(t.assignee_user_id) and {
            "id": users[t.assignee_user_id].id,
            "nome": users[t.assignee_user_id].nome,
        } if t.assignee_user_id else None,
        "sla_due_at": t.sla_due_at,
        "resolved_at": t.resolved_at,
        "closed_at": t.closed_at,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


@router.get("")
def list_tickets(
    db: DBSession,
    _: CurrentUser,
    q: str | None = None,
    status_: TicketStatus | None = Query(None, alias="status"),
    prioridade: TicketPrioridade | None = None,
    kind: TicketKind | None = None,
    empresa_id: int | None = None,
    assignee_user_id: int | None = None,
    requester_user_id: int | None = None,
    overdue: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    query = filter_active(db.query(Ticket), Ticket)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Ticket.titulo.ilike(like), Ticket.descricao.ilike(like)))
    if status_:
        query = query.filter(Ticket.status == status_)
    if prioridade:
        query = query.filter(Ticket.prioridade == prioridade)
    if kind:
        query = query.filter(Ticket.kind == kind)
    if empresa_id:
        query = query.filter(Ticket.empresa_id == empresa_id)
    if assignee_user_id:
        query = query.filter(Ticket.assignee_user_id == assignee_user_id)
    if requester_user_id:
        query = query.filter(Ticket.requester_user_id == requester_user_id)
    if overdue:
        now = datetime.now(timezone.utc)
        query = query.filter(
            Ticket.sla_due_at < now,
            Ticket.status.notin_([TicketStatus.resolvido, TicketStatus.fechado]),
        )
    total = query.with_entities(func.count(Ticket.id)).scalar() or 0
    rows = (
        query.order_by(Ticket.created_at.desc())
        .offset((page - 1) * size).limit(size).all()
    )
    user_ids = {r.requester_user_id for r in rows} | {r.assignee_user_id for r in rows if r.assignee_user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return {"items": [_serialize(r, users) for r in rows], "total": total, "page": page, "size": size}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketIn, db: DBSession, current: CurrentUser):
    t = Ticket(
        **payload.model_dump(),
        requester_user_id=current.id,
    )
    db.add(t)
    db.flush()
    log_event(db, current.id, "ticket", t.id, "criou",
              {"titulo": t.titulo, "kind": t.kind.value, "prioridade": t.prioridade.value})
    if t.assignee_user_id and t.assignee_user_id != current.id:
        notify.push(db, t.assignee_user_id, NotificationKind.mention,
                    f"Ticket atribuído: {t.titulo}",
                    f"De {current.nome} · {t.kind.value} · {t.prioridade.value}",
                    link=f"ticket:{t.id}")
    db.commit()
    db.refresh(t)
    users = {u.id: u for u in db.query(User).filter(User.id.in_([t.requester_user_id, t.assignee_user_id or 0])).all()}
    return _serialize(t, users)


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, db: DBSession, _: CurrentUser):
    t = db.get(Ticket, ticket_id)
    if not t or t.deleted_at:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    users = {u.id: u for u in db.query(User).filter(User.id.in_([t.requester_user_id, t.assignee_user_id or 0])).all()}
    out = _serialize(t, users)
    # Include comentários
    comments = (
        db.query(TicketComment, User)
        .join(User, User.id == TicketComment.user_id)
        .filter(TicketComment.ticket_id == ticket_id, TicketComment.deleted_at.is_(None))
        .order_by(TicketComment.created_at.asc())
        .all()
    )
    out["comments"] = [
        {"id": c.id, "user_id": u.id, "user_nome": u.nome, "conteudo": c.conteudo, "created_at": c.created_at}
        for c, u in comments
    ]
    return out


@router.patch("/{ticket_id}")
def update_ticket(ticket_id: int, payload: TicketUpdate, db: DBSession, current: CurrentUser):
    t = db.get(Ticket, ticket_id)
    if not t or t.deleted_at:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    data = payload.model_dump(exclude_unset=True)
    before_status = t.status
    before_assignee = t.assignee_user_id
    for k, v in data.items():
        setattr(t, k, v)
    # Timestamps automáticos por status
    if data.get("status") == TicketStatus.resolvido and not t.resolved_at:
        t.resolved_at = datetime.now(timezone.utc)
    if data.get("status") == TicketStatus.fechado and not t.closed_at:
        t.closed_at = datetime.now(timezone.utc)

    if "status" in data and before_status != t.status:
        log_event(db, current.id, "ticket", t.id, f"status_{t.status.value}",
                  {"de": before_status.value, "para": t.status.value})
    if "assignee_user_id" in data and before_assignee != t.assignee_user_id:
        log_event(db, current.id, "ticket", t.id, "reatribuiu",
                  {"de": before_assignee, "para": t.assignee_user_id})
        if t.assignee_user_id and t.assignee_user_id != current.id:
            notify.push(db, t.assignee_user_id, NotificationKind.mention,
                        f"Ticket atribuído a você: {t.titulo}",
                        f"Por {current.nome}", link=f"ticket:{t.id}")
    db.commit()
    db.refresh(t)
    users = {u.id: u for u in db.query(User).filter(User.id.in_([t.requester_user_id, t.assignee_user_id or 0])).all()}
    return _serialize(t, users)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: int, db: DBSession, current: CurrentUser):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    log_event(db, current.id, "ticket", t.id, "excluiu", {"titulo": t.titulo})
    soft_delete(db, current.id, t)
    db.commit()


@router.post("/{ticket_id}/restore")
def restore_ticket(ticket_id: int, db: DBSession, current: CurrentUser):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    restore(t)
    log_event(db, current.id, "ticket", t.id, "restaurou", None)
    db.commit()
    return {"ok": True}


# -------- Comentários --------

@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(ticket_id: int, payload: CommentIn, db: DBSession, current: CurrentUser):
    t = db.get(Ticket, ticket_id)
    if not t or t.deleted_at:
        raise HTTPException(status_code=404, detail="Ticket não encontrado")
    c = TicketComment(ticket_id=ticket_id, user_id=current.id, conteudo=payload.conteudo)
    db.add(c)
    db.flush()
    log_event(db, current.id, "ticket", ticket_id, "comentou", {"comment_id": c.id})
    # Notifica o outro lado (requester ou assignee)
    target_id = t.assignee_user_id if t.requester_user_id == current.id else t.requester_user_id
    if target_id and target_id != current.id:
        notify.push(db, target_id, NotificationKind.mention,
                    f"Comentário em ticket: {t.titulo}",
                    f"{current.nome}: {payload.conteudo[:80]}",
                    link=f"ticket:{ticket_id}")
    db.commit()
    db.refresh(c)
    return {
        "id": c.id, "user_id": c.user_id, "user_nome": current.nome,
        "conteudo": c.conteudo, "created_at": c.created_at,
    }


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: DBSession, current: CurrentUser):
    c = db.get(TicketComment, comment_id)
    if not c:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    if c.user_id != current.id:
        raise HTTPException(status_code=403, detail="Apenas o autor pode remover")
    soft_delete(db, current.id, c)
    db.commit()
