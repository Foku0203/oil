"""Public read-only API over the marts schema.

Run: `uv run uvicorn oil_pipeline.api.main:app --reload`  ->  docs at http://localhost:8000/docs
"""

from datetime import date, timedelta
from typing import Annotated, Any, Literal

import psycopg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row

from oil_pipeline.config import get_settings

app = FastAPI(
    title="Thai Oil & FX Data API",
    version="0.1.0",
    description="Bangkok retail fuel prices, THB exchange rates and world crude, refreshed daily.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

Brand = Literal["PTT", "Bangchak"]


def query(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with psycopg.connect(get_settings().database_url, row_factory=dict_row) as conn:
        return conn.execute(sql, params or {}).fetchall()


def default_start(days: int) -> date:
    return date.today() - timedelta(days=days)


@app.get("/health")
def health() -> dict[str, str]:
    query("select 1")
    return {"status": "ok"}


@app.get("/v1/fuels")
def fuels() -> list[dict[str, Any]]:
    return query("select * from marts.dim_fuels order by sort_order")


@app.get("/v1/prices/latest")
def latest_prices(brand: Brand | None = None) -> list[dict[str, Any]]:
    return query(
        "select * from marts.mart_latest_prices "
        "where (%(brand)s::text is null or brand = %(brand)s) order by brand, sort_order",
        {"brand": brand},
    )


@app.get("/v1/prices/history")
def price_history(
    fuel: Annotated[list[str], Query(description="fuel_code, repeatable")] = ["diesel_b7", "gasohol_95"],
    brand: Brand = "PTT",
    start: date | None = None,
    end: date | None = None,
) -> list[dict[str, Any]]:
    return query(
        """
        select price_date, fuel_code, price_thb, change_thb, is_price_change, is_announced
        from marts.fct_retail_prices_daily
        where brand = %(brand)s and fuel_code = any(%(fuel)s)
          and price_date between %(start)s and %(end)s
        order by price_date, fuel_code
        """,
        {"brand": brand, "fuel": fuel, "start": start or default_start(365), "end": end or date.max},
    )


@app.get("/v1/prices/changes")
def price_changes(brand: Brand = "PTT", limit: Annotated[int, Query(le=500)] = 50) -> list[dict[str, Any]]:
    return query(
        "select * from marts.mart_price_change_events where brand = %(brand)s "
        "order by price_date desc, fuel_code limit %(limit)s",
        {"brand": brand, "limit": limit},
    )


@app.get("/v1/fx/history")
def fx_history(
    currency: Annotated[list[str], Query()] = ["USD"],
    start: date | None = None,
) -> list[dict[str, Any]]:
    return query(
        "select rate_date, currency, thb_per_unit, is_published from marts.fct_fx_rates_daily "
        "where currency = any(%(ccy)s) and rate_date >= %(start)s order by rate_date, currency",
        {"ccy": [c.upper() for c in currency], "start": start or default_start(365)},
    )


@app.get("/v1/crude/history")
def crude_history(
    benchmark: Literal["brent", "wti"] = "brent",
    start: date | None = None,
) -> list[dict[str, Any]]:
    return query(
        "select price_date, usd_per_barrel, thb_per_usd, thb_per_litre, is_trading_day "
        "from marts.fct_crude_prices_daily where benchmark = %(b)s and price_date >= %(start)s "
        "order by price_date",
        {"b": benchmark, "start": start or default_start(365)},
    )


@app.get("/v1/insights/fuel-vs-crude")
def fuel_vs_crude(fuel: str = "gasohol_95", start: date | None = None) -> list[dict[str, Any]]:
    rows = query(
        "select * from marts.mart_fuel_vs_crude_daily where fuel_code = %(f)s and price_date >= %(start)s "
        "order by price_date",
        {"f": fuel, "start": start or default_start(365 * 5)},
    )
    if not rows:
        raise HTTPException(404, f"no data for fuel {fuel!r}")
    return rows


@app.get("/v1/insights/pass-through")
def pass_through() -> dict[str, Any]:
    rows = query(
        "select l.*, f.name_th, f.name_en, f.fuel_group from marts.mart_pass_through_lag l "
        "join marts.dim_fuels f using (fuel_code) order by f.sort_order, l.lag_days"
    )
    best = [r for r in rows if r["is_best_lag"]]
    return {"best": best, "curves": rows}


@app.get("/v1/pipeline/status")
def pipeline_status() -> dict[str, Any]:
    runs = query(
        """
        select distinct on (source) source, started_at, finished_at, status, rows_upserted, error
        from raw.ingestion_log order by source, started_at desc
        """
    )
    recent = query(
        "select source, started_at, status, rows_upserted from raw.ingestion_log "
        "order by started_at desc limit 40"
    )
    stats = query(
        """
        select
            (select count(*) from raw.ingestion_log where status = 'success') as successful_runs,
            (select count(*) from raw.ingestion_log where status = 'failed')  as failed_runs,
            (select min(price_date) from marts.fct_retail_prices_daily)      as history_start,
            (select count(*) from marts.mart_price_change_events)            as price_changes_tracked,
            (select count(*) from marts.fct_retail_prices_daily)
              + (select count(*) from marts.fct_fx_rates_daily)
              + (select count(*) from marts.fct_crude_prices_daily)           as mart_rows
        """
    )[0]
    return {"sources": runs, "recent_runs": recent, "stats": stats}
