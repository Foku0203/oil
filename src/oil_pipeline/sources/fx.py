"""Daily reference exchange rates (European Central Bank) via the Frankfurter API.

Rates are stored against USD; THB-per-unit crosses are derived in dbt.
ECB publishes on TARGET business days only, so weekends are forward-filled downstream.
"""

from datetime import date

from oil_pipeline.sources import http

URL = "https://api.frankfurter.app"
TABLE = "raw.fx_rates"
KEYS = ("rate_date", "base_currency", "quote_currency")
BASE = "USD"
QUOTES = ("THB", "EUR", "JPY", "CNY", "GBP", "SGD", "MYR", "KRW", "HKD", "AUD")


def parse(payload: dict) -> list[dict]:
    base = payload["base"]
    rates = payload["rates"]
    # /latest returns {"date": ..., "rates": {ccy: rate}}; ranges return {"rates": {date: {ccy: rate}}}
    if "date" in payload and not isinstance(next(iter(rates.values()), None), dict):
        rates = {payload["date"]: rates}
    rows = []
    for day, quotes in rates.items():
        for quote, rate in quotes.items():
            rows.append({
                "rate_date": date.fromisoformat(day),
                "base_currency": base,
                "quote_currency": quote,
                "rate": rate,
            })
    return rows


def fetch_range(start: date, end: date) -> list[dict]:
    with http.client() as client:
        payload = http.get(
            client,
            f"{URL}/{start.isoformat()}..{end.isoformat()}",
            params={"from": BASE, "to": ",".join(QUOTES)},
        ).json()
    http.archive("fx", f"{start}_{end}", payload)
    rows = parse(payload)
    # A range request snaps start back to the previous business day; keep only what was asked for.
    return [r for r in rows if start <= r["rate_date"] <= end] or rows
