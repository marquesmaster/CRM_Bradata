from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationKind


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    kind: NotificationKind
    titulo: str
    mensagem: str | None
    link: str | None
    lida: bool
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: int
    kind: NotificationKind
    titulo: str
    mensagem: str | None = None
    link: str | None = None
