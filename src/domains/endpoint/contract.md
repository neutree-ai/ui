# Endpoint contract

Backend: `v1.Endpoint`, `EndpointSpec`, `EndpointStatus` (`api/v1/endpoint_types.go`); `api.endpoints`
(`003_resources`, `024`, `109`). `RegisterEndpointRoutes`
(`internal/routes/proxies/endpoint_proxy.go`): GET/POST/PATCH, with `validateEndpoint` before writes.
Permissions: `endpoint:read|create|update|delete`, `endpoint:trace-read`, `model:invoke` (`003`, `022`, `060`, `134`).
Refine: `endpoints`, workspaced, key `metadata->name`. Backend: `origin/main@062192f6`.
UI paths are relative to this domain.
Validators: `internal/routes/proxies/endpoint_validation.go`.

## Type

UI: `types.ts`, shared serving types. Defaults are form defaults. Unmasked; user-owned/editable unless noted.

| path | type | required/default | owner/edit exception | backend rule |
|---|---|---|---|---|
| `id`, `api_version`, `kind` | integer, strings | serial, v1, Endpoint | server id; no input | primary key; NOT NULL headers |
| `metadata.name`, `.workspace` | strings | blank name; selected workspace | locked | workspace-unique name; metadata validators |
| `metadata.display_name`, `.labels`, `.annotations` | string, maps | absent | preserved; no general input | `v1.Metadata` |
| pause label, catalog annotations | strings | absent | action-owned | `computeTogglePayload`, `buildCatalogOriginAnnotations` |
| `spec.cluster` | cluster name | required; blank | locked on edit | `validateEndpointPatchClusterImmutable`; 10225 |
| `spec.model` | ModelSpec/null | default empty fields | task retained for model-free engines | `validateEndpointModelSource` |
| `spec.model.registry`, `.name` | strings | downloader required; blank | editable | `validateEndpointModelSource`; 10229 |
| `spec.model.version`, `.file` | strings | optional; blank | editable | default version resolution; file selector |
| `spec.model.task` | string | UI required; blank | engine-derived or selected | gateway task routing; no write enum |
| `spec.engine.engine`, `.version` | strings | required; blank | editable | `validateEndpointEngineRef`; 10232/10233 |
| `spec.resources.cpu`, `.memory`, `.gpu` | string/null | optional; zero strings | numeric form values | `ResourceSpec`; memory in GiB |
| `spec.resources.accelerator` | string map/null | API optional; UI required | editable | type/product required when declared; 10108/10230 |
| accelerator `virtualization.memory_mib` | positive integer string | vGPU required | GiB form input | `validateEndpointVGPUMemorySpec`; physical memory ceiling |
| accelerator `virtualization.core_percent` | integer string | optional; blank unlimited | 0 input omitted | `validateOneToHundredPercentResource`; 1..100 |
| `spec.replicas.num` | integer/null | API optional; form 1 | edit and pause action | `validateEndpointReplicaCount`; nonnegative |
| `spec.deployment_options` | JSON map | scheduler.type consistent_hash | editable | JSON map |
| `spec.variables`, `.env` | JSON map, string map | engine_args map, empty env | editable | JSON/string values |
| `spec.kv_cache` | provider/options object/null | absent | runtime switch | `kvcache.Validate`; SQL 22023 |
| `status.phase`, `.service_url`, `.served_models` | string, string, ordered strings | absent | read-only | controller phase/models |
| `status.resources`, `.kv_cache`, `.error_message`, `.last_transition_time`, `.model_download_completed_hash` | objects, strings | absent | read-only | `EndpointStatus`; runtime observation |
| `status_sort_priority` | integer | generated | server; no write | `100_endpoint_status_sort_tiers` |

`validate_metadata_name` / `validate_metadata_workspace` (`004`) enforce DNS-style names, length 63 (10001..10006).
`api.validate_endpoint_cluster_name` (`013`) requires cluster (10010). `validateEndpointCreateDeployTarget` checks
cluster/engine/version existence. PATCH rechecks engine when spec is supplied and forbids cluster changes.
`buildPostgrestEndpointPatchValidationNew` validates replacement composites.
Empty model version is legal (`045`, `091`); `getDeployedModelRealVersion` (`internal/orchestrator/util.go`) resolves
hub defaults/latest BentoML. `api.validate_endpoint_model_name` (`091`) checks slash-separated names (10105).
`ModelSpec.Info` is advisory; status hash alone does not prove download completion.

Active accelerators require positive GPU counts: SSH tenths below one, otherwise integers; Kubernetes integers.
`validateAcceleratorProductSupported` fails open on absent product metadata; empty products reject all.
vGPU needs Ready, enabled Kubernetes virtualization and supported keys (`validateEndpointVGPUCluster`,
`validateEndpointVGPUResourcesSupported`). Absent capabilities fail open; empty supports none.
Per-card memory has a physical ceiling; placement capacity is left to scheduling.

