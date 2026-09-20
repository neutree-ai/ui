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

Enforced by `dependency-cruiser` — run `yarn dep-check`. CI will catch violations.

## Directory Layout

### L1 `foundation/`

```
foundation/
├── components/    Layout, form containers, table, shared UI
├── hooks/         Workspace, delete, column-visibility…
├── lib/           Utils, API client, i18n, constants
├── providers/     Auth, data, theme, notification
└── types/         Metadata, BaseStatus, shared serving types
```

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
| Shared form/table component | L1 | `foundation/components/` |
| Shared hook (e.g. workspace) | L1 | `foundation/hooks/` |
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
