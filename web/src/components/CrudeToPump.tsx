"use client";

import { useMemo, useState } from "react";
import type { FuelVsCrude, LagRow } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { fuelLabel, fuelVar } from "@/lib/fuels";
import { fmtDate, fmtPrice, isoDaysAgo } from "@/lib/format";
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
  StatTile,
  rangeDays,
  tooltipRow,
} from "./ui";

const FUELS = ["gasohol_95", "gasohol_91", "gasohol_e20", "benzine_95", "diesel_b7", "diesel_b20"];

export function CrudeToPump() {
  const [fuel, setFuel] = useState("gasohol_95");
  const [range, setRange] = useState<RangeKey>("3Y");
  const tokens = useTokens();

  const lag = useApi<{ best: LagRow[]; curves: LagRow[] }>("/v1/insights/pass-through");
  const vs = useApi<FuelVsCrude[]>("/v1/insights/fuel-vs-crude", { fuel, start: isoDaysAgo(rangeDays(range)) });

  const best = lag.data?.best.find((b) => b.fuel_code === fuel);
  const latest = vs.data?.at(-1);
  const color = tokens?.cssVar(fuelVar(fuel)) ?? "";

  const compareOption = useMemo(() => {
    if (!tokens || !vs.data?.length) return null;
    const base = baseOption(tokens);
    const rows = vs.data;
    return {
      ...base,
      grid: { ...(base.grid as object), right: 64 },
      tooltip: {
        ...(base.tooltip as object),
        formatter: (params: { dataIndex: number }[]) => {
          const r = rows[params[0].dataIndex];
          return (
            `<div style="margin-bottom:4px;color:${tokens.muted}">${fmtDate(r.price_date, { day: "numeric", month: "long", year: "numeric" })}</div>` +
            tooltipRow("x", color, `หน้าปั๊ม ${fuelLabel(fuel)}`, `${fmtPrice(r.retail_thb_per_litre)} ฿/ล.`) +
            tooltipRow("x", tokens.ref, "ต้นทุนน้ำมันดิบ Brent", `${fmtPrice(r.brent_thb_per_litre)} ฿/ล.`) +
            tooltipRow(null, "", "ส่วนต่าง (ภาษี กองทุน โรงกลั่น ค่าตลาด)", `${fmtPrice(r.gap_thb_per_litre)} ฿/ล.`) +
            `<div style="margin-top:4px;color:${tokens.muted};font-size:11px">Brent $${fmtPrice(r.brent_usd_per_barrel)}/บาร์เรล · ${fmtPrice(r.thb_per_usd)} ฿/$</div>`
          );
        },
      },
      xAxis: { ...(base.xAxis as object), type: "time" },
      yAxis: { ...(base.yAxis as object), type: "value", min: 0, name: "บาท/ลิตร", nameTextStyle: { color: tokens.muted, fontSize: 11, align: "left" } },
      series: [
        {
          type: "line",
          name: "retail",
          data: rows.map((r) => [r.price_date, Number(r.retail_thb_per_litre)]),
          step: "end",
          showSymbol: false,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          endLabel: { show: true, formatter: (p: { value: [string, number] }) => fmtPrice(p.value[1]), color: tokens.ink, fontSize: 11, fontWeight: 600 },
        },
        {
          type: "line",
          name: "brent",
          data: rows.map((r) => [r.price_date, Number(r.brent_thb_per_litre)]),
          showSymbol: false,
          lineStyle: { width: 1.5, color: tokens.ref },
          itemStyle: { color: tokens.ref },
          areaStyle: { color: tokens.ref, opacity: 0.08 },
          endLabel: { show: true, formatter: (p: { value: [string, number] }) => fmtPrice(p.value[1]), color: tokens.ink2, fontSize: 11 },
        },
      ],
    };
  }, [tokens, vs.data, color, fuel]);

  const lagBarsOption = useMemo(() => {
    if (!tokens || !lag.data) return null;
    const base = baseOption(tokens);
    const rows = [...lag.data.best].filter((b) => FUELS.includes(b.fuel_code)).sort((a, b) => a.lag_days - b.lag_days);
    return {
      ...base,
      grid: { ...(base.grid as object), right: 56 },
      tooltip: {
        ...(base.tooltip as object),
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex];
          return (
            `<div style="margin-bottom:4px;font-weight:600">${fuelLabel(r.fuel_code)}</div>` +
            tooltipRow(null, "", "ตามราคาโลกช้า", `${r.lag_days} วัน`) +
            tooltipRow(null, "", "ความสัมพันธ์ (r)", Number(r.correlation).toFixed(2)) +
            tooltipRow(null, "", "ส่งผ่านต่อ 1 ฿ ของต้นทุน", `${Number(r.pass_through_ratio).toFixed(2)} ฿`)
          );
        },
      },
      xAxis: { ...(base.xAxis as object), type: "value", name: "วัน", nameTextStyle: { color: tokens.muted, fontSize: 11 }, splitLine: { lineStyle: { color: tokens.grid } } },
      yAxis: {
        ...(base.yAxis as object),
        type: "category",
        inverse: true,
        data: rows.map((r) => fuelLabel(r.fuel_code)),
        splitLine: { show: false },
        axisLabel: { color: tokens.ink2, fontSize: 12 },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 18,
          data: rows.map((r) => ({
            value: r.lag_days,
            itemStyle: {
              color: r.fuel_code === fuel ? tokens.cssVar("--accent") : tokens.axis,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          label: { show: true, position: "right", formatter: "{c} วัน", color: tokens.ink2, fontSize: 11 },
        },
      ],
    };
  }, [tokens, lag.data, fuel]);

  const curveOption = useMemo(() => {
    if (!tokens || !lag.data) return null;
    const base = baseOption(tokens);
    const byFuel = new Map<string, LagRow[]>();
    for (const r of lag.data.curves) {
      if (!FUELS.includes(r.fuel_code)) continue;
      if (!byFuel.has(r.fuel_code)) byFuel.set(r.fuel_code, []);
      byFuel.get(r.fuel_code)!.push(r);
    }
    const others = [...byFuel.entries()].filter(([f]) => f !== fuel);
    const mine = byFuel.get(fuel) ?? [];
    const peak = mine.find((r) => r.is_best_lag);
    return {
      ...base,
      tooltip: {
        ...(base.tooltip as object),
        formatter: (params: { seriesName: string; value: [number, number] }[]) => {
          const p = params.find((x) => x.seriesName === fuel);
          if (!p) return "";
          return tooltipRow("x", color, `${fuelLabel(fuel)} · ล่าช้า ${p.value[0]} วัน`, `r = ${p.value[1].toFixed(2)}`);
        },
      },
      xAxis: { ...(base.xAxis as object), type: "value", min: 0, max: 42, interval: 7, name: "ล่าช้า (วัน)", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: tokens.muted, fontSize: 11 } },
      yAxis: { ...(base.yAxis as object), type: "value", name: "ความสัมพันธ์ r", nameTextStyle: { color: tokens.muted, fontSize: 11, align: "left" } },
      series: [
        ...others.map(([f, rows]) => ({
          type: "line",
          name: f,
          data: rows.map((r) => [r.lag_days, Number(r.correlation)]),
          showSymbol: false,
          silent: true,
          lineStyle: { width: 1, color: tokens.axis },
          z: 1,
        })),
        {
          type: "line",
          name: fuel,
          data: mine.map((r) => [r.lag_days, Number(r.correlation)]),
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, color },
          itemStyle: { color, borderColor: tokens.surface, borderWidth: 2 },
          z: 3,
          markPoint: peak
            ? {
                symbol: "circle",
                symbolSize: 10,
                itemStyle: { color, borderColor: tokens.surface, borderWidth: 2 },
                label: { show: true, position: "top", formatter: `${peak.lag_days} วัน`, color: tokens.ink, fontSize: 11, fontWeight: 600 },
                data: [{ coord: [peak.lag_days, Number(peak.correlation)] }],
              }
            : undefined,
        },
      ],
    };
  }, [tokens, lag.data, fuel, color]);

  return (
    <Section
      id="crude"
      eyebrow="Insight"
      title="น้ำมันดิบโลกขึ้น แล้วหน้าปั๊มไทยขึ้นตามช้ากี่วัน?"
      lead={
        <>
          แปลงราคา Brent เป็น <b className="text-ink">บาทต่อลิตร</b> ด้วยค่าเงินบาทรายวัน แล้วหาความสัมพันธ์ระหว่างการเปลี่ยนแปลง
          7 วันของราคาหน้าปั๊มกับราคาน้ำมันดิบย้อนหลัง 0–42 วัน จุดที่ความสัมพันธ์สูงสุดบอก &ldquo;ความล่าช้า&rdquo; โดยประมาณ
        </>
      }
    >
      <FilterRow>
        <ChipGroup label="ชนิดน้ำมัน">
          {FUELS.map((f) => (
            <Chip key={f} pressed={fuel === f} swatchVar={fuelVar(f)} onClick={() => setFuel(f)}>
              {fuelLabel(f)}
            </Chip>
          ))}
        </ChipGroup>
        <RangeChips value={range} onChange={setRange} />
      </FilterRow>

      {(lag.error || vs.error) && <ErrorNote message={(lag.error || vs.error)!} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={`${fuelLabel(fuel)} ตามราคาโลกช้า`}
          value={best ? best.lag_days : "–"}
          unit="วัน"
          note={best ? `ความสัมพันธ์ r = ${Number(best.correlation).toFixed(2)} จาก ${best.n_obs.toLocaleString()} วัน` : undefined}
        />
        <StatTile
          label="ต้นทุนน้ำมันดิบขึ้น 1 บาท/ลิตร"
          value={best ? Number(best.pass_through_ratio).toFixed(2) : "–"}
          unit="บาท"
          note="ราคาหน้าปั๊มขยับตามโดยเฉลี่ย (ส่วนที่เหลือถูกดูดซับ)"
        />
        <StatTile
          label="ส่วนต่างหน้าปั๊ม − น้ำมันดิบ วันนี้"
          value={latest ? fmtPrice(latest.gap_thb_per_litre) : "–"}
          unit="บาท/ลิตร"
          note="ภาษี กองทุนน้ำมัน ค่าการกลั่น และค่าการตลาด"
        />
      </div>

      <div className="card mt-3 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">ราคาหน้าปั๊ม vs ต้นทุนน้ำมันดิบ (บาท/ลิตร)</h3>
          <Legend
            items={[
              { label: `หน้าปั๊ม ${fuelLabel(fuel)} (PTT)`, colorVar: fuelVar(fuel) },
              { label: "Brent แปลงเป็น ฿/ลิตร", colorVar: "--ref" },
            ]}
          />
        </div>
        <EChart option={compareOption} height={340} dimmed={vs.loading} ariaLabel="กราฟเทียบราคาหน้าปั๊มกับต้นทุนน้ำมันดิบ" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="text-sm font-medium text-ink">แต่ละชนิดตามราคาโลกช้ากี่วัน</h3>
          <p className="text-xs text-muted">ดีเซลตอบสนองช้าและอ่อนกว่า สอดคล้องกับการที่กองทุนน้ำมันฯ ช่วยพยุงราคาดีเซล</p>
          <EChart option={lagBarsOption} height={260} ariaLabel="กราฟแท่งจำนวนวันที่ราคาหน้าปั๊มตามราคาน้ำมันดิบ" />
        </div>
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-ink">ความสัมพันธ์ตามจำนวนวันที่ล่าช้า</h3>
            <Legend items={[{ label: fuelLabel(fuel), colorVar: fuelVar(fuel) }, { label: "ชนิดอื่น", colorVar: "--axis" }]} />
          </div>
          <EChart option={curveOption} height={260} ariaLabel="กราฟความสัมพันธ์ตามจำนวนวันที่ล่าช้า" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        * ความสัมพันธ์ไม่ใช่เหตุและผล หน้าต่าง 7 วันที่ซ้อนกันทำให้ค่าดูสูงกว่าจริง ใช้เป็นภาพประกอบ ไม่ใช่การพยากรณ์
      </p>
    </Section>
  );
}
