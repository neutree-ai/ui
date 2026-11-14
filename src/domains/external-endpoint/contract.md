# External Endpoint contract

Backend: Go `v1.ExternalEndpoint` (`api/v1/external_endpoint_types.go`), table `api.external_endpoints` (composite types
`api.external_endpoint_spec`, `..._upstream_entry`, `..._auth_spec`, `..._status`, `..._model_route[_target]`, from
`053_external_endpoint`, `080_external_endpoint_upstream_status`, `095_external_endpoint_model_routes`,
`098_model_source_label`), served through the resource proxy `/api/v1/external_endpoints`
(`internal/routes/proxies/external_endpoint_proxy.go`, `RegisterExternalEndpointRoutes`: GET, POST and PATCH only;
`CreateStructProxyHandler[v1.ExternalEndpoint]` plus `validateExternalEndpoint` in front of POST and PATCH). Extra route used
by the UI: `POST /external_endpoints/test_connectivity` (`handleTestConnectivity`). Reconciled by the external endpoint
controller and the Kong gateway sync (`Kong.SyncExternalEndpoint`). No RPCs. Permissions: `external_endpoint:read|create|
update|delete` (RLS in `053_external_endpoint`, `057_workspace_user_external_endpoint_permissions`),
`external_endpoint:read-credentials` (`058`, `059`; only consulted by `backfillAuthCredential` of the connectivity test),
`external_endpoint:trace-read` (`060`). Refine resource `external_endpoints`: workspaced, `idColumnName: "metadata->name"`.

## Type

UI type: `src/domains/external-endpoint/types.ts` (`ExternalEndpoint`, `ExternalEndpointSpec`, `UpstreamSpec`, `ModelRoute`,
`ModelRouteTarget`, `UpstreamStatus`, `ExternalEndpointStatus`).

