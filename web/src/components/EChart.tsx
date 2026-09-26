"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, MarkPointComponent, CanvasRenderer]);

export type Tokens = Record<
  "surface" | "ink" | "ink2" | "muted" | "grid" | "axis" | "line" | "up" | "down" | "ref",
  string
> & { cssVar: (name: string) => string };

function readTokens(): Tokens {
  const style = getComputedStyle(document.documentElement);
  const cssVar = (name: string) => style.getPropertyValue(name).trim();
  return {
    surface: cssVar("--surface"),
    ink: cssVar("--ink"),
    ink2: cssVar("--ink-2"),
    muted: cssVar("--muted"),
    grid: cssVar("--grid"),
    axis: cssVar("--axis"),
    line: cssVar("--line"),
    up: cssVar("--up"),
    down: cssVar("--down"),
    ref: cssVar("--ref"),
    cssVar,
  };
}

/** Re-renders whenever the page theme flips (toggle or OS setting). */
export function useTokens(): Tokens | null {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  useEffect(() => {
    const update = () => setTokens(readTokens());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);
  return tokens;
}

/** Shared axis/tooltip chrome: hairline grid, recessive axes, tabular tick labels. */
export function baseOption(t: Tokens): EChartsCoreOption {
  const font = getComputedStyle(document.body).fontFamily;
  return {
    animationDuration: 400,
    textStyle: { fontFamily: font, color: t.ink2 },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: t.surface,
      borderColor: t.line,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: t.ink, fontSize: 12, fontFamily: font },
      axisPointer: { type: "line", lineStyle: { color: t.axis, width: 1 } },
      extraCssText: "border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);",
    },
    xAxis: {
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: t.grid, width: 1 } },
    },
  };
}

interface Props {
  option: EChartsCoreOption | null;
  height?: number;
  ariaLabel: string;
  dimmed?: boolean;
}

export function EChart({ option, height = 320, ariaLabel, dimmed }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (option && chart.current) chart.current.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      style={{ height, opacity: dimmed ? 0.55 : 1, transition: "opacity 150ms" }}
      className="w-full"
    />
  );
}
