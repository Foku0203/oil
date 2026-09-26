"""Warehouse access: raw-layer DDL, idempotent upserts and the ingestion audit log."""

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any

import psycopg

from oil_pipeline.config import get_settings

RAW_DDL = """
create schema if not exists raw;

create table if not exists raw.ptt_oil_prices (
    effective_at   timestamptz  not null,
    product        text         not null,
    price_thb      numeric(8,2) not null,
    _ingested_at   timestamptz  not null default now(),
    primary key (effective_at, product)
);

create table if not exists raw.bangchak_oil_prices (
    as_of_date        date         not null,
    oil_name          text         not null,
    announced_at      timestamptz,
    effective_date    date,
    price_yesterday   numeric(8,2),
    price_today       numeric(8,2),
    price_tomorrow    numeric(8,2),
    _ingested_at      timestamptz  not null default now(),
    primary key (as_of_date, oil_name)
);

create table if not exists raw.fx_rates (
    rate_date       date          not null,
    base_currency   text          not null,
    quote_currency  text          not null,
    rate            numeric(18,8) not null,
    _ingested_at    timestamptz   not null default now(),
    primary key (rate_date, base_currency, quote_currency)
);

create table if not exists raw.crude_prices (
    price_date    date          not null,
    symbol        text          not null,
    open_usd      numeric(10,4),
    high_usd      numeric(10,4),
    low_usd       numeric(10,4),
    close_usd     numeric(10,4) not null,
    volume        bigint,
    _ingested_at  timestamptz   not null default now(),
    primary key (price_date, symbol)
);

create table if not exists raw.ingestion_log (
    id             bigserial   primary key,
    source         text        not null,
    started_at     timestamptz not null,
    finished_at    timestamptz,
    status         text        not null default 'running',
    rows_upserted  integer,
    error          text
);
"""


def connect() -> psycopg.Connection:
    return psycopg.connect(get_settings().database_url, autocommit=False)


def ensure_raw_schema() -> None:
    with connect() as conn:
        conn.execute(RAW_DDL)


def upsert(
    conn: psycopg.Connection,
    table: str,
    rows: Sequence[dict[str, Any]],
    key_columns: Sequence[str],
) -> int:
    """Insert rows, updating non-key columns on key conflict. Safe to re-run with the same data."""
    if not rows:
        return 0
    columns = list(rows[0].keys())
    value_columns = [c for c in columns if c not in key_columns]
    updates = ", ".join(f"{c} = excluded.{c}" for c in value_columns)
    sql = (
        f"insert into {table} ({', '.join(columns)}) "
        f"values ({', '.join(['%s'] * len(columns))}) "
        f"on conflict ({', '.join(key_columns)}) do update set {updates}, _ingested_at = now()"
    )
    with conn.cursor() as cur:
        cur.executemany(sql, [tuple(row[c] for c in columns) for row in rows])
    return len(rows)


@contextmanager
def ingestion_run(source: str) -> Iterator[psycopg.Connection]:
    """Wrap one source load in a transaction and record the outcome in raw.ingestion_log."""
    started = datetime.now(UTC)
    conn = connect()
    stats: dict[str, int] = {}
    try:
        yield _RunConnection(conn, stats)
        conn.commit()
        _log(source, started, "success", stats.get("rows", 0), None)
    except Exception as exc:
        conn.rollback()
        _log(source, started, "failed", 0, f"{type(exc).__name__}: {exc}"[:2000])
        raise
    finally:
        conn.close()


class _RunConnection:
    """Thin proxy that counts upserted rows for the audit log."""

    def __init__(self, conn: psycopg.Connection, stats: dict[str, int]):
        self._conn = conn
        self._stats = stats

    def upsert(self, table: str, rows: Sequence[dict[str, Any]], key_columns: Sequence[str]) -> int:
        n = upsert(self._conn, table, rows, key_columns)
        self._stats["rows"] = self._stats.get("rows", 0) + n
        return n

    def __getattr__(self, name: str) -> Any:
        return getattr(self._conn, name)


def _log(source: str, started: datetime, status: str, rows: int, error: str | None) -> None:
    with connect() as conn:
        conn.execute(
            "insert into raw.ingestion_log (source, started_at, finished_at, status, rows_upserted, error) "
            "values (%s, %s, now(), %s, %s, %s)",
            (source, started, status, rows, error),
        )
