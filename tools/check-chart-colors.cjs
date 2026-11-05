#!/usr/bin/env node
/**
 * Chart colour governance gate.
 *
 * Chart code has to read its colours from the design tokens; a literal colour is
 * the fourth parallel palette nobody maintains. This script enforces three rules
 * from the product style guide's chart-colour rules:
 *
 *   1. chart code (any `.ts`/`.tsx` that renders recharts, or whose file name says
 *      "chart") may not contain a literal colour — `#3b82f6`, `hsl(217 91% 60%)`,
 *      `rgb(…)`. Use `var(--nt-chart-cat-*)` / `var(--nt-chart-seq-*)`, or the
 *      helpers in `src/foundation/lib/chart-palette.ts`.
 *   2. every categorical colour must clear WCAG 1.4.11 non-text contrast (>= 3:1)
 *      against the surface it is painted on: `#f2f5fa` in light mode,
 *      `#132033` in dark mode. The shape may be carried by the 1px series
 *      outline instead (fill < 3:1 but outline >= 3:1), which is how the light
 *      theme keeps the standard Okabe–Ito hues: a darkened yellow would collide
 *      with the vermillion under red-green colour blindness. Contrast is
 *      computed with the WCAG relative luminance formula, not by eye.
 *   3. the categorical palette may not borrow a status token. A healthy metric
 *      painted in a warning colour is the bug this rule exists to prevent, so
 *      `--nt-chart-series-*` / `--nt-chart-cat-*` must not resolve through
 *      `--nt-fill-positive|notice|serious…` (or any other state token).
 *   4. colour-blind separation. The chromatic series (1–7) must stay ≥ 10
 *      ΔE2000 apart under protanopia and deuteranopia, after a Viénot 1999
 *      linear-LMS projection. Series-8 is the neutral/More slot, not a category
 *      identity, so its pairs are reported but not enforced.
 *   5. no CVD regression against the baseline. Every pair is compared with the
 *      standard Okabe–Ito baseline (same projection, same ΔE formula) and may
 *      not lose more than 15%. This is what catches a "contrast passes but the
 *      pair collapsed" palette change.
 *
 * The categorical palette lives in `src/variables.css`:
 *   `--nt-chart-series-1..8` are the raw Okabe–Ito steps per theme;
 *   `--nt-chart-cat-1..8` are the semantic aliases that pages must use;
 *   `--nt-chart-series-outline` is the 1px edge that carries shape legibility.
 * The aliases are checked for existence in both themes and for pointing at the
 * matching series step, so the semantic layer cannot silently drift.
 *
 * Usage: node tools/check-chart-colors.cjs
 *        MIN_CONTRAST=3.5 node tools/check-chart-colors.cjs   # stricter locally
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = "src";
const VARIABLES_FILE = path.join(SRC_DIR, "variables.css");
const CHART_EXTENSIONS = [".ts", ".tsx"];

/** Card surfaces the chart palette is painted on: light / dark. */
const SURFACES = [
  { theme: "light", selector: ":root", background: "#f2f5fa" },
  { theme: "dark", selector: ".dark", background: "#132033" },
];

const MIN_CONTRAST = Number(process.env.MIN_CONTRAST ?? 3);
const CATEGORIES = 8;
const OUTLINE_TOKEN = "--nt-chart-series-outline";

/** Colour-blind separation: pairwise ΔE2000 floors. */
const CVD_VIEWS = ["normal", "deuteranopia", "protanopia"];
const CVD_CHROMATIC_MIN = 10;
const CVD_BASELINE_TOLERANCE = 0.15;

/** CVD model. Numbers are produced by exactly this implementation; the baseline
 * constants below carry the model version so a change cannot slip through. */
const CVD_MODEL = {
  version: "vienot1999-linear-hpe/de2000@1",
  // Viénot, Brettel & Mollon 1999: single-plane projection in linear sRGB
  // through Hunt-Pointer-Estevez LMS (the classic 2.02344 / 0.494207
  // coefficients), then CIELAB ΔE2000.
  rgbToLms: [
    [17.8824, 43.5161, 4.11935],
    [3.45565, 27.1554, 3.86714],
    [0.0299566, 0.184309, 1.46709],
  ],
  projections: {
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
  },
};

