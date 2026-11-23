#!/usr/bin/env node
/**
 * Screenshots the visual-diff screens on a base revision and on the working
 * tree, both rendered from the same mock data, and writes a before/after
 * report.
 *
 * Usage:
 *   node tools/visual-diff.cjs [--base <ref>] [--out <dir>]
 *
 * --base defaults to the merge base of origin/main and HEAD. The screen list,
 * fixtures and mock backend are always the working tree's; only the app build
 * differs. Output in <dir> (default visual-out): report.html, comment.md and
 * the screenshots of both sides. Nothing is stored in the repository.
 */

const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { compare } = require("./visual-diff/compare.cjs");
const { renderHtml, renderMarkdown } = require("./visual-diff/report.cjs");
const { serve } = require("./visual-diff/serve.cjs");

const root = path.resolve(__dirname, "..");

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function parseArgs(argv) {
  const args = { base: "", out: "visual-out" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") args.base = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return args;
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code));
  }).then((code) => {
    if (code !== 0 && !options.allowFailure) {
      throw new Error(`${command} ${args.join(" ")} exited with ${code}`);
    }
    return code;
  });
}

const bin = (name) => path.join(root, "node_modules", ".bin", name);

function build(cwd, outDir) {
  return run(bin("vite"), ["build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"], { cwd });
}

async function screenshot(distDir, outDir) {
  const server = await serve(distDir);
  try {
    await run(bin("playwright"), ["test", "-c", "playwright.visual.config.ts", "--reporter", "dot"], {
      cwd: root,
      allowFailure: true,
      env: {
        ...process.env,
        VISUAL_BASE_URL: `http://127.0.0.1:${server.address().port}`,
        VISUAL_OUT_DIR: outDir,
      },
    });
  } finally {
    server.close();
  }
}

const readPng = (dir, id) => {
  const file = path.join(dir, `${id}.png`);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
};

function screenIds(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.slice(0, -".png".length));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseRef = args.base || git("merge-base", "origin/main", "HEAD");
  const baseSha = git("rev-parse", baseRef);
  const out = path.resolve(args.out);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "visual-diff-"));
  const baseTree = path.join(work, "base-tree");
  const started = Date.now();

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  git("worktree", "add", "--detach", baseTree, baseSha);
  try {
    fs.symlinkSync(path.join(root, "node_modules"), path.join(baseTree, "node_modules"));
    const distBase = path.join(work, "dist-base");
    const distHead = path.join(work, "dist-head");
    await Promise.all([build(baseTree, distBase), build(root, distHead)]);

    const baseDir = path.join(out, "base");
    const headDir = path.join(out, "head");
    await screenshot(distBase, baseDir);
    await screenshot(distHead, headDir);

    const ids = [...new Set([...screenIds(headDir), ...screenIds(baseDir)])].sort();
    const results = ids.map((id) => {
      const basePng = readPng(baseDir, id);
      const headPng = readPng(headDir, id);
      if (!basePng || !headPng) {
        return { id, status: "failed", headPng, problem: basePng ? "missing on head" : "missing on base" };
      }
      const result = compare(basePng, headPng);
      return { id, basePng, headPng, ...result, status: result.changed > 0 ? "changed" : "same" };
    });
    const unmocked = {};
    for (const file of fs.readdirSync(headDir).filter((f) => f.endsWith(".unmocked.json"))) {
      unmocked[file.replace(".unmocked.json", "")] = JSON.parse(fs.readFileSync(path.join(headDir, file), "utf8"));
    }

    const input = { results, baseRef: baseSha.slice(0, 10), headRef: "working tree", unmocked };
    fs.writeFileSync(path.join(out, "report.html"), renderHtml(input));
    fs.writeFileSync(path.join(out, "comment.md"), renderMarkdown(input));
    const changed = results.filter((r) => r.status !== "same");
    console.log(
      `visual diff: ${changed.length} of ${results.length} screens differ in ${Math.round((Date.now() - started) / 1000)}s`,
    );
    for (const r of changed) console.log(`  ${r.status} ${r.id}`);
    console.log(`report: ${path.join(out, "report.html")}`);
  } finally {
    git("worktree", "remove", "--force", baseTree);
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
