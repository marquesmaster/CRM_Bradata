"""APScheduler para rodar o ETL PNCP diariamente."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.pncp.etl import run_full_etl

log = logging.getLogger("scheduler")

_scheduler: BackgroundScheduler | None = None


def _job_pncp_daily() -> None:
    log.info("Rodando job diário PNCP")
    with SessionLocal() as db:
        try:
            run_full_etl(db)
        except Exception as e:
            log.exception("Erro no job diário PNCP: %s", e)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    _scheduler.add_job(
        _job_pncp_daily,
        CronTrigger(hour=settings.pncp_daily_cron_hour, minute=settings.pncp_daily_cron_minute),
        id="pncp_daily",
        replace_existing=True,
    )
    _scheduler.start()
    log.info(
        "Scheduler iniciado (PNCP diário %02d:%02d America/Sao_Paulo)",
        settings.pncp_daily_cron_hour,
        settings.pncp_daily_cron_minute,
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    log.info("Scheduler parado")
