"use client";

import type { PipelineStatus } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { fmtDate, fmtDateTime, fmtInt } from "@/lib/format";
import { ErrorNote, Section, StatTile } from "./ui";

const SOURCE_INFO: Record<string, { name: string; detail: string }> = {
  ptt: { name: "PTT OR", detail: "SOAP · ราคาขายปลีกย้อนหลัง" },
  bangchak: { name: "บางจาก", detail: "JSON · ราคาวันนี้/พรุ่งนี้" },
  fx: { name: "ECB / Frankfurter", detail: "REST · อัตราแลกเปลี่ยน" },
  crude: { name: "Yahoo Finance", detail: "REST · Brent & WTI" },
};

const STAGES = [
  { title: "Extract", items: ["PTT OR SOAP", "Bangchak JSON", "Frankfurter FX", "Yahoo crude"], tech: "Python · httpx · tenacity" },
  { title: "Land", items: ["raw payload archive", "raw.* tables", "idempotent upsert", "ingestion_log"], tech: "PostgreSQL 16" },
  { title: "Transform", items: ["staging", "intermediate (gap-fill)", "marts", "dbt tests"], tech: "dbt-core" },
  { title: "Serve", items: ["FastAPI /v1", "Next.js dashboard", "OpenAPI docs"], tech: "FastAPI · Next.js · ECharts" },
];

function StatusBadge({ status }: { status: string }) {
  const ok = status === "success";
  const color = ok ? "var(--good)" : status === "running" ? "var(--warning)" : "var(--critical)";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink">
      <span aria-hidden="true" style={{ color }}>{ok ? "✔" : status === "running" ? "◔" : "✖"}</span>
      {ok ? "สำเร็จ" : status === "running" ? "กำลังรัน" : "ล้มเหลว"}
    </span>
  );
}

export function PipelineStatusView() {
  const { data, error } = useApi<PipelineStatus>("/v1/pipeline/status");

  return (
    <>
      <div className="pt-8">
        <p className="text-sm text-ink-2">Data engineering</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Pipeline ทำงานอย่างไร</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          Dagster สั่งรันวันละ 2 รอบ (06:15 หลังราคาใหม่มีผล และ 21:15 หลังประกาศราคาพรุ่งนี้) ดึงข้อมูลย้อนหลัง 10 วันทุกครั้ง
          แล้ว upsert เพื่อให้รันซ้ำได้โดยข้อมูลไม่ซ้ำ จากนั้น dbt สร้างตารางและรัน data tests ก่อนข้อมูลถึงหน้าเว็บ
        </p>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="แถวข้อมูลใน marts" value={fmtInt(data?.stats.mart_rows)} />
        <StatTile label="การปรับราคาที่ติดตาม" value={fmtInt(data?.stats.price_changes_tracked)} unit="ครั้ง" />
        <StatTile label="ข้อมูลย้อนหลังตั้งแต่" value={data ? fmtDate(data.stats.history_start, { month: "short", year: "numeric" }) : "–"} />
        <StatTile
          label="อัตรารันสำเร็จ"
          value={data ? `${Math.round((data.stats.successful_runs / Math.max(1, data.stats.successful_runs + data.stats.failed_runs)) * 100)}%` : "–"}
          note={data ? `${fmtInt(data.stats.successful_runs)} สำเร็จ · ${fmtInt(data.stats.failed_runs)} ล้มเหลว` : undefined}
        />
      </div>

      <Section id="architecture" eyebrow="Architecture" title="เส้นทางของข้อมูล">
        <ol className="grid gap-3 md:grid-cols-4">
          {STAGES.map((stage, i) => (
            <li key={stage.title} className="card relative p-4">
              <p className="text-xs font-semibold text-accent">
                {String(i + 1).padStart(2, "0")} · {stage.title}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {stage.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">{stage.tech}</p>
              {i < STAGES.length - 1 && (
                <span aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-muted md:block">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">ควบคุมทั้งหมดด้วย Dagster (asset lineage, retry, schedule) · CI บน GitHub Actions</p>
      </Section>

      <Section id="sources" eyebrow="Freshness" title="สถานะแหล่งข้อมูล">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.sources ?? []).map((s) => (
            <div key={s.source} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">{SOURCE_INFO[s.source]?.name ?? s.source}</p>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-xs text-muted">{SOURCE_INFO[s.source]?.detail}</p>
              <p className="mt-3 text-sm text-ink-2">
                รันล่าสุด <span className="text-ink">{fmtDateTime(s.started_at)}</span>
              </p>
              <p className="text-sm text-ink-2">
                upsert <span className="tabular text-ink">{fmtInt(s.rows_upserted)}</span> แถว
              </p>
              {s.error && <p className="mt-2 line-clamp-3 text-xs text-muted">{s.error}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section id="runs" eyebrow="Audit log" title="การรันล่าสุด">
        <div className="card max-h-[420px] overflow-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>แหล่ง</th>
                <th>สถานะ</th>
                <th className="text-right">แถว</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {(data?.recent_runs ?? []).map((r, i) => (
                <tr key={`${r.started_at}-${r.source}-${i}`}>
                  <td className="text-ink-2">{fmtDateTime(r.started_at)}</td>
                  <td className="text-ink">{SOURCE_INFO[r.source]?.name ?? r.source}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-right text-ink">{fmtInt(r.rows_upserted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
