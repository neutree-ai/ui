#!/usr/bin/env node
/**
 * Behavior
 * --------
 *   • Uses .i18n-tracker.lock at repo root to store { path: md5 }.
 *   • Scan mode never writes hashes.
 *   • Update mode rewrites only the given file's hash (creates file if absent).
 *   • Update-all mode rewrites all pending files' hashes.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const crypto = require("node:crypto");

const HASH_FILE = ".i18n-tracker.lock";
const FILE_REGEX = /\.(tsx?)$/; // .ts .tsx (but exclude .d.ts)
const ROOT = process.cwd();

/* ---------- helpers ---------- */
const loadHashes = () => {
  if (!fs.existsSync(HASH_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(HASH_FILE, "utf8"));
  } catch (e) {
    console.error(`Failed to parse ${HASH_FILE}: ${e}`);
    process.exit(1);
  }
};

const saveHashes = (map) =>
  fs.writeFileSync(HASH_FILE, `${JSON.stringify(map, null, 2)}\n`);

const md5Of = (filePath) =>
  crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");

/* ---------- sub-command: update ---------- */
if (
  process.argv[2] === "update" ||
  process.argv[2] === "-u" ||
  process.argv[2] === "--update"
) {
  const rel = process.argv[3];
  if (!rel) {
    console.error("Usage: node i18n-tracker.cjs update <relativePath>");
    process.exit(1);
  }
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${rel}`);
    process.exit(1);
  }

  if (rel.includes(".d.ts") || rel.includes('.test.ts')) {
    console.log(`Skipping .d.ts or test file: ${rel}`);
    process.exit(0);
  }
  // Check if file matches our regex pattern
  if (!FILE_REGEX.test(rel)) {
    console.log(`Skipping non-TypeScript file: ${rel}`);
    process.exit(0);
  }
  const hashes = loadHashes();
  hashes[rel] = md5Of(abs);
  saveHashes(hashes);
  console.log(`Hash updated for: ${rel}`);
  process.exit(0);
}

/* ---------- sub-command: update-all ---------- */
if (
  process.argv[2] === "update-all" ||
  process.argv[2] === "--update-all"
) {
  const hashes = loadHashes();
  let updated = 0;

  // Get git depth if specified
  let depth = null;
  if (process.argv[3] === "-g" || process.argv[3] === "--git") {
    depth = Number.parseInt(process.argv[4], 10);
  }

  // Collect files to update
  const targets = depth ? gitFiles(depth) : walk(ROOT);
  const pending = [];

  for (const rel of targets) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const curHash = md5Of(abs);
    if (!hashes[rel] || hashes[rel] !== curHash) {
      pending.push(rel);
    }
  }

  if (pending.length === 0) {
    console.log("All files are already up to date.");
    process.exit(0);
  }

  console.log(`Updating ${pending.length} file(s)...`);
  for (const rel of pending) {
    const abs = path.join(ROOT, rel);
    hashes[rel] = md5Of(abs);
    updated++;
    console.log(`  ✓ ${rel}`);
  }

  saveHashes(hashes);
  console.log(`\nSuccessfully updated ${updated} file(s).`);
  process.exit(0);
}

/* ---------- scan mode CLI parsing ---------- */
let gitDepth = null;
let limit = null;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "-g":
    case "--git":
      gitDepth = Number.parseInt(args[++i], 10);
      break;
    case "-l":
    case "--limit":
      limit = Number.parseInt(args[++i], 10);
      break;
    case "-h":
    case "--help":
      console.log(`Usage:
  Scan mode        : node i18n-tracker.cjs [-g <n>] [-l <n>]
  Update mode      : node i18n-tracker.cjs update <relativePath>
  Update all mode  : node i18n-tracker.cjs update-all [-g <n>]

Options (scan):
  -g, --git <n>      scan files modified in the last <n> commits
  -l, --limit <n>    show at most <n> pending files
  -h, --help         display this help

Options (update-all):
  -g, --git <n>      update only files modified in the last <n> commits
`);
      process.exit(0);
      break;
    default:
      console.error(`Unknown option: ${args[i]}`);
      process.exit(1);
  }
}

/* ---------- collect files ---------- */
function walk(dir) {
  const stack = [dir];
  const out = [];
  while (stack.length) {
    const cur = stack.pop();
    for (const item of fs.readdirSync(cur)) {
      const p = path.join(cur, item);
      if (item === "node_modules" || item.startsWith(".")) continue;
      const stat = fs.statSync(p);
      if (stat.isDirectory()) stack.push(p);
      else if (
        stat.isFile() &&
        FILE_REGEX.test(item) &&
        !item.includes(".d.ts") && !item.includes('.test.ts')
      ) {
        out.push(path.relative(ROOT, p));
      }
    }
  }
  return out;
}

function gitFiles(depth) {
  try {
    const diff = execSync(`git diff --name-only HEAD~${depth}`, {
      encoding: "utf8",
    });
    return diff
      .split("\n")
      .filter(
        (f) =>
          f.trim() && FILE_REGEX.test(f.trim()) && !f.trim().includes(".d.ts") && !f.trim().includes('.test.ts'),
      );
  } catch (e) {
    console.error(`Git command failed: ${e.message}`);
    process.exit(1);
  }
}

const targets = gitDepth ? gitFiles(gitDepth) : walk(ROOT);

/* ---------- cleanup lock file (gc) ---------- */
const oldMap = loadHashes();
let hasChanges = false;

// Remove entries for files that no longer exist
for (const rel in oldMap) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    delete oldMap[rel];
    hasChanges = true;
  }
}

// Save updated hashes if we removed any entries
if (hasChanges) {
  saveHashes(oldMap);
}

/* ---------- compare hashes ---------- */
const pending = [];

for (const rel of targets) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const curHash = md5Of(abs);
  if (!oldMap[rel] || oldMap[rel] !== curHash) pending.push(rel);
}

/* ---------- output ---------- */
if (pending.length) {
  const shown =
    limit && pending.length > limit ? pending.slice(0, limit) : pending;
  console.log("Files requiring i18n processing:");
  for (const f of shown) {
    console.log("  -", f);
  }
} else {
  console.log("All files are up to date. No i18n work needed.");
}
