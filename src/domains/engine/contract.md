# Engine contract

Backend: Go `v1.Engine`, `EngineSpec`, `EngineVersion`, `EngineStatus` (`api/v1/engine_types.go`), table
`api.engines` (composite types `api.engine_spec`, `api.engine_version`, `api.engine_status`: `003_resources`,
`025_engine_expand`, `083_engine_capabilities`). Resource proxy `/api/v1/engines`: `RegisterEngineRoutes`
(`internal/routes/proxies/engine_proxy.go`) registers GET, POST and PATCH; no PUT or DELETE. No Engine RPCs used here.
Permissions: `engine:read|create|update|delete` (RLS in `003_resources`, soft-delete update policy in
`022_soft_delete_permission`; workspace-user grants in `050_workspace_user_permissions`). Refine resource `engines`
(`src/App.tsx`): workspaced, `idColumnName: "metadata->name"`, list and show routes only.
Backend evidence below is from local `origin/main` at `062192f6`, not its working tree.

## Type

UI types: `src/domains/engine/types.ts`. The pages consume catalog records; there are no Engine form values or save
transforms. Owner below distinguishes server lifecycle fields from definitions that an API user can supply, even though
built-in definitions are usually provisioned by the server. Every field is unmasked (no `api:"-"` in `v1.Engine`).

| path | type | required | default | owner | secret | editable after create | backend rule |
|---|---|---|---|---|---|---|---|
| `id` | integer | generated | serial | server | no | no UI | primary key (`003_resources`) |
| `api_version`, `kind` | string | yes | UI type `v1`, `Engine` | user / catalog | no | API PATCH; no UI | NOT NULL (`003_resources`); not SQL enum values |
| `metadata.name` | string | yes | none | user / catalog | no | API PATCH; no UI | `validate_metadata_name`: 10001 empty, 10003 pattern `^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`, 10004 >63; `validate_engine_no_whitespace`: 10124; unique per workspace (`engines_name_workspace_unique_idx`) |
| `metadata.workspace` | string | yes | provisioned workspace / YAML workspace fallback | user / catalog | no | API PATCH; no UI | `validate_metadata_workspace`: 10002 empty, 10005 pattern, 10006 >63 (`004_required_fields`) |
| `metadata.display_name` | string | no | absent / null | user | no | API PATCH; no UI | Go `Metadata` (`api/v1/basic_types.go`); not displayed by Engine pages |
| `metadata.labels`, `metadata.annotations` | map | no | absent / null | user / server | no | API PATCH; no UI | shared metadata; annotations added in `019_annotations` |
| `metadata.creation_timestamp`, `metadata.update_timestamp` | timestamp | server filled | current timestamp | server | no | no UI | `set_default_metadata_timestamp_column`, `update_metadata_update_timestamp_column` (`019_annotations`) |
| `metadata.deletion_timestamp` | timestamp | no | null | user requests, server reconciles | no | soft-delete PATCH only; no UI | `validate_soft_delete` (`022_soft_delete_permission`) forbids changing spec/status during initial soft delete |
| `spec` | object / null | no SQL NOT NULL | null | user / catalog | no | API PATCH; no UI | nullable composite (`003_resources`); UI declares non-null |
| `spec.versions` | `EngineVersion[]` / null | no | null | user / catalog | no | API PATCH; no UI | composite array; no version-required or uniqueness check in Engine route / listed migrations |
| `spec.supported_tasks` | string[] / null | no | null | user / catalog | no | API PATCH; no UI | `EngineSpec.SupportedTasks`; no task enum check here |
| `spec.versions[].version` | string | no SQL NOT NULL | null | user / catalog | no | API PATCH; no UI | `EngineVersion.Version`, composite attribute |
| `spec.versions[].values_schema` | JSON object / null | no | null | user / catalog | no | API PATCH; no UI | `EngineVersion.ValuesSchema` is `map[string]interface{}`; SQL JSON. UI type is narrower (`Record<string, string \| number \| boolean>`) but renderer accepts `unknown` |
| `spec.versions[].deploy_template` | map of cluster type -> mode -> base64 YAML | no | null | user / catalog | no | API PATCH; no UI | `EngineVersion.DeployTemplate`, `GetDeployTemplate` decodes; absent from UI type |
| `spec.versions[].images` | map of accelerator -> `{image_name, tag}` | no | null | user / catalog | no | API PATCH; no UI | `EngineVersion.Images`, `EngineImage`; absent from UI type |
| `spec.versions[].supported_tasks` | string[] | no | null | user / catalog | no | API PATCH; no UI | `EngineVersion.SupportedTasks` (`025_engine_expand`); absent from UI type |
| `spec.versions[].capabilities.metrics_export` | `{enabled:bool, port?:int, path?:string}` | no | undeclared -> enabled, 8000, `/metrics` | user / catalog | no | API PATCH; no UI | `ResolveMetricsExport`; `EngineCapabilities.Validate` accepts port 0..65535 and empty or slash-prefixed path; validation is not called by `RegisterEngineRoutes` |
| `spec.versions[].capabilities.playground` | `{enabled:bool, modes?:string[]}` | no | undeclared -> enabled, unrestricted modes | user / catalog | no | API PATCH; no UI | `ResolvePlayground`; `EngineCapabilities.Validate` recognizes chat / embedding / rerank; not called by generic Engine route |
| `status.phase` | `Pending` / `Created` / `Failed` / `Deleted` | no | missing / Pending settles to Created | server | no | no UI | `EngineController.sync`; SQL stores text, not an enum |
| `status.error_message`, `status.last_transition_time` | string / timestamp | no | absent | server | no | no UI | `EngineController.updateStatus` |

