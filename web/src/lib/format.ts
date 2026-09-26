const thb = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("th-TH");

export const fmtPrice = (v: number | null | undefined) => (v == null ? "–" : thb.format(Number(v)));
export const fmtInt = (v: number | null | undefined) => (v == null ? "–" : int.format(Number(v)));

export function fmtChange(v: number | null | undefined): string {
  if (v == null) return "–";
  const n = Number(v);
  if (n === 0) return "0.00";
  return `${n > 0 ? "+" : "−"}${thb.format(Math.abs(n))}`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "2-digit" }) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("th-TH", opts);
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Tailwind text class for a price move: up is bad for drivers, down is good. */
export function changeTone(v: number | null | undefined): string {
  if (v == null || Number(v) === 0) return "text-muted";
  return Number(v) > 0 ? "text-up" : "text-down";
}

export function changeArrow(v: number | null | undefined): string {
  if (v == null || Number(v) === 0) return "•";
  return Number(v) > 0 ? "▲" : "▼";
}
