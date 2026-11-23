# Architecture

## Layer Model

```
L0  components/ui/     shadcn/ui primitives (Button, Dialog, Select…)
L1  foundation/        Shared infrastructure — not owned by any resource
L2  domains/<name>/    Resource-specific logic, one directory per resource
L3  pages/<name>/      Route-level views, one directory per resource
```

**Design goal**: every feature request maps to a clear, minimal set of files to touch. Cross-cutting concerns live in L1; resource-specific logic stays in its L2 domain; page composition stays in L3.

## Dependency Rules

Higher layers import lower layers. Never the reverse.

```
L3 ──→ L2 ──→ L1 ──→ L0
              L1 ←──→ L1  (internal free)
```

Inside L1 the shared layers point one way: `type/` imports neither `role/` nor `scene/`, and `role/`
does not import `scene/` (tests excepted).

Enforced by `dependency-cruiser` — run `yarn dep-check`. CI will catch violations.

## Directory Layout

### L1 `foundation/`

```
foundation/
├── type/          Value-level building blocks: EmptyValue, NumberInput, middle-truncate, plural
├── role/          What a field means across resources: BaseStatus, Timestamp, WorkspaceField, unit, validate
├── scene/         Page-level flows: ListPage, ShowPage, ResourceForm, Table, YAML import/export, delete
├── components/    App shell (layouts, sidebar) and components tied to one resource kind
├── hooks/         Workspace, permission, license and other app or kind-specific hooks
├── lib/           Utils, API client, i18n, constants, kind-specific helpers
├── providers/     Auth, data, theme, notification
└── types/         Metadata, BaseStatus, shared serving types
```

`type/`, `role/` and `scene/` are the shared layers, named by what a module means rather than by
its file kind, so each is flat and holds components, hooks and helpers side by side with their
tests:

- `type/` — how one kind of value is shown or entered, with no knowledge of any resource.
- `role/` — the part a field plays in every resource: status, timestamps, workspace, display name,
  units, validation.
- `scene/` — a whole interaction on a page: list, detail, form, table, batch delete, YAML
  import/export.

`components/`, `hooks/` and `lib/` keep what is not a shared layer: the app shell (`BaseLayout`,
`AppSidebar`, `lib/utils`, `lib/i18n`, the API client) and modules that serve a single resource
kind.

#### Layer check

`tools/ddu-layers.cjs` finds every place a resource field is read or declared as a form path and
names the layer that decides what happens with it: a shared `type/`, `role/` or `scene/` piece, the
kind's own `lib/` (description), or the component or page itself. The last is an **override**: a
comparison, fallback, format or raw render of a field written inline, which the next page will
have to repeat. Passing a field on unchanged is not a decision.

- `yarn ddu:layers` — the per-kind layer table, plus the kind-specific modules still living in
  `foundation/`. `--json <file>` and `--sites <file>` write the details.
- `yarn ddu:check` — fails on overrides that are new, and prints under each one why it was
  flagged and how to fix it: move the rule into the kind's `lib/` or a `type/`/`role/` piece, or,
  when it cannot live lower, mark it on the line above with the reason. It runs in pre-commit and CI.

```tsx
// ddu-override: the upgrade tip follows the raw phase, not the displayed status
const showTip = cluster.status?.phase === "Failed";
```

Between JSX children the mark is `{/* ddu-override: <reason> */}`. A mark without a reason, or with
no override on the next line, fails the check.

Existing overrides are listed in `tools/ddu-baseline.json` (per file, by expression, not by line),
so only new ones fail. The baseline only shrinks: after removing overrides or renaming a file, the
check fails until `yarn ddu:check --update-baseline` is run and the file committed; that command
drops gone entries, moves entries with a renamed file, and never adds a new override.
`--rebuild-baseline` rewrites it from scratch and is only for changes to the tool's own rules.

### L2 `domains/<resource>/`

```
domains/cluster/
├── types.ts           Resource types (always at domain root)
├── components/        ClusterStatus, ClusterType, NodeIPsField
├── hooks/             use-cluster-monitor-panels, use-<resource>-form
└── lib/               cluster-resources, get-ray-dashboard-proxy
```

Rules:
- `.tsx` → `components/`, `use-*.ts` → `hooks/`, utilities → `lib/`, `types.ts` stays at root
- Form hooks (`use-<resource>-form`) live in L2 `hooks/` — they contain domain knowledge (validation rules, field structure, conditional logic)
- Domains with only types skip subdirectories
- Multi-domain shared types go to `foundation/types/` (e.g. `serving-types.ts`)

### L3 `pages/<resource>/`

Each resource directory contains: `list.tsx`, `create.tsx`, `edit.tsx`, `show.tsx`.

Pages are thin composition layers — they call an L2 form hook and pass the result to `ResourceForm`. Column definitions are inlined in `list.tsx`.

## Common Tasks: Where to Put Code

| Task | Layer | Location |
|------|-------|----------|
| New shadcn/ui primitive | L0 | `components/ui/` |
| Shared value display or input | L1 | `foundation/type/` |
| Shared field semantics (status, unit, validation) | L1 | `foundation/role/` |
| Shared list/detail/form/table building block | L1 | `foundation/scene/` |
| App shell or kind-specific shared module (e.g. workspace hook) | L1 | `foundation/components/`, `hooks/`, `lib/` |
| Resource type definition | L2 | `domains/<name>/types.ts` |
| Resource-specific component | L2 | `domains/<name>/components/` |
| Resource-specific hook | L2 | `domains/<name>/hooks/` |
| CRUD page / form / columns | L3 | `pages/<name>/` |
| Type used by 2+ domains | L1 | `foundation/types/` |

## Conventions

- **No barrel re-exports** — import from source file directly
- **Import paths** — within same subdirectory: relative; cross-subdirectory or cross-layer: `@/` alias
- **Resource types** follow `Metadata + Spec + Status` pattern; `metadata->name` is the primary key
- **Tailwind shadows** — a bare `shadow-[var(--token)]` is read as a shadow *colour* and renders
  nothing, so use `[box-shadow:var(--token)]`, or `shadow-[shadow:var(--token)]` when the shadow
  must compose with `ring-*`. `node tools/check-shadow-utilities.cjs` enforces this in the
  pre-commit hook and CI (focus rings silently disappeared this way).

## Form validation lifecycle

- Do not validate untouched fields. Entering a page, changing an option, or revealing a
  conditional required field must not surface a validation error by itself.
- Stepwise forms validate only the fields owned by the step being left. Reserve unrestricted
  validation for the final global submit, then navigate to the first invalid step.
- Once a field has a visible error, revalidate it on change so the error disappears as soon as
  the input becomes valid. Derived values follow the same rule: filling an invalid field clears
  its error, while revealing an untouched field does not create one.
- A custom resolver must return React Hook Form's nested `FieldErrors` tree. When a domain
  validator produces dotted paths, convert it with `nestFieldErrors` at the resolver boundary;
  literal keys such as `"metadata.name"` cannot be cleared by field-level revalidation.
