# Visual report

A before/after report for a pull request that changes what a page looks like. For every
user-visible change the pull request lists, it shows the changed element on the merge base and on
the head, side by side, with the element outlined and numbered. Nothing is compared automatically:
the person who made the change says what to look at, and the reviewer sees it at a glance.

Both sides are rendered from the same mock data on the same machine, so no backend is needed, and
no image is stored in the repository.

The report is an on-demand local tool, not a gate: nothing in CI runs it or requires it. Make one
when asked, or when a visible change is easier to check by eye than to describe.

## For agents: making a report

1. **List the changes.** Put one bullet per change in the pull request description under "User-visible
   changes". A change is something a user can see: a label, a format, a color, a layout, an empty
   state, a tooltip. Give each bullet a short kebab-case id, for example
   `cluster-cache-plain-text`.
2. **Write a change spec**, one entry per bullet, with the same id. Keep the spec outside the repository
   (it is per pull request). See the worked example below.
3. **Make sure a screen shows it.** `e2e/visual/screens.ts` lists the pages that can be opened, each
   with the mock data it reads. If no fixture state or screen shows the change, add one (see "Add a
   screen" and "Add a fixture"). A change that needs a hover, a second viewport width or a click goes
   into the entry's `setup`.
4. **Run it.**

   ```bash
   yarn visual:report /path/to/spec.json            # base: merge base of origin/main and HEAD
   yarn visual:report /path/to/spec.json --base <ref>
   ```

   The first run needs a browser: `npx playwright install chromium`.
5. **Open `visual-out/report.html` and check every entry.** The right element must carry the outline
   on both sides, the base image must show the old behavior and the head image the new one. An entry
   whose highlight says "not present" on a side is right only when the element was really added or
   removed; otherwise fix the locator. The command exits non-zero when a locator matches nothing on
   both sides.
6. **Check the reverse.** Look through the head screens for changes the description does not list. Add
   a bullet and an entry for each, or fix the side effect.
7. **Hand it over.** `report.html` is self-contained (images inlined), so it can be opened or
   shared as one file. Do not commit it; `visual-out/` is ignored.

## The change spec

```json
{
  "changes": [
    {
      "id": "cluster-cache-plain-text",
      "title": "Model cache type, server and path are plain text",
      "screen": "cluster-ssh",
      "highlight": ["text=\"#1\" >> xpath=../.."],
      "note": "The base shows them as a badge and code chips."
    },
    {
      "id": "license-status-tooltip",
      "title": "The status chip has a tooltip with the error message",
      "screen": "license-expired",
      "highlight": ["role=tooltip"],
      "region": "xpath=//*[normalize-space(text())='Status:']/..",
      "setup": { "hover": "text=\"Expired\"" }
    },
    {
      "id": "license-grid-lg",
      "title": "Two-column grid starts at the lg breakpoint",
      "screen": "license-active",
      "highlight": [
        "*:has(> :text-is(\"Edition\"))",
        "*:has(> :text-is(\"Vendor\"))"
      ],
      "setup": { "viewport": 900 }
    }
  ]
}
```

- `id`, `title`, `screen` (an id from `screens.ts`) and `highlight` are required.
- `highlight`: Playwright selectors; every match (up to 12) is outlined, numbered in order. Prefer
  `role=`, `text=` and `data-testid` over CSS classes.
- `region`: extra context to include in the crop, for example the card around the element. The crop
  is always the highlighted elements plus the region, padded 24 px and widened to at least 640 px so
  the context is readable. Give a region when an element is missing on one side, so that side still
  shows where it would be.
- `note`: one sentence for the reviewer.
- `setup.viewport`: page width in px (default 1280), for responsive changes such as a breakpoint.
- `setup.hover`: a selector to hover first, for tooltips; highlight the tooltip itself, for example
  `role=tooltip`.
- `setup.click`: a selector to click first, for something collapsed.

A highlight that matches on only one side is reported as "not present" on the other; that is how an
added or removed element looks. A highlight that matches on neither fails the run.

## Add a screen

Screens are one declarative list in `e2e/visual/screens.ts`. An entry is a route, the mock data the
page reads, and the text that is on screen once the page has rendered:

```ts
logSink("failing", failingSink),
```

For a page no helper covers, write the entry out:

```ts
{
  id: "engine-show",                       // file-safe, unique
  route: "/default/engines/show/vllm",     // hash route
  data: { tables: { engines: [engine] } }, // see MockData
  ready: "vllm",                           // exact text, present on base and head
},
```

`ready` must render the same on the base and the head; do not pick text the change under review alters.

## Add a fixture

Fixtures are data typed by the kind's `types.ts` and written for the kind's `contract.md`, in
`src/domains/<kind>/testing/visual-fixtures.ts`; `src/foundation/testing/visual-fixtures.ts` holds the
frozen time, the workspace and `fixtureMetadata`. Give a kind the states that exercise what its pages
show: a typical record, empty or null fields, long strings, a failed status. Keep them deterministic:
fixed timestamps, no random ids, neutral names (`cluster-a`, `10.0.0.x`, `example.com`), nothing that
identifies a real deployment. Fixtures are data, not components, so they work unchanged on the base
and the head.

## The mock backend

`e2e/visual/mock-backend.ts` answers every request the app makes, from the screen's `MockData`:

- `tables`: rows by PostgREST table; any read of the table returns them all.
- `custom`: bodies by path, for routes that are not tables (`license`, `system/info`).
- `rpc`: results by function name. Permission checks all answer true.
- Anything else gets an empty but valid response; the requests are kept in each capture's `.json`.
- Requests to other origins are answered empty.

The browser is signed in by a session written to local storage before the page loads. Time is frozen
(`VISUAL_NOW`), the locale is en-US, the time zone UTC, the theme light, animations are off, and the
viewport grows to the page's height.
