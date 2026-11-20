# Engine contract

Backend: `v1.Engine`, `EngineSpec`, `EngineVersion`, `EngineStatus` (`api/v1/engine_types.go`); `api.engines`
(`003_resources`, `025_engine_expand`, `083_engine_capabilities`). `RegisterEngineRoutes`
(`internal/routes/proxies/engine_proxy.go`): GET/POST/PATCH `/api/v1/engines`; no UI RPCs. Permissions:
`engine:read|create|update|delete` (`022_soft_delete_permission`, `050_workspace_user_permissions`). Refine: `engines`,
key `metadata->name` (`src/App.tsx`). Backend: `origin/main@062192f6`.

## Type

UI: `src/domains/engine/types.ts`. No UI editing; API PATCH available. All fields unmasked.
Owner: catalog (user/server-provisioned), except server id/status, user display name, user/server deletion.
Optional defaults: null/absent. `v[]` = `spec.versions[]`; all optional. Other shared metadata omitted.

| path | type | required/default | rule / gap |
|---|---|---|---|
| `id` | integer | generated/serial | primary key (`003_resources`) |
| `api_version`, `kind` | string | required; UI `v1`, `Engine` | NOT NULL; not SQL enums |
| `metadata.name` | string | required | workspace-unique; validation codes below |
| `metadata.workspace` | string | required; provisioned/YAML fallback | validation codes below |
| `metadata.display_name` | string | optional | `Metadata` (`api/v1/basic_types.go`); deviation 1 |
| `metadata.deletion_timestamp` | timestamp | optional | soft-delete PATCH; `validate_soft_delete` |
| `spec` | object | nullable | UI non-null; deviation 2 |
| `spec.versions` | `EngineVersion[]` | optional | no required/unique-version check in route/migrations |
| `spec.supported_tasks` | string[] | optional | no task enum check |
| `v[].version` | string | optional | composite attribute |
| `v[].values_schema` | JSON object | optional | Go map/SQL JSON; narrower UI type, unknown renderer |
| `v[].deploy_template` | cluster → mode → base64 YAML | optional | `GetDeployTemplate` decodes; absent from UI type |
| `v[].images` | accelerator → `{image_name, tag}` | optional | `EngineImage`; absent from UI type |
| `v[].supported_tasks` | string[] | optional | `025_engine_expand`; absent from UI type |
| `v[].capabilities.metrics_export` | `{enabled, port?, path?}` | enabled, 8000, `/metrics` if undeclared | `ResolveMetricsExport`; port 0..65535, path empty or slash-prefixed |
| `v[].capabilities.playground` | `{enabled, modes?}` | enabled/unrestricted if undeclared | `ResolvePlayground`; modes chat/embedding/rerank |
| `status.phase` | Pending/Created/Failed/Deleted | missing/Pending → Created | `EngineController.sync`; SQL text |
| `status.error_message`, `status.last_transition_time` | string/timestamp | optional | `EngineController.updateStatus` |

`RegisterEngineRoutes`: no write validator (including `EngineCapabilities.Validate`), immutability guard
or deletion pre-check.
Supplied composites replace stored ones.
Provisioning: `WorkspaceController.syncWorkspaceEngine` → `createOrUpdateEngine` → `GetBuiltinEngines`.
`util.MergeEngine` / `MergeEngineVersion`: append versions, union tasks, merge images/templates, replace non-nil
schemas; `mergeEngineCapabilities`: replace declared, retain omitted. Not used by YAML import.

## Roles

Paths: `src/domains/engine/` unless prefixed.

- Status: `components/EngineStatus.tsx` → `BaseStatus` / `STATUS_TONE`: Created positive, Failed serious, Pending
  notice, Deleted neutral; unknown has no tone, absent uses `EmptyValue`.
- Time: shared `MetadataTimestampMeta` on show only; no card version uses `EMPTY_VALUE` (`-`).
- Versions: `newestVersion` / `sortVersionsNewestFirst`; tests: `foundation/lib/version-order.test.ts`.
- Schema: `buildValueSchemaRows`; tests: `lib/value-schema-rows.test.ts`.
- Defaults/descriptions: `formatDefaultValue`, `splitDescriptionJson` (`lib/value-schema-rows.ts`); tests beside them.
  The schema detail dialog preserves complete nested JSON objects/arrays, including brackets in strings, as examples.
