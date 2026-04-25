from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.models.automacao import Automacao, AutomacaoKind
from app.schemas.automacao import AutomacaoCreate, AutomacaoOut, AutomacaoUpdate
from app.services.cadencia import run_cadencia_job, state_for_cadencia
from app.services.soft_delete import soft_delete, filter_active

router = APIRouter()


@router.get("", response_model=list[AutomacaoOut])
def list_automacoes(
    db: DBSession,
    _: CurrentUser,
    kind: AutomacaoKind | None = None,
    ativo: bool | None = None,
):
    q = filter_active(db.query(Automacao), Automacao)
    if kind:
        q = q.filter(Automacao.kind == kind)
    if ativo is not None:
        q = q.filter(Automacao.ativo == ativo)
    return q.order_by(Automacao.nome).all()


@router.get("/{auto_id}", response_model=AutomacaoOut)
def get_automacao(auto_id: int, db: DBSession, _: CurrentUser):
    a = db.get(Automacao, auto_id)
    if not a:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    return a


@router.post("", response_model=AutomacaoOut, status_code=status.HTTP_201_CREATED)
def create_automacao(payload: AutomacaoCreate, db: DBSession, _: AdminUser):
    auto = Automacao(**payload.model_dump())
    db.add(auto)
    db.commit()
    db.refresh(auto)
    return auto


@router.patch("/{auto_id}", response_model=AutomacaoOut)
def update_automacao(auto_id: int, payload: AutomacaoUpdate, db: DBSession, _: AdminUser):
    a = db.get(Automacao, auto_id)
    if not a:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{auto_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_automacao(auto_id: int, db: DBSession, current: AdminUser):
    a = db.get(Automacao, auto_id)
    if not a:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    soft_delete(db, current.id, a)
    db.commit()


@router.post("/cadencia/run-now")
def cadencia_run_now(bg: BackgroundTasks, _: AdminUser):
    """Roda todas as cadências ativas em background (normalmente roda 09:00 diário)."""
    bg.add_task(run_cadencia_job)
    return {"message": "Cadência agendada para execução imediata em background"}


@router.get("/{auto_id}/cadencia/state")
def cadencia_state(auto_id: int, db: DBSession, _: CurrentUser):
    """Estado da cadência: quem está elegível, em qual passo, próximo envio."""
    a = db.get(Automacao, auto_id)
    if not a or a.kind != AutomacaoKind.cadencia_followup:
        raise HTTPException(status_code=404, detail="Cadência não encontrada")
    return state_for_cadencia(db, a)
