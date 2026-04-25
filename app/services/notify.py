"""Helper para criar Notifications (sino do top bar) a partir de eventos.

Adiciona à sessão; quem chama controla a transação.
"""
from __future__ import annotations

import logging

from app.models.notification import Notification, NotificationKind

log = logging.getLogger("notify")


def push(
    db,
    user_id: int,
    kind: NotificationKind,
    titulo: str,
    mensagem: str | None = None,
    link: str | None = None,
) -> None:
    if not user_id:
        return
    try:
        n = Notification(
            user_id=user_id,
            kind=kind,
            titulo=titulo[:180],
            mensagem=(mensagem[:1000] if mensagem else None),
            link=link,
        )
        db.add(n)
    except Exception as e:
        log.warning("Falha criando notification para user=%s: %s", user_id, e)


def push_many(db, user_ids: list[int], kind, titulo, mensagem=None, link=None) -> None:
    for uid in set(user_ids or []):
        push(db, uid, kind, titulo, mensagem, link)
