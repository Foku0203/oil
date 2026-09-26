"use client";

import type { ChangeEvent } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { fuelVar } from "@/lib/fuels";
import { changeArrow, changeTone, fmtChange, fmtDate, fmtPrice } from "@/lib/format";
import { ErrorNote, Section } from "./ui";

export function RecentChanges() {
  const { data, error } = useApi<ChangeEvent[]>("/v1/prices/changes", { brand: "PTT", limit: 40 });

  // Group changes that happened on the same day into one timeline entry.
  const days = new Map<string, ChangeEvent[]>();
  for (const e of data ?? []) {
    if (!days.has(e.price_date)) days.set(e.price_date, []);
    days.get(e.price_date)!.push(e);
  }

  return (
    <Section id="changes" eyebrow="Timeline" title="ประวัติการปรับราคาล่าสุด (PTT)">
      {error ? (
        <ErrorNote message={error} />
      ) : (
        <ol className="card divide-y divide-[var(--line)]">
          {[...days.entries()].slice(0, 8).map(([day, events]) => (
            <li key={day} className="grid gap-2 p-4 sm:grid-cols-[140px_1fr]">
              <time className="text-sm font-medium text-ink">{fmtDate(day, { day: "numeric", month: "short", year: "numeric" })}</time>
              <ul className="flex flex-wrap gap-2">
                {events.map((e) => (
                  <li key={e.fuel_code} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[13px]">
                    <span className="swatch" style={{ background: `var(${fuelVar(e.fuel_code)})` }} />
                    <span className="text-ink-2">{e.name_th}</span>
                    <span className="tabular text-ink">{fmtPrice(e.price_thb)}</span>
                    <span className={`tabular font-semibold ${changeTone(e.change_thb)}`}>
                      {changeArrow(e.change_thb)} {fmtChange(e.change_thb)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
