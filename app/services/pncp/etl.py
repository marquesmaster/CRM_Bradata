"""Orquestração do ETL completo PNCP.

Fluxo:
  1. search   → pncp_contratos
  2. detalhe  → extrai numeroControlePncpCompra
  3. compra   → pncp_compras
  4. itens    → pncp_compra_itens
  5. resultados → pncp_resultados (e cria/atualiza Empresas a partir de fornecedores)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.empresa import Empresa, OrigemEmpresa
from app.models.pncp import PncpContrato, PncpResultado
from app.services.ai_classifier import classificar_contrato
from app.services.contact_finder import enrich_contatos_empresa
from app.services.empresa_service import classify_icp
from app.services.pncp import config_prospect
from app.services.pncp.compra import (
    ingest_compra_by_contrato,
    ingest_compra_itens,
    ingest_compra_resultados,
)
from app.services.pncp.contrato import ingest_contrato_detalhe
from app.services.pncp.search import search_pncp_contratos

log = logging.getLogger("pncp.etl")


def _sync_fornecedor_to_empresa(db: Session, resultado: PncpResultado) -> Empresa | None:
    cnpj = resultado.ni_fornecedor
    if not cnpj or resultado.tipo_pessoa != "PJ" or len(cnpj) != 14:
        return None
    empresa = db.query(Empresa).filter(Empresa.cnpj == cnpj).first()
    if empresa:
        if resultado.empresa_id != empresa.id:
            resultado.empresa_id = empresa.id
        return empresa
    empresa = Empresa(
        cnpj=cnpj,
        razao_social=resultado.nome_razao_social_fornecedor or "(sem nome)",
        porte=resultado.porte_fornecedor_nome,
        natureza_juridica=resultado.natureza_juridica_nome,
        origem=OrigemEmpresa.pncp,
    )
    classify_icp(empresa)
    db.add(empresa)
    db.flush()
    resultado.empresa_id = empresa.id
    return empresa


def run_full_etl(
    db: Session,
    *,
    tipos_documento: str | None = None,
    keywords: Iterable[str] | None = None,
    ufs: Iterable[str] | None = None,
    status: str | None = None,
    max_paginas: int | None = None,
    detalhe_limit: int | None = 500,
    use_prospect_config: bool = True,
    classify_with_ai: bool = True,
    enrich_contacts: bool = False,
) -> dict:
    """Roda as 4 etapas de extração e retorna um resumo.

    Quando ``use_prospect_config=True`` (padrão), aplica o config_prospect:
    keywords curadas para o nicho TI-gov, UFs estratégicas, palavras de
    inclusão/exclusão e modalidades estratégicas.
    """
    iniciado = datetime.now(timezone.utc)
    log.info("ETL PNCP iniciado em %s", iniciado.isoformat())

    cfg = config_prospect.load() if use_prospect_config else {}
    tipos_documento = tipos_documento or cfg.get("tipos_documento", "contrato")
    status = status or cfg.get("status", "vigente")
    keywords = keywords or cfg.get("keywords")
    ufs = ufs or cfg.get("ufs")
    max_paginas = max_paginas or cfg.get("max_paginas")
    prefilter_cfg = cfg if use_prospect_config else None

    search_res = search_pncp_contratos(
        db,
        tipos_documento=tipos_documento,
        keywords=keywords,
        ufs=ufs,
        status=status,
        max_paginas=max_paginas,
        prefilter_cfg=prefilter_cfg,
    )

    contratos_q = db.query(PncpContrato).filter(PncpContrato.detalhe_processado.is_(False))
    if detalhe_limit:
        contratos_q = contratos_q.limit(detalhe_limit)

    detalhe_ok = 0
    compras_ok = 0
    itens_ok = 0
    resultados_ok = 0
    fornecedores_ok = 0

    ai_ok = 0
    enriquecidas = 0

    for contrato in contratos_q:
        try:
            if ingest_contrato_detalhe(db, contrato):
                detalhe_ok += 1

            if classify_with_ai and contrato.ai_classificacao is None:
                try:
                    res = classificar_contrato(
                        contrato.titulo or "",
                        contrato.descricao or "",
                        contrato.valor_global,
                    )
                    if res:
                        contrato.ai_classificacao = (res.get("classificacao") or "").upper() or None
                        contrato.ai_confianca = res.get("confianca")
                        contrato.ai_motivo = res.get("motivo")
                        contrato.ai_tipo_servico = res.get("tipo_servico")
                        contrato.ai_oportunidade = res.get("oportunidade_bodyshop")
                        contrato.ai_processado_em = datetime.now(timezone.utc)
                        ai_ok += 1
                except Exception as e:
                    log.warning("IA falhou para %s: %s", contrato.numero_controle_pncp, e)

            # Só vai fundo se a IA disse SIM (ou se IA está desligada)
            if classify_with_ai and contrato.ai_classificacao not in (None, "SIM"):
                contrato.itens_processados = True
                contrato.resultados_processados = True
                db.commit()
                continue

            compra = ingest_compra_by_contrato(db, contrato)
            if not compra:
                continue
            compras_ok += 1
            itens_ok += ingest_compra_itens(db, compra)
            resultados_ok += ingest_compra_resultados(db, compra)
            for item in compra.itens:
                for res in item.resultados:
                    empresa = _sync_fornecedor_to_empresa(db, res)
                    if empresa:
                        fornecedores_ok += 1
                        if enrich_contacts:
                            try:
                                enrich_contatos_empresa(empresa)
                                enriquecidas += 1
                            except Exception as e:
                                log.warning("Contact finder falhou para %s: %s", empresa.cnpj, e)
            contrato.itens_processados = True
            contrato.resultados_processados = True
            db.commit()
        except Exception as e:
            log.exception("Falha no contrato %s: %s", contrato.numero_controle_pncp, e)
            db.rollback()

    finalizado = datetime.now(timezone.utc)
    resumo = {
        "iniciado_em": iniciado,
        "finalizado_em": finalizado,
        "search": search_res,
        "contratos_com_detalhe": detalhe_ok,
        "contratos_classificados_ia": ai_ok,
        "compras_ingeridas": compras_ok,
        "itens_ingeridos": itens_ok,
        "resultados_ingeridos": resultados_ok,
        "empresas_fornecedoras_criadas_ou_vinculadas": fornecedores_ok,
        "empresas_enriquecidas_contato": enriquecidas,
    }
    log.info("ETL PNCP finalizado: %s", resumo)
    return resumo
