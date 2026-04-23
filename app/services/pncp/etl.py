"""Orquestração do ETL completo PNCP com paralelismo.

Fluxo por contrato:
  1. search    → pncp_contratos (paralelo por keyword/UF)
  2. detalhe   → extrai numeroControlePncpCompra
  3. (opcional) IA triagem — se NAO, pula etapas caras
  4. compra    → pncp_compras
  5. itens     → pncp_compra_itens
  6. resultados → pncp_resultados + Empresas (fornecedores PJ)
  7. (opcional) enriquecimento de contatos

Paralelismo: ThreadPoolExecutor com N workers. Cada worker tem sua própria
Session. Rate limit GLOBAL no httpx client (concurrency.throttle) impede
sobrecarregar a API do PNCP.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
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
from app.services.pncp.concurrency import run_parallel
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


def _process_one_contrato(
    contrato_id: int,
    *,
    classify_with_ai: bool,
    enrich_contacts: bool,
) -> dict:
    """Processa um contrato em sessão própria (pode rodar em thread)."""
    result = {
        "detalhe": False,
        "ai": False,
        "compra": False,
        "itens": 0,
        "resultados": 0,
        "empresas": 0,
        "enriquecidas": 0,
    }
    with SessionLocal() as db:
        try:
            contrato = db.get(PncpContrato, contrato_id)
            if not contrato:
                return result

            if not contrato.detalhe_processado:
                if ingest_contrato_detalhe(db, contrato):
                    result["detalhe"] = True

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
                        result["ai"] = True
                except Exception as e:
                    log.warning("IA falhou %s: %s", contrato.numero_controle_pncp, e)

            # Skip caro se IA disse NÃO/TALVEZ
            if classify_with_ai and contrato.ai_classificacao not in (None, "SIM"):
                contrato.itens_processados = True
                contrato.resultados_processados = True
                db.commit()
                return result

            compra = ingest_compra_by_contrato(db, contrato)
            if compra:
                result["compra"] = True
                result["itens"] = ingest_compra_itens(db, compra)
                result["resultados"] = ingest_compra_resultados(db, compra)
                for item in compra.itens:
                    for res in item.resultados:
                        empresa = _sync_fornecedor_to_empresa(db, res)
                        if empresa:
                            result["empresas"] += 1
                            if enrich_contacts:
                                try:
                                    enrich_contatos_empresa(empresa)
                                    result["enriquecidas"] += 1
                                except Exception as e:
                                    log.warning("Enrich falhou %s: %s", empresa.cnpj, e)

            contrato.itens_processados = True
            contrato.resultados_processados = True
            db.commit()
        except Exception as e:
            log.exception("Falha contrato id=%s: %s", contrato_id, e)
            db.rollback()
    return result


def run_full_etl(
    db: Session,
    *,
    tipos_documento: str | None = None,
    keywords: Iterable[str] | None = None,
    ufs: Iterable[str] | None = None,
    status: str | None = None,
    max_paginas: int | None = None,
    detalhe_limit: int | None = 10_000,
    use_prospect_config: bool = True,
    classify_with_ai: bool = True,
    enrich_contacts: bool = False,
    max_workers: int = 10,
) -> dict:
    """Roda o ETL completo em paralelo e retorna um resumo."""
    iniciado = datetime.now(timezone.utc)
    log.info("ETL PNCP iniciado em %s (workers=%s)", iniciado.isoformat(), max_workers)

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
        max_workers=max_workers,
    )

    pendentes_query = db.query(PncpContrato.id).filter(
        PncpContrato.detalhe_processado.is_(False)
        | PncpContrato.itens_processados.is_(False)
    )
    if detalhe_limit:
        pendentes_query = pendentes_query.limit(detalhe_limit)
    ids = [row[0] for row in pendentes_query.all()]
    log.info("Processando %s contratos em paralelo", len(ids))

    totals = {
        "detalhe": 0,
        "ai": 0,
        "compra": 0,
        "itens": 0,
        "resultados": 0,
        "empresas": 0,
        "enriquecidas": 0,
    }

    def worker(cid: int) -> None:
        r = _process_one_contrato(
            cid,
            classify_with_ai=classify_with_ai,
            enrich_contacts=enrich_contacts,
        )
        for k in totals:
            totals[k] += int(r.get(k, 0)) if not isinstance(r.get(k), bool) else (1 if r.get(k) else 0)

    ok, err = run_parallel(worker, ids, max_workers=max_workers)

    finalizado = datetime.now(timezone.utc)
    resumo = {
        "iniciado_em": iniciado,
        "finalizado_em": finalizado,
        "duracao_seg": (finalizado - iniciado).total_seconds(),
        "search": search_res,
        "contratos_a_processar": len(ids),
        "contratos_ok": ok,
        "contratos_com_erro": err,
        "contratos_com_detalhe": totals["detalhe"],
        "contratos_classificados_ia": totals["ai"],
        "compras_ingeridas": totals["compra"],
        "itens_ingeridos": totals["itens"],
        "resultados_ingeridos": totals["resultados"],
        "empresas_fornecedoras_criadas_ou_vinculadas": totals["empresas"],
        "empresas_enriquecidas_contato": totals["enriquecidas"],
        "max_workers": max_workers,
    }
    log.info("ETL PNCP finalizado: %s", resumo)
    return resumo
