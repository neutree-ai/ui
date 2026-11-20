# Role contract

Backend: `v1.Role`, `RoleSpec`, `RoleStatus` (`api/v1/role_types.go`); `api.roles`, `api.role_spec`
(`001_rbac`). `RegisterRoleRoutes` (`internal/routes/proxies/role_proxy.go`): GET/POST/PATCH `/api/v1/roles`;
No UI RPC. Global `role:create|update|delete`; department-scoped `role:read` through
`api.has_permission_on_org_unit` (`125_org_scoped_role_assignments`).
Global `roles`, key `metadata->name` (`src/App.tsx`). Backend: `origin/main@062192f6`.
UI paths are relative to `src/domains/role/`; migrations are under `db/migrations/`.

## Type

`types.ts`; form defaults below. `v1.Role` has no secrets or `api:"-"` fields.

| path | type | required/default | owner | secret | edit | backend rule |
|---|---|---|---|---|---|---|
| `id` | integer | serial | server | no | no | primary key (`001_rbac`) |
| `api_version`, `kind` | strings | v1, Role | user | no | no UI | NOT NULL |
| `metadata.name` | string | required; blank | user | no | no UI | `validate_metadata_name`; `roles_name_unique_idx` |
| `metadata.workspace` | string/null | absent | user | no | no UI | global resource |
| `metadata.display_name`, `.labels`, `.annotations` | string, maps | absent | user | no | no UI | `v1.Metadata` |
| `metadata.creation_timestamp`, `.update_timestamp` | timestamps | current time | server | no | no | timestamp triggers (`019_annotations`) |
| `metadata.deletion_timestamp` | timestamp | absent | user | no | delete | `validate_soft_delete` (`022`) |
| `spec.preset_key` | enum/null | null | provisioner | no | no UI | `api.role_preset`; protection below |
| `spec.permissions` | enum array | empty array | user | no | custom roles | `api.permission_action[]` |
| `status.phase` | Pending/Created/Deleted | absent | server | no | no | `RoleController.sync` |
| `status.error_message`, `.last_transition_time` | text/timestamp | absent | server | no | no | `RoleController.updateStatus` |

Spec and permissions are nullable (`001_rbac`); UI types require both.
`RolePreset` misspells `workspace-user` as `workspace_user` and omits `department-admin`; truthiness still detects both.

## Roles

- Labels: `lib/format-permission.ts:formatPermission`, `formatResource`; tests beside the helper.
- Ordering: `sortPermissionResources`; tests in `lib/permission-resource-order.test.ts`.
- Dependencies: `usePermissionDependencies`; tests beside the hook and in `PermissionsTreeField.test.tsx`.
- Time: `useMetadataColumns().creation_timestamp`, `MetadataTimestampMeta`; no status display.
  Counts use `common.fields.permissionsCount` on the raw array.

## Scenes

- List (`src/pages/roles/list.tsx:RolesList`, `useRoleColumns`): name, permission count, created, actions;
  `metadata->>name` search, newest-created `defaultSorters`, filters/sorting, batch delete.
  Presets omit row edit/delete; custom rows offer both.
- Show (`src/pages/roles/show.tsx:RolesShow`): name, count, preset/custom label, timestamps, `PermissionsTree`;
  presets hide edit/delete. Missing record uses `pages.error.notFound`.
- Create (`hooks/use-role-form.tsx:useRoleForm`): name and `PermissionsTreeField`, `mode:"all"`, unsaved warning.
  Initial payload `{api_version:"v1",kind:"Role",metadata:{name},spec:{preset_key:null,permissions:[]}}`.
- Edit: name locked; loaded metadata, preset key, headers, id and status retained. Missing dependencies are
  appended and reported on load; complete arrays stay unchanged. No direct-route preset guard.
- Edit mechanics: `src/foundation/contract.md`, “Edit PATCH”.
- Delete mechanics: `src/foundation/contract.md`, “Soft delete and force”. `validateRoleDeletion` returns 10129
  for assignments referencing the name and metadata workspace, or null workspace for global roles; force cannot
  bypass it. `RoleController.sync` marks Deleted, then removes on next reconcile.
- YAML mechanics: `src/foundation/contract.md`, “YAML import and export”. Role maps to `roles`, is exportable,
  without credentials.

## Descriptions

- Name: `common.fields.name`, placeholder `roles.placeholders.roleName`; no trim or validation.
- Permissions: `common.fields.permissions`; no minimum, uniqueness or enum validation on submit.
  Choices come only from `ALL_PERMISSIONS`; loaded unlisted permissions remain in the submitted array.

## Overrides

- `ALL_RULES`: CRUD adds same-resource read except model delete; model operations add registry read, push also
  adds model read. Workspaced non-read actions add workspace read. Assignment adds the related membership read;
  workspace usage and model invocation add workspace read. Comments cite model-alias RLS and member-row reads.
- Backfill keeps old roles consistent with newer UI rules (original field comment).
- `PermissionsTree:hiddenResources` hides static-node groups; reason unknown.
- `PermissionsTreeField` appends `missingDependencies` on load, so saving an untouched role also stores the
  dependency reads (a push-only role gains model and registry read). Intended: users reason about one permission
  and get what it needs to work.
