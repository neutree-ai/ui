# OEM Config contract

Backend: `v1.OEMConfig`, `OEMConfigSpec` (`api/v1/oem_config_types.go`); `api.oem_configs`,
`api.oem_config_spec` (`009_oem_config`). `RegisterOEMConfigRoutes`
(`internal/routes/proxies/oem_config_proxy.go`) serves GET/POST/PATCH `/api/v1/oem_configs`; no RPC.
Reads are public (`010_oem_config_read_policy`, `011_anonymous_role`); writes require global `system:admin`
(`009_oem_config`). Refine resource `oem_configs` is global, keyed by `metadata->name` (`src/App.tsx`).
Backend: `origin/main@062192f6`. UI paths are relative to `src/pages/oem-config/` unless prefixed.

## Type

UI: `use-oem-config-form.tsx:OemConfigFormData`. There is no status or per-workspace configuration.
No field in `OEMConfig`, `OEMConfigSpec` or `v1.Metadata` has an exclusion tag or a masked secret.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | integer | serial | server | no | no input | primary key |
| `api_version` | string | required; v1 | user | no | no input | NOT NULL text |
| `kind` | string | required; OemConfig | user | no | no input | NOT NULL text; canonical OEMConfig |
| `metadata.name` | string | required; default | user | no | no input | name validator; no fixed-name check |
| `metadata.workspace` | string/null | absent | API user | no | no input | global table; no workspace validator |
| `metadata.display_name` | string/null | absent | API user | no | no input | `Metadata.DisplayName` |
| `metadata.labels`, `.annotations` | string maps/null | absent | API user | no | no input | `v1.Metadata` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | current time | server | no | no input | timestamp triggers in 019 |
| `metadata.deletion_timestamp` | timestamp/null | absent | API user | no | no input | metadata attribute only |
| `spec` | object/null | nullable; three blank fields | user | no | fields below | SQL composite |
| `spec.brand_name` | string/null | optional; empty string | user | no | yes | nullable text; no content check |
| `spec.logo_base64` | string/null | optional; empty string | user | no | yes | nullable text; no image check |
| `spec.logo_collapsed_base64` | string/null | optional; empty string | user | no | yes | nullable text; no image check |

`api.validate_metadata_name` (`004_required_fields`) rejects empty/null names (10001), invalid lowercase
DNS-style names allowing dots (10003), and names longer than 63 characters (10004).
Timestamp functions in `019_annotations` retain supplied metadata. `RegisterOEMConfigRoutes` and OEM migrations
add no brand-name length, MIME, image-size, base64 or URL check.
`089_oem_config_remove_custom_css` removes custom_css; no CSS field is used here.

## Roles

- Brand reads: `src/foundation/oem-config/use-oem-config.ts:useOemConfig`; fallback behavior is pinned in its tests.
  Nullish brand uses `VITE_BRAND_NAME`, then Neutree. An empty string remains blank; whitespace is preserved.
- Image reads: `src/foundation/components/Logo.tsx:Logo` uses a truthy collapsed logo only when collapsed,
  otherwise the main logo or `BASE_URL` plus logo.svg. Expanded branding adds the brand text.
- Login title: `src/pages/auth/ThemedTitle.tsx:ThemedTitle` uses the main logo or logo.svg; caller text/icon can
  override branding. The collapsed logo is not used here.
- Favicon: `src/foundation/components/OemFavicon.tsx:OemFavicon`, mounted by `BaseLayout`, uses the main logo or
  `BASE_URL` plus favicon.svg. It updates an existing icon link only; it does not create one or change its type.

## Scenes

- Entry (`src/App.tsx`, `show.tsx:OemConfigShow`): `/oem-configs` mounts one settings form, without a table,
  search, sort, filters, batch actions or separate create/edit routes.
- Read (`useOemConfig`): list `oem_configs` with `metadata->>name` equal to default; first result is the config.
  No workspace filter, explicit sorter or polling interval. Loading hides the form.
- Create (`useOemConfigForm`): selected when the list has no record; default headers/name are in Type.
  Mode is all; unsaved-change warning is enabled; Cancel is hidden.
- Edit: selected when the list returns a record; Refine loads id default. The same three fields remain editable.
  There is no select adapter, submit transform, trimming or custom navigation.
- Edit PATCH mechanics: `src/foundation/contract.md`, “Edit PATCH”.
- Delete: no UI. `RegisterOEMConfigRoutes` has no DELETE handler or deletion pre-check, and OEM has no controller.
  A deletion timestamp does not remove the singleton row or free the unique index.
- YAML mechanics: `src/foundation/contract.md`, “YAML import and export”; OEM is not an export option.

## Asset writes and reopen