| path | type | required | default | owner | secret | editable after create | backend rule |
|---|---|---|---|---|---|---|---|
| `metadata.name` | string | yes | `""` | user | no | no (input disabled) | `validateExternalEndpointName` -> `v1.ValidateResourceName`: lowercase `^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$`, at most 63, no surrounding whitespace; 10232. PATCH is judged only when it sends `metadata.name` |
| `metadata.workspace` | string | yes | current workspace if valid, else `""` | user | no | no (field disabled) | `validate_metadata_workspace` |
| `metadata.creation_timestamp` | timestamp | - | - | server | no | no | - |
| `spec.timeout` | int ms, nullable | no | `300000` (form default) | user | no | yes | none; the gateway uses 60000 when nil or <= 0 (`Kong.syncExternalEndpointService`) |
| `spec.route_type` | string | no | `/v1/chat/completions` (form default) | UI-only | no | - | not a field of `ExternalEndpointSpec` nor of `api.external_endpoint_spec`; sent on create, see Known deviations 3 |
| `spec.upstreams[]` | array | yes (may be empty) | `[]` | user | no | yes | `mergekey:"upstream.url,endpoint_ref"` (element identity for the secret backfill); no other rule on the array |
| `spec.upstreams[].name` | string | no in Go, always set by the UI | `provider-N`, unique | user | no | yes | gateway: `compileExternalEndpointModelRoutes` errors on a duplicate name when `model_routes` is set |
| `spec.upstreams[].upstream.url` | string | yes for external | `""` | user | no | yes | none at write time; the gateway resolves it per upstream (failure -> upstream `Failed`) |
| `spec.upstreams[].auth.type` | `bearer` / `api_key` | no | `bearer` (hidden input; `api_key` is not offered) | user | no | no UI | none; `AuthHeaderValue` |
| `spec.upstreams[].auth.credential` | string | no | `""` | user | yes (`api:"-"` on `ExternalEndpointAuthSpec.Credential`) | yes, write-only | none. Never returned, not even by the credentials route (`RegisterCredentialsRoutes` omits external endpoints), so the UI cannot export or reveal it |
| `spec.upstreams[].endpoint_ref` | string | yes for the internal kind | absent | user | no | yes | `Kind()` is `endpoint_ref` when the pointer is non-nil |
| `spec.upstreams[].model_mapping` | `Record<string,string>` | yes in Go (`json:"model_mapping"`) | `{}` | user (legacy) | no | UI always writes `{}` | superseded by `model_routes` when that is non-empty |
| `spec.upstreams[].models` | string[] / null | - | `null` | UI-only | no | - | not in `ExternalEndpointUpstreamEntry`; sent from `emptyExternalUpstream` (create), see Known deviations 3 |
| `spec.model_routes[]` | array | no | one blank fixed route on create, absent on edit | user | no | yes | `compileExternalEndpointModelRoutes` (gateway, not at write time): model non-empty and unique, >= 1 target, `max_attempts >= 0`, target upstream known, `upstream_model` non-empty, no negative priority / weight / `max_inflight_requests` |
| `spec.model_routes[].model` | string | yes | `""` | user | no | yes | see above |
| `spec.model_routes[].strategy` | `fixed` / `priority` / `weighted` | no | `fixed` | user | no | locked once `priority` / `weighted` (`strategyLocked`) | Go: "optional UI presentation hint"; behavior follows priority and weight |
| `spec.model_routes[].targets[].{upstream,upstream_model}` | string | yes | `""` | user | no | yes | see above |
| `spec.model_routes[].targets[].priority` | int >= 0 | no | `0` (`1` for standby tier) | user | no | yes | gateway negative check; UI exposes two tiers only |
| `spec.model_routes[].targets[].weight` | int | no | `1` (non-weighted), 1-100 summing to 100 (weighted) | user | no | yes | Go: 0 means 1 (`compileExternalEndpointModelRoutes`); the 100-sum rule is UI-only |
| `spec.model_routes[].targets[].max_inflight_requests` | int | no | - | user | no | yes | gateway negative check; required 1..2147483647 for primary targets of `priority` routes only in the UI |
| `spec.model_routes[].{retryable_conditions,max_attempts}` | string[] / int | no | - | user | no | no UI | declared in the UI type, no form field; round-trips untouched through the form values |
| `spec.model_sources` | `Record<model,string>` | no | absent | user | no | yes | trigger `validate_external_endpoint_model_source` (`098`, relaxed by `101`): must be an object (10241), values strings (10242); keys not served by the endpoint are pruned on every write |
| `status.phase` | `Pending` / `Running` / `Degraded` / `Failed` / `Deleted` | - | - | server | no | no | controller |
| `status.service_url`, `status.error_message`, `status.last_transition_time` | string | - | - | server | no | no | controller |
| `status.upstream_status[]` | `{kind, ref, models, phase: Ready|Failed, error_message}` | - | - | server | no | no | `externalEndpointUpstreamStatuses`: one entry per spec upstream, in spec order; `ref` is `SanitizeUpstreamURL` of the URL (no userinfo, query, fragment) or the endpoint name |

`spec.upstreams[].auth.credential` is tagged `api:"-"`: `filterObject` removes it from every response, so the form never
holds a stored credential. The array carries `mergekey`, so the PATCH backfill pairs elements by identity, not index (see
Known deviations 1 and 2).

## Roles

- Status tone: `ExternalEndpointStatus` over `BaseStatus`, label `status.phases.externalEndpoint.<phase>`. Tones come from
  shared `STATUS_TONE` (`foundation/lib/status-tone.ts`): Running positive, Failed serious, Degraded and Pending notice
  (Degraded still serves), Deleted neutral. List renders it unconditionally; the show header omits the chip when there is no
  phase. An absent phase renders `EmptyValue` (`BaseStatus`); an unknown phase renders with no tone class.