/**
 * Baseline: the standard Okabe–Ito categorical palette, measured by CVD_MODEL.
 * `pair` is 1-based (so [2, 7] is series-2 × series-7) and covers the chromatic
 * steps 1–7 only — series-8 is the neutral/More slot and is reported, never
 * enforced. Provenance: this script's Viénot projection + ΔE2000,
 * model version "vienot1999-linear-hpe/de2000@1". The self-check below aborts
 * when these numbers stop matching, which means the model changed and the
 * baseline (and the 15% tolerance check) has to be re-derived.
 */
const CVD_BASELINE = {
  palette: [
    "#0072b2",
    "#e69f00",
    "#009e73",
    "#cc79a7",
    "#56b4e9",
    "#d55e00",
    "#f0e442",
    "#8a8f98",
  ],
  worstChromatic: {
    normal: { pair: [2, 7], deltaE: 21.7 },
    deuteranopia: { pair: [2, 7], deltaE: 11.7 },
    protanopia: { pair: [1, 4], deltaE: 12.2 },
  },
};

const STATUS_TOKEN_RE =
  /var\(\s*--(?:nt-)?[a-z0-9-]*(?:positive|notice|serious|danger|error|warning|success|destructive|status)[a-z0-9-]*\s*\)/i;

const HINTS = {
  literal: [
    "Chart colours must come from a token, not from a literal value:",
    "  categorical series   var(--nt-chart-cat-1) … var(--nt-chart-cat-8)",
    "  magnitude / ramp     var(--nt-chart-seq-1) … var(--nt-chart-seq-5)",
    "  neutral “more”       chartMoreMark() from src/foundation/lib/chart-palette.ts",
    "If a token is missing for the role, add it to src/variables.css instead of",
    "pasting a hex value here.",
  ].join("\n"),
  contrast: [
    "Categorical colours must clear 3:1 against the card surface (WCAG 1.4.11),",
    "either by fill or by the 1px series outline:",
    "  --nt-chart-series-outline: <a colour that reaches 3:1 against the surface>",
    "Do NOT darken a hue to raise fill contrast — that collapses colour-blind",
    "separation (the light yellow/vermillion pair is the known failure).",
    "Then re-run: node tools/check-chart-colors.cjs",
  ].join("\n"),
  alias: [
    "Pages must read the semantic alias, not the raw series step:",
    "  --nt-chart-cat-N: var(--nt-chart-series-N);   (both :root and .dark)",
    "Add the missing alias in src/variables.css; keep the two themes in sync.",
  ].join("\n"),
  status: [
    "Categorical colours must not borrow status tokens (positive / notice /",
    "serious / danger …): state colours stay reserved for state. Use",
    "var(--nt-chart-cat-*) for data series.",
  ].join("\n"),
  cvd: [
    "Colour-blind separation: chromatic series (1–7) must stay ≥ 10 ΔE2000",
    "apart under protanopia/deuteranopia and may not fall more than 15% below",
    "the standard Okabe–Ito baseline (both are checked below). Fix the pair,",
    "never by darkening a hue — keep the Okabe–Ito steps and move legibility to",
    "the series outline.",
  ].join("\n"),
};

/* ---------- helpers ---------- */