- Preset actions use `Boolean(spec.preset_key)`; technical-name-only presentation has no recorded reason.

## Permission coverage

All `api.permission_action` definitions were compared with `types.ts:ALL_PERMISSIONS`:
85 backend values, 75 UI choices, no UI-only values; ten missing values below.
Full coverage: initial CRUD (`001_rbac`), catalog (`006`), system admin (`008`), profiles (`033`),
model operations (`042`), external endpoints (`052`), traces (`060`), workspace usage (`064`), identity sources (`104`),
organization reads/assignment (`119`) and tenancy permissions (`130`). Partial coverage is listed below.

| enum migration | backend values missing from picker |
|---|---|
| `037_sensitive_field_permission` | image_registry:read-credentials, model_registry:read-credentials, cluster:read-credentials |
| `058_external_endpoint_read_credentials` | external_endpoint:read-credentials |
| `074_static_node_read_permission` | static_node_cluster:read, static_node:read |
| `114_log_sink_permission` | log_sink:read-credentials |
| `128_team_write_permissions` | team:create, team:update, team:delete |

## Protected roles

Backend preset keys: `admin`, `workspace-user`, `department-admin`, `team-admin`, `model-invoker`
(`001_rbac`, `124_department_admin_preset`, `130_tenancy_permissions`). Seed SQL creates the first two;
`125` and `131` provision the others. `api.update_admin_permissions` grants the whole enum;
`api.update_workspace_user_permissions` (`134`) maintains workspace-user. Department/team grants are maintained by
`api.update_department_admin_permissions` / `api.update_team_admin_permissions` (`137_subject_policies`).
Model invoker has invoke and workspace read (`131`). Scope belongs to assignments.

The role update policy (`047_fix_role_soft_delete_policy`) uses `USING(true)` and checks the resulting row:
null preset key plus global update permission for live rows, or global delete permission for deleted rows.
Normal UI edits retain the preset key and are refused; this is not an immutable-key trigger.
Physical delete also requires a null preset key (`028_protect_preset_roles`, role delete policy).

## Error mapping

Toast mechanics: `src/foundation/contract.md`, “Error toast path”. No field mapping.
`api.validate_metadata_name` (`004_required_fields`): 10001 missing, 10003 invalid lowercase DNS-style name with dots,
10004 over 63 characters. Other failures: duplicate name (`roles_name_unique_idx`), invalid enum input,
permission/preset policy rejection, deletion 10129, soft-delete spec/status changes.

## Known deviations

1. Team write permissions cannot be granted here.
   UI: `types.ts:ALL_PERMISSIONS` lacks `team:create|update|delete`; `TeamsPanel`
   (`src/domains/organization/components/TeamsPanel.tsx`) and `UsageScopePanel`
   (`src/pages/model-usage/components/UsageScopePanel.tsx`) gate controls on them.
   API: `api.permission_action` (`128_team_write_permissions`); team write policies (`129_manual_teams`).
   Users cannot build a custom role here that enables those controls. Ticket: TBD
2. Credential and static-node permissions cannot be selected.
   UI: `types.ts:ALL_PERMISSIONS` omits five read-credentials values and two static-node reads in the coverage table.
   API: `api.permission_action` (`037`, `058`, `074`, `114`), `RegisterCredentialsRoutes`
   (`internal/routes/credentials/credentials.go`) and `backfillAuthCredential` enforce credential permissions.
   Users cannot grant these rights here, so ordinary read grants cannot authorize credential-inclusive exports or
   stored-key connectivity tests. Ticket: TBD
3. Static-node grants disappear from detail.
   UI: `components/PermissionsTree.tsx:parsePermissionsToTree` filters static nodes; `RolesShow` counts all grants.
   API: `api.permission_action` (`074_static_node_read_permission`), `v1.RoleSpec.Permissions` returns both reads.
   Users cannot inspect grants included in the count. Ticket: TBD
4. Preset write paths remain available.
   UI: `RolesList` enables batch delete; `useRoleForm` has no preset guard, while `RolesShow` hides writes.
   API: role update policy (`047_fix_role_soft_delete_policy`) rejects the retained non-null preset key.
   These paths let users attempt writes that fail. Ticket: TBD
5. Invalid names lack field validation.
   UI: `hooks/use-role-form.tsx:useRoleForm` has no name rules. API: `api.validate_metadata_name`
   (`004_required_fields`) enforces required, format and length. Users can submit invalid names and receive a toast
   instead of a field error. Ticket: TBD
6. Human names are ignored.
   UI: `useRoleColumns`, `RolesList`, `RolesShow`, `useRoleForm` use only `metadata.name`.
   API: `Metadata.DisplayName` (`api/v1/basic_types.go`); timestamp function
   `update_metadata_update_timestamp_column` (`019_annotations`).
   Users cannot see, search or edit human role names here. Ticket: TBD

## Open points

Live API, concurrency, null spec/permission rendering and batch partial failures were not exercised.