- Upstream status: `UpstreamStatusBadge` (Ready positive, Failed serious, `STATUS_TONE`), label
  `status.phases.externalEndpointUpstream.<phase>`, error message as the chip tooltip; renders nothing without a phase.
  `matchUpstreamStatuses` pairs statuses to spec upstreams by position and drops one whose `ref` does not match the
  upstream (raw URL or textual sanitise, mirroring `SanitizeUpstreamURL`).
- Serving: `isServingPhase` (Running or Degraded) gates the curl example on the show page.
- Secret input: `auth.credential` is `<Input type="password">`, edit hint `common.messages.leaveEmptyToKeepValue`; dropped from
  the edit payload while empty and untouched through shared `omitEmptyUntouched` (`foundation/lib/touched-fields.ts`), see
  Foundation contract "Masked fields".
- Time: `metadataColumns.creation_timestamp` (list), `MetadataTimestampMeta` (show header).
- Name / workspace / actions columns: `useMetadataColumns`.
- Empty marker: `EmptyValue` for no endpoint type, no models, a non-positive or missing timeout, an upstream without URL.
- Timeout display: `formatTimeout` (whole minutes as `Nmin`, otherwise `Ns`); input `TimeoutInput` converts s / min to ms.
- Model source: shared `ModelSourceBadge`, `resolveExternalModelSource`, `modelSourceSuggestions` (`foundation/lib/model-source`).
- Upstream kind: `getEndpointType` (external / endpoint_ref / mixed) for the list column and show header,
  `deriveUpstreamType` for the form (uses `endpoint_ref != null`, whereas `getEndpointType` and the show page use truthiness).

## Scenes

- List (`pages/external-endpoints/list.tsx`): columns name (link), workspace, status, upstream type (outline badge), models
  (code chips, each with `ModelSourceBadge hideUnspecified`; model list from `getExposedModels`: route models, else legacy
  `model_mapping` keys), created (sortable), actions. Sorting and filters on, search on `metadata->>name`, `defaultSorters`,
  batch delete on.
- Show (`pages/external-endpoints/show.tsx`): tabs overview and monitor (`?tab=monitor`, `?model=` focuses a model). Header:
  name, status chip, type, model count, timeout, service URL (`EndpointAccessSummary`), timestamps. Overview: virtual
  model routes (`ModelRouteDetails`, falling back to `routesFromLegacy` for specs without `model_routes`), model services
  (one block per upstream with its status badge, `FailedUpstreamAlert` when Failed, URL or endpoint name, mapping table from
  `getUpstreamModelMappings`), `CurlExample` when serving and a service URL exists (models minus `getUnavailableModels`).
  No polling. Credentials are never shown.
- Create (`create.tsx` + `hooks/use-external-endpoint-form.tsx`): `mode: "all"`; sections basic information, configuration
  (timeout), virtual models (`ModelRouteEditor`), model services (upstream blocks). Starts with one blank fixed route and no
  upstream. Upstreams are named `provider-N`; the upstream type select switches an entry between external and endpoint_ref,
  resetting the other kind's fields. Payload: `onFinish` adapter, see below.
- Edit (`edit.tsx`): same form. Locked: name, workspace. Prefilled from the API record through `select`: routes get
  `strategyLocked` for priority / weighted, priority routes show two tiers (lowest priority = primary, others = standby);
  credentials start empty with the "leave empty to keep" hint. `cacheTime: 0` so the field array always starts from fresh data.
  Legacy specs (no `model_routes`) are migrated in the form by `routesFromLegacy`; unnamed upstreams get `provider-N`.
  `?model=` deep-links a route.
- Submit adapter (`onFinish` override in `useExternalEndpointForm`), in order: `cleanUpstreamsForSubmit` (drop `upstream` and
  `auth` from endpoint_ref entries, drop `endpoint_ref` from external ones, drop an empty untouched credential on edit);
  reject blank or duplicate upstream names (`duplicateProvider`) and any route-level problem (`getRouteStrategyError` returns
  silently, others set a `spec.model_routes` form error); trim upstream names; set every `model_mapping` to `{}`; default
  `strategy` to `fixed`, `priority` to 0, `weight` to 1 for non-weighted routes; rewrite target upstream names to the trimmed
  ones; drop `strategyLocked`. The whole record (including `id`, `status`, `route_type`) is the PATCH body.
