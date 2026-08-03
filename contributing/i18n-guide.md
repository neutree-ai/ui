# I18n Translation Guide

This document explains how to work with the i18n (internationalization) system in this project.

## Overview

This project uses `react-i18next` for internationalization. All user-facing text must be translated to support multiple languages.

## The CI gate (read this first)

Two steps in [`.github/workflows/test.yml`](../.github/workflows/test.yml) enforce i18n on every
pull request to `main`. The `pre-commit` hook runs the same two scripts, so they block the commit
before they block the PR.

| CI step | Script | Fails when |
| --- | --- | --- |
| Check i18n translations | `tools/i18n-tracker.cjs` | a tracked file's content no longer matches the hash recorded in `.i18n-tracker.lock` |
| Check i18n key references | `tools/check-i18n-keys.cjs` | a `t("…")` call under `src/` names a key that is missing from `src/locales/en-US.json` |

### What the tracker actually tracks

The tracker is a **content-hash ledger, not a text scanner**. It never inspects what you wrote: it
takes an md5 of each tracked file (line endings normalised to LF) and fails on any difference from
`.i18n-tracker.lock`. That has consequences worth knowing before they surprise you:

- **Every `.ts` and `.tsx` file is tracked, wherever it lives** — including the root build configs
  `vite.config.ts`, `vitest.config.ts` and `playwright.config.ts`. Editing one of those fails the
  gate even though it contains no user-facing string.
- **Any content change counts.** A new comment, a reordered import, a whitespace-only reformat —
  all trip it. So does adding a new `.ts`/`.tsx` file, and so does renaming one, because the new
  path has no entry yet.
- **Non-TypeScript files are invisible to it.** A change confined to `.md`, `.json`, `.css`, or to
  the locale files themselves, never trips it.
- **CI scans the whole tree, not your diff.** The CI step runs the scan with no `--git` flag, so it
  re-hashes every tracked file in the checkout.

Excluded from tracking: `*.d.ts`, any path containing `.test.`, everything under `e2e/`,
`node_modules/`, and any dot-directory.

### Making it pass

If you changed a TypeScript file with no user-facing text — a build config, a type-only module, a
pure utility — the whole obligation is to record its new hash and commit the lock:

```bash
node tools/i18n-tracker.cjs update vite.config.ts
git add vite.config.ts .i18n-tracker.lock
```

If the file does render text, review it first: every user-facing string must go through `t()`, with
the key present in `src/locales/en-US.json`. Then record the hash the same way. Marking a file
reviewed asserts that you looked at it — the tool cannot check that for you.

### Local-only gotchas

These bite on your machine and in the `pre-commit` hook, but not in CI, which always runs on a
clean checkout:

- **The scan walks the filesystem, not git.** Untracked and even *gitignored* `.ts` files in your
  working tree count — a scratch file at the repo root, or a stale `dist/` holding TypeScript, will
  fail the scan. Delete them rather than adding them to the lock.
- **Scan mode writes to the lock.** It garbage-collects entries whose file no longer exists. Delete
  a `.ts` file, run the scan, and `.i18n-tracker.lock` comes back modified; commit that alongside
  the deletion.

## Usage in Components

### 1. Import the translation hook

```typescript
import { useTranslation } from "react-i18next";
```

### 2. Use the `t()` function

```typescript
export const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("myComponent.title")}</h1>
      <p>{t("myComponent.description")}</p>
      <button>{t("buttons.save")}</button>
    </div>
  );
};
```

### 3. Add translations to JSON files

**src/locales/en-US.json:**
```json
{
  "myComponent": {
    "title": "My Component",
    "description": "This is a description"
  },
  "buttons": {
    "save": "Save"
  }
}
```

## I18n Tracker Tool

The project includes a tracker tool (`tools/i18n-tracker.cjs`) that monitors which files have been processed for i18n.

### Commands

#### Scan for unprocessed files

```bash
# Scan all files
node tools/i18n-tracker.cjs

# Scan files from last N commits
node tools/i18n-tracker.cjs --git 5

# Limit output to N files
node tools/i18n-tracker.cjs --limit 10
```

#### Mark a file as processed

After adding i18n translations to a file, mark it as processed:

```bash
node tools/i18n-tracker.cjs update <file-path>

# Example:
node tools/i18n-tracker.cjs update src/pages/users/list.tsx
```

Paths outside the tracked set are accepted but ignored — `update README.md` and
`update src/foundation/lib/i18n.test.ts` both print a "skipping" line and exit 0.

#### Mark several files at once

```bash
# Mark only files touched by the last N commits
node tools/i18n-tracker.cjs update-all --git 3

# Mark every pending file in the tree
node tools/i18n-tracker.cjs update-all
```

Bare `update-all` rubber-stamps *every* pending file, including ones you never opened. Prefer
`update <path>` per file, or scope it with `--git <n>`.

## Workflow for Adding I18n to a File

1. **Modify your component** to use `t()` for all user-facing strings

2. **Add translation keys** to locales JSON

3. **Update the tracker**:
   ```bash
   node tools/i18n-tracker.cjs update <file-path>
   ```

4. **Commit all changes** including the updated `.i18n-tracker.lock` file:
   ```bash
   git add src/locales/*.json .i18n-tracker.lock
   git commit -m "Add i18n translations for MyComponent"
   ```

## Translation Key Naming Convention

Follow these conventions for consistency:

- Use nested structure: `resource.section.key`
- Use camelCase for keys
- Group related translations together

### Examples:

```json
{
  "users": {
    "title": "Users",
    "fields": {
      "name": "Name",
      "email": "Email"
    },
    "placeholders": {
      "userName": "Enter user name"
    },
    "validation": {
      "emailRequired": "Email is required"
    }
  }
}
```

## CI Check Failure - How to Fix

### "Check i18n translations" failed

The step prints every file whose hash does not match the lock. Reproduce it locally with
`node tools/i18n-tracker.cjs`, then for each listed file:

1. **Review it** for user-facing strings, and route any you find through `t()` with keys added to
   `src/locales/en-US.json`. For a file that renders no text — a build config, say — there is
   nothing to change.

2. **Record the hash**:
   ```bash
   node tools/i18n-tracker.cjs update <file-path>
   ```

3. **Commit and push** `.i18n-tracker.lock` together with the file itself.

If a listed file is one you never touched, check it exists in the branch at all: a rename shows up
as a pending new path, and a deletion shows up as a lock rewrite.

### "Check i18n key references" failed

The step lists each `t("key")` whose key is absent from `src/locales/en-US.json`. Add the missing
keys there. It only reads `src/`, and it skips dynamic keys — anything containing `${` or `{{` — so
a key assembled at runtime is not verified by this gate.

## Advanced: Using Variables in Translations

For dynamic values:

**Translation file:**
```json
{
  "notifications": {
    "createSuccess": "Successfully created {{resource}}"
  }
}
```

**Component:**
```typescript
t("notifications.createSuccess", { resource: "User" })
// Output: "Successfully created User"
```

## Additional Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
