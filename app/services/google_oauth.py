"""Google OAuth2 + Gmail API send (envio como o próprio user).

Fluxo:
1. /auth/google/connect → gera URL de consentimento (state = JWT do user)
2. Google redireciona pra /auth/google/callback?code=...&state=...
3. Trocamos `code` por access_token + refresh_token
4. Gravamos no User (refresh_token criptografado com Fernet)
5. Envio: POST gmail.googleapis.com/.../messages/send com MIME base64url

Refresh automático: se access_token expirou, usa refresh_token pra renovar.
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.models.user import User

log = logging.getLogger("google_oauth")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

# scopes:
#  - gmail.send: enviar (não lê inbox)
#  - email/profile/openid: identidade do user
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
    "profile",
]


class GoogleOAuthError(Exception):
    pass


# ---------- Fernet (criptografia em repouso) ----------

def _fernet() -> Fernet:
    key = settings.fernet_key.strip()
    if not key:
        # Deriva do secret_key (não ideal mas funcional). Em prod, defina FERNET_KEY.
        import hashlib
        digest = hashlib.sha256(settings.secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        raise GoogleOAuthError("Token criptografado inválido (FERNET_KEY mudou?)")


# ---------- OAuth flow ----------

def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def authorize_url(state: str) -> str:
    if not is_configured():
        raise GoogleOAuthError(
            "Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env"
        )
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # garante refresh_token
        "prompt": "consent",         # força refresh_token mesmo se já consentiu antes
        "state": state,
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict[str, Any]:
    """Troca o `code` da redirect por access + refresh tokens."""
    if not is_configured():
        raise GoogleOAuthError("Google OAuth não configurado")
    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    with httpx.Client(timeout=20) as client:
        r = client.post(GOOGLE_TOKEN_URL, data=data)
    if r.status_code >= 400:
        raise GoogleOAuthError(f"Google token: {r.status_code} {r.text[:300]}")
    return r.json()


def fetch_userinfo(access_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=15) as client:
        r = client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if r.status_code >= 400:
        raise GoogleOAuthError(f"Google userinfo: {r.status_code} {r.text[:200]}")
    return r.json()


def refresh_access_token(refresh_token_plain: str) -> dict[str, Any]:
    if not is_configured():
        raise GoogleOAuthError("Google OAuth não configurado")
    data = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": refresh_token_plain,
        "grant_type": "refresh_token",
    }
    with httpx.Client(timeout=20) as client:
        r = client.post(GOOGLE_TOKEN_URL, data=data)
    if r.status_code >= 400:
        raise GoogleOAuthError(f"Google refresh: {r.status_code} {r.text[:300]}")
    return r.json()


# ---------- Persistência no User ----------

def save_tokens(user: User, token_payload: dict, google_email: str | None = None) -> None:
    """Salva tokens (refresh sempre criptografado) no objeto User."""
    access = token_payload.get("access_token")
    refresh = token_payload.get("refresh_token")
    expires_in = int(token_payload.get("expires_in", 3600))

    user.google_access_token = encrypt(access) if access else user.google_access_token
    if refresh:
        user.google_refresh_token = encrypt(refresh)
    user.google_token_expiry = datetime.now(timezone.utc) + timedelta(seconds=max(60, expires_in - 60))
    if google_email:
        user.google_email = google_email
    if not user.google_connected_at:
        user.google_connected_at = datetime.now(timezone.utc)


def get_valid_access_token(db, user: User) -> str:
    """Retorna access_token válido, renovando se expirou."""
    if not user.google_refresh_token:
        raise GoogleOAuthError(
            "Conta Google não conectada. Vá em Configurações → Conectar Gmail."
        )

    now = datetime.now(timezone.utc)
    if user.google_access_token and user.google_token_expiry and user.google_token_expiry > now:
        return decrypt(user.google_access_token)

    refreshed = refresh_access_token(decrypt(user.google_refresh_token))
    save_tokens(user, refreshed)
    db.add(user)
    db.commit()
    return refreshed["access_token"]


# ---------- Envio Gmail API ----------

def send_via_gmail(
    db,
    user: User,
    para: str | list[str],
    assunto: str,
    corpo: str,
    *,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    html: bool = False,
    reply_to: str | None = None,
) -> dict:
    """Envia e-mail pelo Gmail do user (aparece no Sent dele, replies vão pro inbox dele)."""
    access_token = get_valid_access_token(db, user)

    destinatarios = [para] if isinstance(para, str) else list(para)
    from_email = user.google_email or user.email
    from_name = user.nome or settings.smtp_from_name or "Bradata"

    msg = EmailMessage()
    msg["Subject"] = assunto or "(sem assunto)"
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = ", ".join(destinatarios)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if bcc:
        msg["Bcc"] = ", ".join(bcc)
    if reply_to:
        msg["Reply-To"] = reply_to
    if html:
        msg.set_content("Este e-mail é HTML. Veja em um cliente compatível.")
        msg.add_alternative(corpo, subtype="html")
    else:
        msg.set_content(corpo or "")

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=30) as client:
        r = client.post(GMAIL_SEND_URL, json={"raw": raw}, headers=headers)
    if r.status_code >= 400:
        raise GoogleOAuthError(f"Gmail send: {r.status_code} {r.text[:300]}")
    body = r.json()
    return {
        "enviado_em": datetime.now(timezone.utc).isoformat(),
        "para": destinatarios,
        "from": from_email,
        "gmail_message_id": body.get("id"),
        "gmail_thread_id": body.get("threadId"),
        "via": "gmail_api",
    }


def disconnect(user: User) -> None:
    """Limpa tokens locais (não revoga remoto — user faz em myaccount.google.com)."""
    user.google_access_token = None
    user.google_refresh_token = None
    user.google_token_expiry = None
    user.google_connected_at = None
