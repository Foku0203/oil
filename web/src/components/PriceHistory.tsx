"use client";

import { useMemo, useState } from "react";
import type { Brand, PricePoint } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { CHARTABLE_FUELS, MAX_SERIES, fuelLabel, fuelVar } from "@/lib/fuels";
import { changeTone, fmtChange, fmtDate, fmtPrice, isoDaysAgo } from "@/lib/format";
import { EChart, baseOption, useTokens } from "./EChart";
import {
  Chip,
  ChipGroup,
  ErrorNote,
  FilterRow,
  Legend,
  RangeChips,
  type RangeKey,
  Section,
  ViewToggle,
  rangeDays,
  tooltipRow,
} from "./ui";

export function PriceHistory() {
  const [fuels, setFuels] = useState<string[]>(["diesel_b7", "gasohol_95", "gasohol_e20"]);
  const [brand, setBrand] = useState<Brand>("PTT");
  const [range, setRange] = useState<RangeKey>("1Y");
  const [table, setTable] = useState(false);
  const tokens = useTokens();

  const { data, error, loading } = useApi<PricePoint[]>("/v1/prices/history", {
    fuel: fuels,
    brand,
    start: isoDaysAgo(rangeDays(range)),
  });

  const series = useMemo(() => {
    const byFuel = new Map<string, [string, number][]>();
    for (const p of data ?? []) {
      if (!byFuel.has(p.fuel_code)) byFuel.set(p.fuel_code, []);
      byFuel.get(p.fuel_code)!.push([p.price_date, Number(p.price_thb)]);
    }
    return fuels.filter((f) => byFuel.has(f)).map((f) => ({ fuel: f, points: byFuel.get(f)! }));
  }, [data, fuels]);

  const option = useMemo(() => {
    if (!tokens || series.length === 0) return null;
    const base = baseOption(tokens);
    return {
      ...base,
      grid: { ...(base.grid as object), right: 64 },
      tooltip: {
        ...(base.tooltip as object),
        formatter: (params: { seriesName: string; color: string; value: [string, number] }[]) => {
          const date = fmtDate(params[0].value[0], { day: "numeric", month: "long", year: "numeric" });
          const rows = [...params]
            .sort((a, b) => b.value[1] - a.value[1])
            .map((p) => tooltipRow("x", p.color, p.seriesName, `${fmtPrice(p.value[1])} ฿`))
            .join("");
          return `<div style="margin-bottom:4px;color:${tokens.muted}">${date}</div>${rows}`;
        },
      },
      xAxis: { ...(base.xAxis as object), type: "time" },
      yAxis: { ...(base.yAxis as object), type: "value", scale: true, name: "บาท/ลิตร", nameTextStyle: { color: tokens.muted, fontSize: 11, align: "left" } },
      series: series.map(({ fuel, points }) => {
        const color = tokens.cssVar(fuelVar(fuel));
        return {
          type: "line",
          name: fuelLabel(fuel),
          data: points,
          step: "end",
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, color },
          itemStyle: { color, borderColor: tokens.surface, borderWidth: 2 },
          emphasis: { focus: "series", lineStyle: { width: 2.5 } },
          endLabel: {
            show: true,
            formatter: (p: { value: [string, number] }) => fmtPrice(p.value[1]),
            color: tokens.ink,
            fontSize: 11,
            fontWeight: 600,
          },
        };
      }),
    };
  }, [tokens, series]);

  const toggleFuel = (f: string) =>
    setFuels((cur) => (cur.includes(f) ? (cur.length > 1 ? cur.filter((x) => x !== f) : cur) : [...cur, f]));

  return (
    <Section
      id="history"
      eyebrow="ราคาย้อนหลัง"
      title="ราคาหน้าปั๊มขยับอย่างไร"
      lead="ราคาขายปลีกแต่ละชนิดย้อนหลังถึงปี 2565 เลือกเทียบได้สูงสุด 4 ชนิดพร้อมกัน"
    >
      <FilterRow>
        <ChipGroup label="ชนิดน้ำมัน">
          {CHARTABLE_FUELS.map((f) => (
            <Chip
              key={f}
              pressed={fuels.includes(f)}
              swatchVar={fuelVar(f)}
              onClick={() => toggleFuel(f)}
              disabled={!fuels.includes(f) && fuels.length >= MAX_SERIES}
            >
              {fuelLabel(f)}
            </Chip>
          ))}
        </ChipGroup>
      </FilterRow>
      <FilterRow>
        <ChipGroup label="ยี่ห้อ">
          {(["PTT", "Bangchak"] as Brand[]).map((b) => (
            <Chip key={b} pressed={brand === b} onClick={() => setBrand(b)}>
              {b === "PTT" ? "PTT" : "บางจาก"}
            </Chip>
          ))}
        </ChipGroup>
        <RangeChips value={range} onChange={setRange} />
      </FilterRow>

      {error ? (
        <ErrorNote message={error} />
      ) : (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-4">
            <Legend items={series.map((s) => ({ label: fuelLabel(s.fuel), colorVar: fuelVar(s.fuel) }))} />
            <ViewToggle table={table} onChange={setTable} />
          </div>
          {brand === "Bangchak" && (
            <p className="mb-2 text-xs text-muted">
              บางจากไม่มี API ย้อนหลัง — ระบบเริ่มเก็บ snapshot รายวันตั้งแต่วันที่เริ่มรัน pipeline ข้อมูลจะยาวขึ้นทุกวัน
            </p>
          )}
          {table ? (
            <PriceChangeTable data={data ?? []} fuels={series.map((s) => s.fuel)} />
          ) : (
            <EChart option={option} height={360} dimmed={loading} ariaLabel="กราฟราคาน้ำมันย้อนหลัง" />
          )}
        </div>
      )}
    </Section>
  );
}

function PriceChangeTable({ data, fuels }: { data: PricePoint[]; fuels: string[] }) {
  const rows = data.filter((p) => p.is_price_change).reverse();
  return (
    <div className="max-h-[360px] overflow-auto">
      <table className="data-table w-full">
        <thead>
          <tr>
            <th>วันที่ปรับราคา</th>
            <th>ชนิด</th>
            <th className="text-right">ราคาใหม่ (฿/ลิตร)</th>
            <th className="text-right">เปลี่ยนแปลง</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((p) => (
            <tr key={`${p.price_date}-${p.fuel_code}`}>
              <td className="text-ink-2">
                {fmtDate(p.price_date)}
                {p.is_announced && <span className="ml-1 text-xs text-accent">(ประกาศล่วงหน้า)</span>}
              </td>
              <td className="text-ink">
                <span className="swatch mr-1.5 inline-block align-middle" style={{ background: `var(${fuelVar(p.fuel_code)})` }} />
                {fuelLabel(p.fuel_code)}
              </td>
              <td className="text-right text-ink">{fmtPrice(p.price_thb)}</td>
              <td className={`text-right font-medium ${changeTone(p.change_thb)}`}>{fmtChange(p.change_thb)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-muted">
                ไม่มีการปรับราคาในช่วงนี้ ({fuels.map(fuelLabel).join(", ")})
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
