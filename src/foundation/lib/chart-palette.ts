/**
 * Categorical chart marks and the fallback ladder that keeps them readable.
 *
 * A chart palette is an identity system, not decoration: the n-th category of a
 * chart must get the same mark in the legend, the bar and the tooltip, and two
 * categories in one chart must stay tellable apart. Six coordinated hues cover
 * the normal case. Gold and Violet extend the palette to eight categories, but
 * they always carry a texture as a second cue because their full-palette CVD
 * separation is lower. Past that, the chart collapses instead of recycling
 * colours (a recycled colour makes two categories look like one):
 *
 *   1–6    solid main categorical colour
 *   7–8    Gold / Violet extension colour plus diagonal stripes
 *   9+     the solid neutral "more" bucket
 *
 * The colours are semantic tokens (`--nt-chart-cat-*`), so the same mark follows
 * the light and dark theme without the caller knowing which theme is active.
 */

/** Number of categorical colours before the neutral "more" bucket starts. */
export const CHART_CATEGORY_COUNT = 8;

/** First six categories are the colour-only-safe main sequence. */
const CHART_MAIN_CATEGORY_COUNT = 6;

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
 * Single-series brand colour. A lone series has no neighbouring hue to collide
 * with, so it may carry the product's own primary instead of a category slot.
 * The moment a second series appears, switch to the categorical tokens.
 */
export const CHART_BRAND = "var(--nt-chart-brand)";

/** Dedicated neutral mark for a bucket that folds several categories together.
 * It is intentionally outside the eight categorical slots and never striped.
 */
export const CHART_MORE_COLOR = "var(--nt-chart-more)";

/** Diagonal stripes for the Gold / Violet extension slots, on DOM marks.
 *
 * Mixed from theme tokens (`--background` and the mark colour) so the stripes
 * follow the theme.
 */
export const CHART_STRIPES_BACKGROUND =
  "linear-gradient(hsl(var(--background) / 0.34), hsl(var(--background) / 0.34)), " +
  "repeating-linear-gradient(135deg, hsl(var(--background) / 0.72) 0 2px, transparent 2px 4px)";

/** The gap between two adjacent marks: the surface colour, so segments read as
 * separate blocks rather than as one bar with dark rings. It flips with the
 * theme because it is the card fill, not a fixed white. */
export const CHART_SERIES_SEPARATOR = "var(--nt-fill-neutral-white)";

/** DOM edge for a fill mark (segment div, legend swatch): an inset shadow draws over
 * the edge without changing the box size, which matters for 6px-tall bars. */
export function chartOutlineStyle(): {
  boxShadow: string;
} {
  return {
    boxShadow: `inset 1px 0 0 ${CHART_SERIES_SEPARATOR}`,
  };
}

/** How a mark is painted, independent of the renderer (CSS or SVG). */
export type ChartPattern = "solid" | "stripes";

export type ChartMark = {
  /** Fill/stroke colour: a CSS token, so it follows the active theme. */
  color: string;
  /** Second distinguisher for a colour that is already in use. */
  pattern: ChartPattern;
  /** Index into CHART_CATEGORY_TOKENS; -1 for the neutral "more" mark. */
  paletteIndex: number;
  /** True when the palette was exhausted and the mark collapsed to neutral. */
  isMore: boolean;
};

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
  if (slot >= CHART_CATEGORY_COUNT) return chartMoreMark();

  return {
    color: CHART_CATEGORY_TOKENS[slot],
    pattern: slot < CHART_MAIN_CATEGORY_COUNT ? "solid" : "stripes",
    paletteIndex: slot,
    isMore: false,
  };
}

/** Just the solid colour for a category, for marks that cannot carry a pattern
 * (a 2px line stroke, a legend swatch, a table cell). */
export function chartCategoryColor(index: number): string {
  return chartCategoryMark(index).color;
}

/** Neutral mark for the folded "more" bucket — not a category colour. */
export function chartMoreMark(): ChartMark {
  return {
    color: CHART_MORE_COLOR,
    pattern: "solid",
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
