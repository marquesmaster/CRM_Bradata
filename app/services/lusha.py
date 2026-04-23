"""Integração Lusha — enriquecimento de contatos B2B.

API docs: https://docs.lusha.com
Auth: header `api_key: <LUSHA_API_KEY>`

Estratégia:
1. Descobrir o domínio da empresa (prioridade: empresa.website → e-mail do CNPJ → LinkedIn)
2. Buscar pessoas por domínio + cargo (prospecting/contact/search)
3. Filtrar por cargos prioritários (CTO, Head de TI, etc.)
4. Cache PERMANENTE: cada pessoa (lusha_person_id) é gravada só uma vez por empresa;
   na próxima chamada, re-usa o que já está no banco sem cobrar crédito.

LGPD / ToS: contato pode pedir remoção → endpoint DELETE /contatos/{id} já existe.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.models.contato import Contato
from app.models.empresa import Empresa

log = logging.getLogger("lusha")


class LushaError(Exception):
    pass


def _domain_of(empresa: Empresa) -> str | None:
    """Tenta derivar um domínio do site/e-mail da empresa."""
    if empresa.website:
        w = empresa.website.strip().lower()
        if "://" not in w:
            w = "https://" + w
        try:
            host = urlparse(w).netloc or w
            host = host.split("/")[0]
            return host.replace("www.", "") or None
        except Exception:
            pass
    if empresa.email and "@" in empresa.email:
        return empresa.email.split("@")[-1].strip().lower() or None
    return None


@retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _search_contacts_by_domain(domain: str, titles: list[str], limit: int) -> list[dict[str, Any]]:
    """Busca contatos da Lusha via prospecting v2.

    Endpoint: POST /prospecting/contact/search
    body: {"filters": {"companies": {"domains": [...]}, "contacts": {"jobTitles": [...]}}}
    """
    api_key = settings.lusha_api_key
    if not api_key:
        raise LushaError("LUSHA_API_KEY não configurada")

    url = settings.lusha_base_url.rstrip("/") + "/prospecting/contact/search"
    payload = {
        # API exige size >= 10 e <= 40
        "pages": {"page": 0, "size": max(10, min(limit, 40))},
        "filters": {
            "companies": {"include": {"domains": [domain]}},
            "contacts": {"include": {"jobTitles": titles}} if titles else {},
        },
    }
    headers = {"api_key": api_key, "Content-Type": "application/json"}

    with httpx.Client(timeout=30) as client:
        r = client.post(url, json=payload, headers=headers)

    if r.status_code == 402:
        raise LushaError("Lusha: sem créditos na conta")
    if r.status_code == 401:
        raise LushaError("Lusha: API key inválida")
    if r.status_code >= 400:
        raise LushaError(f"Lusha {r.status_code}: {r.text[:200]}")

    data = r.json()
    # Formato esperado: {"data": [{...}, ...]} ou {"contacts": [...]}
    return data.get("data") or data.get("contacts") or []


@retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _enrich_person(person_id: str) -> dict[str, Any] | None:
    """Busca detalhes completos (com e-mail e telefone) de uma pessoa."""
    api_key = settings.lusha_api_key
    if not api_key:
        raise LushaError("LUSHA_API_KEY não configurada")
    url = settings.lusha_base_url.rstrip("/") + "/prospecting/contact/enrich"
    headers = {"api_key": api_key, "Content-Type": "application/json"}
    payload = {"contactIds": [person_id]}
    with httpx.Client(timeout=30) as client:
        r = client.post(url, json=payload, headers=headers)
    if r.status_code == 402:
        raise LushaError("Lusha: sem créditos")
    if r.status_code >= 400:
        log.warning("Lusha enrich %s: %s", r.status_code, r.text[:200])
        return None
    data = r.json()
    contacts = data.get("contacts") or data.get("data") or []
    return contacts[0] if contacts else None


def _parse_person(raw: dict[str, Any]) -> dict[str, Any]:
    """Normaliza o payload da Lusha para nossos campos de Contato."""
    first = raw.get("firstName") or raw.get("first_name") or ""
    last = raw.get("lastName") or raw.get("last_name") or ""
    full = (raw.get("fullName") or f"{first} {last}").strip() or "(sem nome)"

    emails = raw.get("emailAddresses") or raw.get("emails") or []
    email = None
    if emails:
        e0 = emails[0]
        email = e0.get("email") if isinstance(e0, dict) else e0

    phones = raw.get("phoneNumbers") or raw.get("phones") or []
    telefone = celular = None
    for p in phones:
        num = p.get("number") if isinstance(p, dict) else p
        tipo = (p.get("type") or "").lower() if isinstance(p, dict) else ""
        if tipo == "mobile" and not celular:
            celular = num
        elif not telefone:
            telefone = num

    return {
        "nome": full,
        "cargo": raw.get("jobTitle") or raw.get("title"),
        "departamento": raw.get("department"),
        "email": email,
        "telefone": telefone,
        "celular": celular,
        "linkedin_url": raw.get("linkedinUrl") or raw.get("linkedin_url"),
    }


def enriquecer_empresa(db, empresa: Empresa) -> dict:
    """Enriquece a empresa buscando até N contatos prioritários no Lusha.

    Cache permanente: pessoas (lusha_person_id) já registradas não são re-buscadas.
    Retorna resumo: {novos, ja_existentes, tentativas}.
    """
    resumo = {"novos": 0, "ja_existentes": 0, "tentativas": 0, "dominio": None, "erro": None}

    domain = _domain_of(empresa)
    resumo["dominio"] = domain
    if not domain:
        resumo["erro"] = "sem domínio derivável (website/email)"
        return resumo

    titles = settings.lusha_cargos_prioridade_list
    limit = settings.lusha_max_contatos_por_empresa

    try:
        search_results = _search_contacts_by_domain(domain, titles, limit * 3)
    except Exception as e:
        resumo["erro"] = str(e)
        return resumo

    if not search_results:
        resumo["erro"] = "Lusha sem resultados para o domínio"
        return resumo

    existing_ids = {
        row[0]
        for row in db.query(Contato.lusha_person_id)
        .filter(Contato.empresa_id == empresa.id, Contato.lusha_person_id.isnot(None))
        .all()
    }

    processados = 0
    for item in search_results:
        if processados >= limit:
            break
        person_id = str(item.get("id") or item.get("contactId") or item.get("_id") or "")
        if not person_id:
            continue

        resumo["tentativas"] += 1
        if person_id in existing_ids:
            resumo["ja_existentes"] += 1
            processados += 1
            continue

        # Enriquece detalhes (email/telefone geralmente vêm aqui)
        full = _enrich_person(person_id) or item
        fields = _parse_person(full)

        contato = Contato(
            empresa_id=empresa.id,
            nome=fields["nome"],
            cargo=fields["cargo"],
            departamento=fields["departamento"],
            email=fields["email"],
            telefone=fields["telefone"],
            celular=fields["celular"],
            linkedin_url=fields["linkedin_url"],
            decisor=True,
            fonte="lusha",
            lusha_person_id=person_id,
            lusha_raw=full,
            lusha_fetched_at=datetime.now(timezone.utc),
        )
        db.add(contato)
        resumo["novos"] += 1
        processados += 1

    db.commit()
    return resumo
