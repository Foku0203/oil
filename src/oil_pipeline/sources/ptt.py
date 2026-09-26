"""PTT OR retail fuel prices (Bangkok) via the public OilPrice SOAP service.

`GetOilPrice(date)` returns the price list that was in effect on that date, stamped with the
moment the list took effect. Querying consecutive days and de-duplicating on that stamp
recovers the full price-change history (available from early 2022).
"""

import html
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

import httpx

from oil_pipeline.config import BANGKOK
from oil_pipeline.sources import http

URL = "https://orapiweb.pttor.com/oilservice/OilPrice.asmx"
SOAP_ACTION = "http://www.pttor.com/GetOilPrice"
TABLE = "raw.ptt_oil_prices"
KEYS = ("effective_at", "product")

_ENVELOPE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
<GetOilPrice xmlns="http://www.pttor.com"><Language>en</Language><DD>{d}</DD><MM>{m}</MM><YYYY>{y}</YYYY></GetOilPrice>
</soap:Body></soap:Envelope>"""
_RESULT = re.compile(r"<GetOilPriceResult>(.*)</GetOilPriceResult>", re.S)


def parse(soap_response: str) -> list[dict]:
    match = _RESULT.search(soap_response)
    if not match or not match.group(1).strip():
        return []
    root = ET.fromstring(html.unescape(match.group(1)))
    rows = []
    for fuel in root.iter("FUEL"):
        price = (fuel.findtext("PRICE") or "").strip()
        product = (fuel.findtext("PRODUCT") or "").strip()
        stamp = (fuel.findtext("PRICE_DATE") or "").strip()
        if not (price and product and stamp):
            continue
        effective = datetime.strptime(stamp, "%m/%d/%Y %I:%M:%S %p").replace(tzinfo=BANGKOK)
        rows.append({"effective_at": effective, "product": product, "price_thb": float(price)})
    return rows


def fetch_day(client: httpx.Client, day: date, archive: bool = False) -> list[dict]:
    body = _ENVELOPE.format(d=day.day, m=day.month, y=day.year)
    response = http.post(
        client,
        URL,
        content=body.encode(),
        headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": SOAP_ACTION},
    )
    if archive:
        http.archive("ptt", day.isoformat(), response.text)
    return parse(response.text)


def fetch_range(start: date, end: date, workers: int = 8, archive: bool = False) -> list[dict]:
    """Every distinct price list in effect between start and end (inclusive)."""
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    unique: dict[tuple, dict] = {}
    with http.client() as client, ThreadPoolExecutor(max_workers=workers) as pool:
        for rows in pool.map(lambda d: fetch_day(client, d, archive), days):
            for row in rows:
                unique[(row["effective_at"], row["product"])] = row
    return sorted(unique.values(), key=lambda r: (r["effective_at"], r["product"]))
