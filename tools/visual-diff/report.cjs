/** Renders the comparison as one self-contained HTML page and a short markdown summary. */

const MARKER = "<!-- visual-diff -->";
// Kept in sync with visual-diff-comment.yml, which posts no new comment for it.
const NO_CHANGE = "No visual change.";

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const dataUri = (png) => `data:image/png;base64,${png.toString("base64")}`;
const percent = (r) => ((100 * r.changed) / (r.width * r.height)).toFixed(2);

const STYLE = `
  :root { color-scheme: light dark; --bg: #fff; --fg: #1a1a1a; --muted: #6b7280; --line: #d8dce2; --accent: #c2185b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #15171a; --fg: #e8e8e8; --muted: #9aa1ab; --line: #343a42; --accent: #ff6b9a; } }
  body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
  main { max-width: 1600px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 8px; }
  .meta, .muted { color: var(--muted); }
  section.screen { border: 1px solid var(--line); border-radius: 8px; margin: 16px 0; padding: 12px; }
  section.screen h3 { margin: 0 0 8px; font-size: 15px; }
  .badge { color: var(--accent); font-weight: 600; margin-left: 8px; }
  .panes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  figure { margin: 0; min-width: 0; }
  figcaption { font-weight: 600; margin-bottom: 4px; }
  figure img { width: 100%; height: auto; border: 1px solid var(--line); display: block; }
  details summary { cursor: pointer; }
  ul.plain { padding-left: 18px; }
  pre { white-space: pre-wrap; word-break: break-all; }
  @media (max-width: 900px) { .panes { grid-template-columns: 1fr; } }
`;

function screenSection(r) {
  if (r.status === "changed") {
    return `<section class="screen" id="${escapeHtml(r.id)}">
  <h3>${escapeHtml(r.id)}<span class="badge">${percent(r)}% of pixels differ</span></h3>
  <div class="panes">
    <figure><figcaption>Base</figcaption><img loading="lazy" alt="${escapeHtml(r.id)} on base" src="${dataUri(r.basePng)}"></figure>
    <figure><figcaption>Head</figcaption><img loading="lazy" alt="${escapeHtml(r.id)} on head" src="${dataUri(r.headPng)}"></figure>
    <figure><figcaption>Difference</figcaption><img loading="lazy" alt="${escapeHtml(r.id)} difference" src="${dataUri(r.diff)}"></figure>
  </div>
</section>`;
  }
  const only = r.status === "failed" ? r.problem : "";
  return `<section class="screen" id="${escapeHtml(r.id)}">
  <h3>${escapeHtml(r.id)}<span class="badge">${escapeHtml(only)}</span></h3>
  ${r.headPng ? `<figure><img loading="lazy" alt="${escapeHtml(r.id)}" src="${dataUri(r.headPng)}"></figure>` : ""}
</section>`;
}

/**
 * @param {{ results: object[], baseRef: string, headRef: string, unmocked: Record<string,string[]> }} input
 */
function renderHtml({ results, baseRef, headRef, unmocked }) {
  const changed = results.filter((r) => r.status === "changed");
  const failed = results.filter((r) => r.status === "failed");
  const same = results.filter((r) => r.status === "same");
  const unmockedIds = Object.keys(unmocked).filter((id) => unmocked[id].length);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual diff</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Visual diff</h1>
  <p class="meta">Base <code>${escapeHtml(baseRef)}</code> against head <code>${escapeHtml(headRef)}</code>.
  Both builds are rendered from the same mock data. ${changed.length} changed, ${failed.length} failed, ${same.length} unchanged.</p>
  ${changed.length ? `<h2>Changed (${changed.length})</h2>${changed.map(screenSection).join("\n")}` : "<h2>No screen changed</h2>"}
  ${failed.length ? `<h2>Failed to render (${failed.length})</h2>${failed.map(screenSection).join("\n")}` : ""}
  <h2>Unchanged (${same.length})</h2>
  <details><summary>List unchanged screens</summary><ul class="plain">${same.map((r) => `<li>${escapeHtml(r.id)}</li>`).join("")}</ul></details>
  ${
    unmockedIds.length
      ? `<h2>Requests without a mock</h2><p class="muted">Answered with an empty response; add a mock when a screen needs them.</p>
  <details><summary>${unmockedIds.length} screens</summary><pre>${escapeHtml(
    unmockedIds.map((id) => `${id}\n  ${unmocked[id].join("\n  ")}`).join("\n"),
  )}</pre></details>`
      : ""
  }
</main>
</body>
</html>
`;
}

/** The pull-request comment body, without the link to the HTML (the poster appends it). */
function renderMarkdown({ results }) {
  const changed = results.filter((r) => r.status === "changed");
  const failed = results.filter((r) => r.status === "failed");
  const same = results.length - changed.length - failed.length;
  if (changed.length === 0 && failed.length === 0) {
    return `${MARKER}\n${NO_CHANGE} ${same} screens render the same on the base.\n`;
  }
  const lines = [MARKER, "### Visual diff", ""];
  lines.push(
    `${changed.length} of ${results.length} screens changed against the base, ${same} are unchanged.`,
    "",
  );
  if (changed.length) {
    lines.push("| Screen | Pixels changed |", "|---|---|");
    for (const r of changed) lines.push(`| \`${r.id}\` | ${percent(r)}% |`);
    lines.push("");
  }
  if (failed.length) {
    lines.push(
      `Failed to render: ${failed.map((r) => `\`${r.id}\` (${r.problem})`).join(", ")}.`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

module.exports = { MARKER, NO_CHANGE, renderHtml, renderMarkdown };
