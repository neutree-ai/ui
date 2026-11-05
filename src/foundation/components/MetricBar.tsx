import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
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

// Every fill mark carries the series outline: the standard Okabe–Ito fills do
// not all clear 3:1 on the light card, so the 1px edge is what makes the shape
// readable. `outline` is used over `border` because it never changes the box
// size, which matters for the 6px-tall bar.
const FILL_OUTLINE =
  "[outline:1px_solid_var(--nt-chart-series-outline)] [outline-offset:0px]";
const BAR_FILL_OUTLINE =
  "[&>div]:[outline:1px_solid_var(--nt-chart-series-outline)] [&>div]:[outline-offset:0px]";

export const METRIC_BAR_SERIES_FILL_CLASSES: Record<MetricBarSeries, string> = {
  blue: `bg-[var(--nt-chart-series-1)] ${FILL_OUTLINE}`,
  cyan: `bg-[var(--nt-chart-series-2)] ${FILL_OUTLINE}`,
  purple: `bg-[var(--nt-chart-series-3)] ${FILL_OUTLINE}`,
  green: `bg-[var(--nt-chart-series-4)] ${FILL_OUTLINE}`,
  amber: `bg-[var(--nt-chart-series-5)] ${FILL_OUTLINE}`,
  neutral: `bg-[var(--nt-fill-neutral-trans-7)] dark:bg-[var(--nt-fill-neutral-trans-5)] ${FILL_OUTLINE}`,
};

const seriesClasses: Record<MetricBarSeries, string> = {
  blue: `[&>div]:bg-[var(--nt-chart-series-1)] ${BAR_FILL_OUTLINE}`,
  cyan: `[&>div]:bg-[var(--nt-chart-series-2)] ${BAR_FILL_OUTLINE}`,
  purple: `[&>div]:bg-[var(--nt-chart-series-3)] ${BAR_FILL_OUTLINE}`,
  green: `[&>div]:bg-[var(--nt-chart-series-4)] ${BAR_FILL_OUTLINE}`,
  amber: `[&>div]:bg-[var(--nt-chart-series-5)] ${BAR_FILL_OUTLINE}`,
  neutral: `[&>div]:bg-[var(--nt-fill-neutral-trans-7)] dark:[&>div]:bg-[var(--nt-fill-neutral-trans-5)] ${BAR_FILL_OUTLINE}`,
};

const trackClasses = {
  subtle: "border-0 bg-muted",
  outlined:
    "border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]",
  unavailable:
    "border border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent [&>div]:bg-transparent",
} as const;

export const MetricBar = forwardRef<
  ElementRef<typeof Progress>,
  MetricBarProps
>(function MetricBar(
  {
    value,
    size = "md",
    shape = "flat-end",
    series = "blue",
    track = "subtle",
    className,
    ...props
  },
  ref,
) {
  const normalizedValue =
    track === "unavailable"
      ? 0
      : Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : 0));

  return (
    <Progress
      ref={ref}
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
});

MetricBar.displayName = "MetricBar";
