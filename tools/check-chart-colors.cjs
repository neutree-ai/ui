#!/usr/bin/env node
/**
 * Rejects literal colours in chart code.
 *
 * Chart code (any `.ts`/`.tsx` that renders recharts, or whose file name says
 * "chart") reads its colours from the design tokens; a literal colour —
 * `#3b82f6`, `hsl(217 91% 60%)`, `rgb(…)` — is a parallel palette nobody
 * maintains, and it ignores the theme. Comments and SVG paint-server references
 * (`url(#id)`) are not colours.
 *
 * The palette itself (contrast against the card surface, colour-blind
 * separation, no borrowed status tokens, both themes declared) is checked by
 * src/foundation/lib/chart-palette.test.ts.
 *
 * Usage: node tools/check-chart-colors.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = "src";
const SOURCE_FILE_RE = /\.tsx?$/;
// Tests measure the palette's hex values; they do not paint with them.
const TEST_FILE_RE = /\.test\.tsx?$/;
const SKIP_DIRS = [
  "node_modules",
  "dist",
  path.join("src", "components", "ui"),
];

const LITERAL_PATTERNS = [
  // #rgb / #rgba / #rrggbb / #rrggbbaa, not a URL fragment or an id.
  /(?<![\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g,
  // hsl()/hsla()/rgb()/rgba() with numeric channels; hsl(var(--x)) is fine.
  /\b(?:hsl|hsla|rgb|rgba)\(\s*[-+]?\d/g,
];

const HINT = [
  "Chart colours must come from a token, not from a literal value:",
  "  categorical series   chartCategoryMark(i) / var(--nt-chart-cat-1…8)",
  "  neutral “more”       chartMoreMark() / CHART_MORE_COLOR",
  "  single-series brand  CHART_BRAND (a lone series may wear --primary)",
  "  mark separator       CHART_SERIES_SEPARATOR",
  "Helpers live in src/foundation/lib/chart-palette.ts. If a token is missing",
  "for the role, add it to src/variables.css instead of pasting a value here.",
].join("\n");

function collectFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (SKIP_DIRS.includes(entry) || SKIP_DIRS.includes(full)) continue;
    if (fs.statSync(full).isDirectory()) {
      files.push(...collectFiles(full));
    } else if (SOURCE_FILE_RE.test(full) && !TEST_FILE_RE.test(full)) {
      files.push(full);
    }
  }
  return files;
}

const isChartFile = (file, source) =>
  /from\s+["']recharts["']/.test(source) || /chart/i.test(path.basename(file));

/** Blank out comments and `url(#id)` references, keeping line numbers. */
function stripNonColours(source) {
  const blank = (match) => match.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(
      /(^|[^:"'`])\/\/[^\n]*/g,
      (match, lead) => lead + " ".repeat(match.length - lead.length),
    )
    .replace(/url\(#[\w:.-]+\)/g, blank);
}

function findViolations(file, source) {
  const violations = [];
  stripNonColours(source)
    .split("\n")
    .forEach((line, index) => {
      for (const re of LITERAL_PATTERNS) {
        for (const match of line.matchAll(re)) {
          violations.push(`${file}:${index + 1}  ${match[0]}`);
        }
      }
    });
  return violations;
}

const chartFiles = collectFiles(SRC_DIR)
  .map((file) => [file, fs.readFileSync(file, "utf8")])
  .filter(([file, source]) => isChartFile(file, source));
const violations = chartFiles.flatMap(([file, source]) =>
  findViolations(file, source),
);

if (violations.length > 0) {
  console.error(
    [
      `FAIL ${violations.length} literal colour(s) in chart code:`,
      ...violations.map((v) => `  ${v}`),
      "",
      HINT,
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `✅ Chart code reads colours from tokens (${chartFiles.length} chart file(s)).`,
);
