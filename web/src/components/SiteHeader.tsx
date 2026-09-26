"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/lib/api";

const NAV = [
  { href: "/", label: "ภาพรวม" },
  { href: "/pipeline", label: "Pipeline" },
];

function toggleTheme() {
  const root = document.documentElement;
  const current =
    root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    // storage unavailable (private mode) — theme still applies for this visit
  }
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5c3.6 4.6 6.5 8.3 6.5 12a6.5 6.5 0 1 1-13 0c0-3.7 2.9-7.4 6.5-12Z" fill="var(--accent)" />
            <path d="M9 15.5a3 3 0 0 0 3 3" stroke="var(--surface)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">Thai Oil Pulse</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 ${
                path === item.href ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <a href={`${API_BASE}/docs`} className="rounded-full px-3 py-1.5 text-ink-2 hover:text-ink" target="_blank">
            API
          </a>
        </nav>
        <button
          type="button"
          onClick={toggleTheme}
          className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 hover:bg-surface-2"
          aria-label="สลับโหมดสว่าง/มืด"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
