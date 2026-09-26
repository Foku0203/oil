"""Bangchak retail fuel prices, including the next-day price once it has been announced.

The API only exposes yesterday / today / tomorrow, so history for this brand is built up by
snapshotting it every day. Dates are in the Buddhist calendar (B.E. = C.E. + 543).
"""

import json
import re
from datetime import date, datetime

from oil_pipeline.config import BANGKOK
from oil_pipeline.sources import http

URL = "https://oil-price.bangchak.co.th/ApiOilPrice2/th"
TABLE = "raw.bangchak_oil_prices"
KEYS = ("as_of_date", "oil_name")

_THAI_MONTHS = {
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
}
_EFFECTIVE = re.compile(r"(\d{1,2})\s*(\S+\.)\s*(\d{2,4})")


def _be_date(text: str) -> date:
    day, month, year = (int(x) for x in text.split("/"))
    return date(year - 543, month, day)


def parse_effective_date(remark: str | None) -> date | None:
    """'ราคามีผล ณ วันที่ 24 ก.ย. 69 เวลา 05.00 น.' -> 2026-09-24"""
    if not remark:
        return None
    match = _EFFECTIVE.search(remark)
    if not match or match.group(2) not in _THAI_MONTHS:
        return None
    year = int(match.group(3))
    if year < 100:
        year += 2500
    return date(year - 543, _THAI_MONTHS[match.group(2)], int(match.group(1)))


def parse(payload: list[dict]) -> list[dict]:
    rows = []
    for item in payload:
        as_of = _be_date(item["OilDateNow"])
        announced = None
        if item.get("OilPriceDate") and item.get("OilPriceTime"):
            announced = datetime.combine(
                _be_date(item["OilPriceDate"]),
                datetime.strptime(item["OilPriceTime"], "%H:%M").time(),
                tzinfo=BANGKOK,
            )
        effective = parse_effective_date(item.get("OilRemark2"))
        oils = item["OilList"]
        if isinstance(oils, str):
            oils = json.loads(oils)
        for oil in oils:
            rows.append({
                "as_of_date": as_of,
                "oil_name": oil["OilName"].strip(),
                "announced_at": announced,
                "effective_date": effective,
                "price_yesterday": oil.get("PriceYesterday"),
                "price_today": oil.get("PriceToday"),
                "price_tomorrow": oil.get("PriceTomorrow"),
            })
    return rows


def fetch() -> list[dict]:
    with http.client() as client:
        payload = http.get(client, URL).json()
    http.archive("bangchak", "latest", payload)
    return parse(payload)