/** Recursively collect source files */
function collectFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === "node_modules" || entry === "dist") continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (CHART_EXTENSIONS.some((ext) => full.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

/** Chart code = renders recharts, or the file name says it is a chart. */
function isChartFile(file, source) {
  if (/from\s+["']recharts["']/.test(source)) return true;
  const base = path.basename(file);
  return /chart/i.test(base);
}

/**
 * Blank out comments while keeping line numbers stable: a doc comment may quote
 * the rejected syntax (`#ccc`, `hsl(var(--primary))`) without being a violation.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`])\/\/[^\n]*/g,
      (match, lead) => lead + " ".repeat(match.length - lead.length),
    );
}

/** Remove SVG paint-server references such as `url(#trace-stats-today)`. */
function stripPaintServerRefs(source) {
  return source.replace(/url\(#[\w:.-]+\)/g, (match) =>
    " ".repeat(match.length),
  );
}

const LITERAL_PATTERNS = [
  // #rgb / #rgba / #rrggbb / #rrggbbaa, not a URL fragment or an id.
  {
    re: /(?<![\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g,
    kind: "hex",
  },
  // hsl()/hsl(a)/rgb()/rgba() with numeric channels; hsl(var(--x)) is fine.
  { re: /\b(?:hsl|hsla|rgb|rgba)\(\s*[-+]?\d/g, kind: "functional" },
];

/** Find literal-colour violations in one chart file. */
function findLiteralViolations(file) {
  const violations = [];
  const source = stripPaintServerRefs(
    stripComments(fs.readFileSync(file, "utf8")),
  );
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    for (const { re, kind } of LITERAL_PATTERNS) {
      re.lastIndex = 0;
      let match = re.exec(line);
      while (match) {
        violations.push({
          file,
          line: index + 1,
          text: `${match[0]}${kind === "functional" ? "…" : ""}`,
          rule: "literal",
        });
        match = re.exec(line);
      }
    }
  });
  return violations;
}

/** Find status-token references in a chart file (rule 3, page side). */
function findStatusViolations(file) {
  const violations = [];
  const source = stripComments(fs.readFileSync(file, "utf8"));
  source.split("\n").forEach((line, index) => {
    const match = line.match(STATUS_TOKEN_RE);
    if (match) {
      violations.push({
        file,
        line: index + 1,
        text: match[0],
        rule: "status",
      });
    }
  });
  return violations;
}

/* ---------- colour maths ---------- */

function parseHex(value) {
  const hex = value.trim();
  const match = /^#([0-9a-fA-F]{3,8})$/.exec(hex);
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3 || digits.length === 4) {
    digits = digits
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (digits.length === 6 || digits.length === 8) {
    digits = digits.slice(0, 6);
  } else {
    return null;
  }
  return [0, 2, 4].map((i) => Number.parseInt(digits.slice(i, i + 2), 16));
}

function channelToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
function luminance(rgb) {
  const [r, g, b] = rgb.map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colours. */
function contrastRatio(hexA, hexB) {
  const a = luminance(parseHex(hexA));
  const b = luminance(parseHex(hexB));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Parse `#hex`, `rgb(…)` or `rgba(…)` (the outline token needs alpha). */
function parseColor(value) {
  const hex = parseHex(value);
  if (hex) return { rgb: hex, alpha: 1 };
  const match =
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
      value.trim(),
    );
  if (!match) return null;
  const rgb = [1, 2, 3].map((i) => Number(match[i]));
  const alpha =
    match[4] == null
      ? 1
      : match[4].endsWith("%")
        ? Number(match[4]) / 100
        : Number(match[4]);
  if (
    rgb.some(
      (channel) => !Number.isFinite(channel) || channel < 0 || channel > 255,
    ) ||
    !Number.isFinite(alpha)
  ) {
    return null;
  }
  return { rgb, alpha: Math.max(0, Math.min(1, alpha)) };
}

/** Composite a (possibly translucent) colour over an opaque background. */
function compositeOver(color, backgroundRgb) {
  return color.rgb.map(
    (channel, index) =>
      color.alpha * channel + (1 - color.alpha) * backgroundRgb[index],
  );
}

/** WCAG contrast ratio between two opaque RGB triples. */
function contrastRatioRgb(rgbA, rgbB) {
  const a = luminance(rgbA);
  const b = luminance(rgbB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- colour-blind simulation (Viénot 1999 + ΔE2000) ---------- */

function invert3(matrix) {
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  const [g, h, i] = matrix[2];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

const LMS_TO_RGB = invert3(CVD_MODEL.rgbToLms);

function multiply3(matrix, vector) {
  return matrix.map(
    (row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2],
  );
}

function hexToLinearRgb(hex) {
  return parseHex(hex).map(channelToLinear);
}

/** Project a linear-sRGB colour as a protanope/deuteranope sees it. */
function projectCvdLinearRgb(linear, kind) {
  const lms = multiply3(CVD_MODEL.rgbToLms, linear);
  const projected = multiply3(CVD_MODEL.projections[kind], lms);
  return multiply3(LMS_TO_RGB, projected);
}

function linearRgbToLab(linear) {
  const [r, g, b] = linear.map((channel) => Math.max(0, Math.min(1, channel)));
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1.0);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 (Sharma's formulation), the metric the style guide compares with. */
function deltaE2000(lab1, lab2) {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * (Math.PI / 180));
  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = (h1p + h2p) / 2;
  if (c1p * c2p !== 0 && Math.abs(h1p - h2p) > 180) {
    hBarP += h1p + h2p < 360 ? 180 : -180;
  }
  const t =
    1 -
    0.17 * Math.cos(((hBarP - 30) * Math.PI) / 180) +
    0.24 * Math.cos(2 * hBarP * (Math.PI / 180)) +
    0.32 * Math.cos((3 * hBarP + 6) * (Math.PI / 180)) -
    0.2 * Math.cos((4 * hBarP - 63) * (Math.PI / 180));
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(2 * dTheta * (Math.PI / 180)) * rc;
  return Math.sqrt(
    (dLp / sl) ** 2 +
      (dCp / sc) ** 2 +
      (dHp / sh) ** 2 +
      rt * (dCp / sc) * (dHp / sh),
  );
}

/** ΔE2000 as the given vision model sees the two colours. */
function cvdDeltaE(hexA, hexB, kind) {
  const lab = (hex) => {
    const linear = hexToLinearRgb(hex);
    return linearRgbToLab(
      kind === "normal" ? linear : projectCvdLinearRgb(linear, kind),
    );
  };
  return deltaE2000(lab(hexA), lab(hexB));
}

/** Pairwise ΔE2000 matrix for a palette, one matrix per vision model. */
function cvdPairMatrix(paletteHexes) {
  const matrices = {};
  for (const view of CVD_VIEWS) {
    matrices[view] = paletteHexes.map((hexA, i) =>
      paletteHexes.map((hexB, j) =>
        i === j ? 0 : cvdDeltaE(hexA, hexB, view),
      ),
    );
  }
  return matrices;
}

/** Worst pair in a ΔE matrix; `indices` restricts the scan (0-based). */
function worstPair(matrix, indices) {
  let worst = null;
  for (const i of indices) {
    for (const j of indices) {
      if (j <= i) continue;
      const deltaE = matrix[i][j];
      if (!worst || deltaE < worst.deltaE) {
        worst = { deltaE, pair: [i + 1, j + 1] };
      }
    }
  }
  return worst;
}

const CHROMATIC_INDICES = Array.from({ length: CATEGORIES - 1 }, (_, i) => i);
const NEUTRAL_PAIRS = Array.from({ length: CATEGORIES - 1 }, (_, i) => [
  i,
  CATEGORIES - 1,
]);

/* ---------- CSS token parsing ---------- */

/** Extract the body of the first block whose selector ends with `{`, starting at `from`. */
function findBlock(source, selectorRe, from = 0) {
  const match = selectorRe.exec(source.slice(from));
  if (!match) return null;
  const open = from + match.index + match[0].length - 1; // index of "{"
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { start: open + 1, end: i, text: source.slice(open + 1, i) };
      }
    }
  }
  return null;
}

/** `--name: value;` declarations in a block, with 1-based source line numbers. */
function declarationsOf(source, block) {
  const sourceBefore = source.slice(0, block.start);
  const startLine = sourceBefore.split("\n").length;
  const declarations = new Map();
  const lineRe = /^\s*(--[\w-]+)\s*:\s*([^;]+);?/gm;
  let match = lineRe.exec(block.text);
  while (match) {
    const line =
      startLine + block.text.slice(0, match.index).split("\n").length - 1;
    if (!declarations.has(match[1])) {
      declarations.set(match[1], { value: match[2].trim(), line });
    }
    match = lineRe.exec(block.text);
  }
  return declarations;
}

/** Resolve `var(--a)` chains to a concrete value; returns `{ value, chain }`. */
function resolveDeclaration(declarations, name, depth = 0) {
  if (depth > 8) return { value: null, chain: [] };
  const found = declarations.get(name);
  if (!found) return { value: null, chain: [] };
  const varMatch = /^var\(\s*(--[\w-]+)\s*\)$/.exec(found.value);
  if (!varMatch) return { value: found.value, chain: [name] };
  const inner = resolveDeclaration(declarations, varMatch[1], depth + 1);
  return { value: inner.value, chain: [name, ...inner.chain] };
}

/** Find `var(--x)` references inside a declaration value. */
function referencedTokens(value) {
  return [...value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]);
}

/* ---------- checks ---------- */

function readThemeDeclarations() {
  const source = fs.readFileSync(VARIABLES_FILE, "utf8");
  const declarations = new Map();
  for (const { theme, selector, background } of SURFACES) {
    const selectorRe = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`,
    );
    const block =
      findBlock(source, selectorRe) ??
      (theme === "light" ? findBlock(source, /:root\s*\{/) : null);
    if (!block) {
      throw new Error(
        `cannot find the ${theme} theme block in ${VARIABLES_FILE}`,
      );
    }
    declarations.set(theme, {
      declarations: declarationsOf(source, block),
      background,
    });
  }
  return declarations;
}

function checkPalette() {
  const violations = [];
  const themes = readThemeDeclarations();
  const contrastRows = [];
  const paletteByTheme = new Map();
  const outlineByTheme = new Map();

  for (const [theme, { declarations, background }] of themes) {
    const backgroundRgb = parseHex(background);

    // The outline is what lets a sub-3:1 fill stay (B2): both themes must
    // declare it, and it must reach 3:1 against this theme's surface.
    const outlineDeclaration = declarations.get(OUTLINE_TOKEN);
    let outline = null;
    if (!outlineDeclaration) {
      violations.push({
        file: VARIABLES_FILE,
        line: 1,
        text: `${theme}: ${OUTLINE_TOKEN} is missing — the standard Okabe–Ito fills below 3:1 rely on it`,
        rule: "contrast",
      });
    } else {
      const { value } = resolveDeclaration(declarations, OUTLINE_TOKEN);
      const color = value ? parseColor(value) : null;
      if (!color) {
        violations.push({
          file: VARIABLES_FILE,
          line: outlineDeclaration.line,
          text: `${OUTLINE_TOKEN} = ${value ?? "<missing>"} is not a colour`,
          rule: "contrast",
        });
      } else {
        outline = {
          value,
          contrast: contrastRatioRgb(
            compositeOver(color, backgroundRgb),
            backgroundRgb,
          ),
        };
      }
    }
    outlineByTheme.set(theme, outline);

    const palette = [];
    for (let index = 1; index <= CATEGORIES; index += 1) {
      const seriesName = `--nt-chart-series-${index}`;
      const catName = `--nt-chart-cat-${index}`;
      const seriesLine = declarations.get(seriesName)?.line ?? 1;

      // Rule 3: the categorical palette must not borrow status tokens.
      for (const name of [seriesName, catName]) {
        const declared = declarations.get(name);
        if (!declared) continue;
        if (STATUS_TOKEN_RE.test(declared.value)) {
          violations.push({
            file: VARIABLES_FILE,
            line: declared.line,
            text: `${name}: ${declared.value}`,
            rule: "status",
          });
        }
        // A reference deeper in the chain counts as well.
        for (const ref of referencedTokens(declared.value)) {
          if (STATUS_TOKEN_RE.test(`var(${ref})`)) {
            violations.push({
              file: VARIABLES_FILE,
              line: declared.line,
              text: `${name}: ${declared.value}`,
              rule: "status",
            });
          }
        }
      }

      // Rule 2 prerequisite: the semantic alias exists and points at the right step.
      const cat = declarations.get(catName);
      let colourName = seriesName;
      if (!cat) {
        violations.push({
          file: VARIABLES_FILE,
          line: 1,
          text: `${theme}: ${catName} is missing`,
          rule: "alias",
        });
      } else if (cat.value.replace(/\s+/g, "") !== `var(${seriesName})`) {
        violations.push({
          file: VARIABLES_FILE,
          line: cat.line,
          text: `${catName}: ${cat.value} (expected var(${seriesName}))`,
          rule: "alias",
        });
      } else {
        colourName = catName;
      }

      // Rule 2: contrast against the surface, by fill or by outline.
      const { value } = resolveDeclaration(declarations, colourName);
      const hex = value ? parseHex(value) : null;
      if (!hex) {
        violations.push({
          file: VARIABLES_FILE,
          line: seriesLine,
          text: `${seriesName} = ${value ?? "<missing>"} is not an opaque #rrggbb colour`,
          rule: "contrast",
        });
        palette.push({ hex: null, line: seriesLine });
        continue;
      }
      palette.push({ hex: value, line: seriesLine });

      const fillContrast = contrastRatio(value, background);
      const viaOutline =
        fillContrast < MIN_CONTRAST &&
        outline !== null &&
        outline.contrast >= MIN_CONTRAST;
      contrastRows.push({
        theme,
        index,
        value,
        fillContrast,
        outlineContrast: outline ? outline.contrast : null,
        viaOutline,
      });
      if (fillContrast < MIN_CONTRAST && !viaOutline) {
        violations.push({
          file: VARIABLES_FILE,
          line: seriesLine,
          text:
            `${seriesName} (${value}) on ${theme} ${background} is ` +
            `${fillContrast.toFixed(2)}:1 and the outline is ` +
            `${outline ? `${outline.contrast.toFixed(2)}:1` : "missing"}` +
            `, need >= ${MIN_CONTRAST.toFixed(2)}:1 on one of them`,
          rule: "contrast",
        });
      }
    }
    paletteByTheme.set(theme, palette);
  }

  return { violations, contrastRows, paletteByTheme, outlineByTheme };
}

