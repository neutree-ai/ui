import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/foundation/lib/utils";

export type MetricBarSeries =
  | "blue"
  | "orange"
  | "cyan"
  | "red"
  | "teal"
  | "magenta"
  | "gold"
  | "violet"
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

// Adjacent segments are separated by the surface colour, not outlined: a ring
// around every block turns a meter into stacked boxes, and on a 6px bar the ring
// eats most of the fill. The inset shadow draws the gap without changing the box.
const SEGMENT_GAP =
  "[&>div+div]:[box-shadow:inset_1px_0_0_var(--nt-fill-neutral-white)]";

/** Fill for a mark that carries a series colour without being a bar — the
 * per-card segments of a discrete meter, a legend swatch. Kept beside the bar's
 * own map so a series never means two different colours across a page.
 *
 * The two maps are spelled out separately on purpose: Tailwind scans for whole
 * class names, so deriving one from the other with a `[&>div]:` prefix would
 * leave every variant unbuilt. */
export const METRIC_BAR_SERIES_FILL_CLASSES: Record<MetricBarSeries, string> = {
  blue: `bg-[var(--nt-chart-cat-1)]`,
  orange: `bg-[var(--nt-chart-cat-2)]`,
  cyan: `bg-[var(--nt-chart-cat-3)]`,
  red: `bg-[var(--nt-chart-cat-4)]`,
  teal: `bg-[var(--nt-chart-cat-5)]`,
  magenta: `bg-[var(--nt-chart-cat-6)]`,
  gold: `bg-[var(--nt-chart-cat-7)]`,
  violet: `bg-[var(--nt-chart-cat-8)]`,
  neutral: `bg-[var(--nt-chart-more)]`,
};

const seriesClasses: Record<MetricBarSeries, string> = {
  blue: `[&>div]:bg-[var(--nt-chart-cat-1)] ${SEGMENT_GAP}`,
  orange: `[&>div]:bg-[var(--nt-chart-cat-2)] ${SEGMENT_GAP}`,
  cyan: `[&>div]:bg-[var(--nt-chart-cat-3)] ${SEGMENT_GAP}`,
  red: `[&>div]:bg-[var(--nt-chart-cat-4)] ${SEGMENT_GAP}`,
  teal: `[&>div]:bg-[var(--nt-chart-cat-5)] ${SEGMENT_GAP}`,
  magenta: `[&>div]:bg-[var(--nt-chart-cat-6)] ${SEGMENT_GAP}`,
  gold: `[&>div]:bg-[var(--nt-chart-cat-7)] ${SEGMENT_GAP}`,
  violet: `[&>div]:bg-[var(--nt-chart-cat-8)] ${SEGMENT_GAP}`,
  neutral: `[&>div]:bg-[var(--nt-chart-more)] ${SEGMENT_GAP}`,
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
