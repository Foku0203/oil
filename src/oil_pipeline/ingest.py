"""Load jobs: fetch from a source and upsert into the raw layer inside an audited transaction.

Daily runs re-read a trailing window so late corrections are picked up; upserts keep re-runs idempotent.
"""

from collections.abc import Callable
from datetime import date, datetime, timedelta

from oil_pipeline import db
from oil_pipeline.config import BANGKOK
from oil_pipeline.sources import bangchak, crude, fx, ptt

HISTORY_START = date(2022, 1, 1)


def today() -> date:
    return datetime.now(BANGKOK).date()


def load_ptt(start: date, end: date, archive: bool = False) -> int:
    rows = ptt.fetch_range(start, end, archive=archive)
    with db.ingestion_run("ptt") as conn:
        return conn.upsert(ptt.TABLE, rows, ptt.KEYS)


def load_bangchak() -> int:
    rows = bangchak.fetch()
    with db.ingestion_run("bangchak") as conn:
        return conn.upsert(bangchak.TABLE, rows, bangchak.KEYS)


def load_fx(start: date, end: date) -> int:
    rows = fx.fetch_range(start, end)
    with db.ingestion_run("fx") as conn:
        return conn.upsert(fx.TABLE, rows, fx.KEYS)


def load_crude(start: date, end: date) -> int:
    rows = crude.fetch_range(start, end)
    with db.ingestion_run("crude") as conn:
        return conn.upsert(crude.TABLE, rows, crude.KEYS)


def daily_loaders(lookback_days: int = 10) -> dict[str, Callable[[], int]]:
    end = today()
    start = end - timedelta(days=lookback_days)
    return {
        "ptt": lambda: load_ptt(start, end, archive=True),
        "bangchak": load_bangchak,
        "fx": lambda: load_fx(start, end),
        "crude": lambda: load_crude(start, end),
    }


def backfill_loaders(start: date = HISTORY_START) -> dict[str, Callable[[], int]]:
    end = today()
    return {
        "ptt": lambda: load_ptt(start, end),
        "bangchak": load_bangchak,
        "fx": lambda: load_fx(start, end),
        "crude": lambda: load_crude(start, end),
    }
