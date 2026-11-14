# Service Account contract

Backend: `v1.ServiceAccount`, `ServiceAccountSpec`, `TeamApplicationPermissions`
(`api/v1/service_account_types.go`); tables `api.service_accounts`, `api.team_application_permissions` (`131`).
`RegisterServiceAccountRoutes`, `RegisterTeamApplicationPermissionRoutes` (`internal/routes/proxies/org_proxy.go`):
GET/POST/PATCH/DELETE. No controller/status. Migration: `131_group_role_assignments`.
RPCs: `get_team_application_permissions`, `create_service_account_api_key`. Backend `origin/main@062192f6`.
Permissions: `service_account:read|create|update|delete` on the Team (`api.has_permission_on_service_account`);
application permission writes require global `role_assignment:create` (`131`).
UI: `src/domains/service-account/`.
Teams: `src/domains/organization/contract.md`.
Effective/direct grants: `src/domains/role-assignment/contract.md`.

## Type

`types.ts`; global resource, UUID writes; no secrets. Edit describes the UI.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | UUID string | generated | server | no | no | primary key; 10318 immutable |
| `api_version`, `kind` | strings | v1, ServiceAccount | user/server | no | no | NOT NULL |
| `metadata.name` | string | required; blank form | user | no | no UI | Team-unique; name validator |
| `metadata.display_name` | string | trimmed name fallback | user | no | no UI | `v1.Metadata.DisplayName` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | now | server | no | no | timestamp triggers |
| `spec.description` | string/null | empty | user | no | retained | write trigger |
| `spec.disabled` | bool/null | false | user | no | yes | null normalized to false |
| `team_id` | integer | required; selected Team | context | no | no | Team foreign key; 10318 immutable |
| `created_by` | UUID/null | actor | server | no | no | profile FK; SET NULL |
| permissions `roles` | role-name array | server model-invoker | user/default | no | yes | 10324 unknown; 10325 management role |
| permissions `workspaces` | name array/null | null | user/default | no | yes | 10324 unknown; null means all |
| permissions `is_default` | bool | absence of stored row | server | no | no | RPC result only |

`api.validate_metadata_name` (`004_required_fields`): 10001 blank, 10003 DNS-style with dots, 10004 over 63.
`service_accounts_team_name_idx` permits the same name in different Teams.
`api.service_accounts_before_write` normalizes spec, requires Active Team on INSERT (10317), calls
`api.refuse_service_account_actor` (10320), and protects id/Team/non-null creator changes (10318).
Other metadata: `v1.Metadata`. Permission rows also store Team id/update time.

`api.team_application_permissions_before_write` (`131`) trims, deduplicates and sorts both arrays, checks live role
and workspace names (10324), refuses management roles (10325), and refreshes `update_timestamp`.
`api.effective_team_application_permissions` filters management roles and sorts names.
No row means model-invoker everywhere; explicit empty roles or workspaces grants nothing.
`api.get_team_application_permissions` requires global assignment read or service-account read on the Team.

## Roles

- Names: shared `displayName` (tests beside it); `ServiceAccountLabel` falls back to the UUID for unreadable accounts.
- Enabled state: `spec.disabled` truthiness; `TeamServiceAccounts` badges use
  `service_accounts.status.enabled|disabled`.
  No `STATUS_TONE` mapping applies.
- Created time: relative `Timestamp`. Empty descriptions are omitted.
- Permission summaries: technical names; null scope All workspaces, empty arrays No roles/No workspaces,
  `is_default` marks default origin.

## Scenes

- Entry: `src/pages/organization/team-detail-tabs.tsx:TeamDetailTabs` embeds Applications with Team read/write grants.
- List (`components/TeamServiceAccounts.tsx:TeamServiceAccounts`): name/description, enabled, created, quota, actions.
  `useServiceAccounts`: all rows by Team, name ascending; no search/filters/batch.
  `useAllServiceAccounts`: all readable picker/label rows.
- Show: name/state/description, keys, read-only Team permissions, injected usage; no standalone account route.
  Quotas: `src/domains/group-policy/contract.md`; usage belongs to API Key.
- Create (`CreateServiceAccountDialog`, `useServiceAccountWrites.create`): trim all inputs; display name falls back
  to name. POST `{api_version:"v1",kind:"ServiceAccount",metadata:{name,display_name},
  spec:{description,disabled:false},team_id}`.
- Edit: no general form. `useServiceAccountWrites.setDisabled` PATCHes by UUID with only
  `{spec:{description:account.spec?.description ?? "",disabled}}`; metadata, creator and Team are absent.
- Permissions (`components/TeamApplicationPermissionsCard.tsx:AppPermissionsDialog`): prefill RPC arrays; options
  combine loaded names and readable choices, sorted; newly offered choices exclude management roles/deleted workspaces.