`RegisterEngineRoutes` adds no kind-specific write validator, immutable-field guard or deletion dependency pre-check.
`CreateStructProxyHandler` filters PATCH to declared top-level keys and directly proxies Engine to PostgREST: no masked
fields, so no backfill. Thus definitions, metadata and even status are technically writable with the relevant RLS
permission; lifecycle ownership above does not imply column-level write protection. PATCH replaces supplied composites;
it is not the registration merge used by the workspace controller.

Provisioning: `WorkspaceController.syncWorkspaceEngine` -> `createOrUpdateEngine` -> `GetBuiltinEngines` supplies built-ins
per workspace. Existing records go through `util.MergeEngine` / `MergeEngineVersion`: append new versions, union tasks,
merge image/template keys, replace non-nil schemas, replace each declared capability and retain omitted capabilities
(`mergeEngineCapabilities`). This is the controller's path, not the UI YAML import path.

## Roles

- Status: `components/EngineStatus.tsx` -> shared `BaseStatus`, `STATUS_TONE` (`foundation/lib/status-tone.ts`): Created
  positive, Failed serious, Pending notice, Deleted neutral; class strings byte-identical to the former local values.
  Label `status.phases.engine.<phase>`. Unknown phase gets no tone; missing phase renders `EmptyValue` if called directly.
  `BaseStatus` owns the error-copy control and transition-time tooltip.
- Status visibility: `lib/engine-phase.ts`, `isExceptionalEnginePhase`: show a nonempty phase except Created on cards and
  the show header. Missing status does not produce an empty chip on these surfaces.
- Time: `MetadataTimestampMeta` in the show header; no timestamp on list cards.
- Versions: shared `newestVersion` / `sortVersionsNewestFirst` (`foundation/lib/version-order.ts`); parsable versions outrank
  free-form labels, natural ordering for other tags. Latest is a UI comparison, not an API flag.
- Empty marker: `EMPTY_VALUE` for a card without versions; `EmptyValue` for a schema row without default / description.
  Schema default uses `formatDefaultValue` (JSON text, including quoted empty strings, null and false).
