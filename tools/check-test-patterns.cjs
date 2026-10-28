#!/usr/bin/env node
/**
 * Rejects unit-test patterns that contributing/unit-test.md rules out.
 *
 * - Class-name assertions (`.className).toContain(…)`, `classList.contains`,
 *   `toHaveClass`) pin styling: they fail on a restyle and pass through real
 *   regressions. Assert what the user sees; for visibility use `isHidden()`.
 * - `expect(getBy…(…)).toBeTruthy()` asserts nothing a bare `getBy…` query
 *   does not already: the query throws when nothing matches.
 * - Re-declaring the global test environment (jsdom stubs, the Refine form
 *   bridge) that src/foundation/testing/setup.ts already provides.
 *
 * Usage: node tools/check-test-patterns.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = "src";
const TEST_FILE_RE = /\.test\.tsx?$/;
const SKIP_DIRS = [
  "node_modules",
  "dist",
  path.join("src", "components", "ui"),
];

const RULES = [
  {
    re: /\.className\)?\s*\.(?:not\.)?(?:toContain|toBe|toMatch|toEqual)\(|classList\.contains\(|\.toHaveClass\(/,
    hint: "class-name assertion: assert what the user sees; use isHidden() for visibility",
  },
  {
    re: /expect\(\s*(?:screen\.|within\([^)]*\)\.)?getBy\w+\([^;]*\)\s*,?\s*\)\s*\.(?:toBeTruthy|toBeDefined|not\.toBeNull)\(\)/,
    hint: "getBy* already throws when nothing matches: drop the expect(…).toBeTruthy() wrapper",
  },
  {
    re: /globalThis\.ResizeObserver\s*(?:\?\?)?=|prototype\.scrollIntoView\s*(?:\?\?)?=|prototype\.(?:has|set|release)PointerCapture\s*(?:\?\?)?=/,
    hint: "jsdom stub already provided by src/foundation/testing/setup.ts",
  },
  {
    re: /vi\.mock\(\s*"@\/foundation\/hooks\/use-is-truncated"/,
    hint: "useIsTruncated is mocked globally: use vi.mocked(useIsTruncated).mockReturnValue(…)",
  },
  {
    re: /vi\.mock\(\s*"@refinedev\/react-hook-form"/,
    hint: "Refine useForm is bridged globally: use refineForm from @/foundation/testing/refine-form",
  },
];

/** Comment-only lines may quote the rejected syntax while documenting it. */
const COMMENT_LINE_RE = /^\s*(\/\/|\/\*|\*)/;

/* ---------- helpers ---------- */

/** Recursively collect test files */
function collectFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (SKIP_DIRS.includes(entry) || SKIP_DIRS.includes(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (TEST_FILE_RE.test(full)) {
      files.push(full);
    }
  }
  return files;
}

function findViolations(file) {
  const violations = [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const flatten = (text) => text.replace(/\s+/g, " ").trim();
  lines.forEach((line, index) => {
    const head = flatten(line);
    if (!head || COMMENT_LINE_RE.test(line)) return;
    // Look a few lines ahead so a multi-line expect(…) still matches, but
    // report it only on the line where the match starts.
    const statement = flatten(lines.slice(index, index + 6).join(" "));
    for (const rule of RULES) {
      const match = rule.re.exec(statement);
      if (match && match.index < head.length) {
        violations.push({ file, line: index + 1, hint: rule.hint });
      }
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
      `FAIL ${violations.length} unit-test pattern violation(s):`,
      ...violations.map((v) => `  ${v.file}:${v.line}  ${v.hint}`),
      "",
      "See contributing/unit-test.md.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✅ Unit tests follow contributing/unit-test.md patterns.");
