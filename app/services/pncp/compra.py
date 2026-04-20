"""Etapas 3 e 4: Compra (edital), itens e resultados (fornecedores)."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.pncp import PncpCompra, PncpCompraItem, PncpContrato, PncpResultado
from app.services.pncp.client import PncpClient
from app.services.pncp.parser import (
    parse_iso_date,
    parse_iso_datetime,
    parse_numero_controle_compra,
    safe_float,
)

log = logging.getLogger("pncp.compra")


def _compra_detail_path(cnpj: str, ano: int, seq: int) -> str:
    return f"/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq}"


def _compra_itens_path(cnpj: str, ano: int, seq: int) -> str:
    return f"/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens"


def _item_resultados_path(cnpj: str, ano: int, seq: int, num_item: int) -> str:
    return f"/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens/{num_item}/resultados"


def _upsert_compra(db: Session, data: dict[str, Any]) -> PncpCompra:
    numero_controle = data.get("numeroControlePNCP") or data.get("numeroControlePncp")
    existing = (
        db.query(PncpCompra).filter(PncpCompra.numero_controle_pncp == numero_controle).first()
    )

    orgao = data.get("orgaoEntidade") or {}
    unidade = data.get("unidadeOrgao") or {}

    payload = dict(
        numero_controle_pncp=numero_controle,
        orgao_cnpj=str(orgao.get("cnpj") or "").zfill(14),
        ano_compra=data.get("anoCompra"),
        sequencial_compra=data.get("sequencialCompra"),
        numero_compra=str(data.get("numeroCompra")) if data.get("numeroCompra") else None,
        processo=data.get("processo"),
        orgao_razao_social=orgao.get("razaoSocial"),
        unidade_nome=unidade.get("nomeUnidade"),
        unidade_uf_sigla=unidade.get("ufSigla"),
        unidade_municipio=unidade.get("municipioNome"),
        modalidade_nome=data.get("modalidadeNome"),
        modo_disputa_nome=data.get("modoDisputaNome"),
        objeto_compra=data.get("objetoCompra"),
        informacao_complementar=data.get("informacaoComplementar"),
        valor_total_estimado=safe_float(data.get("valorTotalEstimado")),
        valor_total_homologado=safe_float(data.get("valorTotalHomologado")),
        srp=data.get("srp"),
        data_publicacao_pncp=parse_iso_datetime(data.get("dataPublicacaoPncp")),
        data_abertura_proposta=parse_iso_datetime(data.get("dataAberturaProposta")),
        data_encerramento_proposta=parse_iso_datetime(data.get("dataEncerramentoProposta")),
        situacao_compra_nome=data.get("situacaoCompraNome"),
        link_sistema_origem=data.get("linkSistemaOrigem"),
        raw_json=data,
    )
    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
        db.flush()
        return existing
    compra = PncpCompra(**payload)
    db.add(compra)
    db.flush()
    return compra


def ingest_compra_by_contrato(db: Session, contrato: PncpContrato) -> PncpCompra | None:
    """Etapa 3: resolve a URL da compra a partir do contrato.

    Usa numero_controle_pncp_compra (vindo do detalhe) OU deriva de orgao_cnpj +
    ano + numero_sequencial_compra_ata.
    """
    cnpj: str | None = None
    ano: int | None = None
    seq: int | None = None

    if contrato.numero_controle_pncp_compra:
        parsed = parse_numero_controle_compra(contrato.numero_controle_pncp_compra)
        if parsed:
            cnpj, ano, seq = parsed

    if not (cnpj and ano and seq):
        if contrato.orgao_cnpj and contrato.ano and contrato.numero_sequencial_compra_ata:
            try:
                cnpj = contrato.orgao_cnpj
                ano = int(contrato.ano)
                seq = int(contrato.numero_sequencial_compra_ata)
            except (TypeError, ValueError):
                pass

    if not (cnpj and ano and seq):
        log.info("Contrato %s sem chaves de compra", contrato.numero_controle_pncp)
        return None

    with PncpClient() as client:
        data = client.get_json(_compra_detail_path(cnpj, ano, seq))
    if not data:
        return None
    compra = _upsert_compra(db, data)
    db.commit()
    return compra


def _upsert_item(db: Session, compra: PncpCompra, data: dict[str, Any]) -> PncpCompraItem:
    numero_item = data.get("numeroItem")
    existing = (
        db.query(PncpCompraItem)
        .filter(PncpCompraItem.compra_id == compra.id, PncpCompraItem.numero_item == numero_item)
        .first()
    )
    payload = dict(
        numero_item=numero_item,
        descricao=data.get("descricao"),
        material_ou_servico=data.get("materialOuServico"),
        material_ou_servico_nome=data.get("materialOuServicoNome"),
        valor_unitario_estimado=safe_float(data.get("valorUnitarioEstimado")),
        valor_total=safe_float(data.get("valorTotal")),
        quantidade=safe_float(data.get("quantidade")),
        unidade_medida=data.get("unidadeMedida"),
        criterio_julgamento_nome=data.get("criterioJulgamentoNome"),
        situacao_compra_item_nome=data.get("situacaoCompraItemNome"),
        tem_resultado=data.get("temResultado"),
        raw_json=data,
    )
    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
        db.flush()
        return existing
    item = PncpCompraItem(compra_id=compra.id, **payload)
    db.add(item)
    db.flush()
    return item


def ingest_compra_itens(db: Session, compra: PncpCompra, tamanho_pagina: int = 50) -> int:
    total = 0
    pagina = 1
    with PncpClient() as client:
        while True:
            data = client.get_json(
                _compra_itens_path(compra.orgao_cnpj, compra.ano_compra, compra.sequencial_compra),
                params={"pagina": pagina, "tamanhoPagina": tamanho_pagina},
            )
            if not data:
                break
            items = data if isinstance(data, list) else data.get("items", [])
            if not items:
                break
            for it in items:
                _upsert_item(db, compra, it)
                total += 1
            if len(items) < tamanho_pagina:
                break
            pagina += 1
    compra.itens_processados = True
    db.commit()
    return total


def _upsert_resultado(db: Session, item: PncpCompraItem, data: dict[str, Any]) -> PncpResultado:
    seq = data.get("sequencialResultado") or 1
    existing = (
        db.query(PncpResultado)
        .filter(PncpResultado.item_id == item.id, PncpResultado.sequencial_resultado == seq)
        .first()
    )
    payload = dict(
        numero_controle_pncp_compra=data.get("numeroControlePNCPCompra"),
        numero_item=data.get("numeroItem"),
        sequencial_resultado=seq,
        ni_fornecedor=str(data.get("niFornecedor") or "").zfill(14) if data.get("niFornecedor") else None,
        tipo_pessoa=data.get("tipoPessoa"),
        nome_razao_social_fornecedor=data.get("nomeRazaoSocialFornecedor"),
        porte_fornecedor_nome=data.get("porteFornecedorNome"),
        natureza_juridica_nome=data.get("naturezaJuridicaNome"),
        codigo_pais=data.get("codigoPais"),
        valor_total_homologado=safe_float(data.get("valorTotalHomologado")),
        valor_unitario_homologado=safe_float(data.get("valorUnitarioHomologado")),
        quantidade_homologada=safe_float(data.get("quantidadeHomologada")),
        percentual_desconto=safe_float(data.get("percentualDesconto")),
        situacao_nome=data.get("situacaoCompraItemResultadoNome"),
        ordem_classificacao_srp=data.get("ordemClassificacaoSrp"),
        data_resultado=parse_iso_date(data.get("dataResultado")),
        raw_json=data,
    )
    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
        db.flush()
        return existing
    resultado = PncpResultado(item_id=item.id, **payload)
    db.add(resultado)
    db.flush()
    return resultado


def ingest_compra_resultados(db: Session, compra: PncpCompra) -> int:
    total = 0
    with PncpClient() as client:
        for item in compra.itens:
            data = client.get_json(
                _item_resultados_path(
                    compra.orgao_cnpj, compra.ano_compra, compra.sequencial_compra, item.numero_item
                )
            )
            if not data:
                item.resultados_processados = True
                db.flush()
                continue
            results = data if isinstance(data, list) else [data]
            for r in results:
                _upsert_resultado(db, item, r)
                total += 1
            item.resultados_processados = True
            db.flush()
    compra.resultados_processados = True
    db.commit()
    return total
