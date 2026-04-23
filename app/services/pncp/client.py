"""HTTP client para PNCP com retries exponenciais e rate limit educado."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.services.pncp.concurrency import throttle

log = logging.getLogger("pncp.client")


class PncpError(Exception):
    pass


DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; CRM-Bradata/1.0)",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://pncp.gov.br/explore/search",
}


class PncpClient:
    def __init__(self, base_url: str | None = None, timeout: int | None = None) -> None:
        self._base_url = base_url or settings.pncp_base_url
        self._timeout = timeout or settings.pncp_request_timeout
        # Pool com keep-alive — reaproveita conexões TCP/TLS entre requests.
        self._client = httpx.Client(
            base_url=self._base_url,
            headers=DEFAULT_HEADERS,
            timeout=self._timeout,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
            http2=False,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PncpClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=2, max=16),
        before_sleep=before_sleep_log(log, logging.WARNING),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, Any] | None = None) -> httpx.Response:
        r = self._client.get(path, params=params)
        if r.status_code >= 500:
            r.raise_for_status()
        return r

    def get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        # Rate limit GLOBAL (compartilhado entre threads), não por-cliente.
        throttle()
        r = self._get(path, params=params)
        if r.status_code == 404:
            return None
        if r.status_code >= 400:
            raise PncpError(f"PNCP {r.status_code} em {path}: {r.text[:200]}")
        if not r.text:
            return None
        try:
            return r.json()
        except ValueError as e:
            raise PncpError(f"Resposta não-JSON em {path}: {e}")
