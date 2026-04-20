"""Regras de classificação ICP (Ideal Customer Profile) — Bradata.

ICP: empresas de TI que precisam de talentos de TI, faturamento mínimo configurável
(padrão 120MM/ano). O "precisa de talentos de TI" é inferido via CNAE TI + porte
(grande / demais) + faturamento.
"""
from __future__ import annotations

from app.core.config import settings
from app.models.empresa import Empresa


def _cnae_is_ti(cnae: str | None) -> bool:
    if not cnae:
        return False
    codigo = "".join(ch for ch in cnae if ch.isdigit())
    if not codigo:
        return False
    alvo = settings.icp_cnaes_ti_list
    for target in alvo:
        t = "".join(ch for ch in target if ch.isdigit())
        if not t:
            continue
        if codigo == t:
            return True
        if codigo.startswith(t[:4]):
            return True
    return False


def classify_icp(empresa: Empresa) -> None:
    """Recalcula is_icp, icp_score e icp_motivo."""
    score = 0
    motivos: list[str] = []

    is_ti_primary = _cnae_is_ti(empresa.cnae_principal)
    is_ti_secondary = False
    if empresa.cnaes_secundarios:
        for a in empresa.cnaes_secundarios:
            if isinstance(a, dict) and _cnae_is_ti(a.get("codigo")):
                is_ti_secondary = True
                break
            if isinstance(a, str) and _cnae_is_ti(a):
                is_ti_secondary = True
                break

    if is_ti_primary:
        score += 40
        motivos.append("CNAE principal de TI")
    elif is_ti_secondary:
        score += 20
        motivos.append("CNAE secundário de TI")

    min_fat = settings.icp_min_faturamento
    if empresa.faturamento_estimado and empresa.faturamento_estimado >= min_fat:
        score += 40
        motivos.append(f"Faturamento ≥ R$ {min_fat:,.0f}")
    elif empresa.faturamento_estimado:
        motivos.append(f"Faturamento abaixo do mínimo (R$ {empresa.faturamento_estimado:,.0f})")

    if empresa.porte in ("Demais", "DEMAIS", "GRANDE", "Grande"):
        score += 15
        motivos.append(f"Porte: {empresa.porte}")

    if empresa.num_funcionarios and empresa.num_funcionarios >= 100:
        score += 5
        motivos.append(f"{empresa.num_funcionarios} funcionários")

    empresa.icp_score = score
    empresa.icp_motivo = "; ".join(motivos) or "Sem sinais de ICP"
    empresa.is_icp = (is_ti_primary or is_ti_secondary) and (
        (empresa.faturamento_estimado or 0) >= min_fat
    )
