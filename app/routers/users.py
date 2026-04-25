from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.core.security import hash_password
from app.models.atividade import Atividade
from app.models.lead import Lead, LeadStatus
from app.models.oportunidade import Oportunidade, OportunidadeStatus
from app.models.user import User, UserStatus
from app.schemas.user import UserCreate, UserInvite, UserOut, UserStats, UserUpdate
from app.services.historico import log_event

router = APIRouter()


def _user_stats(db, user_id: int) -> UserStats:
    deals = db.query(func.count(Oportunidade.id)).filter(Oportunidade.owner_id == user_id).scalar() or 0
    won = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.owner_id == user_id, Oportunidade.status == OportunidadeStatus.ganha)
        .scalar()
        or 0
    )
    open_ = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.owner_id == user_id, Oportunidade.status == OportunidadeStatus.aberta)
        .scalar()
        or 0
    )
    lost = (
        db.query(func.count(Oportunidade.id))
        .filter(Oportunidade.owner_id == user_id, Oportunidade.status == OportunidadeStatus.perdida)
        .scalar()
        or 0
    )
    revenue = (
        db.query(func.coalesce(func.sum(Oportunidade.valor_estimado), 0))
        .filter(Oportunidade.owner_id == user_id, Oportunidade.status == OportunidadeStatus.ganha)
        .scalar()
        or 0
    )
    closed = won + lost
    win_rate = (won / closed * 100) if closed else 0.0
    leads = db.query(func.count(Lead.id)).filter(Lead.owner_id == user_id).scalar() or 0
    leads_q = (
        db.query(func.count(Lead.id))
        .filter(Lead.owner_id == user_id, Lead.status == LeadStatus.qualificado)
        .scalar()
        or 0
    )
    since = datetime.now(timezone.utc) - timedelta(days=30)
    activities = (
        db.query(func.count(Atividade.id))
        .filter(
            (Atividade.user_id == user_id) | (Atividade.assignee_id == user_id),
            Atividade.created_at >= since,
        )
        .scalar()
        or 0
    )
    return UserStats(
        user_id=user_id,
        deals=int(deals),
        won=int(won),
        open=int(open_),
        lost=int(lost),
        revenue=float(revenue),
        win_rate=round(float(win_rate), 1),
        activities_30d=int(activities),
        leads=int(leads),
        leads_qualificados=int(leads_q),
    )


@router.get("/me", response_model=UserOut)
def me(current: CurrentUser):
    return current


@router.get("/team")
def list_team(db: DBSession, _: CurrentUser):
    """Lista pública dos users ativos (id, nome, email) — usada por chat interno."""
    rows = (
        db.query(User.id, User.nome, User.email, User.role, User.team)
        .filter(User.is_active.is_(True))
        .order_by(User.nome)
        .all()
    )
    return [
        {"id": r.id, "nome": r.nome, "email": r.email, "role": r.role.value, "team": r.team}
        for r in rows
    ]


@router.get("/me/stats", response_model=UserStats)
def me_stats(db: DBSession, current: CurrentUser):
    return _user_stats(db, current.id)


@router.get("/{user_id}/stats", response_model=UserStats)
def user_stats(user_id: int, db: DBSession, _: CurrentUser):
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _user_stats(db, user_id)


@router.post("/invite", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def invite_user(payload: UserInvite, db: DBSession, _: AdminUser):
    """Cria usuário com status=pendente. Senha definida posteriormente via fluxo de convite."""
    import secrets

    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = User(
        nome=payload.nome,
        email=email,
        senha_hash=hash_password(secrets.token_urlsafe(24)),
        role=payload.role,
        team=payload.team,
        status=UserStatus.pendente,
        is_active=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: DBSession, _: AdminUser):
    return db.query(User).order_by(User.nome).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DBSession, current: AdminUser):
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = User(
        nome=payload.nome,
        email=email,
        senha_hash=hash_password(payload.senha),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    log_event(db, current.id, "user", user.id, "criou",
              {"email": user.email, "role": user.role.value})
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: DBSession, current: AdminUser):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    data = payload.model_dump(exclude_unset=True)
    senha = data.pop("senha", None)
    before_role = user.role
    before_active = user.is_active
    for k, v in data.items():
        setattr(user, k, v)
    if senha:
        user.senha_hash = hash_password(senha)
        log_event(db, current.id, "user", user.id, "alterou_senha", None)
    if "role" in data and before_role != user.role:
        log_event(db, current.id, "user", user.id, "mudou_role",
                  {"de": before_role.value, "para": user.role.value})
    if "is_active" in data and before_active != user.is_active:
        log_event(db, current.id, "user", user.id,
                  "ativou" if user.is_active else "desativou", None)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(user_id: int, db: DBSession, current: AdminUser):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.id == current.id:
        raise HTTPException(status_code=400, detail="Não é possível desativar a si mesmo")
    user.is_active = False
    log_event(db, current.id, "user", user.id, "desativou", None)
    db.commit()