- `useTeamApplicationPermissionsWrites.save`: default POST `{team_id,roles,workspaces}`, explicit PATCH
  `{roles,workspaces}` by Team id; all-workspaces sends null, no selection `[]`. Reset DELETEs without a body;
  the card refetches the RPC after writes.
- Delete (`useServiceAccountWrites.remove`): immediate DELETE by UUID without a body or force option.
  `api.service_accounts_before_delete` (`132_service_account_api_keys`) refuses remaining keys, including
  soft-deleted keys awaiting revocation (10319). No local pre-check.
- Transport: `src/foundation/contract.md`, “Row writes”; account writes invalidate service_accounts.
- YAML: `src/foundation/contract.md`, “YAML import and export”; no dedicated import or export option.

## Descriptions

`CreateServiceAccountDialog`: name placeholder `my-app`; errors after submit for trimmed blank
(`validation.nameRequired`),
over 63 or failed `isValidResourceName` (`validation.nameFormat`). Display name and description have no validation.
Permission descriptions: `service_accounts.appPermissions.*`; no minimum selection.

## Overrides

- Enable/disable resends the entire two-field spec because composite PATCH replaces it (kept hook comment).
- `isManagementRole` (`lib/application-permissions.ts`) must match `api.is_management_role` (kept comment).
  Tests beside it.
- Reset accepts empty results after concurrent reset (kept hook comment); account empty writes raise gone.

## API key and secret trace

`src/domains/api-key/components/ServiceAccountApiKeys.tsx:ServiceAccountApiKeys` reads keys by `service_account_id`,
newest first, across workspaces; rights follow the Team.
`TeamDetailTabs` hides key create for disabled accounts. Inactive-Team creation: Organization Known deviation 2.

`src/domains/api-key/components/CreateApiKeyForm.tsx:onSubmit` POSTs `create_service_account_api_key` with
`{p_service_account_id,p_workspace,p_display_name:name,p_description:description,p_limits:buildApiKeyLimits(values)}`.
Project/quota/technical-name/expiry parameters are absent; blank policy sends `p_limits:{}`.
`api.create_service_account_api_key` (`132`) checks human creator, Team permission, enabled account, Active Team
and live workspace; `api.insert_api_key` receives null user/project/expiry/name.
`insert_api_key` returns generated name/JWT (`status.sk_value`); `CreateApiKeyForm` shows/copies it until close.

`v1.ApiKeyStatus.SkValue` (`api/v1/api_key_types.go`) is masked on ordinary resource reads.
Shared masking mechanics: `src/foundation/contract.md`, “Masked fields”. No credential recovery input is offered.
Key edits do not send status: `ApiKeyLimitsCard.saveConfiguration` POSTs `update_api_key_configuration` with
`{p_api_key_id,p_project_id:null,p_display_name,p_description,p_limits}` for untouched/replacement edits, never
`sk_value`; cleared descriptions send `p_description:""`, cleared names fail client required validation.
`api.update_api_key_configuration` (`132`) updates metadata/spec only. `useApiKeyDisable` POSTs `get_api_key_limits`
`{p_id}`, then `set_api_key_limits` `{p_id,p_limits}` with disabled true or removed.
`api.set_api_key_limits` (`132`) updates spec only. Neither path writes the secret or needs backfill.
Both write RPCs return the secret; edit/toggle callers ignore it.

## Error mapping

Transport decoding: `src/foundation/contract.md`, “Error toast path”. `lib/errors.ts:serviceAccountErrorMessage`
maps 10316 project, 10317 inactive, 10318 immutable, 10319 keys remain, 10320 account actor (shared
`SERVICE_ACCOUNT_ERROR_KEYS`); 10315 Team applications, 10324 unknown names, 10325 management role, 23505 duplicate.
`ServiceAccountGoneError` maps to gone; others use server text or fallback.
Dialog and account-action errors are inline; no server code maps to a field.
Read failures show unreadable; tests: `lib/errors.test.ts`. Key errors: `serviceAccountKeyErrorMessage`.

## Known deviations

1. Account names, human names and descriptions cannot be changed here.
   UI: `components/TeamServiceAccounts.tsx:TeamServiceAccounts` offers only enable/disable and delete after create.
   API: `api.service_accounts_before_write` (`131_group_role_assignments`) accepts those changes;
   `v1.Metadata.DisplayName` and `v1.ServiceAccountSpec.Description` retain them.
   Users must use another API client to rename an application or correct its description. Ticket: TBD
2. Untouched default permission saves change stored origin.
   UI: `components/TeamApplicationPermissionsCard.tsx:AppPermissionsDialog` permits unchanged Save;
   `hooks/use-service-accounts.ts:useTeamApplicationPermissionsWrites.save` POSTs default RPC values.
   API: `api.effective_team_application_permissions` (`131`) distinguishes no row from an explicit row.
   Users lose the default-origin indicator on an unchanged save and must Reset to inherit defaults again. Ticket: TBD

## Open points

SQL traces only; no live API/concurrency. Payload tests: `hooks/use-service-accounts.test.ts`.
