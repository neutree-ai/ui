import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHART_CATEGORY_COUNT,
  CHART_MAIN_CATEGORY_COUNT,
  CHART_MORE_COLOR,
  CHART_STRIPES_BACKGROUND,
  chartCategoryMark,
  chartMarkStyle,
  chartMoreMark,
} from "./chart-palette";

describe("chartCategoryMark fallback ladder", () => {
  it.each([
    { index: 0, color: "var(--nt-chart-cat-1)", pattern: "solid" },
    { index: 5, color: "var(--nt-chart-cat-6)", pattern: "solid" },
    { index: 6, color: "var(--nt-chart-cat-7)", pattern: "stripes" },
    { index: 7, color: "var(--nt-chart-cat-8)", pattern: "stripes" },
    { index: 8, color: CHART_MORE_COLOR, pattern: "solid" },
    { index: -1, color: "var(--nt-chart-cat-1)", pattern: "solid" },
    { index: Number.NaN, color: "var(--nt-chart-cat-1)", pattern: "solid" },
  ])("category $index -> $color, $pattern", ({ index, color, pattern }) => {
    expect(chartCategoryMark(index)).toMatchObject({ color, pattern });
  });

  it("never cycles: every category past the palette is the More mark", () => {
    expect(chartCategoryMark(999)).toEqual(chartMoreMark());
    expect(chartMoreMark().isMore).toBe(true);
  });
});

describe("chartMarkStyle", () => {
  it.each([
    {
      mark: chartCategoryMark(0),
      style: { backgroundColor: "var(--nt-chart-cat-1)" },
    },
    {
      mark: chartCategoryMark(6),
      style: {
        backgroundColor: "var(--nt-chart-cat-7)",
        backgroundImage: CHART_STRIPES_BACKGROUND,
      },
    },
    { mark: chartMoreMark(), style: { backgroundColor: CHART_MORE_COLOR } },
  ])("paints $mark.color as $style", ({ mark, style }) => {
    expect(chartMarkStyle(mark)).toEqual(style);
  });
});

/* ---------- the palette in src/variables.css ---------- */

const VARIABLES_CSS = readFileSync(
  resolve(process.cwd(), "src/variables.css"),
  "utf8",
);

