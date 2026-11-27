# External Endpoint contract

Backend: `v1.ExternalEndpoint` (`api/v1/external_endpoint_types.go`), table `api.external_endpoints` (composite types
from `053_external_endpoint`, `080_external_endpoint_upstream_status`, `095_external_endpoint_model_routes`,
`098_model_source_label`), proxy `/api/v1/external_endpoints` (`RegisterExternalEndpointRoutes`: GET, POST, PATCH;
`validateExternalEndpoint` in front of POST and PATCH). Extra: `POST /external_endpoints/test_connectivity`
(`handleTestConnectivity`). No RPCs. Reconciled by the external endpoint controller and `Kong.SyncExternalEndpoint`.
Permissions: `external_endpoint:read|create|update|delete`, `read-credentials` (`058`, `059`; only consulted by
`backfillAuthCredential` of the connectivity test), `trace-read` (`060`). Refine resource `external_endpoints`:
workspaced, `idColumnName: "metadata->name"`. Shared mechanics: `src/foundation/contract.md`.

## Type

UI type: `src/domains/external-endpoint/types.ts`. Owner is user unless noted; "edit" = editable after create.

| path | type | required / default | secret | edit | backend rule |
|---|---|---|---|---|---|
| `metadata.name` | string | yes; `""` | no | no | `validateExternalEndpointName` -> `v1.ValidateResourceName` (`^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$`, <= 63, no surrounding whitespace) 10232; PATCH judged only when it sends `metadata.name` |
| `metadata.workspace` | string | yes; current if valid | no | no | `validate_metadata_workspace` |
| `spec.timeout` | int ms, nullable | no; `300000` (form) | no | yes | none; gateway uses 60000 when nil or <= 0 (`Kong.syncExternalEndpointService`) |
| `spec.route_type` | string | UI-only; `/v1/chat/completions` | no | - | not in `ExternalEndpointSpec` / `api.external_endpoint_spec`; deviation 3 |
| `spec.upstreams[]` | array | yes (may be empty); `[]` | no | yes | `mergekey:"upstream.url,endpoint_ref"` (identity for secret backfill); no other rule |
| `...upstreams[].name` | string | optional in Go, UI always sets `provider-N`, unique | no | yes | gateway `compileExternalEndpointModelRoutes` errors on duplicate when `model_routes` is set |
| `...upstreams[].upstream.url` | string | external kind; `""` | no | yes | none at write; gateway resolves per upstream (failure -> upstream `Failed`) |
| `...upstreams[].auth.type` | `bearer` / `api_key` | no; `bearer` (hidden, `api_key` not offered) | no | no UI | none; `AuthHeaderValue` |
| `...upstreams[].auth.credential` | string | no; `""` | yes (`api:"-"`) | write-only | none; never returned, not even by the credentials route (`RegisterCredentialsRoutes` omits external endpoints) |
| `...upstreams[].endpoint_ref` | string | internal kind; absent | no | yes | `Kind()` is `endpoint_ref` when the pointer is non-nil |
| `...upstreams[].model_mapping` | `Record<string,string>` | required in Go; UI writes `{}` | no | legacy | superseded by non-empty `model_routes` |
| `...upstreams[].models` | string[] / null | UI-only; `null` | no | - | not in `ExternalEndpointUpstreamEntry`; sent from `blankExternalUpstream`; deviation 3 |
| `spec.model_routes[]` | array | no; one blank fixed route on create, absent on edit | no | yes | gateway `compileExternalEndpointModelRoutes` (not at write): model non-empty and unique, >= 1 target, `max_attempts >= 0`, known target upstream, non-empty `upstream_model`, no negative priority / weight / `max_inflight_requests` |
| `...model_routes[].model` | string | yes; `""` | no | yes | as above |
| `...model_routes[].strategy` | `fixed` / `priority` / `weighted` | no; `fixed` | no | locked once `priority` / `weighted` | Go: "optional UI presentation hint"; behavior follows priority and weight |
| `...targets[].{upstream,upstream_model}` | string | yes; `""` | no | yes | as above |
| `...targets[].priority` | int >= 0 | no; `0` (`1` standby) | no | yes | gateway negative check; UI exposes two tiers |
| `...targets[].weight` | int or null | no; `nil` defaults to `1`, or 0-100 summing to 100 (weighted) | no | yes | Go preserves explicit `0` as a disabled target and defaults `nil` to `1`; all-explicit-zero routes are rejected at compile time, while failed providers retain existing skip behavior; the 100-sum rule is UI-only |
| `...targets[].max_inflight_requests` | int | no | no | yes | gateway negative check; UI requires an integer 0..2147483647 when set on a fixed or `priority` route (empty / 0 = unlimited) |
| `...model_routes[].{retryable_conditions,max_attempts}` | string[] / int | no | no | no UI | in UI type, no form field; round-trips untouched |
| `spec.model_sources` | `Record<model,string>` | no; absent | no | yes | trigger `validate_external_endpoint_model_source` (`098`, relaxed by `101`): object 10241, string values 10242; keys not served are pruned on every write |
| `status.phase` | Pending / Running / Degraded / Failed / Deleted | server | no | no | controller |
| `status.{service_url,error_message,last_transition_time}` | string | server | no | no | controller |
| `status.upstream_status[]` | `{kind, ref, models, phase: Ready\|Failed, error_message}` | server | no | no | `externalEndpointUpstreamStatuses`: one per spec upstream in spec order; `ref` is `SanitizeUpstreamURL` (no userinfo, query, fragment) or the endpoint name |

