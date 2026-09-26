"use client";

import { useMemo, useState } from "react";
import type { FxPoint } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { MAX_SERIES } from "@/lib/fuels";
import { changeArrow, fmtDate, fmtPrice, isoDaysAgo } from "@/lib/format";
import { EChart, baseOption, useTokens } from "./EChart";
import { Chip, ChipGroup, ErrorNote, FilterRow, Legend, RangeChips, type RangeKey, Section, rangeDays, tooltipRow } from "./ui";

// Fixed slot per currency so a colour always means the same currency.
const CURRENCIES: { code: string; label: string; slot: number }[] = [
  { code: "USD", label: "ดอลลาร์สหรัฐ", slot: 1 },
  { code: "EUR", label: "ยูโร", slot: 2 },
  { code: "JPY", label: "เยน", slot: 3 },
  { code: "CNY", label: "หยวน", slot: 4 },
  { code: "GBP", label: "ปอนด์", slot: 5 },
  { code: "SGD", label: "ดอลลาร์สิงคโปร์", slot: 6 },
  { code: "MYR", label: "ริงกิต", slot: 7 },
  { code: "KRW", label: "วอน", slot: 8 },
];
const cVar = (code: string) => `--s${CURRENCIES.find((c) => c.code === code)!.slot}`;
const cLabel = (code: string) => `${code} · ${CURRENCIES.find((c) => c.code === code)!.label}`;

export function FxSection() {
  const [selected, setSelected] = useState<string[]>(["USD"]);
  const [range, setRange] = useState<RangeKey>("1Y");
  const tokens = useTokens();
  const { data, error, loading } = useApi<FxPoint[]>("/v1/fx/history", {
    currency: selected,
    start: isoDaysAgo(rangeDays(range)),
  });
  const usd = useApi<FxPoint[]>("/v1/fx/history", { currency: "USD", start: isoDaysAgo(31) });

  // Several currencies live on wildly different scales (JPY ≈ 0.2 ฿, GBP ≈ 44 ฿):
  // one axis stays honest by indexing each to 100 at the start of the range.
  const indexed = selected.length > 1;

  const option = useMemo(() => {
    if (!tokens || !data?.length) return null;
    const base = baseOption(tokens);
    const byCcy = new Map<string, [string, number][]>();
    for (const p of data) {
      if (!byCcy.has(p.currency)) byCcy.set(p.currency, []);
      byCcy.get(p.currency)!.push([p.rate_date, Number(p.thb_per_unit)]);
    }
    const series = selected
      .filter((c) => byCcy.has(c))
      .map((code) => {
        const pts = byCcy.get(code)!;
        const first = pts[0][1];
        const values = indexed ? pts.map(([d, v]) => [d, (v / first) * 100] as [string, number]) : pts;
        const color = tokens.cssVar(cVar(code));
        return {
          type: "line",
          name: code,
          data: values,
          showSymbol: false,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          endLabel: { show: true, formatter: code, color: tokens.ink, fontSize: 11, fontWeight: 600 },
        };
      });
    return {
      ...base,
      grid: { ...(base.grid as object), right: 48 },
      tooltip: {
        ...(base.tooltip as object),
        formatter: (params: { seriesName: string; color: string; value: [string, number] }[]) =>
          `<div style="margin-bottom:4px;color:${tokens.muted}">${fmtDate(params[0].value[0], { day: "numeric", month: "long", year: "numeric" })}</div>` +
          params
            .map((p) => tooltipRow("x", p.color, p.seriesName, indexed ? p.value[1].toFixed(1) : `${p.value[1].toFixed(4)} ฿`))
            .join(""),
      },
      xAxis: { ...(base.xAxis as object), type: "time" },
      yAxis: {
        ...(base.yAxis as object),
        type: "value",
        scale: true,
        name: indexed ? "ดัชนี (วันแรก = 100)" : "บาทต่อ 1 หน่วย",
        nameTextStyle: { color: tokens.muted, fontSize: 11, align: "left" },
      },
      series,
    };
  }, [tokens, data, selected, indexed]);

  const usdNow = usd.data?.at(-1);
  const usdThen = usd.data?.[0];
  const usdChange = usdNow && usdThen ? Number(usdNow.thb_per_unit) - Number(usdThen.thb_per_unit) : null;

  const toggle = (code: string) =>
    setSelected((cur) => (cur.includes(code) ? (cur.length > 1 ? cur.filter((c) => c !== code) : cur) : [...cur, code]));

  return (
    <Section
      id="fx"
      eyebrow="ค่าเงินบาท"
      title="บาทแข็งหรืออ่อน ส่งผลต่อต้นทุนน้ำมันนำเข้า"
      lead="อัตราอ้างอิงธนาคารกลางยุโรป (ECB) แปลงเป็นบาทต่อ 1 หน่วยเงินต่างประเทศ เลือกหลายสกุลจะเปลี่ยนเป็นดัชนีเพื่อเทียบบนแกนเดียวกัน"
    >
      <FilterRow>
        <ChipGroup label="สกุลเงิน">
          {CURRENCIES.map((c) => (
            <Chip
              key={c.code}
              pressed={selected.includes(c.code)}
              swatchVar={cVar(c.code)}
              onClick={() => toggle(c.code)}
              disabled={!selected.includes(c.code) && selected.length >= MAX_SERIES}
            >
              {c.code}
            </Chip>
          ))}
        </ChipGroup>
        <RangeChips value={range} onChange={setRange} />
      </FilterRow>
      {error ? (
        <ErrorNote message={error} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
          <div className="card flex flex-col justify-center p-4">
            <p className="text-[13px] text-ink-2">1 ดอลลาร์สหรัฐ</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-ink">
              {usdNow ? fmtPrice(usdNow.thb_per_unit) : "–"}
              <span className="ml-1 text-sm font-normal text-muted">บาท</span>
            </p>
            {usdChange != null && (
              <p className="mt-1 text-xs text-ink-2">
                {changeArrow(usdChange)} {usdChange > 0 ? "บาทอ่อนค่า" : "บาทแข็งค่า"} {fmtPrice(Math.abs(usdChange))} บาท ใน 30 วัน
              </p>
            )}
            {usdNow && <p className="mt-3 text-[11px] text-muted">อัตรา ณ {fmtDate(usdNow.rate_date)}</p>}
          </div>
          <div className="card p-4">
            <div className="mb-2">
              <Legend items={selected.map((c) => ({ label: cLabel(c), colorVar: cVar(c) }))} />
            </div>
            <EChart option={option} height={300} dimmed={loading} ariaLabel="กราฟค่าเงินบาท" />
          </div>
        </div>
      )}
    </Section>
  );
}
