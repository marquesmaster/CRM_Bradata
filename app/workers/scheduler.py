"""APScheduler para jobs recorrentes (PNCP diário + cadência de e-mail)."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.cadencia import run_cadencia_job
from app.services.gmail_sync import sync_all_users as gmail_sync_all
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


def _job_cadencia() -> None:
    try:
        run_cadencia_job()
    except Exception as e:
        log.exception("Erro no job de cadência: %s", e)


def _job_gmail_sync() -> None:
    try:
        gmail_sync_all()
    except Exception as e:
        log.exception("Erro no job Gmail sync: %s", e)


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
    # Cadência: roda uma vez por dia 09:00 (horário comercial BR)
    _scheduler.add_job(
        _job_cadencia,
        CronTrigger(hour=9, minute=0),
        id="cadencia_followup",
        replace_existing=True,
    )
    # Gmail sync: a cada 10 minutos durante o horário comercial (8h-19h, dias úteis)
    _scheduler.add_job(
        _job_gmail_sync,
        CronTrigger(day_of_week="mon-sat", hour="8-19", minute="*/10"),
        id="gmail_sync",
        replace_existing=True,
    )
    _scheduler.start()
    log.info(
        "Scheduler iniciado (PNCP %02d:%02d, cadência 09:00 America/Sao_Paulo)",
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
