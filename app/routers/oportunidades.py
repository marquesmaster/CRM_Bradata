from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.empresa import Empresa
from app.models.oportunidade import Oportunidade, OportunidadeStatus, PipelineEstagio
from app.schemas.common import Page
from app.schemas.oportunidade import (
    OportunidadeCloseRequest,
    OportunidadeCreate,
    OportunidadeOut,
    OportunidadeUpdate,
)
from app.models.notification import NotificationKind
from app.services.historico import log_event
from app.services import notify
from app.services.soft_delete import soft_delete, filter_active

router = APIRouter()


@router.get("", response_model=Page[OportunidadeOut])
def list_oportunidades(
    db: DBSession,
    _: CurrentUser,
    status_: OportunidadeStatus | None = Query(None, alias="status"),
    pipeline_id: int | None = None,
    estagio_id: int | None = None,
    owner_id: int | None = None,
    empresa_id: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
):
    query = db.query(Oportunidade)
    if not include_deleted:
        query = filter_active(query, Oportunidade)
    if status_:
        query = query.filter(Oportunidade.status == status_)
    if pipeline_id:
        query = query.filter(Oportunidade.pipeline_id == pipeline_id)
    if estagio_id:
        query = query.filter(Oportunidade.estagio_id == estagio_id)
    if owner_id:
        query = query.filter(Oportunidade.owner_id == owner_id)
    if empresa_id:
        query = query.filter(Oportunidade.empresa_id == empresa_id)

    total = query.with_entities(func.count(Oportunidade.id)).scalar() or 0
    items = query.order_by(Oportunidade.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return Page[OportunidadeOut](items=items, total=total, page=page, size=size)


@router.get("/{op_id}", response_model=OportunidadeOut)
def get_oportunidade(op_id: int, db: DBSession, _: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    return op


@router.post("", response_model=OportunidadeOut, status_code=status.HTTP_201_CREATED)
def create_oportunidade(payload: OportunidadeCreate, db: DBSession, current: CurrentUser):
    if not db.get(Empresa, payload.empresa_id):
        raise HTTPException(status_code=400, detail="Empresa inexistente")
    estagio = db.get(PipelineEstagio, payload.estagio_id)
    if not estagio or estagio.pipeline_id != payload.pipeline_id:
        raise HTTPException(status_code=400, detail="Estágio inválido para o pipeline")
    op = Oportunidade(**payload.model_dump())
    if op.owner_id is None:
        op.owner_id = current.id
    db.add(op)
    db.flush()
    log_event(db, current.id, "oportunidade", op.id, "criou", {
        "titulo": op.titulo, "valor_estimado": op.valor_estimado, "estagio_id": op.estagio_id,
    })
    db.commit()
    db.refresh(op)
    return op


@router.patch("/{op_id}", response_model=OportunidadeOut)
def update_oportunidade(op_id: int, payload: OportunidadeUpdate, db: DBSession, current: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "estagio_id" in data:
        estagio = db.get(PipelineEstagio, data["estagio_id"])
        if not estagio or estagio.pipeline_id != op.pipeline_id:
            raise HTTPException(status_code=400, detail="Estágio inválido para o pipeline")
    before_estagio = op.estagio_id
    before_owner = op.owner_id
    for k, v in data.items():
        setattr(op, k, v)
    # Loga mudança de estágio em separado (mais visível)
    if "estagio_id" in data and before_estagio != op.estagio_id:
        log_event(db, current.id, "oportunidade", op.id, "mudou_estagio",
                  {"de_estagio_id": before_estagio, "para_estagio_id": op.estagio_id})
        # Notifica owner se diferente do user atual
        if op.owner_id and op.owner_id != current.id:
            notify.push(db, op.owner_id, NotificationKind.deal_moved,
                        f"Deal '{op.titulo}' mudou de estágio",
                        f"{current.nome} moveu o deal", link=f"deal:{op.id}")
    elif "owner_id" in data and before_owner != op.owner_id:
        log_event(db, current.id, "oportunidade", op.id, "reatribuiu",
                  {"de_owner_id": before_owner, "para_owner_id": op.owner_id})
        if op.owner_id and op.owner_id != current.id:
            notify.push(db, op.owner_id, NotificationKind.mention,
                        f"Deal '{op.titulo}' atribuído a você",
                        f"{current.nome} atribuiu este deal a você", link=f"deal:{op.id}")
    elif data:
        log_event(db, current.id, "oportunidade", op.id, "atualizou",
                  {"campos": list(data.keys())})
    db.commit()
    db.refresh(op)
    return op


@router.post("/{op_id}/fechar", response_model=OportunidadeOut)
def fechar_oportunidade(op_id: int, payload: OportunidadeCloseRequest, db: DBSession, current: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    if payload.status == OportunidadeStatus.aberta:
        raise HTTPException(status_code=400, detail="Para reabrir, use PATCH")
    op.status = payload.status
    op.motivo_perda = payload.motivo_perda
    op.data_fechamento_real = date.today()
    log_event(db, current.id, "oportunidade", op.id,
              "fechou_ganha" if payload.status == OportunidadeStatus.ganha else "fechou_perdida",
              {"motivo": payload.motivo_perda, "valor": op.valor_estimado})
    # Notifica todos admins + owner
    from app.models.user import User as _User, UserRole
    admin_ids = [r[0] for r in db.query(_User.id).filter(_User.role == UserRole.admin, _User.is_active.is_(True)).all()]
    targets = list({*admin_ids, op.owner_id}) if op.owner_id else admin_ids
    targets = [t for t in targets if t and t != current.id]
    if payload.status == OportunidadeStatus.ganha:
        notify.push_many(db, targets, NotificationKind.deal_moved,
                         f"🎉 Deal GANHO: {op.titulo}",
                         f"Por {current.nome} — R$ {op.valor_estimado or 0:,.0f}", link=f"deal:{op.id}")
    else:
        notify.push_many(db, targets, NotificationKind.deal_moved,
                         f"Deal perdido: {op.titulo}",
                         f"Motivo: {payload.motivo_perda or 'sem motivo registrado'}", link=f"deal:{op.id}")
    db.commit()
    db.refresh(op)
    return op


@router.delete("/{op_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_oportunidade(op_id: int, db: DBSession, current: CurrentUser):
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    log_event(db, current.id, "oportunidade", op.id, "excluiu", {"titulo": op.titulo})
    soft_delete(db, current.id, op)
    db.commit()


@router.post("/{op_id}/restore", response_model=OportunidadeOut)
def restore_oportunidade(op_id: int, db: DBSession, current: CurrentUser):
    from app.services.soft_delete import restore
    op = db.get(Oportunidade, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    restore(op)
    log_event(db, current.id, "oportunidade", op.id, "restaurou", None)
    db.commit()
    db.refresh(op)
    return op