- Schema: `buildValueSchemaRows` flattens properties with dotted paths and `[]` array paths, title, type union, first item
  type, required-name arrays, defaults, trimmed descriptions and enums. `typeBranches` supplies unknown; `typeBranchLabel`
  supplies `array<itemType>`; `SchemaTypeIcon` / `getTypeColorClass` are domain-specific presentation.
- Playground: `resolvePlayground` mirrors server undeclared-enabled fallback; absent version/declaration and enabled with
  empty modes infer chat / embedding / rerank from endpoint task. Disabled gives no mode; explicit modes prefer task's
  mode, else first declared. Consumed outside these catalog pages; existing resolver tests pin this rule.

## Scenes

- List (`src/pages/engines/list.tsx`, `EnginesList`): card grid, no columns or batch actions. `useList("engines")`, pagination
  off, workspace from route, query disabled without workspace; `LIST_POLL_QUERY_OPTIONS` polls every 3 s in background.
  Local name search trims and lowercases; local sort Failed -> Pending -> Deleted -> Created / missing / unknown, then
  `metadata.name.localeCompare`. Loader initially; first-load failure `engines.list.loadFailed`; failed polls keep cached
  cards; empty workspace and no search matches both use `engines.list.empty`. No create button.
- Card (`components/EngineCard.tsx`): technical name, exceptional status, task badges, newest version or `-`; name/card and
  newest chip link to show. Truncated newest version gets a tooltip. `EngineVersionSummary` offers a hover list only with
  2+ versions, newest first with latest marker; a pick navigates via `useGo` with `?version=` in the route workspace.
- Show (`src/pages/engines/show.tsx`, `EnginesShow`): `useShow`, loader / not-found; header technical name, exceptional
  status, version/task counts, timestamps. Task badges and version schema below. No edit or delete. Exact `?version=` match
  wins, otherwise newest version; multiple versions get links (workspace from record, query value encoded) with latest
  marker. Single version is named in section description; zero versions renders no schema. `ValueSchemaTable` is keyed by
  version so filters/collapse reset on navigation.
- Schema (`components/ValueSchemaTable.tsx`): parameter, type, default, description columns; nested rows start expanded.
  Local path/description search, type filter, required-only switch (only when meaningful or active); all filters intersect,
  retain ancestors and bypass collapse. Counts include ancestor rows. Title falls back to name, deeply nested names gain
  parent context, full path in tooltip. Defaults have tooltips; clipped description/enum opens `RowDetails` with full text,
  all enum values and pretty JSON snippets (`splitDescriptionJson`), copy first JSON snippet. Empty schema / no matches
  have distinct messages; literal `additionalProperties: true` adds a notice.
- Create / Edit / Delete: no Engine pages, hooks, save transforms, row actions, batch delete or form reopen flow. API POST
  and PATCH exist; soft-delete PATCH sets `metadata.deletion_timestamp`, requires delete permission, and must preserve spec
  and status. `EngineController.sync` marks Deleted then physically deletes on the next reconcile (already Failed deletes
  directly); no force annotation check in that function. These API write capabilities are not built into Engine pages.
- YAML: global `useYamlImport` accepts Engine -> engines (`kindToResourceType`), skips an existing name in the workspace,
  otherwise POSTs `transformResourceForImport`: `{api_version, kind, metadata, spec}`, workspace fallback, labels default
  `{}`, no status. It never updates an existing engine. Global `useYamlExport` includes engines in `EXPORTABLE_RESOURCES`,
  not `CREDENTIAL_RESOURCES`; `transformEntityForExport` / `serializeToYaml` retain raw spec, convert api_version to
  apiVersion, optionally strip ids/status/timestamps, omit null values. No Engine-specific YAML transform.

## Descriptions

