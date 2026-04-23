"""Enriquecimento de empresa via CNPJ WS (https://publica.cnpj.ws/).

A API pública (sem token) permite ~3 req/min por IP. Respeitar delay.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.models.empresa import Empresa
from app.services.pncp.parser import parse_iso_datetime, safe_float

log = logging.getLogger("cnpj_ws")


class CnpjWsError(Exception):
    pass


@retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _fetch(cnpj: str) -> dict | None:
    # Com token, usa o endpoint comercial (paid, 5 req/s, dados completos);
    # sem token, fallback para o público (3 req/min).
    if settings.cnpj_ws_token:
        base = "https://comercial.cnpj.ws/cnpj"
    else:
        base = settings.cnpj_ws_base_url.rstrip("/")
    url = f"{base}/{cnpj}"
    headers = {"Accept": "application/json"}
    if settings.cnpj_ws_token:
        # CNPJ.WS comercial: header oficial é x_api_token (também aceita ?token=...)
        headers["x_api_token"] = settings.cnpj_ws_token
    with httpx.Client(timeout=30, headers=headers) as client:
        r = client.get(url)
    if r.status_code == 404:
        return None
    if r.status_code == 429:
        raise CnpjWsError("Rate limit excedido em CNPJ WS")
    if r.status_code >= 400:
        raise CnpjWsError(f"CNPJ WS {r.status_code}: {r.text[:200]}")
    return r.json()


def enrich_empresa_from_cnpjws(empresa: Empresa) -> bool:
    """Preenche campos da empresa a partir da API CNPJ WS pública."""
    cnpj = empresa.cnpj
    if not cnpj or len(cnpj) != 14:
        return False

    data = _fetch(cnpj)
    # Delay menor com token (5 req/s) e padrão sem (3 req/min)
    delay_ms = 200 if settings.cnpj_ws_token else settings.cnpj_ws_request_delay_ms
    time.sleep(delay_ms / 1000.0)
    if not data:
        return False

    empresa.razao_social = data.get("razao_social") or empresa.razao_social
    empresa.capital_social = safe_float(data.get("capital_social"))
    empresa.natureza_juridica = (data.get("natureza_juridica") or {}).get("descricao")
    empresa.porte = (data.get("porte") or {}).get("descricao")

    estab = data.get("estabelecimento") or {}
    empresa.nome_fantasia = estab.get("nome_fantasia") or empresa.nome_fantasia
    empresa.data_abertura = parse_iso_datetime(estab.get("data_inicio_atividade"))
    empresa.logradouro = estab.get("logradouro") or empresa.logradouro
    empresa.numero = estab.get("numero") or empresa.numero
    empresa.complemento = estab.get("complemento") or empresa.complemento
    empresa.bairro = estab.get("bairro") or empresa.bairro
    empresa.cep = estab.get("cep") or empresa.cep

    cidade = (estab.get("cidade") or {}).get("nome")
    estado_sigla = (estab.get("estado") or {}).get("sigla")
    empresa.municipio = cidade or empresa.municipio
    empresa.uf = estado_sigla or empresa.uf

    ddd1 = estab.get("ddd1") or ""
    tel1 = estab.get("telefone1") or ""
    if ddd1 or tel1:
        empresa.telefone = f"{ddd1}{tel1}".strip() or empresa.telefone
    empresa.email = estab.get("email") or empresa.email

    # CNPJ.WS não retorna website. Se temos um email corporativo (não gmail/hotmail/etc),
    # derivamos o domínio dele pra usar como website (Lusha precisa disso).
    if not empresa.website and empresa.email and "@" in empresa.email:
        domain = empresa.email.split("@", 1)[1].strip().lower()
        if domain and domain not in {
            "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
            "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "live.com",
            "icloud.com", "msn.com", "globo.com", "r7.com",
        }:
            empresa.website = domain
            log.info("Empresa %s: website derivado do email -> %s", empresa.cnpj, domain)

    atividade_principal = estab.get("atividade_principal") or {}
    empresa.cnae_principal = atividade_principal.get("subclasse") or empresa.cnae_principal
    empresa.cnae_principal_descricao = atividade_principal.get("descricao") or empresa.cnae_principal_descricao

    atividades_sec = estab.get("atividades_secundarias") or []
    empresa.cnaes_secundarios = [
        {"codigo": a.get("subclasse"), "descricao": a.get("descricao")} for a in atividades_sec
    ] or empresa.cnaes_secundarios

    empresa.enriquecida_em = datetime.now(timezone.utc)
    return True
