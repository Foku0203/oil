export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type Brand = "PTT" | "Bangchak";

export interface LatestPrice {
  brand: Brand;
  fuel_code: string;
  name_th: string;
  name_en: string;
  fuel_group: string;
  sort_order: number;
  as_of_date: string;
  price_thb: number;
  tomorrow_price_thb: number | null;
  tomorrow_change_thb: number | null;
  change_1d_thb: number | null;
  change_7d_thb: number | null;
  change_30d_thb: number | null;
  change_365d_thb: number | null;
  last_change_date: string | null;
  last_change_thb: number | null;
  min_1y_thb: number | null;
  max_1y_thb: number | null;
}

export interface PricePoint {
  price_date: string;
  fuel_code: string;
  price_thb: number;
  change_thb: number | null;
  is_price_change: boolean;
  is_announced: boolean;
}

export interface FuelVsCrude {
  price_date: string;
  fuel_code: string;
  retail_thb_per_litre: number;
  brent_usd_per_barrel: number;
  thb_per_usd: number;
  brent_thb_per_litre: number;
  gap_thb_per_litre: number;
}

export interface LagRow {
  fuel_code: string;
  name_th: string;
  name_en: string;
  fuel_group: string;
  lag_days: number;
  n_obs: number;
  correlation: number;
  pass_through_ratio: number;
  is_best_lag: boolean;
}

export interface FxPoint {
  rate_date: string;
  currency: string;
  thb_per_unit: number;
  is_published: boolean;
}

export interface ChangeEvent {
  price_date: string;
  brand: Brand;
  fuel_code: string;
  name_th: string;
  prev_price_thb: number;
  price_thb: number;
  change_thb: number;
  change_pct: number;
  is_announced: boolean;
}

export interface SourceRun {
  source: string;
  started_at: string;
  finished_at: string | null;
  status: "success" | "failed" | "running";
  rows_upserted: number | null;
  error: string | null;
}

export interface PipelineStatus {
  sources: SourceRun[];
  recent_runs: Pick<SourceRun, "source" | "started_at" | "status" | "rows_upserted">[];
  stats: {
    successful_runs: number;
    failed_runs: number;
    history_start: string;
    price_changes_tracked: number;
    mart_rows: number;
  };
}

type Params = Record<string, string | number | string[] | undefined>;

export function apiUrl(path: string, params: Params = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, String(v));
  }
  const query = qs.toString();
  return `${API_BASE}${path}${query ? `?${query}` : ""}`;
}

export async function getJson<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  const res = await fetch(apiUrl(path, params), { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}
