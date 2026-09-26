# Thai Oil Pulse ⛽

**ระบบ data pipeline อัตโนมัติ** ที่ดึงราคาน้ำมันหน้าปั๊ม ค่าเงินบาท และราคาน้ำมันดิบโลกทุกวัน เก็บลง data warehouse
แปลงข้อมูลด้วย dbt พร้อม data quality tests แล้วแสดงบน dashboard ที่ตอบคำถามว่า

> **"น้ำมันดิบโลกขึ้น แล้วหน้าปั๊มไทยขึ้นตามช้ากี่วัน?"**

| สิ่งที่พบจากข้อมูล (ม.ค. 2565 – ปัจจุบัน) | |
|---|---|
| แก๊สโซฮอล์ / เบนซิน ตามราคา Brent (฿/ลิตร) หลังผ่านไป | **~4 วัน** (r ≈ 0.48) |
| ดีเซล ตามหลังผ่านไป | **~20 วัน** (r ≈ 0.29) ตอบสนองช้าและอ่อนกว่ามาก |
| ต้นทุนน้ำมันดิบขึ้น 1 ฿/ลิตร ทำให้แก๊สโซฮอล์ 95 ขึ้นเฉลี่ย | **~0.43 ฿** |

ดีเซลตอบสนองอ่อนกว่า ซึ่งเข้ากับการที่กองทุนน้ำมันเชื้อเพลิงช่วยพยุงราคาดีเซล
(ตัวเลขนี้แสดงความสัมพันธ์ ยังไม่ใช่เหตุและผล ดูรายละเอียดวิธีคำนวณใน [mart_pass_through_lag.sql](transform/models/marts/mart_pass_through_lag.sql))

---

## Architecture

```
 ┌──────────── Extract ────────────┐    ┌───────── Land ─────────┐    ┌──────── Transform (dbt) ────────┐    ┌──── Serve ────┐
 │ PTT OR      SOAP  (history)     │    │ data/landing/  raw     │    │ staging   typed, cleaned views  │    │ FastAPI /v1   │
 │ Bangchak    JSON  (today/tmrw)  │ ─► │   API payload archive  │ ─► │ intermediate  gap-filled daily  │ ─► │ Next.js +     │
 │ Frankfurter REST  (ECB FX)      │    │ Postgres raw.*         │    │ marts    facts, dims, insights  │    │ ECharts       │
 │ Yahoo       REST  (Brent, WTI)  │    │   idempotent upsert    │    │ 39 data tests + freshness       │    │ dashboard     │
 └─────────────────────────────────┘    │   raw.ingestion_log    │    └─────────────────────────────────┘    └───────────────┘
                                        └────────────────────────┘
          Orchestration: Dagster assets + schedules (06:15 / 21:15 Asia/Bangkok) · CI/CD: GitHub Actions
```

### Engineering decisions

| ประเด็น | วิธีที่ใช้ | เหตุผล |
|---|---|---|
| **Idempotency** | ทุกโหลดเป็น `INSERT … ON CONFLICT DO UPDATE` บน natural key | รันซ้ำ / retry ได้ข้อมูลไม่ซ้ำ |
| **Late corrections** | รอบรายวันดึงย้อนหลัง 10 วันทุกครั้ง | ถ้าแหล่งข้อมูลแก้ย้อนหลัง จะถูกเก็บ |
| **Backfill** | PTT API ให้ "ราคาที่มีผล ณ วันใดๆ" → ถามทีละวันแบบขนาน แล้ว dedupe ตามเวลาที่มีผล | ได้ประวัติปรับราคาครบ 335 ครั้ง ตั้งแต่ 2565 |
| **Bronze layer** | เก็บ response ดิบทุกครั้งใน `data/landing/<source>/<date>/` | parse ใหม่ได้โดยไม่ต้องยิง API อีก |
| **ไม่มี API ย้อนหลัง (บางจาก)** | snapshot วันละ 2 ครั้ง สะสมเป็นประวัติเอง | ข้อมูลยาวขึ้นทุกวันที่ pipeline รัน |
| **Calendar gaps** | forward-fill ใน dbt (FX ไม่ออกวันหยุด, น้ำมันดิบไม่เทรดเสาร์อาทิตย์) | join ข้ามแหล่งได้ทุกวัน |
| **สินค้าเลิกขาย** | series จบวันก่อน price list แรกที่ไม่มีสินค้านั้น | ไม่ลากราคาเก่าไปตลอด |
| **ชื่อสินค้าไม่ตรงกันข้ามยี่ห้อ** | seed `fuel_product_map.csv` → `fuel_code` กลาง + test เตือนเมื่อมีสินค้าใหม่ | เทียบ PTT กับบางจากได้ |
| **Timezone** | ทุกอย่างเป็น `Asia/Bangkok` (ราคามีผล 05:00 น.) | วันที่ตรงกับที่คนไทยเห็น |
| **Buddhist calendar** | แปลง พ.ศ. → ค.ศ. และเดือนย่อภาษาไทยใน parser (มี unit test) | API บางจากใช้ พ.ศ. |

### Data quality — ตัวอย่างสิ่งที่ tests จับได้จริง