## Roles

- Shared columns/time/empty: `useMetadataColumns`, `Timestamp`, `MetadataTimestampMeta`, `EmptyValue`.
- Workspace mechanics: `src/foundation/contract.md`, “Workspace selection”.
- Status: `src/foundation/components/EndpointStatus.tsx:EndpointStatus` uses `BaseStatus` and local tone strings.
  Running is positive, Failed serious, Pending/Paused/Deleting notice, Deleted neutral;
  Deploying/ModelDownloading outstanding; unknown has no tone.
- Model/engine/task: `EndpointModel`, `EndpointEngine`, `ModelTask`; colocated tests.
- Resource units: `normalizeEndpointResourcesForForm`, `lib/vgpu.ts`; their tests.
- Runtime allocations: `lib/resource-status.ts`, `EndpointRuntimeResourcesCard`; their tests.
- Performance trends: `lib/performance-trends.ts`, `lib/performance-format.ts`; colocated tests.
- Playground: `usePlaygroundModels`, `lib/chat-helpers.ts`, `lib/rerank-helpers.ts`; colocated tests.

## Scenes

- List (`src/pages/endpoints/list.tsx:EndpointsList`): name, workspace, status, model/source, task, engine, cluster,
  created, actions. Server name search, task filter, sortable/hideable columns, batch delete.
- Default ordering: status_sort_priority ascending, created descending. Migration `100` ranks active/unknown 0,
  Paused 1, Deleting/Deleted 2. Rows offer edit/delete, pause/resume and save as catalog.
- Show (`src/pages/endpoints/show.tsx:EndpointsShow`): model/task/engine/cluster, served models, configuration,
  allocations/performance/access/provenance; Basic polls 15s, cluster 30s. Other tabs stop polling.
- Create/Edit: `EndpointDeploymentForm` / `useEndpointForm`; model, resources, runtime, advanced, confirm steps.
  On-touch validation; next validates owned fields, submit validates all. No catalog reapplication on edit.
- Create: manual unless model_catalog hash query; registry-model links prefill identity. Ordinary catalogs merge
  defaults; recipes compose variant/features. Cluster stays independent.
- Edit: `normalizeEndpointRecordForForm` prefills; name/workspace/cluster locked; other loaded fields retained.
  `endpointReviewChanges` blocks unchanged Save.
- Pause/resume: `EndpointPauseAction` whole-record PATCH changes only replicas/labels; pause stores old count and
  sends zero; resume restores positive stored count or one and removes the label. No form transform.
- Scale/engine/version use edit; no separate RPC. Edit mechanics: `src/foundation/contract.md`, “Edit PATCH”.
- Delete mechanics: `src/foundation/contract.md`, “Soft delete and force”. Endpoint has no reference pre-check;
  `endpointValidationSoftDelete` skips normal admission, while SQL `validate_soft_delete` protects spec/status.
- `EndpointController.performDeletion` removes gateway/runtime; force advances failures (`updateStatusOnError`);
  `handleDeletion` removes Deleted rows next reconcile.
- Save as catalog: `buildCatalogFromEndpoint` sends a flat ModelCatalog with model/engine/resources/options/args/env;
  cluster/replicas/KV cache/provenance absent. Tests: `lib/save-as-catalog.test.ts`.
- YAML mechanics: `src/foundation/contract.md`, “YAML import and export”; Endpoint is exportable without credentials.
- Quick start: `src/domains/dashboard/contract.md`, “Quick-start payload differences”.

## Submit and reopen

`useEndpointForm.refineCore.onFinish` clones values, runs `transformEndpointValues` and forwards the record.
Resource numbers become strings; replicas becomes Number. GPU zero removes accelerator. vGPU memory/core flatten;
memory_percent, core-only virtualization, empty values and custom accelerator keys disappear.
JSON object/array strings in engine_args become structured JSON; invalid JSON and scalar strings stay unchanged.
Null resources/replicas/variables survive the transform.

`engineNeedsModelSpec` hides model-free engine inputs; submit replaces an existing model with empty defaults/null info
and retained task. Null model is not rebuilt by this adapter.
`buildCatalogOriginAnnotations` writes neutree.ai/model-catalog, neutree.ai/model-catalog-variant and
neutree.ai/model-catalog-features; recipes record resolved variant/ordered features. Failed composition blocks save.

Tests: `hooks/use-endpoint-form.test.tsx` (create/reopen/edit/scale/engine/nulls/custom-key loss),
`lib/endpoint-form-helpers.test.ts` (transform boundaries/vGPU).
Actions: `components/EndpointPauseAction.test.tsx`;
deletion: `src/foundation/providers/data-provider/index.test.ts`.