`useOemConfigForm.handleFileUpload` reads the first selected file with `FileReader.readAsDataURL`.
Its complete result, including the data URL prefix, becomes the chosen spec field and marks the form dirty.
There is no multipart request, asset endpoint or separate favicon payload.
Both inputs accept image/* without validation. Read errors have no handler.
`handleFileClear` writes an empty string and marks dirty.
Selection and clearing stay local until Save; selecting no file leaves the previous field unchanged.

Blank create submits exactly `{api_version:"v1",kind:"OemConfig",metadata:{name:"default"},
spec:{brand_name:"",logo_base64:"",logo_collapsed_base64:""}}`.
Untouched edit of those fields sends their loaded values, including the loaded kind spelling.
Replacing a main asset sends `spec.logo_base64:"data:image/png;base64,bG9nbw=="`; collapsed replacement writes
`spec.logo_collapsed_base64` instead. The sibling asset and brand stay unchanged.
Clearing either asset sends that field as `""`; null loaded asset fields remain null on untouched submit.
These are ordinary public text fields, so no secret masking or keep-existing backfill participates.
`RegisterOEMConfigRoutes` and `CreateStructProxyHandler[v1.OEMConfig]` forward their values to the SQL composite.
Tests: `use-oem-config-form.test.tsx`.

## Singleton semantics

`oem_configs_global_unique_idx` (`009_oem_config`) indexes constant TRUE: zero or one row across all names and
workspaces, including a row with a deletion timestamp. It does not require the name default.
The UI has no identity input and always reads/updates default. Clearing all fields saves the row, not a reset/delete.

## Descriptions

Labels use `oem_configs.fields.*`.
Brand placeholder is `oem_configs.placeholders.brandName`; it has no required or format rule.
Main-logo help recommends 64 by 64 and PNG/JPG/SVG; collapsed-logo help promises the main-logo fallback.
Only collapsed logo says optional, but neither logo is required. Preview alternative text is hardcoded English.

## Overrides

- Form code stays in pages because a move removes no code. Shared branding consumers keep `useOemConfig` in foundation.
- Singleton settings use `ResourceForm` directly; reason beyond the single-row schema is unknown.
- Data URLs serve directly as browser image URLs.
- Brand uses nullish fallback while logos use truthiness. Empty brand therefore clears text while empty logos use
  static defaults. Reasons for that difference and the noncanonical kind spelling are unknown.

## Error mapping

Transport toast mechanics: `src/foundation/contract.md`, “Error toast path”. No OEM-specific code or field mapping.
Possible SQL failures include 10001/10003/10004 name, 23505 singleton collision and system:admin policy refusal.
`OemConfigShow`, `Logo`, `ThemedTitle` and `OemFavicon` ignore `useOemConfig` read errors.

## Known deviations

1. Creation stores a noncanonical kind. UI: `use-oem-config-form.tsx:useOemConfigForm` defaults to OemConfig.
   API: `api/v1/register.go:init` registers OEMConfig; `CreateStructProxyHandler` forwards this unmasked resource
   without decoding kind, and `009_oem_config` accepts any non-null text. `pkg/scheme/scheme.go:decoder.Decode`
   calls `Scheme.New` and `gvkToType`, which reject OemConfig with “unregistered type: OemConfig”.
   Users can save branding through REST, but a client decoding that stored kind through the scheme cannot load it.
   `ResolveKind` is case-insensitive, but this decoder does not call it. Ticket: TBD
2. A valid non-default singleton is invisible. UI: `src/foundation/oem-config/use-oem-config.ts:useOemConfig` filters
   default; `useOemConfigForm` creates default when none is returned. API: `api.validate_metadata_name`
   accepts other names and `oem_configs_global_unique_idx` (`009_oem_config`) reserves the sole slot for any row.
   Users see fallback branding and a blank creation form whose save fails with a singleton collision. Ticket: TBD
3. Canonical YAML kind targets the wrong route. UI: `src/foundation/scene/yaml-transform.ts:kindToResourceType`
   maps OEMConfig to o_e_m_configs; `src/foundation/scene/use-yaml-import.ts:importFromYaml` uses that resource.
   API: `RegisterOEMConfigRoutes` serves oem_configs, matching `api/v1/register.go:init`.
   Users importing canonical OEMConfig YAML receive an import failure instead of saving branding. Ticket: TBD
4. Write controls do not require admin rights. UI: `show.tsx:OemConfigShow` always offers the form;
   `src/App.tsx:resources` gives OEM no requiredPermission. API: the create/update policies in
   `009_oem_config` require `api.has_permission` for system:admin.
   Non-admin users can edit the public settings form but cannot persist their changes. Ticket: TBD

## Open points

No live PostgREST, browser cache invalidation or concurrent write was exercised. Reopen tests explicitly reset form
values because the global Refine mock does not hydrate queries. Preservation of unexposed metadata and missing
spec keys through the real Refine hydration path is unverified; no full-record preservation claim is made here.
