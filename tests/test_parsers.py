from datetime import date, datetime

from oil_pipeline.config import BANGKOK
from oil_pipeline.sources import bangchak, crude, fx, ptt

PTT_RESPONSE = """<?xml version='1.0' encoding='utf-8'?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>
<GetOilPriceResponse xmlns="http://www.pttor.com"><GetOilPriceResult>&lt;PTTOR_DS&gt;
  &lt;FUEL&gt;&lt;PRICE_DATE&gt;09/24/2026 5:00:00 AM&lt;/PRICE_DATE&gt;&lt;PRODUCT&gt;Diesel&lt;/PRODUCT&gt;&lt;PRICE&gt;41.44&lt;/PRICE&gt;&lt;/FUEL&gt;
  &lt;FUEL&gt;&lt;PRICE_DATE&gt;09/24/2026 5:00:00 AM&lt;/PRICE_DATE&gt;&lt;PRODUCT&gt;Gasohol 95&lt;/PRODUCT&gt;&lt;PRICE&gt;&lt;/PRICE&gt;&lt;/FUEL&gt;
&lt;/PTTOR_DS&gt;</GetOilPriceResult></GetOilPriceResponse></soap:Body></soap:Envelope>"""


def test_ptt_parse_skips_blank_prices_and_localises_time():
    rows = ptt.parse(PTT_RESPONSE)
    assert rows == [{
        "effective_at": datetime(2026, 9, 24, 5, 0, tzinfo=BANGKOK),
        "product": "Diesel",
        "price_thb": 41.44,
    }]


def test_ptt_parse_empty_result():
    assert ptt.parse("<GetOilPriceResult></GetOilPriceResult>") == []


def test_bangchak_parse_converts_buddhist_dates():
    payload = [{
        "OilDateNow": "26/09/2569",
        "OilPriceDate": "23/09/2569",
        "OilPriceTime": "20:55",
        "OilRemark2": "ราคามีผล ณ วันที่ 24 ก.ย. 69 เวลา 05.00 น.",
        "OilList": '[{"OilName":"ดีเซล B20 ","PriceYesterday":35.69,"PriceToday":36.44,"PriceTomorrow":36.44}]',
    }]
    [row] = bangchak.parse(payload)
    assert row["as_of_date"] == date(2026, 9, 26)
    assert row["announced_at"] == datetime(2026, 9, 23, 20, 55, tzinfo=BANGKOK)
    assert row["effective_date"] == date(2026, 9, 24)
    assert row["oil_name"] == "ดีเซล B20"
    assert row["price_tomorrow"] == 36.44


def test_bangchak_effective_date_handles_missing_remark():
    assert bangchak.parse_effective_date(None) is None
    assert bangchak.parse_effective_date("ไม่มีข้อมูล") is None


def test_fx_parse_latest_and_range_shapes():
    latest = {"base": "USD", "date": "2026-09-25", "rates": {"THB": 33.345}}
    ranged = {"base": "USD", "rates": {"2026-09-24": {"THB": 33.1}, "2026-09-25": {"THB": 33.345}}}
    assert fx.parse(latest) == [
        {"rate_date": date(2026, 9, 25), "base_currency": "USD", "quote_currency": "THB", "rate": 33.345}
    ]
    assert [r["rate_date"] for r in fx.parse(ranged)] == [date(2026, 9, 24), date(2026, 9, 25)]


def test_crude_parse_drops_null_closes():
    payload = {"chart": {"result": [{
        "meta": {"symbol": "BZ=F", "exchangeTimezoneName": "America/New_York"},
        "timestamp": [1790308800, 1790395200],
        "indicators": {"quote": [{
            "open": [99.0, 98.0], "high": [100.0, 99.0], "low": [98.0, 97.0],
            "close": [None, 97.44], "volume": [None, 63901],
        }]},
    }]}}
    rows = crude.parse(payload)
    assert len(rows) == 1
    assert rows[0]["symbol"] == "BZ=F"
    assert rows[0]["close_usd"] == 97.44
