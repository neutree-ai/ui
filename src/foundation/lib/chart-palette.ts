/**
 * Categorical chart marks and the fallback ladder that keeps them readable.
 *
 * A chart palette is an identity system, not decoration: the n-th category of a
 * chart must get the same mark in the legend, the bar and the tooltip, and two
 * categories in one chart must stay tellable apart. Eight solid hues cover the
 * normal case. Past that, the ladder adds one distinguisher at a time instead of
 * recycling the hues (a recycled colour makes two categories look like one):
 *
 *   1–8    solid categorical colour
 *   9–16   the same colours under diagonal stripes
 *   17–24  stripes plus a segment number (renderers that can draw text)
 *   25+    the neutral "more" mark — the chart has run out of differences
 *
 * The colours are semantic tokens (`--nt-chart-cat-*`), so the same mark follows
 * the light and dark theme without the caller knowing which theme is active.
 */

/** Number of solid categorical colours before the fallback ladder starts. */
export const CHART_CATEGORY_COUNT = 8;

/** Semantic categorical tokens, in assignment order; identical in both themes. */
export const CHART_CATEGORY_TOKENS = [
  "var(--nt-chart-cat-1)",
  "var(--nt-chart-cat-2)",
  "var(--nt-chart-cat-3)",
  "var(--nt-chart-cat-4)",
  "var(--nt-chart-cat-5)",
  "var(--nt-chart-cat-6)",
  "var(--nt-chart-cat-7)",
  "var(--nt-chart-cat-8)",
] as const;

/**
 * Sequential tokens for magnitude encoding (heatmaps, intensity fills), ordered
 * from the lowest to the highest magnitude. Each theme maps the ramp in the
 * direction that reads as "more ink" on its own surface, so callers only pick a
 * step; they never flip the ramp themselves.
 */
export const CHART_SEQUENTIAL_TOKENS = [
  "var(--nt-chart-seq-1)",
  "var(--nt-chart-seq-2)",
  "var(--nt-chart-seq-3)",
  "var(--nt-chart-seq-4)",
  "var(--nt-chart-seq-5)",
] as const;

/** Neutral mark for a bucket that folds several categories together.
 *
 * The eighth categorical step is the palette's neutral, and "more" must not look
 * like a competing category even when the chart also uses a coloured step 1–7.
 */
export const CHART_MORE_COLOR = "var(--nt-chart-cat-8)";

/** Diagonal stripes for the second pass over the palette, on DOM marks.
 *
 * Mixed from theme tokens (`--background` and the mark colour) so the stripes
 * follow the theme, the same idea as the GPU bar's KV_STRIPES.
 */
export const CHART_STRIPES_BACKGROUND =
  "linear-gradient(hsl(var(--background) / 0.34), hsl(var(--background) / 0.34)), " +
  "repeating-linear-gradient(135deg, hsl(var(--background) / 0.72) 0 2px, transparent 2px 4px)";

/** Edge colour for a chart fill mark (B2).
 *
 * The standard Okabe–Ito fills do not all clear 3:1 on the light card, so the
 * mark carries a 1px edge instead of a darkened fill: the edge composites to
 * 3.88:1 against the light card and every fill keeps its colour-blind-safe hue.
 * In dark mode the fills already clear 3:1 and the edge is a faint rim that only
 * helps count adjacent segments.
 */
export const CHART_SERIES_OUTLINE = "var(--nt-chart-series-outline)";

/** SVG edge for a fill mark: recharts `Bar`/`Cell`/`Pie` take stroke + width. */
type ChartOutline = { stroke: string; strokeWidth: number };

export function chartMarkOutline(): ChartOutline {
  return { stroke: CHART_SERIES_OUTLINE, strokeWidth: 1 };
}

/** DOM edge for a fill mark (segment div, legend swatch): `outline` draws over
 * the edge without changing the box size, which matters for 6px-tall bars. */
export function chartOutlineStyle(): {
  outline: string;
  outlineOffset: string;
} {
  return {
    outline: `1px solid ${CHART_SERIES_OUTLINE}`,
    outlineOffset: "0px",
  };
}

/** How a mark is painted, independent of the renderer (CSS or SVG). */
export type ChartPattern = "solid" | "stripes";

export type ChartMark = {
  /** Fill/stroke colour: a CSS token, so it follows the active theme. */
  color: string;
  /** Second distinguisher for a colour that is already in use. */
  pattern: ChartPattern;
  /** Which render pass over the palette backs this mark, 1-based. */
  segment: number;
  /** Index into CHART_CATEGORY_TOKENS; -1 for the neutral "more" mark. */
  paletteIndex: number;
  /** True when the palette was exhausted and the mark collapsed to neutral. */
  isMore: boolean;
};

/** Number of render passes over the palette before the ladder gives up. */
const MAX_PASSES = 3;

const clampIndex = (index: number) =>
  Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;

/**
 * Mark for the n-th category (0-based), in stable assignment order.
 *
 * Callers pass the category's position, never its rank or value: swapping two
 * values must not repaint the chart.
 */
export function chartCategoryMark(index: number): ChartMark {
  const slot = clampIndex(index);
  if (slot >= CHART_CATEGORY_COUNT * MAX_PASSES) return chartMoreMark();

  const segment = Math.floor(slot / CHART_CATEGORY_COUNT) + 1;
  return {
    color: CHART_CATEGORY_TOKENS[slot % CHART_CATEGORY_COUNT],
    pattern: segment === 1 ? "solid" : "stripes",
    segment,
    paletteIndex: slot % CHART_CATEGORY_COUNT,
    isMore: false,
  };
}

/** Just the solid colour for a category, for marks that cannot carry a pattern
 * (a 2px line stroke, a legend swatch, a table cell). */
export function chartCategoryColor(index: number): string {
  return chartCategoryMark(index).color;
}

/** Marks for `count` categories in one chart. */
export function chartCategoryMarks(count: number): ChartMark[] {
  const normalized = Number.isFinite(count)
    ? Math.max(0, Math.floor(count))
    : 0;
  return Array.from({ length: normalized }, (_, index) =>
    chartCategoryMark(index),
  );
}

/** Neutral mark for the folded "more" bucket — not a category colour. */
export function chartMoreMark(): ChartMark {
  return {
    color: CHART_MORE_COLOR,
    pattern: "solid",
    segment: 0,
    paletteIndex: -1,
    isMore: true,
  };
}

/** CSS background for a DOM mark (a bar segment, a legend swatch).
 *
 * SVG marks cannot use `backgroundImage`; they render the stripe pass with an
 * SVG `<pattern>` instead and keep `color` as the fill.
 */
export function chartMarkStyle(mark: ChartMark): {
  backgroundColor: string;
  backgroundImage?: string;
} {
  if (mark.pattern === "stripes" && !mark.isMore) {
    return {
      backgroundColor: mark.color,
      backgroundImage: CHART_STRIPES_BACKGROUND,
    };
  }
  return { backgroundColor: mark.isMore ? CHART_MORE_COLOR : mark.color };
}
