"use client";

import { useMemo, useState } from "react";
import type { Brand, LatestPrice } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { changeArrow, changeTone, fmtChange, fmtDate, fmtPrice } from "@/lib/format";
import { Chip, ChipGroup, ErrorNote } from "./ui";

const BRANDS: Brand[] = ["PTT", "Bangchak"];

export function TodayPrices() {
  const { data, error } = useApi<LatestPrice[]>("/v1/prices/latest");
  const [brand, setBrand] = useState<Brand>("PTT");

  const rows = useMemo(() => (data ?? []).filter((r) => r.brand === brand), [data, brand]);
  const asOf = rows[0]?.as_of_date;
  const tomorrowMoves = (data ?? []).filter((r) => r.tomorrow_change_thb != null && Number(r.tomorrow_change_thb) !== 0);

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-2">
            ราคาขายปลีก กรุงเทพฯ {asOf && <>· {fmtDate(asOf, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</>}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">ราคาน้ำมันวันนี้</h1>
        </div>
        <ChipGroup label="ยี่ห้อ">
          {BRANDS.map((b) => (
            <Chip key={b} pressed={brand === b} onClick={() => setBrand(b)}>
              {b === "PTT" ? "PTT" : "บางจาก"}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      {tomorrowMoves.length > 0 && (
        <div className="card mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
          <span className="font-medium text-ink">📢 ประกาศราคาพรุ่งนี้</span>
          {tomorrowMoves.map((r) => (
            <span key={`${r.brand}-${r.fuel_code}`} className="text-ink-2">
              {r.name_th} ({r.brand === "PTT" ? "PTT" : "บางจาก"}){" "}
              <span className={`font-semibold ${changeTone(r.tomorrow_change_thb)}`}>
                {changeArrow(r.tomorrow_change_thb)} {fmtChange(r.tomorrow_change_thb)}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <PriceTile key={r.fuel_code} row={r} />
        ))}
        {!data && !error &&
          Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-[132px] animate-pulse" />)}
      </div>

      {rows.length > 0 && <FillUpCalculator rows={rows} />}
    </div>
  );
}

function PriceTile({ row }: { row: LatestPrice }) {
  const range = row.min_1y_thb != null && row.max_1y_thb != null ? [Number(row.min_1y_thb), Number(row.max_1y_thb)] : null;
  const pos = range && range[1] > range[0] ? ((Number(row.price_thb) - range[0]) / (range[1] - range[0])) * 100 : null;
  return (
    <article className="card flex flex-col p-4">
      <h3 className="text-[13px] font-medium text-ink-2">{row.name_th}</h3>
      <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink">
        {fmtPrice(row.price_thb)}
        <span className="ml-1 text-xs font-normal text-muted">บ./ลิตร</span>
      </p>
      <p className="mt-1 text-xs">
        {row.last_change_thb != null ? (
          <>
            <span className={`font-semibold ${changeTone(row.last_change_thb)}`}>
              {changeArrow(row.last_change_thb)} {fmtChange(row.last_change_thb)}
            </span>
            <span className="text-muted"> · {fmtDate(row.last_change_date!, { day: "numeric", month: "short" })}</span>
          </>
        ) : (
          <span className="text-muted">เริ่มเก็บข้อมูลรายวัน</span>
        )}
      </p>
      {pos != null && (
        <div className="mt-auto pt-3" title={`ช่วง 1 ปี ${fmtPrice(range![0])}–${fmtPrice(range![1])} บาท`}>
          <div className="relative h-1 rounded-full bg-surface-2">
            <span
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${pos}%`, background: "var(--accent)", borderColor: "var(--surface)" }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted tabular">
            <span>{fmtPrice(range![0])}</span>
            <span>ช่วง 1 ปี</span>
            <span>{fmtPrice(range![1])}</span>
          </div>
        </div>
      )}
    </article>
  );
}

function FillUpCalculator({ rows }: { rows: LatestPrice[] }) {
  const [fuel, setFuel] = useState(rows.find((r) => r.fuel_code === "gasohol_95")?.fuel_code ?? rows[0].fuel_code);
  const [litres, setLitres] = useState(40);
  const row = rows.find((r) => r.fuel_code === fuel) ?? rows[0];
  const price = Number(row.price_thb);
  const cost = price * litres;
  const compare = [
    { label: "30 วันก่อน", change: row.change_30d_thb },
    { label: "1 ปีก่อน", change: row.change_365d_thb },
  ];

  return (
    <div className="card mt-4 grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <span className="font-medium text-ink">⛽ เติมเต็มถัง</span>
        <label className="sr-only" htmlFor="calc-litres">จำนวนลิตร</label>
        <input
          id="calc-litres"
          type="number"
          min={1}
          max={200}
          value={litres}
          onChange={(e) => setLitres(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          className="h-9 w-20 rounded-lg border border-line bg-surface-2 px-2 text-ink tabular"
        />
        <span>ลิตร</span>
        <label className="sr-only" htmlFor="calc-fuel">ชนิดน้ำมัน</label>
        <select
          id="calc-fuel"
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
          className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-ink"
        >
          {rows.map((r) => (
            <option key={r.fuel_code} value={r.fuel_code}>
              {r.name_th}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 sm:justify-end">
        <p className="text-sm text-ink-2">
          วันนี้จ่าย <span className="text-2xl font-semibold text-ink">{fmtPrice(cost)}</span> บาท
        </p>
        {compare.map((c) =>
          c.change == null ? null : (
            <p key={c.label} className="text-sm text-ink-2">
              เทียบ{c.label}{" "}
              <span className={`font-semibold ${changeTone(c.change)}`}>
                {changeArrow(c.change)} {fmtChange(Number(c.change) * litres)} บาท
              </span>
            </p>
          ),
        )}
      </div>
    </div>
  );
}
