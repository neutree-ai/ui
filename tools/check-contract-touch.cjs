#!/usr/bin/env node
/**
 * Warns when a resource kind's source changed but its data contract
 * (src/domains/<kind>/contract.md) did not.
 *
 * A kind's source is src/domains/<kind>/ plus its page directory
 * src/pages/<route>/. Test files, test helpers, contract.md and locale files
 * do not count. This is a reminder, not a gate: a missing contract update
 * never fails the run; only real errors (e.g. git failing) exit non-zero.
 *
 * Usage: node tools/check-contract-touch.cjs [base-ref]
 *   base-ref defaults to $CONTRACT_BASE_REF, then origin/main.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DOMAINS_DIR = "src/domains";
const PAGES_DIR = "src/pages";
const CONTRACT_FILE = "contract.md";
const IGNORED_RE = /\.test\.tsx?$|(^|\/)testing\/|(^|\/)locales\//;

const baseRef =
  process.argv[2] || process.env.CONTRACT_BASE_REF || "origin/main";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function listDirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Page directories are named after the kind or its plural. */
function routeCandidates(kind) {
  return [kind, `${kind}s`, kind.replace(/y$/, "ies")];
}

/** Maps each source directory prefix to the kind that owns a contract. */
function collectKindDirs() {
  const routes = new Set(listDirs(PAGES_DIR));
  const prefixes = new Map();
  for (const kind of listDirs(DOMAINS_DIR)) {
    const domainDir = path.posix.join(DOMAINS_DIR, kind);
    if (!fs.existsSync(path.join(domainDir, CONTRACT_FILE))) continue;
    prefixes.set(`${domainDir}/`, kind);
    const route = routeCandidates(kind).find((name) => routes.has(name));
    if (route) prefixes.set(`${path.posix.join(PAGES_DIR, route)}/`, kind);
  }
  return prefixes;
}

function changedFiles() {
  const mergeBase = git("merge-base", baseRef, "HEAD");
  const tracked = git("diff", "--name-only", mergeBase);
  const untracked = git("ls-files", "--others", "--exclude-standard");
  return [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))];
}

function escapeAnnotation(text) {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

if (!fs.existsSync(DOMAINS_DIR)) {
  console.error(
    `FAIL ${DOMAINS_DIR}/ not found; run this script from the repo root`,
  );
  process.exit(1);
}

let files;
try {
  files = changedFiles();
} catch (error) {
  console.error(`FAIL cannot diff against ${baseRef}: ${error.message}`);
  process.exit(1);
}

const prefixes = collectKindDirs();
const touchedByKind = new Map();
const updatedContracts = new Set();

for (const file of files) {
  const prefix = [...prefixes.keys()].find((p) => file.startsWith(p));
  if (!prefix) continue;
  const kind = prefixes.get(prefix);
  if (file === path.posix.join(DOMAINS_DIR, kind, CONTRACT_FILE)) {
    updatedContracts.add(kind);
  } else if (!IGNORED_RE.test(file)) {
    touchedByKind.set(kind, [...(touchedByKind.get(kind) ?? []), file]);
  }
}

const stale = [...touchedByKind].filter(
  ([kind]) => !updatedContracts.has(kind),
);

if (stale.length === 0) {
  console.log("✅ Every changed kind has its contract updated.");
  process.exit(0);
}

for (const [kind, touched] of stale) {
  const contract = path.posix.join(DOMAINS_DIR, kind, CONTRACT_FILE);
  const message = [
    `${kind}: source changed but ${contract} did not.`,
    "Update it if the change alters what the kind stores, sends, shows, validates or locks.",
    "Changed files:",
    ...touched.map((file) => `  ${file}`),
  ].join("\n");
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(
      `::warning title=Contract not updated::${escapeAnnotation(message)}`,
    );
  } else {
    console.warn(`WARN ${message}\n`);
  }
}
