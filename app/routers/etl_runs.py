from fastapi import APIRouter, HTTPException, Query

from app.core.deps import CurrentUser, DBSession
from app.models.etl_run import EtlRun, EtlRunStatus
from app.schemas.etl_run import EtlRunOut

router = APIRouter()


@router.get("", response_model=list[EtlRunOut])
def list_runs(
    db: DBSession,
    _: CurrentUser,
    status_: EtlRunStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(EtlRun)
    if status_:
        q = q.filter(EtlRun.status == status_)
    return q.order_by(EtlRun.iniciado_em.desc()).limit(limit).all()


@router.get("/active", response_model=list[EtlRunOut])
def list_active(db: DBSession, _: CurrentUser):
    return (
        db.query(EtlRun)
        .filter(EtlRun.status == EtlRunStatus.running)
        .order_by(EtlRun.iniciado_em.desc())
        .all()
    )


@router.get("/{run_id}", response_model=EtlRunOut)
def get_run(run_id: int, db: DBSession, _: CurrentUser):
    r = db.get(EtlRun, run_id)
    if not r:
        raise HTTPException(status_code=404, detail="Run não encontrada")
    return r
