from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DBSession
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate, NotificationOut

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
def list_my_notifications(
    db: DBSession,
    current: CurrentUser,
    only_unread: bool = False,
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Notification).filter(Notification.user_id == current.id)
    if only_unread:
        query = query.filter(Notification.lida.is_(False))
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def create_notification(payload: NotificationCreate, db: DBSession, _: CurrentUser):
    n = Notification(**payload.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.post("/{notif_id}/read", response_model=NotificationOut)
def mark_read(notif_id: int, db: DBSession, current: CurrentUser):
    n = db.get(Notification, notif_id)
    if not n or n.user_id != current.id:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    n.lida = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(db: DBSession, current: CurrentUser):
    db.query(Notification).filter(
        Notification.user_id == current.id, Notification.lida.is_(False)
    ).update({Notification.lida: True}, synchronize_session=False)
    db.commit()