/**
 * Guard the CVD baseline: these numbers are measured by the model above, so a
 * mismatch means the implementation changed and the baseline must be re-derived.
 */
function assertCvdBaseline() {
  const baselineMatrix = cvdPairMatrix(CVD_BASELINE.palette);
  for (const view of CVD_VIEWS) {
    const worst = worstPair(baselineMatrix[view], CHROMATIC_INDICES);
    const expected = CVD_BASELINE.worstChromatic[view];
    const samePair =
      worst.pair[0] === expected.pair[0] && worst.pair[1] === expected.pair[1];
    if (!samePair || Math.abs(worst.deltaE - expected.deltaE) > 0.05) {
      throw new Error(
        `CVD baseline is stale (${view}): expected pair ${expected.pair.join("/")} ` +
          `ΔE ${expected.deltaE}, model ${CVD_MODEL.version} computes pair ` +
          `${worst.pair.join("/")} ΔE ${worst.deltaE.toFixed(3)}. Re-derive CVD_BASELINE.`,
      );
    }
  }
  return baselineMatrix;
}

/** Rule 4 + 5: colour-blind separation and the no-regression check. */
function checkCvd(paletteByTheme) {
  const violations = [];
  const rows = [];
  const baselineMatrix = assertCvdBaseline();

  for (const [theme, palette] of paletteByTheme) {
    if (palette.some((entry) => !entry.hex)) continue; // reported as a contrast problem
    const hexes = palette.map((entry) => entry.hex);
    const matrices = cvdPairMatrix(hexes);

    for (const view of CVD_VIEWS) {
      const matrix = matrices[view];
      const worst = worstPair(matrix, CHROMATIC_INDICES);
      let neutralWorst = null;
      for (const [i] of NEUTRAL_PAIRS) {
        const deltaE = matrix[i][CATEGORIES - 1];
        if (!neutralWorst || deltaE < neutralWorst.deltaE) {
          neutralWorst = {
            deltaE,
            pair: [i + 1, CATEGORIES],
          };
        }
      }
      rows.push({
        theme,
        view,
        worst,
        baseline: CVD_BASELINE.worstChromatic[view],
        neutralWorst,
      });

      for (const i of CHROMATIC_INDICES) {
        for (const j of CHROMATIC_INDICES) {
          if (j <= i) continue;
          const deltaE = matrix[i][j];
          const pair = `${i + 1}/${j + 1}`;
          // Rule 4: absolute floor.
          if (deltaE < CVD_CHROMATIC_MIN) {
            violations.push({
              file: VARIABLES_FILE,
              line: palette[i].line,
              text:
                `${theme} ${view}: series-${i + 1} × series-${j + 1} ` +
                `ΔE2000 ${deltaE.toFixed(1)} is below the ${CVD_CHROMATIC_MIN} floor`,
              rule: "cvd",
            });
          }
          // Rule 5: baseline regression, same pair, same model.
          const baselineDeltaE = baselineMatrix[view][i][j];
          const floor = baselineDeltaE * (1 - CVD_BASELINE_TOLERANCE);
          if (deltaE < floor) {
            violations.push({
              file: VARIABLES_FILE,
              line: palette[i].line,
              text:
                `${theme} ${view}: pair ${pair} regressed to ΔE2000 ` +
                `${deltaE.toFixed(1)} from baseline ${baselineDeltaE.toFixed(1)} ` +
                `(${(((baselineDeltaE - deltaE) / baselineDeltaE) * 100).toFixed(0)}% drop, ` +
                `limit ${CVD_BASELINE_TOLERANCE * 100}%)`,
              rule: "cvd",
            });
          }
        }
      }
    }
  }

  return { violations, rows };
}

