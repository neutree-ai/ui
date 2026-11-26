# API Key contract

Backend: `v1.ApiKey`, `ApiKeySpec`, `ApiKeyLimits`, `AllowedModel`, `ApiKeyStatus`
(`api/v1/api_key_types.go`); `api.api_keys`, `api.api_key_projects` (`002_user-extend`, `092`, `132`).
`RegisterAPIKeyRoutes` (`internal/routes/proxies/api_key_proxy.go`) serves GET/PATCH; creation uses RPCs below.
Personal keys belong to the caller; application keys require Team-scoped `service_account:read|create|update|delete`
(`132_service_account_api_keys`, `api.can_act_on_api_key`). Usage additionally accepts workspace usage readers.
Refine resource `api_keys` is workspaced, keyed by `metadata->name`. Backend: `origin/main@062192f6`.
UI paths below are relative to `src/domains/api-key/`; migration names are under `db/migrations/`.

## Type

`types.ts`; defaults describe RPC creation. User-owned, unmasked and editable unless noted.
Other metadata follows `v1.Metadata`. Computed usage is never configuration.

| path | type | required/default | owner, secret, edit exception | backend rule |
|---|---|---|---|---|
| `id`, `api_version`, `kind` | UUID, strings | generated, v1, ApiKey | server; locked | primary key; `api.insert_api_key` |
| `metadata.name` | string | generated apikey UUID name | server; locked | workspace uniqueness |
| `metadata.display_name` | string | required input; name fallback | user | update trims; nonblank |
| `metadata.workspace` | string | required; dialog preset | locked | create 10044; application live workspace |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | current time | server; locked | timestamp triggers |
| `metadata.deletion_timestamp` | timestamp/null | null | delete only | `validate_soft_delete` |
| `user_id`, `service_account_id`, `created_by` | UUID/null | one owner; actor creator | server; locked | owner check; 10318; creator FK |
| `spec.quota` | int64 | token quota limit or zero | server; derived | `api.set_api_key_limits` |
| `spec.expires_in` | seconds/null | null | API user; no UI | `api.generate_api_key`; null never expires |
| `spec.project_id` | UUID/null | preset or null | personal edit only | same owner/workspace; application 10316 |
| `spec.description` | string/null | empty | user | RPC null becomes empty |
| `spec.limits` | object/null | form empty object | user | `api.validate_api_key_limits` |
| `spec.limits.token_quota.limit` | int64/null | unset | user | positive int64 |
| `spec.limits.token_quota.period` | string | monthly | user | shared key period |
| `spec.limits.rps`, `.rpm`, `.concurrency` | number/null | unset | user | positive integer; 22023 |
| `spec.limits.allowed_models` | entry array/null | form omitted | user | missing/null unrestricted; empty deny-all |
| `spec.limits.allowed_models[].model` | string | nonblank | user | required string; 22023 |
| `spec.limits.allowed_models[].type`, `.endpoint_name` | strings | absent wildcard | retained or picked | optional strings; null rejected |
| `spec.limits.allowed_models[].token_limit` | int64/null | unset | user | positive int64 |
| `spec.limits.disabled` | boolean | absent | action only | true disables gateway access |
| `status.phase` | Pending/Created/Deleted | Pending | server; locked | `ApiKeyController.sync` |
| `status.sk_value` | string | generated | server; masked; locked | `ApiKeyStatus.SkValue` exclusion tag |
| `status.usage`, `.last_used_at`, `.last_sync_at` | count/times | zero/now/null | server; locked | usage synchronization |
| `status.error_message`, `.last_transition_time` | text/time | null/now | server; locked | `ApiKeyController.updateStatus` |

`api.validate_api_key_limits` (`099_apikey_per_model_quota`) rejects overlapping entries of a model when any entry
of that model has a token limit. Absent dimensions match any endpoint dimension; fully pinned entries match one
endpoint in the key's workspace. Any entry limit suspends overall quota enforcement, retaining the overall fallback
(`api.api_key_own_remaining`, `133_group_policies`). `api.get_api_key_limits` (`132`) adds used/remaining,
quota_granularity, quota_period, quota_period_start and quota_resets_at. Remaining can be negative.