- Connectivity test (`TestConnectivityButton`, `useTestConnectivity`): external entries post `{upstream:{url}, auth:{type:
  "bearer", credential}}`, on edit also `name`, `workspace`, `stored_upstream_url` (the URL as first loaded, kept per row by
  stable field id) so the server can backfill the stored credential for the original URL; endpoint_ref entries post
  `{endpoint_ref, workspace}` and load the model list.
- Delete: soft delete (PATCH `metadata.deletion_timestamp`, plus annotation `neutree.ai/force-delete` when the force box is
  ticked) through the shared delete provider and `DeleteConfirmDialog`. No pre-check for external endpoints was found in
  `validateExternalEndpoint` (it only checks the name and lets soft deletes through).
- YAML: kind `ExternalEndpoint` <-> `external_endpoints`; export is in `EXPORTABLE_RESOURCES` but not in `CREDENTIAL_RESOURCES`,
  and the credentials route does not serve external endpoints, so an exported YAML carries no credentials.

## Descriptions

- `metadata.name`: label `common.fields.name`, placeholder `external_endpoints.placeholders.endpointName`; only rule
  `required` (`validation.nameRequired`).
- `metadata.workspace`: required and `isValidWorkspace`.
- `spec.timeout`: `TimeoutInput`, `NumberInput` min 0, unit select s / min (unit is component state, starts at seconds).
- `spec.upstreams[].name`: `UpstreamNameLabel`; uniqueness checked at submit only.
- `spec.upstreams[].upstream.url`: required (`validation.upstreamUrlRequired`), placeholder `placeholders.upstreamUrl`.
- `spec.upstreams[].auth.credential`: label, placeholder, edit hint.
- `spec.upstreams[].endpoint_ref`: `EndpointRefSelect` over `useSelect("endpoints")`, running instances first.
- Routes: strategy rules in `getRouteStrategyError` (weight integer 1-100 summing to 100; priority needs a primary target
  with an integer `max_inflight_requests` 1..2147483647), shared by inline feedback, `submitBlocked` and the submit guard;
  `changeRouteStrategy` warns when switching drops configuration. Model name, target upstream and upstream model required and
  model names unique (submit adapter).
- Model source: free text with suggestions (presets plus values used by sibling endpoints, counted only for models they still
  serve); a blank value deletes the entry.

## Overrides

- Credential omitted on edit when empty and untouched (`cleanUpstreamsForSubmit`, shared `omitEmptyUntouched`): the API never
  returns it. The touched path is indexed per upstream (`spec.upstreams.<i>.auth.credential`).
- Model routes supersede `model_mapping`: the form always writes `model_mapping: {}` and migrates legacy mappings into routes
  (`routesFromLegacy`), matching the gateway's precedence. Reason from the code: model-scoped routing (`095`).
- `priority` routes collapse to two tiers on load and save (`select` in `useExternalEndpointForm`, Known deviations 5): the UI exposes primary and
  standby only; original priorities above 1 are not preserved (pinned by "shows priority tiers and saves them").
- `strategyLocked` routes cannot change strategy in the editor: the strategy is only a presentation hint in the API; reason
  unknown beyond avoiding silent loss of configuration.
- Default timeout 300000 ms where the gateway defaults to 60000 (commit "raise default timeout (#523)"): long LLM calls.
- `deriveUpstreamType` (`!= null`) vs `getEndpointType` / show (`!!`): an `endpoint_ref: ""` entry is internal in the form and
  external in the list; reason unknown.
- Not shared with the other statuses: the phase-to-tone mapping and the `Degraded` tone are this kind's own.