/* ---------- run ---------- */

if (!fs.existsSync(SRC_DIR)) {
  console.error(
    `FAIL ${SRC_DIR}/ not found; run this script from the repo root`,
  );
  process.exit(1);
}

const chartFiles = collectFiles(SRC_DIR).filter((file) =>
  isChartFile(file, fs.readFileSync(file, "utf8")),
);

let paletteCheck;
let cvdCheck;
try {
  paletteCheck = checkPalette();
  cvdCheck = checkCvd(paletteCheck.paletteByTheme);
} catch (error) {
  console.error(`FAIL chart colour governance could not run: ${error.message}`);
  process.exit(2);
}

const violations = [
  ...chartFiles.flatMap((file) => [
    ...findLiteralViolations(file),
    ...findStatusViolations(file),
  ]),
  ...paletteCheck.violations,
  ...cvdCheck.violations,
];

const grouped = new Map();
for (const violation of violations) {
  const list = grouped.get(violation.rule) ?? [];
  list.push(violation);
  grouped.set(violation.rule, list);
}

if (violations.length > 0) {
  const lines = [
    `FAIL chart colour governance (${violations.length} problem(s) in ${chartFiles.length} chart file(s)):`,
  ];
  for (const rule of ["literal", "status", "alias", "contrast", "cvd"]) {
    const list = grouped.get(rule);
    if (!list) continue;
    lines.push("", `  ${rule}:`);
    for (const violation of list) {
      lines.push(`    ${violation.file}:${violation.line}  ${violation.text}`);
    }
  }
  for (const rule of ["literal", "contrast", "alias", "status", "cvd"]) {
    if (grouped.has(rule)) {
      lines.push("", HINTS[rule]);
    }
  }
  console.error(lines.join("\n"));
  process.exit(1);
}

