#!/usr/bin/env node
/**
 * Checks that all t("key") calls, detail-field labels (field("key", …)) and
 * status phase labels (phases("prefix", { Phase: tone })) in source code
 * reference keys that actually exist in the locale file.
 *
 * Usage: node tools/check-i18n-keys.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const LOCALE_FILE = "src/locales/en-US.json";
const SRC_DIR = "src";
const EXTENSIONS = [".ts", ".tsx"];

/* ---------- helpers ---------- */

/** Flatten nested JSON into a Set of dot-separated key paths */
function flattenKeys(obj, prefix) {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const k of flattenKeys(value, fullKey)) {
        keys.add(k);
      }
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

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

/** Extract t("...") keys from source, skipping dynamic expressions */
const T_CALL_RE = /\bt\(\s*["'`]([^"'`]+)["'`]/g;

// A detail-field descriptor names its label key as the first argument of
// field("…") from foundation/scene/detail-field.
const FIELD_CALL_RE = /\bfield\(\s*["'`]([^"'`]+)["'`]/g;
const FIELD_MODULE_RE = /scene\/detail-field["']/;

// A phase table from foundation/role/phases names its label prefix, then one
// key per phase; `lowercase: true` in its options lowercases the phase.
const PHASES_CALL_RE =
  /\bphases\(\s*["'`]([^"'`]+)["'`],\s*\{([^}]*)\}(?:,\s*\{([^}]*)\})?/g;
const PHASES_MODULE_RE = /role\/phases["']/;

function phaseKeys(content) {
  if (!PHASES_MODULE_RE.test(content)) return [];
  return [...content.matchAll(PHASES_CALL_RE)].flatMap(
    ([, prefix, tones, options]) => {
      const lowercase = /\blowercase:\s*true\b/.test(options ?? "");
      const listed = tones.replace(/\/\/.*$/gm, "");
      return [...listed.matchAll(/(\w+)\s*:/g)].map(
        ([, phase]) => `${prefix}.${lowercase ? phase.toLowerCase() : phase}`,
      );
    },
  );
}

function extractKeys(content) {
  const patterns = FIELD_MODULE_RE.test(content)
    ? [T_CALL_RE, FIELD_CALL_RE]
    : [T_CALL_RE];
  return [
    ...patterns.flatMap((re) =>
      [...content.matchAll(re)].map((match) => match[1]),
    ),
    ...phaseKeys(content),
  ];
}

/* ---------- main ---------- */

const locale = JSON.parse(fs.readFileSync(LOCALE_FILE, "utf8"));
const validKeys = flattenKeys(locale);
const sourceFiles = collectFiles(SRC_DIR);

const missing = [];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const key of extractKeys(content)) {
    // Skip dynamic keys (template literals with interpolation)
    if (key.includes("${") || key.includes("{{")) continue;
    if (!validKeys.has(key)) {
      missing.push({ file: path.relative(".", file), key });
    }
  }
}

if (missing.length === 0) {
  console.log("✅ All t() keys exist in the locale file.");
} else {
  console.error(`\n❌ ${missing.length} missing i18n key(s):\n`);
  for (const { file, key } of missing) {
    console.error(`  ${file}: "${key}"`);
  }
  console.error(`
How to fix:
  Add the missing key(s) to ${LOCALE_FILE}
`);
  process.exit(1);
}