## Roles

- Token amounts, units, periods and formatting: `src/foundation/contract.md`, “Token quotas”.
- Names use `display_name || name`; `ApiKeyLabel` also resolves by UUID and falls back to its supplied text or UUID.
- Label rule: `apiKeyLabelParts` (`lib/api-key-label.ts`) gives primary name, technical `metadata.name` (only when a
  display name hides it) and description (null when blank). `ApiKeyLabel` shows them as clipped lines; a clipped line,
  or the inline variant hiding the technical name or description, carries the full text on a tooltip. Filters and
  links keep the key UUID.
- Time: `Timestamp`, `MetadataTimestampMeta`; empty values: `EmptyValue`; rates: `rateSummary`.
- Status badges (`apiKeyStatus`, `lib/api-key-display-list.ts`) read limits.disabled (`apiKeyLimitsDisabled`) independently of lifecycle phase:
  disabled, else quota exceeded (personal list only), else active. Key tables name rows by the label rule
  (`apiKeyRowView`); a blank description or workspace shows nothing or `EmptyValue`.
- Models: `ModelSourceBadge`, `useWorkspaceModelMap`, `useModelSourceByValue`; unknown pins show unavailable.
  `endpointPhaseClass` in `src/pages/api-keys/list.tsx` retains local tones without STATUS_TONE's border token.

## Scenes

- List (`src/pages/api-keys/list.tsx:ApiKeysList`): Project, name/description, workspace, enabled, models,
  token consumption, rates, usage, created, actions. Server folder paging; no sortable columns.
  Groups (`apiKeyGroupView`, `lib/api-key-display-project.ts`): the RPC's ungrouped bucket is labelled by translation
  and offers no edit/delete; creating from a group presets its workspace and Project (`createKeyPreset`). The Models
  column resolves pinned entries to listed endpoints (`allowedModelView`). The ranking lists live keys of the scope.
- `useApiKeyProjectGroups`: workspace, trimmed search, disabled filter, page/size; blank filters become null.
  `get_api_key_project_groups` / count (`113_api_key_search_name`) match Project/name/display name/description;
  oldest first, Ungrouped first within workspace.
- Row actions: show, toggle, delete, move; batch: delete/move. Move sends key UUIDs and Project UUID/null.
  A successful move opens the target group (`lib/move-target-group.ts`: the Project, or the keys' workspace's
  Ungrouped) if the user had folded it; other groups keep their fold state.
- Project create/update/delete RPCs (`092`): create trims name/description, edit sends both inputs;
  deletion needs no live keys (23503). `move_api_keys_to_project` (`132`) requires one owner/workspace.
- Show (`src/pages/api-keys/show.tsx:ApiKeysShow`, reads via `apiKeyShowContext`, `lib/api-key-display-show.ts`):
  name (`displayName`); workspace, description (only when set) and
  usage (locale number), then the application (rendered by the page) or else the Project (ungrouped, loading, load
  failed or its name) via `DetailFields` over `lib/detail-fields.ts`; timestamps, traffic, group-policy hint and editable limits. No standalone edit route or lifecycle badge.
- Create (`components/CreateApiKeyForm.tsx:onSubmit`): `create_api_key` sends workspace, null technical name,
  display name, Project/null, description, zero legacy quota and `buildApiKeyLimits` result. Expiry is absent.
- Create success view: the one-time Secret (`createdKeySecret`, `lib/created-key-summary.ts`), then a summary read
  from the RPC response (`createdKeySummary`, `lib/created-key-summary.ts`): Project name (resolved from the workspace Project list the picker shares, so an inline
  created Project resolves; ungrouped when `spec.project_id` is null; `EmptyValue` if the id is not listed), display name
  and description (`EmptyValue` when blank), shown through `DetailFields`; the description clips at three lines.
  Application keys omit the Project row and read no Project list.
