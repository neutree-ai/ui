# Group Policy contract

Backend: `v1.GroupPolicy`, `GroupPolicySpec`, `GroupPolicyModel`, `GroupTokenQuota`
(`api/v1/group_policy_types.go`); `api.group_policies`, `api.group_policy_spec` (`133_group_policies`,
`137_subject_policies`). `RegisterGroupPolicyRoutes` (`internal/routes/proxies/org_proxy.go`) serves
GET/POST/PATCH/DELETE `/api/v1/group_policies`. No controller or status. Backend `origin/main@062192f6`.
Permissions: `group_policy:read`, `group_policy:create`, `group_policy:update`, `group_policy:delete`.
Role assignments and migration 131: `src/domains/role-assignment/contract.md`.
Paths below are relative to this domain.

## Type

`types.ts`; user-owned and editable unless noted. No `api:"-"` fields or secrets.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | integer | serial | server | no | no | primary key |
| `api_version`, `kind` | strings | v1, GroupPolicy | user | no | no UI | NOT NULL |
| `metadata.name` | string | derived on create | server or API caller | no | no UI | global unique index; `validate_metadata_name` 10001/10003/10004 |
| `metadata.workspace` | string/null | null | server | no | no | 10299 for nonempty input |
| `metadata.display_name`, `.labels`, `.annotations` | string, maps | absent | API caller | no | no UI | `v1.Metadata` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamp | current time | server | no | no | timestamp triggers in 133 |
| `spec.subject_kind` | Team/OrgUnit/User/ServiceAccount | required; context | user | no | no | 10300; 10301 immutable |
| `spec.subject_name` | name or UUID | required; context | user | no | no | 10294; 10301 immutable |
| `spec.scope_kind`, `.scope_name` | group kind/name | subject context or null | user | no | no | 10328 pair/kind; 10329 membership |
| `spec.allowed_models`, `.denied_models` | model entry arrays/null | null; dialog empty arrays | user | no | yes | `group_policy_normalize_models`; 10302 |
| model entry `model` | string | nonblank | user | no | yes | name match; no existence lookup |
| model entry `workspace` | string/null | absent means all | user | no | yes | blank normalized away |
| `spec.token_quota.limit` | int64 | positive when present | user | no | yes | 10303; maximum 9223372036854775807 |
| `spec.token_quota.period` | daily/weekly/monthly/yearly | monthly | user | no | yes | 10303 |

`group_policies_before_write` (`137`) trims subject and scope, canonicalizes UUIDs and derives missing names from
subject and scope. Long names use a 50-character prefix and 12-character MD5 suffix before `validate_metadata_name`
(`004_required_fields`).
Unique indexes cover name and subject/scope (`group_policies_name_unique_idx`, `group_policies_subject_unique_idx`).
`group_policy_normalize_models` (`133`) preserves model/nonblank workspace text without existence checks, drops extra
keys/exact duplicates, and maps empty arrays to null.
`group_policy_normalize_token_quota` (`133`) maps null/missing limit to no pool.

## Roles

- Token units, integer conversion and formatting: `src/foundation/contract.md`, “Token quotas”.
- Sources: `displayName`, `PolicySourceLabel`, `tokenPoolSource`, `subjectPolicySource`; tests beside helpers.
- `TokenPoolSummary` shows quota, usage and the raw reset date. It and `SubjectQuotaCell` clamp displayed remaining
  to zero
  and mark nonpositive remaining exhausted.
- Empty detail rules use `EMPTY_VALUE`; absent group rules use unrestricted.

## Scenes

- `src/pages/organization/list.tsx:OrganizationList` embeds group rules and member limits;
  `team-detail-tabs.tsx:TeamDetailTabs` adds application limits and a read-only Team pool on the usage tab.
- `src/pages/users/show.tsx:UsersShow` embeds `UserGroupModelAccess`; API-key show uses `ApiKeyGroupPolicyHint`.
  No standalone routes or batch actions.
- `useGroupPolicy` filters exact subject kind/name, unpaged, first row. `GroupModelAccess` requires global read
  and the matching global write permission for actions.
- `GroupPolicyDialog` loads both lists/quota on mount; empty new saves do nothing, empty existing rows remain.
  `buildGroupPolicySpec` sends subject, both lists and quota; empty lists become null.
- `useSubjectQuotaColumn` reads `get_scope_subject_policies` by scope; `useScopePolicyAccess` requires read
  and matching write permission globally or on that scope.
- `SubjectPolicyDialog` loads allowed models and quota. `buildSubjectPolicySpec` sends subject, scope and all rules.
  `subjectPolicyChange` removes an emptied existing policy, skips empty new policies, otherwise saves.
- `useGroupPolicyWrites` creates `{api_version:"v1",kind:"GroupPolicy",metadata:{},spec}`;
  edit sends only `{spec}` to `/group_policies?id=eq.<id>`.
- Transport: `src/foundation/contract.md`, “Row writes”. Group writes refresh all policy RPCs and the group list;
  subject writes refresh that principal/scope. In-flight reads are cancelled.
