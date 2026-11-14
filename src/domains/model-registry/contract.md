# Model Registry contract

Backend: Go `v1.ModelRegistry` (`api/v1/model_registry_types.go`), table `api.model_registries`
(composite types `api.model_registry_spec`, `api.model_registry_status`), computed column
`api.visibility(api.model_registries)` (`084_model_registry_checked_at_and_visibility`, redefined in
`088_model_registry_visibility_model_scope`). Served through the resource proxy
`/api/v1/model_registries` (`internal/routes/proxies/model_registry_proxy.go`,
`CreateStructProxyHandler` + `builtinModelRegistryGuard` + `DeletionValidation`). Reconciled by
`internal/model_registry` (status, stats). Extra non-table route used here: the connection check
(`foundation/lib/api/model-registries.ts`, `retryModelRegistryConnection`).
Permissions: `model_registry:read|create|update|delete` (RLS in `003_resources`,
`022_soft_delete_permission`), `model_registry:read-credentials` (`037_sensitive_field_permission`;
the built-in guard requires it to change a built-in registry's credentials).
Refine resource `model_registries`: workspaced, `idColumnName: "metadata->name"`.

Scope: the registry record. The models listed inside a registry (`RegistryModelsTable`,
`ModelDetailDrawer`, `ModelEditDialog`, `ModelDeleteDialog`, `ModelReadme`, `ModelInfoFields`,
aliases) are a sub-API under `foundation/lib/api/registry-models.ts`; they are not covered here.

## Type

| path | type | required | default | owner | secret | editable after create | backend rule |
|---|---|---|---|---|---|---|---|
| `metadata.name` | string | yes | `""` | user | no | no (input disabled) | `validate_metadata_name` (`004_required_fields`, same function as other kinds); `validate_model_registry_no_whitespace` 10120 |
| `metadata.workspace` | string | yes | current workspace if valid, else `""` | user | no | no (field disabled) | `validate_metadata_workspace` |
| `metadata.annotations["neutree.ai/builtin"]` | `"true"` | - | - | server | no | no | `builtinAnnotationChanged` (guard) refuses adding or removing it by hand (10132) |
| `metadata.creation_timestamp`, `deletion_timestamp` | timestamp | - | - | server | no | no | `022_soft_delete_permission` triggers |
| `spec.type` | `hugging-face` / `model-scope` / `bentoml` | yes | `bentoml` (`DEFAULT_MODEL_REGISTRY_TYPE`) | user | no | yes in the form (guard refuses a type change on a built-in) | Go `ModelRegistryType`; no DB check; `newFileBased` rejects unknown schemes for `bentoml` at reconcile |
| `spec.url` | string | yes | `""` | user | no | yes (guard refuses on built-in) | `validate_model_registry_url` 10035 (blank, via `027_fix_duplicate_error_code`); 10119 leading/trailing whitespace. For `bentoml`, `newFileBased` accepts `file://<path>` and `nfs://<host><path>` only (reconcile-time, becomes `status.phase=Failed`) |
| `spec.credentials` | string | no | `""` | user | yes (`api:"-"`) | yes | none |
| `status.phase` | `Pending` / `Connected` / `Failed` / `Deleted` | - | - | server | no | no | controller |
| `status.error_message`, `status.last_transition_time` | string | - | - | server | no | no | controller |
| `status.last_checked_at` | timestamptz | - | - | server | no | no | `084`; written back on a throttle, trails the real check |
| `status.stats.{model_count, storage_bytes, stats_updated_at}` | jsonb | - | - | server | no | no | `081_model_registry_stats`; absent until first measurement, never collected for public registries |
| `visibility` | `public` / `private` | - | - | server (computed) | no | no | `api.visibility`; absent from `select=*`, must be selected (`?select=*,visibility`); `VisibilityForModelRegistryType` is the Go twin |

`spec.credentials` is tagged `api:"-"`: the proxy removes it from every response. The UI never holds
the stored token. Unlike `ImageRegistry.spec.authconfig` it is a single flat string inside the
`spec` composite, not an object.

## Roles

- Status tone: `ModelRegistryStatus` maps the four phases to local class strings (positive, serious,
  notice, neutral tokens) and renders `foundation/components/BaseStatus`; label key
  `status.phases.registry.<phase>`. Duplicates the mapping in `ImageRegistryStatus`.
- Time: `metadataColumns.creation_timestamp` (relative `Timestamp`) in the list;
  `MetadataTimestampMeta` in the show header; `formatTimestamp` for `stats_updated_at` and
  `last_checked_at`.
- Name / workspace columns: `useMetadataColumns`.
- Type presentation: `PRESENTATION` table in `ModelRegistryType.tsx` (icon, label, URL placeholder).
  It is the only place allowed to read `spec.type`; unknown types render the raw string.
- Visibility: `RegistryVisibility` (icon + `model_registries.visibility.<v>`, `EmptyValue` when the
  value was not selected). Capability rules from the server's `visibility` live in
  `foundation/lib/model-registry-visibility` (`registryContentsAreMeasured`, `registryAcceptsWrites`,
  `registryModelDelivery`, `registryPagesFromOffset`); reachability in
  `foundation/lib/model-registry-availability` (`registryIsUnreachable`, `registryIsDisabled`).
- Provisioned: `registryIsProvisioned` (`lib/provisioning.ts`) reads annotation `neutree.ai/builtin`,
  the same marker as Go `v1.IsBuiltin`.
- Stats: `ModelRegistryModelCount` / `ModelRegistryStorage` (`formatBytes` from `foundation/lib/unit`);
  three outcomes: number, "not counted" (public), "collecting" (stats absent).
- URL display: `RegistryUrl` (http(s) -> link, else monospace; middle-truncated at 44; copy button).
- Secret input: `spec.credentials` is `<Input type="password">`.
- Empty marker: `EmptyValue` (visibility only).

## Scenes

- List (`pages/model-registries/list.tsx`): columns name, workspace, status, visibility, type,
  model count, storage, created, actions. All but name and actions are hideable. Sorting and
  filters on, search on `metadata->>name`, `defaultSorters`. List request selects
  `MODEL_REGISTRY_SELECT` (`*,visibility`). Type filter `RegistryTypeFilter` sends
  `spec->>type=eq.<kind>` to the server. Row actions (`ModelRegistryWriteActions`): edit and delete,
  omitted entirely for a provisioned registry. Batch delete is on and is not limited to
  non-provisioned rows (see deviation 2).
- Show (`show.tsx`): header with name, status, type, visibility, URL (`RegistryUrl`), timestamps;
  `ShowPage canEdit/canDelete = !registryIsProvisioned`. Request selects `MODEL_REGISTRY_SELECT`.
  Below: `RegistryAvailabilityNotice` (disabled / unreachable with last-checked time and a retry
  that calls the connection check route), the models table, model drawer (URL params
  `model`, `version`). Workspace comes from the route, not the record. Not-found text when the
  record is missing. A provisioned registry's edit route is not linked but is not blocked either.
- Create (`create.tsx` + `hooks/use-model-registry-form.tsx`): sections Basic information (name,
  workspace) and Model registry (type select, URL, credentials). `mode: "all"`, warn on unsaved
  changes. Payload: form values `{api_version:"v1", kind:"ModelRegistry", metadata:{name,workspace},
  spec:{type,url,credentials}}`; credentials is `""` when untouched. Pinned by
  `use-model-registry-form.test.tsx`.
- Edit (`edit.tsx`, same hook): name and workspace disabled; type, URL, credentials editable.
  Prefilled from the API record, which has no `spec.credentials`, so the field is empty with the hint
  `common.messages.leaveEmptyToKeepValue`. On save `transformModelRegistryValues` deletes
  `spec.credentials` when it is empty and untouched; refine PATCHes the whole form value (including
  `id` and the loaded `status`). An untouched edit therefore sends `spec = {type, url}`.
- Delete: soft delete (PATCH with `metadata.deletion_timestamp`, plus annotation
  `neutree.ai/force-delete` when the force checkbox is ticked) through the shared delete provider.
  Backend order: `builtinModelRegistryGuard` first (10132 for a built-in), then
  `validateModelRegistryDeletion`: 400 code 10128 while an endpoint in the workspace has
  `spec.model.registry` equal to the name (the SQL trigger of `035` was dropped in
  `044_drop_sql_deletion_validation`). The force annotation is not read by either, so force delete
  does not bypass them. No UI handling of 10128 / 10132.
- YAML import/export: kind `ModelRegistry` <-> `model_registries`; in `EXPORTABLE_RESOURCES` and in
  `CREDENTIAL_RESOURCES` (`foundation/hooks/use-yaml-export.ts`).
- Quick start (`foundation/hooks/use-quick-start.ts`, `buildModelRegistryValues`) creates
  `public-hugging-face` (`hugging-face`, `https://huggingface.co`, `credentials: ""`).

## Descriptions

- `metadata.name`: label `common.fields.name`, placeholder `model_registries.placeholders.registryName`,
  disabled on edit. No client rule (a blank name is rejected by the server).
- `metadata.workspace`: required and `isValidWorkspace` (`common.validation.workspaceRequired`),
  disabled on edit.
- `spec.type`: label `common.fields.type`, options `modelRegistryTypeOptions` (the three kinds the
  server defines), placeholder `model_registries.placeholders.selectType`.
- `spec.url`: label `model_registries.fields.url`; required
  (`model_registries.validation.urlRequired`); when type is `bentoml` it must start with `nfs://`
  after trimming (`model_registries.validation.mustUseNfsProtocol`); placeholder per type
  (`modelRegistryUrlPlaceholder`), none for an unknown type.
- `spec.credentials`: label `model_registries.fields.credentials`, placeholder
  `model_registries.placeholders.credentials`; help `model_registries.descriptions.credentials` on
  create, `common.messages.leaveEmptyToKeepValue` on edit.

## Overrides

- Credentials omitted on edit when empty and untouched (`transformModelRegistryValues`): the API
  never returns them, so an empty field means "unchanged". Commit "preserve dirty empty sensitive
  fields" (#276) added the touched check so a field the user typed into and emptied is sent as `""`.
  Server side, an absent `spec.credentials` is backfilled; see Known deviations 1 for the `""` case.
- NFS-only rule for `bentoml` URLs (`use-model-registry-form.tsx` comment: only `nfs://` mounts can
  be reached from every node). Narrower than the backend, which also accepts `file://`.
- Default type `bentoml`: public hubs are provisioned and a hand-made one is read-only, so the form
  starts on the only kind a user can push to (`DEFAULT_MODEL_REGISTRY_TYPE` comment).
- Capability decisions follow server-stated `visibility` and annotations, never `spec.type`
  (`ModelRegistryType.tsx`, `model-registry-visibility.ts` comments). Departs from other kinds that
  branch on type.
- Edit / delete withheld on provisioned registries instead of shown and refused
  (`ModelRegistryWriteActions` comment).
- Hugging Face icon is fetched from huggingface.co; the other icons are local because installs can
  be air-gapped (`ModelRegistryType.tsx` comment; "Hugging Face predates that reasoning").
- Status chip colors are defined in `ModelRegistryStatus` rather than a shared role (reason unknown).
- Show page reads the workspace from the route, not the record (nullable field; comment in
  `show.tsx`).

## Error mapping

No code-specific mapping. Create/edit/delete failures go through the data provider `handleError`
(`message: hint`) and the notification provider as an error toast. Codes the form can hit: name
validation (`validate_metadata_name`), 10035 (url blank), 10119 / 10120 (whitespace), 10128 (delete
blocked by endpoints), 10132 (built-in refused), 10331 (PATCH writing `spec` must match exactly one
row), 403 `insufficient permissions` from the guard (credentials of a built-in registry). None is
attached to a field. The connection check shows its own toasts in `RegistryAvailabilityNotice`.

## Known deviations

1. Clearing credentials on edit is sent but has no effect.
   - UI: typing into `spec.credentials` and emptying it marks the field touched, so
     `transformModelRegistryValues` keeps `credentials: ""` in the PATCH (pinned by
     `use-model-registry-form.test.tsx` "typed into and then emptied" and
     `transform-model-registry-values.test.ts` "keeps credentials cleared on purpose on edit").
   - API: `handlePatchWithBackfill` sees `spec` in the body (`writesMaskedColumn`), fetches the stored
     row (`fetchCurrentResource`, filters from the query string, exactly one row) and calls
     `mergeExcludedFields`; for excluded path `spec.credentials` it overwrites the target when the key
     is missing or `isEmptyValue` (the empty string counts). The stored token is written back.
   - Effect: there is no way to remove a stored credential through the UI; the save succeeds and
     the token stays. Ticket: TBD
2. Batch delete offers provisioned registries that per-row delete hides.
   - UI: `list.tsx` sets `enableBatchDelete`; `Table` sets `enableRowSelection: enableBatchDelete`
     (not per row); `ModelRegistryWriteActions` hides row actions via `registryIsProvisioned`.
   - API: `builtinModelRegistryGuard` refuses a soft delete of a built-in registry with 10132.
   - Effect: selecting a provisioned registry and batch-deleting it ends in an error toast, the
     outcome `ModelRegistryWriteActions` documents it avoids. (Partial-failure presentation of
     `BatchDeleteBar` not traced.) Ticket: TBD
3. UI refuses `file://` addresses for a file system registry that the API accepts.
   - UI: `useModelRegistryForm` `spec.url` `validate` requires `isNfsProtocol` when
     `spec.type === "bentoml"`.
   - API: `newFileBased` (`internal/model_registry/file_based.go`) handles schemes `file` and `nfs`;
     the `ModelRegistrySpec.Url` doc lists both forms.
   - Effect: a `bentoml` registry created via API or YAML with `file://...` cannot be re-saved from
     the edit form unless its URL is changed to `nfs://`. Ticket: TBD

## Notes not classed as deviations

- Untouched edit: payload `spec = {type, url}` has no `credentials`; `mergeExcludedFields` recurses
  into `spec` (a map in both body and stored row) and backfills the missing excluded key, so the
  stored token survives. Because the secret is one flat string, the partial-object loss seen for
  `ImageRegistry.spec.authconfig` cannot occur here.
- `metadata` is resent whole on edit; `builtinAnnotationChanged` comment says this is intended (an
  unchanged marker passes).
- Whitespace-padded URL: `isNfsProtocol` trims, so ` nfs://x` passes the client and the server
  returns 10119. A whitespace-only URL is a non-empty string for the client `required` rule and the
  server returns 10035 (react-hook-form `required` behavior assumed, not tested here).
- Edit echoes the loaded `id` and `status` (including `stats`, `last_checked_at`) in the PATCH. The
  backend comment on `ModelRegistryStatus.Stats` says every writer of the status composite must
  carry stats forward; the effect of the UI writing back a stale snapshot was not traced.
- Provisioned registries: the edit route is reachable by URL; the form would let a user change type
  or URL, which the guard then refuses (10132).