- Application create uses `create_service_account_api_key` with account id, workspace, display name, description
  and limits only. `132` requires an enabled account, Active Team and Team create permission.
- Edit (`components/ApiKeyLimitsCard.tsx:saveConfiguration`): prefill identity from record props and limits from
  `get_api_key_limits`. `limitsToForm` restores exact units, including wildcard/partial pins and unavailable entries.
  The form values, validation and mapping live in `lib/api-key-policy-form.ts` (tests beside it).
- Edit consumption (`apiKeyQuotaReadout`, `lib/api-key-limits-view.ts`): follows `quota_granularity`, not token_quota
  presence. Overall: used/limit/remaining with a bar (`quotaUsageMeter`: amber from 80%, red at the limit). Per-model:
  one row per entry with token_limit; remaining ≤ 0 is exhausted. Remaining is the server's, else limit − used.
- Save posts `update_api_key_configuration` with key UUID, Project/null, display name, description and rebuilt limits;
  disabled is preserved. Name/workspace/owner/expiry/status are absent. Blank description is sent as an empty string.
- `buildApiKeyLimits`: drops blanks, deduplicates model/type/endpoint, omits empty numbers and computed usage;
  per-model-only quotas send token_quota with period alone.
- Enable/disable (`useApiKeyDisable`): read current limits, remove computed fields (`limitsWithDisabled`), then
  `set_api_key_limits` with `{p_id,p_limits}`. Disable adds true; enable removes disabled. Empty allowed_models is retained here.
- Delete mechanics: `src/foundation/contract.md`, “Soft delete and force”. Personal list/show retain force controls;
  application list explicitly disables force. No local reference pre-check; missing row name/workspace blocks batch.
- `ApiKeyController.sync` revokes the gateway consumer before Deleted, then removes the row next reconcile.
  Gateway failure retains the phase, records an error and retries; force never advances it.
- `ServiceAccountApiKeys`: unpaged account filter, live keys newest first (`liveKeysNewestFirst`), show/edit limits,
  toggle and delete; no Project. Limits read overall quota (`overallTokenQuota`, monthly by default) then rates.
- Usage: `useAllApiKeyUsage` requests page UUIDs; null means all, empty array none. `fetchAITraceKeyStats`
  supplies 24h traffic, empty on failure. Usage polling uses `useUsageRpcBatch` and its existing tests.
- YAML mechanics: `src/foundation/contract.md`, “YAML import and export”. API keys are exportable without secrets;
  generic ApiKey import attempts resource creation, whose proxy has no POST route.

`TeamUsage.project` changes hints to scenario wording; the subject and RPC filters remain Team/name. `TeamDetailTabs`
supplies `isProjectTeam`; usage fields, permissions and key writes are unchanged.

## Descriptions

`CreateApiKeyForm` and `ApiKeyLimitsCard` require a trimmed-nonblank human name of at most 63 characters; transmitted
create text is not trimmed. Workspace has no required rule. Description and Project are optional.
`ApiKeyPolicyFields` validates positive integer rates, token amounts and overlap (`api_keys.limits.*` errors).
`list_invokable_models` supplies pinned choices; personal RPC failures fall back to readable endpoints.
Wildcard and unavailable entries retain their identities. Application choices have no fallback.

## Overrides

- RPC creation is atomic and returns the secret; the success view shows/copies it until close. No secret edit input.
- Edit rebuilds limits instead of echoing a record; `src/foundation/contract.md`, “Edit PATCH”, does not apply.
- Empty model selection means unrestricted in the form; reason predates backend deny-all support (deviation 2).
- Per-model quota disables overall amount editing but retains its value for fallback; backend mutual exclusion.
- Application workspace fallback is current/default because Team rights need not include workspace reads
  (`CreateApiKeyForm` comment). Workspace mechanics: `src/foundation/contract.md`, “Workspace selection”.

## Secret payload trace

