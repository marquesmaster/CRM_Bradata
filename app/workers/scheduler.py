"""APScheduler para jobs recorrentes (PNCP diário + cadência de e-mail)."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.cadencia import run_cadencia_job
from app.services.cnpj_ws import enrich_empresa_from_cnpjws, CnpjWsError
from app.services.empresa_service import classify_icp
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


def _job_enriquecer_pendentes(batch_size: int = 100) -> None:
    """Enriquece empresas com `enriquecida_em IS NULL` via CNPJ.WS.
    Roda em batch limitado pra respeitar rate-limit da API.
    """
    from app.models.empresa import Empresa
    log.info("Auto-enrich CNPJ.WS: iniciando batch de %s empresas pendentes", batch_size)
    with SessionLocal() as db:
        pendentes = (
            db.query(Empresa)
            .filter(Empresa.enriquecida_em.is_(None), Empresa.deleted_at.is_(None))
            .limit(batch_size)
            .all()
        )
        ok = err = sem_dados = 0
        for emp in pendentes:
            try:
                if enrich_empresa_from_cnpjws(emp):
                    classify_icp(emp)
                    db.commit()
                    ok += 1
                else:
                    sem_dados += 1
                    db.rollback()
            except CnpjWsError as e:
                log.warning("CNPJ.WS rate-limit / erro em %s: %s", emp.cnpj, e)
                db.rollback()
                err += 1
                if "Rate limit" in str(e):
                    break  # para o batch pra não estourar
            except Exception as e:
                log.warning("Falha enriquecendo %s: %s", emp.cnpj, e)
                db.rollback()
                err += 1
        log.info("Auto-enrich: %s ok, %s sem_dados, %s erros (de %s)", ok, sem_dados, err, len(pendentes))


def _job_enriquecer_lusha_pendentes(batch_size: int = 30) -> None:
    """Para empresas com website mas sem contato Lusha, busca contatos.
    Mais conservador: 30/hora pra não estourar créditos Lusha.
    """
    from app.core.config import settings as _settings
    if not _settings.lusha_api_key:
        return
    from app.models.contato import Contato
    from app.models.empresa import Empresa
    from app.services.lusha import enriquecer_empresa as lusha_enriquecer, LushaError
    log.info("Auto-enrich Lusha: iniciando batch de %s empresas", batch_size)
    with SessionLocal() as db:
        # Empresas com website e sem contato lusha ainda
        sub = db.query(Contato.empresa_id).filter(Contato.fonte == "lusha").subquery()
        pendentes = (
            db.query(Empresa)
            .filter(
                Empresa.website.isnot(None),
                Empresa.website != "",
                Empresa.deleted_at.is_(None),
                ~Empresa.id.in_(sub),
            )
            .limit(batch_size)
            .all()
        )
        ok = err = 0
        for emp in pendentes:
            try:
                resumo = lusha_enriquecer(db, emp)
                if resumo.get("erro"):
                    err += 1
                else:
                    ok += 1
            except LushaError as e:
                if "créditos" in str(e).lower():
                    log.warning("Lusha sem créditos, parando: %s", e)
                    break
                err += 1
            except Exception as e:
                log.warning("Falha Lusha em %s: %s", emp.cnpj, e)
                err += 1
        log.info("Auto-enrich Lusha: %s ok, %s erros (de %s)", ok, err, len(pendentes))


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    # ETL completo PNCP: 1x por semana (segunda 03:00 BRT).
    _scheduler.add_job(
        _job_pncp_daily,
        CronTrigger(
            day_of_week="mon",
            hour=settings.pncp_daily_cron_hour,
            minute=settings.pncp_daily_cron_minute,
        ),
        id="pncp_weekly",
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
    # Auto-enrich CNPJ.WS: a cada 30 min, batch de 100 (5 req/s no comercial = ~20s).
    # Com tier público (3 req/min), 100 leva 33min — então só roda 1x/h se for público.
    _scheduler.add_job(
        _job_enriquecer_pendentes,
        CronTrigger(minute="*/30") if settings.cnpj_ws_token else CronTrigger(minute=15),
        id="enriquecer_cnpjws",
        replace_existing=True,
    )
    # Auto-enrich Lusha: 1x/dia 10:00 (cuidado com créditos)
    _scheduler.add_job(
        _job_enriquecer_lusha_pendentes,
        CronTrigger(hour=10, minute=0),
        id="enriquecer_lusha",
        replace_existing=True,
    )
    _scheduler.start()
    log.info(
        "Scheduler iniciado (PNCP seg %02d:%02d, cadência 09:00 America/Sao_Paulo)",
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