Masked: `spec.upstreams[].auth.credential` inside an array with `mergekey` (Foundation "Masked fields inside arrays";
deviations 1, 2).

## Roles

- Status: `lib/phases.ts` `externalEndpointPhases` (Foundation "Status tone"), label
  `status.phases.externalEndpoint.<phase>`; Degraded and Pending notice (Degraded still serves). `upstreamPhases`
  (Ready positive, Failed serious), label `status.phases.externalEndpointUpstream.<phase>`; `matchUpstreamStatuses`
  pairs by position and drops a status whose `ref` does not match (raw URL or textual sanitise mirroring
  `SanitizeUpstreamURL`).
- Serving: `isServingPhase` (Running or Degraded) gates the curl example.
- Secret input: `<Input type="password">`, hint `common.messages.leaveEmptyToKeepValue`; `omitEmptyUntouched`.
- Columns `useMetadataColumns`; time `metadataColumns.creation_timestamp` / `MetadataTimestampMeta`; empty marker
  `EmptyValue`.
- Timeout: `formatTimeout` (whole minutes `Nmin`, else `Ns`); `TimeoutInput` converts s / min to ms.
- Model source: shared `ModelSourceBadge`, `resolveExternalModelSource`, `modelSourceSuggestions`
  (`foundation/model-reference/model-source`).
- Upstream kind: `getEndpointType` (external / endpoint_ref / mixed; truthiness) for list and show, `deriveUpstreamType`
  (form, `endpoint_ref != null`).

## Scenes

- List: search `metadata->>name`, `defaultSorters`, batch delete. Model chips from `getExposedModels` (route models,
  else legacy `model_mapping` keys).
- Show: header type (`getEndpointType`, empty marker without upstreams), exposed-model count and timeout
  (`formatTimeout`) are `externalEndpointHeaderFields` in `lib/detail-fields.ts`.
  Tabs overview and monitor (`?tab=monitor`, `?model=`; the dashboard needs a workspace,
  `modelRoutingDashboardScope` in `lib/monitoring-state.ts`). The page reads its record through
  `externalEndpointShowView` (`lib/external-endpoint-display-show.ts`): routes via `ModelRouteDetails`, falling back to
  `routesFromLegacy` for specs without `model_routes` (only stored routes link to monitoring); per-upstream cards with
  name (`provider-N` when unnamed), internal / external by `endpoint_ref` truthiness, the endpoint name or URL, status
  and mapping (`getUpstreamModelMappings`); `CurlExample` when serving and a service URL exists (models minus
  `getUnavailableModels`: models of a Failed upstream that no Ready upstream also lists). A Failed upstream's card
  carries `failure` for `FailedUpstreamAlert`: its unavailable models, or `servedByOther` when other upstreams still
  serve all of them. No polling. Credentials never shown.
