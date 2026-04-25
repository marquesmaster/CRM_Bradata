"""Sync de respostas Gmail → Atividades.

Estratégia:
1. Para cada user com Google connected, lista as threads que o CRM
   já registrou (Atividade.direcao='enviado' & gmail_thread_id NOT NULL)
2. Para cada thread, chama Gmail API GET threads/{id} e pega mensagens
3. Para cada mensagem ainda não conhecida (gmail_message_id), cria
   Atividade(direcao='recebido', tipo=email) ligada ao mesmo
   contato/empresa da atividade enviada original

Tradeoffs:
- Polling em vez de push (mais simples, sem Pub/Sub setup)
- Roda só pras threads que JÁ saíram do CRM (não escaneia inbox toda)
- Se user responder por outro caminho, a thread cresce normal e a gente
  pega quando rodar de novo
"""
from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import and_, or_

from app.core.database import SessionLocal
from app.models.atividade import Atividade, AtividadeStatus, TipoAtividade
from app.models.user import User
from app.services import google_oauth as gauth

log = logging.getLogger("gmail_sync")

GMAIL_THREAD_URL = "https://gmail.googleapis.com/gmail/v1/users/me/threads/{thread_id}"


def _extract_text(payload: dict) -> str:
    """Extrai texto plain de uma message Gmail (recursivo em parts)."""
    if not payload:
        return ""
    mime = payload.get("mimeType", "")
    body = payload.get("body", {})
    if mime == "text/plain" and body.get("data"):
        try:
            return base64.urlsafe_b64decode(body["data"] + "==").decode("utf-8", errors="ignore")
        except Exception:
            return ""
    parts = payload.get("parts") or []
    for p in parts:
        txt = _extract_text(p)
        if txt:
            return txt
    return ""


def _header(headers: list[dict], name: str) -> str:
    for h in headers or []:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _parse_email_address(s: str) -> str:
    """Extrai 'foo@bar.com' de 'Foo Bar <foo@bar.com>'."""
    m = re.search(r"<([^>]+)>", s)
    return (m.group(1) if m else s).strip().lower()


def _fetch_thread(access_token: str, thread_id: str) -> dict | None:
    headers = {"Authorization": f"Bearer {access_token}"}
    url = GMAIL_THREAD_URL.format(thread_id=thread_id)
    try:
        with httpx.Client(timeout=15) as client:
            r = client.get(url, headers=headers)
        if r.status_code == 404:
            return None
        if r.status_code >= 400:
            log.warning("Gmail thread %s: %s %s", thread_id, r.status_code, r.text[:200])
            return None
        return r.json()
    except Exception as e:
        log.warning("Falha buscando thread %s: %s", thread_id, e)
        return None


def sync_threads_for_user(db, user: User, max_threads: int = 50) -> dict:
    """Para um user, varre as threads que ele enviou e puxa novas msgs."""
    if not user.google_refresh_token:
        return {"user_id": user.id, "skipped": "sem Google conectado"}

    try:
        access = gauth.get_valid_access_token(db, user)
    except gauth.GoogleOAuthError as e:
        log.warning("User %s sem token válido: %s", user.id, e)
        return {"user_id": user.id, "error": str(e)}

    # Threads que o user enviou via CRM
    rows = (
        db.query(Atividade.gmail_thread_id, Atividade.empresa_id, Atividade.contato_id)
        .filter(
            Atividade.user_id == user.id,
            Atividade.direcao == "enviado",
            Atividade.gmail_thread_id.isnot(None),
        )
        .group_by(Atividade.gmail_thread_id, Atividade.empresa_id, Atividade.contato_id)
        .order_by(Atividade.gmail_thread_id.desc())
        .limit(max_threads)
        .all()
    )

    novos_recebidos = 0
    threads_processadas = 0
    user_email = (user.google_email or user.email or "").lower()

    for thread_id, empresa_id, contato_id in rows:
        threads_processadas += 1
        thread = _fetch_thread(access, thread_id)
        if not thread:
            continue
        messages = thread.get("messages") or []
        # IDs das mensagens já conhecidas (enviadas + qualquer recebida)
        known = {
            row[0]
            for row in db.query(Atividade.gmail_message_id)
            .filter(Atividade.gmail_thread_id == thread_id, Atividade.gmail_message_id.isnot(None))
            .all()
        }

        for msg in messages:
            mid = msg.get("id")
            if not mid or mid in known:
                continue
            payload = msg.get("payload", {})
            headers = payload.get("headers", [])
            from_h = _header(headers, "From")
            from_email = _parse_email_address(from_h)
            # Pula se foi o user que enviou (não é "resposta")
            if user_email and from_email == user_email:
                # Marca como conhecida (enviada por outro caminho) pra não cair de novo
                continue
            subject = _header(headers, "Subject") or "(sem assunto)"
            date_h = _header(headers, "Date")
            try:
                from email.utils import parsedate_to_datetime
                ts = parsedate_to_datetime(date_h) if date_h else datetime.now(timezone.utc)
            except Exception:
                ts = datetime.now(timezone.utc)

            corpo = _extract_text(payload)[:8000]

            novo = Atividade(
                tipo=TipoAtividade.email,
                titulo=f"📩 Resposta: {subject[:160]}",
                descricao=corpo[:4000],
                status=AtividadeStatus.concluida,
                data_atividade=ts,
                empresa_id=empresa_id,
                contato_id=contato_id,
                user_id=user.id,
                resultado=f"recebida de {from_email}",
                direcao="recebido",
                gmail_thread_id=thread_id,
                gmail_message_id=mid,
            )
            db.add(novo)
            novos_recebidos += 1

        if novos_recebidos > 0 and threads_processadas % 5 == 0:
            db.commit()  # commit periódico

    db.commit()
    return {
        "user_id": user.id,
        "user_email": user_email,
        "threads_processadas": threads_processadas,
        "novos_recebidos": novos_recebidos,
    }


def sync_all_users() -> dict:
    """Job principal: roda sync_threads_for_user pra cada user com Google."""
    resumo = {"users": [], "total_novos": 0}
    with SessionLocal() as db:
        users = (
            db.query(User)
            .filter(User.google_refresh_token.isnot(None), User.is_active.is_(True))
            .all()
        )
        for u in users:
            r = sync_threads_for_user(db, u)
            resumo["users"].append(r)
            resumo["total_novos"] += r.get("novos_recebidos", 0)
    log.info("Gmail sync rodou: %s", resumo)
    return resumo
