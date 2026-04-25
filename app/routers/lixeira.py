"""Endpoint admin pra ver itens soft-deletados (lixeira) de qualquer entidade."""
from fastapi import APIRouter, HTTPException, Query

from app.core.deps import AdminUser, DBSession
from app.models.atividade import Atividade
from app.models.automacao import Automacao
from app.models.contato import Contato
from app.models.empresa import Empresa
from app.models.lead import Lead
from app.models.nota import Nota
from app.models.oportunidade import Oportunidade
from app.models.proposta import Proposta
from app.models.ticket import Ticket
from app.models.user import User
from app.services.historico import log_event
from app.services.soft_delete import restore as do_restore

router = APIRouter()

ENTITIES = {
    "empresa": Empresa,
    "contato": Contato,
    "oportunidade": Oportunidade,
    "proposta": Proposta,
    "atividade": Atividade,
    "nota": Nota,
    "lead": Lead,
    "automacao": Automacao,
    "ticket": Ticket,
}


def _label(obj, entity_type: str) -> str:
    """Tenta achar o melhor 'nome' do objeto pra exibir."""
    for attr in ("titulo", "nome", "razao_social", "conteudo"):
        v = getattr(obj, attr, None)
        if v:
            return str(v)[:120]
    return f"{entity_type} #{obj.id}"


@router.get("")
def list_lixeira(
    db: DBSession,
    _: AdminUser,
    entity_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    """Lista todos os itens soft-deletados, com nome do user que excluiu."""
    targets = [(k, v) for k, v in ENTITIES.items() if not entity_type or k == entity_type]
    out = []
    user_ids: set[int] = set()
    for ent_name, Model in targets:
        rows = (
            db.query(Model)
            .filter(Model.deleted_at.is_not(None))
            .order_by(Model.deleted_at.desc())
            .limit(limit)
            .all()
        )
        for r in rows:
            uid = getattr(r, "deleted_by_id", None)
            if uid:
                user_ids.add(uid)
            out.append({
                "entity_type": ent_name,
                "entity_id": r.id,
                "label": _label(r, ent_name),
                "deleted_at": r.deleted_at,
                "deleted_by_id": uid,
            })

    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    for it in out:
        it["deleted_by_nome"] = users.get(it["deleted_by_id"]).nome if it["deleted_by_id"] and users.get(it["deleted_by_id"]) else None

    out.sort(key=lambda x: x["deleted_at"] or 0, reverse=True)
    return out[:limit]


@router.post("/{entity_type}/{entity_id}/restore")
def restore_item(entity_type: str, entity_id: int, db: DBSession, current: AdminUser):
    Model = ENTITIES.get(entity_type)
    if not Model:
        raise HTTPException(status_code=400, detail=f"Tipo desconhecido: {entity_type}")
    obj = db.get(Model, entity_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    do_restore(obj)
    log_event(db, current.id, entity_type, entity_id, "restaurou_via_lixeira", None)
    db.commit()
    return {"ok": True, "entity_type": entity_type, "entity_id": entity_id}
