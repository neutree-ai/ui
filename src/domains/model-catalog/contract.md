# Model Catalog contract

Backend: `v1.ModelCatalog`, `ModelCatalogSpec`, recipe types (`api/v1/model_catalog_types.go`),
`api.model_catalogs` (`007_model_catalog`, `072_recipe_model_catalog`, `086_model_catalog_spec_required`).
`RegisterModelCatalogRoutes` (`internal/routes/proxies/model_catalog_proxy.go`): GET/POST/PATCH;
`validateModelCatalogRecipe` guards writes. No import endpoint or RPC. Permissions:
`model_catalog:read|create|update|delete` (`007`, `022_soft_delete_permission`, `050_workspace_user_permissions`).
Refine resource `model_catalogs`, workspaced, key `metadata->name` (`src/App.tsx`). Backend `origin/main@062192f6`.
Shared mechanics: `src/foundation/contract.md`.

## Type
UI: `src/domains/model-catalog/types.ts`, shared serving and recipe types. User-owned/editable unless noted.
No fields are masked (`RegisterModelCatalogRoutes`); there is no secret input or secret transform.
Optional spec fields default to absent/null. Editability below describes the UI, not API immutability.

| path | type | required/default | owner/secret/edit exception | backend rule |
|---|---|---|---|---|
| `id`, `api_version`, `kind` | integer, strings | serial; imported headers | server id; locked | primary key; NOT NULL headers (`007`) |
| `metadata.name` | string | required | locked | `validate_metadata_name` 10001/10003/10004; workspace-unique (`007`) |
| `metadata.workspace` | string | document or selected workspace | locked | `validate_metadata_workspace` 10002/10005/10006 |
| `metadata.display_name` | string | optional | ignored in edit | `Metadata.DisplayName`; deviation 1 |
| `metadata.labels`, `.annotations` | string maps | import labels `{}` | unmasked | `Metadata`; editor removes non-string values |
| `metadata.creation_timestamp`, `.update_timestamp`, `.deletion_timestamp` | timestamps | server time | server; locked | timestamp triggers (`019_annotations`); `validate_soft_delete` |
| `spec` | ModelCatalogSpec | model or variants | unmasked | `ValidateModelCatalogSpec`; `validate_model_catalog_spec` 10045 |
| `spec.model` | ModelSpec | ordinary catalog | unmasked | non-nil for ordinary; forbidden with variants |
| `spec.engine` | EndpointEngineSpec | optional | unmasked | no engine lookup at write |
| `spec.resources` | ResourceSpec | ordinary Pending `{}` | unmasked | forbidden with variants |
| `spec.replicas.num` | integer | ordinary Pending 1 | unmasked | `processPendingModelCatalog` |
| `spec.deployment_options`, `.variables` | JSON maps | ordinary Pending `{}` | unmasked | no per-key check |
| `spec.env` | string map | optional | unmasked | `ModelCatalogSpec.Env` |
| `spec.base` | engine_args and env maps | optional | unmasked | `RecipeBase` |
| `spec.variants` | named RecipeVariant map | non-empty for recipe | unmasked | `ValidateModelCatalogSpec` |
| `spec.variants.*.model` | ModelSpec | recipe required | unmasked | non-blank trimmed model name |
| `spec.variants.*.resources`, `.engine_args`, `.env`, `.description`, `.vram_minimum_gb` | resource object, maps, text, integer | optional | unmasked | `RecipeVariant`; no VRAM range check |
| `spec.features[]` | ordered RecipeFeature list | optional | unmasked | unique non-empty name; known non-self conflicts |
| `spec.features[].type`, `.default`, `.engine_args`, `.env` | enum, bool, maps | boolean type; false | unmasked | `validateFeatureShape`; boolean/select/input |
| `spec.features[].options`, `.default_option` | option map, string | select options required | unmasked | non-empty options; known default option |
| `spec.features[].input` | RecipeFeatureInput | input type required | unmasked | `validateFeatureShape`, `validateInputValue` |
| `status.phase` | Pending/Ready/Failed/Deleted | Pending then Ready | server; locked | `ModelCatalogController.sync` |
| `status.error_message`, `.last_transition_time` | text, timestamp | optional | server; locked | `ModelCatalogController.updateStatus` |