- Route display (`lib/model-route-view.ts`, shared by `ModelRouteEditor` and `ModelRouteDetails`): `routeStrategyOf`
  (unset = fixed), `ROUTE_STRATEGY_TEXT` labels and hints; weighted routes show weight, others
  `max_inflight_requests`. Detail card rows (`routeTargetRows`): weight share of the total with unset weight counting
  1, primary = lowest priority, `0` / unset cap = unlimited. Editor: weight total with unset = 0 (`routeWeightTotal`,
  as validation), tiers by `priorityTargetIndices` (0 / unset primary, > 0 fallback), removal kept off for the last
  target and a priority route's last primary (`canRemoveTarget`), new targets `newRouteTarget`,
  number inputs empty = unset (`withTargetNumber`), model source only once the route is named.
- Create (`use-external-endpoint-form.tsx`): `mode: "all"`; one blank fixed route, no upstream; switching an upstream
  between external and endpoint_ref resets the other kind's fields.
- Form rules live in `lib/external-endpoint-form-routes.ts` (routes, model sources) and
  `lib/external-endpoint-form-upstreams.ts` (upstream rows, names, endpoint_ref options, the quick-create upstream);
  `useExternalEndpointForm` wires them.
- Edit: locked name, workspace. Prefilled via `select` with `routeForForm`: routes get `strategyLocked` for priority /
  weighted; priority routes show two tiers (lowest priority = primary, others standby); credentials start empty.
  `cacheTime: 0`. Legacy specs (no `model_routes`) migrate in the form (`migrateLegacyRoutes` -> `routesFromLegacy`);
  unnamed upstreams get `provider-N` once (`nameUnnamedUpstreams`). Each row keeps its name and URL as first loaded
  (`upstreamReference`) until submit; routes reference rows by that stored name.
- New upstream rows (`blankExternalUpstream`) are named by `newUpstreamName`; removing a row drops its targets and the
  routes left empty (`removeRouteUpstream`). Quick-create (`QuickUpstreamDialog`, `quickUpstream`) refuses
  `takenUpstreamNames` and points the target that opened it at the new row (`setRouteTargetUpstream`).
- Submit adapter (`onFinish` in `useExternalEndpointForm`), in order: `cleanUpstreamsForSubmit` (drop `upstream` and
  `auth` from endpoint_ref entries, `endpoint_ref` from external ones, an empty untouched credential on edit); reject
  blank or duplicate trimmed upstream names (`hasInvalidUpstreamNames`, `duplicateProvider`) and route problems
  (`getRouteStrategyError` silently, `routeTargetsError` sets a `spec.model_routes` error); trim names; every
  `model_mapping` = `{}`; `routesForSubmit`: default `strategy` fixed, `priority` 0, `weight` 1 for non-weighted;
  rewrite target upstream names from stored to trimmed; drop `strategyLocked`. Whole record (incl. `id`, `status`,
  `route_type`) is the PATCH body.
- Connectivity test (`TestConnectivityButton`, `useTestConnectivity`): external entries post `{upstream:{url},
  auth:{type:"bearer", credential}}`, on edit also `name`, `workspace`, `stored_upstream_url` (URL as first loaded, per
  row by stable field id) so the server backfills the stored credential for the original URL; endpoint_ref entries post
  `{endpoint_ref, workspace}`.
- Delete: Foundation "Soft delete and force". `validateExternalEndpoint` has no deletion pre-check (name only; soft
  deletes pass).