- `Super Power X99` มีราคา **0.00 บาท** ในข้อมูลดิบ 8 แถว → source test เตือน และ staging กรองออก
- ราคาดีเซล B20 ขึ้น **9.80 บาทในวันเดียว** (เม.ย. 2569) → test `change_thb ∈ [-6, 6]` ตั้งเป็น warn ไว้ ข้อมูลจริงแต่ผิดปกติ ต้องให้คนตรวจสอบ
- `assert_latest_prices_are_current` ให้ build ล้มเหลวถ้าวันนี้ไม่มีราคา PTT (ingestion หยุดทำงาน)
- Source freshness: warn เมื่อไม่ได้โหลดเกิน 36 ชม. และ error เมื่อเกิน 72 ชม.

---

## Quick start

ต้องมี Docker, [uv](https://docs.astral.sh/uv/) และ Node 20+

```bash
cp .env.example .env
docker compose up -d                 # Postgres 16 on :5433
uv sync

uv run oil backfill                  # ~17k rows since 2022 (≈20s)
uv run oil transform                 # dbt build: seeds + models + tests

uv run uvicorn oil_pipeline.api.main:app --port 8000   # API → http://localhost:8000/docs
cd web && npm install && npm run dev                   # Dashboard → http://localhost:3000
```

Orchestration (asset lineage graph, schedules, retries):

```bash
uv run dagster dev                   # http://localhost:3000 (stop the web app first, or add -p 3001)
```

| Command | ทำอะไร |
|---|---|
| `oil init` | สร้าง schema/tables ใน raw |
| `oil ingest [--only ptt fx]` | โหลดข้อมูลย้อนหลัง 10 วันล่าสุด |
| `oil backfill [--since 2023-01-01]` | โหลดประวัติทั้งหมด |
| `oil transform` | `dbt build` |
| `oil run-daily` | ingest + transform (คำสั่งเดียวกับที่ scheduler ใช้) |

## API

| Endpoint | |
|---|---|
| `GET /v1/prices/latest?brand=PTT` | ราคาวันนี้ พรุ่งนี้ และการเปลี่ยนแปลง 1/7/30/365 วัน |
| `GET /v1/prices/history?fuel=diesel_b7&fuel=gasohol_95&brand=PTT&start=2024-01-01` | ราคารายวัน |
| `GET /v1/prices/changes?brand=PTT` | ประวัติการปรับราคา |
| `GET /v1/fx/history?currency=USD&currency=JPY` | บาทต่อ 1 หน่วยเงิน |
| `GET /v1/crude/history?benchmark=brent` | Brent/WTI เป็น USD/บาร์เรล และ ฿/ลิตร |
| `GET /v1/insights/fuel-vs-crude?fuel=gasohol_95` | หน้าปั๊ม vs ต้นทุนน้ำมันดิบ |
| `GET /v1/insights/pass-through` | ผลวิเคราะห์ lag correlation |
| `GET /v1/pipeline/status` | สถานะการรันและ freshness |

## Project layout

```
src/oil_pipeline/
  sources/          one module per API: fetch + pure parse()  (unit-tested)
  ingest.py         load jobs → raw.* via audited, idempotent upserts
  db.py             raw DDL, upsert helper, ingestion_log
  orchestration/    Dagster assets, dbt integration, schedules
  api/              FastAPI
transform/          dbt: staging → intermediate → marts, seeds, tests, macros
web/                Next.js 16 + ECharts dashboard
.github/workflows/  ci.yml (lint, tests, live integration build), daily.yml (production refresh)
```

## Deploy (ฟรีทั้งหมด)

1. **Warehouse**: สร้าง Postgres ที่ Neon หรือ Supabase แล้วตั้ง GitHub secrets `DATABASE_URL`, `DBT_HOST`, `DBT_PORT`, `DBT_USER`, `DBT_PASSWORD`, `DBT_DBNAME` จากนั้นรัน `oil backfill` หนึ่งครั้ง
2. **Scheduler**: `.github/workflows/daily.yml` รัน `oil run-daily` เวลา 06:15 และ 21:15 น.
3. **API**: deploy `uvicorn oil_pipeline.api.main:app` บน Render หรือ Fly.io
4. **Web**: deploy `web/` บน Vercel ตั้ง `NEXT_PUBLIC_API_URL` เป็น URL ของ API

## Data sources & caveats

- **PTT OR** `orapiweb.pttor.com` (SOAP) และ **บางจาก** `oil-price.bangchak.co.th` เป็นราคาขายปลีกเขตกรุงเทพฯ ยังไม่รวมภาษีบำรุงท้องถิ่น
- **Frankfurter** เป็นอัตราอ้างอิงของ ECB ไม่ใช่อัตราธนาคารแห่งประเทศไทย ถ้าต้องการอัตรา ธปท. ให้เปลี่ยนไปใช้ BOT API
- **Yahoo Finance** เป็น endpoint ที่ไม่มีเอกสารทางการ ถ้าจะใช้งานจริงควรมี EIA API เป็นแหล่งสำรอง
- โปรเจกต์นี้ทำเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
