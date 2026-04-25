"""Fluxo de primeiro acesso / reset de senha por código de e-mail."""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.user import User
from app.models.verification_code import VerificationCode, VerificationKind
from app.services import google_oauth as gauth
from app.services.smtp import enviar_email

log = logging.getLogger("first_access")

CODE_TTL_MIN = 15
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SEC = 60


class FirstAccessError(Exception):
    pass


def _gen_code() -> str:
    # 6 dígitos, padded
    return f"{secrets.randbelow(1_000_000):06d}"


def request_code(db, email: str, kind: VerificationKind = VerificationKind.first_access) -> bool:
    """Gera + envia código por e-mail. Sempre retorna True (anti-enumeração).
    Só envia de fato se o user existe no DB. Aplica cooldown de 60s."""
    email = (email or "").strip().lower()
    if not email:
        return True  # silencioso

    user = db.query(User).filter(User.email == email).first()
    if not user:
        log.info("Código solicitado pra email não cadastrado: %s", email)
        return True  # finge sucesso

    # Cooldown: se já existe código recente (não usado, < 60s), não regera
    recent = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.email == email,
            VerificationCode.kind == kind,
            VerificationCode.used_at.is_(None),
            VerificationCode.created_at > datetime.now(timezone.utc) - timedelta(seconds=RESEND_COOLDOWN_SEC),
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if recent:
        log.info("Cooldown ativo pra %s, não regerando código", email)
        return True

    # Invalida códigos anteriores não usados pro mesmo email/kind
    db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.kind == kind,
        VerificationCode.used_at.is_(None),
    ).update({"used_at": datetime.now(timezone.utc)})

    code = _gen_code()
    vc = VerificationCode(
        email=email,
        code=code,
        kind=kind,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MIN),
    )
    db.add(vc)
    db.commit()

    # Envia o email — usa Gmail do user se algum estiver conectado, senão SMTP
    nome = (user.nome or email).split()[0]
    assunto = "Seu código de acesso ao Bradata CRM"
    corpo = (
        f"Olá, {nome}!\n\n"
        f"Use este código para entrar no Bradata CRM:\n\n"
        f"    {code}\n\n"
        f"O código expira em {CODE_TTL_MIN} minutos. Se você não solicitou, ignore este e-mail.\n\n"
        f"— Bradata CRM"
    )
    try:
        # Procura algum admin com Google conectado pra mandar como ele
        admin_with_google = (
            db.query(User)
            .filter(User.google_refresh_token.isnot(None), User.is_active.is_(True))
            .order_by(User.id)
            .first()
        )
        if admin_with_google:
            gauth.send_via_gmail(db, admin_with_google, email, assunto, corpo)
        else:
            enviar_email(email, assunto, corpo)
    except Exception as e:
        log.warning("Falha enviando código pra %s: %s", email, e)
        # ainda assim retornamos True; user pode pedir resend depois
    return True


def verify_code(db, email: str, code: str, kind: VerificationKind = VerificationKind.first_access) -> User:
    """Valida o código. Retorna o User. Raise FirstAccessError em qualquer falha."""
    email = (email or "").strip().lower()
    code = (code or "").strip()
    if not email or not code:
        raise FirstAccessError("Email e código são obrigatórios")

    vc = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.email == email,
            VerificationCode.kind == kind,
            VerificationCode.used_at.is_(None),
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if not vc:
        raise FirstAccessError("Nenhum código pendente para este e-mail")

    if vc.attempts >= MAX_ATTEMPTS:
        raise FirstAccessError("Muitas tentativas. Solicite um novo código")

    if vc.expires_at < datetime.now(timezone.utc):
        raise FirstAccessError("Código expirado. Solicite um novo")

    if vc.code != code:
        vc.attempts += 1
        db.commit()
        raise FirstAccessError("Código inválido")

    vc.used_at = datetime.now(timezone.utc)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise FirstAccessError("Usuário não encontrado")
    db.commit()
    return user
