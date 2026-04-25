"""Endpoint de leitura do audit trail."""
from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DBSession
from app.models.historico import Historico
from app.models.user import User

router = APIRouter()


@router.get("")
def list_historico(
    db: DBSession,
    _: CurrentUser,
    entity_type: str | None = None,
    entity_id: int | None = None,
    user_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    q = db.query(Historico)
    if entity_type:
        q = q.filter(Historico.entity_type == entity_type)
    if entity_id:
        q = q.filter(Historico.entity_id == entity_id)
    if user_id:
        q = q.filter(Historico.user_id == user_id)
    rows = q.order_by(Historico.created_at.desc()).limit(limit).all()

    user_ids = {r.user_id for r in rows if r.user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    return [
        {
            "id": r.id,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "acao": r.acao,
            "user_id": r.user_id,
            "user_nome": users.get(r.user_id).nome if r.user_id and users.get(r.user_id) else None,
            "changes": r.changes,
            "created_at": r.created_at,
        }
        for r in rows
    ]
