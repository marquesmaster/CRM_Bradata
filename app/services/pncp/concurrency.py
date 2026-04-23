"""Utilitários de paralelismo para o ETL PNCP.

Estratégia: ThreadPoolExecutor (I/O-bound), cada worker com sua própria Session
SQLAlchemy (o engine tem pool já configurado). Semáforo global limita req/s
ao PNCP para não tomar bloqueio.
"""
from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from typing import Callable, Iterable, TypeVar

from sqlalchemy.orm import Session

from app.core.database import SessionLocal

log = logging.getLogger("pncp.concurrency")

T = TypeVar("T")
R = TypeVar("R")


# Limite global: no máximo N req/s contra o PNCP (soma de todos os workers).
# Se precisar, ajuste via env depois.
_DEFAULT_QPS = 20
_last_req_times: list[float] = []
_rate_lock = threading.Lock()


def throttle(qps: int = _DEFAULT_QPS) -> None:
    """Sliding window rate limiter global. Bloqueia até haver slot livre."""
    now = time.monotonic()
    with _rate_lock:
        _last_req_times[:] = [t for t in _last_req_times if now - t < 1.0]
        if len(_last_req_times) >= qps:
            sleep_for = 1.0 - (now - _last_req_times[0]) + 0.01
            time.sleep(max(sleep_for, 0))
            now = time.monotonic()
            _last_req_times[:] = [t for t in _last_req_times if now - t < 1.0]
        _last_req_times.append(now)


@contextmanager
def session_scope():
    """Abre sessão, commita no sucesso, faz rollback em erro."""
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def run_parallel(
    fn: Callable[[T], R],
    items: Iterable[T],
    *,
    max_workers: int = 8,
    on_error: Callable[[T, Exception], None] | None = None,
) -> tuple[int, int]:
    """Executa fn(item) em paralelo. Retorna (sucessos, erros)."""
    items = list(items)
    if not items:
        return 0, 0
    ok = 0
    err = 0
    with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="etl") as pool:
        futures: dict[Future, T] = {pool.submit(fn, it): it for it in items}
        for fut in as_completed(futures):
            item = futures[fut]
            try:
                fut.result()
                ok += 1
            except Exception as e:
                err += 1
                log.exception("worker erro em %r: %s", item, e)
                if on_error:
                    try:
                        on_error(item, e)
                    except Exception:
                        log.exception("on_error callback falhou")
    return ok, err
