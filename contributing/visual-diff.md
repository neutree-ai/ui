# Visual diff

A pull request that changes what a page looks like gets a before/after report: the same pages,
rendered from the same mock data, on the pull request's merge base and on its head. The report is
there for the reviewer, never fails a pull request, and stores no baseline images; both sides are
rendered on the same machine in the same run.

## Run it locally

```bash
yarn visual:diff                       # merge base of origin/main and HEAD, against the working tree
yarn visual:diff --base <ref>          # any commit-ish as the base
yarn visual:diff --out <dir>           # default: visual-out/
```

It builds the base (in a temporary git worktree) and the working tree, screenshots every screen on
both, and writes to the output directory:

- `report.html`: one self-contained page. Changed screens come first as base, head and a difference
  image (differing pixels in red); unchanged screens are listed collapsed; requests that had no mock
  are listed last.
- `comment.md`: the summary the pull request comment is made from.
- `base/` and `head/`: the screenshots.

The first run needs a Playwright browser: `npx playwright install chromium`.

## The rule

Every user-visible change a pull request lists should appear in the report, and every change in the
report should be listed. A change in the report that the description does not mention is either a
side effect to fix or a change to describe. A listed change that is missing from the report means a
screen or a fixture state does not cover it yet: add one.

## Add a screen

Screens are one declarative list in `e2e/visual/screens.ts`. An entry is a route, the mock data the
page reads, and the text that is on screen once the page has rendered:

```ts
logSink("failing", failingSink),
```

For a page that no helper in the file covers, write the entry out:

```ts
{
  id: "engine-show",                       // file-safe, unique
  route: "/default/engines/show/vllm",     // hash route
  data: { tables: { engines: [engine] } }, // see MockData
  ready: "vllm",                           // exact text, present on base and head
},
```

`ready` must be text that renders the same on the base and the head; do not pick a value the change
under review alters.

## Add a fixture

Fixtures are data typed by the kind's `types.ts` and written for the kind's `contract.md`, in
`src/domains/<kind>/testing/visual-fixtures.ts` (`src/foundation/testing/visual-fixtures.ts` holds
the frozen time, the workspace and `fixtureMetadata`). Give a kind a few states that exercise what
its pages show: a typical record, empty or null fields, long strings, a failed status. Keep them
deterministic: fixed timestamps, no random ids, neutral names (`cluster-a`, `10.0.0.x`,
`example.com`), nothing that identifies a real deployment.

Fixtures are data, not components, so they work unchanged on the base and the head. A fixture is
not a unit-test builder; keep builders in `testing/builders.ts`.

## The mock backend

`e2e/visual/mock-backend.ts` answers every request the app makes, from the screen's `MockData`:

- `tables`: rows by PostgREST table; any read of the table returns them all.
- `custom`: bodies by path, for routes that are not tables (`license`, `system/info`).
- `rpc`: results by function name. Permission checks all answer true.
- Anything else gets an empty but valid response and is listed in the report under "Requests
  without a mock". Mock it when a screen depends on it.
- Requests to other origins are answered empty.

The browser is signed in by a session written to local storage before the page loads, so there is no
login. Time is frozen (`VISUAL_NOW`), the locale is en-US, the time zone UTC, the theme light,
animations are off and the viewport is 1280 px wide; it grows to the page's height.

## In CI

The `visual-diff` job of the Test workflow runs only when the pull request changes `src/`, this tool
or its configuration. It uploads `visual-diff.html` as a single-file artifact, which opens directly
in the browser, and a small `visual-diff-comment` artifact. The `Visual diff comment` workflow posts
or updates one comment, marked `<!-- visual-diff -->`, with the changed screens and a link to the
report. It never checks out pull request code. A pull request with no visual change gets no new
comment.
