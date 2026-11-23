#!/usr/bin/env node
/**
 * Renders the DDU layer change between two `ddu-layers.cjs --json` outputs as
 * the markdown body of the pull-request comment.
 *
 * Usage:
 *   node tools/ddu-metrics-diff.cjs <base.json> <head.json> [--rules-changed] [--out <file>]
 *
 * The output starts with MARKER, which the comment workflow uses to find and
 * update its own comment. Output is deterministic: same input, same bytes.
 */

const fs = require("node:fs");

const MARKER = "<!-- ddu-metrics -->";
// Kept in sync with ddu-metrics-comment.yml, which posts no new comment for it.
const NO_CHANGE = "No DDU layer change.";
const LAYERS = ["type", "role", "scene", "description", "override"];
const FILE_ROWS = 30;

const signed = (n) => (n > 0 ? `+${n}` : String(n));
const cell = (head, base) =>
  head === base ? `${head}` : `${head} (${signed(head - base)})`;
const share = (m) => {
  const decided = LAYERS.reduce((sum, l) => sum + m.total[l], 0);
  return decided ? (100 * m.total.override) / decided : 0;
};
const pctDelta = (n) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(1)}`;
const code = (text) =>
  `\`${String(text).replace(/`/g, "'").replace(/\|/g, "\\|")}\``;

function deltas(base, head) {
  const keys = [
    ...new Set([...Object.keys(base), ...Object.keys(head)]),
  ].sort();
  return keys
    .map((key) => ({ key, base: base[key] ?? 0, head: head[key] ?? 0 }))
    .filter((r) => r.base !== r.head);
}

function markKey(m) {
  return JSON.stringify([m.file, m.text, m.reason]);
}

function markDiff(base, head) {
  const count = (marks) => {
    const out = new Map();
    for (const m of marks) out.set(markKey(m), (out.get(markKey(m)) ?? 0) + 1);
    return out;
  };
  const b = count(base);
  const h = count(head);
  const pick = (from, other) =>
    [...from].flatMap(([key, n]) => {
      const extra = n - (other.get(key) ?? 0);
      return extra > 0
        ? Array.from({ length: extra }, () => JSON.parse(key))
        : [];
    });
  const rows = (list) =>
    list
      .map(([file, text, reason]) => ({ file, text, reason }))
      .sort(
        (x, y) =>
          x.file.localeCompare(y.file) ||
          x.text.localeCompare(y.text) ||
          x.reason.localeCompare(y.reason),
      );
  return { added: rows(pick(h, b)), removed: rows(pick(b, h)) };
}

