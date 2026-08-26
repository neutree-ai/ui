import type { ComponentPropsWithoutRef } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/foundation/lib/utils";

export type MetricBarSeries =
  | "blue"
  | "cyan"
  | "purple"
  | "green"
  | "amber"
  | "neutral";

type MetricBarProps = Omit<
  ComponentPropsWithoutRef<typeof Progress>,
  "value"
> & {
  value?: number | null;
  size?: "sm" | "md";
  shape?: "flat-end" | "rounded" | "square";
  series?: MetricBarSeries;
  track?: "subtle" | "outlined" | "unavailable";
};

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
} as const;

const shapeClasses = {
  "flat-end": "rounded-full [&>div]:rounded-none",
  rounded: "rounded-full [&>div]:rounded-full",
  square: "rounded-none [&>div]:rounded-none",
} as const;

/** Fill for a mark that carries a series colour without being a bar — the
 * per-card segments of a discrete meter, a legend swatch. Kept beside the bar's
 * own map so a series never means two different colours across a page.
 *
 * The two maps are spelled out separately on purpose: Tailwind scans for whole
 * class names, so deriving one from the other with a `[&>div]:` prefix would
 * leave every variant unbuilt. */
export const METRIC_BAR_SERIES_FILL_CLASSES: Record<MetricBarSeries, string> = {
  blue: "bg-[var(--nt-chart-series-1)]",
  cyan: "bg-[var(--nt-chart-series-2)]",
  purple: "bg-[var(--nt-chart-series-3)]",
  green: "bg-[var(--nt-chart-series-4)]",
  amber: "bg-[var(--nt-chart-series-5)]",
  neutral:
    "bg-[var(--nt-fill-neutral-trans-7)] dark:bg-[var(--nt-fill-neutral-trans-5)]",
};

const seriesClasses: Record<MetricBarSeries, string> = {
  blue: "[&>div]:bg-[var(--nt-chart-series-1)]",
  cyan: "[&>div]:bg-[var(--nt-chart-series-2)]",
  purple: "[&>div]:bg-[var(--nt-chart-series-3)]",
  green: "[&>div]:bg-[var(--nt-chart-series-4)]",
  amber: "[&>div]:bg-[var(--nt-chart-series-5)]",
  neutral:
    "[&>div]:bg-[var(--nt-fill-neutral-trans-7)] dark:[&>div]:bg-[var(--nt-fill-neutral-trans-5)]",
};

const trackClasses = {
  subtle: "border-0 bg-muted",
  outlined:
    "border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]",
  unavailable:
    "border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent [&>div]:bg-transparent",
} as const;

export function MetricBar({
  value,
  size = "md",
  shape = "flat-end",
  series = "blue",
  track = "subtle",
  className,
  ...props
}: MetricBarProps) {
  const normalizedValue =
    track === "unavailable"
      ? 0
      : Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : 0));

  return (
    <Progress
      value={normalizedValue}
      className={cn(
        sizeClasses[size],
        shapeClasses[shape],
        seriesClasses[series],
        trackClasses[track],
        className,
      )}
      {...props}
    />
  );
}
