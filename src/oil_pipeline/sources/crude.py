"""Benchmark crude oil futures (front month, USD/barrel) from Yahoo Finance's chart endpoint."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from oil_pipeline.sources import http

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
TABLE = "raw.crude_prices"
KEYS = ("price_date", "symbol")
SYMBOLS = {"BZ=F": "brent", "CL=F": "wti"}


def parse(payload: dict) -> list[dict]:
    result = payload["chart"]["result"][0]
    symbol = result["meta"]["symbol"]
    tz = ZoneInfo(result["meta"].get("exchangeTimezoneName") or "America/New_York")
    quote = result["indicators"]["quote"][0]
    rows = []
    for i, ts in enumerate(result.get("timestamp") or []):
        close = quote["close"][i]
        if close is None:
            continue
        rows.append({
            "price_date": datetime.fromtimestamp(ts, tz).date(),
            "symbol": symbol,
            "open_usd": quote["open"][i],
            "high_usd": quote["high"][i],
            "low_usd": quote["low"][i],
            "close_usd": close,
            "volume": quote["volume"][i],
        })
    return rows


def fetch_range(start: date, end: date) -> list[dict]:
    period1 = int(datetime.combine(start, time.min).timestamp())
    period2 = int(datetime.combine(end + timedelta(days=1), time.min).timestamp())
    rows: list[dict] = []
    with http.client() as client:
        for symbol in SYMBOLS:
            payload = http.get(
                client,
                URL.format(symbol=symbol),
                params={"period1": period1, "period2": period2, "interval": "1d"},
            ).json()
            http.archive("crude", f"{symbol.replace('=', '')}_{start}_{end}", payload)
            rows.extend(parse(payload))
    return rows
