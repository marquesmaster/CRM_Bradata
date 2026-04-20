"""Etapa 2: Detalhe do contrato no PNCP.

URL: /api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{seq}
Daqui extraímos `numeroControlePncpCompra` que aponta para a compra (edital) de origem.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.pncp import PncpContrato
from app.services.pncp.client import PncpClient

log = logging.getLogger("pncp.contrato")


def _contrato_detail_path(cnpj: str, ano: str, seq: str) -> str:
    return f"/api/pncp/v1/orgaos/{cnpj}/contratos/{ano}/{seq}"


def _apply_detalhe(contrato: PncpContrato, detalhe: dict[str, Any]) -> None:
    contrato.detalhe_json = detalhe
    contrato.detalhe_processado = True

    numero_controle_compra = (
        detalhe.get("numeroControlePncpCompra")
        or detalhe.get("numeroControlePNCPCompra")
    )
    if numero_controle_compra:
        contrato.numero_controle_pncp_compra = numero_controle_compra


def ingest_contrato_detalhe(db: Session, contrato: PncpContrato) -> bool:
    if not (contrato.orgao_cnpj and contrato.ano and contrato.numero_sequencial):
        log.warning("Contrato %s sem chaves para buscar detalhe", contrato.numero_controle_pncp)
        return False

    path = _contrato_detail_path(contrato.orgao_cnpj, contrato.ano, contrato.numero_sequencial)
    with PncpClient() as client:
        data = client.get_json(path)
    if not data:
        return False
    _apply_detalhe(contrato, data)
    db.commit()
    return True


def ingest_pendentes(db: Session, limit: int | None = None) -> dict:
    """Processa contratos sem detalhe ainda."""
    query = db.query(PncpContrato).filter(PncpContrato.detalhe_processado.is_(False))
    if limit:
        query = query.limit(limit)
    processados = 0
    erros = 0
    for contrato in query:
        try:
            if ingest_contrato_detalhe(db, contrato):
                processados += 1
        except Exception as e:
            log.exception("Erro no detalhe de %s: %s", contrato.numero_controle_pncp, e)
            erros += 1
    return {"itens_processados": processados, "itens_novos": processados, "erros": erros}
