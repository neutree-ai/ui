#!/usr/bin/env node
/**
 * Captures the elements a change spec names on a base revision and on the
 * working tree, both rendered from the same mock data, and writes a
 * before/after report.
 *
 * Usage:
 *   node tools/visual-report.cjs <spec.json> [--base <ref>] [--out <dir>]
 *
 * --base defaults to the merge base of origin/main and HEAD. The screens,
 * fixtures and mock backend are always the working tree's; only the app build
 * differs. Output in <dir> (default visual-out): report.html, report.md and
 * the captured images of both sides. See contributing/visual-report.md.
 */

const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { renderHtml, renderMarkdown } = require("./visual-report/report.cjs");
const { serve } = require("./visual-report/serve.cjs");

const root = path.resolve(__dirname, "..");
const bin = (name) => path.join(root, "node_modules", ".bin", name);

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function parseArgs(argv) {
  const args = { spec: "", base: "", out: "visual-out" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") args.base = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (!args.spec && !argv[i].startsWith("--")) args.spec = argv[i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!args.spec)
    throw new Error(
      "usage: visual-report <spec.json> [--base <ref>] [--out <dir>]",
    );
  return args;
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", resolve);
  }).then((code) => {
    if (code !== 0 && !options.allowFailure) {
      throw new Error(`${command} ${args.join(" ")} exited with ${code}`);
    }
    return code;
  });
}

const build = (cwd, outDir) =>
  run(
    bin("vite"),
    ["build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"],
    { cwd },
  );

async function capture(distDir, outDir, specPath) {
  const server = await serve(distDir);
  try {
    await run(
      bin("playwright"),
      ["test", "-c", "playwright.visual.config.ts", "--reporter", "dot"],
      {
        cwd: root,
        allowFailure: true,
        env: {
          ...process.env,
          VISUAL_BASE_URL: `http://127.0.0.1:${server.address().port}`,
          VISUAL_OUT_DIR: outDir,
          VISUAL_SPEC: specPath,
        },
      },
    );
  } finally {
    server.close();
  }
}

function readSide(dir, id) {
  const png = path.join(dir, `${id}.png`);
  const meta = path.join(dir, `${id}.json`);
  if (!fs.existsSync(png) || !fs.existsSync(meta))
    return { capture: null, png: null };
  return {
    capture: JSON.parse(fs.readFileSync(meta, "utf8")),
    png: fs.readFileSync(png),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const specPath = path.resolve(args.spec);
  const { changes } = JSON.parse(fs.readFileSync(specPath, "utf8"));
  if (!Array.isArray(changes) || changes.length === 0)
    throw new Error("the spec has no changes");
  const ids = changes.map((c) => c.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) throw new Error(`duplicate change id "${duplicate}"`);

  const baseSha = git(
    "rev-parse",
    args.base || git("merge-base", "origin/main", "HEAD"),
  );
  const out = path.resolve(args.out);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "visual-report-"));
  const baseTree = path.join(work, "base-tree");

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  git("worktree", "add", "--detach", baseTree, baseSha);
  try {
    fs.symlinkSync(
      path.join(root, "node_modules"),
      path.join(baseTree, "node_modules"),
    );
    const distBase = path.join(work, "dist-base");
    const distHead = path.join(work, "dist-head");
    await Promise.all([build(baseTree, distBase), build(root, distHead)]);
    await capture(distBase, path.join(out, "base"), specPath);
    await capture(distHead, path.join(out, "head"), specPath);
  } finally {
    git("worktree", "remove", "--force", baseTree);
    fs.rmSync(work, { recursive: true, force: true });
  }

  const entries = changes.map((change) => ({
    change,
    base: readSide(path.join(out, "base"), change.id),
    head: readSide(path.join(out, "head"), change.id),
  }));

  const problems = [];
  for (const { change, base, head } of entries) {
    if (!base.capture || !head.capture) {
      problems.push(
        `${change.id}: not captured on ${base.capture ? "head" : "base"}`,
      );
      continue;
    }
    change.highlight.forEach((selector, i) => {
      if (base.capture.matches[i] === 0 && head.capture.matches[i] === 0) {
        problems.push(
          `${change.id}: "${selector}" matches nothing on base or head`,
        );
      }
    });
  }

  const input = { entries, baseRef: baseSha.slice(0, 10) };
  fs.writeFileSync(path.join(out, "report.html"), renderHtml(input));
  fs.writeFileSync(path.join(out, "report.md"), renderMarkdown(input));
  console.log(`report: ${path.join(out, "report.html")}`);
  if (problems.length > 0) {
    console.error(
      `\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