## Error mapping

No field mapping. Create / edit / delete failures go through the data provider `handleError` and the Refine notification
provider as a toast. Form-level errors set by the submit adapter on `spec.model_routes`: `duplicateProvider`,
`routeTargetRequired`, `virtualModelRequired`. Connectivity test results are shown inline on the button (`error` from the
response, or `getErrorMessage`). Codes the form can hit without a mapping: 10232 (name rule, UI only requires non-empty),
10231 (malformed payload), 10240-10242 (model sources; 10240 no longer raised after `101`), 10331 (PATCH writing `spec` must
match one row), `compileExternalEndpointModelRoutes` messages surface only as status errors, not at save.

## Known deviations

1. Changing an upstream URL while leaving the credential empty drops the stored credential.
   - UI: on edit the credential field shows `common.messages.leaveEmptyToKeepValue` and `cleanUpstreamsForSubmit` sends the
     entry as `{upstream:{url:<new>}, auth:{type}}` with no credential (pinned by "sends no credential for an upstream whose
     URL was changed"). The connectivity test, by contrast, sends `stored_upstream_url` so the server can still find the old
     credential (`use-external-endpoint-form.tsx`, `field.storedUrl`).
   - API: `ExternalEndpointSpec.Upstreams` carries `mergekey:"upstream.url,endpoint_ref"`; `mergeArrayByIdentity` /
     `elementIdentity` (`resource_proxy.go`) pair the PATCH element with the stored one by the identity in the request body,
     so a new URL matches nothing and `mergeExcludedFieldsRecursive` backfills nothing; the `spec` column is then replaced
     with an entry without credential.
   - Effect: after saving, the upstream authenticates with no credential until the user types it again; no warning. Traced
     from the code, not run against a server. Ticket: TBD
2. A touched-then-emptied credential cannot clear the stored one.
   - UI: `omitEmptyUntouched` keeps a touched empty `auth.credential` and sends `""` (pinned by "sends a credential typed
     into and then emptied as an empty string").
   - API: `mergeExcludedFieldsRecursive` treats `""` as `isEmptyValue` and backfills the stored credential when the identity
     (URL) matches.
   - Effect: save succeeds, credential unchanged. Same mechanism as Foundation "Masked fields" item 2. Ticket: TBD
3. UI-only keys are sent on the wire and have no API counterpart.
   - UI: the form default `spec.route_type` and `emptyExternalUpstream.models: null` (and every record carries them back on
     PATCH).
   - API: neither `ExternalEndpointSpec` nor `ExternalEndpointUpstreamEntry` (nor the composite types of `053`, `095`, `098`)
     has them; only `kong.go` uses a `route_type` of an internal endpoint.
   - Effect: none visible; assumed ignored by the composite conversion (not verified against PostgREST). Ticket: TBD
4. Name rule is not mirrored.
   - UI: only `required` on `metadata.name`.
   - API: `validateExternalEndpointName` rejects uppercase, spaces, non-ASCII, leading / trailing separators, over 63 (10232).
   - Effect: the failure arrives as a generic toast after submit. Ticket: TBD
5. An untouched edit rewrites target priorities of a `priority` route.
   - UI: `select` in `useExternalEndpointForm` maps priorities to two tiers (lowest = 0, every other = 1) on load, and the
     form saves them as shown (pinned by "shows priority tiers and saves them without reordering targets": 20 / 10 / 10
     becomes 1 / 0 / 0, `loads $strategy priorities`: 1 / 2 / 3 becomes 0 / 1 / 1).
   - API: `ExternalEndpointModelRouteTarget.Priority` is any non-negative int, passed through
     `compileExternalEndpointModelRoutes` to the gateway plugin (how the plugin orders three distinct priorities was not
     read).
   - Effect: a route stored with three or more distinct priorities silently changes shape on the next save, even when the user
     touched nothing. Ticket: TBD
