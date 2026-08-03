# CLAUDE.md

## Development

Follow the architecture guide: [contributing/architecture.md](contributing/architecture.md)

## Unit Tests

Follow the unit testing guide: [contributing/unit-test.md](contributing/unit-test.md)

## E2E Tests

Follow the E2E guide: [contributing/e2e.md](contributing/e2e.md)

## I18n

Follow the i18n guide: [contributing/i18n-guide.md](contributing/i18n-guide.md)

Note the CI gate before editing anything: `tools/i18n-tracker.cjs` hashes every `.ts` and `.tsx`
file in the repository — build configs such as `vite.config.ts` included — and fails when a file's
content differs from `.i18n-tracker.lock`. Editing any TypeScript file therefore requires
`node tools/i18n-tracker.cjs update <path>` and committing the updated lock, whether or not the
change involves user-facing text.
