"""Etapa 1: Busca de contratos no PNCP via /api/search/."""
from __future__ import annotations

import logging
import math
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.pncp import PncpContrato
from app.services.pncp.client import PncpClient
from app.services.pncp.parser import parse_iso_date, parse_iso_datetime, safe_float
from app.services.pncp.prefilter import passa_prefiltro

log = logging.getLogger("pncp.search")

SEARCH_PATH = "/api/search/"
MAX_ITENS_API = 10_000


def _upsert_contrato(db: Session, item: dict) -> bool:
    """Retorna True se foi inserido, False se já existia."""
    numero_controle = item.get("numero_controle_pncp")
    if not numero_controle:
        return False

    existing = (
        db.query(PncpContrato)
        .filter(PncpContrato.numero_controle_pncp == numero_controle)
        .first()
    )
    if existing:
        existing.raw_json = item
        existing.cancelado = bool(item.get("cancelado"))
        existing.situacao_nome = item.get("situacao_nome")
        db.flush()
        return False

    contrato = PncpContrato(
        numero_controle_pncp=numero_controle,
        pncp_doc_id=item.get("id"),
        titulo=item.get("title"),
        descricao=item.get("description"),
        item_url=item.get("item_url"),
        orgao_cnpj=str(item.get("orgao_cnpj") or "").zfill(14),
        orgao_nome=item.get("orgao_nome"),
        unidade_nome=item.get("unidade_nome"),
        ano=str(item.get("ano")) if item.get("ano") is not None else None,
        numero_sequencial=str(item.get("numero_sequencial")) if item.get("numero_sequencial") is not None else None,
        numero_sequencial_compra_ata=(
            str(item.get("numero_sequencial_compra_ata"))
            if item.get("numero_sequencial_compra_ata") is not None
            else None
        ),
        esfera_nome=item.get("esfera_nome"),
        poder_nome=item.get("poder_nome"),
        municipio_nome=item.get("municipio_nome"),
        uf=item.get("uf"),
        modalidade_licitacao_nome=item.get("modalidade_licitacao_nome"),
        situacao_nome=item.get("situacao_nome"),
        tipo_contrato_nome=item.get("tipo_contrato_nome"),
        data_publicacao_pncp=parse_iso_datetime(item.get("data_publicacao_pncp")),
        data_assinatura=parse_iso_date(item.get("data_assinatura")),
        data_inicio_vigencia=parse_iso_date(item.get("data_inicio_vigencia")),
        data_fim_vigencia=parse_iso_date(item.get("data_fim_vigencia")),
        valor_global=safe_float(item.get("valor_global")),
        cancelado=bool(item.get("cancelado")),
        raw_json=item,
    )
    db.add(contrato)
    db.flush()
    return True


def search_pncp_contratos(
    db: Session,
    *,
    tipos_documento: str = "contrato",
    keywords: Iterable[str] | None = None,
    ufs: Iterable[str] | None = None,
    status: str = "vigente",
    tam_pagina: int = 500,
    max_paginas: int | None = None,
    prefilter_cfg: dict | None = None,
) -> dict:
    """Executa a busca paginada do PNCP. Faz upsert na tabela pncp_contratos."""
    keywords_list = list(keywords) if keywords else [""]
    ufs_list = list(ufs) if ufs else [None]
    max_paginas_api = math.ceil(MAX_ITENS_API / tam_pagina)

    total_novos = 0
    total_processados = 0
    erros = 0

    with PncpClient() as client:
        for kw in keywords_list:
            for uf in ufs_list:
                base_params = {
                    "tipos_documento": tipos_documento,
                    "ordenacao": "-data",
                    "tam_pagina": tam_pagina,
                    "status": status,
                    "pagina": 1,
                }
                if kw:
                    base_params["q"] = kw
                if uf:
                    base_params["ufs"] = uf

                try:
                    data = client.get_json(SEARCH_PATH, params=base_params)
                except Exception as e:
                    log.exception("Falha na página 1 (kw=%r, uf=%r): %s", kw, uf, e)
                    erros += 1
                    continue

                if not data:
                    continue

                total = data.get("total", 0)
                if total == 0:
                    continue
                paginas_total = math.ceil(total / tam_pagina)
                paginas_a_buscar = min(paginas_total, max_paginas_api)
                if max_paginas:
                    paginas_a_buscar = min(paginas_a_buscar, max_paginas)

                for item in data.get("items", []):
                    total_processados += 1
                    if prefilter_cfg and not passa_prefiltro(item, prefilter_cfg):
                        continue
                    if _upsert_contrato(db, item):
                        total_novos += 1
                db.commit()

                for page in range(2, paginas_a_buscar + 1):
                    params = dict(base_params, pagina=page)
                    try:
                        page_data = client.get_json(SEARCH_PATH, params=params)
                    except Exception as e:
                        log.exception("Falha na página %s (kw=%r, uf=%r): %s", page, kw, uf, e)
                        erros += 1
                        continue
                    if not page_data:
                        break
                    items = page_data.get("items", [])
                    if not items:
                        break
                    for item in items:
                        total_processados += 1
                        if prefilter_cfg and not passa_prefiltro(item, prefilter_cfg):
                            continue
                        if _upsert_contrato(db, item):
                            total_novos += 1
                    db.commit()

    return {"itens_processados": total_processados, "itens_novos": total_novos, "erros": erros}
