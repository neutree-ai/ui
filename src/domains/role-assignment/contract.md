# Role Assignment contract

Backend: `v1.RoleAssignment`, `RoleAssignmentSpec`, `RoleAssignmentStatus` (`api/v1/role_assignment_types.go`);
`api.role_assignments` and composites (`001_rbac`, `131`).
`RegisterRoleAssignmentRoutes` (`internal/routes/proxies/role_assignment_proxy.go`): GET/POST/PATCH.
RPC: `api.get_user_effective_role_assignments`. Permissions: `role_assignment:read|create|update|delete`;
subject-aware policies in `131_group_role_assignments`. Global Refine resource `role_assignments`, key
`metadata->name` (`src/App.tsx`); displayed as Workspace Policies. Backend: `origin/main@062192f6`.
UI paths: `src/domains/role-assignment/`. Migrations: `db/migrations/`.

## Type

Form defaults below.
`v1.RoleAssignment` has no `api:"-"` fields; there are no secret inputs or credential payloads.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | integer | serial | server | no | no | primary key (`001`) |
| `api_version`, `kind` | strings | v1, RoleAssignment | user | no | no UI | NOT NULL |
| `metadata.name` | string | required; blank | user | no | locked | name validator; global uniqueness |
| `metadata.workspace`, `.display_name`, `.labels`, `.annotations` | strings, maps | absent | user | no | no UI | `v1.Metadata` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | now | server | no | no | `019_annotations` |
| `metadata.deletion_timestamp` | timestamp | absent | user | no | delete | `validate_soft_delete` |
| `spec.user_id` | UUID/null | User required; blank | user | no | yes | 10032, 10293, 10326 |
| `spec.subject_kind` | User/Team/OrgUnit/null | User | user | no | yes | 10292; null becomes User |
| `spec.subject_name` | group name/null | group required; null | user | no | yes | 10293 mismatch; 10294 missing |
| `spec.role` | role name | required; blank | user | no | yes | 10033; delegated lookup 10285 |
| `spec.global` | boolean/null | true | user | no | yes | 10298 missing scope |
| `spec.workspace` | workspace name/null | blank | user | no | yes | 10041 unsupported |
| `spec.org_unit` | department name/null | null | user | no | yes | 10281 conflict; 10282 missing |
| `spec.team` | Team name/null | absent | user | no | yes | 10312 conflict; 10313 missing |
| `status.phase` | Pending/Created/Deleted | absent | server | no | no UI | `RoleAssignmentController.sync` |
| `status.error_message`, `.last_transition_time` | text/time | absent | server | no | no UI | `updateStatus` |

`validate_metadata_name` (`004`): 10001 empty, 10003 lowercase DNS-style name with dots, 10004 over 63 characters.
`role_assignments_name_unique_idx` (`001_rbac`) spans scopes; metadata.workspace is not assignment scope.
Live indexes constrain subject/role/scope (`131`). UI type omits status.

## Roles

- Scope: `lib/scope.ts` (`scopeOf`, `scopeFields`, `availableScopes`); tests beside the helper.
- Subject: `lib/subject.ts` (`subjectKindOf`, `subjectFields`, `availableSubjectKinds`); tests beside the helper.
  Missing/null/empty kind displays User; switching subject clears the other kind's identity.
- `RoleAssignmentScopeLabel` / `RoleAssignmentSubjectLabel`: organization renderers.
  `UserCell`: UUID lookup in user_profiles, `profileDisplayName`, blank when unavailable.
- Users: `profileOptionLabel`; tests: `src/foundation/role/user-identity.test.ts`. Roles: technical names.
  Time: `useMetadataColumns`, `MetadataTimestampMeta`.

## Scenes

- List (`src/pages/role-assignments/list.tsx:RoleAssignmentsList`): name, scope, role, subject, created, actions;
  name search, `defaultSorters` newest first, sorting/filters, batch delete; row edit/delete.
  Create needs any-scope `role_assignment:create`.
- Show (`src/pages/role-assignments/show.tsx:RoleAssignmentsShow`): name, scope, role link, subject, timestamps;
  header and policy fields are `roleAssignmentFields` in `lib/detail-fields.tsx`, given the page's group renderers;
  no status/polling. Missing record uses `pages.error.notFound`.
- Create/Edit (`hooks/use-role-assignment-form.tsx:useRoleAssignmentForm`): name, subject, role and scope;
  `mode:"all"`, unsaved warning; no submit transform.
- Create: `{api_version:"v1",kind:"RoleAssignment",metadata:{name},spec}` with Type defaults.
  Global sends workspace `""` until explicitly selected, then null.
- Edit locks name, retains null/unknown fields and offers loaded choices even if current permissions exclude them.
- Edit mechanics: `src/foundation/contract.md`, “Edit PATCH”.
- Delete mechanics: `src/foundation/contract.md`, “Soft delete and force”. No assignment-specific proxy pre-check;
  `RoleAssignmentController.sync` marks Deleted then removes; no force handling.
- YAML mechanics: `src/foundation/contract.md`, “YAML import and export”. RoleAssignment maps to role_assignments,
  exportable, no credentials.