`RegisterEndpointRoutes` declares no masked fields. Env/arguments resend verbatim.
Cleared env sends `{}` or a value `""`; null variables sends null. There is no excluded-field backfill.
Shared masking mechanics: `src/foundation/contract.md`, “Masked fields”; registry credentials belong to registries.

## Descriptions

`useEndpointForm` marks metadata required without resolver rules. Spec requires cluster, engine/version,
model registry/name/task unless hidden, replicas at least one, scheduler and accelerator type/product.
Create checks resolved registry/model existence; unresolved lists skip checks. Model aliases label physical names.
Engine selection chooses newest version and text-generation or first task; version tasks override engine tasks.
Create prefers vLLM once; known engine image types constrain accelerators.
Capacity budgets include replicas and owned allocations. ZCache timeout: 0.1..60, switch default 5 seconds;
`useKvCacheAvailability` / `kvCacheUnavailableReason` tests own availability. Labels use `endpoints.*` / `common.*`.

## Overrides

- Status duplicates `STATUS_TONE`; outstanding differs. Shared placement serves external endpoint (kept comment).
- GPU zero means unselect to satisfy positive-count admission (helper comment).
- Client capacity blocks exceed server admission; backend deliberately leaves stale capacity snapshots to scheduling.
- Hidden model data is cleared because users cannot correct fields absent from model-free engine forms (hook comment).
- Recipe verified hardware ranks choices without excluding others (hook comment).
- Allowlist and replicas/accelerator form restrictions: reason unknown.

## Error mapping

Transport: `src/foundation/contract.md`, “Error toast path”; forms suppress automatic notifications.
`endpointServerIssue` prefers explicit field path, then duplicate metadata.name, then code step, else confirm.
Tests: `lib/endpoint-wizard.test.ts`.

| backend code | target or meaning |
|---|---|
| 10216/10219/10222/10227/10230 | resources step; value, percent, readiness, capability, accelerator |
| 10233 | resources step; cluster or engine/version missing |
| 10232 | runtime step; engine required |
| 10229/10234 | model step |
| 22023 | runtime step; KV cache JSON shape |
| ENDPOINT_CACHE_CUSTOM_OVERRIDE | advanced step |
| other ENDPOINT_CACHE codes | runtime step; translated by endpointCacheErrorMessage |
| 10001..10006/10010/10105/10106/10108/10109/10214/10221/10225 | confirm fallback without explicit path |

Proxy constructors own 102xx codes; SQL whitespace check (`029`) owns 10109.
Cache translations: `lib/endpoint-cache-errors.ts:ENDPOINT_CACHE_ERROR_KEYS`.
Pause uses cache translations or `getErrorMessage` toast.

## Known deviations

1. Paused edits require positive replicas.
   UI: `lib/endpoint-form-helpers.ts:validateEndpointValues` rejects zero.
   API: `validateEndpointReplicaCount` and `api.validate_endpoint_replica_count` (`026`) allow zero.
   Users must resume or change scale to save another change on a paused endpoint. Ticket: TBD
2. CPU-only forms require an accelerator.
   UI: `lib/endpoint-form-helpers.ts:validateEndpointValues` requires accelerator type/product even with GPU zero.
   API: `validateEndpointResourceShape` returns successfully for absent accelerator.
   CPU-only edits cannot save on clusters without a selectable accelerator; otherwise one is auto-selected. Ticket: TBD
3. Untouched edits discard custom accelerator keys.
   UI: `lib/endpoint-form-helpers.ts:transformEndpointValues` filters through `ALLOWED_ACCELERATOR_KEYS`.
   API: `ResourceSpec.Accelerator` / `api.validate_endpoint_accelerator` (`051`) accept string maps;
   `buildPostgrestEndpointPatchValidationNew` replaces spec without backfill.
   Users saving another change lose API-supplied custom accelerator settings. Ticket: TBD
4. Metadata required markers lack validation.
   UI: `hooks/use-endpoint-form.tsx:useEndpointForm` resolver validates spec alone and registers metadata without rules.
   API: `api.validate_metadata_name` / `api.validate_metadata_workspace` (`004`) require valid identities.
   Users can submit missing or invalid names/workspaces and receive a server issue instead of a field error. Ticket: TBD

5. Human names are hidden.
   UI: `src/pages/endpoints/show.tsx:EndpointsShow` and `useMetadataColumns` display technical names.
   API: `v1.Metadata.DisplayName` (`api/v1/basic_types.go`) retains human names.
   Users cannot see or edit API-supplied endpoint display names here. Ticket: TBD

## Open points

Reopen tests use select/reset/submit, not live API or real Refine hydration.
ZCache admission and null-model task hydration are unverified; null resources can gain an accelerator.
Custom-key runtime meaning is engine-specific.
