"""Envio de e-mail via SMTP (Gmail / Google Workspace).

Configuração via .env:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=noreply@bradata.com.br
    SMTP_PASSWORD=<App Password de 16 chars — não a senha da conta!>
    SMTP_FROM_NAME=Bradata
    SMTP_USE_TLS=true
    SMTP_REPLY_TO=  (opcional)

Renderização: substitui {{nome}}, {{empresa}}, {{cargo}}, {{remetente}}
direto no assunto/corpo, sem dependência de Jinja.
"""
from __future__ import annotations

import logging
import re
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any

from app.core.config import settings

log = logging.getLogger("smtp")


class SMTPError(Exception):
    pass


def _render(template: str, vars: dict[str, Any]) -> str:
    """Substitui {{var}} de forma simples e segura."""
    if not template:
        return template
    out = template
    for k, v in (vars or {}).items():
        out = re.sub(r"\{\{\s*" + re.escape(k) + r"\s*\}\}", str(v if v is not None else ""), out)
    return out


def render_template(assunto: str, corpo: str, vars: dict[str, Any]) -> tuple[str, str]:
    return _render(assunto or "", vars), _render(corpo or "", vars)


def enviar_email(
    para: str | list[str],
    assunto: str,
    corpo: str,
    *,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    html: bool = False,
    reply_to: str | None = None,
) -> dict:
    if not settings.smtp_user or not settings.smtp_password:
        raise SMTPError("SMTP não configurado (SMTP_USER e SMTP_PASSWORD vazios no .env)")

    destinatarios = [para] if isinstance(para, str) else list(para)
    if not destinatarios:
        raise SMTPError("Sem destinatário")

    from_name = settings.smtp_from_name or "Bradata"
    from_addr = settings.smtp_user
    reply = reply_to or settings.smtp_reply_to or from_addr

    msg = EmailMessage()
    msg["Subject"] = assunto or "(sem assunto)"
    msg["From"] = formataddr((from_name, from_addr))
    msg["To"] = ", ".join(destinatarios)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply:
        msg["Reply-To"] = reply
    if html:
        msg.set_content("Este e-mail é HTML. Veja em um cliente compatível.")
        msg.add_alternative(corpo, subtype="html")
    else:
        msg.set_content(corpo or "")

    todos = destinatarios + (cc or []) + (bcc or [])

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20)
        try:
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg, from_addr=from_addr, to_addrs=todos)
        finally:
            try:
                server.quit()
            except Exception:
                pass
    except smtplib.SMTPAuthenticationError as e:
        raise SMTPError(
            "SMTP autenticação falhou. Para Gmail: ative 2FA e use App Password "
            f"em vez da senha normal. Detalhe: {e}"
        )
    except Exception as e:
        raise SMTPError(f"SMTP falhou: {e}")

    return {
        "enviado_em": datetime.now(timezone.utc).isoformat(),
        "para": destinatarios,
        "from": from_addr,
    }
