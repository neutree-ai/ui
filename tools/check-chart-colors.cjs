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
 *      `#132033` in dark mode. Contrast is computed with the WCAG relative
 *      luminance formula, not by eye.
 *   3. the categorical palette may not borrow a status token. A healthy metric
 *      painted in a warning colour is the bug this rule exists to prevent, so
 *      `--nt-chart-series-*` / `--nt-chart-cat-*` must not resolve through
 *      `--nt-fill-positive|notice|serious…` (or any other state token).
 *
 * The categorical palette lives in `src/variables.css`:
 *   `--nt-chart-series-1..8` are the raw Okabe–Ito steps per theme;
 *   `--nt-chart-cat-1..8` are the semantic aliases that pages must use.
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
    "Categorical colours must clear 3:1 against the card surface (WCAG 1.4.11).",
    "Keep the hue (colour-blind identity) and darken the light-theme value until",
    "it clears the threshold, then re-run: node tools/check-chart-colors.cjs",
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

  for (const [theme, { declarations, background }] of themes) {
    for (let index = 1; index <= CATEGORIES; index += 1) {
      const seriesName = `--nt-chart-series-${index}`;
      const catName = `--nt-chart-cat-${index}`;

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

      // Rule 2: contrast against the surface for this theme.
      const { value } = resolveDeclaration(declarations, colourName);
      const hex = value ? parseHex(value) : null;
      if (!hex) {
        violations.push({
          file: VARIABLES_FILE,
          line: declarations.get(seriesName)?.line ?? 1,
          text: `${seriesName} = ${value ?? "<missing>"} is not an opaque #rrggbb colour`,
          rule: "contrast",
        });
        continue;
      }
      const contrast = contrastRatio(value, background);
      contrastRows.push({ theme, index, value, background, contrast });
      if (contrast < MIN_CONTRAST) {
        violations.push({
          file: VARIABLES_FILE,
          line: declarations.get(seriesName)?.line ?? 1,
          text:
            `${seriesName} (${value}) on ${theme} ${background} is ` +
            `${contrast.toFixed(2)}:1, need >= ${MIN_CONTRAST.toFixed(2)}:1`,
          rule: "contrast",
        });
      }
    }
  }

  return { violations, contrastRows };
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

const violations = [
  ...chartFiles.flatMap((file) => [
    ...findLiteralViolations(file),
    ...findStatusViolations(file),
  ]),
  ...checkPalette().violations,
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
  for (const rule of ["literal", "status", "alias", "contrast"]) {
    const list = grouped.get(rule);
    if (!list) continue;
    lines.push("", `  ${rule}:`);
    for (const violation of list) {
      lines.push(`    ${violation.file}:${violation.line}  ${violation.text}`);
    }
  }
  for (const rule of ["literal", "contrast", "alias", "status"]) {
    if (grouped.has(rule)) {
      lines.push("", HINTS[rule]);
    }
  }
  console.error(lines.join("\n"));
  process.exit(1);
}

/* Success: print the contrast table so a reviewer can see the actual numbers. */
const { contrastRows } = checkPalette();
const byTheme = new Map();
for (const row of contrastRows) {
  const list = byTheme.get(row.theme) ?? [];
  list.push(row);
  byTheme.set(row.theme, list);
}
const lines = [
  `✅ Chart colours pass (${chartFiles.length} chart file(s), threshold ${MIN_CONTRAST.toFixed(2)}:1):`,
];
for (const [theme, rows] of byTheme) {
  lines.push(
    `   ${theme.padEnd(5)} ${rows
      .map((row) => `${row.value} ${row.contrast.toFixed(2)}`)
      .join("  ")}`,
  );
}
console.log(lines.join("\n"));
