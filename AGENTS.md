# AGENTS.md

## Development

Follow the architecture guide: [contributing/architecture.md](contributing/architecture.md)

## Data contracts

Before changing a resource kind, read its contract: `src/domains/<kind>/contract.md`.
When a change alters what the kind stores, sends, shows, validates or locks, update that contract in
the same PR. Facts that span kinds go to `src/foundation/contract.md`.
A rule about a resource field belongs in the kind's `lib/` or a shared `foundation/type|role` piece,
not inline in a component. `yarn ddu:check` gates this in pre-commit and CI: it fails on a new
inline rule and prints, under each one, why it was flagged and the fixes to apply. Follow them and
rerun until it passes; prefer moving the rule over marking it, and never hand-edit
`tools/ddu-baseline.json`. See [Layer check](contributing/architecture.md#layer-check).

## Unit Tests

Follow the unit testing guide: [contributing/unit-test.md](contributing/unit-test.md)

Read it before adding or changing any test, and go through its checklist before finishing. In short:
test each rule once at the cheapest layer (`lib/` first; components and forms only prove the wiring),
assert what the user sees rather than class names or layout, and do not re-declare what
`src/foundation/testing/setup.ts` already provides.

## E2E Tests

Follow the E2E guide: [contributing/e2e.md](contributing/e2e.md)

## Visual Diff

Follow the visual diff guide: [contributing/visual-diff.md](contributing/visual-diff.md) (every user-visible change a PR lists should appear in its report, and vice versa)

## I18n

Follow the i18n guide: [contributing/i18n-guide.md](contributing/i18n-guide.md)

Note the CI gate before editing anything: `tools/i18n-tracker.cjs` hashes every `.ts` and `.tsx`
file in the repository — build configs such as `vite.config.ts` included — and fails when a file's
content differs from `.i18n-tracker.lock`. Editing any TypeScript file therefore requires
`node tools/i18n-tracker.cjs update <path>` and committing the updated lock, whether or not the
change involves user-facing text.
