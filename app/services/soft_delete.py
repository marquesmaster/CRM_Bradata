"""Helper para soft-delete consistente.

Uso: `soft_delete(db, current.id, obj)` em vez de `db.delete(obj)`.
"""
from __future__ import annotations

from datetime import datetime, timezone


def soft_delete(db, user_id: int | None, obj) -> None:
    """Marca como excluído sem remover do DB. Não comita."""
    if hasattr(obj, "deleted_at"):
        obj.deleted_at = datetime.now(timezone.utc)
    if hasattr(obj, "deleted_by_id"):
        obj.deleted_by_id = user_id


def restore(obj) -> None:
    """Reverte um soft-delete."""
    if hasattr(obj, "deleted_at"):
        obj.deleted_at = None
    if hasattr(obj, "deleted_by_id"):
        obj.deleted_by_id = None


def filter_active(query, model):
    """Aplica filtro deleted_at IS NULL se o model tiver a coluna."""
    if hasattr(model, "deleted_at"):
        return query.filter(model.deleted_at.is_(None))
    return query
