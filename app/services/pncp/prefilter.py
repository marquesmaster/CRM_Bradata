"""Pré-filtro de relevância para contratos PNCP — modo prospecção."""
from __future__ import annotations

from typing import Any


def score_contrato(item: dict[str, Any], cfg: dict[str, Any]) -> tuple[int, list[str]]:
    """Retorna (score, motivos). >= threshold → vale processar."""
    score = 0
    motivos: list[str] = []
    titulo = (item.get("title") or item.get("titulo") or "").lower()
    descricao = (item.get("description") or item.get("descricao") or "").lower()
    texto = f"{titulo} {descricao}"

    for p in cfg.get("palavras_exclusao", []):
        if p.lower() in texto:
            score -= 2
            motivos.append(f"-EXCL:{p}")

    for p in cfg.get("palavras_inclusao", []):
        if p.lower() in texto:
            score += 2
            motivos.append(f"+INCL:{p}")

    modalidades = set(cfg.get("modalidades_estrategicas", []))
    mid = item.get("modalidade_licitacao_id") or item.get("modalidadeLicitacaoId")
    try:
        if int(mid) in modalidades:
            bonus = 5 if int(mid) in (8, 9) else 3
            score += bonus
            motivos.append(f"+MOD:{mid}")
    except (TypeError, ValueError):
        pass

    valor = item.get("valor_global") or item.get("valorTotalEstimado") or 0
    try:
        if float(valor) < cfg.get("valor_minimo", 0):
            score -= 3
            motivos.append("-VAL_BAIXO")
    except (TypeError, ValueError):
        pass

    return score, motivos


def passa_prefiltro(item: dict[str, Any], cfg: dict[str, Any]) -> bool:
    score, _ = score_contrato(item, cfg)
    return score >= cfg.get("prefiltro_threshold", 0)
