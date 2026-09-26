"use client";

import type { ReactNode } from "react";

export const RANGES = [
  { key: "3M", label: "3 เดือน", days: 90 },
  { key: "1Y", label: "1 ปี", days: 365 },
  { key: "3Y", label: "3 ปี", days: 365 * 3 },
  { key: "ALL", label: "ทั้งหมด", days: 365 * 10 },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];
export const rangeDays = (key: RangeKey) => RANGES.find((r) => r.key === key)!.days;

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 pt-12">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-semibold text-ink sm:text-[28px]">{title}</h2>
      {lead && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>;
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {children}
    </div>
  );
}

export function Chip({
  pressed,
  onClick,
  swatchVar,
  disabled,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  swatchVar?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="chip disabled:cursor-not-allowed disabled:opacity-40"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
    >
      {swatchVar && (
        <span className="swatch" style={{ background: pressed ? `var(${swatchVar})` : "transparent", outline: `1.5px solid var(${swatchVar})` }} />
      )}
      {children}
    </button>
  );
}

export function RangeChips({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <ChipGroup label="ช่วงเวลา">
      {RANGES.map((r) => (
        <Chip key={r.key} pressed={value === r.key} onClick={() => onChange(r.key)}>
          {r.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}

export function Legend({ items }: { items: { label: string; colorVar: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-[3px] w-4 rounded-full"
            style={{ background: `var(${item.colorVar})`, opacity: item.dashed ? 0.8 : 1 }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ViewToggle({ table, onChange }: { table: boolean; onChange: (table: boolean) => void }) {
  return (
    <div className="ml-auto flex rounded-full border border-line p-0.5 text-xs">
      {[
        { v: false, label: "กราฟ" },
        { v: true, label: "ตาราง" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={table === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 ${table === o.v ? "bg-surface-2 font-medium text-ink" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="card flex items-start gap-2 p-4 text-sm text-ink-2" role="alert">
      <span aria-hidden="true" style={{ color: "var(--critical)" }}>⚠</span>
      <div>
        <p className="font-medium text-ink">โหลดข้อมูลไม่สำเร็จ</p>
        <p className="text-muted">{message} · ตรวจสอบว่า API รันอยู่ (uv run uvicorn oil_pipeline.api.main:app)</p>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${tone ?? "text-ink"}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function tooltipRow(colorVar: string | null, color: string, label: string, value: string) {
  const swatch = colorVar
    ? `<span style="display:inline-block;width:10px;height:3px;border-radius:2px;background:${color};margin-right:6px;vertical-align:middle"></span>`
    : "";
  return `<div style="display:flex;justify-content:space-between;gap:16px;line-height:1.7"><span>${swatch}${label}</span><b style="font-variant-numeric:tabular-nums">${value}</b></div>`;
}
