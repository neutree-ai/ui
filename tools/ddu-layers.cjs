#!/usr/bin/env node
/**
 * Measures which DDU layer decides each use of a resource field, and keeps
 * page-level decisions (overrides) from growing unnoticed.
 *
 * A site is a read of a resource data field (declared in a kind's types.ts or
 * the shared data types) or a form path ("spec.x") declared on a field. Its
 * layer is where the decision about that value is made:
 *   type | role | scene   a shared piece under src/foundation/<layer>/
 *   description           the kind's own lib/, or the kind configuring a scene
 *   override              decided inline in a component or page
 * Values only passed along (copied, handed to a library) are "wire" and are
 * not decisions.
 *
 * Usage:
 *   node tools/ddu-layers.cjs [--json <file>] [--sites <file>]
 *   node tools/ddu-layers.cjs check [--update-baseline]
 *
 * check fails on unmarked override sites that tools/ddu-baseline.json does not
 * list. A site is marked by a `// ddu-override: <reason>` comment on the line
 * above it; a mark without a reason, or with no override site on the next
 * line, fails too. The baseline only shrinks: --update-baseline drops entries
 * whose override is gone and moves entries with a renamed file, and check
 * fails until that is committed. --rebuild-baseline rewrites it from the
 * current sites; use it only when this tool's rules change, so the diff is
 * reviewed with the rule.
 */

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const BASELINE_FILE = "tools/ddu-baseline.json";
const LAYERS = ["type", "role", "scene", "description", "override"];
const COUNTERS = [...LAYERS, "wire", "marked"];
const SHARED_LAYER_RE = /^foundation\/(type|role|scene)\//;

// Foundation modules that run the app itself and decide nothing about a
// resource field. Any other module outside type/role/scene serves specific
// kinds and counts as Description.
const APP_SHELL = [
  "components/AppBreadcrumbs",
  "components/AppSidebar",
  "components/BaseLayout",
  "components/DefaultLayout",
  "components/Link",
  "components/Loader",
  "components/Logo",
  "components/LogoutButton",
  "components/ModeToggle",
  "components/OemFavicon",
  "components/UserDropdown",
  "hooks/use-mobile",
  "hooks/use-copy-to-clipboard",
  "hooks/use-debounced-value",
  "hooks/use-is-truncated",
  "hooks/use-stick-to-bottom",
  "hooks/use-has-permission",
  "hooks/use-system-api",
  "hooks/use-workspace",
  "lib/clipboard",
  "lib/i18n",
  "lib/utils",
  "lib/constant",
  "lib/sidebar-active",
  "lib/stick-to-bottom",
  "providers/",
  "types/",
  "testing/",
];

const PAGE_KIND = {
  "api-keys": "api-key",
  clusters: "cluster",
  endpoints: "endpoint",
  engines: "engine",
  "external-endpoints": "external-endpoint",
  "identity-sources": "identity-source",
  "image-registries": "image-registry",
  "log-sinks": "log-sink",
  "model-catalogs": "model-catalog",
  "model-registries": "model-registry",
  "role-assignments": "role-assignment",
  roles: "role",
  users: "user",
  workspaces: "workspace",
};

const FIELD_HINTS = [
  [/(^|_)(timestamp|time)$/, "render it with foundation/role/Timestamp"],
  [
    /^phase$/,
    "decide on it in the kind's status component (BaseStatus / STATUS_TONE)",
  ],
  [/^display_name$/, "use displayName() from foundation/role/display-name"],
];

const KIND_LIB_RE = /^(domains|pages)\/[^/]+\/(.+\/)?lib\//;
const FORM_PATH = /^(metadata|spec|status)\.[\w.[\]]+$/;
const FORM_PATH_CALLS = new Set([
  "register",
  "watch",
  "setValue",
  "getValues",
  "useWatch",
  "resetField",
  "trigger",
  "getFieldState",
]);
const FORM_STATE_READS = ["watch", "getValues", "useWatch", "getFieldState"];

