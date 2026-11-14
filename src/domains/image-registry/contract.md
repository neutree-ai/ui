# Image Registry contract

Backend: Go `v1.ImageRegistry` (`api/v1/image_registry_types.go`), table `api.image_registries`
(composite types `api.image_registry_spec`, `api.image_registry_status`), served through the
resource proxy `/api/v1/image_registries` (`internal/routes/proxies/image_registry_proxy.go`,
`CreateStructProxyHandler`). Reconciled by `controllers/image_registry_controller.go`.
No RPCs. Permissions: `image_registry:read|create|update|delete` (RLS policies in
`003_resources`, `022_soft_delete_permission`), `image_registry:read-credentials`
(`037_sensitive_field_permission`; used by the credentials route, not by this UI's pages).
Refine resource `image_registries`: workspaced, `idColumnName: "metadata->name"`.

## Type

| path | type | required | default | owner | secret | editable after create | backend rule |
|---|---|---|---|---|---|---|---|
| `metadata.name` | string | yes | `""` | user | no | no (input disabled) | `validate_metadata_name` 10001 / 10003 (`^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`) / 10004 (>63); `validate_image_registry_no_whitespace` 10118 |
| `metadata.workspace` | string | yes | current workspace if valid, else `""` | user | no | no (field disabled) | `validate_metadata_workspace` |
| `metadata.creation_timestamp` | timestamp | - | - | server | no | no | - |
| `spec.url` | string | yes | `""` | user | no | yes | `validate_image_registry_url` 10012 (blank); 10116 (leading/trailing whitespace); proxy `validateImageRegistryURL` on POST and PATCH: `util.GetImageRegistryHost` must parse (400 `invalid image registry url`) |
| `spec.repository` | string | no | `""` | user | no | yes | 10117 (leading/trailing whitespace). The "repository required" trigger (10013) was dropped in `030_support_empty_repo` |
| `spec.authconfig.username` | string | no | `""` | user | yes | yes | none |
| `spec.authconfig.password` | string | no | `""` | user | yes | yes | none |
| `spec.authconfig.auth` | string (base64 `user:pass`) | no | not in form | user | yes | no UI | Go `GetImageRegistryAuthInfo` decodes it; UI type declares it, no form field |
| `spec.authconfig.identitytoken`, `.registrytoken` | string | no | - | user | yes | no UI | present in Go `ImageRegistryAuthConfig`, absent from UI type |
| `status.phase` | `Pending` / `Connected` / `Failed` / `Deleted` | - | - | server | no | no | controller `sync`: reachable and pull permission -> Connected, else Failed |
| `status.error_message`, `status.last_transition_time` | string | - | - | server | no | no | controller `updateStatus` |
| `status.capabilities.list_repositories` | `harbor-projects` / `namespace-required` / `unauthorized` / `unsupported` | - | - | server | no | no | `094_image_registry_capabilities`; consumed by `foundation/lib/api/image-registry-content.ts`, not by this domain's types |

`spec.authconfig` is tagged `api:"-"`: the proxy removes the whole object from every response
(`filterObject` with excluded path `spec.authconfig`), including list, show and write
representations. The UI therefore never holds stored credentials. `spec.ca` was removed from the
backend (`041_remove_image_registry_ca`).

## Roles

- Status tone: `ImageRegistryStatus` maps the four phases to local class strings (positive,
  serious, notice, neutral tokens) and renders `foundation/components/BaseStatus`; label key
  `status.phases.registry.<phase>`. A missing phase renders `EmptyValue`.
- Time: `Timestamp` (relative) in the list, `MetadataTimestampMeta` in the show header.
- Name / workspace / created / actions columns: `useMetadataColumns`.
- Secret input: `spec.authconfig.password` is `<Input type="password">`; username is a plain
  input but follows the same keep-existing rule.
- Display of `spec.url` + `spec.repository` (show page): inline in `pages/image-registries/show.tsx` (trims trailing / of URL and leading / of repository).

## Scenes

- List (`pages/image-registries/list.tsx`): columns name (link to show), workspace (hideable),
  status (hideable), created (sortable, hideable), actions. Sorting and filters on, search on
  `metadata->>name`, `defaultSorters`, batch delete on. Row actions: edit, delete.
- Show (`show.tsx`): header with name, status, timestamps; one "Configuration" section with a
  single row `image_registries.fields.repo` = the joined URL and repository. Credentials are not
  shown (the API does not return them). Not-found text when the record is missing.
- Create (`create.tsx` + `hooks/use-image-registry-form.tsx`): sections Basic information
  (name, workspace), Image registry (url, repository), Authentication (username, password).
  `mode: "all"`, warn on unsaved changes. Payload: the form values with
  `api_version: "v1"`, `kind: "ImageRegistry"`, `authconfig: {username: "", password: ""}` when
  untouched.
- Edit (`edit.tsx`): same form. Name and workspace disabled. Prefilled from the API record, which
  has no `authconfig`, so username and password are empty with the hint
  `common.messages.leaveEmptyToKeepValue`. On save, `transformImageRegistryValues` deletes
  `username` / `password` when they are empty and untouched; refine sends the form values (the
  whole loaded record including `id` and `status`) as a PATCH. An untouched edit carries no
  `authconfig` key.
- Delete: soft delete (PATCH `metadata.deletion_timestamp`, plus annotation
  `neutree.ai/force-delete` when the force checkbox is ticked), via the shared delete provider and
  `DeleteConfirmDialog`. Backend pre-check `validateImageRegistryDeletion`: refuses (400, code
  10127) while any cluster in the workspace has `spec.image_registry` equal to the name. The
  middleware does not look at the force annotation, so force delete does not bypass it. The UI has
  no 10127-specific handling.
- YAML import/export: kind `ImageRegistry` <-> `image_registries`; export includes the resource in
  the credentials-capable set (`CREDENTIAL_RESOURCES` in `foundation/hooks/use-yaml-export.ts`).
- Quick start (`foundation/hooks/use-quick-start.ts`, `buildImageRegistryValues`) creates
  `public-docker` at `https://docker.io` with empty credentials.

## Descriptions

- `metadata.name`: label `common.fields.name`, required (`image_registries.validation.nameRequired`),
  placeholder `image_registries.placeholders.registryName`, disabled on edit.
- `metadata.workspace`: required, must satisfy `isValidWorkspace`
  (`common.validation.workspaceRequired`), disabled on edit.
- `spec.url`: required (`image_registries.validation.urlRequired`), placeholder
  `image_registries.placeholders.dockerUrl`.
- `spec.repository`: label only, no validation, no help.
- `spec.authconfig.username` / `.password`: labels, edit-only hint "leave empty to keep".
- Unused locale keys: `image_registries.fields.certificateAuthority`, `.base64Auth`,
  `.descriptions.*` (leftovers of removed fields).

## Overrides

- Credentials omitted on edit when empty and untouched (`transformImageRegistryValues`): the API
  never returns them, so an empty field means "unchanged"; the server fills the masked column back
  (see Known deviations for the partial case). Reason: commit "preserve dirty empty sensitive
  fields" (#276) added the touched check so a field the user typed into and emptied is sent as
  `""`.
- Status chip colors are defined in `ImageRegistryStatus` rather than a shared status role
  (reason unknown).
- Show page joins URL and repository, trimming a trailing `/` on the URL and a leading `/` on the
  repository, and ignores a blank repository (reason unknown; other pages in the repo display
  `spec.url` unchanged).

## Error mapping

No code-specific mapping for this kind. Create/edit/delete failures go through the data provider
`handleError` (`message: hint`) and the Refine notification provider as an error toast. Codes the
form can hit: 10001/10003/10004 (name), 10012 (url blank), 10116/10117/10118 (whitespace), 10127
(delete blocked by clusters), proxy 400 `invalid image registry url`, 10331 (PATCH that writes
`spec` must match exactly one row). None is attached to a field.

## Known deviations

1. Partial credentials on edit wipe the other credential.
   - UI: `transformImageRegistryValues` keeps whichever of `username` / `password` is non-empty
     or touched and deletes the other; each field says "leave empty to keep existing value".
     Pinned by `use-image-registry-form.test.tsx` ("sends the username alone ...", "typed into and
     then emptied").
   - API: PATCH body `spec.authconfig = {"username":"bob"}`; `mergeExcludedFields`
     (`resource_proxy.go`) backfills the masked `spec.authconfig` only when the target value is
     missing or `isEmptyValue` (nil, empty string, empty map). A one-key map is not empty, so the
     stored password is replaced, not preserved. No DB trigger touches `authconfig`.
   - Effect: filling only the username (or only the password) on edit silently removes the other
     stored credential, and the registry then fails to connect. Ticket: TBD
2. Quick start sends `spec.ca` and `spec.authconfig.auth`.
   - UI: `buildImageRegistryValues` includes `ca: ""`.
   - API: `ca` was dropped from `api.image_registry_spec` (`041_remove_image_registry_ca`) and is
     not in `ImageRegistrySpec`. Effect: none visible if PostgREST ignores unknown composite keys
     (not verified). Ticket: TBD

## Notes not classed as deviations

- Whitespace-only `url` passes the client `required` rule; the server rejects it (10012). No
  client trimming, so leading/trailing spaces in url, repository or name come back as 10116 /
  10117 / 10118 toasts.
- Edit echoes the loaded `id` and `status` back in the PATCH (the proxy keeps those top-level
  fields). Cross-kind behavior of the shared edit flow.
