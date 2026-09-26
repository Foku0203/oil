"""Command line entry point: `oil init | ingest | backfill | transform | run-daily`."""

import argparse
import logging
import subprocess
import sys
from datetime import date

from oil_pipeline import db, ingest
from oil_pipeline.config import PROJECT_ROOT

log = logging.getLogger("oil")
DBT_DIR = PROJECT_ROOT / "transform"


def _run_loaders(loaders: dict, only: list[str] | None) -> bool:
    ok = True
    for name, load in loaders.items():
        if only and name not in only:
            continue
        try:
            log.info("%-9s %d rows upserted", name, load())
        except Exception:
            log.exception("%-9s FAILED", name)
            ok = False
    return ok


def _dbt(*args: str) -> bool:
    cmd = ["dbt", *args, "--project-dir", str(DBT_DIR), "--profiles-dir", str(DBT_DIR)]
    return subprocess.run(cmd, cwd=PROJECT_ROOT).returncode == 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    parser = argparse.ArgumentParser(prog="oil")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init", help="create raw schema and tables")
    p_ingest = sub.add_parser("ingest", help="load the recent window from every source")
    p_ingest.add_argument("--only", nargs="*", choices=["ptt", "bangchak", "fx", "crude"])
    p_back = sub.add_parser("backfill", help="load full history")
    p_back.add_argument("--since", type=date.fromisoformat, default=ingest.HISTORY_START)
    p_back.add_argument("--only", nargs="*", choices=["ptt", "bangchak", "fx", "crude"])
    sub.add_parser("transform", help="dbt build (models + tests)")
    sub.add_parser("run-daily", help="ingest + transform, as the scheduler does")
    args = parser.parse_args(argv)

    if args.command == "init":
        db.ensure_raw_schema()
        log.info("raw schema ready")
        return 0

    db.ensure_raw_schema()
    if args.command == "ingest":
        return 0 if _run_loaders(ingest.daily_loaders(), args.only) else 1
    if args.command == "backfill":
        return 0 if _run_loaders(ingest.backfill_loaders(args.since), args.only) else 1
    if args.command == "transform":
        return 0 if _dbt("build") else 1
    if args.command == "run-daily":
        loaded = _run_loaders(ingest.daily_loaders(), None)
        built = _dbt("build")
        return 0 if loaded and built else 1
    return 2


if __name__ == "__main__":
    sys.exit(main())