const MARK_RE = /^\s*(?:\/\/|\{?\/\*)\s*ddu-override\b:?(.*?)(?:\*\/\}?)?\s*$/;
const COMMENT_LINE_RE = /^\s*(\/\/|\/\*|\*|\{\/\*)/;

const rel = (file) => path.relative(SRC, file).replace(/\\/g, "/");

function foundationLayer(r) {
  if (!r.startsWith("foundation/")) return null;
  const shared = r.match(SHARED_LAYER_RE);
  if (shared) return shared[1];
  const p = r.slice("foundation/".length).replace(/\.tsx?$/, "");
  const isShell = APP_SHELL.some((e) =>
    e.endsWith("/") ? p.startsWith(e) : p === e,
  );
  return isShell ? "shell" : "description";
}

function kindOf(r) {
  let m = r.match(/^domains\/([^/]+)\//);
  if (m) return m[1];
  m = r.match(/^pages\/([^/]+)\//);
  if (m) return PAGE_KIND[m[1]] ?? m[1];
  if (r.startsWith("foundation/")) return "(foundation)";
  return "(app)";
}

const isDataTypeFile = (r) =>
  /^domains\/[^/]+\/types\.ts$/.test(r) ||
  /^foundation\/types\/(basic|resource|serving|model|system)-types\.ts$/.test(
    r,
  ) ||
  r === "foundation/types/license.ts";

const isMeasured = (r) =>
  /\.tsx?$/.test(r) &&
  !/\.(test|spec)\.tsx?$/.test(r) &&
  !r.startsWith("components/ui/") &&
  !r.startsWith("foundation/testing/") &&
  !r.startsWith("foundation/types/") &&
  !/^domains\/[^/]+\/types\.ts$/.test(r) &&
  !r.startsWith("locales/") &&
  !r.endsWith(".d.ts");

function measure() {
  const cfg = ts.readConfigFile(
    path.join(ROOT, "tsconfig.json"),
    ts.sys.readFile,
  );
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT);
  const program = ts.createProgram(parsed.fileNames, {
    ...parsed.options,
    noEmit: true,
  });
  const checker = program.getTypeChecker();

  const resolveSymbol = (node) => {
    let s = checker.getSymbolAtLocation(node);
    if (s && s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    return s;
  };

  const readsDataField = (node) => {
    const d = resolveSymbol(node.name)?.declarations?.[0];
    return !!d && isDataTypeFile(rel(d.getSourceFile().fileName));
  };

  const LEAF_FLAGS =
    ts.TypeFlags.StringLike |
    ts.TypeFlags.NumberLike |
    ts.TypeFlags.BooleanLike |
    ts.TypeFlags.BigIntLike |
    ts.TypeFlags.EnumLike |
    ts.TypeFlags.Null |
    ts.TypeFlags.Undefined;
  const NULLISH = ts.TypeFlags.Null | ts.TypeFlags.Undefined;

  // A decision reads a leaf value (string, number, boolean, enum); whole
  // objects and arrays are passed along. An id identifies, it is not shown.
  const isLeafRead = (node) => {
    if (node.name.text === "id") return false;
    const t = checker.getTypeAtLocation(node);
    const parts = t.isUnion() ? t.types : [t];
    return (
      parts.every((p) => (p.flags & LEAF_FLAGS) !== 0) &&
      parts.some((p) => !(p.flags & NULLISH))
    );
  };

  // The function or component that directly consumes the expression, if any.
  const directConsumer = (node) => {
    let n = node;
    let p = n.parent;
    let fallback = false;
    while (
      p &&
      (ts.isParenthesizedExpression(p) ||
        ts.isNonNullExpression(p) ||
        ts.isAsExpression(p) ||
        (ts.isBinaryExpression(p) &&
          p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
    ) {
      if (ts.isBinaryExpression(p)) fallback = true;
      n = p;
      p = p.parent;
    }
    if (ts.isCallExpression(p) && p.arguments.includes(n))
      return { kind: "call", target: p.expression };
    if (ts.isElementAccessExpression(p) && p.argumentExpression === n)
      return { kind: "index", target: p.expression };
    if (ts.isJsxExpression(p)) {
      const a = p.parent;
      if (ts.isJsxAttribute(a))
        return {
          kind: fallback ? "jsx-fallback" : "jsx",
          target: a.parent.parent.tagName,
        };
      if (ts.isJsxElement(a))
        return { kind: "child", target: a.openingElement.tagName };
    }
    // A value copied unchanged into a variable or an object field is passed
    // along; a fallback chain on the way is a decision.
    const carried =
      (ts.isVariableDeclaration(p) && p.initializer === n) ||
      (ts.isPropertyAssignment(p) && p.initializer === n) ||
      ts.isShorthandPropertyAssignment(p);
    if (carried) return fallback ? null : { kind: "copy" };
    return null;
  };

  // A library callee (React setters, router, query helpers) only receives the
  // value. TypeScript's own lib (String, Number, JSON, Math...) and local
  // functions in src transform it.
  const receivesOnly = (target) => {
    const d = resolveSymbol(target)?.declarations?.[0];
    if (!d) return false;
    const f = d.getSourceFile().fileName;
    return (
      f.includes("/node_modules/") && !/node_modules\/typescript\/lib\//.test(f)
    );
  };

  // A callback received as a prop or parameter hands the value to the caller.
  const isReceivedCallback = (target) => {
    const d = resolveSymbol(target)?.declarations?.[0];
    return (
      !!d &&
      (ts.isParameter(d) || ts.isBindingElement(d) || ts.isPropertySignature(d))
    );
  };

  // Where a symbol is declared, as a layer for its consumers: a shared
  // foundation layer, a kind's lib (Description), or null.
  const consumerLayer = (decl) => {
    const r = rel(decl.getSourceFile().fileName);
    if (r.startsWith("..")) return null;
    const fl = foundationLayer(r);
    if (fl && fl !== "shell") return fl;
    if (KIND_LIB_RE.test(r)) return "description";
    return null;
  };

  const layerOfTarget = (target) => {
    const d = resolveSymbol(target)?.declarations?.[0];
    return d ? consumerLayer(d) : null;
  };

  // Nearest enclosing JSX element rendered by a shared foundation piece, as
  // that piece's layer. Beyond six elements up the field is no longer its own.
  const enclosingSharedLayer = (node) => {
    for (let n = node.parent, depth = 0; n && depth < 6; n = n.parent) {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = ts.isJsxElement(n) ? n.openingElement.tagName : n.tagName;
        const l = layerOfTarget(tag);
        if (l) return l;
        depth++;
      }
    }
    return null;
  };

  const sites = [];
  const markErrors = [];
  const kindSpecific = new Map();

  for (const sf of program.getSourceFiles()) {
    const r = rel(sf.fileName);
    if (r.startsWith("..") || !isMeasured(r)) continue;
    const fileLayer = foundationLayer(r);
    if (fileLayer === "shell") continue;
    const kind = kindOf(r);
    const file = `src/${r}`;
    const inLib = KIND_LIB_RE.test(r);
    const firstSite = sites.length;
    if (fileLayer === "description") kindSpecific.set(file, 0);

    const push = (node, layer, how, text, field, why) => {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      const site = { kind, layer, file, line: line + 1, how, text, field };
      if (layer === "override") site.why = why;
      sites.push(site);
    };

    const record = (node, how) => {
      let layer;
      let why = "computed inline (a comparison, fallback, format or branch)";
      const c = directConsumer(node);
      if (c?.kind === "copy") layer = "wire";
      else if (fileLayer) layer = fileLayer;
      else if (inLib) layer = "description";
      else {
        // A field handed to a shared type/role piece is decided there; handed
        // to a shared scene block, it is the kind's configuration of that
        // block (Description). Rendered as a child of a scene block, or with
        // a fallback, the raw value has no type/role deciding its display.
        const l = c?.target ? layerOfTarget(c.target) : null;
        if (l === "scene") {
          layer =
            c.kind === "child" || c.kind === "jsx-fallback"
              ? "override"
              : "description";
          why =
            c.kind === "child"
              ? `rendered raw as a child of <${c.target.getText()}>, so no type/role piece decides how it shows`
              : `handed to <${c.target.getText()}> with an inline fallback`;
        } else if (l) layer = l;
        else if (c?.kind === "jsx") layer = "wire";
        else if (
          c?.kind === "call" &&
          (receivesOnly(c.target) || isReceivedCallback(c.target))
        )
          layer = "wire";
        else layer = "override";
      }
      push(node, layer, how, node.getText(), node.name.text, why);
    };

    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) && readsDataField(node)) {
        const p = node.parent;
        // Only the full chain is a site: `a.spec.x` is one read, not two.
        const extended =
          ts.isPropertyAccessExpression(p) &&
          p.expression === node &&
          readsDataField(p);
        if (!extended) {
          if (isLeafRead(node)) record(node, "read");
          else if (!fileLayer && !inLib && node.name.text !== "id") {
            // A whole object counts only when a shared piece receives it.
            const c = directConsumer(node);
            if (c?.target && layerOfTarget(c.target)) record(node, "object");
          }
        }
      } else if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        FORM_PATH.test(node.text)
      ) {
        const p = node.parent;
        const isNameAttr = ts.isJsxAttribute(p) && p.name.getText() === "name";
        const method = ts.isCallExpression(p)
          ? p.expression.getText().split(".").pop()
          : null;
        if (isNameAttr || FORM_PATH_CALLS.has(method)) {
          // Reading form state (watch/getValues) decides nothing yet;
          // declaring a field does.
          let layer;
          const readIntoVariable =
            ts.isVariableDeclaration(p.parent) && p.parent.initializer === p;
          if (FORM_STATE_READS.includes(method) && readIntoVariable)
            layer = "wire";
          else if (fileLayer) layer = fileLayer;
          else if (inLib) layer = "description";
          else {
            const l = isNameAttr
              ? (layerOfTarget(p.parent.parent.tagName) ??
                enclosingSharedLayer(p))
              : enclosingSharedLayer(p);
            layer = l === "scene" ? "description" : (l ?? "override");
          }
          const field = node.text
            .replace(/\[[^\]]*\]/g, "")
            .split(".")
            .pop();
          push(
            node,
            layer,
            "path",
            node.text,
            field,
            "a form field declared in a component, outside a shared form piece",
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    const fileSites = sites.slice(firstSite);
    if (kindSpecific.has(file)) kindSpecific.set(file, fileSites.length);
    applyMarks(file, sf.getFullText(), fileSites, markErrors);
  }

  return { sites, markErrors, kindSpecific };
}

function applyMarks(file, text, fileSites, markErrors) {
  if (!text.includes("ddu-override")) return;
  const lines = text.split("\n");
  lines.forEach((content, i) => {
    const mark = content.match(MARK_RE);
    if (!mark) return;
    const line = i + 1;
    if (!mark[1].trim()) {
      markErrors.push({
        file,
        line,
        message:
          'ddu-override mark has no reason: write why the rule cannot live lower after the colon, as in "// ddu-override: <reason>"',
      });
      return;
    }
    let next = i + 1;
    while (
      next < lines.length &&
      (!lines[next].trim() || COMMENT_LINE_RE.test(lines[next]))
    )
      next++;
    const marked = fileSites.filter(
      (s) => s.layer === "override" && s.line === next + 1,
    );
    if (marked.length === 0) {
      markErrors.push({
        file,
        line,
        message: `unused ddu-override mark: line ${next + 1}, the next code line, has no override; move the mark directly above the override it excuses, or delete it`,
      });
      return;
    }
    for (const s of marked) s.marked = true;
  });
}

const collapse = (text) => text.replace(/\s+/g, " ");
const display = (site) =>
  site.how === "path" ? site.text : collapse(site.text.slice(0, 80));

function summarize(sites) {
  const empty = () => Object.fromEntries(COUNTERS.map((c) => [c, 0]));
  const perKind = {};
  const total = empty();
  for (const s of sites) {
    perKind[s.kind] ??= empty();
    for (const row of [perKind[s.kind], total]) {
      row[s.layer]++;
      if (s.marked) row.marked++;
    }
  }
  return { perKind, total };
}

function report(result, options) {
  const { sites, kindSpecific } = result;
  const { perKind, total } = summarize(sites);
  const decided = LAYERS.reduce((sum, l) => sum + total[l], 0);
  const overrideFiles = new Set(
    sites.filter((s) => s.layer === "override").map((s) => s.file),
  ).size;
  const foundationKindSpecific = [...kindSpecific.keys()].sort();

  if (options.json) {
    const out = {
      total,
      perKind,
      decisions: decided,
      sites: sites.length,
      overrideFiles,
      foundationKindSpecific,
    };
    fs.writeFileSync(options.json, `${JSON.stringify(out, null, 2)}\n`);
  }
  if (options.sites) {
    const rows = sites.map((s) =>
      [s.kind, s.layer, `${s.file}:${s.line}`, s.how, display(s)].join("\t"),
    );
    fs.writeFileSync(options.sites, `${rows.join("\n")}\n`);
  }

  const columns = [...LAYERS, "marked"];
  const kinds = Object.keys(perKind).sort();
  const width = Math.max(...kinds.map((k) => k.length), 5);
  const line = (name, cells) =>
    `${name.padEnd(width)}  ${cells.map((c) => String(c).padStart(13)).join("")}`;
  const pct = (n) => (decided ? `${((100 * n) / decided).toFixed(1)}%` : "-");

  console.log(line("kind", columns));
  for (const k of kinds)
    console.log(
      line(
        k,
        columns.map((c) => perKind[k][c]),
      ),
    );
  console.log(
    line(
      "total",
      columns.map((c) => total[c]),
    ),
  );
  console.log(
    line(
      "",
      LAYERS.map((l) => pct(total[l])),
    ),
  );
  console.log(
    `\n${decided} decisions in ${sites.length} sites (${total.wire} only pass the value along); overrides sit in ${overrideFiles} files, ${total.marked} marked.`,
  );
  console.log(
    `\nKind-specific code in foundation (${foundationKindSpecific.length} modules counted as description; candidates to move into their domain), with sites:`,
  );
  for (const file of foundationKindSpecific)
    console.log(`  ${file}  ${kindSpecific.get(file)}`);
}

function unmarkedOverrides(sites) {
  const byFile = new Map();
  for (const s of sites) {
    if (s.layer !== "override" || s.marked) continue;
    const key = collapse(s.text);
    if (!byFile.has(s.file)) byFile.set(s.file, new Map());
    const keys = byFile.get(s.file);
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push(s);
  }
  return byFile;
}

// Baseline entries kept for the current code: never more than were recorded,
// so a new override cannot enter the baseline. Entries of a file that no
// longer exists follow their expression into the file it moved to.
function compareBaseline(byFile, baseline) {
  const pool = new Map();
  for (const [file, keys] of Object.entries(baseline)) {
    if (fs.existsSync(path.join(ROOT, file))) continue;
    for (const [key, n] of Object.entries(keys))
      pool.set(key, (pool.get(key) ?? 0) + n);
  }
  const kept = {};
  const added = [];
  let moved = 0;
  for (const [file, keys] of byFile) {
    for (const [key, found] of keys) {
      const allowed = Math.min(found.length, baseline[file]?.[key] ?? 0);
      const extra = found.slice(allowed);
      const carried = Math.min(extra.length, pool.get(key) ?? 0);
      pool.set(key, (pool.get(key) ?? 0) - carried);
      moved += carried;
      added.push(...extra.slice(carried));
      if (allowed + carried) {
        kept[file] ??= {};
        kept[file][key] = allowed + carried;
      }
    }
  }
  const sorted = sortBaseline(kept);
  return {
    kept: sorted,
    added,
    moved,
    gone: countEntries(baseline) - countEntries(sorted),
    stale: JSON.stringify(sorted) !== JSON.stringify(sortBaseline(baseline)),
  };
}

function sortBaseline(baseline) {
  const out = {};
  for (const file of Object.keys(baseline).sort()) {
    out[file] = {};
    for (const key of Object.keys(baseline[file]).sort())
      out[file][key] = baseline[file][key];
  }
  return out;
}

function fromSites(byFile) {
  const out = {};
  for (const [file, keys] of byFile) {
    out[file] = {};
    for (const [key, found] of keys) out[file][key] = found.length;
  }
  return sortBaseline(out);
}

function writeBaseline(baseline) {
  fs.writeFileSync(
    path.join(ROOT, BASELINE_FILE),
    `${JSON.stringify(baseline, null, "\t")}\n`,
  );
}

function readBaseline() {
  const file = path.join(ROOT, BASELINE_FILE);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

const countEntries = (baseline) =>
  Object.values(baseline).reduce(
    (sum, keys) => sum + Object.values(keys).reduce((a, b) => a + b, 0),
    0,
  );

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fixesFor(site) {
  const lib =
    site.kind.startsWith("(") ||
    !fs.existsSync(path.join(SRC, "domains", site.kind))
      ? "the kind's lib/"
      : `src/domains/${site.kind}/lib/`;
  const field = FIELD_HINTS.find(([re]) => re.test(site.field ?? ""));
  return [
    ...(field ? [field[1]] : []),
    site.how === "path"
      ? `declare the field through the kind's form hook or a shared form piece in ${lib}`
      : `move the rule into ${lib} (or a foundation/type|role piece several kinds can use) and call it here`,
    `if it must stay here, add on the line above line ${site.line}: \`// ddu-override: <why it cannot live lower>\` (between JSX children: \`{/* ddu-override: <why> */}\`)`,
  ];
}

const FOOTER = {
  override: [
    "New override (a component or page decides on a resource field inline, so the next page has to repeat it): apply one of the fixes listed under it; prefer moving the rule over marking it.",
  ],
  mark: [
    "Mark error: give the mark its reason after the colon, move it directly above the override it excuses, or delete it once the override is gone.",
  ],
  stale: [
    `Baseline out of date: run \`yarn ddu:check --update-baseline\` and commit ${BASELINE_FILE}.`,
    "It only shrinks or follows moved files; it never accepts a new override.",
  ],
};

function check(result, options) {
  const { sites, markErrors } = result;
  const github = process.env.GITHUB_ACTIONS === "true";
  const problem = (title, { file, line }, body = []) => {
    if (github) {
      const text = [title, ...body].join("\n").replace(/%/g, "%25");
      console.log(
        `::error file=${file},line=${line}::${text.replace(/\r/g, "%0D").replace(/\n/g, "%0A")}`,
      );
    } else {
      console.log(`${file}:${line}  ${title}`);
      for (const b of body) console.log(`    ${b}`);
    }
  };
  const byFile = unmarkedOverrides(sites);
  const marked = sites.filter((s) => s.marked).length;
  const baseline = readBaseline();
  const compared = options.rebuildBaseline
    ? {
        kept: fromSites(byFile),
        added: [],
        moved: 0,
        gone: 0,
        stale: false,
      }
    : compareBaseline(byFile, baseline);
  const { added } = compared;

  for (const error of markErrors) problem(error.message, error);
  added.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  for (const site of added) {
    const [fix, ...rest] = fixesFor(site);
    problem(`new override \`${display(site)}\``, site, [
      `why: ${site.why}`,
      `fix: ${fix}`,
      ...rest.map((r) => ` or: ${r}`),
    ]);
  }

  let stale = compared.stale;
  if (options.updateBaseline || options.rebuildBaseline) {
    if (stale || options.rebuildBaseline) writeBaseline(compared.kept);
    console.log(
      `ddu:check: ${BASELINE_FILE} records ${plural(countEntries(compared.kept), "override")} (${compared.gone} gone, ${compared.moved} moved with their file).`,
    );
    stale = false;
  }

  const counts = [
    plural(added.length, "new override"),
    plural(markErrors.length, "mark error"),
  ];
  const failed = added.length || markErrors.length || stale;
  if (!failed) {
    console.log(
      `✅ ddu:check: ${counts.join(", ")} (baseline ${countEntries(compared.kept)}, marked ${marked}).`,
    );
    return 0;
  }
  if (stale)
    counts.push(
      `baseline out of date (${compared.gone} gone, ${compared.moved} moved with their file)`,
    );
  const steps = [
    ...(added.length ? FOOTER.override : []),
    ...(markErrors.length ? FOOTER.mark : []),
    ...(stale ? FOOTER.stale : []),
  ];
  console.log(`
❌ ddu:check: ${counts.join(", ")}.

How to fix:
${steps.map((s) => `  - ${s}`).join("\n")}
  Then rerun \`yarn ddu:check\` until it passes.

See: contributing/architecture.md, "Layer check"`);
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  const optionValue = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };
  const result = measure();
  if (args[0] === "check") {
    process.exit(
      check(result, {
        updateBaseline: args.includes("--update-baseline"),
        rebuildBaseline: args.includes("--rebuild-baseline"),
      }),
    );
  }
  report(result, {
    json: optionValue("--json"),
    sites: optionValue("--sites"),
  });
}

main();
