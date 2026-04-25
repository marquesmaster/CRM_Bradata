"""Integração Lusha — busca de candidatos + revelar (consome crédito).

Estratégia em 2 etapas (ToS friendly + economiza créditos):

1. **Buscar candidates** (`buscar_candidates_empresa`):
   - Chama `prospecting/contact/search` por domínio
   - Salva resultados como LushaCandidate (sem dados sensíveis)
   - Captura nome, cargo, departamento, linkedin, e flags has_email/has_phone
   - Não consome crédito de "reveal"

2. **Revelar** (`revelar_candidate`):
   - User escolhe um candidate específico
   - Chama `prospecting/contact/enrich` (CONSOME CRÉDITO)
   - Cria Contato real com email/telefones reais
   - Marca o candidate como `revelado_em` + linka contato_id

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
from app.models.lusha_candidate import LushaCandidate

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


def _extract_name(raw: dict[str, Any]) -> str | None:
    """Extrai nome de payload Lusha com TODOS os fallbacks possíveis.
    A v2 do prospecting/search retorna `name` direto, não `firstName/lastName`."""
    candidates = [
        raw.get("name"),
        raw.get("fullName"),
        raw.get("full_name"),
        raw.get("displayName"),
        raw.get("display_name"),
    ]
    for c in candidates:
        if c and isinstance(c, str) and c.strip():
            return c.strip()
    # Tenta first + last
    first = raw.get("firstName") or raw.get("first_name") or raw.get("first") or ""
    last = raw.get("lastName") or raw.get("last_name") or raw.get("last") or ""
    full = f"{first} {last}".strip()
    return full or None


def _has_email_phone(raw: dict[str, Any]) -> tuple[int, int, bool, bool, bool]:
    """Inspeciona payload de search pra detectar QUANTOS emails/telefones existem
    sem revelar o conteúdo. Lusha v2 search retorna `hasEmails`, `hasPhones`,
    `emailsCount`, `phonesCount`, etc."""
    n_emails = (
        raw.get("emailsCount") or raw.get("emails_count")
        or len(raw.get("emailAddresses") or raw.get("emails") or [])
        or 0
    )
    n_phones = (
        raw.get("phonesCount") or raw.get("phones_count")
        or len(raw.get("phoneNumbers") or raw.get("phones") or [])
        or 0
    )
    has_email = bool(raw.get("hasEmails")) or n_emails > 0 or bool(raw.get("hasEmail"))
    has_phone = bool(raw.get("hasPhones")) or n_phones > 0 or bool(raw.get("hasPhone"))
    # Mobile flag específico (alguns payloads trazem)
    has_mobile = bool(raw.get("hasMobilePhone")) or bool(raw.get("hasMobile"))
    return int(n_emails), int(n_phones), bool(has_email), bool(has_phone), bool(has_mobile)


@retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _search_contacts_by_domain(domain: str, titles: list[str], size: int) -> list[dict[str, Any]]:
    """Busca contatos da Lusha via prospecting v2.

    Endpoint: POST /prospecting/contact/search
    """
    api_key = settings.lusha_api_key
    if not api_key:
        raise LushaError("LUSHA_API_KEY não configurada")

    url = settings.lusha_base_url.rstrip("/") + "/prospecting/contact/search"
    payload = {
        # API exige size >= 10 e <= 40
        "pages": {"page": 0, "size": max(10, min(size, 40))},
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
    if r.status_code == 404:
        return []
    if r.status_code >= 400:
        raise LushaError(f"Lusha {r.status_code}: {r.text[:200]}")

    data = r.json()
    results = data.get("data") or data.get("contacts") or []
    log.info("Lusha search domain=%s titles=%s -> %d resultados", domain, len(titles), len(results))
    return results


@retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _enrich_person(person_id: str) -> dict[str, Any] | None:
    """Busca detalhes completos (com e-mail e telefone) de uma pessoa. CONSOME CRÉDITO."""
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


def _parse_revealed(raw: dict[str, Any]) -> dict[str, Any]:
    """Normaliza payload de enrich (revealed) → campos do Contato."""
    nome = _extract_name(raw) or "(sem nome)"

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
        "nome": nome,
        "cargo": raw.get("jobTitle") or raw.get("title") or raw.get("job_title"),
        "departamento": raw.get("department"),
        "email": email,
        "telefone": telefone,
        "celular": celular,
        "linkedin_url": raw.get("linkedinUrl") or raw.get("linkedin_url") or raw.get("linkedin"),
    }


# ==================== API PÚBLICA ====================

def search_for_frontend(db, empresa: Empresa, max_results: int = 40) -> dict:
    """Busca compatível com `useSearchLusha` do frontend novo:
    retorna {requestId, contacts: [{contactId, fullName, jobTitle, companyName,
    hasPhones, hasWorkEmail, isShown}]}.

    Persiste candidates no DB (atualiza existentes). isShown=True se já revelado.
    """
    result = buscar_candidates_empresa(db, empresa, max_results=max_results)
    if result.get("erro"):
        return {"requestId": "", "contacts": [], "error": result["erro"], "domain": result.get("dominio")}

    cands = (
        db.query(LushaCandidate)
        .filter(LushaCandidate.empresa_id == empresa.id)
        .order_by(LushaCandidate.created_at.desc())
        .all()
    )
    request_id = f"{empresa.id}-{int(datetime.now(timezone.utc).timestamp())}"
    return {
        "requestId": request_id,
        "domain": result.get("dominio"),
        "contacts": [
            {
                "contactId": c.lusha_person_id,
                "candidateId": c.id,
                "fullName": c.nome or "(sem nome)",
                "jobTitle": c.cargo,
                "department": c.departamento,
                "companyName": empresa.razao_social,
                "hasPhones": c.has_phone,
                "hasWorkEmail": c.has_email,
                "hasMobile": c.has_mobile,
                "nEmails": c.n_emails,
                "nPhones": c.n_phones,
                "linkedinUrl": c.linkedin_url,
                "isShown": c.revelado_em is not None,
                "contatoId": c.contato_id,
            }
            for c in cands
        ],
    }


def buscar_candidates_empresa(db, empresa: Empresa, max_results: int = 40) -> dict:
    """Busca candidates Lusha pra empresa e salva em LushaCandidate (sem revelar).

    NÃO consome crédito de reveal. Pode chamar à vontade pra atualizar a lista.
    Retorna {dominio, novos, atualizados, total, erro?}.
    """
    resumo = {"dominio": None, "novos": 0, "atualizados": 0, "total": 0, "erro": None}

    domain = _domain_of(empresa)
    resumo["dominio"] = domain
    if not domain:
        resumo["erro"] = "sem domínio derivável (website/email)"
        return resumo

    # Sem filtro de cargo: pega todos da empresa (max 40 por request da v2)
    titles: list[str] = []
    try:
        results = _search_contacts_by_domain(domain, titles, max_results)
    except Exception as e:
        resumo["erro"] = str(e)
        return resumo

    resumo["total"] = len(results)

    # Index dos candidates já no banco
    existing = {
        c.lusha_person_id: c
        for c in db.query(LushaCandidate).filter(LushaCandidate.empresa_id == empresa.id).all()
    }

    for item in results:
        person_id = str(item.get("id") or item.get("contactId") or item.get("_id") or "")
        if not person_id:
            continue
        nome = _extract_name(item) or "(sem nome)"
        cargo = item.get("jobTitle") or item.get("title") or item.get("job_title")
        depto = item.get("department")
        linkedin = item.get("linkedinUrl") or item.get("linkedin_url") or item.get("linkedin")
        n_emails, n_phones, has_email, has_phone, has_mobile = _has_email_phone(item)

        if person_id in existing:
            c = existing[person_id]
            # Atualiza dados do candidate (cargo pode mudar, etc), mas NÃO mexe em revelado_em
            c.nome = nome or c.nome
            c.cargo = cargo or c.cargo
            c.departamento = depto or c.departamento
            c.linkedin_url = linkedin or c.linkedin_url
            c.has_email = has_email
            c.has_phone = has_phone
            c.has_mobile = has_mobile
            c.n_emails = n_emails
            c.n_phones = n_phones
            c.raw_search = item
            resumo["atualizados"] += 1
        else:
            c = LushaCandidate(
                empresa_id=empresa.id,
                lusha_person_id=person_id,
                nome=nome,
                cargo=cargo,
                departamento=depto,
                linkedin_url=linkedin,
                has_email=has_email,
                has_phone=has_phone,
                has_mobile=has_mobile,
                n_emails=n_emails,
                n_phones=n_phones,
                raw_search=item,
            )
            db.add(c)
            resumo["novos"] += 1

    db.commit()
    return resumo


def revelar_candidate(db, candidate: LushaCandidate, user_id: int | None) -> Contato:
    """Revela dados de um candidate específico (CONSOME 1 CRÉDITO Lusha).
    Cria/atualiza Contato + marca candidate como revelado_em.
    """
    if candidate.revelado_em and candidate.contato_id:
        # Já revelado — retorna o contato existente
        c = db.get(Contato, candidate.contato_id)
        if c:
            return c

    raw = _enrich_person(candidate.lusha_person_id)
    if not raw:
        raise LushaError("Lusha não retornou dados pra esse contato")

    fields = _parse_revealed(raw)

    # Reusa contato existente se já existir mesmo person_id na mesma empresa
    contato = (
        db.query(Contato)
        .filter(
            Contato.empresa_id == candidate.empresa_id,
            Contato.lusha_person_id == candidate.lusha_person_id,
        )
        .first()
    )
    if not contato:
        contato = Contato(
            empresa_id=candidate.empresa_id,
            nome=fields["nome"] or candidate.nome or "(sem nome)",
            cargo=fields["cargo"] or candidate.cargo,
            departamento=fields["departamento"] or candidate.departamento,
            email=fields["email"],
            telefone=fields["telefone"],
            celular=fields["celular"],
            linkedin_url=fields["linkedin_url"] or candidate.linkedin_url,
            decisor=False,  # user marca depois se for o caso
            fonte="lusha",
            lusha_person_id=candidate.lusha_person_id,
            lusha_raw=raw,
            lusha_fetched_at=datetime.now(timezone.utc),
        )
        db.add(contato)
    else:
        contato.nome = fields["nome"] or contato.nome
        contato.cargo = fields["cargo"] or contato.cargo
        contato.departamento = fields["departamento"] or contato.departamento
        contato.email = fields["email"] or contato.email
        contato.telefone = fields["telefone"] or contato.telefone
        contato.celular = fields["celular"] or contato.celular
        contato.linkedin_url = fields["linkedin_url"] or contato.linkedin_url
        contato.lusha_raw = raw
        contato.lusha_fetched_at = datetime.now(timezone.utc)

    db.flush()
    candidate.revelado_em = datetime.now(timezone.utc)
    candidate.revelado_by_id = user_id
    candidate.contato_id = contato.id
    db.commit()
    db.refresh(contato)
    return contato


# Compat: função antiga `enriquecer_empresa` usada em routers/scheduler antigos.
# Agora apenas BUSCA candidates (não revela).
def enriquecer_empresa(db, empresa: Empresa) -> dict:
    """[Compat] Apenas busca candidates (sem revelar). Use revelar_candidate
    explicitamente pra consumir crédito."""
    resumo = buscar_candidates_empresa(db, empresa)
    # Format compatível com versão antiga
    return {
        "novos": resumo["novos"],
        "ja_existentes": resumo["atualizados"],
        "tentativas": resumo["total"],
        "dominio": resumo["dominio"],
        "erro": resumo["erro"],
    }
