"""Busca website + LinkedIn de empresas (best-effort).

⚠️ ATENÇÃO LEGAL — LEIA ANTES DE ATIVAR:

1. **Receita WS** (`receitaws.com.br`): API pública, OK.
2. **Google scraping**: viola os Termos de Serviço do Google. Use com
   moderação. Para produção, troque por Google Custom Search API ou Bing
   Search API (pagas, oficiais).
3. **LinkedIn**: o LinkedIn proíbe scraping (caso *hiQ Labs v. LinkedIn*).
   Buscar a URL pública via Google é zona cinzenta e arriscada para SaaS.
   Para produção, use Apollo.io, Clearbit, ou Sales Navigator API.

Este módulo está aqui como referência da ferramenta original; mantenha
``settings.contact_finder_enabled`` desligado em produção sem revisão jurídica.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx

log = logging.getLogger("contact_finder")

LINKEDIN_PATTERNS = [
    r"https?://(?:www\.)?linkedin\.com/company/[a-zA-Z0-9\-_]+/?",
    r"https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9\-_]+/?",
]

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def _extract_linkedin(text: str) -> str | None:
    for pat in LINKEDIN_PATTERNS:
        m = re.search(pat, text)
        if m:
            return m.group(0)
    return None


def _try_url(client: httpx.Client, url: str) -> bool:
    try:
        r = client.head(url, follow_redirects=True, timeout=5)
        return r.status_code == 200
    except httpx.HTTPError:
        return False


def website_via_receitaws(cnpj: str) -> str | None:
    """Tenta extrair website/email da Receita WS pública."""
    cnpj_digits = "".join(ch for ch in cnpj if ch.isdigit())
    if len(cnpj_digits) != 14:
        return None
    try:
        with httpx.Client(timeout=10, headers=DEFAULT_HEADERS) as client:
            r = client.get(f"https://receitaws.com.br/v1/cnpj/{cnpj_digits}")
        if r.status_code != 200:
            return None
        data = r.json()
        site = data.get("site")
        if site:
            return site if site.startswith("http") else f"https://{site}"
        email = data.get("email") or ""
        if "@" in email:
            domain = email.split("@", 1)[1].strip()
            if domain and "." in domain:
                return f"https://www.{domain}"
    except (httpx.HTTPError, ValueError):
        return None
    finally:
        time.sleep(1)
    return None


def website_via_dominio_chute(razao_social: str) -> str | None:
    """Heurística: testa domínios óbvios derivados do nome da empresa."""
    if not razao_social:
        return None
    primeira_palavra = re.sub(r"[^a-zA-Z0-9]", "", razao_social.split()[0].lower())
    if len(primeira_palavra) < 3:
        return None
    candidates = [
        f"https://www.{primeira_palavra}.com.br",
        f"https://{primeira_palavra}.com.br",
        f"https://www.{primeira_palavra}.com",
        f"https://{primeira_palavra}.com",
    ]
    with httpx.Client(headers=DEFAULT_HEADERS) as client:
        for url in candidates:
            if _try_url(client, url):
                return url
    return None


def buscar_website(cnpj: str | None, razao_social: str | None) -> str | None:
    """Pipeline: Receita WS → chute de domínio. Não usa Google."""
    if cnpj:
        s = website_via_receitaws(cnpj)
        if s:
            return s
    if razao_social:
        return website_via_dominio_chute(razao_social)
    return None


def linkedin_no_website(website: str) -> str | None:
    """Procura link do LinkedIn na home do website (legal, é o próprio HTML)."""
    if not website:
        return None
    try:
        with httpx.Client(timeout=10, headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            r = client.get(website)
        if r.status_code != 200:
            return None
        return _extract_linkedin(r.text)
    except httpx.HTTPError:
        return None


def buscar_linkedin(razao_social: str | None, website: str | None = None) -> str | None:
    """Tentativa segura: só procura no próprio website. Não faz scraping de Google.

    Para produção, integre Apollo.io / Clearbit aqui.
    """
    if website:
        return linkedin_no_website(website)
    return None


def enrich_contatos_empresa(empresa: Any) -> dict[str, str | None]:
    """Preenche website e linkedin_url da empresa (best-effort)."""
    website = empresa.website or buscar_website(empresa.cnpj, empresa.razao_social)
    linkedin = empresa.linkedin_url or buscar_linkedin(empresa.razao_social, website)
    if website:
        empresa.website = website
    if linkedin:
        empresa.linkedin_url = linkedin
    return {"website": website, "linkedin_url": linkedin}
