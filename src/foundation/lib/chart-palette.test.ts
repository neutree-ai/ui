import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHART_CATEGORY_COUNT,
  CHART_CATEGORY_TOKENS,
  CHART_MORE_COLOR,
  CHART_STRIPES_BACKGROUND,
  chartCategoryColor,
  chartCategoryMark,
  chartCategoryMarks,
  chartMarkStyle,
  chartMoreMark,
} from "./chart-palette";

describe("chartCategoryColor", () => {
  it("maps a category index to its semantic token in order", () => {
    expect(chartCategoryColor(0)).toBe("var(--nt-chart-cat-1)");
    expect(chartCategoryColor(3)).toBe("var(--nt-chart-cat-4)");
    expect(chartCategoryColor(7)).toBe("var(--nt-chart-cat-8)");
  });

  it("never cycles: the ninth category reuses a colour only through the ladder", () => {
    for (let index = 0; index < CHART_CATEGORY_COUNT; index += 1) {
      expect(chartCategoryColor(index)).toBe(CHART_CATEGORY_TOKENS[index]);
    }
    // Same colour as the first slot, but the mark is striped rather than a
    // silent repeat — the two categories remain distinguishable.
    expect(chartCategoryMark(CHART_CATEGORY_COUNT).color).toBe(
      chartCategoryColor(0),
    );
    expect(chartCategoryMark(CHART_CATEGORY_COUNT).pattern).toBe("stripes");
  });

  it("treats a missing or negative index as the first category", () => {
    expect(chartCategoryColor(-1)).toBe("var(--nt-chart-cat-1)");
    expect(chartCategoryColor(Number.NaN)).toBe("var(--nt-chart-cat-1)");
  });
});

describe("chartCategoryMark fallback ladder", () => {
  it("uses solid colours for the first eight categories", () => {
    for (let index = 0; index < CHART_CATEGORY_COUNT; index += 1) {
      expect(chartCategoryMark(index)).toMatchObject({
        pattern: "solid",
        segment: 1,
        paletteIndex: index,
        isMore: false,
      });
    }
  });

  it("adds stripes for categories 9–16, keeping the colour per slot", () => {
    const ninth = chartCategoryMark(8);
    const sixteenth = chartCategoryMark(15);

    expect(ninth).toMatchObject({
      color: "var(--nt-chart-cat-1)",
      pattern: "stripes",
      segment: 2,
      paletteIndex: 0,
      isMore: false,
    });
    expect(sixteenth).toMatchObject({
      color: "var(--nt-chart-cat-8)",
      pattern: "stripes",
      segment: 2,
      paletteIndex: 7,
      isMore: false,
    });
  });

  it("adds a segment number for categories 17–24", () => {
    expect(chartCategoryMark(16)).toMatchObject({
      color: "var(--nt-chart-cat-1)",
      pattern: "stripes",
      segment: 3,
      paletteIndex: 0,
      isMore: false,
    });
    expect(chartCategoryMark(23)).toMatchObject({
      color: "var(--nt-chart-cat-8)",
      segment: 3,
      isMore: false,
    });
  });

  it("collapses to the neutral 'more' mark once differences run out", () => {
    expect(chartCategoryMark(24)).toMatchObject({
      color: CHART_MORE_COLOR,
      pattern: "solid",
      isMore: true,
    });
    expect(chartCategoryMark(999)).toEqual(chartMoreMark());
    expect(chartMoreMark()).toEqual({
      color: "var(--nt-chart-cat-8)",
      pattern: "solid",
      segment: 0,
      paletteIndex: -1,
      isMore: true,
    });
  });
});

describe("chartCategoryMarks", () => {
  it("returns one mark per category in assignment order", () => {
    const marks = chartCategoryMarks(10);

    expect(marks).toHaveLength(10);
    expect(marks.map((mark) => mark.color)).toEqual(
      Array.from({ length: 10 }, (_, index) => chartCategoryColor(index)),
    );
    expect(marks.map((mark) => mark.pattern)).toEqual([
      ...Array.from({ length: 8 }, () => "solid"),
      "stripes",
      "stripes",
    ]);
  });

  it("returns nothing for zero or an invalid count", () => {
    expect(chartCategoryMarks(0)).toEqual([]);
    expect(chartCategoryMarks(Number.NaN)).toEqual([]);
  });
});

describe("chartMarkStyle", () => {
  it("paints a solid mark with just its colour", () => {
    expect(chartMarkStyle(chartCategoryMark(0))).toEqual({
      backgroundColor: "var(--nt-chart-cat-1)",
    });
  });

  it("layers the stripe pattern over the colour for a repeated colour", () => {
    expect(chartMarkStyle(chartCategoryMark(8))).toEqual({
      backgroundColor: "var(--nt-chart-cat-1)",
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

describe("categorical tokens across themes", () => {
  it("declares the same eight semantic aliases in both themes", () => {
    const light = themeTokens(":root");
    const dark = themeTokens(".dark");

    expect(CHART_CATEGORY_TOKENS).toHaveLength(CHART_CATEGORY_COUNT);
    CHART_CATEGORY_TOKENS.forEach((token, index) => {
      const name = `--nt-chart-cat-${index + 1}`;
      expect(token).toBe(`var(${name})`);
      // The module hands pages a token name; both themes must define it, or the
      // mark silently disappears when the other theme is active.
      expect(light.get(name), `${name} (light)`).toBe(
        `var(--nt-chart-series-${index + 1})`,
      );
      expect(dark.get(name), `${name} (dark)`).toBe(
        `var(--nt-chart-series-${index + 1})`,
      );
    });
  });

  it("keeps the module token list in the same order as the CSS aliases", () => {
    expect(CHART_CATEGORY_TOKENS).toEqual(
      Array.from(
        { length: CHART_CATEGORY_COUNT },
        (_, index) => `var(--nt-chart-cat-${index + 1})`,
      ),
    );
  });

  it("derives the marks from tokens, never from a status token", () => {
    const statusToken =
      /--nt-(?:fill|text|stroke)-(?:positive|notice|serious|danger)/;
    for (const token of CHART_CATEGORY_TOKENS) {
      expect(token).not.toMatch(statusToken);
    }
    expect(CHART_MORE_COLOR).not.toMatch(statusToken);
  });
});