/** Custom-property declarations of one theme block. */
function themeTokens(selector: string): Map<string, string> {
  const start = VARIABLES_CSS.indexOf(`${selector} {`);
  let depth = 0;
  let end = start;
  for (let i = start; i < VARIABLES_CSS.length; i += 1) {
    if (VARIABLES_CSS[i] === "{") depth += 1;
    else if (VARIABLES_CSS[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const tokens = new Map<string, string>();
  const body = VARIABLES_CSS.slice(start, end);
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

/** The approved palette: a fill below 3:1 is accepted only for these hues,
 * whose marks carry a separator and a non-colour identifier. Darkening a hue to
 * pass contrast would collapse its colour-blind separation instead. */
const CANONICAL = [
  "#0077bb",
  "#ee7733",
  "#33bbee",
  "#cc3311",
  "#009988",
  "#ee3377",
  "#e3bf48",
  "#8e5aa9",
];

const THEMES = [
  { theme: "light", tokens: themeTokens(":root"), surface: "#f2f5fa" },
  { theme: "dark", tokens: themeTokens(".dark"), surface: "#132033" },
];

const categories = (tokens: Map<string, string>) =>
  Array.from({ length: CHART_CATEGORY_COUNT }, (_, index) =>
    tokens.get(`--nt-chart-cat-${index + 1}`),
  );

/* Colour maths: WCAG contrast, Viénot 1999 dichromat projection, CIEDE2000. */

type Vec3 = [number, number, number];

const toLinear = (hex: string): Vec3 =>
  [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Vec3;

const luminance = ([r, g, b]: Vec3) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function contrast(hexA: string, hexB: string) {
  const [hi, lo] = [luminance(toLinear(hexA)), luminance(toLinear(hexB))].sort(
    (a, b) => b - a,
  );
  return (hi + 0.05) / (lo + 0.05);
}

const multiply = (m: number[][], v: Vec3) =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3;

function invert([[a, b, c], [d, e, f], [g, h, i]]: number[][]) {
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

// Hunt-Pointer-Estevez LMS in linear sRGB with the classic projections.
const RGB_TO_LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
];
const LMS_TO_RGB = invert(RGB_TO_LMS);
const PROJECTIONS = {
  protanopia: [
    [0, 2.02344, -2.52581],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deuteranopia: [
    [1, 0, 0],
    [0.494207, 0, 1.24827],
    [0, 0, 1],
  ],
};
type View = "normal" | keyof typeof PROJECTIONS;
const VIEWS: View[] = ["normal", "deuteranopia", "protanopia"];

function toLab(hex: string, view: View): Vec3 {
  let linear = toLinear(hex);
  if (view !== "normal") {
    linear = multiply(
      LMS_TO_RGB,
      multiply(PROJECTIONS[view], multiply(RGB_TO_LMS, linear)),
    );
  }
  const [r, g, b] = linear.map((c) => Math.max(0, Math.min(1, c)));
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const fx = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const fy = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const fz = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** CIEDE2000, Sharma's formulation. */
function deltaE2000([l1, a1, b1]: Vec3, [l2, a2, b2]: Vec3) {
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp / 2));
  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = (h1p + h2p) / 2;
  if (c1p * c2p !== 0 && Math.abs(h1p - h2p) > 180) {
    hBarP += h1p + h2p < 360 ? 180 : -180;
  }
  const t =
    1 -
    0.17 * Math.cos(rad(hBarP - 30)) +
    0.24 * Math.cos(rad(2 * hBarP)) +
    0.32 * Math.cos(rad(3 * hBarP + 6)) -
    0.2 * Math.cos(rad(4 * hBarP - 63));
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;
  const dL = (l2 - l1) / sl;
  const dC = (c2p - c1p) / sc;
  const dH = dHp / sh;
  return Math.sqrt(dL ** 2 + dC ** 2 + dH ** 2 + rt * dC * dH);
}

const pairs = Array.from({ length: CHART_CATEGORY_COUNT }, (_, i) =>
  Array.from({ length: CHART_CATEGORY_COUNT - i - 1 }, (_, k) => [
    i,
    i + k + 1,
  ]),
).flat();

const separation = (palette: string[], view: View, [i, j]: number[]) =>
  deltaE2000(toLab(palette[i], view), toLab(palette[j], view));

const isMainPair = ([i, j]: number[]) =>
  i < CHART_MAIN_CATEGORY_COUNT && j < CHART_MAIN_CATEGORY_COUNT;

describe.each(THEMES)("$theme chart palette", ({ tokens, surface }) => {
  const palette = categories(tokens) as string[];

  it("declares every chart token and the mark separator", () => {
    for (const name of [
      ...palette.map((_, i) => `--nt-chart-cat-${i + 1}`),
      "--nt-chart-more",
      "--nt-chart-more-foreground",
      "--nt-chart-brand",
      "--nt-fill-neutral-white",
    ]) {
      expect(tokens.get(name), name).toBeDefined();
    }
    for (const hex of palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("never paints a chart token with a status colour", () => {
    for (const [name, value] of tokens) {
      if (!name.startsWith("--nt-chart-")) continue;
      expect(value, name).not.toMatch(
        /positive|notice|serious|danger|error|warning|success|destructive|status/,
      );
    }
  });

  it("clears 3:1 against the card surface or keeps the canonical hue", () => {
    palette.forEach((hex, index) => {
      if (contrast(hex, surface) >= 3) return;
      expect(hex.toLowerCase(), `cat-${index + 1}`).toBe(CANONICAL[index]);
    });
  });

  it.each(VIEWS)("keeps categories apart under %s vision", (view) => {
    for (const pair of pairs) {
      const deltaE = separation(palette, view, pair);
      const label = `cat-${pair[0] + 1} × cat-${pair[1] + 1}`;
      // Main colours stand on colour alone; extension pairs add a texture.
      expect(deltaE, label).toBeGreaterThanOrEqual(isMainPair(pair) ? 10 : 5);
      // No pair may lose more than 15% of the approved palette's separation.
      expect(deltaE, label).toBeGreaterThanOrEqual(
        0.85 * separation(CANONICAL, view, pair),
      );
    }
  });
});

it.each([
  { view: "normal", main: 18.3, all: 18.3 },
  { view: "deuteranopia", main: 14.5, all: 5.2 },
  { view: "protanopia", main: 15.2, all: 5.9 },
] as const)(
  "measures the approved palette's worst $view pair as published",
  ({ view, main, all }) => {
    // Guards the colour maths: the published numbers come from the same model.
    const worst = (scope: number[][]) =>
      Math.min(...scope.map((pair) => separation(CANONICAL, view, pair)));
    expect(worst(pairs.filter(isMainPair))).toBeCloseTo(main, 1);
    expect(worst(pairs)).toBeCloseTo(all, 1);
  },
);