function render(base, head, options = {}) {
  const out = [MARKER, "### DDU layer metrics", ""];
  if (options.rulesChanged)
    out.push(
      "> `tools/ddu-layers.cjs` changes in this PR. Both sides are measured with the PR's rules, but new rules can move counts without any code change.",
      "",
    );

  const kinds = deltas(
    Object.fromEntries(
      Object.entries(base.perKind).map(([k, v]) => [k, v.override]),
    ),
    Object.fromEntries(
      Object.entries(head.perKind).map(([k, v]) => [k, v.override]),
    ),
  );
  const files = deltas(base.overrideByFile, head.overrideByFile).sort(
    (a, b) =>
      Math.abs(b.head - b.base) - Math.abs(a.head - a.base) ||
      a.key.localeCompare(b.key),
  );
  const marks = markDiff(base.marks, head.marks);
  const concepts = deltas(
    Object.fromEntries(
      Object.entries(base.foundationConcepts).map(([k, v]) => [k, v.modules]),
    ),
    Object.fromEntries(
      Object.entries(head.foundationConcepts).map(([k, v]) => [k, v.modules]),
    ),
  );
  const singleKey = (e) => `${e.file}  ${e.kind}`;
  const baseSingle = new Set(base.singleKind.map(singleKey));
  const headSingle = new Set(head.singleKind.map(singleKey));
  const newSingle = [...headSingle].filter((e) => !baseSingle.has(e)).sort();
  const goneSingle = [...baseSingle].filter((e) => !headSingle.has(e)).sort();
  const addedConcepts = Object.keys(head.foundationConcepts)
    .filter((c) => !(c in base.foundationConcepts))
    .sort();
  const removedConcepts = Object.keys(base.foundationConcepts)
    .filter((c) => !(c in head.foundationConcepts))
    .sort();

  const totalsChanged =
    LAYERS.some((l) => base.total[l] !== head.total[l]) ||
    base.total.marked !== head.total.marked;
  const changed =
    totalsChanged ||
    kinds.length ||
    files.length ||
    marks.added.length ||
    marks.removed.length ||
    addedConcepts.length ||
    removedConcepts.length ||
    newSingle.length ||
    goneSingle.length;

  if (!changed) {
    out.push(NO_CHANGE);
    return `${out.join("\n")}\n`;
  }

  out.push(
    `| ${[...LAYERS, "override share"].join(" | ")} |`,
    `| ${[...LAYERS, "override share"].map(() => "---:").join(" | ")} |`,
    `| ${[
      ...LAYERS.map((l) => cell(head.total[l], base.total[l])),
      `${share(head).toFixed(1)}% (${pctDelta(share(head) - share(base))} pp)`,
    ].join(" | ")} |`,
    "",
  );

  if (kinds.length) {
    out.push("**Overrides by kind**", "");
    out.push("| kind | base | head | change |", "| --- | ---: | ---: | ---: |");
    for (const k of kinds)
      out.push(
        `| ${k.key} | ${k.base} | ${k.head} | ${signed(k.head - k.base)} |`,
      );
    out.push("");
  }

  if (files.length) {
    out.push(
      `<details><summary>Override changes by file (${files.length})</summary>`,
      "",
      "| file | base | head | change |",
      "| --- | ---: | ---: | ---: |",
    );
    for (const f of files.slice(0, FILE_ROWS))
      out.push(
        `| ${code(f.key)} | ${f.base} | ${f.head} | ${signed(f.head - f.base)} |`,
      );
    if (files.length > FILE_ROWS)
      out.push("", `and ${files.length - FILE_ROWS} more`);
    out.push("", "</details>", "");
  }

  const markList = (title, list) => {
    if (!list.length) return;
    out.push(`<details><summary>${title} (${list.length})</summary>`, "");
    for (const m of list)
      out.push(
        `- ${code(m.file)} ${code(m.text)}: ${m.reason.replace(/\s+/g, " ").replace(/@/g, "&#64;")}`,
      );
    out.push("", "</details>", "");
  };
  markList("ddu-override marks added", marks.added);
  markList("ddu-override marks removed", marks.removed);

  const foundation = [];
  if (addedConcepts.length)
    foundation.push(
      `- concept dirs added: ${addedConcepts.map(code).join(", ")}`,
    );
  if (removedConcepts.length)
    foundation.push(
      `- concept dirs removed: ${removedConcepts.map(code).join(", ")}`,
    );
  if (newSingle.length)
    foundation.push(
      `- single-kind modules newly reported: ${newSingle.map(code).join(", ")}`,
    );
  if (goneSingle.length)
    foundation.push(
      `- single-kind modules no longer reported: ${goneSingle.map(code).join(", ")}`,
    );
  const moduleShifts = concepts.filter(
    (c) => c.key in base.foundationConcepts && c.key in head.foundationConcepts,
  );
  if (moduleShifts.length)
    foundation.push(
      `- concept modules: ${moduleShifts.map((c) => `${code(c.key)} ${c.base} -> ${c.head}`).join(", ")}`,
    );
  if (foundation.length) out.push("**Foundation**", "", ...foundation, "");

  return `${out.join("\n").trimEnd()}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const flagValue = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const outFile = flagValue("--out");
  const positional = args.filter(
    (a, i) => !a.startsWith("--") && args[i - 1] !== "--out",
  );
  if (positional.length !== 2) {
    console.error(
      "usage: ddu-metrics-diff.cjs <base.json> <head.json> [--rules-changed] [--out <file>]",
    );
    process.exit(2);
  }
  const [base, head] = positional.map((f) =>
    JSON.parse(fs.readFileSync(f, "utf8")),
  );
  const markdown = render(base, head, {
    rulesChanged: args.includes("--rules-changed"),
  });
  if (outFile) fs.writeFileSync(outFile, markdown);
  else process.stdout.write(markdown);
}

main();
