"""Audit trail centralizado.

Use `log_event(db, user_id, entity_type, entity_id, acao, changes)` para
gravar eventos importantes. Não dá flush — quem chama controla a transação.
"""
from __future__ import annotations

import logging
from typing import Any

from app.models.historico import Historico

log = logging.getLogger("historico")


def log_event(
    db,
    user_id: int | None,
    entity_type: str,
    entity_id: int,
    acao: str,
    changes: dict[str, Any] | None = None,
) -> None:
    """Adiciona um Historico à sessão. Não comita.

    entity_type: 'oportunidade' | 'proposta' | 'atividade' | 'empresa' | 'user' ...
    acao: 'criou' | 'atualizou' | 'mudou_estagio' | 'fechou_ganha' | 'fechou_perdida' | 'excluiu' ...
    changes: dict com campos relevantes (antes/depois) — opcional
    """
    try:
        h = Historico(
            entity_type=entity_type,
            entity_id=int(entity_id),
            acao=acao,
            user_id=user_id,
            changes=changes,
        )
        db.add(h)
    except Exception as e:
        log.warning("Falha registrando histórico %s/%s: %s", entity_type, entity_id, e)


def diff_dict(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Retorna {campo: {de:..., para:...}} apenas pros campos que mudaram."""
    out: dict[str, Any] = {}
    for k, new_v in after.items():
        old_v = before.get(k)
        if old_v != new_v:
            out[k] = {"de": old_v, "para": new_v}
    return out