- Group detail (`GroupRoleAssignments`, `useGroupRoleAssignments`): subject kind/name filters, name ascending,
  unpaged; Team requires global assignment read, department any-scope read.
- User detail (`UserEffectiveRoleAssignments`, `useUserEffectiveRoleAssignments`): POST RPC `{p_user_id:userId}`;
  id/name/spec/via_kind/via_name rows, ordered by kind/group/name; origin shown, denial hidden, other errors inline.

## Descriptions

`useRoleAssignmentForm`: name placeholder `role_assignments.placeholders.policyName`; no name/role rules.
User requires a truthy id (`validation.userRequired`); group name requires trimmed nonblank
(`validation.teamRequired|orgUnitRequired`). Workspace requires trimmed nonblank (`validation.workspaceRequired`).
Department/Team scope rejects blank strings but accepts null/undefined; payload text is not trimmed.
Help: `descriptions.policyScope`, `descriptions.scopeTeam`.

## Scope and subject constraints

`api.validate_role_assignments` and `api.enforce_global_role_assignment` (`131_group_role_assignments`):
global has no workspace; department scope has global false and no workspace; Team scope also has no department.
All-null subject fields retain the old subject;
all-null/empty scope fields retain the old scope. Explicit false prevents scope backfill. Role is not backfilled.

`api.check_org_role_binding`: Active department subtree; `api.check_team_role_binding`: named Active Team
through `api.has_permission_on_team`, never global/department rights. `api.check_role_binding`: global grants only.
`api.role_assignments_check_delegated_grant` checks old/new specs without global permission.
`api.check_role_assignment_delegation`: User/OrgUnit subject, department scope, target/scope inside managed
Active subtrees, role permissions within the caller's held permissions.

`api.user_groups` / `api.user_role_assignments` expand Active Teams and department ancestors; the primary department
must be Active. Deleted grants do not count. Subject group and scope are independent.
`api.validate_role_assignments` rejects ServiceAccount kind or a service-account user_id with 10326.
`api.user_role_assignments` synthesizes enabled service accounts' grants from Active Team application permissions.
UI choices are User/Team/OrgUnit; users come from user_profiles, not service_accounts.

## Overrides

- Delegated create starts in department scope; global default ignores asynchronously loaded license
  (form comment).
- Team scope needs global assignment create/update; Team subject also needs global team:read and no delegation.
  Teams cross departments (10297).
- Non-global callers cannot pick `TEAM_ADMIN_PRESET`, except the loaded role; existing edits retain it.
- `setSubjectKind` writes every subject field because composite PATCH clears omitted fields (kept backend comment).
  `setScope` omits unused team for older servers.
- `admin-global-role-assignment`: seed `db/seed/001_default-role-and-users.sql` creates User/admin/global.
  List/show and update/delete policies (`131`) protect that name, not every admin-role assignment.

## Error mapping

Toast mechanics: `src/foundation/contract.md`, “Error toast path”.
`lib/role-assignment-errors.ts:roleAssignmentErrorMessage` uses `translateApiError`; no field mapping.
Mapped: 10041 workspace; 10280 legacy subtree; 10281/10282 conflict/missing;
10283/10284 delegation scope; 10285/10286 role missing/exceeds grant; 10292/10293/10294 subject kind/mismatch/missing;
10297 delegated Team subject; 10298 no scope; 10326 service account.
Unmapped: 10001/10003/10004 name, 10032 user, 10033 role, 10034 workspace, 10312/10313 Team scope,
10314 delegated Team scope, unique violations and permission/protected-policy failures.

## Known deviations

1. Workspace scope is offered but cannot be saved.
   UI: `lib/scope.ts:availableScopes` offers it with a license.
   API: `api.enforce_global_role_assignment` (`131`) refuses it with 10041.
   Users can complete the form but saving fails with a toast. Ticket: TBD
2. Protected assignments remain writable through alternate entry points.
   UI: `src/pages/role-assignments/list.tsx:RoleAssignmentsList` enables batch delete;
   `hooks/use-role-assignment-form.tsx:useRoleAssignmentForm` allows direct edit.
   API: role assignment update/delete policies (`131`) exclude admin-global-role-assignment.
   Users can attempt protected writes and receive a permission error. Ticket: TBD
3. Required names and roles have no client validation.
   UI: `hooks/use-role-assignment-form.tsx:useRoleAssignmentForm` registers both without rules.
   API: `api.validate_metadata_name` (`004`) rejects invalid names;
   `api.validate_role_assignments` (`131`) requires role.
   Users submit incomplete forms and see a toast instead of a field error. Ticket: TBD
4. Assignment human names are ignored.
   UI: `src/pages/role-assignments/show.tsx:RoleAssignmentsShow` uses technical names only.
   API: `v1.Metadata.DisplayName` (`api/v1/basic_types.go`) is preserved by
   `update_metadata_update_timestamp_column` (`019_annotations`). Users cannot see policy display names here.
   Ticket: TBD

## Open points

No live API/concurrency tested. Reopen tests reset API records; Refine hydration is untested.