- Playground: `resolvePlayground`; tests: `lib/resolve-capabilities.test.ts`.

## Scenes

- List (`src/pages/engines/list.tsx:EnginesList`): workspace required, all records, local trimmed/lowercased name
  search; broken engines first; no batch actions.
- Card (`components/EngineCard.tsx`): name/status/tasks/newest; links use route workspace and `?version=`.
- Show (`src/pages/engines/show.tsx:EnginesShow`): name/status, version/task counts, timestamps, tasks/schema. Exact
  `?version=` wins, else newest; links use record workspace/encoded version; no versions means no schema.
- Schema: `components/ValueSchemaTable.tsx`; tests: `components/ValueSchemaTable.test.tsx`.
- Create/Edit/Delete: no UI. `validate_soft_delete` preserves spec/status (`022_soft_delete_permission`);
  `EngineController.sync`: Deleted then delete next reconcile, Failed deletes directly; no force-annotation check.
- YAML import: shared `useYamlImport`; `kindToResourceType` maps Engine → engines; no Engine-specific transform.
- YAML export: shared `useYamlExport`; engines are exportable, not credential resources; no Engine-specific transform.

## Descriptions

No form descriptions; package titles/descriptions, tasks, versions, enums/defaults are untranslated.

## Overrides

- Cards over shared Table: list comment says versions belong on cards; read-only toolbar comment says import-only.
- Hide Created/absent: `isExceptionalEnginePhase` comment says steady status adds noise (unlike model catalog).
- Phase priority: `PHASE_PRIORITY` comment says broken engines first.
- Technical name over display-name fallback: `EngineCard` / `EnginesShow`; reason unknown (deviation 1).
- Browser search/sort without paging: custom grid; reason beyond card-first comment unknown.
- Top-level tasks only; no version tasks/images/templates/capabilities: reason beyond card-summary comment unknown.
- Computed latest: show comment says API order is creation order; single-version list omitted as nothing to scan.
- Schema subset (properties/object arrays, required arrays, literal-true additional properties): reason unknown.

## Error mapping

No Engine code mapping; shared YAML failures. Failed polls retain cards; missing show is not-found.
`BaseStatus` exposes server error/transition time. `validate_metadata_name`: 10001 empty, 10003 pattern
`^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`, 10004 >63; `validate_metadata_workspace` 10002 empty, 10005 pattern, 10006 >63
(`004_required_fields`); `validate_engine_no_whitespace` 10124 (`029_whitespace_validation`); duplicate workspace/name
(`engines_name_workspace_unique_idx`); permission denial; initial deletion spec/status changes (`validate_soft_delete`).

## Known deviations

1. Display name is lost on catalog surfaces/search.
   - UI: `src/pages/engines/components/EngineCard.tsx` (`name`), `src/pages/engines/show.tsx` (`EnginesShow` header),
     `src/pages/engines/list.tsx` (`EnginesList` filter) read only `metadata.name`.
   - API: `Metadata.DisplayName` (`api/v1/basic_types.go`), stored in `api.metadata`;
     `set_default_metadata_timestamp_column` (`019_annotations`) preserves it; `RegisterEngineRoutes` /
     `CreateStructProxyHandler` return it unmasked.
   - Effect: API/YAML human names are neither visible nor searchable. Ticket: TBD
2. API-accepted null spec cannot be displayed.
   - UI: `EngineCard` reads `engine.spec.versions`, `EnginesShow` reads `record.spec.versions` unguarded; bare-record
     tests cover `spec: {}`, not null.
   - API: nullable `api.engines.spec` (`003_resources`); no required-spec middleware in `RegisterEngineRoutes`;
     `EngineController.sync` only updates status for missing spec. Code evidence, not exercised against PostgREST.
   - Effect: a record created without spec can throw on list/detail. Ticket: TBD

## Open points

No live API/package ingestion traced; validation comments do not prove coverage.
Not a full package schema; composition/references and deployment/capability details are not presented.
