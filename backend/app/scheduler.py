from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date
import logging

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")


def _run_monthly_job():
    """Job que gera as ocorrências do mês corrente. Roda todo dia 1 às 00:05."""
    from app.database import SessionLocal
    from app.services.occurrence_service import generate_occurrences_for_month

    today = date.today()
    logger.info(f"[Scheduler] Gerando ocorrências para {today.year}-{today.month:02d}")
    db = SessionLocal()
    try:
        count = generate_occurrences_for_month(db, today.year, today.month)
        logger.info(f"[Scheduler] {count} ocorrências criadas.")
    except Exception as e:
        logger.error(f"[Scheduler] Erro ao gerar ocorrências: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        _run_monthly_job,
        trigger=CronTrigger(day=1, hour=0, minute=5),
        id="monthly_occurrences",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] APScheduler iniciado.")


def stop_scheduler():
    scheduler.shutdown(wait=False)