`ModelSpec` has registry/name/file/version/task strings and advisory `info`; ordinary catalogs require no child field.
`EndpointEngineSpec` has engine/version; `ResourceSpec` has cpu/gpu/memory strings and accelerator map
(`api/v1/endpoint_types.go`). Features also carry name/group/display_name/description/conflicts_with.
`RecipeFeatureOption` carries description/engine_args/env. `RecipeFeatureInput` carries value_type/default/required,
min/max/pattern/enum/suggestions. Types are string/int/number/bool (default string); min cannot exceed max.
Non-empty defaults undergo enum/type/range/regex checks (`validateInputValue`). Suggestions accept strings or
`{value,label}` (`RecipeFeatureSuggestion.UnmarshalJSON`); labels do not affect values.
Ordinary Pending defaults are skipped for recipes (`processPendingModelCatalog`). Ready does not certify
readiness to deploy: `processReadyModelCatalog` performs no validation or dependency lookup.

## Roles

Paths are relative to `src/domains/model-catalog/` unless prefixed.

- `ModelCatalogStatus`: `BaseStatus` and `STATUS_TONE`; Ready positive, Failed serious, Pending notice,
  Deleted neutral; `status.phases.catalog.<phase>`. Missing uses `EmptyValue`; unknown has no tone.
- Time: `MetadataTimestampMeta`. Engine/model/task: `EndpointEngine`, `EndpointModel`, `ModelTask`.
  Model info: `ModelInfoBadges`, `formatModelInfoNumber`; their tests own formatting.
- Model/image/version selections: `CatalogModelSlots`, `lib/catalog-model-slots.ts`; tests beside both.
  Advanced argument aggregation: `modelCatalogEngineParameters`, tested in `lib/advanced-parameters.test.ts`.
- Recipe detection/composition: shared `isRecipeShape`, `foundation/recipe`; tests beside those helpers.
- YAML transforms: `src/foundation/contract.md`, “YAML import and export”.

## Scenes

- List (`src/pages/model-catalogs/list.tsx:ModelCatalogsList`): cards; no explicit sort, paging or batch actions;
  polls with `LIST_POLL_QUERY_OPTIONS`. Local trimmed/lowercase search checks technical name and top-level model
  name, otherwise the first variant model name. Row actions: show, deploy, edit, delete.
- Card (`ModelCatalogCard`): model prefers named top-level, default variant, then first model; shows task/info,
  engine/status/variant count. Links/delete use record workspace and name; deploy query uses numeric id.
- Show (`ModelCatalogsShow`): selected variant, default, then first; model/resources fall back to top-level.
  Profile arguments/env merge base and active variant; features stay separate. Hardware annotation
  `recipe.vllm.ai/hardware-verified` is comma-split. Shared cards show resources/replicas/deployment settings.
- Create (`ImportDialog`): YAML text, file or browser-fetched URL; missing HTTP scheme gets HTTPS.
  `transformResourceForImport` builds `{api_version,kind,metadata,spec}`; document workspace wins over selection;
  absent labels become `{}`. No spec defaults are added. There is no separate create route.
- Re-import (`runCatalogImport`): read workspace/name; create absent records, else merge metadata under incoming
  metadata and replace spec (`buildCatalogUpdateValues`). Confirm ordinary/recipe type changes before any write.
  Lookup errors fail that document; write failures do not stop later documents; results retain document order.
- Edit (`ModelCatalogsEdit`): export helpers seed full YAML without status/id/timestamps; `parseCatalogSpecYaml`
  accepts a bare spec or matching document. Save sends loaded record with replaced spec and merged editable metadata;
  loaded headers/id/status/timestamps remain. Reopen payloads are pinned in `edit.test.tsx`.
- Delete: `src/foundation/contract.md`, “Soft delete and force”. Card uses simple confirmation without force;
  show uses `ShowPage`. No catalog pre-check in `RegisterModelCatalogRoutes`; `ModelCatalogController.sync`
  marks Deleted then removes next reconcile, or removes Failed directly.
- Generic YAML: `src/foundation/contract.md`, “YAML import and export”. Exportable without credentials;
  dedicated import differs by updating existing names.

## Descriptions

- Import: `parseYamlDocuments` / `isValidYamlResource` require apiVersion/kind/name, skip non-documents and reject
  other kinds. No name-pattern or recipe validation. URL fetching requires browser CORS access.
