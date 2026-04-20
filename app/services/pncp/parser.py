"""Parsers e normalizadores de dados PNCP."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any


def parse_iso_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    s = str(value)
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except ValueError:
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
    return None


def parse_iso_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = str(value)
    try:
        return datetime.fromisoformat(s[:10]).date()
    except ValueError:
        return None


def safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    try:
        return float(s)
    except ValueError:
        try:
            return float(s.replace(".", "").replace(",", "."))
        except ValueError:
            return None


def parse_numero_controle_compra(numero_controle: str) -> tuple[str, int, int] | None:
    """Converte '00509968000148-1-003707/2024' em (cnpj, ano, sequencial).

    O formato é: {cnpj}-{tipo}-{sequencial}/{ano}.
    Para montar a URL de compra precisamos de cnpj/ano/sequencial (sem o 'tipo').
    """
    if not numero_controle:
        return None
    try:
        left, ano = numero_controle.split("/")
        parts = left.split("-")
        if len(parts) != 3:
            return None
        cnpj, _tipo, seq = parts
        cnpj = "".join(ch for ch in cnpj if ch.isdigit())
        return cnpj, int(ano), int(seq.lstrip("0") or "0")
    except (ValueError, IndexError):
        return None
