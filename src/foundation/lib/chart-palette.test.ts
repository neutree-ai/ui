import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHART_CATEGORY_COUNT,
  CHART_MORE_COLOR,
  CHART_STRIPES_BACKGROUND,
  chartCategoryColor,
  chartCategoryMark,
  chartMarkStyle,
  chartMoreMark,
} from "./chart-palette";

describe("chartCategoryMark", () => {
  it.each([
    [0, "var(--nt-chart-cat-1)", "solid"],
    [5, "var(--nt-chart-cat-6)", "solid"],
    [6, "var(--nt-chart-cat-7)", "stripes"],
    [7, "var(--nt-chart-cat-8)", "stripes"],
  ])("category %i uses %s with a %s fill", (index, color, pattern) => {
    expect(chartCategoryMark(index)).toMatchObject({
      color,
      pattern,
      paletteIndex: index,
      isMore: false,
    });
    expect(chartCategoryColor(index)).toBe(color);
  });

  it("never cycles: past the palette every category collapses to More", () => {
    expect(chartCategoryMark(CHART_CATEGORY_COUNT)).toEqual(chartMoreMark());
    expect(chartCategoryMark(999)).toEqual(chartMoreMark());
    expect(chartCategoryColor(CHART_CATEGORY_COUNT)).toBe(CHART_MORE_COLOR);
  });

  it("treats a missing or negative index as the first category", () => {
    expect(chartCategoryColor(-1)).toBe("var(--nt-chart-cat-1)");
    expect(chartCategoryColor(Number.NaN)).toBe("var(--nt-chart-cat-1)");
  });
});

describe("chartMarkStyle", () => {
  it("paints a solid mark with just its colour", () => {
    expect(chartMarkStyle(chartCategoryMark(0))).toEqual({
      backgroundColor: "var(--nt-chart-cat-1)",
    });
  });

  it("layers the stripe pattern over the Gold and Violet extension colours", () => {
    expect(chartMarkStyle(chartCategoryMark(6))).toEqual({
      backgroundColor: "var(--nt-chart-cat-7)",
      backgroundImage: CHART_STRIPES_BACKGROUND,
    });
  });

  it("keeps the neutral 'more' mark flat", () => {
    expect(chartMarkStyle(chartMoreMark())).toEqual({
      backgroundColor: CHART_MORE_COLOR,
    });
  });
});

/* ---------- token contract with variables.css ---------- */

const VARIABLES_CSS = readFileSync(
  resolve(process.cwd(), "src/variables.css"),
  "utf8",
);

/** Decorations of one theme block, keyed by custom-property name. */
function themeTokens(selector: string): Map<string, string> {
  const start = VARIABLES_CSS.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThan(-1);
  let depth = 0;
  let end = start;
  for (let i = start; i < VARIABLES_CSS.length; i += 1) {
    if (VARIABLES_CSS[i] === "{") depth += 1;
    else if (VARIABLES_CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = VARIABLES_CSS.slice(start, end);
  const tokens = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

describe("chart tokens in variables.css", () => {
  // The module hands pages token names; both themes must define them, or the
  // mark silently disappears when the other theme is active.
  it.each([":root", ".dark"])(
    "%s defines every token the marks use",
    (theme) => {
      const tokens = themeTokens(theme);
      for (let index = 1; index <= CHART_CATEGORY_COUNT; index += 1) {
        expect(tokens.get(`--nt-chart-cat-${index}`)).toBe(
          `var(--nt-chart-series-${index})`,
        );
      }
      expect(tokens.get("--nt-chart-more")).toBeDefined();
      expect(tokens.get("--nt-fill-neutral-white")).toBeDefined();
    },
  );
});
