#!/usr/bin/env node
/**
 * Rejects the ambiguous Tailwind shadow syntax `shadow-[var(--token)]`.
 *
 * Tailwind cannot tell whether an arbitrary `var(…)` shadow value is a
 * box-shadow or a shadow colour, and resolves it as a *colour*: it emits
 * `--tw-shadow-color` plus `--tw-shadow: var(--tw-shadow-colored)` and no
 * `box-shadow` at all. The element then silently loses the shadow — and when
 * the class carries `focus-visible:`, the focus ring disappears too, which is
 * how button focus became invisible.
 *
 * Use one of the unambiguous forms instead:
 *
 *   [box-shadow:var(--token)]       flat box-shadow
 *   shadow-[shadow:var(--token)]    box-shadow that still composes with `ring-*`
 *
 * Usage: node tools/check-shadow-utilities.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = "src";
const EXTENSIONS = [".ts", ".tsx", ".css"];

const AMBIGUOUS_SHADOW_RE = /shadow-\[var\(/g;

/** Comment-only lines may quote the rejected syntax while documenting it. */
const COMMENT_LINE_RE = /^\s*(\/\/|\/\*|\*|<!--)/;

const HINT = [
  "Tailwind reads `shadow-[var(…)]` as a shadow colour, so no box-shadow is emitted:",
  "  use [box-shadow:var(--token)]              for a flat shadow",
  "  use shadow-[shadow:var(--token)]           when the shadow must compose with ring-*",
].join("\n");

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
    } else if (EXTENSIONS.some((ext) => full.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function findViolations(file) {
  const violations = [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (COMMENT_LINE_RE.test(line)) return;
    AMBIGUOUS_SHADOW_RE.lastIndex = 0;
    const match = AMBIGUOUS_SHADOW_RE.exec(line);
    if (match) {
      violations.push({ file, line: index + 1, text: match[0] });
    }
  });
  return violations;
}

/* ---------- run ---------- */

if (!fs.existsSync(SRC_DIR)) {
  console.error(
    `FAIL ${SRC_DIR}/ not found; run this script from the repo root`,
  );
  process.exit(1);
}

const violations = collectFiles(SRC_DIR).flatMap(findViolations);

if (violations.length > 0) {
  console.error(
    [
      `FAIL ambiguous Tailwind shadow syntax in ${violations.length} place(s):`,
      ...violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`),
      "",
      HINT,
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✅ No ambiguous shadow utilities.");