/* Success: print the measured tables so a reviewer can check the numbers. */
const lines = [
  `✅ Chart colours pass (${chartFiles.length} chart file(s); fill ≥${MIN_CONTRAST.toFixed(2)}:1 or outline ≥${MIN_CONTRAST.toFixed(2)}:1; CVD ΔE2000 chromatic ≥${CVD_CHROMATIC_MIN} with ≤${CVD_BASELINE_TOLERANCE * 100}% baseline drop):`,
];
for (const [theme, rows] of groupBy(paletteCheck.contrastRows, "theme")) {
  const outline = paletteCheck.outlineByTheme.get(theme);
  lines.push(
    "",
    `   fill contrast ${theme} ${theme === "light" ? "#f2f5fa" : "#132033"}` +
      (outline
        ? `; outline ${outline.value} @ ${outline.contrast.toFixed(2)}:1`
        : "; outline missing"),
  );
  for (const row of rows) {
    lines.push(
      `     series-${row.index} ${row.value} ${row.fillContrast.toFixed(2)}:1` +
        (row.viaOutline
          ? `  → via outline ${row.outlineContrast.toFixed(2)}:1 *`
          : ""),
    );
  }
}
lines.push(
  "",
  `   CVD ΔE2000 (Viénot 1999, chromatic series 1–7; baseline = standard Okabe–Ito, model ${CVD_MODEL.version})`,
);
for (const row of cvdCheck.rows) {
  lines.push(
    `     ${row.theme.padEnd(5)} ${row.view.padEnd(12)} worst ${row.worst.deltaE.toFixed(1)} (${row.worst.pair.join("/")})` +
      `  baseline ${row.baseline.deltaE.toFixed(1)} (${row.baseline.pair.join("/")})` +
      (row.neutralWorst
        ? `  · neutral ${row.neutralWorst.deltaE.toFixed(1)} (${row.neutralWorst.pair.join("/")}, info only)`
        : ""),
  );
}
lines.push(
  "",
  "   * fill alone misses 3:1; the 1px series outline carries the shape.",
);
console.log(lines.join("\n"));

/** Group rows by a key, preserving first-seen order. */
function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    const list = map.get(value) ?? [];
    list.push(row);
    map.set(value, list);
  }
  return map;
}