- `useUserGroupPolicy` posts `{p_user_id,p_workspace}` to `get_user_group_policy`; null returns sources
  with null merged lists,
  empty string defers reading. `UserGroupModelAccess` hides denied reads, selects `model_access_workspace` or first
  visible workspace or null, and shows merged rules, workspace-filtered sources, activity and applying pools.
- `TeamTokenPool` reads `get_group_token_pools` with `{p_kind:"Team",p_name}`; distinguishes absent/unreadable.
  `project` changes no-pool/unreadable text to scenario wording; RPC identity stays Team/name. `ApiKeyGroupPolicyHint`
  shows applying policies and links to readable user detail.
- YAML: `src/foundation/contract.md`, “YAML import and export”; no export option.

## Subject, scope and protection

`api.group_policies_before_write` (`137_subject_policies`) requires an existing subject on INSERT.
Group policies have no scope. User policies allow global, Team or OrgUnit scope;
ServiceAccount policies allow global or Team scope. Scope kind and name are paired.
On UPDATE, blank subject pairs retain the subject; blank scope pairs retain scope. Changes raise 10301.
Rule fields are not backfilled and must be resent.

`api.group_policy_in_scope` checks `api.user_groups` on INSERT only. Leaving scope stops enforcement but retains the
editable/deletable row. `api.principal_group_policies` includes inactive groups; their rules/pools still apply.
`api.user_group_model_policy` (`137`) unions Team allows, intersects other allows and the Team result, then subtracts
denies. Null means unrestricted; an empty result permits no models. `api.group_token_pool_usage` counts group usage
or principal usage across keys. `api.get_scope_subject_policies` returns the least remaining of all applying pools.

Group policy table policies (`137`) require global rights for group subjects. Principal policies also accept
`api.group_policy_permitted_scopes` for the stored scope; UPDATE checks old and new rows.
`api.can_read_principal_group_policy` permits self, subject readers and relevant Team readers.
`api.get_group_token_pools` also permits Team usage readers.

Delete is immediate HTTP DELETE with `{}` by numeric id, not the shared soft-delete flow.
`RegisterGroupPolicyRoutes` has no reference pre-check or controller; table delete policy is the protection.
`GroupModelAccess` and `SubjectQuotaCell` disable force; no built-in-name exception.
`api.group_policies_delete_with_group` (`137`) deletes both the group's own policy and policies scoped to it on physical
group deletion. `api.group_policies_delete_with_subject` removes principal policies on user/service-account deletion.

## Descriptions

`ModelEntryPicker` defaults to all workspaces, offers discovered models and accepts arbitrary trimmed names;
`addEntries` skips blanks/duplicates per workspace. Subjects/scopes/names have no editable inputs.
`TokenQuotaFields` uses `group_policies.pool.invalid` and disables save for invalid nonblank quota.
Quota starts blank and monthly.

## Overrides

- Subject dialogs hide denied editing but preserve denies. Reason unknown; deviation 1.
- Subject empty-save deletes, while group empty-save keeps an existing row. Reason unknown.
- Writes require read as well; reason unknown beyond loading the policy.

## Error mapping

Transport error decoding: `src/foundation/contract.md`, “Error toast path”.
`lib/group-policy-errors.ts:groupPolicyErrorText` translates inline errors through `GROUP_POLICY_ERROR_KEYS`:
10294 subject missing, 10299 workspace, 10300 kind, 10301 fixed identity, 10302 models, 10303 quota,
10328 scope mismatch, 10329 membership, 23505 duplicate. `GroupPolicyGoneError` maps zero-row PATCH/DELETE to gone;
this can also mean RLS hid the row. Subject dialogs substitute `.subject.denied` on permission denial.
Other errors use `translateApiErrorOr`; read/delete errors are inline, failed saves stay open.

## Known deviations

1. A subject policy's denied models cannot be inspected or edited in its scope dialog.
   UI: `components/SubjectQuotaCell.tsx:SubjectQuotaCell` renders only allowed count/quota;
   `components/SubjectPolicyDialog.tsx:SubjectPolicyDialog` edits only allows/quota and excludes this policy from
   `EffectiveLimits`. API: `api.get_scope_subject_policies` and `api.group_policies_before_write`
   (`137_subject_policies`) return and accept denied_models. Users see a blank summary for a deny-only policy and
   cannot remove its denies there, although saves preserve them. Ticket: TBD
2. Large API quotas cannot be saved untouched through the dialog.
   UI: `hooks/use-token-quota-input.ts:useTokenQuotaInput` uses `toTokenCount`
   (`src/foundation/token-quota/token-quota.ts`), which requires a safe JavaScript integer; `TokenQuotaFields` disables save.
   API: `api.group_policy_normalize_token_quota` (`133_group_policies`) accepts positive int64 values.
   Users reopening a quota above 9007199254740991 see invalid input and must reduce it before saving. Ticket: TBD

## Open points

No live PostgREST, enforcement or concurrency tests. SQL conclusions are code reads.
