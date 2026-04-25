from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"

# bcrypt impõe limite rígido de 72 bytes no input. Truncamos para evitar
# ValueError quando o usuário configura senhas longas (não reduz a segurança
# pois bcrypt já ignoraria os bytes seguintes internamente).
_BCRYPT_MAX = 72


def _truncate(password: str) -> str:
    b = password.encode("utf-8")
    if len(b) <= _BCRYPT_MAX:
        return password
    return b[:_BCRYPT_MAX].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    return pwd_context.hash(_truncate(password))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_truncate(plain), hashed)


def create_access_token(
    subject: str | int,
    extra: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> str:
    minutes = expires_minutes if expires_minutes is not None else settings.access_token_expire_minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire, "iat": datetime.now(timezone.utc)}
    if extra:
        # exp_minutes não vai pra dentro do JWT — é só pra controle aqui
        extra = {k: v for k, v in extra.items() if k != "exp_minutes"}
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
