# Foundation contract

Cross-kind facts shared by more than one resource kind. Kind-specific facts live in
`src/domains/<kind>/contract.md`; this file only records what they have in common.

## Masked fields (`api:"-"`)

- Go fields tagged `api:"-"` are removed from every proxy response (`filterObject` in the resource
  proxy), so the UI never holds the stored value: `ImageRegistry.spec.authconfig` (object),
  `ModelRegistry.spec.credentials` (string). Cluster and external endpoint carry the same kind of
  field and keep their own copies (see below). External endpoint masks `spec.upstreams[].auth.credential` inside an
  array.
- On PATCH the proxy handler (`handlePatchWithBackfill`, triggered by `writesMaskedColumn` when the
  body contains the masked column's parent) fetches the stored row and calls `mergeExcludedFields`.
  For each excluded path it overwrites the body value with the stored one when the body value is
  missing or `isEmptyValue` (nil, empty string, empty map). Recursion enters maps present in both
  body and stored row.
- UI rule: an empty untouched secret input is omitted from the edit payload; a touched-then-emptied
  one is sent as `""`. Shared helper `omitEmptyUntouched` (`foundation/lib/touched-fields.ts`), used
  by `transformImageRegistryValues`, `transformModelRegistryValues` and `transformClusterValues`
  (secrets `spec.config.ssh_config.auth.ssh_private_key`, `spec.config.kubernetes_config.kubeconfig`) and
  `cleanUpstreamsForSubmit` (external endpoint, `spec.upstreams.<i>.auth.credential`, path indexed per upstream).
- Log sink masks `spec.victorialogs.auth.password|token` and `spec.s3.auth.access_key_id|secret_access_key`.
  Its builders (`toVictoriaLogsSinkSpec`, `toS3SinkSpec`) drop a blank secret regardless of touched state;
  it does not use `omitEmptyUntouched`. An omitted parent object (`auth`) is recreated from stored secrets by
  `mergeExcludedFieldsRecursive` when `subtreeHasExcludedField`. See `domains/log-sink/contract.md`.
- Identity Source also omits blank secrets regardless of touched state; it does not use `omitEmptyUntouched`.
  Its storage semantics differ from ordinary proxy backfill; see `domains/identity-source/contract.md`.
- Known deviations of this rule (details and evidence in the kind contracts):
  1. A partially filled object overwrites the stored one: a one-key `spec.authconfig` is not empty,
     so the other credential is lost (Image Registry deviation 1).
  2. A touched-then-emptied secret is sent as `""`, which `mergeExcludedFields` treats as empty and
     backfills, so a stored secret cannot be cleared from the UI (Model Registry deviation 1).

## Masked fields inside arrays

`ExternalEndpointSpec.Upstreams` declares `mergekey:"upstream.url,endpoint_ref"`.
`mergeExcludedFieldsRecursive` merges such arrays through `mergeArrayByIdentity`
(`elementIdentity`: first non-empty of the key paths, taken from the request body
element) instead of by index, and an array with a masked field and no `mergekey` panics at startup
(`extractStructTagConfig`). Consequence for the UI: a secret is kept only when the element's identity is unchanged, so
editing an upstream URL with an empty credential loses it (External Endpoint deviation 1). The connectivity test route
backfills separately (`backfillAuthCredential`, by `stored_upstream_url`) and needs
`external_endpoint:read-credentials`.

## Edit PATCH

Refine edit forms send the whole loaded record as the PATCH body, including `id` and `status`
(proxy keeps those top-level fields). The status snapshot is therefore written back on every edit.
Whether a stale `status` (e.g. `ModelRegistryStatus.stats`) is harmful was not traced. Applies to all
kinds on the shared edit flow, except Log Sink (`{spec}`) and Identity Source (`{metadata, spec}`), whose
`onFinish` overrides construct their payloads explicitly.

## Backfill preconditions

`handlePatchWithBackfill` fetches the stored row from the query-string filters and requires exactly one match; a PATCH
that writes a masked column's parent and matches zero or several rows fails with 10331 (`ambiguousBackfillCode`).
A soft-delete PATCH skips the backfill (`IsSoftDeleteRequest`). The backfill runs before the kind's validator and
check functions, so those see the stored secret (cluster: `buildPostgrestClusterPatchValidationNew`; log sink:
`validate_log_sink_spec`).

## Soft delete and force

Delete is a PATCH of `metadata.deletion_timestamp` (`validate_soft_delete`, `022_soft_delete_permission`) issued by the
shared delete provider and `DeleteConfirmDialog`; the force checkbox adds annotation `neutree.ai/force-delete`. The
per-kind deletion pre-checks (cluster 10126, image registry 10127, model registry 10128, built-in guard 10132) do not
read the annotation, so force never bypasses them, and the UI has no code-specific handling of them (generic toast).
Log sink opts out of the checkbox (`allowForceDelete: false`).

## Error toast path

Data-provider calls reject through `handleError` (`foundation/providers/data-provider/utils/handle-error.ts`):
message is `error.message` plus `: <hint>` when present, `statusCode` is the numeric `code`. The Refine notification
provider shows it as an error toast. Kinds without a field mapping use this path unchanged; only mappings a kind adds
are listed in its contract.

## YAML import and export

Import (`foundation/hooks/use-yaml-import.ts`) creates a record only when `getOne` finds none; an existing name is
skipped, never updated. Export (`foundation/hooks/use-yaml-export.ts`) offers `EXPORTABLE_RESOURCES`; options default
to removing status, ids and timestamps. Only `CREDENTIAL_RESOURCES` (clusters, image registries, model registries) are
fetched through `/credentials/<type>` (needs `<kind>:read-credentials`) so their secrets are included. External
endpoints are exportable but carry no credential (the credentials route does not serve them); log sinks are not in
the exportable set. Tests: `use-yaml-import.test.ts`, `use-yaml-export.test.ts`.

`serializeToYaml` drops null/undefined values recursively for every exported kind; explicit null entries in JSON maps
therefore disappear. Model Catalog also seeds its editor through this serializer (see its contract).
Tests: `foundation/lib/yaml-transform.test.ts`.

## Table batch delete

`foundation/components/Table.tsx` sets `enableRowSelection: enableBatchDelete`, a table-wide flag.
A kind that withholds per-row delete (Model Registry: `registryIsProvisioned`) still lets those rows
be selected and batch-deleted; the backend then refuses per row (`builtinModelRegistryGuard`, 10132).
See Model Registry deviation 2.

## Status tone

`foundation/components/BaseStatus` renders the chip; callers pass `className` (tone) and
`translatedPhase`. The four tone class strings (positive, serious, notice, neutral; `--nt-stroke|fill|text-*`
tokens of `variables.css`) live in `foundation/lib/status-tone.ts` (`STATUS_TONE`), used by
`RegistryStatus`, `domains/cluster/components/ClusterStatus`,
`domains/external-endpoint/components/ExternalEndpointStatus`,
`UpstreamStatusBadge`, `domains/log-sink/components/LogSinkStatus` (Disabled maps to neutral),
`domains/engine/components/EngineStatus`, `domains/model-catalog/components/ModelCatalogStatus`,
`domains/identity-source/components/IdentitySourceStatus`,
`IdentitySourceSyncResult` (ok positive, failed serious, pending notice), and `EndpointStatus`.
Image Registry and Model Registry share `RegistryStatus`: phases Connected, Failed, Pending and Deleted use
`status.phases.registry.<phase>`. Cluster maps Running to positive, Failed to serious, Pending / Paused / Initializing /
Updating to notice, Deleted / Deleting to neutral, and keeps one local class string for Upgrading
(outstanding tone).
`EndpointStatus` serves Endpoint, Cluster and External Endpoint surfaces and API Key / Group Policy model pickers.
Running is positive, Failed serious, Pending / Degraded / Deleting / Paused notice, Deleted neutral; Deploying and
ModelDownloading retain their local outstanding string with a thin fill. An absent phase renders `EmptyValue`
for `BaseStatus` callers.

## Domain code in foundation

Image repository listing (`foundation/lib/api/image-registry-content.ts`,
`foundation/hooks/use-image-repositories.ts`) is consumed only by `domains/endpoint`
(`ImageRegistryExplorerDialog`), not by `domains/image-registry`. It stays in foundation because
`.dependency-cruiser.cjs` (`no-L2-cross-domain`) forbids the endpoint domain importing it from
another domain. The same holds for `model-registry-visibility` / `model-registry-availability`.

## Token quotas

API Key and Group Policy use `foundation/lib/token-quota.ts` for amount/unit conversion, periods and display.
`splitTokenQuota`, `toTokenCount` and `formatTokenQuota` are tested in `token-quota.test.ts`; forms permit blank
as unset and require a positive safe integer after unit conversion. Backend validators accept positive int64 limits
(`api.validate_api_key_limits` in `099_apikey_per_model_quota`,
`api.group_policy_normalize_token_quota` in `133_group_policies`).

## Row writes

Organization, Service Account and Group Policy use `foundation/hooks/use-row-write.ts:useRowWrite` for custom
PostgREST writes with `Prefer: return=representation` and automatic notifications disabled. An optional `onNoRow`
turns empty PATCH/DELETE representations into an error; it does not distinguish RLS refusal from concurrent removal.
Resource list invalidation and extra invalidation are caller options. Tests: `hooks/use-row-write.test.ts`.

## Workspace selection

`foundation/hooks/use-workspace.ts` serves workspaced resource lists and forms. `useWorkspaceOptions` reads
`workspaces`, name ascending, 100 rows per request; search uses `metadata->>name` contains on the server.
`useWorkspaceSearch` debounces searches and labels options with technical names. `WorkspaceField` retains a selected
option absent from the search results. Tests: `use-workspace.test.ts`, `WorkspaceField.test.tsx`.

`useWorkspace` prefers the URL workspace, including a name absent from the returned rows. Without a URL it accepts
the `__workspace__` local-storage preference only if present in the first options page, otherwise `_all_`.
Only list routes copy URL selection into storage. Loading is returned separately; selection does not await it.
`WorkspaceSelect` navigates workspaced list routes and displays their show-route selection.

`isValidWorkspace` checks only nonempty and not `_all_`; it does not validate syntax, existence or permission.
`dataProvider.getList` adds a workspace filter only for a concrete selection on a workspaced resource;
`getOne` and update use the supplied workspace for workspaced name lookups. Global resources receive no such filter.
These are query/form decisions, not API authorization: `api.validate_metadata_workspace` (`004_required_fields`)
checks required text, DNS-style format and length on attached resource triggers, and resource policies call
`api.has_permission` (`001_rbac`, later policy migrations). The selection neither creates a Workspace nor grants access.

## Accelerator resources

Cluster and Endpoint share `gpu-device-resources`, `accelerator-observations` and `GpuObservationCard`. Backend
observations: `observations.RegisterRoutes` / `handler` (`internal/routes/observations/accelerators.go`), `Snapshot` and
metric samples; read permission follows the resource. Allocation snapshots use `v1.ClusterResources` and
`v1.EndpointResourceStatus`; placement is a UI estimate, not backend admission (`validateEndpointResourceShape`).

`calculateGpuPlacementCapacity` handles CPU-only, full, fractional and vGPU requests. Only absent/empty node maps are
unknown; partial snapshots exclude missing dimensions/devices rather than disabling checks. Zero requests pass.
Comparisons tolerate 1e-6 drift; vGPU memory also accepts the one-decimal GiB display bucket. Search limits bound GPU
capacity estimates; CPU-only capacity uses resource bounds directly. `maxCpuPerReplica` / `maxMemoryPerReplica` are
maxima among GPU-eligible nodes. `addBackEndpointDeviceAllocationsToNodeResources` credits observed ownership, capped at
allocatable values; unknown nodes/devices gain nothing. Full-card availability uses the same shared check. Tests:
`foundation/lib/gpu-device-resources.test.ts`; callers retain their own validation policy.

`actualUsageMarkerState` hides zero/negative actual VRAM, marks known reservation excess serious and otherwise uses the
neutral marker. Missing readings stay empty; zero remains a numeric reading. The GPU details sheet labels the live
reading as actual usage (observed VRAM / physical) and keeps the allocation reading (allocated / physical) separate.
Tests:
`foundation/lib/accelerator-observations.test.ts`, `foundation/components/GpuObservationCard.test.tsx`.