Masking mechanics: `src/foundation/contract.md`, “Masked fields”. Ordinary GET uses `filterObject`; grouped listing
explicitly removes status.sk_value in `api.get_api_key_project_groups` (`113`). Neither path decodes through
`ApiKeyLimits.AllowedModels`, so its Go omitempty tag does not erase an explicit empty array on those reads.
Untouched empty configuration edit sends exactly `{p_api_key_id:"key-1",p_project_id:null,p_display_name:"Key",
p_description:"",p_limits:{}}`; changed name/description or limits replaces only those parameter values.
`api.update_api_key_configuration` and `api.set_api_key_limits` (`132`) write metadata/spec, leaving status untouched.
Toggle sends `{p_id:"key-1",p_limits:{disabled:true}}` or `{p_id:"key-1",p_limits:{}}` for otherwise empty limits.
No path sends a blank, null, partial or replacement sk_value; there is no secret backfill dependency on these RPCs.
Both write RPCs return the stored row, including sk_value, through unfiltered `handlePostgrestRPCProxy`
(`internal/routes/proxies/proxies.go`). Callers discard it; “shown once” describes the UI, not API recoverability.

## Error mapping

Transport decoding: `src/foundation/contract.md`, “Error toast path”. No server error maps to a form field.
Personal create displays `getErrorMessage` inline; application actions use `serviceAccountKeyErrorMessage`:
10044 workspace, shared SERVICE_ACCOUNT_ERROR_KEYS for 10316/10317/10318/10319/10320. Edit uses success/error toasts.
Project actions show raw errors inline: 22023 invalid data, 23505 duplicate, 23503 live keys, 42501 permission.
Force 10226 has no translation mapping; list deletion reports partial-failure counts. Other server text is retained.

## Known deviations

1. Personal deletion offers an unsupported force option. UI: `src/pages/api-keys/list.tsx:ApiKeysList` and
   `src/pages/api-keys/show.tsx:ApiKeysShow` inherit `DeleteConfirmDialog`'s default allowForceDelete.
   API: `rejectAPIKeyForceDelete` (`internal/routes/proxies/api_key_validation.go`) returns 10226.
   Users selecting force receive a refusal instead of deleting their key. Ticket: TBD
2. Untouched edit broadens an explicit deny-all key. UI: `lib/api-key-policy-form.ts:limitsToForm` and
   `buildApiKeyLimits` turn `{allowed_models:[]}` into `{}`;
   `src/pages/api-keys/list.tsx:ModelsCell` labels it All models.
   API: `api.get_api_key_model_rules` (`137_subject_policies`) preserves deny-all arrays; `Kong.effectiveModelRules`
   and `generateAPIKeyAccessPlugin` (`internal/gateway/kong.go`) distinguish nil from empty without omitempty.
   Users see a misleading label and saving removes the key's deny-all restriction, subject to owner rules. Ticket: TBD
3. Large API quotas cannot round-trip through the form. UI: `components/ApiKeyPolicyFields.tsx:validateModels` and
   `components/TokenQuotaField.tsx:TokenQuotaField` use `isValidTokenQuota`, which requires a safe JavaScript integer.
   API: `api.validate_api_key_limits` (`099`) accepts int64 token limits up to 9223372036854775807.
   Users must reduce large quotas before saving; per-model mode can drop an unsafe overall fallback. Ticket: TBD
4. A period-only overall configuration loses its period. UI: `lib/api-key-policy-form.ts:buildApiKeyLimits`
   omits token_quota without any amount or entry limit. API: `api.validate_api_key_limits` (`099`) accepts
   `{token_quota:{period:"weekly"}}`; `api.get_api_key_limits` (`132`) returns its weekly period.
   An untouched save removes that period, so a later quota starts monthly. Ticket: TBD

## Open points

Code traces only; no live PostgREST/gateway/concurrency tested. Existing payload and quota tests plus create/edit
mutation tests pin the current behavior. Usage-center aggregation and trace-store authorization are separate APIs.
