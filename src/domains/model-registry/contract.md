# Model Registry contract

Backend: `v1.ModelRegistry` (`api/v1/model_registry_types.go`), table `api.model_registries`, computed column
`api.visibility(api.model_registries)` (`084_model_registry_checked_at_and_visibility`,
`088_model_registry_visibility_model_scope`). Proxy `/api/v1/model_registries` (`model_registry_proxy.go`:
`CreateStructProxyHandler` + `builtinModelRegistryGuard` + `DeletionValidation`). Reconciled by
`internal/model_registry`. Extra route: connection check (`domains/model-registry/lib/model-registries.ts`,
`retryModelRegistryConnection`). Permissions: `model_registry:read|create|update|delete`, `read-credentials` (`037`; the
guard requires it to change a built-in registry's credentials). Refine resource `model_registries`: workspaced,
`idColumnName: "metadata->name"`. Shared mechanics: `src/foundation/contract.md`.

Scope: the registry record. Models inside a registry (`RegistryModelsTable`, `ModelDetailDrawer`, `ModelEditDialog`,
...) are a sub-API under `foundation/model-reference/registry-models.ts`, not covered.

## Type

Owner is user unless noted; "edit" = editable after create.

| path | type | required / default | secret | edit | backend rule |
|---|---|---|---|---|---|
| `metadata.name` | string | yes; `""` | no | no | `validate_metadata_name` (`004_required_fields`); `validate_model_registry_no_whitespace` 10120 |
| `metadata.workspace` | string | yes; current if valid | no | no | `validate_metadata_workspace` |
| `metadata.annotations["neutree.ai/builtin"]` | `"true"` | server | no | no | `builtinAnnotationChanged` refuses adding or removing it by hand (10132) |
| `metadata.creation_timestamp`, `deletion_timestamp` | timestamp | server | no | no | `022_soft_delete_permission` triggers |
| `spec.type` | `hugging-face` / `model-scope` / `bentoml` | yes; `bentoml` (`DEFAULT_MODEL_REGISTRY_TYPE`) | no | yes (guard refuses on built-in) | Go `ModelRegistryType`; no DB check; `newFileBased` rejects unknown `bentoml` schemes at reconcile |
| `spec.url` | string | yes; `""` | no | yes (guard refuses on built-in) | `validate_model_registry_url` 10035 blank (`027_fix_duplicate_error_code`), 10119 surrounding whitespace; `bentoml`: `newFileBased` accepts `file://<path>` and `nfs://<host><path>` only (reconcile time, becomes `Failed`) |
| `spec.credentials` | string | no; `""` | yes (`api:"-"`) | yes | none |
| `status.phase` | Pending / Connected / Failed / Deleted | server | no | no | controller |
| `status.{error_message,last_transition_time}` | string | server | no | no | controller |
| `status.last_checked_at` | timestamptz | server | no | no | `084`; written on a throttle, trails the real check |
| `status.stats.{model_count,storage_bytes,stats_updated_at}` | jsonb | server | no | no | `081_model_registry_stats`; absent until first measurement, never collected for public registries |
| `visibility` | `public` / `private` | server (computed) | no | no | `api.visibility`; absent from `select=*`, must be selected (`?select=*,visibility`); Go twin `VisibilityForModelRegistryType` |

Masked: `spec.credentials`, one flat string inside the `spec` composite (Foundation "Masked fields").

## Roles

- Status: `lib/phases.ts` `modelRegistryPhases` (Foundation "Status tone"), label
  `status.phases.registry.<phase>`.
- Columns `useMetadataColumns`; time `metadataColumns.creation_timestamp`, `MetadataTimestampMeta`, `formatTimestamp`
  (`stats_updated_at`, `last_checked_at`); empty marker `EmptyValue` (visibility only).
- Type: `PRESENTATION` table in `ModelRegistryType.tsx` (icon, label, URL placeholder); the only place allowed to read
  `spec.type`; unknown types render the raw string.
- Visibility: `RegistryVisibility` (`model_registries.visibility.<v>`). Capability rules from server `visibility` live
  in `foundation/model-reference/model-registry-visibility` (`registryContentsAreMeasured`, `registryAcceptsWrites`,
  `registryModelDelivery`, `registryPagesFromOffset`); reachability in `foundation/model-reference/model-registry-availability`
  (`registryIsUnreachable`, `registryIsDisabled`).
- Provisioned: `registryIsProvisioned` (`lib/provisioning.ts`) reads `neutree.ai/builtin` (Go `v1.IsBuiltin`).
- Stats: `ModelRegistryModelCount` / `ModelRegistryStorage` (`formatBytes`): number, "not counted" (public),
  "collecting" (absent).
- URL: `RegistryUrl`. Secret input: `<Input type="password">`, `omitEmptyUntouched`.

## Scenes

- List: request selects `MODEL_REGISTRY_SELECT` (`*,visibility`); type filter `RegistryTypeFilter` sends
  `spec->>type=eq.<kind>`; search `metadata->>name`, `defaultSorters`. Row actions (`ModelRegistryWriteActions`) omitted
  for a provisioned registry. Batch delete is on and not limited to non-provisioned rows (deviation 2).
- Show: `ShowPage canEdit/canDelete = !registryIsProvisioned`; selects `MODEL_REGISTRY_SELECT`;
  `RegistryAvailabilityNotice` (disabled / unreachable, last-checked time, retry via the connection check route); models
  table and drawer (`model`, `version` params). Workspace comes from the route, not the record. A provisioned registry's
  edit route is not linked but not blocked.
- Create (`use-model-registry-form.tsx`): `mode: "all"`; payload `{api_version:"v1", kind:"ModelRegistry",
  metadata:{name,workspace}, spec:{type,url,credentials}}`, credentials `""` when untouched
  (`use-model-registry-form.test.tsx`).
- Edit: locked name, workspace; type, URL, credentials editable; credentials start empty. `transformModelRegistryValues`
  deletes `spec.credentials` when empty and untouched; whole form value PATCH (incl. `id`, loaded `status`). Untouched
  edit sends `spec = {type, url}`.
- Delete: Foundation "Soft delete and force". Backend order: `builtinModelRegistryGuard` (10132 for built-in), then
  `validateModelRegistryDeletion`: 400 10128 while an endpoint in the workspace has `spec.model.registry` equal to the
  name (the SQL trigger of `035` dropped in `044_drop_sql_deletion_validation`).
- YAML: kind `ModelRegistry` <-> `model_registries`, credential-capable. Quick start
  (`domains/dashboard/hooks/use-quick-start.ts`, `buildModelRegistryValues`): `public-hugging-face` (`hugging-face`,
  `https://huggingface.co`, `credentials: ""`).

## Descriptions

- `metadata.name`: no client rule (blank rejected by server). `metadata.workspace`: required, `isValidWorkspace`.
- `spec.type`: options `modelRegistryTypeOptions` (the three server kinds). `spec.url`: required
  (`validation.urlRequired`); for `bentoml` must start with `nfs://` after trimming (`validation.mustUseNfsProtocol`);
  placeholder per type (`modelRegistryUrlPlaceholder`).
- `spec.credentials`: help `model_registries.descriptions.credentials` on create,
  `common.messages.leaveEmptyToKeepValue` on edit.

## Overrides

- Credentials omitted on edit when empty and untouched; commit "preserve dirty empty sensitive fields" (#276) added the
  touched check so a field typed into and emptied is sent as `""` (deviation 1).
- NFS-only rule for `bentoml` URLs (`useModelRegistryForm` `spec.url` `validate`, `isNfsProtocol`), narrower than the
  backend: `newFileBased` also accepts `file://`. Intended: `file://` is for backend testing, since only `nfs://` mounts
  are reachable from every node; a `file://` registry made via API or YAML cannot be re-saved from the edit form.
- Default type `bentoml`: public hubs are provisioned and a hand-made one is read-only, so the form starts on the only
  kind a user can push to (`DEFAULT_MODEL_REGISTRY_TYPE` comment).
- Capability decisions follow server `visibility` and annotations, never `spec.type` (`ModelRegistryType.tsx`,
  `model-registry-visibility.ts` comments); departs from kinds that branch on type.
- Edit / delete withheld on provisioned registries instead of shown and refused (`ModelRegistryWriteActions` comment).
- Hugging Face icon is fetched remotely; other icons are local because installs can be air-gapped
  (`ModelRegistryType.tsx` comment).
- Show reads the workspace from the route (nullable record field; `show.tsx` comment).

## Error mapping

No code-specific mapping; Foundation "Error toast path". Codes the form can hit, none attached to a field: name
validation, 10035, 10119 / 10120, 10128, 10132, 10331, 403 `insufficient permissions` from the guard (credentials of a
built-in registry). The connection check shows its own toasts in `RegistryAvailabilityNotice`.

## Known deviations

1. Clearing credentials on edit is sent but has no effect.
   - UI: typing into `spec.credentials` and emptying it marks it touched, so `transformModelRegistryValues` keeps
     `credentials: ""` (pinned by `use-model-registry-form.test.tsx` "typed into and then emptied" and
     `transform-model-registry-values.test.ts` "keeps credentials cleared on purpose on edit").
   - API: `handlePatchWithBackfill` sees `spec` in the body (`writesMaskedColumn`), fetches the stored row
     (`fetchCurrentResource`) and calls `mergeExcludedFields`; for `spec.credentials` it overwrites the target when the
     key is missing or `isEmptyValue` (`""` counts). The stored token is written back.
   - Effect: a stored credential cannot be removed through the UI; the save succeeds and the token stays. Ticket: TBD
2. Batch delete offers provisioned registries that per-row delete hides.
   - UI: `list.tsx` sets `enableBatchDelete`; `Table` sets `enableRowSelection: enableBatchDelete` (not per row);
     `ModelRegistryWriteActions` hides row actions via `registryIsProvisioned`.
   - API: `builtinModelRegistryGuard` refuses a soft delete of a built-in registry with 10132.
   - Effect: batch-deleting a provisioned registry ends in an error toast (partial-failure presentation of
     `BatchDeleteBar` not traced). Ticket: TBD

## Notes not classed as deviations

- Untouched edit: `spec = {type, url}` has no `credentials`; `mergeExcludedFields` recurses into `spec` and backfills
  it, so the stored token survives. Being one flat string, the partial-object loss of `ImageRegistry.spec.authconfig`
  cannot occur.
- `metadata` is resent whole on edit; the `builtinAnnotationChanged` comment says this is intended (an unchanged marker
  passes).
- Whitespace-padded URL: `isNfsProtocol` trims, so ` nfs://x` passes the client and the server returns 10119; a
  whitespace-only URL passes client `required` and the server returns 10035 (react-hook-form behavior assumed, not
  tested).
- Edit echoes `id` and `status` (incl. `stats`, `last_checked_at`; Foundation "Edit PATCH"). The backend comment on
  `ModelRegistryStatus.Stats` says every status-composite writer must carry stats forward; effect of a stale snapshot
  not traced.
- Provisioned registries: the edit route is reachable by URL; the form lets a user change type or URL, which the guard
  refuses (10132).