- Edit: `describeParseError` reports syntax, scalar/list, missing/non-mapping spec, wrong kind and differing
  non-empty name/workspace inline. Bare specs preserve metadata; documents replace labels/annotations,
  absent maps become `{}`, non-string entries disappear. Other metadata edits are ignored.
- Model panel selects workspace registries/models and engine versions; engine name stays fixed in the panel,
  but YAML can change it. Model-independent engines use workload image defaults (`engineNeedsModelSpec`).
- `VariantTable` appends GPU, CPU, GiB and minimum VRAM GB. `KeyConfigCard` highlights engine arguments;
  `FeaturesList` summarizes features. Supplied model names, descriptions and hardware labels are untranslated.

## Overrides

- Cards/import-only creation: list comment cites model summary and deploy entry.
- Whole-document YAML edit: original page comment cites nested recipes and import/export reuse.
- Re-import merges metadata but replaces spec so omitted variants can be removed
  (`buildCatalogUpdateValues` backend constraint comment). Default incoming labels can clear stored labels.
- Edit rejects identity mismatches and limits metadata changes to labels/annotations (original parser comments).
- Ready stays visible, unlike Engine's steady Created; reason unknown.

## Error mapping

No field mapping. Edit disables Refine notifications, toasts `getErrorMessage`, and navigates to show after success.
Import reports per-document messages and aggregate success/partial/failure toasts; duplicate errors use
`isDuplicateNameError` and suggest re-import. Declining type change reports cancellation and writes nothing.
Delete errors: `src/foundation/contract.md`, “Error toast path”.
Codes: 10223 malformed typed payload, 10224 invalid recipe or explicit null spec (`validateModelCatalogRecipe`);
10045 missing model/variants (`validate_model_catalog_spec`, `086`); 10001/10003/10004 name and
10002/10005/10006 workspace (`004_required_fields`); duplicate workspace/name
(`model_catalogs_name_workspace_unique_idx`, `007`). None is attached to a YAML field.

## Known deviations

1. Human display names are ignored by catalog surfaces and edit saves.
   UI: `ModelCatalogCard`, `ModelCatalogsShow`, `ModelCatalogsList` read technical names;
   `parseCatalogSpecYaml` returns only labels/annotations. API: `Metadata.DisplayName`
   (`api/v1/basic_types.go`) survives `update_metadata_update_timestamp_column` (`019_annotations`).
   Users cannot see/search human catalog names or change them through edit YAML. Ticket: TBD
2. Untouched YAML edits remove explicit null map entries.
   UI: `ModelCatalogsEdit` seeds through `serializeToYaml`, whose replacer drops null values;
   `edit.test.tsx` pins omission of `variables.optional: null`. API: `ModelCatalogSpec.Variables` is
   `map[string]any`; `validateModelCatalogRecipe` validates a decoded copy; `CreateStructProxyHandler`
   (`internal/routes/proxies/resource_proxy.go`) forwards the spec without a nested transform.
   Saving an untouched catalog removes explicit null entries from its stored spec. Ticket: TBD
3. Feature summaries omit select/input defaults and option settings.
   UI: `src/pages/model-catalogs/components/FeaturesList.tsx:renderItem` reads boolean `default`, engine_args/env.
   API: `RecipeFeature.DefaultOption`, `RecipeFeature.Input`, `validateFeatureShape`
   (`api/v1/model_catalog_types.go`, `internal/recipe/validate.go`) define separate defaults/settings.
   Users see “opt-in” for select/input features and cannot inspect actual defaults/options on detail. Ticket: TBD
4. Edit help promises delayed failure for invalid recipes.
   UI: `ModelCatalogsEdit` uses `model_catalogs.edit.specHint`, saying invalid recipes become Failed after saving.
   API: `validateModelCatalogRecipe` calls `ValidateModelCatalogSpec` before forwarding and returns 10224
   (`internal/routes/proxies/model_catalog_proxy.go`, `internal/recipe/validate.go`).
   Users instead receive a save error and their invalid changes are not stored. Ticket: TBD

## Open points

No live import/deploy or PostgREST round trip. Null loss is pinned at the UI mutation boundary; its downstream
engine meaning depends on the variable. Legacy empty specs remain writable (`validate_model_catalog_spec`);
null-spec rendering and concurrent status snapshots were not exercised.