- No Engine input validation, help or form placeholders. List name search: `engines.list.searchPlaceholder`.
- Show labels: `engines.fields.supportedTasks`, `engines.fields.valuesSchema`, `common.fields.versions`.
- Version labels: `engines.versions.latest|count|all`; card accessible link `engines.card.open` with technical name.
- Schema UI uses `engines.schema.*`: column labels, search placeholder, type / required filters, counts, required badge,
  nested-toggle label and count, details expansion label, empty / no-match / additional-properties text, JSON copy.
  Package titles/descriptions, task names, version identifiers, enum/default values are rendered as supplied, not translated.

## Overrides

- Cards instead of shared resource Table: list comment says versions belong on each engine card. Read-only toolbar is
  intentional (comment says import-only); this is a UI restriction, not an API write prohibition.
- Hide Created / absent status: `isExceptionalEnginePhase` comment says the steady phase adds noise; model catalog shows
  its steady phase. Phase priority keeps broken engines first (`PHASE_PRIORITY` comment).
- Technical name instead of display-name fallback: `EngineCard` / `EnginesShow`; reason unknown, see deviation 1.
- Browser search/sort over all records, no paging: custom grid, reason beyond the card-first comment unknown.
- Only top-level task badges/counts, no version-specific tasks, image/template or capability presentation. Read-only catalog
  summarizes versions through schema, not every deployment detail; reason beyond the card-summary comment unknown.
- Latest is computed, not first in API array: show comment says API version order is creation order. Schema filter state
  resets per version; single-version engines omit the version list because there is nothing to scan.
- Schema display handles properties and object-array children, not the entire JSON Schema vocabulary. Required is read from
  arrays, not draft-3 property booleans (`normalizeRequired`, existing characterization test); additional-properties notice
  only for literal true. Reason unknown. There is no validation or transformation of engine definitions on these pages.

## Error mapping

No Engine field mapping (no form). List query failure has an inline empty-state message, with cached cards retained on a
poll failure. Show without a record renders `pages.error.notFound`. Exceptional status uses `BaseStatus` for server error
text and transition time. YAML imports collect per-resource failures through the shared import flow, with no Engine code
mapping. Write errors available through API: 10001/10003/10004 name, 10002/10005/10006 workspace (`004_required_fields`),
10124 whitespace (`029_whitespace_validation`), duplicate workspace/name (unique index), permission denial (RLS), and
`validate_soft_delete` exceptions for changing spec/status during deletion. Engine has no masked-column 10331 path.

## Known deviations

1. Display name is lost on catalog surfaces and search.
   - UI: `src/pages/engines/components/EngineCard.tsx` (`name`), `src/pages/engines/show.tsx` (`EnginesShow` header), and
     `src/pages/engines/list.tsx` (`EnginesList` filter) only read `metadata.name`.
   - API: `Metadata.DisplayName` (`api/v1/basic_types.go`), persisted in `api.metadata`; `set_default_metadata_timestamp_column`
     (`019_annotations`) carries display_name through; `RegisterEngineRoutes` / `CreateStructProxyHandler` return it unmasked.
   - Effect: an API/YAML supplied human name is neither visible nor searchable here. Ticket: TBD
2. A null spec accepted by the API cannot be displayed.
   - UI: `EngineCard` reads `engine.spec.versions`; `EnginesShow` reads `record.spec.versions` without guarding spec itself.
     The existing bare-record tests cover `spec: {}`, not null.
   - API: `api.engines.spec` is nullable (`003_resources`); `RegisterEngineRoutes` has no required-spec middleware and
     `EngineController.sync` only updates status when spec is missing. Read from code, not exercised against PostgREST.
   - Effect: a record created without spec can throw during list/detail rendering. Ticket: TBD

## Open points

- No live API exercised; constraints, provisioning, raw PATCH and soft-delete paths were read from origin/main.
- Package import / registration outside the resource proxy was not traced. `EngineCapabilities.Validate` exists, but its
  ingestion coverage must not be inferred from its comment; the raw Engine route does not invoke it.
- Full JSON Schema support is outside this renderer's contract; composition/reference constraints and version-specific
  deployment/capability details are not presented. No claim is made that the table fully describes every valid package.