- YAML: kind `ExternalEndpoint` <-> `external_endpoints`; exported without credentials (Foundation "YAML import and
  export").

## Descriptions

- `metadata.name`: only `required` (`validation.nameRequired`). `metadata.workspace`: required, `isValidWorkspace`.
- `spec.timeout`: `NumberInput` min 0, unit s / min. `upstreams[].name`: unique at submit only. `upstream.url`: required
  (`validation.upstreamUrlRequired`). `endpoint_ref`: `EndpointRefSelect` over `useSelect("endpoints")`
  via `endpointRefOptions` (Running first; phase shown only when reported).
- Routes: `getRouteStrategyError` (weight integer 0-100 summing to 100; on fixed and priority routes a set
  `max_inflight_requests` is an integer 0..2147483647; priority needs a primary target), shared by inline feedback,
  `submitBlocked` and the submit guard. Model name,
  target upstream, upstream model required; model names unique; target upstream must name a row (`routeTargetsError`,
  adapter).
- Model source: free text with suggestions (presets plus this form's and sibling endpoints' values for models they
  still serve, `modelSourceUsage`); blank deletes, ignored before the model is named (`setModelSource`).

## Overrides

- Model routes supersede `model_mapping`: the form writes `{}` and migrates legacy mappings (`routesFromLegacy`),
  matching the gateway's precedence (`095`).
- `priority` routes collapse to two tiers on load and save (`routeForForm`, deviation 5); pinned by "shows priority
  tiers and saves them".
- `strategyLocked`: strategy is only a presentation hint in the API; reason unknown beyond avoiding silent loss of
  configuration.
- Default timeout 300000 ms vs gateway 60000 (commit "raise default timeout (#523)"): long LLM calls.
- `deriveUpstreamType` (`!= null`) vs `getEndpointType` (`!!`): an `endpoint_ref: ""` entry is internal in the form,
  external in the list; reason unknown.
- Phase-to-tone mapping and `Degraded` tone are this kind's own (not shared with other statuses).

## Error mapping

No field mapping; Foundation "Error toast path". Submit adapter sets form errors on `spec.model_routes`:
`duplicateProvider`, `routeTargetRequired`, `virtualModelRequired`. Connectivity results show inline (`error` from the
response, or `getErrorMessage`). Unmapped codes: 10232 (UI only requires non-empty), 10231 (malformed payload),
10240-10242 (model sources; 10240 no longer raised after `101`), 10331. `compileExternalEndpointModelRoutes` messages
surface only as status errors, not at save.

## Known deviations

1. Changing an upstream URL while leaving the credential empty drops the stored credential.
   - UI: on edit the field shows `common.messages.leaveEmptyToKeepValue`, and `cleanUpstreamsForSubmit` sends
     `{upstream:{url:<new>}, auth:{type}}` with no credential (pinned by "sends no credential for an upstream whose URL
     was changed"). The connectivity test sends `stored_upstream_url` instead (`use-external-endpoint-form.tsx`,
     `field.storedUrl`).
   - API: `ExternalEndpointSpec.Upstreams` carries `mergekey:"upstream.url,endpoint_ref"`; `mergeArrayByIdentity` /
     `elementIdentity` (`resource_proxy.go`) pair by the identity in the request body, so a new URL matches nothing,
     `mergeExcludedFieldsRecursive` backfills nothing and `spec` is replaced with an entry without credential.
   - Effect: after saving, the upstream authenticates with no credential until retyped; no warning. Traced from code,
     not run against a server. Ticket: TBD
2. A touched-then-emptied credential cannot clear the stored one.
   - UI: `omitEmptyUntouched` keeps a touched empty `auth.credential` and sends `""` (pinned by "sends a credential
     typed into and then emptied as an empty string").
   - API: `mergeExcludedFieldsRecursive` treats `""` as `isEmptyValue` and backfills when the identity (URL) matches.
   - Effect: save succeeds, credential unchanged. Foundation "Masked fields" item 2. Ticket: TBD
3. UI-only keys are sent on the wire and have no API counterpart.
   - UI: form default `spec.route_type` and `blankExternalUpstream().models: null` (every record carries them back on
     PATCH).
   - API: neither `ExternalEndpointSpec` nor `ExternalEndpointUpstreamEntry` (nor composite types of `053`, `095`,
     `098`) has them; only `kong.go` uses a `route_type` of an internal endpoint.
   - Effect: none visible; assumed ignored by the composite conversion (not verified against PostgREST). Ticket: TBD
4. Name rule is not mirrored.
   - UI: only `required` on `metadata.name`.
   - API: `validateExternalEndpointName` rejects uppercase, spaces, non-ASCII, leading / trailing separators, over 63
     (10232).
   - Effect: generic toast after submit. Ticket: TBD
5. An untouched edit rewrites target priorities of a `priority` route.
   - UI: `routeForForm` (`select` in `useExternalEndpointForm`) maps priorities to two tiers (lowest 0, others 1) on
     load and the form saves them (pinned by "shows priority tiers and saves them without reordering targets": 20 / 10
     / 10 becomes 1 / 0 / 0; `routeForForm` "loads $strategy priorities": 1 / 2 / 3 becomes 0 / 1 / 1).
   - API: `ExternalEndpointModelRouteTarget.Priority` is any non-negative int, passed through
     `compileExternalEndpointModelRoutes` to the gateway plugin (how the plugin orders three distinct priorities was not
     read).
   - Effect: a route stored with three or more distinct priorities silently changes shape on the next save. Ticket: TBD
