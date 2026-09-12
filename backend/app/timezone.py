from datetime import datetime, date, timezone, timedelta
import zoneinfo

try:
    TZ_SP = zoneinfo.ZoneInfo("America/Sao_Paulo")
except Exception:
    TZ_SP = timezone(timedelta(hours=-3))


def sp_now() -> datetime:
    """Retorna datetime atual aware no fuso America/Sao_Paulo (GMT-3)."""
    return datetime.now(TZ_SP)


def sp_now_naive() -> datetime:
    """
    Retorna datetime atual de Brasília sem tzinfo (naive),
    ideal para inserção em colunas DateTime padrão do MySQL.
    """
    return datetime.now(TZ_SP).replace(tzinfo=None)


def sp_today() -> date:
    """Retorna date atual no fuso America/Sao_Paulo (GMT-3)."""
    return sp_now().date()
