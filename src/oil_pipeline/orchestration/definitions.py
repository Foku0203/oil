"""Dagster code location: raw ingestion assets -> dbt models/tests, on a Bangkok-time schedule.

Run locally with `uv run dagster dev` and open http://localhost:3000 to see the asset lineage graph.
"""

from datetime import timedelta

import dagster as dg
from dagster_dbt import DbtCliResource, DbtProject, dbt_assets

from oil_pipeline import db, ingest
from oil_pipeline.config import PROJECT_ROOT

DBT_PROJECT = DbtProject(project_dir=PROJECT_ROOT / "transform", profiles_dir=PROJECT_ROOT / "transform")
DBT_PROJECT.prepare_if_dev()

LOOKBACK = timedelta(days=10)


def _window() -> tuple:
    end = ingest.today()
    return end - LOOKBACK, end


def _raw_asset(name: str, description: str, load):
    @dg.asset(
        key=dg.AssetKey(["raw", name]),
        group_name="ingestion",
        kinds={"python", "postgres"},
        description=description,
        retry_policy=dg.RetryPolicy(max_retries=2, delay=60, backoff=dg.Backoff.EXPONENTIAL),
    )
    def _asset(context: dg.AssetExecutionContext) -> dg.MaterializeResult:
        db.ensure_raw_schema()
        rows = load()
        context.log.info("upserted %s rows into raw.%s", rows, name)
        return dg.MaterializeResult(metadata={"rows_upserted": rows})

    return _asset


raw_ptt = _raw_asset(
    "ptt_oil_prices", "PTT OR Bangkok retail price lists (SOAP API).",
    lambda: ingest.load_ptt(*_window(), archive=True),
)
raw_bangchak = _raw_asset(
    "bangchak_oil_prices", "Bangchak today/tomorrow retail prices (JSON API).",
    ingest.load_bangchak,
)
raw_fx = _raw_asset(
    "fx_rates", "ECB reference FX rates vs USD (Frankfurter).",
    lambda: ingest.load_fx(*_window()),
)
raw_crude = _raw_asset(
    "crude_prices", "Brent & WTI front-month futures (Yahoo Finance).",
    lambda: ingest.load_crude(*_window()),
)


@dbt_assets(manifest=DBT_PROJECT.manifest_path)
def oil_dbt_models(context: dg.AssetExecutionContext, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()


daily_refresh = dg.define_asset_job("daily_refresh", selection=dg.AssetSelection.all())

# 06:15 picks up prices that took effect at 05:00; 21:15 catches next-day announcements (usually ~20:00).
schedules = [
    dg.ScheduleDefinition(
        name=f"daily_refresh_{hhmm}",
        job=daily_refresh,
        cron_schedule=cron,
        execution_timezone="Asia/Bangkok",
    )
    for hhmm, cron in [("0615", "15 6 * * *"), ("2115", "15 21 * * *")]
]

defs = dg.Definitions(
    assets=[raw_ptt, raw_bangchak, raw_fx, raw_crude, oil_dbt_models],
    jobs=[daily_refresh],
    schedules=schedules,
    resources={"dbt": DbtCliResource(project_dir=DBT_PROJECT)},
)
