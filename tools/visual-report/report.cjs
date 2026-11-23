/** Renders the captures as one self-contained HTML page and a markdown summary. */

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const dataUri = (png) => `data:image/png;base64,${png.toString("base64")}`;

/** What the highlights found on one side, as a short sentence. */
function presence(change, capture) {
  if (!capture) return "not captured";
  const missing = change.highlight.filter((_, i) => capture.matches[i] === 0);
  if (missing.length === 0) return "all highlights found";
  if (missing.length === change.highlight.length) return "not present";
  return `not present: ${missing.join(", ")}`;
}

const STYLE = `
  body { margin: 0; padding: 24px 16px; background: #fff; color: #1a1a1a; font: 14px/1.5 system-ui, sans-serif; }
  main { max-width: 1500px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta, .muted { color: #6b7280; }
  section { border-top: 1px solid #d8dce2; margin-top: 28px; padding-top: 12px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  code { background: #f1f3f5; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  .panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
  figure { margin: 0; min-width: 0; }
  figcaption { font-weight: 600; margin-bottom: 4px; }
  figure img { max-width: 100%; height: auto; border: 1px solid #d8dce2; display: block; }
  .absent { color: #b42318; font-weight: 600; }
  details { margin-top: 6px; }
  @media (max-width: 900px) { .panes { grid-template-columns: 1fr; } }
`;

function pane(label, change, capture, png) {
  const status = presence(change, capture);
  const absent = status.startsWith("not present") || status === "not captured";
  return `<figure>
    <figcaption>${label} <span class="${absent ? "absent" : "muted"}">(${escapeHtml(status)})</span></figcaption>
    ${png ? `<img alt="${escapeHtml(change.id)} on ${label.toLowerCase()}" src="${dataUri(png)}">` : ""}
  </figure>`;
}

function section(entry) {
  const { change, base, head } = entry;
  const selectors = change.highlight
    .map((s, i) => `<li>${i + 1}. <code>${escapeHtml(s)}</code></li>`)
    .join("");
  const setup = change.setup
    ? ` Setup: <code>${escapeHtml(JSON.stringify(change.setup))}</code>.`
    : "";
  return `<section id="${escapeHtml(change.id)}">
  <h2>${escapeHtml(change.title)}</h2>
  <div class="muted"><code>${escapeHtml(change.id)}</code> on screen <code>${escapeHtml(change.screen)}</code>.${setup}</div>
  ${change.note ? `<p>${escapeHtml(change.note)}</p>` : ""}
  <div class="panes">
    ${pane("Base", change, base.capture, base.png)}
    ${pane("Head", change, head.capture, head.png)}
  </div>
  <details><summary>Highlights (the numbered badges)</summary><ul>${selectors}</ul>${
    change.region
      ? `<p>Region: <code>${escapeHtml(change.region)}</code></p>`
      : ""
  }</details>
</section>`;
}

/** @param {{ entries: object[], baseRef: string }} input */
function renderHtml({ entries, baseRef }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visual report</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Visual report</h1>
  <p class="meta">${entries.length} changes. Base <code>${escapeHtml(baseRef)}</code> against head. Both are rendered from the same mock data; highlighted elements carry a red outline and a number.</p>
  ${entries.map(section).join("\n")}
</main>
</body>
</html>
`;
}

/** A summary that can be pasted into a pull request description. */
function renderMarkdown({ entries }) {
  const lines = [
    "### Visual report",
    "",
    "| Change | Screen | Base | Head |",
    "|---|---|---|---|",
  ];
  for (const { change, base, head } of entries) {
    lines.push(
      `| \`${change.id}\`: ${change.title} | \`${change.screen}\` | ${presence(change, base.capture)} | ${presence(change, head.capture)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

module.exports = { renderHtml, renderMarkdown, presence };
